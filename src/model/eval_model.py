"""
Unified Model Evaluation Script

This script provides a robust way to evaluate all trained LightGBM models
(ending in .txt) found in the /models directory.

Key Behaviors:
- Dynamic Configuration: For each model file (e.g., 'lgbm_transport_v1.txt'),
  it parses the version ('v1') and loads the corresponding configuration from
  /src/model/config/. This ensures that all evaluation parameters (features,
  categorical features, normalization needs) perfectly match the training environment.

- Idempotent Artifact Generation: For each model, it checks if evaluation
  artifacts (metrics JSON, feature importance plots, SHAP plots) already exist.
  It only generates the artifacts that are missing, making it efficient to re-run.

- Handles Multiple Model Types: It correctly evaluates models trained on both
  real-scale targets and normalized targets by checking the `needs_denormalization`
  flag in the model's specific configuration.

- Global Comparison: After processing all models, it generates a single,
  updated comparison report ('evaluation_summary_all.json' and .csv) for
  easy cross-model performance analysis.
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import yaml

from utils.config_loader import load_config
from utils.paths import (
    FIG_DIR,
    MODEL_DIR,
    REPORT_DIR,
    SPLIT_FEATURES_DIR,
    ensure_dirs,
)


# ==============================================================================
# Metric & Baseline Helper Functions
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
    # Add a small epsilon to prevent division by zero
    return float(np.mean(numerator / (denominator + 1e-8)))


def improvement(base, model):
    """Calculates the percentage improvement of a model over a baseline."""
    if base == 0:
        return np.nan
    return float((base - model) / base * 100)


def denormalize_predictions(train_df, val_df, y_pred_norm):
    """
    Restores per-line normalized predictions to their original, real scale.
    This is required for models trained on a normalized target variable.
    """
    stats = train_df.groupby("line_name")["y"].agg(["mean", "std"]).reset_index()
    merged = val_df[["line_name"]].merge(stats, on="line_name", how="left")

    # Fill with global stats for any new lines in validation not seen in train
    merged["mean"] = merged["mean"].fillna(train_df["y"].mean())
    merged["std"] = merged["std"].fillna(train_df["y"].std())

    line_mean = merged["mean"].values
    line_std = merged["std"].values + 1e-6  # Epsilon for stability

    return y_pred_norm * line_std + line_mean


def compute_baselines(train_df, val_df):
    """
    Computes simple but important baselines to compare model performance against.
    - lag_24h: Predicts the value from the previous day.
    - lag_168h: Predicts the value from the previous week.
    - line_hour_mean: Predicts the historical average for that specific line and hour.
    """
    # Simple lag baselines
    baseline_24 = val_df["lag_24h"]
    baseline_168 = val_df["lag_168h"]

    # Historical mean baseline
    line_hour_mean_map = (
        train_df.groupby(["line_name", "hour_of_day"])["y"]
        .mean()
        .rename("mean_y_line_hour")
    )
    baseline_linehour = val_df.merge(
        line_hour_mean_map, on=["line_name", "hour_of_day"], how="left"
    )["mean_y_line_hour"]

    return baseline_24, baseline_168, baseline_linehour


# ==============================================================================
# Data Loading
# ==============================================================================


def load_datasets():
    """Loads the pre-split training and validation feature sets."""
    print("Loading train and validation datasets...")
    try:
        train_df = pd.read_parquet(SPLIT_FEATURES_DIR / "train_features.parquet")
        val_df = pd.read_parquet(SPLIT_FEATURES_DIR / "val_features.parquet")
        print(f"Validation rows: {len(val_df):,}")
        return train_df, val_df
    except FileNotFoundError as e:
        print(f"ERROR: Could not find data files at {SPLIT_FEATURES_DIR}.")
        print(f"Please run the feature pipeline first. Original error: {e}")
        return None, None


# ==============================================================================
# Artifact Generation (Plots)
# ==============================================================================


def generate_feature_importance(model, model_name, X_val):
    """Generates and saves a feature importance plot and CSV."""
    print(f"  -> Generating feature importance for {model_name}...")
    csv_path = REPORT_DIR / f"feature_importance_{model_name}.csv"
    fig_path = FIG_DIR / f"feature_importance_{model_name}.png"

    importance = model.feature_importance(importance_type="gain")
    imp_df = pd.DataFrame(
        {"feature": X_val.columns, "importance": importance}
    ).sort_values("importance", ascending=False)
    imp_df.to_csv(csv_path, index=False)

    plt.figure(figsize=(10, 12))
    lgb.plot_importance(model, max_num_features=25, importance_type="gain", figsize=(10, 12))
    plt.title(f"Feature Importance (Gain) — {model_name}", fontsize=16)
    plt.tight_layout()
    plt.savefig(fig_path)
    plt.close()

    return csv_path, fig_path


def generate_shap(model, model_name, X_val):
    """Generates and saves a SHAP summary plot."""
    print(f"  -> Generating SHAP summary plot for {model_name}...")
    shap_path = FIG_DIR / f"shap_summary_{model_name}.png"

    # SHAP can be slow, so we use a sample of the data
    sample_size = min(5000, len(X_val))
    sample_X = X_val.sample(sample_size, random_state=42)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(sample_X)

    plt.figure()
    shap.summary_plot(shap_values, sample_X, max_display=25, show=False)
    plt.tight_layout()
    plt.savefig(shap_path)
    plt.close()

    return shap_path


# ==============================================================================
# Core Evaluation Logic
# ==============================================================================


def evaluate_model(model_name, model, train_df, val_df, cfg):
    """
    Performs a full evaluation for a given model and its configuration.

    This includes:
    - Preparing data using the correct features and categorical encodings.
    - Handling denormalization for older models.
    - Calculating primary metrics (MAE, RMSE, SMAPE).
    - Calculating baseline metrics and improvement scores.
    - Generating and saving all artifacts (plots, logs).
    """
    print(f"  -> Evaluating metrics for {model_name}...")
    # --- 1. Prepare Data ---
    # Use the feature list from the model's config to ensure consistency.
    model_features = cfg["features"]["all"]
    cat_features = cfg["features"]["categorical"]

    # Ensure we only use features available in the validation data.
    features_to_use = [f for f in model_features if f in val_df.columns]
    X_val = val_df[features_to_use].copy()
    y_val = val_df["y"]

    # **Critical Step for Categorical Features**
    # To prevent encoding mismatches, we create the category mapping from the
    # combined train and validation data, mimicking the training script.
    combined_df = pd.concat([train_df, val_df], ignore_index=True)
    for c in cat_features:
        if c in X_val.columns:
            all_cats = combined_df[c].astype("category").cat.categories
            X_val[c] = pd.Categorical(X_val[c], categories=all_cats, ordered=False)

    # --- 2. Predict ---
    start_time = time.time()
    y_pred = model.predict(X_val, num_iteration=model.best_iteration)
    prediction_time = time.time() - start_time

    # **Critical Step for Normalized Models**
    # If the model was trained on a normalized target, convert predictions back.
    if cfg["features"].get("needs_denormalization", False):
        print(f"  -> Denormalizing predictions for {model_name}...")
        y_pred = denormalize_predictions(train_df, val_df, y_pred)

    # --- 3. Calculate Metrics ---
    metrics = {
        "model_name": model_name,
        "timestamp": datetime.now().isoformat(),
        "n_samples": int(len(X_val)),
        "best_iteration": int(model.best_iteration),
        "num_features": int(model.num_feature()),
        "prediction_time_sec": prediction_time,
        "mae": mae(y_val, y_pred),
        "rmse": rmse(y_val, y_pred),
        "smape": smape(y_val, y_pred),
    }

    # --- 4. Calculate Segment-Level Metrics ---
    # Create a temporary dataframe with predictions to facilitate grouped analysis
    results_df = val_df[['hour_of_day', 'line_name']].copy()
    results_df['y_true'] = y_val
    results_df['y_pred'] = y_pred
    results_df['abs_error'] = np.abs(results_df['y_true'] - results_df['y_pred'])

    # MAE by hour
    mae_by_hour = results_df.groupby('hour_of_day')['abs_error'].mean()
    metrics['by_hour_mae'] = {str(k): v for k, v in mae_by_hour.to_dict().items()}

    # Top 10 worst lines by MAE
    mae_by_line = results_df.groupby('line_name')['abs_error'].mean().sort_values(ascending=False)
    metrics['top10_worst_lines_mae'] = mae_by_line.head(10).to_dict()

    # --- 5. Calculate Baselines & Improvement ---
    b24, b168, blinehour = compute_baselines(train_df, val_df)
    base_mae_lag24 = mae(y_val, b24)
    base_mae_linehour = mae(y_val, blinehour)

    metrics["baseline_mae_lag24"] = base_mae_lag24
    metrics["baseline_mae_lag168"] = mae(y_val, b168)
    metrics["baseline_mae_linehour"] = base_mae_linehour
    metrics["improvement_over_lag24"] = improvement(base_mae_lag24, metrics["mae"])
    metrics["improvement_over_linehour"] = improvement(base_mae_linehour, metrics["mae"])

    # --- 5. Generate and Save Artifacts ---
    fi_csv, fi_plot = generate_feature_importance(model, model_name, X_val)
    shap_plot = generate_shap(model, model_name, X_val)

    metrics["feature_importance_csv"] = str(fi_csv)
    metrics["feature_importance_plot"] = str(fi_plot)
    metrics["shap_plot"] = str(shap_plot)

    # Save the detailed metrics for this model
    metrics_json_path = REPORT_DIR / f"metrics_{model_name}.json"
    metrics_csv_path = REPORT_DIR / f"metrics_{model_name}.csv"
    metrics_json_path.write_text(json.dumps(metrics, indent=2))
    pd.DataFrame([metrics]).to_csv(metrics_csv_path, index=False)

    print(f"✅ Metrics and artifacts created for {model_name}")
    return metrics


# ==============================================================================
# Main Orchestration
# ==============================================================================


def main():
    """
    Main function to orchestrate the model evaluation pipeline.
    """
    ensure_dirs()
    train_df, val_df = load_datasets()
    if train_df is None:
        return

    # Discover all model files in the models directory
    model_files = sorted(MODEL_DIR.glob("*.txt"))
    if not model_files:
        print("No model files found in /models. Nothing to evaluate.")
        return

    all_metrics = []
    for model_file in model_files:
        print(f"\n=== Processing Model: {model_file.name} ===")
        model_name = model_file.stem
        metrics_json_path = REPORT_DIR / f"metrics_{model_name}.json"

        # --- Dynamic Configuration Loading ---
        # This is the key to robust evaluation.
        match = re.search(r"(v\d+)", model_name)
        if not match:
            print(f"SKIPPING: Could not parse version from '{model_name}'.")
            continue
        version = match.group(1)

        try:
            cfg = load_config(version)
        except FileNotFoundError:
            print(f"SKIPPING: Config file for version '{version}' not found.")
            continue

        # If metrics already exist, we don't re-evaluate, saving time.
        # To force re-evaluation, delete the corresponding metrics JSON file.
        if metrics_json_path.exists():
            print(f"  -> Metrics file found. Loading existing metrics for {model_name}.")
            with open(metrics_json_path, "r") as f:
                m = json.load(f)
            all_metrics.append(m)
        else:
            # If no metrics exist, run the full evaluation.
            model = lgb.Booster(model_file=str(model_file))
            m = evaluate_model(model_name, model, train_df, val_df, cfg)
            all_metrics.append(m)

    # After processing all models, write a global comparison report
    if all_metrics:
        summary_df = pd.DataFrame(all_metrics)
        summary_csv_path = REPORT_DIR / "evaluation_summary_all.csv"
        summary_json_path = REPORT_DIR / "evaluation_summary_all.json"
        summary_df.to_csv(summary_csv_path, index=False)
        summary_json_path.write_text(
            json.dumps(all_metrics, indent=2, default=str)
        )
        print(f"\n📊 Global comparison report updated -> {summary_csv_path}")

    print("\n✅ Evaluation pipeline finished successfully.")


if __name__ == "__main__":
    main()