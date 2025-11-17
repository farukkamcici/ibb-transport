import pandas as pd

features = pd.read_parquet("../../data/processed/features_pd.parquet")

features["datetime"] = pd.to_datetime(features["datetime"])

train_df = features[features["datetime"] <= "2024-04-30"]
val_df = features[(features["datetime"] > "2024-04-30") & (features["datetime"] <= "2024-06-30")]
test_df = features[features["datetime"] > "2024-06-30"]

train_df = train_df.drop(columns=["year"])
val_df = val_df.drop(columns=["year"])
test_df = test_df.drop(columns=["year"])

train_df.to_parquet("../../data/processed/split_features/train_features.parquet", index=False)
val_df.to_parquet("../../data/processed/split_features/val_features.parquet", index=False)
test_df.to_parquet("../../data/processed/split_features/test_features.parquet", index=False)
