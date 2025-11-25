# Project Logbook

_Last updated: 2025-11-25_

## Log Schema
- **Timestamp:** Commit date and hour (local timezone) recorded from repository history.
- **Commit:** Hash and message identifying the change captured in the log.
- **Summary:** One-line status of the project immediately after the commit.
- **Details:** Key updates introduced in the commit with brief explanations.
- **Notes:** Additional context or decisions relevant to the logged work.

## Entry · 2025-11-25 16:24 (+03)

### Commit
- **Hash:** `5b92677c931f5d11e42bc150c99481d277794a58`
- **Message:** `chore: remove redundant documentation; integrate hourly weather sync and nowcast UI enhancements`

### Summary
- Major UI/UX improvements to the weather nowcast component with unified header layout, smooth animations, and simplified weather service architecture. Removed redundant documentation files.

### Details
- **Frontend Weather Badge Redesign:**
  - Refactored Nowcast component to align perfectly with SearchBar in unified header row (fixed h-12 height)
  - Removed weather icon display and user location dependency - now Istanbul-specific with fixed coordinates
  - Implemented smooth dropdown animations (400ms ease-in-out with staggered item transitions)
  - Added intelligent hover/click behavior with delays (300ms expand, 800ms collapse)
  - Cleaned up 100+ lines of redundant code (icon mapping, location throttling, unused functions)
  - Simplified to show only temperature + "İstanbul" label with hourly forecast expansion
- **Layout Improvements:**
  - Updated SearchBar and weather badge to use consistent h-12 height for perfect alignment
  - Changed weather badge to dynamic width (w-auto) in minimized state for content-based sizing
  - Positioned both components in same row with proper gap spacing and z-index hierarchy
- **Backend Weather Service:**
  - Optimized weather.py with improved error handling and retry logic
  - Created weather_backup.py preserving original implementation
  - Streamlined nowcast API integration with OpenMeteo
- **Documentation Cleanup:**
  - Removed redundant GEMINI.md and Turkish README.md files
  - Added frontend DESIGN_SYSTEM.md for UI component guidelines

### Notes
- Weather component now follows Istanbul-specific design pattern (aligns with app's transit focus)
- Removed reverse geocoding complexity in favor of simpler, faster implementation
- All animations tested and working consistently across mobile and desktop screens
- Component refresh interval set to 30 minutes to balance freshness with API efficiency

## Entry · 2025-11-25 13:37 (+03)

### Commit
- **Hash:** `b7a80b31542bae888082b79e6d01166e13178f30`
- **Message:** `add backend API for admin, forecast, and line search; frontend admin dashboard integration, and deployment setup`

### Summary
- Developed the core backend API with endpoints for administration, forecasts, and line searches, and integrated the admin dashboard with the backend. Also, configured the production deployment environment.

### Details
- Created a FastAPI backend with routers for `admin`, `forecast`, and `lines`.
- Implemented an admin dashboard in the frontend to interact with the new admin endpoints.
- Added a search functionality for transport lines in the frontend.
- Configured `docker-compose.yml` and `Dockerfile` for production deployment.
- Added `DEPLOY.md` with deployment instructions.

### Notes
- This commit establishes the core backend functionality and prepares the project for production deployment.

# Project Logbook

_Last updated: 2025-11-24_

## Log Schema
- **Timestamp:** Commit date and hour (local timezone) recorded from repository history.
- **Commit:** Hash and message identifying the change captured in the log.
- **Summary:** One-line status of the project immediately after the commit.
- **Details:** Key updates introduced in the commit with brief explanations.
- **Notes:** Additional context or decisions relevant to the logged work.

## Entry · 2025-11-24 15:00 (+03)

### Commit
- **Hash:** `828d5aee70a696634f5b6fa51f3f3b48bd9bd1c9`
- **Message:** `add alert component and locate button for user location tracking; integrate with map and store`

### Summary
- Implemented a "Current Location" feature with a floating button on the map and replaced the default browser alert with a custom, modern alert component.

### Details
- Added a "Locate Me" button to the map that uses the browser's Geolocation API to find the user's location.
- The map view now centers on the user's location and displays a custom, modern marker.
- The button is positioned at the bottom right, above the tab bar, and styled to be modern and borderless.
- Created a new `Alert.jsx` component for displaying error messages, managed through the global Zustand store.
- The alert component is styled according to the project's design system and automatically dismisses after 5 seconds.
- Updated the `useAppStore` to manage state for both user location and alert messages.

### Notes
- The new alert system provides a more integrated and user-friendly way to display notifications.
- The "Locate Me" feature enhances user experience by allowing quick map orientation to their current position.

## Entry · 2025-11-19 19:59 (+03)

### Commit
- **Hash:** `e8854d7`
- **Message:** `add frontend setup with Next.js, Tailwind CSS, and initial components`

### Summary
- Established the initial frontend application structure with Next.js and Tailwind CSS.

### Details
- Created the basic frontend skeleton with a mobile-first design.
- Implemented the main map view, a search bar, and a bottom navigation bar.
- Set up the project with a dark/marine theme using a custom color palette in Tailwind CSS.
- Added a data layer with dummy data for transport lines and a Zustand store for state management.
- Implemented a line detail panel with a chart to display crowd forecast data.
- Added a time slider to control the displayed hour.
- Implemented multi-page navigation with separate pages for "Forecast" and "Settings".

### Notes
- This commit marks the initial setup of the frontend application. The components are functional but use dummy data.

## Entry · 2025-11-19 18:03 (+03)

### Commit
- **Hash:** `c100978`
- **Message:** `add random forest baseline training script, evaluation metrics, and update documentation`

### Summary
- Added a Random Forest baseline model to the project for performance comparison.

### Details
- Created `src/model/utils/train_rf_baseline.py` to train a Random Forest model as a baseline.
- The script is designed to be run from the Makefile, but the evaluation has not been performed yet.
- Updated project documentation to reflect the addition of the new baseline model.

### Notes
- The Random Forest model is intended to provide an additional baseline for evaluating the performance of the main LightGBM models. The evaluation reports for this model will be generated later.

## Entry · 2025-11-18 16:51 (+03)

### Commit
- **Hash:** `88e5ee2`
- **Message:** `add evaluation results and reports for lgbm_transport_v6, update project documentation`

### Summary
- Added evaluation results for the new v6 model and updated project documentation.

### Details
- Generated evaluation reports and metrics for the `lgbm_transport_v6` model.
- The v6 model achieves a MAE of 72.77 on the unseen test set, which is a 74.9% improvement over the 24-hour lag baseline.
- Updated `project-log.md` and `project-summary.md` to reflect the latest changes and model performance.

### Notes
- The v6 model shows strong performance, especially in improving upon the baseline. The top 10 worst performing lines are consistent with previous models, with MARMARAY and metro lines having the highest MA
E.

## Entry · 2025-11-17 16:17 (+03)

### Commit
- **Hash:** `b441ca9`
- **Message:** `refactor: Overhaul model evaluation and testing scripts for robustness`

### Summary
- Refactored the model evaluation and testing scripts to be configuration-driven, robustly handling multiple model versions and fixing critical data-handlin
g bugs.

### Details
- Rewrote `src/model/eval_model.py` to dynamically load the correct configuration (`v1.yaml`, `v5.yaml`, etc.) for each model being evaluated, ensuring a pe
rfect match with the training environment.
- Fixed a persistent `ValueError` related to categorical feature encoding by ensuring the evaluation script mimics the training script's data handling (usin
g combined train+validation sets for category mapping).
- Re-integrated denormalization logic into `eval_model.py` (controlled by a `needs_denormalization` config flag) to correctly process older, normalized mode
ls.
- Rewrote `src/model/test_model.py` as a command-line tool that accepts a model version (e.g., `v5`) and loads its configuration dynamically, removing all h
ardcoded values.
- Added detailed segment analysis (MAE by hour, top 10 worst lines) back into the evaluation and test reports.

### Notes
- This major refactoring makes the model evaluation and testing pipeline significantly more robust, maintainable, and resilient to changes in model configur
ations.

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
- Created a new `src/model/utils` directory to house shared utilities for configuration loading (`config_loader.py`), data preparation (`data_prep.py`), and path management (`paths.py`), improving code orga
nization.
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
- Added `src/model/train_model.py` to orchestrate the v1 normalized LightGBM pipeline: caps per-line outliers, derives `y_norm`, handles categorical typing, trains with early stopping, then persists the boo
ster alongside gain-based feature importances, CSV exports, and PNG charts under `models/` and `reports/`.
- Embedded a commented v2 configuration within the training script documenting the alternative hyperparameters, callbacks, and artifact naming (`lgbm_transport_v2.txt`) so follow-up tuning work can be activ
ated without rewriting the setup.
- Authored `src/model/eval_model.py` to reload v1/v2 boosters, denormalize predictions with train-set statistics, and benchmark them against lag-24h, lag-168h, and line+hour means while emitting MAE/RMSE/SM
APE metrics, per-hour slices, worst-line diagnostics, SHAP summaries, and improvement ratios to JSON/CSV/PNG outputs.
- Refined `src/features/split_features.py` by parsing `datetime` before applying the cutoff windows and dropping both `datetime` and `year`, keeping the split parquet files free from leak-prone time columns
 for downstream modeling scripts.
- Expanded `requirements.txt` with `matplotlib` for plotting and `shap` for model explainability, satisfying the new training and evaluation dependencies in a single install step.

### Notes
- Regenerate the split parquet files before training so `train_model.py` can build normalized datasets, and align the saved booster filenames (e.g., rename `lgbm_transport_v1_norm.txt` to the name expected 
by `eval_model.py`) ahead of running the evaluation workflow.
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
- Assembled the modeling-ready dataset via `src/features/build_final_features.py`, joining lagged transport, weather, and calendar tables and normalizing categorical/time features prior to persisting `featu
res_pl.parquet`.
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