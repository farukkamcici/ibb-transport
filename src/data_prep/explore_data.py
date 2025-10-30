import pandas as pd

# df = pd.read_parquet("../../data/processed/transport_district_hourly_clean.parquet")
df = pd.read_parquet("../../data/processed/transport_hourly.parquet")

print(df.head())
print(df.tail())

print("Null Count:\n", df.isna().sum())
print("Total row:", len(df))
print("Missing row count:", df.shape[0] - df.dropna().shape[0])

