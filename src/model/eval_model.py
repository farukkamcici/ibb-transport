# evaluate_model_v2.py
# Tam kapsamlı model değerlendirmesi (v1_norm vs v2 + baseline + SHAP)

from pathlib import Path
import json
import numpy as np
import pandas as pd
import lightgbm as lgb
import matplotlib.pyplot as plt
import shap
import time

# === Paths ===
DATA_DIR = Path("../../data/processed/split_features")
MODEL_DIR = Path("../../models")
REPORT_DIR = Path("../../reports/logs")
FIG_DIR = Path("../../reports/figs")

# V1 artık normalize edilmiş haliyle (v1_norm)
MODEL_V1 = MODEL_DIR / "lgbm_transport_v1.txt"
MODEL_V2 = MODEL_DIR / "lgbm_transport_v2.txt"
IMP_V1 = REPORT_DIR / "feature_importance_v1.csv"
IMP_V2 = REPORT_DIR / "feature_importance_v2.csv"

for p in [REPORT_DIR, FIG_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# === Metric functions ===
def mae(y_true, y_pred):
    return np.mean(np.abs(y_true - y_pred))

def rmse(y_true, y_pred):
    return np.sqrt(np.mean((y_true - y_pred) ** 2))

def smape(y_true, y_pred):
    return np.mean(2 * np.abs(y_true - y_pred) / (np.abs(y_true) + np.abs(y_pred) + 1e-8))

def improvement(baseline, model):
    return (baseline - model) / baseline * 100 if baseline != 0 else np.nan

# === Load data ===
val_df = pd.read_parquet(DATA_DIR / "val_features.parquet")
train_df = pd.read_parquet(DATA_DIR / "train_features.parquet")
print(f"Validation rows: {len(val_df):,}")

# === Load models ===
model_v1 = lgb.Booster(model_file=str(MODEL_V1))
model_v2 = lgb.Booster(model_file=str(MODEL_V2))

# === Prepare validation data ===
X_val = val_df.drop(columns=["y"])
y_val = val_df["y"]
for c in ["line_name", "season"]:
    if c in X_val.columns:
        X_val[c] = X_val[c].astype("category")

# === Predict (V1 & V2 normalized outputs) ===
start = time.time()
y_pred_v1_norm = model_v1.predict(X_val, num_iteration=model_v1.best_iteration)
y_pred_v2_norm = model_v2.predict(X_val, num_iteration=model_v2.best_iteration)
pred_time = time.time() - start

# === Denormalize predictions ===
def denormalize(train_df, val_df, y_pred_norm):
    """Normalize edilmiş tahminleri, train set istatistiklerine göre gerçek yolcu sayısına çevirir."""
    stats = train_df.groupby("line_name")["y"].agg(["mean", "std"]).reset_index()
    merged = val_df[["line_name"]].merge(stats, on="line_name", how="left")
    return y_pred_norm * merged["std"].values + merged["mean"].values

y_pred_v1_real = denormalize(train_df, val_df, y_pred_v1_norm)
y_pred_v2_real = denormalize(train_df, val_df, y_pred_v2_norm)

# === BASELINES ===
baseline_24 = val_df["lag_24h"]
baseline_168 = val_df["lag_168h"]

ref = train_df.groupby(["line_name", "hour_of_day"])["y"].mean().reset_index()
ref = ref.rename(columns={"y": "mean_y_line_hour"})
val_df = val_df.merge(ref, on=["line_name", "hour_of_day"], how="left")
baseline_linehour = val_df["mean_y_line_hour"]

# === Compute metrics (real scale only) ===
results = {
    "v1_real": {
        "mae": mae(y_val, y_pred_v1_real),
        "rmse": rmse(y_val, y_pred_v1_real),
        "smape": smape(y_val, y_pred_v1_real),
    },
    "v2_real": {
        "mae": mae(y_val, y_pred_v2_real),
        "rmse": rmse(y_val, y_pred_v2_real),
        "smape": smape(y_val, y_pred_v2_real),
    },
    "baseline_lag24": {
        "mae": mae(y_val, baseline_24),
        "rmse": rmse(y_val, baseline_24),
    },
    "baseline_lag168": {
        "mae": mae(y_val, baseline_168),
        "rmse": rmse(y_val, baseline_168),
    },
    "baseline_linehour": {
        "mae": mae(y_val, baseline_linehour),
        "rmse": rmse(y_val, baseline_linehour),
    },
}

# === Improvement ratios ===
results["improvement_over_lag24_v1"] = improvement(results["baseline_lag24"]["mae"], results["v1_real"]["mae"])
results["improvement_over_lag24_v2"] = improvement(results["baseline_lag24"]["mae"], results["v2_real"]["mae"])
results["improvement_over_linehour_v1"] = improvement(results["baseline_linehour"]["mae"], results["v1_real"]["mae"])
results["improvement_over_linehour_v2"] = improvement(results["baseline_linehour"]["mae"], results["v2_real"]["mae"])

# === Segment-based evaluation ===
def segment_eval(df, y_true, y_pred, col, values):
    segs = {}
    for v in values:
        mask = df[col] == v
        segs[str(v)] = float(mae(y_true[mask], y_pred[mask]))
    return segs

results["by_hour_v2"] = segment_eval(val_df, y_val, y_pred_v2_real, "hour_of_day", sorted(val_df["hour_of_day"].unique()))
results["by_line_top10_v2"] = (
    val_df.assign(err=np.abs(y_val - y_pred_v2_real))
    .groupby("line_name")["err"]
    .mean()
    .sort_values(ascending=False)
    .head(10)
    .to_dict()
)

# === Feature importance comparison ===
imp_v1 = pd.read_csv(IMP_V1)
imp_v2 = pd.read_csv(IMP_V2)
merged_imp = imp_v1.merge(imp_v2, on="feature", suffixes=("_v1", "_v2"))
merged_imp["change_ratio"] = merged_imp["importance_v2"] / (merged_imp["importance_v1"] + 1e-6)
merged_imp = merged_imp.sort_values("change_ratio", ascending=False)
merged_imp.to_csv(REPORT_DIR / "feature_importance_change_v1_v2.csv", index=False)

# === SHAP analysis (V2) ===
explainer = shap.TreeExplainer(model_v2)
sample_X = X_val.sample(5000, random_state=42)
shap_values = explainer.shap_values(sample_X)
plt.figure()
shap.summary_plot(shap_values, sample_X, max_display=20, show=False)
plt.tight_layout()
plt.savefig(FIG_DIR / "shap_summary_v2.png")
plt.close()

# === JSON save helpers ===
def convert_numpy(o):
    if isinstance(o, np.integer):
        return int(o)
    elif isinstance(o, np.floating):
        return float(o)
    elif isinstance(o, np.ndarray):
        return o.tolist()
    else:
        return str(o)

def sanitize_keys(d):
    if isinstance(d, dict):
        return {str(k): sanitize_keys(v) for k, v in d.items()}
    elif isinstance(d, list):
        return [sanitize_keys(v) for v in d]
    else:
        return d

results_clean = sanitize_keys(results)
(REPORT_DIR / "evaluation_v1v2.json").write_text(
    json.dumps(results_clean, indent=2, default=convert_numpy)
)

# === Print summary ===
print("\n=== MODEL EVALUATION SUMMARY ===")
print(f"Prediction time: {pred_time:.1f}s for {len(X_val):,} samples\n")

print(f"[V1 normalized]  MAE(real): {results['v1_real']['mae']:.2f}, RMSE(real): {results['v1_real']['rmse']:.2f}")
print(f"[V2 tuned]       MAE(real): {results['v2_real']['mae']:.2f}, RMSE(real): {results['v2_real']['rmse']:.2f}")
print(f"\nBaseline lag24 MAE: {results['baseline_lag24']['mae']:.2f}")
print(f"Improvement (V1 vs lag24): {results['improvement_over_lag24_v1']:.1f}%")
print(f"Improvement (V2 vs lag24): {results['improvement_over_lag24_v2']:.1f}%")
print(f"Improvement (V1 vs line+hour): {results['improvement_over_linehour_v1']:.1f}%")
print(f"Improvement (V2 vs line+hour): {results['improvement_over_linehour_v2']:.1f}%")

print("\nTop-10 worst lines (V2, mean abs error):")
for k, v in results["by_line_top10_v2"].items():
    print(f"  {k:<10} {v:.2f}")

print("\nSaved reports →", REPORT_DIR)
print("Saved SHAP plot →", FIG_DIR / "shap_summary_v2.png")
