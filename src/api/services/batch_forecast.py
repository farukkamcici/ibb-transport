from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
import pandas as pd
import lightgbm as lgb
from datetime import datetime
import traceback
from ..db import SessionLocal
from ..models import TransportLine, DailyForecast, JobExecution
from ..schemas import ModelInput
from ..state import COLUMN_ORDER
from .store import FeatureStore
from .weather import fetch_daily_weather_data_sync

# Placeholder for Istanbul coordinates
ISTANBUL_LAT = 41.0082
ISTANBUL_LON = 28.9784


def run_daily_forecast_job(db: Session, store: FeatureStore, model: lgb.Booster, target_date: datetime.date):
    """
    Run daily forecast job in background.
    NOTE: Creates its own DB session to avoid session lifecycle issues with background tasks.
    """
    # Create a NEW session for this background task (ignore the passed session)
    db = SessionLocal()
    job_log = None
    
    try:
        # 1. Create Job Log (STARTED)
        job_log = JobExecution(
            job_type="daily_forecast",
            target_date=target_date,
            status="RUNNING",
            start_time=datetime.now()
        )
        db.add(job_log)
        db.commit()
        db.refresh(job_log)

        print(f"Starting daily forecast job for date: {target_date} (Job ID: {job_log.id})")

        # Fetch all available lines
        all_lines = db.query(TransportLine.line_name).all()
        line_names = [line[0] for line in all_lines]
        print(f"Found {len(line_names)} lines to process.")

        # Fetch weather SYNC
        date_str = target_date.strftime("%Y-%m-%d")
        print(f"Fetching weather data for {date_str}...")
        daily_weather_data = fetch_daily_weather_data_sync(date_str, ISTANBUL_LAT, ISTANBUL_LON)
        print(f"Weather data fetched: {len(daily_weather_data)} hours available.")

        forecasts_to_insert = []
        processed_count = 0

        # Loop through lines and hours
        print(f"Starting prediction loop for {len(line_names)} lines × 24 hours...")
        
        # First check if calendar features exist
        calendar_features = store.get_calendar_features(date_str)
        if not calendar_features:
            error_msg = f"❌ CRITICAL: No calendar features found for {date_str}! Job cannot proceed."
            print(error_msg)
            raise ValueError(error_msg)
        
        print(f"✓ Calendar features loaded: {calendar_features}")
        
        print("Batch-loading lag features for all lines...")
        lag_batch = store.get_batch_historical_lags(line_names, date_str)
        print(f"✓ Lag features loaded: {len(lag_batch.get('seasonal', {}))} seasonal, {len(lag_batch.get('fallback', {}))} fallback")
        
        fallback_lags = {
            'lag_24h': 0.0, 'lag_48h': 0.0, 'lag_168h': 0.0,
            'roll_mean_24h': 0.0, 'roll_std_24h': 0.0
        }
        
        # Build all prediction inputs in batch
        batch_inputs = []
        batch_metadata = []
        
        for idx, line_name in enumerate(line_names):
            if idx % 100 == 0:
                print(f"Building inputs: {idx}/{len(line_names)} lines...")

            for hour in range(24):
                weather_data = daily_weather_data.get(hour)
                if not weather_data:
                    continue

                key = (line_name, hour)
                # Get lag features with proper fallback handling
                lag_features = lag_batch['seasonal'].get(key) or lag_batch['fallback'].get(key)
                
                # If no lag features found OR if lag features contain None values, use fallback
                if not lag_features or any(v is None for v in lag_features.values()):
                    lag_features = fallback_lags.copy()

                model_input_data = {
                    "line_name": line_name, "hour_of_day": hour,
                    **calendar_features, **weather_data, **lag_features
                }
                model_input = ModelInput(**model_input_data)
                batch_inputs.append(model_input.model_dump())
                batch_metadata.append((line_name, hour))

        # Batch prediction (much faster!)
        if batch_inputs:
            print(f"Running batch predictions for {len(batch_inputs)} records...")
            df_batch = pd.DataFrame(batch_inputs)
            df_batch = df_batch[COLUMN_ORDER]
            df_batch['line_name'] = df_batch['line_name'].astype('category')
            df_batch['season'] = df_batch['season'].astype('category')
            
            # Single batch prediction call
            predictions = model.predict(df_batch)
            print(f"Predictions complete! Processing results...")
            
            # Process results
            for idx, (prediction_np, (line_name, hour)) in enumerate(zip(predictions, batch_metadata)):
                if idx % 5000 == 0:
                    print(f"Processing results: {idx}/{len(predictions)}...")
                    
                prediction = float(max(0, prediction_np))
                max_capacity = store.line_max_capacity.get(line_name, store.global_average_max)
                occupancy_pct = 0
                if max_capacity > 0:
                    occupancy_pct = round((prediction / max_capacity) * 100)

                crowd_level = store.get_crowd_level(line_name, prediction)

                forecasts_to_insert.append({
                    "line_name": line_name,
                    "date": target_date,
                    "hour": hour,
                    "predicted_value": prediction,
                    "occupancy_pct": occupancy_pct,
                    "crowd_level": crowd_level,
                    "max_capacity": int(max_capacity)
                })
            
            processed_count = len(forecasts_to_insert)
            print(f"Result processing complete: {processed_count} forecasts ready.")

        # Bulk Upsert
        if forecasts_to_insert:
            print(f"Inserting {len(forecasts_to_insert)} forecast records...")
            stmt = insert(DailyForecast).values(forecasts_to_insert)
            stmt = stmt.on_conflict_do_update(
                constraint='_line_date_hour_uc',
                set_={
                    'predicted_value': stmt.excluded.predicted_value,
                    'occupancy_pct': stmt.excluded.occupancy_pct,
                    'crowd_level': stmt.excluded.crowd_level,
                    'max_capacity': stmt.excluded.max_capacity,
                }
            )
            db.execute(stmt)
            db.commit()
            print(f"Successfully inserted {len(forecasts_to_insert)} records.")
        else:
            print("⚠️ No forecasts generated. Check calendar/weather data availability.")

        # 2. Update Job Log (SUCCESS)
        job_log.status = "SUCCESS"
        job_log.end_time = datetime.now()
        job_log.records_processed = processed_count
        db.commit()

        # 3. Log Feature Store fallback statistics for monitoring
        fallback_stats = store.get_fallback_stats()
        print(f"✅ Job {job_log.id} completed. Processed {processed_count} predictions.")
        print(f"📊 Lag Fallback Stats: {fallback_stats.get('seasonal_pct', 0):.1f}% seasonal, "
              f"{fallback_stats.get('hour_fallback_pct', 0):.1f}% hour-based, "
              f"{fallback_stats.get('zero_fallback_pct', 0):.1f}% zeros")
        
        return {
            "status": "success", 
            "processed_count": processed_count,
            "fallback_stats": fallback_stats
        }

    except Exception as e:
        # 3. Update Job Log (FAILED)
        db.rollback()
        error_details = traceback.format_exc()
        print(f"❌ Job failed: {e}")
        print(f"Full traceback:\n{error_details}")

        try:
            # Fetch job_log again in case it was detached or never created
            if job_log is None or job_log.id is None:
                job_log = db.query(JobExecution).filter(
                    JobExecution.status == "RUNNING"
                ).order_by(JobExecution.start_time.desc()).first()
            
            if job_log:
                job_log.status = "FAILED"
                job_log.end_time = datetime.now()
                job_log.error_message = error_details[:1000]  # Limit to 1000 chars
                db.commit()
                print(f"Updated job {job_log.id} status to FAILED.")
        except Exception as update_error:
            print(f"Failed to update job status: {update_error}")
            db.rollback()

        return {"status": "failed", "error": str(e)}
    
    finally:
        # Always close the session we created
        db.close()
        print("Database session closed.")