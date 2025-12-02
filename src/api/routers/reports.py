from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import UserReport, AdminUser
from ..schemas import ReportCreate, ReportResponse, ReportUpdate
from ..auth import get_current_user

router = APIRouter()


# ============================================
# PUBLIC ENDPOINTS (No Auth Required)
# ============================================

@router.post("/reports", response_model=ReportResponse, status_code=201)
def create_report(
    report: ReportCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new user report (bug, data issue, or feature request).
    Public endpoint - no authentication required.
    
    Args:
        report: Report data including type, description, optional line_code and email
    
    Returns:
        Created report with ID and timestamp
    """
    try:
        new_report = UserReport(
            report_type=report.report_type.value,
            line_code=report.line_code,
            description=report.description,
            contact_email=report.contact_email,
            status="new"
        )
        
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
        
        print(f"✅ New {report.report_type.value} report created (ID: {new_report.id})")
        
        return new_report
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating report: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create report. Please try again later."
        )


# ============================================
# PROTECTED ADMIN ENDPOINTS (Auth Required)
# ============================================

@router.get("/admin/reports", response_model=List[ReportResponse])
def list_reports(
    status: Optional[str] = Query(None, description="Filter by status (new, in_progress, resolved, closed)"),
    report_type: Optional[str] = Query(None, description="Filter by type (bug, data, feature)"),
    line_code: Optional[str] = Query(None, description="Filter by line code"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of reports to return"),
    offset: int = Query(0, ge=0, description="Number of reports to skip"),
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    """
    List all user reports with optional filtering and pagination.
    Admin only endpoint.
    
    Query Parameters:
        - status: Filter by report status
        - report_type: Filter by report type (bug/data/feature)
        - line_code: Filter by specific transport line
        - limit: Max results (default 50, max 500)
        - offset: Skip N results for pagination
    
    Returns:
        List of reports ordered by creation date (newest first)
    """
    query = db.query(UserReport)
    
    # Apply filters
    if status:
        query = query.filter(UserReport.status == status)
    
    if report_type:
        query = query.filter(UserReport.report_type == report_type)
    
    if line_code:
        query = query.filter(UserReport.line_code == line_code)
    
    # Order by newest first and apply pagination
    reports = query.order_by(UserReport.created_at.desc()).offset(offset).limit(limit).all()
    
    return reports


@router.get("/admin/reports/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    """
    Get a specific report by ID.
    Admin only endpoint.
    """
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Report with ID {report_id} not found"
        )
    
    return report


@router.patch("/admin/reports/{report_id}", response_model=ReportResponse)
def update_report_status(
    report_id: int,
    report_update: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    """
    Update the status of a report.
    Admin only endpoint.
    
    Valid statuses:
        - new: Initial state
        - in_progress: Being worked on
        - resolved: Issue fixed/implemented
        - closed: No action needed or completed
    """
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Report with ID {report_id} not found"
        )
    
    try:
        old_status = report.status
        report.status = report_update.status
        db.commit()
        db.refresh(report)
        
        print(f"✅ Report {report_id} status updated: {old_status} → {report_update.status} by {current_user.username}")
        
        return report
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error updating report {report_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update report status"
        )


@router.delete("/admin/reports/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    """
    Delete a report by ID.
    Admin only endpoint.
    Use with caution - this action cannot be undone.
    """
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"Report with ID {report_id} not found"
        )
    
    try:
        db.delete(report)
        db.commit()
        
        print(f"🗑️  Report {report_id} ({report.report_type}) deleted by {current_user.username}")
        
        return {"message": f"Report {report_id} deleted successfully"}
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error deleting report {report_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete report"
        )


@router.get("/admin/reports/stats/summary")
def get_reports_summary(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    """
    Get summary statistics about reports.
    Admin only endpoint.
    
    Returns:
        - Total reports count
        - Counts by status
        - Counts by type
        - Recent reports (last 7 days)
    """
    from sqlalchemy import func, case
    from datetime import timedelta
    
    total_reports = db.query(UserReport).count()
    
    # Count by status
    status_counts = db.query(
        UserReport.status,
        func.count(UserReport.id).label('count')
    ).group_by(UserReport.status).all()
    
    # Count by type
    type_counts = db.query(
        UserReport.report_type,
        func.count(UserReport.id).label('count')
    ).group_by(UserReport.report_type).all()
    
    # Recent reports (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_count = db.query(UserReport).filter(
        UserReport.created_at >= seven_days_ago
    ).count()
    
    return {
        "total_reports": total_reports,
        "by_status": {status: count for status, count in status_counts},
        "by_type": {str(report_type): count for report_type, count in type_counts},
        "recent_reports_7d": recent_count
    }
