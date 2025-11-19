"""
Train and Evaluate Random Forest Baseline (v6 Config Compatible).

This script trains a Random Forest Regressor using the EXACT feature set
defined in the v6 configuration. It handles missing values and categorical
encoding specifically for Scikit-Learn models.

Outputs:
- models/rf_baseline.joblib
- reports/metrics_rf_baseline.json (Validation metrics)
- reports/test_report_rf_baseline.json (Test set metrics)
"""

import json
import time
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OrdinalEncoder

# --- Paths ---
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SPLIT_FEATURES_DIR = PROJECT_ROOT / "data" / "processed" / "split_features"
MODEL_DIR = PROJECT_ROOT / "src" / "models"
REPORT_DIR = PROJECT_ROOT / "reports"

# --- Configuration for RF ---
RF_PARAMS = {
    "n_estimators": 100,
    "max_depth": 16,      # Limits complexity to avoid overfitting & huge file size
    "n_jobs": -1,         # Uses all CPU cores
    "random_state": 42,
    "verbose": 1
}

# === FEATURE CONFIGURATION===
FEATURES = [
    'line_name',
    'hour_of_day',
    'lag_24h',
    'lag_48h',
    'lag_168h',
    'roll_mean_24h',
    'roll_std_24h',
    'temperature_2m',
    'precipitation',
    'wind_speed_10m',
    'day_of_week',
    'is_weekend',
    'month',
    'season',
    'is_school_term',
    'is_holiday',
    'holiday_win_m1',
    'holiday_win_p1'
]

# Categorical columns that require Ordinal Encoding
CATEGORICAL_COLS = ["line_name", "season"]

# ==============================================================================
# Helper Functions
# ==============================================================================

def mae(y_true, y_pred):
    return float(np.mean(np.abs(y_true - y_pred)))

def rmse(y_true, y_pred):
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

def smape(y_true, y_pred):
    numerator = np.abs(y_true - y_pred)
    denominator = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    return float(np.mean(numerator / (denominator + 1e-8)))

def improvement(base, model):
    if base == 0: return np.nan
    return float((base - model) / base * 100)

def preprocess_for_rf(train_df, val_df, test_df, feature_cols, cat_cols):
    """
    RF Specific Preprocessing:
    1. Selects strict feature list.
    2. Fills NaNs with -1 (Simple imputation for trees).
    3. Ordinal Encodes categorical columns (String -> Int).
    """
    print("Preprocessing data for Random Forest...")

    # 1. Subset features
    # We iterate to safely handle potential missing columns in parquet (though unlikely)
    missing_cols = [c for c in feature_cols if c not in train_df.columns]
    if missing_cols:
        raise ValueError(f"Missing columns in dataset: {missing_cols}")

    X_train = train_df[feature_cols].copy()
    y_train = train_df["y"]
    X_val = val_df[feature_cols].copy()
    y_val = val_df["y"]
    X_test = test_df[feature_cols].copy()
    y_test = test_df["y"]

    # 2. Fill NaNs (Critical for sklearn RF)
    # -1 is a safe 'unknown' signal for tree models working with positive counts/lags
    X_train = X_train.fillna(-1)
    X_val = X_val.fillna(-1)
    X_test = X_test.fillna(-1)

    # 3. Encode Categoricals
    # Concatenate to ensure the encoder sees all potential categories (seasons/lines)
    combined_cats = pd.concat([X_train[cat_cols], X_val[cat_cols], X_test[cat_cols]])

    print(f"Encoding categorical columns: {cat_cols}")
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    encoder.fit(combined_cats)

    X_train[cat_cols] = encoder.transform(X_train[cat_cols])
    X_val[cat_cols] = encoder.transform(X_val[cat_cols])
    X_test[cat_cols] = encoder.transform(X_test[cat_cols])

    return X_train, y_train, X_val, y_val, X_test, y_test, encoder

def generate_segment_analysis(df_meta, y_true, y_pred):
    """Generates by-hour and by-line MAE analysis for reporting."""
    results = df_meta[["hour_of_day", "line_name"]].copy()
    results["y_true"] = y_true.values
    results["y_pred"] = y_pred
    results["abs_error"] = np.abs(results["y_true"] - results["y_pred"])

    # By Hour
    by_hour = results.groupby("hour_of_day")["abs_error"].mean().to_dict()
    by_hour = {str(k): v for k, v in by_hour.items()} # JSON compatibility

    # By Line (Top 10 Worst)
    by_line = results.groupby("line_name")["abs_error"].mean().sort_values(ascending=False).head(10).to_dict()

    return by_hour, by_line

# ==============================================================================
# Main Execution
# ==============================================================================

def main():
    start_total = time.time()

    # 1. Load Data
    print("Loading Parquet files...")
    try:
        train_df = pd.read_parquet(SPLIT_FEATURES_DIR / "train_features.parquet")
        val_df = pd.read_parquet(SPLIT_FEATURES_DIR / "val_features.parquet")
        test_df = pd.read_parquet(SPLIT_FEATURES_DIR / "test_features.parquet")
    except FileNotFoundError as e:
        print(f"Error loading data: {e}")
        return

    # 2. Preprocess
    X_train, y_train, X_val, y_val, X_test, y_test, encoder = preprocess_for_rf(
        train_df, val_df, test_df, FEATURES, CATEGORICAL_COLS
    )

    # 3. Train Model
    print(f"Training Random Forest Baseline with params: {RF_PARAMS}...")
    rf_model = RandomForestRegressor(**RF_PARAMS)

    t0 = time.time()
    rf_model.fit(X_train, y_train)
    train_time = time.time() - t0
    print(f"Training finished in {train_time:.2f} seconds.")

    # Save Model & Encoder
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf_model, MODEL_DIR / "rf_baseline.joblib")
    joblib.dump(encoder, MODEL_DIR / "rf_encoder.joblib")

    # ==========================================================================
    # A. Validation Phase
    # ==========================================================================
    print("\n--- Running Validation Evaluation ---")
    t0 = time.time()
    y_pred_val = rf_model.predict(X_val)
    pred_time_val = time.time() - t0

    b24_val = mae(y_val, val_df["lag_24h"])
    by_hour_val, by_line_val = generate_segment_analysis(val_df, y_val, y_pred_val)

    val_metrics = {
        "model_name": "rf_baseline",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "n_samples": len(y_val),
        "prediction_time_sec": pred_time_val,
        "mae": mae(y_val, y_pred_val),
        "rmse": rmse(y_val, y_pred_val),
        "smape": smape(y_val, y_pred_val),
        "baseline_mae_lag24": b24_val,
        "improvement_over_lag24": improvement(b24_val, mae(y_val, y_pred_val)),
        "by_hour_mae": by_hour_val,
        "top10_worst_lines_mae": by_line_val
    }

    # Generate Feature Importance
    importances = pd.DataFrame({
        "feature": FEATURES,
        "importance": rf_model.feature_importances_
    }).sort_values("importance", ascending=False)

    csv_path = REPORT_DIR / "feature_importance_rf_baseline.csv"
    importances.to_csv(csv_path, index=False)
    val_metrics["feature_importance_csv"] = str(csv_path)

    with open(REPORT_DIR / "metrics_rf_baseline.json", "w") as f:
        json.dump(val_metrics, f, indent=4)
    print("✅ Validation metrics saved.")

    # ==========================================================================
    # B. Test Phase
    # ==========================================================================
    print("\n--- Running Test Set Evaluation ---")
    t0 = time.time()
    y_pred_test = rf_model.predict(X_test)
    pred_time_test = time.time() - t0

    b24_test = mae(y_test, test_df["lag_24h"])
    by_hour_test, by_line_test = generate_segment_analysis(test_df, y_test, y_pred_test)

    test_report = {
        "model_name": "rf_baseline",
        "dataset": "Unseen Test Set",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "n_samples": len(y_test),
        "prediction_time_sec": pred_time_test,
        "mae": mae(y_test, y_pred_test),
        "rmse": rmse(y_test, y_pred_test),
        "smape": smape(y_test, y_pred_test),
        "baseline_mae_lag24": b24_test,
        "improvement_over_lag24_pct": improvement(b24_test, mae(y_test, y_pred_test)),
        "by_hour_mae": by_hour_test,
        "top10_worst_lines_mae": by_line_test
    }

    with open(REPORT_DIR / "test_report_rf_baseline.json", "w") as f:
        json.dump(test_report, f, indent=4)

    print(f"✅ Test report saved.")
    print("\n--- RF Results Summary ---")
    print(f"Valid MAE: {val_metrics['mae']:.2f}")
    print(f"Test MAE:  {test_report['mae']:.2f}")
    print(f"Total Time: {(time.time() - start_total):.2f} sec")

if __name__ == "__main__":
    main()