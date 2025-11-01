import polars as pl

lags = [1,2,3,12,24,48,168]
windows = [3,6,12,24]
warmup = max(max(lags), max(windows))

df = pl.read_parquet("../../data/processed/transport_hourly.parquet")

# transition_date string ya da date olabilir, datetime'a çevir
df = df.with_columns([
    (pl.col("transition_date").cast(pl.Utf8).str.strptime(pl.Date, "%Y-%m-%d")
       .cast(pl.Datetime("ns"))
       + pl.duration(hours=pl.col("transition_hour")))
      .alias("datetime")
])

df = df.sort(["line_name", "datetime"])

# Lag features
for l in lags:
    df = df.with_columns([
        pl.col("passage_sum").shift(l).over("line_name").alias(f"lag_{l}h")
    ])

# Rolling features
for r in windows:
    df = df.with_columns([
        pl.col("passage_sum").rolling_mean(window_size=r).over("line_name").alias(f"roll_mean_{r}h"),
        pl.col("passage_sum").rolling_std(window_size=r).over("line_name").alias(f"roll_std_{r}h")
    ])

df = df.with_columns(
    pl.cum_count("line_name").over("line_name").alias("row_in_line")
)

# her hat için ilk 168 satırı at
df_train = df.filter(pl.col("row_in_line") >= warmup).drop("row_in_line")


df_train.write_parquet("../../data/processed/lag_rolling_transport_hourly.parquet")
