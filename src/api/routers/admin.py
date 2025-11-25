from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import date, timedelta, datetime
import lightgbm as lgb
from ..db import get_db
from ..state import get_model, get_feature_store
from ..services.batch_forecast import run_daily_forecast_job
from ..services.store import FeatureStore
from ..models import JobExecution, TransportLine, DailyForecast

router = APIRouter()


# Schemas
class JobLogResponse(BaseModel):
    id: int
    status: str
    start_time: datetime
    end_time: datetime | None
    records_processed: int
    error_message: str | None


class DashboardStats(BaseModel):
    total_lines: int
    total_forecasts: int
    last_run_status: str
    last_run_time: datetime | None


@router.get("/admin/jobs", response_model=List[JobLogResponse])
def get_job_history(limit: int = 10, db: Session = Depends(get_db)):
    return db.query(JobExecution).order_by(JobExecution.start_time.desc()).limit(limit).all()


@router.get("/admin/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_lines = db.query(TransportLine).count()
    total_forecasts = db.query(DailyForecast).count()
    last_job = db.query(JobExecution).order_by(JobExecution.start_time.desc()).first()

    return {
        "total_lines": total_lines,
        "total_forecasts": total_forecasts,
        "last_run_status": last_job.status if last_job else "N/A",
        "last_run_time": last_job.start_time if last_job else None
    }


@router.post("/admin/forecast/trigger")
def trigger_forecast_job(
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        model: lgb.Booster = Depends(get_model),
        store: FeatureStore = Depends(get_feature_store),
        target_date: date = None
):
    if target_date is None:
        target_date = date.today() + timedelta(days=1)

    print(f"Adding forecast job for {target_date} to background tasks.")
    background_tasks.add_task(run_daily_forecast_job, db, store, model, target_date)

    return {"message": "Forecast job started in the background.", "target_date": target_date}