# ---MODEL TRAINING V1---
from pathlib import Path
import json
import pandas as pd
import numpy as np
import lightgbm as lgb
from lightgbm import early_stopping
import matplotlib.pyplot as plt

# === Paths ===
DATA_DIR = Path("../../data/processed/split_features")
MODEL_DIR = Path("../../models")
REPORT_DIR = Path("../../reports/logs")
FIG_DIR = Path("../../reports/figs")

CAT_COLS = ["line_name", "season"]

# === Outlier filter (line-based) ===
def cap_outliers(df, col="y", z_thresh=3):
    df[col] = df[col].astype(float)
    def _cap(x):
        mean, std = x.mean(), x.std() + 1e-6
        z = np.abs((x - mean) / std)
        capped = mean + np.sign(x - mean) * z_thresh * std
        return np.where(z > z_thresh, capped, x)
    df[col] = df.groupby("line_name")[col].transform(_cap)
    return df

# === Line-based normalization ===
def normalize_by_line(df):
    """Her line_name kendi ortalama-std’sine göre normalize edilir."""
    df["y_norm"] = df.groupby("line_name")["y"].transform(
        lambda x: (x - x.mean()) / (x.std() + 1e-6)
    )
    return df

# === Load data ===
def load_data():
    train_df = pd.read_parquet(DATA_DIR / "train_features.parquet")
    val_df = pd.read_parquet(DATA_DIR / "val_features.parquet")
    print(f"Train shape: {train_df.shape}, Val shape: {val_df.shape}")
    return train_df, val_df

# === Prepare data ===
def prepare_data(train_df, val_df):
    # 1. Aykırı değerleri kırp
    train_df = cap_outliers(train_df, "y")
    val_df = cap_outliers(val_df, "y")

    # 2. Normalize et
    train_df = normalize_by_line(train_df)
    val_df = normalize_by_line(val_df)

    target_col = "y_norm"

    X_train = train_df.drop(columns=["y", "y_norm"])
    y_train = train_df[target_col]
    X_val = val_df.drop(columns=["y", "y_norm"])
    y_val = val_df[target_col]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
        if c in X_val.columns:
            X_val[c] = X_val[c].astype("category")

    train_set = lgb.Dataset(
        X_train,
        label=y_train,
        feature_name=list(X_train.columns),
        categorical_feature=CAT_COLS,
        free_raw_data=False
    )

    val_set = lgb.Dataset(
        X_val,
        label=y_val,
        feature_name=list(X_val.columns),
        categorical_feature=CAT_COLS,
        free_raw_data=False,
        reference=train_set
    )

    return X_train, y_train, X_val, y_val, train_set, val_set

# === Model parameters (same as old V1) ===
def get_params():
    params = {
        "objective": "regression",
        "metric": ["l1", "l2"],  # MAE and MSE
        "boosting_type": "gbdt",
        "learning_rate": 0.05,
        "num_leaves": 64,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.8,
        "bagging_freq": 1,
        "min_data_in_leaf": 50,
        "verbose": -1,
        "seed": 42,
        "num_threads": 8,
    }
    return params

# === Train model ===
def train_model(train_set, val_set, params):
    model = lgb.train(
        params,
        train_set,
        num_boost_round=2000,
        valid_sets=[train_set, val_set],
        valid_names=["train", "valid"],
        callbacks=[early_stopping(stopping_rounds=100)]
    )
    return model

# === Compute metrics ===
def compute_metrics(model, X_val, y_val):
    y_pred = model.predict(X_val, num_iteration=model.best_iteration)
    mae = np.mean(np.abs(y_val - y_pred))
    rmse = np.sqrt(np.mean((y_val - y_pred) ** 2))
    smape = np.mean(2 * np.abs(y_val - y_pred) / (np.abs(y_val) + np.abs(y_pred) + 1e-8))
    return {"mae": float(mae), "rmse": float(rmse), "smape": float(smape)}

# === Save outputs ===
def save_outputs(model, metrics, X_train):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODEL_DIR / "lgbm_transport_v1_norm.txt"
    model.save_model(str(model_path), num_iteration=model.best_iteration)

    metrics_out = {
        **metrics,
        "best_iteration": int(model.best_iteration),
        "num_features": model.num_feature()
    }
    (REPORT_DIR / "lgbm_metrics_v1_norm.json").write_text(json.dumps(metrics_out, indent=2))

    # Feature importance
    imp_df = pd.DataFrame({
        "feature": X_train.columns,
        "importance": model.feature_importance(importance_type="gain")
    }).sort_values("importance", ascending=False)
    imp_df.to_csv(REPORT_DIR / "feature_importance_v1_norm.csv", index=False)

    # Plot
    plt.figure(figsize=(8, 10))
    lgb.plot_importance(model, max_num_features=20, importance_type="gain")
    plt.title("Feature Importance (Gain) — V1 (Normalized)")
    plt.tight_layout()
    plt.savefig(FIG_DIR / "feature_importance_v1_norm.png")
    plt.close()

# === Main ===
def main():
    train_df, val_df = load_data()
    X_train, y_train, X_val, y_val, train_set, val_set = prepare_data(train_df, val_df)
    params = get_params()
    model = train_model(train_set, val_set, params)
    metrics = compute_metrics(model, X_val, y_val)
    save_outputs(model, metrics, X_train)
    print("\nTraining finished (V1 normalized).")
    print("Best iteration:", model.best_iteration)
    print("Metrics:", json.dumps(metrics, indent=2))

if __name__ == "__main__":
    main()



#---MODEL TRAINING V2---#-------------------------------------
# from pathlib import Path
# import json
# import pandas as pd
# import numpy as np
# import lightgbm as lgb
# from lightgbm import early_stopping
# import matplotlib.pyplot as plt
#
# DATA_DIR = Path("../../data/processed/split_features")
# MODEL_DIR = Path("../../models")
# REPORT_DIR = Path("../../reports/logs")
# FIG_DIR = Path("../../reports/figs")
#
# CAT_COLS = ["line_name", "season"]
#
# # Outlier filter line-based
# def cap_outliers(df, col="y", z_thresh=3):
#     df[col] = df[col].astype(float)
#     # Her line_name için ayrı ortalama ve std kullan
#     def _cap(x):
#         mean, std = x.mean(), x.std() + 1e-6
#         z = np.abs((x - mean) / std)
#         capped = mean + np.sign(x - mean) * z_thresh * std
#         return np.where(z > z_thresh, capped, x)
#     df[col] = df.groupby("line_name")[col].transform(_cap)
#     return df
#
# # Line-based normalization
# def normalize_by_line(df):
#     """Her line_name kendi ortalama-std’sine göre normalize edilir."""
#     df["y_norm"] = df.groupby("line_name")["y"].transform(
#         lambda x: (x - x.mean()) / (x.std() + 1e-6)
#     )
#     return df
#
# def load_data():
#     train_df = pd.read_parquet(DATA_DIR / "train_features.parquet")
#     val_df = pd.read_parquet(DATA_DIR / "val_features.parquet")
#
#     print(f"Train shape: {train_df.shape}, Val shape: {val_df.shape}")
#
#     return train_df, val_df
#
# def prepare_data(train_df, val_df):
#     train_df = cap_outliers(train_df, "y")
#     val_df = cap_outliers(val_df, "y")
#     train_df = normalize_by_line(train_df)
#     val_df = normalize_by_line(val_df)
#
#     target_col = "y_norm"
#
#     X_train = train_df.drop(columns=["y", "y_norm"])
#     y_train = train_df[target_col]
#     X_val = val_df.drop(columns=["y", "y_norm"])
#     y_val = val_df[target_col]
#
#     for c in CAT_COLS:
#         if c in X_train.columns:
#             X_train[c] = X_train[c].astype("category")
#         if c in X_val.columns:
#             X_val[c] = X_val[c].astype("category")
#
#     train_set = lgb.Dataset(
#         X_train,
#         label = y_train,
#         feature_name = list(X_train.columns),
#         categorical_feature = CAT_COLS,
#         free_raw_data=False
#     )
#
#     val_set = lgb.Dataset(
#         X_val,
#         label = y_val,
#         feature_name = list(X_val.columns),
#         categorical_feature = CAT_COLS,
#         free_raw_data=False,
#         reference = train_set
#     )
#
#     return X_train, y_train, X_val, y_val, train_set, val_set
#
# def get_params():
#     params = {
#         "objective": "regression",
#         "metric": ["l1", "l2"], # MAE and MSE
#         "boosting_type": "gbdt",
#         "learning_rate": 0.03,
#         "num_leaves": 96,
#         "feature_fraction": 0.8,
#         "bagging_fraction": 0.8,
#         "bagging_freq": 1,
#         "lambda_l1": 0.1,
#         "lambda_l2": 1.0,
#         "min_gain_to_split": 0.01,
#         "path_smooth": 0.1,
#         "cat_l2": 10.0,
#         "cat_smooth": 20.0,
#         "min_data_in_leaf": 100,
#         "seed": 42,
#         "deterministic": True,
#         "verbose": -1,
#         "num_threads": 8,
#     }
#
#     return params
#
# def train_model(train_set, val_set, params):
#     model = lgb.train(
#         params,
#         train_set,
#         num_boost_round=4000,
#         valid_sets=[train_set, val_set],
#         valid_names=["train", "valid"],
#         callbacks = [early_stopping(stopping_rounds=100, verbose=True)]
#     )
#
#     return model
#
# def compute_metrics(model, X_val, y_val):
#     y_pred = model.predict(X_val, num_iteration=model.best_iteration)
#
#     mae = np.mean(np.abs(y_val - y_pred))
#     rmse = np.sqrt(np.mean((y_val - y_pred)**2))
#     smape = np.mean(2 * np.abs(y_val - y_pred) / (np.abs(y_val) + np.abs(y_pred) + 1e-8))
#
#     return {"mae": float(mae), "rmse": float(rmse), "smape": float(smape)}
#
#
# def save_outputs(model, metrics, X_train):
#     MODEL_DIR.mkdir(parents=True, exist_ok=True)
#     REPORT_DIR.mkdir(parents=True, exist_ok=True)
#     FIG_DIR.mkdir(parents=True, exist_ok=True)
#
#     model_path = MODEL_DIR / "lgbm_transport_v2.txt"
#     model.save_model(str(model_path), num_iteration=model.best_iteration)
#
#     metrics_out = {
#         **metrics,
#         "best_iteration": int(model.best_iteration),
#         "num_features": model.num_feature()
#     }
#     (REPORT_DIR / "lgbm_metrics_v2.json").write_text(json.dumps(metrics_out, indent=2))
#
#     # Feature importance
#     imp_df = pd.DataFrame({
#         "feature": X_train.columns,
#         "importance": model.feature_importance(importance_type="gain")
#     }).sort_values("importance", ascending=False)
#     imp_df.to_csv(REPORT_DIR / "feature_importance_v2.csv", index=False)
#
#     # Plot
#     plt.figure(figsize=(8, 10))
#     lgb.plot_importance(model, max_num_features=20, importance_type="gain")
#     plt.title("Feature Importance (Gain)")
#     plt.tight_layout()
#     plt.savefig(FIG_DIR / "feature_importance_v2.png")
#     plt.close()
#
#
# def main():
#     train_df, val_df = load_data()
#     X_train, y_train, X_val, y_val, train_set, val_set = prepare_data(train_df, val_df)
#     params = get_params()
#     model = train_model(train_set, val_set, params)
#     metrics = compute_metrics(model, X_val, y_val)
#     save_outputs(model, metrics, X_train)
#
#     print("\nTraining finished (v2).")
#     print("Best iteration:", model.best_iteration)
#     print("Metrics:", json.dumps(metrics, indent=2))
#
# if __name__ == "__main__":
#     main()
#
#
