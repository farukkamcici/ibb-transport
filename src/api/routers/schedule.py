from fastapi import APIRouter, HTTPException
from typing import Dict, List
from pydantic import BaseModel

from ..services.schedule_service import schedule_service

router = APIRouter()


class ScheduleResponse(BaseModel):
    """Response model for bus schedule"""
    G: List[str]  # Forward direction (Gidiş)
    D: List[str]  # Return direction (Dönüş)


@router.get("/lines/{line_code}/schedule", response_model=ScheduleResponse)
def get_line_schedule(line_code: str):
    """
    Get planned bus schedule for a specific line.
    
    Fetches schedule from IETT API and returns times filtered by today's day type:
    - Weekdays (Monday-Friday): "I" (İş Günü)
    - Saturday: "C" (Cumartesi)
    - Sunday: "P" (Pazar)
    
    Results are cached for 1 hour to reduce API calls.
    
    Args:
        line_code: Bus line code (e.g., "15F", "500T", "M2")
        
    Returns:
        Dictionary with directions (G/D) and sorted time lists
        Example:
        {
            "G": ["06:00", "06:20", "06:40", ...],
            "D": ["06:15", "06:35", "06:55", ...]
        }
        
    Raises:
        HTTPException 404: If line not found or no schedule available
        HTTPException 500: If external API fails
    """
    try:
        schedule = schedule_service.get_schedule(line_code)
        
        # Check if schedule is empty
        if not schedule.get("G") and not schedule.get("D"):
            raise HTTPException(
                status_code=404,
                detail=f"No schedule found for line '{line_code}'. The line may not exist or schedule data is unavailable."
            )
        
        return ScheduleResponse(**schedule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch schedule: {str(e)}"
        )


@router.post("/admin/schedule/clear-cache")
def clear_schedule_cache(line_code: str = None):
    """
    Clear schedule cache (admin only).
    
    Args:
        line_code: Optional line code to clear specific cache. If not provided, clears all.
        
    Returns:
        Success message
    """
    schedule_service.clear_cache(line_code)
    
    if line_code:
        return {"message": f"Cache cleared for line {line_code}"}
    else:
        return {"message": "All schedule cache cleared"}


@router.get("/admin/schedule/cache-stats")
def get_cache_stats():
    """
    Get schedule cache statistics (admin only).
    
    Returns:
        Cache statistics including size and TTL
    """
    return schedule_service.get_cache_stats()
