import polars as pl

transport = pl.read_parquet("../../data/processed/lag_rolling_transport_hourly.parquet")
weather = pl.read_parquet("../../data/processed/weather_dim.parquet")
calendar = pl.read_parquet("../../data/processed/calendar_dim.parquet")

transport = transport.select([
    pl.col("datetime"),
    pl.col("line_name"),
    pl.col("passage_sum").alias("y"),
    pl.col("transition_hour").alias("hour_of_day"),
    pl.col("lag_24h"),
    pl.col("lag_48h"),
    pl.col("lag_168h"),
    pl.col("roll_mean_24h"),
    pl.col("roll_std_24h"),
])

transport = transport.with_columns(
    pl.col("datetime").dt.cast_time_unit("ns")
)


weather = weather.select([
    pl.col("datetime"),
    pl.col("temperature_2m"),
    pl.col("precipitation"),
    pl.col("wind_speed_10m"),
])

calendar = calendar.select([
    pl.col("date"),
    pl.col("day_of_week"),
    pl.col("is_weekend"),
    pl.col("month"),
    pl.col("year"),
    pl.col("season"),
    pl.col("is_school_term"),
    pl.col("is_holiday"),
    pl.col("holiday_win_m1"),
    pl.col("holiday_win_p1"),
])

features = (transport.join(weather, on="datetime", how="left")
            .with_columns(pl.col("datetime").dt.date().alias("date"))
            .join(calendar, on="date", how="left")
            )

features = features.drop("date")
bool_cols = ["is_weekend", "is_school_term", "is_holiday", "holiday_win_m1", "holiday_win_p1"]
features = features.with_columns([pl.col(c).cast(pl.Int8) for c in bool_cols])

features.write_parquet("../../data/processed/features_pl.parquet")