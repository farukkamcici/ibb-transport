import polars as pl
from datetime import datetime
from pathlib import Path

start_date = datetime(2022, 1, 1)
edate = datetime(2031, 12, 31)

dates = pl.date_range(start_date, edate, interval="1d", eager=True)

calendar = pl.DataFrame({"date": dates})

calendar = calendar.with_columns([
    pl.col("date").dt.weekday().alias("day_of_week"), #0=Mon
    (pl.col("date").dt.weekday() >= 5).alias("is_weekend"), #weekend -> True
    pl.col("date").dt.month().alias("month"),
    pl.col("date").dt.year().alias("year")
])

calendar = calendar.with_columns([
    pl.when(pl.col("month").is_in([12, 1, 2]))
      .then(pl.lit("Winter"))
      .when(pl.col("month").is_in([3, 4, 5]))
      .then(pl.lit("Spring"))
      .when(pl.col("month").is_in([6, 7, 8]))
      .then(pl.lit("Summer"))
      .when(pl.col("month").is_in([9, 10, 11]))
      .then(pl.lit("Fall"))
      .otherwise(pl.lit("Unknown"))
      .alias("season")
])


calendar = calendar.with_columns([
    (~pl.col("month").is_in([6,7,8])).alias("is_school_term")
])

holiday_path = Path("../../data/raw/holidays-2022-2031.csv")
holidays = pl.read_csv(holiday_path).rename({"ds": "date"}).drop("Fasting")
holidays = holidays.with_columns(pl.col("date").cast(pl.Date))

holiday_cols = [c for c in holidays.columns if c!= "date"]

holidays_long = (
    holidays.unpivot(
                  index="date",
                  on=holiday_cols,
                  variable_name="holiday_name",
                  value_name="is_holiday"
                  )
    .filter(pl.col("is_holiday") == 1)
)

calendar = calendar.with_columns(pl.col("date").cast(pl.Date))
calendar = (
    calendar.join(holidays_long, on="date", how="left")
    .select(["date", "day_of_week", "is_weekend", "month", "year", "season", "is_school_term", "is_holiday"])
)

calendar = calendar.with_columns(
    pl.col("is_holiday").fill_null(0)
)

calendar = calendar.sort("date").with_columns([
    pl.col("is_holiday").shift(1).fill_null(0).alias("holiday_win_m1"),
    pl.col("is_holiday").shift(-1).fill_null(0).alias("holiday_win_p1")
])

output_path = Path("../../data/processed/calendar_dim.parquet")
calendar.write_parquet(output_path)

print(calendar.select(["date", "is_holiday"]).head(5))
