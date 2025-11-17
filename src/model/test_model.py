'''
This script tests a single, specified model version against the unseen test set.
It provides a comprehensive report on the model's performance, including
comparisons against baselines and segment-level error analysis.

Usage:
    python src/model/test_model.py <version>

Example:
    python src/model/test_model.py v5
'''

import argparse
import json
import time
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from utils.config_loader import load_config
from utils.paths import MODEL_DIR, REPORT_DIR, SPLIT_FEATURES_DIR


# ==============================================================================
# Metric & Helper Functions (Consistent with eval_model.py)
# ==============================================================================


def mae(y_true, y_pred):
    """Calculates Mean Absolute Error."""
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true, y_pred):
    """Calculates Root Mean Squared Error."""
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

def smape(y_true, y_pred):
    """Calculates Symmetric Mean Absolute Percentage Error."""
    numerator = np.abs(y_true - y_pred)
    denominator = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    return float(np.mean(numerator / (denominator + 1e-8)))

def improvement(base, model):
    """Calculates the percentage improvement of a model over a baseline."""
    if base == 0:
        return np.nan
    return float((base - model) / base * 100)

def denormalize_predictions(train_df, test_df, y_pred_norm):
    """
    Restores per-line normalized predictions to their original, real scale.
    """
    stats = train_df.groupby("line_name")["y"].agg(["mean", "std"]).reset_index()
    merged = test_df[["line_name"]].merge(stats, on="line_name", how="left")
    merged["mean"] = merged["mean"].fillna(train_df["y"].mean())
    merged["std"] = merged["std"].fillna(train_df["y"].std())
    line_mean = merged["mean"].values
    line_std = merged["std"].values + 1e-6
    return y_pred_norm * line_std + line_mean


# ==============================================================================
# Main Test Function
# ==============================================================================


def main(version: str):
    """
    Loads a model and its configuration, runs it on the test set,
    and generates a detailed performance report.
    """
    print(f"--- Starting Test for Model Version: {version} ---")

    # --- 1. Load Configuration ---
    try:
        cfg = load_config(version)
    except FileNotFoundError:
        print(f"ERROR: Configuration file for version '{version}' not found.")
        return

    model_name = cfg["model"]["name"]
    model_filename = cfg["model"]["final_model_name"]
    model_path = MODEL_DIR / model_filename

    print(f"Loading model: {model_path}")
    if not model_path.exists():
        print(f"ERROR: Model file not found at '{model_path}'.")
        print("Please ensure the model has been trained first.")
        return

    # --- 2. Load Data ---
    print("Loading train and test datasets...")
    try:
        train_df = pd.read_parquet(SPLIT_FEATURES_DIR / "train_features.parquet")
        test_df = pd.read_parquet(SPLIT_FEATURES_DIR / "test_features.parquet")
    except FileNotFoundError as e:
        print(f"ERROR: Could not find data files at {SPLIT_FEATURES_DIR}.")
        print(f"Please run the feature pipeline first. Original error: {e}")
        return

    # --- 3. Prepare Test Data ---
    print("Preparing test data...")
    model_features = cfg["features"]["all"]
    cat_features = cfg["features"]["categorical"]

    features_to_use = [f for f in model_features if f in test_df.columns]
    X_test = test_df[features_to_use].copy()
    y_test = test_df["y"]

    # Use the same robust categorical encoding as the evaluation script
    for c in cat_features:
        if c in X_test.columns:
            all_cats = pd.concat([train_df, test_df])[c].astype("category").cat.categories
            X_test[c] = pd.Categorical(X_test[c], categories=all_cats, ordered=False)

    # --- 4. Load Model and Predict ---
    model = lgb.Booster(model_file=str(model_path))

    print("Making predictions on the test set...")
    start_time = time.time()
    y_pred = model.predict(X_test, num_iteration=model.best_iteration)
    prediction_time = time.time() - start_time

    if cfg["features"].get("needs_denormalization", False):
        print("Denormalizing predictions...")
        y_pred = denormalize_predictions(train_df, test_df, y_pred)

    # --- 5. Calculate Metrics ---
    print("Calculating performance metrics...")
    report = {
        "model_name": model_name,
        "dataset": "Unseen Test Set",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "n_samples": len(y_test),
        "prediction_time_sec": prediction_time,
        "mae": mae(y_test, y_pred),
        "rmse": rmse(y_test, y_pred),
        "smape": smape(y_test, y_pred),
    }

    # --- 6. Calculate Baselines & Segment-Level Errors ---
    baseline_mae_lag24 = mae(y_test, test_df["lag_24h"])
    report["baseline_mae_lag24"] = baseline_mae_lag24
    report["improvement_over_lag24_pct"] = improvement(baseline_mae_lag24, report["mae"])

    results_df = test_df[["hour_of_day", "line_name"]].copy()
    results_df['y_true'] = y_test
    results_df['y_pred'] = y_pred
    results_df['abs_error'] = np.abs(results_df['y_true'] - results_df['y_pred'])

    mae_by_hour = results_df.groupby('hour_of_day')['abs_error'].mean()
    report['by_hour_mae'] = {str(k): v for k, v in mae_by_hour.to_dict().items()}

    mae_by_line = results_df.groupby('line_name')['abs_error'].mean().sort_values(ascending=False)
    report['top10_worst_lines_mae'] = mae_by_line.head(10).to_dict()

    # --- 7. Display and Save Report ---
    print("\n--- Test Report ---")
    print(f"Model: {report['model_name']}")
    print(f"  MAE: {report['mae']:.2f}")
    print(f"  RMSE: {report['rmse']:.2f}")
    print(f"  SMAPE: {report['smape']:.4f}")
    print(f"  Improvement over Lag 24h: {report['improvement_over_lag24_pct']:.2f}%")
    print("-------------------")

    output_path = REPORT_DIR / f"test_report_{model_name}.json"
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4)

    print(f"\n✅ Detailed test report saved to: {output_path}")


# ==============================================================================
# Script Entrypoint
# ==============================================================================


if __name__ == "__main__":
    # --- Argument Parsing ---
    # Allows specifying the model version to test from the command line.
    parser = argparse.ArgumentParser(
        description="Test a specific, trained model version against the unseen test set.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "version",
        type=str,
        help="The model version to test (e.g., 'v1', 'v5').\n" 
             "This corresponds to the configuration file in 'src/model/config/'.",
    )
    args = parser.parse_args()

    main(args.version)
