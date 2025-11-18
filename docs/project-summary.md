# Project Summary

This document captures delivery progress against the İstanbul Transit Crowding Platform product plan. Update it after each milestone that advances the PRD or technical design scope; focus on domain work (data pipelines, feature engineering, modeling, UI) and cite the related scripts or datasets rather than repository housekeeping changes.

## Data Preparation & Ingestion
- 2025-10-29: Implemented `src/data_prep/load_raw.py` to consolidate hourly passenger totals per line into parquet via Polars streaming, establishing the baseline `transport_hourly` dataset required for modeling.
- 2025-10-29: Added `src/data_prep/explore_data.py` to inspect processed parquet outputs, supporting the data validation activities outlined for the data preparation phase.

## Regional Aggregation & Cleaning
- 2025-10-30: Extended the ingestion pipeline to aggregate hourly ridership at the district level and persist `transport_district_hourly.parquet`, enabling the district heatmap requirement from the PRD.
- 2025-10-30: Introduced `src/data_prep/clean_data.py` to filter out rows missing `town` values and save a cleaned parquet, preparing inputs for downstream feature engineering.

## Metadata & Calendar Dimensions
- 2025-10-30: Generated `transport_meta.parquet` containing unique line attributes (transport type, road type, line identifiers) to feed feature engineering for line-aware modeling.
- 2025-10-31: Created `src/features/build_calendar_dim.py` to assemble the `calendar_dim.parquet` table with weekday, weekend, season, school term, and holiday indicators aligned with the technical design's calendar feature requirements.

## Weather Dimension
- 2025-10-31: Added `src/features/build_weather_dim.py` to fetch 2022–2024 hourly weather from Open-Meteo with cached retries and persist `weather_dim.parquet` for weather-aware modeling features.
- 2025-10-31: Created `src/data_prep/clean_weather_data.py` to round key weather metrics within `weather_dim.parquet`, later superseded by integrated rounding and removed on 2025-11-01.

## Feature Engineering
- 2025-11-01: Added `src/features/build_log_roliing_transport_data.py` to compute per-line lag and rolling mean/std features and persist `lag_rolling_transport_hourly.parquet`, preparing model-ready temporal signals for forecasting.
- 2025-11-01: Updated `src/data_prep/explore_data.py` to preview the lag and rolling dataset and removed the standalone weather rounding script, streamlining intermediate data inspection.
- 2025-11-01: Redirected hourly aggregation outputs in `src/data_prep/load_raw.py` to the `data/interim` layer and hardened calendar dimension flag typing to prevent downstream parquet casting surprises during joins.
- 2025-11-01: Added `src/features/build_final_features.py` to blend lagged transport signals with weather and calendar dimensions into `features_pl.parquet`, casting indicator columns to `Int8` for model-friendly storage.
- 2025-11-01: Updated `src/features/build_weather_dim.py` to emit a `datetime` index and consistent reporting window, aligning the weather table with transport timestamps.
- 2025-11-01: Authored `src/features/check_features_quality.py` to append Polars-based schema/null/outlier diagnostics to `docs/data_quality_log_pl.txt` after each feature build.
- 2025-11-01: Created `src/features/convert_features_to_pandas.py` so notebooks relying on pandas can consume `features_pd.parquet` without manual conversion steps.
- 2025-11-04: Modified `src/features/build_final_features.py` to retain the `datetime` column while dropping only `date`, ensuring downstream scripts can slice features chronologically.
- 2025-11-04: Added `src/features/split_features.py` to emit train, validation, and test parquet datasets from `features_pd.parquet` and extended `requirements.txt` with `numpy`, `lightgbm`, and `scikit-learn` to support upcoming modeling work.

## Modeling & Evaluation
- 2025-11-05: Introduced `src/model/train_model.py`, a normalized LightGBM training pipeline that caps per-line outliers, derives `y_norm`, casts categorical inputs, trains with early stopping, and saves the booster, metrics JSON, feature-importance CSV, and top-20 gain plot into `models/`, `reports/logs`, and `reports/figs` for reproducible v1 runs.
- 2025-11-05: Added `src/model/eval_model.py` to reload the v1 and planned v2 boosters, denormalize predictions using train-set statistics, compare them against lag-24h/lag-168h/line+hour baselines, emit MAE–RMSE–SMAPE summaries plus per-hour and worst-line diagnostics, and generate SHAP summary plots for explainability.
- 2025-11-05: Tightened the feature split workflow by parsing `datetime`, dropping both `datetime` and `year` before export, and appending `matplotlib` + `shap` to `requirements.txt` so the new training and evaluation scripts run with their plotting and explainability dependencies satisfied.
- 2025-11-10: Refactored the modeling pipeline to be configuration-driven and integrated MLflow for experiment tracking. The evaluation script was also unified to automatically discover, evaluate, and compare all trained models, making the MLOps cycle more robust and scalable.
- 2025-11-13: Added a new model (v4) with a different set of hyperparameters and updated the evaluation to include it. A new script `src/model/test_model.py` was added to allow for quick testing of trained models.
- 2025-11-17: Refactored `src/model/eval_model.py` and `src/model/test_model.py` to be fully configuration-driven. The scripts now dynamically load settings for each model version, robustly handling differences in features, categorical encoding, and normalization, thus resolving critical evaluation bugs and improving maintainability.
