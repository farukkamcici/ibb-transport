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
    job_type: str
    target_date: date | None
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
def get_job_history(limit: int = 20, db: Session = Depends(get_db)):
    """Get job execution history with configurable limit (default: 20)"""
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


@router.post("/admin/jobs/reset")
def reset_stuck_jobs(db: Session = Depends(get_db)):
    """
    Reset all jobs stuck in RUNNING status to FAILED.
    Useful for cleaning up after server crashes or interrupted jobs.
    """
    stuck_jobs = db.query(JobExecution).filter(JobExecution.status == "RUNNING").all()
    
    if not stuck_jobs:
        return {"message": "No stuck jobs found.", "reset_count": 0}
    
    reset_count = 0
    for job in stuck_jobs:
        job.status = "FAILED"
        job.end_time = datetime.now()
        job.error_message = "Job reset by admin - was stuck in RUNNING state"
        reset_count += 1
    
    db.commit()
    
    return {"message": f"Reset {reset_count} stuck job(s) to FAILED status.", "reset_count": reset_count}


@router.get("/admin/feature-store/stats")
def get_feature_store_stats(store: FeatureStore = Depends(get_feature_store)):
    """
    Get Feature Store fallback strategy statistics.
    Shows how often seasonal vs. hour-based vs. zero fallbacks are used.
    """
    return {
        "fallback_stats": store.get_fallback_stats(),
        "config": {
            "max_seasonal_lookback_years": store.max_seasonal_lookback_years
        }
    }


@router.post("/admin/feature-store/reset-stats")
def reset_feature_store_stats(store: FeatureStore = Depends(get_feature_store)):
    """Reset fallback statistics counter."""
    store.reset_fallback_stats()
    return {"message": "Fallback statistics reset successfully."}


@router.post("/admin/forecast/test")
def test_forecast_quick(
    db: Session = Depends(get_db),
    model: lgb.Booster = Depends(get_model),
    store: FeatureStore = Depends(get_feature_store),
    num_lines: int = 5,
    num_hours: int = 3
):
    """
    Quick test: Run forecast for only N lines × M hours.
    Returns timing info and sample predictions.
    """
    import time
    from ..services.weather import fetch_daily_weather_data_sync
    from ..schemas import ModelInput
    from ..state import COLUMN_ORDER
    import pandas as pd
    
    target_date = (date.today() + timedelta(days=1))
    date_str = target_date.strftime("%Y-%m-%d")
    
    timing = {}
    start = time.time()
    
    # 1. Get lines
    all_lines = db.query(TransportLine.line_name).limit(num_lines).all()
    line_names = [line[0] for line in all_lines]
    timing['lines_fetch'] = time.time() - start
    
    # 2. Get weather
    start = time.time()
    weather_data = fetch_daily_weather_data_sync(date_str, 41.0082, 28.9784)
    timing['weather_fetch'] = time.time() - start
    
    # 3. Get calendar
    start = time.time()
    calendar_features = store.get_calendar_features(date_str)
    timing['calendar_fetch'] = time.time() - start
    
    # 4. Build inputs
    start = time.time()
    lag_batch_start = time.time()
    lag_batch = store.get_batch_historical_lags(line_names, date_str)
    timing['lag_batch_fetch'] = time.time() - lag_batch_start
    
    fallback_lags = {
        'lag_24h': 0.0, 'lag_48h': 0.0, 'lag_168h': 0.0,
        'roll_mean_24h': 0.0, 'roll_std_24h': 0.0
    }
    
    batch_inputs = []
    for line_name in line_names:
        for hour in range(num_hours):
            key = (line_name, hour)
            lag_features = lag_batch['seasonal'].get(key) or lag_batch['fallback'].get(key) or fallback_lags
            
            model_input_data = {
                "line_name": line_name, "hour_of_day": hour,
                **calendar_features, **weather_data.get(hour, {}), **lag_features
            }
            model_input = ModelInput(**model_input_data)
            batch_inputs.append(model_input.model_dump())
    timing['input_building'] = time.time() - start
    avg_lag_time = timing['lag_batch_fetch'] / len(batch_inputs) if batch_inputs else 0
    
    # 5. Predict
    start = time.time()
    df_batch = pd.DataFrame(batch_inputs)
    df_batch = df_batch[COLUMN_ORDER]
    df_batch['line_name'] = df_batch['line_name'].astype('category')
    df_batch['season'] = df_batch['season'].astype('category')
    predictions = model.predict(df_batch)
    timing['prediction'] = time.time() - start
    
    # Estimate full job time
    estimated_full_time = (timing['input_building'] / (num_lines * num_hours)) * (1023 * 24)
    
    return {
        "test_config": f"{num_lines} lines × {num_hours} hours = {len(batch_inputs)} predictions",
        "timing_seconds": timing,
        "avg_lag_fetch_time": f"{avg_lag_time:.4f}s",
        "sample_predictions": predictions[:5].tolist(),
        "estimated_full_job_time": f"{estimated_full_time:.1f}s ({estimated_full_time/60:.1f} min)",
        "bottleneck": "lag_fetch" if avg_lag_time > 0.01 else "prediction"
    }