import pandas as pd

df = pd.read_parquet("../../data/processed/transport_district_hourly.parquet")

df = df.dropna(subset=["town"])
df.to_parquet("../../data/processed/transport_district_hourly_clean.parquet")