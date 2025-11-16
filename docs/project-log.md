
# Project Logbook

_Last updated: 2025-11-13_

## Log Schema
- **Timestamp:** Commit date and hour (local timezone) recorded from repository history.
- **Commit:** Hash and message identifying the change captured in the log.
- **Summary:** One-line status of the project immediately after the commit.
- **Details:** Key updates introduced in the commit with brief explanations.
- **Notes:** Additional context or decisions relevant to the logged work.

## Entry · 2025-11-13 20:43 (+03)

### Commit
- **Hash:** `fbfaacc`
- **Message:** `add new model (v4) evaluation results and test model`

### Summary
- Added a new model (v4) and its evaluation results. Also added a script to test the models.

### Details
- Added a new model configuration `v4.yaml` for the LightGBM model.
- Trained the v4 model and generated evaluation results, including metrics and feature importance.
- Added `src/model/test_model.py` to load a trained model and make predictions on a sample of data.
- Updated the evaluation script to include the v4 model in the comparison reports.

### Notes
- The new v4 model uses a different set of hyperparameters, which are defined in `src/model/config/v4.yaml`.
- The `test_model.py` script can be used to quickly test any of the trained models.

## Entry · 2025-11-10 21:23 (+03)

### Commit
- **Hash:** `2e57a76`
- **Message:** `enhance eval script with unified model processing, and update dependencies`

### Summary
- Refactored the modeling pipeline to be configuration-driven, integrated MLflow for experiment tracking, and unified the evaluation script to process all available models automatically.

### Details
- Restructured `src/model/train_model.py` to load all parameters from YAML files (`v1.yaml`, `v2.yaml`, etc.), making experiments more repeatable and easier to define.
- Integrated `mlflow` into the training script to log parameters, metrics (MAE, MSE), and the trained model artifact for each run, establishing a formal experiment tracking system.
- Heavily refactored `src/model/eval_model.py` to automatically discover all model files (`.txt`) in the `/models` directory instead of hardcoding paths for v1 and v2.
- The evaluation script now generates a single, unified comparison report (`evaluation_summary_all.csv` and `.json`) for all discovered models.
- Added on-demand artifact generation to the evaluation script, which now creates feature importance and SHAP plots only if they are missing for a given model.
- Created a new `src/model/utils` directory to house shared utilities for configuration loading (`config_loader.py`), data preparation (`data_prep.py`), and path management (`paths.py`), improving code organization.
- Updated `requirements.txt` to include `PyYAML` and `mlflow`.

### Notes
- This commit marks a shift from standalone, version-specific scripts to a more robust, scalable, and reproducible MLOps-style pipeline.
- The new evaluation script is idempotent; it can be run multiple times and will only generate missing reports or artifacts.

## Entry · 2025-11-05 12:42 (+03)

### Commit
- **Hash:** `b620000`
- **Message:** `add evaluation and training scripts for models v1/v2, update feature splitting, and enhance requirements with new dependencies`

### Summary
- Delivered the repository’s first full modeling loop, from normalized LightGBM training through a multi-baseline evaluation and SHAP explainability assets, to validate the v1/v2 architecture.

### Details
- Added `src/model/train_model.py` to orchestrate the v1 normalized LightGBM pipeline: caps per-line outliers, derives `y_norm`, handles categorical typing, trains with early stopping, then persists the booster alongside gain-based feature importances, CSV exports, and PNG charts under `models/` and `reports/`.
- Embedded a commented v2 configuration within the training script documenting the alternative hyperparameters, callbacks, and artifact naming (`lgbm_transport_v2.txt`) so follow-up tuning work can be activated without rewriting the setup.
- Authored `src/model/eval_model.py` to reload v1/v2 boosters, denormalize predictions with train-set statistics, and benchmark them against lag-24h, lag-168h, and line+hour means while emitting MAE/RMSE/SMAPE metrics, per-hour slices, worst-line diagnostics, SHAP summaries, and improvement ratios to JSON/CSV/PNG outputs.
- Refined `src/features/split_features.py` by parsing `datetime` before applying the cutoff windows and dropping both `datetime` and `year`, keeping the split parquet files free from leak-prone time columns for downstream modeling scripts.
- Expanded `requirements.txt` with `matplotlib` for plotting and `shap` for model explainability, satisfying the new training and evaluation dependencies in a single install step.

### Notes
- Regenerate the split parquet files before training so `train_model.py` can build normalized datasets, and align the saved booster filenames (e.g., rename `lgbm_transport_v1_norm.txt` to the name expected by `eval_model.py`) ahead of running the evaluation workflow.
- SHAP sampling in `eval_model.py` draws 5k validation rows; ensure the environment has sufficient memory/GPU (if available) or reduce the sample size for constrained setups.

## Entry · 2025-11-04 13:18 (+03)

### Commit
- **Hash:** `5de9afd`
- **Message:** `update requirements and add feature splitting script`

### Summary
- Added train/validation/test parquet splits and modeling dependencies to prepare feature sets for upcoming experiments.

### Details
- Extended `requirements.txt` with `numpy`, `lightgbm`, and `scikit-learn` to support planned model training workflows.
- Updated `src/features/build_final_features.py` to retain the `datetime` column by dropping only `date`, ensuring downstream scripts can time-slice outputs.
- Authored `src/features/split_features.py` to partition `features_pd.parquet` into train, validation, and test parquet files under `data/processed/split_features`.

### Notes
- Execute the new split script after regenerating `features_pd.parquet`, and confirm the `data/processed/split_features` directory exists before writing outputs.
- Consider parameterizing the datetime cutoffs or sourcing them from configuration once the modeling workflow stabilizes.

## Entry · 2025-11-01 17:38 (+03)

### Commit
- **Hash:** `c98e0af`
- **Message:** `add end-to-end feature generation pipeline`

### Summary
- Stitched lag features, weather, and calendar signals into a reproducible feature mart with automated quality checks and pandas export support.

### Details
- Redirected hourly aggregation outputs in `src/data_prep/load_raw.py` to `data/interim` to distinguish staging artifacts from processed modeling assets.
- Hardened calendar dimension typing by casting weekend and school-term indicators to `Int8`, preventing Polars-to-parquet boolean drift before joins.
- Assembled the modeling-ready dataset via `src/features/build_final_features.py`, joining lagged transport, weather, and calendar tables and normalizing categorical/time features prior to persisting `features_pl.parquet`.
- Normalized the weather dimension to use a `datetime` column and consistent timestamp logging, enabling direct joins without timezone conversion hacks.
- Authored `src/features/check_features_quality.py` for Polars-based data quality audits, producing timestamped logs under `docs/data_quality_log_pl.txt` with schema, null, and range diagnostics.
- Added `src/features/convert_features_to_pandas.py` to emit `features_pd.parquet`, keeping downstream notebooks aligned with pandas tooling.

### Notes
- Recommended execution order: rebuild interim transport aggregates → run lag/rolling feature generator → execute `build_final_features.py` before QA and pandas export scripts.
- Ensure `docs/data_quality_log_pl.txt` is gitignored or rotated; the QA script appends logs on each run and may require periodic pruning.

## Entry · 2025-11-01 14:53 (+03)

### Commit
- **Hash:** `b2e5c94`
- **Message:** `add lag/rolling feature generation`

### Summary
- Introduced lag and rolling feature generation pipeline and aligned data exploration output with the new dataset.

### Details
- Added `src/features/build_log_roliing_transport_data.py` to engineer per-line lag features and rolling statistics before writing `lag_rolling_transport_hourly.parquet`.
- Updated `src/data_prep/explore_data.py` to inspect the new lag and rolling dataset for quick validation of feature outputs.
- Removed `src/data_prep/clean_weather_data.py`, consolidating weather rounding into upstream preparation steps and eliminating redundant processing.

### Notes
- Ensure `transport_hourly.parquet` is regenerated before running the lag and rolling builder so features shift over a complete hourly history.
- Consider folding the lag and rolling computation into the model training pipeline to avoid manual parquet exports once modeling scripts solidify.

## Entry · 2025-10-31 17:30 (+03)

### Commit
- **Hash:** `a7af96f`
- **Message:** `generate weather dimensional table with historical data and cleaning script`

### Summary
- Added hourly weather dimension builder with cached download and rounding cleanup steps.

### Details
- Introduced `src/features/build_weather_dim.py` to fetch 2022–2024 hourly weather via Open-Meteo with request caching and persist `weather_dim.parquet`.
- Created `src/data_prep/clean_weather_data.py` to round temperature, precipitation, and wind speed values in the weather dimension file.
- Extended `requirements.txt` with Open-Meteo client, caching, and retry dependencies needed for the new pipeline.

### Notes
- Ensure `../../data/cache` exists before running the weather builder so the cached session can persist responses.
- Update downstream jobs to consume `weather_dim.parquet` after the cleaning script to avoid duplicate rounding operations.

## Entry · 2025-10-31 00:42 (+03)

### Commit
- **Hash:** `94da046`
- **Message:** `generate calendar dimensional table for 2022-2031 with holidays and seasons`

### Summary
- Added calendar dimension generator covering 2022–2031 with weekend, season, school term, and holiday context.

### Details
- Created `src/features/build_calendar_dim.py` to construct daily records via Polars, join external holiday CSVs, and persist `calendar_dim.parquet`.
- Derived season labels, holiday leading/lag indicators, and school term flag directly within the feature script.
- Emits preview output to stdout for quick verification after parquet write.

### Notes
- Script expects `../../data/raw/holidays-2022-2031.csv`; guard for missing file or parameterize the path when integrating into pipelines.
- Consider promoting helper functions (season mapping, holiday windows) for reuse across future feature jobs.

## Entry · 2025-10-30 23:02 (+03)

### Commit
- **Hash:** `445d01c`
- **Message:** `process line-level metadata and update README with project overview`

### Summary
- Swapped district aggregation for line metadata export and published initial README overview.

### Details
- Replaced the active Polars pipeline in `src/data_prep/load_raw.py` to materialize a `transport_meta.parquet` dataset capturing unique line attributes.
- Commented out prior district/hour aggregation block, pausing both `transport_hourly.parquet` and `transport_district_hourly.parquet` outputs.
- Populated `README.md` with project summary, setup steps, repository structure, and documentation links.

### Notes
- Confirm whether downstream tooling still depends on the hourly parquet files and restore them if needed alongside the new metadata export.
- Consider renaming `district_meta` to reflect line-level content for clarity and future maintainability.

## Entry · 2025-10-30 22:33 (+03)

### Commit
- **Hash:** `ea6c7a3`
- **Message:** `process district-level hourly data and add cleaning script`

### Summary
- Pivoted aggregation pipeline to district/hour granularity and introduced basic cleaning utilities.

### Details
- Added `src/data_prep/clean_data.py` pandas helper to drop records with missing `town` and persist a cleaned parquet for downstream use.
- Reworked `src/data_prep/load_raw.py` to build `transport_district_hourly.parquet` via Polars, commenting out the previous line-level aggregation in the process.
- Expanded `src/data_prep/explore_data.py` diagnostics to surface dataset head/tail snapshots plus null and missing row counts.

### Notes
- New cleaning script relies on relative paths resolved from the execution directory; consider anchoring to `Path(__file__).parent` to avoid failures when run from the project root.
- Line-level parquet generation is now disabled, yet `explore_data.py` still targets `transport_hourly.parquet`; align the scripts or reinstate the line-level export to prevent stale references.

## Entry · 2025-10-29 22:17 (+03)

### Commit
- **Hash:** `28e59d2`
- **Message:** `add initial project setup and data processing`

### Summary
- Established baseline project files and implemented foundational data ingestion utilities.

### Details
- Introduced empty `Makefile` and `README.md` placeholders to scaffold project automation and documentation.
- Added `requirements.txt` with core data tooling dependencies (`polars`, `pandas`, `pyarrow`, `pathlib`).
- Implemented `src/data_prep/load_raw.py` to aggregate raw CSVs into hourly parquet outputs using Polars streaming.
- Created `src/data_prep/explore_data.py` helper for quick parquet inspection and basic dataset diagnostics.
- Updated `.gitignore` with additional patterns suited to the new project structure.

### Notes
- Represents first substantial code drop beyond baseline ignore file; subsequent commits should track feature engineering, modeling, and service layers.

## Entry · 2025-10-29 17:07 (+03)

### Commit
- **Hash:** `bee9760`
- **Message:** `first commit`

### Summary
- Initial repository setup with `.gitignore` baseline; further source files pending future commits.

### Details
- Added comprehensive `.gitignore` (258 lines) covering Python artifacts, environment folders, IDE settings, and build outputs to keep the repository clean from generated files.

### Notes
- Serves as the initial baseline commit; subsequent work (documentation, data ingestion scripts, tooling) remains to be committed and logged in future entries.
