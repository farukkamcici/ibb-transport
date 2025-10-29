import pandas as pd

df = pd.read_parquet("../../data/processed/transport_hourly.parquet")
# print(df.head())
# print(df.tail())
# print(df.info())
#
#
# df.groupby("line_name")["passage_sum"].mean().sort_values(ascending=False).head(10)
# print(df)

print(df["transition_date"].nunique()
)
