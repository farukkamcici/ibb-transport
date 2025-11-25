import polars as pl
import time
from datetime import datetime


class FeatureStore:
    def __init__(self, features_path='data/processed/features_pl.parquet',
                 calendar_path='data/processed/calendar_dim.parquet'):
        print("Initializing Feature Store with Polars... 🐻‍❄️")
        start_time = time.time()
        try:
            # 1. Select required columns
            required_cols = [
                'line_name', 'hour_of_day', 'y', 'datetime',
                'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h'
            ]

            # 2. Load and Optimization
            # We convert datetime immediately to allow .dt accessors
            self.features_df = pl.read_parquet(features_path, columns=required_cols).with_columns([
                pl.col(['y', 'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']).cast(pl.Float32),
                pl.col('hour_of_day').cast(pl.UInt8),
                pl.col('datetime').cast(pl.Datetime)  # Ensure it is Datetime type
            ])

            self.calendar_df = pl.read_parquet(calendar_path)

            # 3. Calculate Thresholds
            max_caps = self.features_df.group_by("line_name").agg(pl.col("y").max().alias("max_y"))
            self.line_max_capacity = dict(zip(max_caps["line_name"], max_caps["max_y"]))
            self.global_average_max = max_caps["max_y"].mean() if not max_caps.is_empty() else 0

            # 4. No Dictionary Cache (We filter on-the-fly)
            self.lags_cache = None

            elapsed = time.time() - start_time
            print(f"Feature Store initialized successfully in {elapsed:.2f}s.")

        except Exception as e:
            print(f"Error initializing FeatureStore: {e}. Make sure data files exist.")
            self.features_df = None
            self.calendar_df = None
            self.line_max_capacity = {}
            self.global_average_max = 0

    def get_calendar_features(self, date_str: str) -> dict:
        if self.calendar_df is None: return {}
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

        record = self.calendar_df.filter(pl.col("date") == target_date)

        if record.is_empty(): return {}

        features = record.select([
            'day_of_week', 'is_weekend', 'month', 'season', 'is_school_term',
            'is_holiday', 'holiday_win_m1', 'holiday_win_p1'
        ]).row(0, named=True)

        season_map = {1: "Winter", 2: "Spring", 3: "Summer", 4: "Fall"}
        season_val = features.get('season')
        if season_val is not None:
            features['season'] = season_map.get(season_val, str(season_val))

        return features

    def get_historical_lags(self, line_name: str, hour: int, target_date_str: str) -> dict:
        """
        Smart Retrieval Strategy:
        1. Try to find the most recent historical record for the SAME MONTH and DAY.
           (e.g., if predicting for Nov 24 2025, try to find Nov 24 2024, 2023...)
        2. If not found, fallback to the absolute latest record available for that line/hour.
        """
        fallback_lags = {
            'lag_24h': 0.0, 'lag_48h': 0.0, 'lag_168h': 0.0,
            'roll_mean_24h': 0.0, 'roll_std_24h': 0.0
        }
        if self.features_df is None: return fallback_lags

        target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
        target_month = target_dt.month
        target_day = target_dt.day

        lag_cols = ['lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']

        # --- STRATEGY 1: Seasonal Match (Same Month & Day) ---
        seasonal_match = self.features_df.filter(
            (pl.col("line_name") == line_name) &
            (pl.col("hour_of_day") == hour) &
            (pl.col("datetime").dt.month() == target_month) &
            (pl.col("datetime").dt.day() == target_day) &
            (pl.col("datetime") < target_dt)  # Ensure we don't pick future if dataset has it
        ).sort("datetime", descending=True).limit(1)

        if not seasonal_match.is_empty():
            return seasonal_match.select(lag_cols).row(0, named=True)

        # --- STRATEGY 2: Fallback (Absolute Latest Record) ---
        # If Nov 24 doesn't exist in history, take the last known data point.
        latest_record = self.features_df.filter(
            (pl.col("line_name") == line_name) &
            (pl.col("hour_of_day") == hour)
        ).sort("datetime", descending=True).limit(1)

        if not latest_record.is_empty():
            return latest_record.select(lag_cols).row(0, named=True)

        return fallback_lags

    def get_crowd_level(self, line_name: str, prediction_value: float) -> str:
        max_capacity = self.line_max_capacity.get(line_name, self.global_average_max)
        if max_capacity is None or max_capacity == 0: return "Unknown"

        occupancy_rate = prediction_value / max_capacity
        if occupancy_rate < 0.30: return "Low"
        if occupancy_rate < 0.60: return "Medium"
        if occupancy_rate < 0.90: return "High"
        return "Very High"