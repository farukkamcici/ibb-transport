import polars as pl
import time
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class FeatureStore:
    def __init__(self, features_path='data/processed/features_pl.parquet',
                 calendar_path='data/processed/calendar_dim.parquet',
                 max_seasonal_lookback_years=3):
        print("Initializing Feature Store with Polars... 🐻‍❄️")
        start_time = time.time()
        self.max_seasonal_lookback_years = max_seasonal_lookback_years
        
        # Fallback strategy monitoring
        self.fallback_stats = {
            'seasonal_match': 0,
            'hour_fallback': 0,
            'zero_fallback': 0
        }
        
        try:
            # 1. Select required columns
            required_cols = [
                'line_name', 'hour_of_day', 'y', 'datetime',
                'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h'
            ]

            # 2. Load and Optimization
            self.features_df = pl.read_parquet(features_path, columns=required_cols).with_columns([
                pl.col(['y', 'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']).cast(pl.Float32),
                pl.col('hour_of_day').cast(pl.UInt8),
                pl.col('datetime').cast(pl.Datetime),
                pl.col('datetime').dt.month().alias('month'),
                pl.col('datetime').dt.day().alias('day'),
                pl.col('datetime').dt.year().alias('year')
            ])

            self.calendar_df = pl.read_parquet(calendar_path)

            # 3. Calculate Thresholds
            max_caps = self.features_df.group_by("line_name").agg(pl.col("y").max().alias("max_y"))
            self.line_max_capacity = dict(zip(max_caps["line_name"], max_caps["max_y"]))
            self.global_average_max = max_caps["max_y"].mean() if not max_caps.is_empty() else 0

            # 4. Pre-compute latest lags per line/hour/month/day for fast lookup
            print("Building lag lookup cache...")
            self.lag_lookup = self._build_lag_lookup()
            
            elapsed = time.time() - start_time
            print(f"Feature Store initialized successfully in {elapsed:.2f}s.")
            print(f"Seasonal lookback window: {max_seasonal_lookback_years} years")

        except Exception as e:
            print(f"Error initializing FeatureStore: {e}. Make sure data files exist.")
            self.features_df = None
            self.calendar_df = None
            self.line_max_capacity = {}
            self.global_average_max = 0
            self.lag_lookup = None

    def _build_lag_lookup(self):
        """
        Build lag lookup cache with multi-year seasonal matching support.
        Returns seasonal matches grouped by (line, hour, month, day, year) for robust fallback.
        """
        if self.features_df is None:
            return {}
        
        lag_cols = ['lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']
        
        # Seasonal lookup: Keep ALL years, grouped by (line, hour, month, day, year)
        # This allows us to try multiple years in fallback logic
        seasonal = (
            self.features_df
            .group_by(['line_name', 'hour_of_day', 'month', 'day', 'year'])
            .agg([
                pl.col('datetime').max().alias('latest_dt'),
                *[pl.col(c).last().alias(c) for c in lag_cols]
            ])
            .sort(['line_name', 'hour_of_day', 'month', 'day', 'latest_dt'], descending=[False, False, False, False, True])
        )
        
        # Hour-based fallback: Most recent data for each (line, hour) regardless of date
        fallback = (
            self.features_df
            .group_by(['line_name', 'hour_of_day'])
            .agg([
                pl.col('datetime').max().alias('latest_dt'),
                *[pl.col(c).last().alias(c) for c in lag_cols]
            ])
        )
        
        return {
            'seasonal': seasonal,
            'fallback': fallback
        }

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
        Robust multi-tier lag feature retrieval with monitoring.
        
        Strategy:
        1. Try seasonal match (same month/day) for up to N previous years
        2. Fall back to hour-based match (most recent data for that hour)
        3. Last resort: zeros
        
        Returns: dict with lag features and logs which fallback level was used
        """
        fallback_lags = {
            'lag_24h': 0.0, 'lag_48h': 0.0, 'lag_168h': 0.0,
            'roll_mean_24h': 0.0, 'roll_std_24h': 0.0
        }
        if not self.lag_lookup: 
            logger.warning(f"Lag lookup not initialized. Using zeros for {line_name} hour {hour}")
            self.fallback_stats['zero_fallback'] += 1
            return fallback_lags

        target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
        target_month = target_dt.month
        target_day = target_dt.day
        target_year = target_dt.year
        lag_cols = ['lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']

        # Strategy 1: Multi-year seasonal matching (try up to max_seasonal_lookback_years)
        seasonal_matches = self.lag_lookup['seasonal'].filter(
            (pl.col("line_name") == line_name) &
            (pl.col("hour_of_day") == hour) &
            (pl.col("month") == target_month) &
            (pl.col("day") == target_day)
        ).sort('latest_dt', descending=True)  # Most recent first

        if not seasonal_matches.is_empty():
            # Try each year, starting from most recent
            for row in seasonal_matches.iter_rows(named=True):
                data_year = row.get('year')
                years_ago = target_year - data_year if data_year else None
                
                # Skip if data is too old (beyond lookback window)
                if years_ago and years_ago > self.max_seasonal_lookback_years:
                    logger.debug(f"Skipping {line_name} data from {data_year} ({years_ago} years old)")
                    continue
                
                # Extract lag values
                lag_values = {k: row[k] for k in lag_cols}
                
                # Check for None values
                if not any(v is None for v in lag_values.values()):
                    self.fallback_stats['seasonal_match'] += 1
                    logger.debug(f"✓ Seasonal match for {line_name} hour {hour}: using {data_year} data ({years_ago} years ago)")
                    return lag_values
                else:
                    logger.debug(f"Seasonal match {data_year} has None values, trying next...")

        # Strategy 2: Hour-based fallback (most recent data for this hour, any date)
        fallback_match = self.lag_lookup['fallback'].filter(
            (pl.col("line_name") == line_name) &
            (pl.col("hour_of_day") == hour)
        )

        if not fallback_match.is_empty():
            lag_values = fallback_match.select(lag_cols).row(0, named=True)
            if not any(v is None for v in lag_values.values()):
                self.fallback_stats['hour_fallback'] += 1
                fallback_date = fallback_match.select('latest_dt').row(0)[0]
                logger.info(f"⚠ Hour-based fallback for {line_name} hour {hour}: using {fallback_date}")
                return lag_values

        # Strategy 3: Zero fallback (last resort)
        self.fallback_stats['zero_fallback'] += 1
        logger.warning(f"❌ Zero fallback for {line_name} hour {hour} on {target_date_str} - no valid historical data found")
        return fallback_lags
    
    def get_fallback_stats(self) -> dict:
        """Return fallback strategy usage statistics for monitoring."""
        total = sum(self.fallback_stats.values())
        if total == 0:
            return self.fallback_stats
        
        return {
            **self.fallback_stats,
            'total_requests': total,
            'seasonal_pct': round(100 * self.fallback_stats['seasonal_match'] / total, 2),
            'hour_fallback_pct': round(100 * self.fallback_stats['hour_fallback'] / total, 2),
            'zero_fallback_pct': round(100 * self.fallback_stats['zero_fallback'] / total, 2)
        }
    
    def reset_fallback_stats(self):
        """Reset monitoring statistics."""
        self.fallback_stats = {
            'seasonal_match': 0,
            'hour_fallback': 0,
            'zero_fallback': 0
        }
    
    def get_batch_historical_lags(self, line_names: list, target_date_str: str):
        """
        Batch version of lag retrieval with multi-year seasonal matching.
        Returns pre-filtered dictionaries for both seasonal and fallback strategies.
        """
        if not self.lag_lookup:
            logger.warning("Lag lookup not initialized for batch retrieval")
            return {'seasonal': {}, 'fallback': {}}
        
        target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
        target_month = target_dt.month
        target_day = target_dt.day
        target_year = target_dt.year
        lag_cols = ['line_name', 'hour_of_day', 'year', 'latest_dt', 'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']
        
        # Get all seasonal matches (multiple years) for the target month/day
        seasonal_batch = self.lag_lookup['seasonal'].filter(
            (pl.col("line_name").is_in(line_names)) &
            (pl.col("month") == target_month) &
            (pl.col("day") == target_day)
        ).select(lag_cols).sort(['line_name', 'hour_of_day', 'latest_dt'], descending=[False, False, True])
        
        # Get hour-based fallbacks
        fallback_batch = self.lag_lookup['fallback'].filter(
            pl.col("line_name").is_in(line_names)
        ).select(['line_name', 'hour_of_day', 'latest_dt', 'lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h'])
        
        # Process seasonal matches with multi-year logic
        seasonal_dict = {}
        for row in seasonal_batch.iter_rows(named=True):
            key = (row['line_name'], row['hour_of_day'])
            
            # Skip if we already found valid data for this (line, hour)
            if key in seasonal_dict:
                continue
            
            data_year = row.get('year')
            years_ago = target_year - data_year if data_year else None
            
            # Skip if data is too old
            if years_ago and years_ago > self.max_seasonal_lookback_years:
                continue
            
            # Extract lag values (exclude metadata)
            lag_values = {k: row[k] for k in ['lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']}
            
            # Only include if no None values
            if not any(v is None for v in lag_values.values()):
                seasonal_dict[key] = lag_values
        
        # Process fallback matches
        fallback_dict = {}
        for row in fallback_batch.iter_rows(named=True):
            key = (row['line_name'], row['hour_of_day'])
            lag_values = {k: row[k] for k in ['lag_24h', 'lag_48h', 'lag_168h', 'roll_mean_24h', 'roll_std_24h']}
            if not any(v is None for v in lag_values.values()):
                fallback_dict[key] = lag_values
        
        logger.info(f"Batch lag retrieval: {len(seasonal_dict)} seasonal matches, {len(fallback_dict)} fallback matches")
        
        return {
            'seasonal': seasonal_dict,
            'fallback': fallback_dict
        }

    def get_crowd_level(self, line_name: str, prediction_value: float, *, max_capacity: float | None = None) -> str:
        max_capacity = max_capacity or self.line_max_capacity.get(line_name, self.global_average_max)
        if max_capacity is None or max_capacity == 0: return "Unknown"

        occupancy_rate = prediction_value / max_capacity
        if occupancy_rate < 0.30: return "Low"
        if occupancy_rate < 0.60: return "Medium"
        if occupancy_rate < 0.90: return "High"
        return "Very High"
