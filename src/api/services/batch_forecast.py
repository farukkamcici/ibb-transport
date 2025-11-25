from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
import pandas as pd
import lightgbm as lgb
from datetime import datetime
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
    # 1. Create Job Log (STARTED)
    job_log = JobExecution(
        job_type="daily_forecast",
        status="RUNNING",
        start_time=datetime.now()
    )
    db.add(job_log)
    db.commit()
    db.refresh(job_log)

    print(f"Starting daily forecast job for date: {target_date} (Job ID: {job_log.id})")

    try:
        # Fetch all available lines
        all_lines = db.query(TransportLine.line_name).all()
        line_names = [line[0] for line in all_lines]
        print(f"Found {len(line_names)} lines to process.")

        # Fetch weather SYNC
        date_str = target_date.strftime("%Y-%m-%d")
        daily_weather_data = fetch_daily_weather_data_sync(date_str, ISTANBUL_LAT, ISTANBUL_LON)

        forecasts_to_insert = []
        processed_count = 0

        # Loop through lines and hours
        for line_name in line_names:
            calendar_features = store.get_calendar_features(date_str)
            if not calendar_features:
                continue

            for hour in range(24):
                weather_data = daily_weather_data.get(hour)
                if not weather_data:
                    continue

                # --- CHANGE HERE: Pass date_str for seasonal matching ---
                lag_features = store.get_historical_lags(line_name, hour, date_str)
                # -------------------------------------------------------

                model_input_data = {
                    "line_name": line_name, "hour_of_day": hour,
                    **calendar_features, **weather_data, **lag_features
                }
                model_input = ModelInput(**model_input_data)

                df = pd.DataFrame([model_input.model_dump()])
                df = df[COLUMN_ORDER]

                # Enforce categorical types
                df['line_name'] = df['line_name'].astype('category')
                df['season'] = df['season'].astype('category')

                # Run prediction
                prediction_np = max(0, model.predict(df)[0])
                prediction = float(prediction_np)

                # Stats
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
                processed_count += 1

        # Bulk Upsert
        if forecasts_to_insert:
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

        # 2. Update Job Log (SUCCESS)
        job_log.status = "SUCCESS"
        job_log.end_time = datetime.now()
        job_log.records_processed = processed_count
        db.commit()

        print(f"✅ Job {job_log.id} completed. Processed {processed_count} predictions.")
        return {"status": "success", "processed_count": processed_count}

    except Exception as e:
        # 3. Update Job Log (FAILED)
        db.rollback()
        print(f"❌ Job {job_log.id} failed: {e}")

        job_log.status = "FAILED"
        job_log.end_time = datetime.now()
        job_log.error_message = str(e)
        db.add(job_log)
        db.commit()

        return {"status": "failed", "error": str(e)}