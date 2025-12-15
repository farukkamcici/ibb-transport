# Project Summary

This document captures delivery progress against the İstanbul Transit Crowding Platform product plan. Update it after each milestone that advances the PRD or technical design scope; focus on domain work (data pipelines, feature engineering, modeling, UI) and cite the related scripts or datasets rather than repository housekeeping changes.

_Last updated: 2025-12-15_

## API & Deployment
- 2025-11-25: Developed the core backend API using FastAPI, with routers for `admin`, `forecast`, and `lines`.
- 2025-11-25: Integrated the frontend admin dashboard with the backend API.
- 2025-11-25: Configured the production deployment environment using Docker and Docker Compose.
- 2025-11-25: Added CORS support for the production frontend URL (ibb-transport.vercel.app) to enable cross-origin API requests from the deployed application.

## Data Preparation & Ingestion
- 2025-10-29: Implemented `src/data_prep/load_raw.py` to consolidate hourly passenger totals per line into parquet via Polars streaming, establishing the baseline `transport_hourly` dataset required for mod
eling.
- 2025-10-29: Added `src/data_prep/explore_data.py` to inspect processed parquet outputs, supporting the data validation activities outlined for the data preparation phase.

## Regional Aggregation & Cleaning
- 2025-10-30: Extended the ingestion pipeline to aggregate hourly ridership at the district level and persist `transport_district_hourly.parquet`, enabling the district heatmap requirement from the PRD.
- 2025-10-30: Introduced `src/data_prep/clean_data.py` to filter out rows missing `town` values and save a cleaned parquet, preparing inputs for downstream feature engineering.

## Metadata & Calendar Dimensions
- 2025-10-30: Generated `transport_meta.parquet` containing unique line attributes (transport type, road type, line identifiers) to feed feature engineering for line-aware modeling.
- 2025-10-31: Created `src/features/build_calendar_dim.py` to assemble the `calendar_dim.parquet` table with weekday, weekend, season, school term, and holiday indicators aligned with the technical design's
 calendar feature requirements.

## Weather Dimension
- 2025-10-31: Added `src/features/build_weather_dim.py` to fetch 2022–2024 hourly weather from Open-Meteo with cached retries and persist `weather_dim.parquet` for weather-aware modeling features.
- 2025-10-31: Created `src/data_prep/clean_weather_data.py` to round key weather metrics within `weather_dim.parquet`, later superseded by integrated rounding and removed on 2025-11-01.

## Feature Engineering
- 2025-11-01: Added `src/features/build_log_roliing_transport_data.py` to compute per-line lag and rolling mean/std features and persist `lag_rolling_transport_hourly.parquet`, preparing model-ready tempora
l signals for forecasting.
- 2025-11-01: Updated `src/data_prep/explore_data.py` to preview the lag and rolling dataset and removed the standalone weather rounding script, streamlining intermediate data inspection.
- 2025-11-01: Redirected hourly aggregation outputs in `src/data_prep/load_raw.py` to the `data/interim` layer and hardened calendar dimension flag typing to prevent downstream parquet casting surprises dur
ing joins.
- 2025-11-01: Added `src/features/build_final_features.py` to blend lagged transport signals with weather and calendar dimensions into `features_pl.parquet`, casting indicator columns to `Int8` for model-fr
iendly storage.
- 2025-11-01: Updated `src/features/build_weather_dim.py` to emit a `datetime` index and consistent reporting window, aligning the weather table with transport timestamps.
- 2025-11-01: Authored `src/features/check_features_quality.py` to append Polars-based schema/null/outlier diagnostics to `docs/data_quality_log_pl.txt` after each feature build.
- 2025-11-01: Created `src/features/convert_features_to_pandas.py` so notebooks relying on pandas can consume `features_pd.parquet` without manual conversion steps.
- 2025-11-04: Modified `src/features/build_final_features.py` to retain the `datetime` column while dropping only `date`, ensuring downstream scripts can slice features chronologically.
- 2025-11-04: Added `src/features/split_features.py` to emit train, validation, and test parquet datasets from `features_pd.parquet` and extended `requirements.txt` with `numpy`, `lightgbm`, and `scikit-lea
rn` to support upcoming modeling work.

## Modeling & Evaluation
- 2025-11-05: Introduced `src/model/train_model.py`, a normalized LightGBM training pipeline that caps per-line outliers, derives `y_norm`, casts categorica
l inputs, trains with early stopping, and saves the booster, metrics JSON, feature-importance CSV, and top-20 gain plot into `models/`, `reports/logs`, and
`reports/figs` for reproducible v1 runs.
- 2025-11-05: Added `src/model/eval_model.py` to reload the v1 and planned v2 boosters, denormalize predictions using train-set statistics, compare them aga
inst lag-24h/lag-168h/line+hour baselines, emit MAE–RMSE–SMAPE summaries plus per-hour and worst-line diagnostics, and generate SHAP summary plots for expla
inability.
- 2025-11-05: Tightened the feature split workflow by parsing `datetime`, dropping both `datetime` and `year` before export, and appending `matplotlib` + `s
hap` to `requirements.txt` so the new training and evaluation scripts run with their plotting and explainability dependencies satisfied.
- 2025-11-10: Refactored the modeling pipeline to be configuration-driven and integrated MLflow for experiment tracking. The evaluation script was also unif
ied to automatically discover, evaluate, and compare all trained models, making the MLOps cycle more robust and scalable.
- 2025-11-13: Added a new model (v4) with a different set of hyperparameters and updated the evaluation to include it. A new script `src/model/test_model.py
` was added to allow for quick testing of trained models.
- 2025-11-17: Refactored `src/model/eval_model.py` and `src/model/test_model.py` to be fully configuration-driven. The scripts now dynamically load settings
 for each model version, robustly handling differences in features, categorical encoding, and normalization, thus resolving critical evaluation bugs and imp
roving maintainability.
- 2025-11-18: Generated evaluation reports for the `lgbm_transport_v6` model, which demonstrates a significant improvement over baseline models with a test set MAE of 72.77. Updated project documentation to
 include these latest results.
- 2025-11-19: Added a Random Forest baseline model (`src/model/utils/train_rf_baseline.py`) to the project. This model will be used as an additional baseline for performance comparison against the LightGBM 
models. The evaluation for this model has not been run yet.

## Frontend Development
- 2025-11-19: Established the initial frontend application with Next.js and Tailwind CSS, featuring a mobile-first, dark-themed UI. Key components include a map view, a functional search bar, a line detail 
panel with data visualization, and a bottom navigation system. The frontend is powered by a Zustand store for state management and uses dummy data for now. Multi-page navigation for "Forecast" and "Settings
" has been implemented.
- 2025-12-06: Upgraded the frontend stack to Next.js 16.0.7 (React 19) and the latest eslint tooling, ensuring compatibility with the new metro-specific App Router components and Framer Motion animations.
- 2025-12-11: Added a dedicated Metro map overlay (`MetroLayer`) with polylines and station markers rendered from `metro_topology.json`, enabling station inspection flows directly on the Leaflet map.

## User Interaction & UX
- 2025-11-24: Implemented a "Current Location" feature, adding a floating button to the map that allows users to center the view on their current position, marked by a custom icon.
- 2025-11-24: Replaced default browser alerts with a custom, modern alert component that aligns with the project's design system, providing a more integrated and user-friendly notification experience.
- 2025-11-25: Redesigned weather nowcast badge component with unified header layout, smooth animations, and Istanbul-specific weather integration. Refactored to align perfectly with SearchBar in a single row with consistent height (h-12), implemented dropdown-style expansion with 400ms transitions and staggered item animations, and simplified architecture by removing 100+ lines of redundant code (weather icons, user location dependency, location throttling). Component now shows temperature and "İstanbul" label with hourly forecast details on expansion.
- 2025-11-26: Enhanced weather service to include precipitation data in both API responses and fallback logic. Updated Nowcast component UI to display precipitation alongside temperature in hourly forecasts, providing more comprehensive weather context.

## Backend Performance & Operations
- 2025-11-26: Implemented batch processing for model predictions, replacing row-by-row inference with single batch calls to significantly reduce execution time for daily forecast jobs (500+ lines × 24 hours).
- 2025-11-26: Optimized Feature Store with batch lag loading and precomputed lookup caching in `services/store.py`, reducing database calls from O(n) per prediction to O(1) batch queries with in-memory cache for faster retrieval.
- 2025-11-26: Hardened batch forecast job execution with dedicated database session management for background tasks, comprehensive error handling with traceback logging, and error message truncation to prevent database overflow.
- 2025-11-26: Added admin recovery endpoint `POST /admin/jobs/reset-stuck` to reset jobs stuck in RUNNING status, enabling manual recovery from process crashes or deployment interruptions.
- 2025-11-26: Enhanced batch forecast service with detailed logging for weather fetching, calendar loading, and prediction progress. Added critical error checks for missing calendar features and graceful handling of missing weather data.

## Admin Tools & Testing
- 2025-11-26: Created lightweight performance testing endpoint `POST /admin/forecast/test` that accepts configurable `num_lines` and `num_hours` parameters, samples random lines, and returns timing breakdown (lag loading, batch processing, result handling) with per-prediction averages and estimated full-job duration.
- 2025-11-26: Enhanced frontend admin dashboard with performance testing UI featuring a "Test" button that displays test configurations, timing metrics, bottleneck detection, and sample predictions in an expandable card interface for quick model validation and diagnosis.

## Internationalization (i18n)
- 2025-11-27: Implemented comprehensive multi-language support with next-intl v4.5.5, enabling Turkish (default) and English locales across the entire frontend application. Restructured app directory to `[locale]` routing pattern with automatic locale detection via middleware. Created complete translation files (`messages/tr.json`, `messages/en.json`) covering all UI components including navigation, search, line details, weather, transport types, and error messages. Localized 10+ components using `useTranslations` hook and created custom `useGetTransportLabel` hook for dynamic transport type translations. Implemented `LanguageSwitcher` component integrated into Settings page for user-controlled language selection. All routes now support locale prefixes (e.g., `/tr/`, `/en/forecast`) with cookie-based persistence.

## API & Frontend Integration
- 2025-11-27: Integrated forecast API (`GET /forecast/{line_name}`) with frontend components including comprehensive error handling (400, 404, 500 status codes), request validation (line existence, date range), and retry logic for timeouts and rate limiting. Implemented production-ready `CrowdChart` component with custom tooltip, occupancy percentage visualization, multi-stop gradient styling, and empty state handling. Enhanced `LineDetailPanel` with proper state management and error display. Added `GET /lines/{line_name}` metadata endpoint. Removed automatic route navigation from SearchBar to keep users on current tab when selecting lines.

## Forecast API Enhancements
- 2025-12-08: Upgraded `/forecast/{line}` to consult line schedules and emit `in_service` markers, allowing the UI to show "Out of Service" hours instead of blank states. Updated the frontend API client and `CrowdChart`/LineDetailPanel to consume the enriched payload so metro lines honour their direction-specific service windows.
- 2025-12-12: Extended out-of-service handling to metro/rail lines by deriving service windows from Metro topology metadata (`first_time`/`last_time`), including wrap-midnight cases, while keeping forecast values shared for `M1A`/`M1B` via the existing `M1` prediction rows.

## Metro Line Search (M1 Split)
- 2025-12-12: Split the `M1` database line into separate `M1A` and `M1B` results in `/lines/search` so station lists, direction IDs, and timetable queries stay branch-correct while the forecast layer can continue to reuse a single prediction stream.

## User Experience & Favorites System
- 2025-11-27: Implemented favorites system with localStorage persistence via Zustand middleware, allowing users to bookmark transport lines without authentication. Added `toggleFavorite()` and `isFavorite()` actions to store with partialize strategy for selective persistence. Enhanced `LineDetailPanel` with star button (filled yellow when favorited) and backdrop blur overlay for better focus. Redesigned Forecast page as favorites dashboard displaying real-time crowd levels and occupancy for saved lines, with empty state prompting users to explore the map. Improved search highlighting with Turkish locale-sensitive matching (`toLocaleLowerCase('tr-TR')`) and fixed backend search normalization to handle İ/i and I/ı character pairs correctly. Added automatic panel closure on navigation to prevent cross-page state conflicts.

## Automation & Scheduling
- 2025-11-29: Implemented comprehensive APScheduler-based cron job system for automated forecast generation, data cleanup, and quality monitoring. Created 3 automated jobs running daily at 02:00 (forecast generation for T+1), 03:00 (cleanup forecasts older than 3 days), and 04:00 (data quality checks). Implemented rolling 3-day forecast window strategy (T-1, T, T+1) with automatic rotation. Added 8 new admin API endpoints for scheduler control (`/admin/scheduler/status`, pause/resume, manual triggers for forecast/cleanup/quality-check). Built `SchedulerPanel` and `ForecastCoverage` UI components integrated into admin dashboard with real-time status monitoring, job statistics (execution count, error rate, next/last run times), and 7-day coverage visualization with delete-by-date functionality. Implemented robust error handling with 3-attempt retry logic using exponential backoff (1min, 2min, 4min), misfire grace time (1-2 hours), and job coalescing. Enhanced `JobExecution` model with `target_date` column to track which date each job forecasted. Created comprehensive documentation (`docs/cron-jobs-guide.md`, `docs/cron-system-implementation.md`) with 1200+ lines covering architecture, API reference, troubleshooting, and best practices.
- 2025-12-11: Added APScheduler cron jobs to prefetch Metro Istanbul timetables into Postgres (`metro_schedules`) and serve `/metro/schedule` from the persistent cache with retries and cleanup for faster, more resilient metro schedule UX.

## Feature Store & Data Quality
- 2025-11-29: Enhanced Feature Store with multi-year seasonal fallback strategy for lag feature retrieval, replacing single-year matching with 3-tier hierarchy: (1) seasonal matching with up to 3-year lookback window filtering by month/day, (2) hour-based fallback for same hour-of-day historical data, (3) zero fallback as last resort. Implemented comprehensive None-value checking across `get_historical_lags()` and `get_batch_historical_lags()` methods to prevent Pydantic validation crashes when lag data incomplete. Added fallback statistics tracking with 7 metrics (total requests, seasonal match count/percentage, hour fallback count/percentage, zero fallback count/percentage) exposed via `GET /admin/feature-store/stats` endpoint. Enhanced admin dashboard with Feature Store panel displaying real-time fallback distribution with color-coded warnings when zero fallback rate exceeds 5%. Fixed critical bug in batch forecast where None values in lag dictionaries caused ModelInput validation errors. Created `docs/lag-fallback-strategy.md` documenting fallback hierarchy, monitoring approach, debugging guide, and example scenarios.

## Authentication & Security
- 2025-12-01: Implemented JWT-based admin authentication system with secure password hashing (bcrypt), token management (HS256, 24h expiration), and database-backed user storage. Created `src/api/auth.py` module with `create_access_token()`, `verify_password()`, `hash_password()`, and `get_current_user()` FastAPI dependency for route protection. Added `admin_users` table with username, hashed_password, created_at, last_login columns. Built React AuthContext for frontend session management with localStorage token persistence. Implemented ProtectedRoute wrapper component for admin pages with authentication checks and login redirects. Created admin login page with form validation and error handling. Added locale-aware routing (Turkish/English) with dynamic redirects preserving language selection. Resolved bcrypt compatibility issues by pinning bcrypt==4.0.1 and implementing 72-byte password truncation. Implemented complete admin user management: `GET /admin/users` (list), `GET /admin/users/me` (current user), `POST /admin/users` (create), `POST /admin/users/change-password`, `DELETE /admin/users/{username}` (with last-admin protection). Built UserManagement UI component with CRUD operations, password change forms, deletion confirmations, and secure API integration with Authorization headers.

## Data Ingestion & Route Visualization  
- 2025-12-01: Implemented comprehensive IETT bus data ingestion system with SOAP API integration. Created `fetch_geometries.py` to retrieve 45,000+ bus stop geometries via `DurakDetay_GYY` service with retry logic and exponential backoff, outputting structured JSON with stop codes, names, lat/lng coordinates, and districts (90MB). Built `fetch_line_routes.py` to fetch ordered stop sequences for 500+ bus lines with bidirectional routes (G/D) via `getGuzergah_json` endpoint (67MB output). Developed `useRoutePolyline` React hook with module-level caching for efficient route data loading in browser. Enhanced MapView with `<Polyline>` rendering, auto-fit bounds via `MapController`, and blue route visualization (4px weight, 70% opacity). Added LineDetailPanel route controls with show/hide toggle, direction selector, and panel auto-minimize on route display. Implemented dynamic direction labels extracting destination stop names ("KADIKÖY Yönü" instead of generic "Gidiş/Dönüş") with Turkish suffix formatting (removes MAH., CAD., SOK.). Added interactive stop markers on map: CircleMarker components with tooltips, distinctive styling for start (green, radius=6) and end (red, radius=6) stops, regular stops (white fill, blue border, radius=4). Applied polyline styling with rounded caps/joins (`lineCap="round"`, `lineJoin="round"`). Optimized performance with `useMemo` for route coordinates and stops. Implemented LocateButton dynamic positioning based on panel state with smooth transitions.

## UI/UX Enhancements
- 2025-12-08: Rebuilt the mobile 24-hour `CrowdChart` collapse/expand logic so charts animate reliably when the LineDetailPanel is minimized, preventing blank states on phones while preserving desktop behaviour.
- 2025-12-01: Integrated Framer Motion for advanced animations in LineDetailPanel: drag-to-minimize gesture (100px threshold, 500px/s velocity), elastic constraints with rubber-band effect, smooth height transitions (auto/55vh/75vh states), AnimatePresence for backdrop fades (200-300ms duration). Added haptic feedback via `navigator.vibrate()` API: 10ms for major actions (minimize, route toggle), 5ms for minor actions (direction change, favorites). Implemented responsive design with custom `useMediaQuery` hook for desktop/mobile layouts. Enhanced LineDetailPanel with desktop sidebar layout (384px fixed width, top-20 left-4 positioning), minimize/expand functionality with chevron icons, collapsible 24h forecast chart, and refined visual hierarchy. Added numeric keyboard support for SearchBar (`inputMode="numeric"`, `pattern="[0-9]*"`) optimizing mobile bus line entry. Completed i18n implementation by localizing all LineDetailPanel hardcoded strings (10 new translation keys in tr.json/en.json) including capacity, predicted passengers, route view controls, panel state labels, accessibility aria-labels, and tooltips. Fixed panel overflow issue on mobile by adding `pb-6` padding to scrollable container, preventing tab bar overlap when direction selector renders.

## Model Evaluation & Reporting
- 2025-12-06: Enhanced model evaluation infrastructure with volume-weighted accuracy metrics for academic reporting. Implemented NMAE (Normalized MAE) calculation as MAE divided by mean passenger volume, providing scale-independent performance measure (15.9% for v6 model). Added baseline NMAE comparison showing model reduces error rate from 63.4% (naive lag-24h) to 15.9%, demonstrating 75% improvement in relative terms. Extended worst-performing lines analysis to include mean passenger volume and line-specific NMAE, revealing high absolute errors (MAE=2058 for MARMARAY) correspond to reasonable relative errors (13.5% NMAE). Automated generation of human-readable Markdown reports (`test_explanation_{version}.md`) with LaTeX-formatted mathematical formulas, simulated examples, and comparative tables suitable for thesis documentation. Updated JSON test reports to include `test_set_mean_volume`, `baseline_nmae_lag24`, and detailed line statistics with `{mae, mean_volume, nmae}` structure for comprehensive performance analysis.

## User Feedback & Issue Tracking
- 2025-12-05: Implemented comprehensive user report management system for systematic feedback collection. Created backend API with 5 endpoints: POST /reports (submit), GET /reports (list with status/type filters), GET /reports/{id} (details), PATCH /reports/{id}/status (admin update), GET /reports/summary (statistics). Added `user_reports` database table tracking report type (bug/feedback/feature), subject, description, optional email, status (pending/in_review/resolved/closed), priority, and timestamps. Built `ReportForm` frontend component with type selection, subject/description validation, and success/error feedback. Developed `ReportsPanel` admin interface with filtering, pagination, priority badges, and status update controls. Report statistics endpoint provides counts by status and type for administrative oversight and iterative platform improvement planning.

## Real-Time Schedule Integration
- 2025-12-04: Integrated real-time bus schedule data from IETT SOAP API with caching layer. Implemented `/lines/{line_code}/schedule` endpoint fetching timetables with XML parsing and day-type filtering (weekday/weekend/holiday) using calendar dimension table. Added TTLCache (24-hour expiration) to minimize external API calls and improve response times for frequently queried lines. Created `ScheduleWidget` compact view showing next 3 departures and `ScheduleModal` full view with complete hourly/minutely schedules. Built admin endpoints `/admin/schedule/cache` for viewing cache statistics and clearing cached data. Schedule integration complements crowding predictions by helping users plan departures around low-occupancy time windows.

## Line Status & Disruption Alerts
- 2025-12-08: Added direction-aware status checks across backend and frontend so `/lines/{line_code}/status` can report separate `G`/`D` service windows and `ScheduleWidget` displays localized first/last departure badges per direction.
- 2025-12-08: Improved status service observability by enriching logs and caching alert payloads, trimming redundant IETT calls while keeping operational checks real-time.
- 2025-12-03: Developed real-time line status monitoring system fetching disruption alerts from IETT API. Created `/lines/{line_code}/status` endpoint returning operational status, active disruption alerts (filtered by timestamp and line code via `HATKODU` field), and service hour metadata. Implemented XML namespace stripping for reliable parsing of IETT's legacy SOAP responses. Built `StatusBanner` compact alert display with animated scrolling text and `AlertsModal` for detailed disruption information. Applied response caching (5-minute TTL) balancing real-time accuracy with API load reduction. Alert integration enables proactive user awareness of service disruptions, accidents, or maintenance affecting crowding patterns.

## Route Geometry Processing
- 2025-12-02: Developed geometry analysis and variant selection pipeline for optimal bus route polyline identification. Created `analyze_route_structure.py` diagnosing MultiLineString connectivity issues, segment reversals, and gap detection. Built `analyze_variants.py` comparing route variants (IETT API returns 3-8 per route) by length, segment count, and coordinate coverage. Implemented `process_route_shapes.py` with weighted scoring algorithm: coordinate count (30%), segment continuity (25%), length consistency (20%), bounding box coverage (15%), simplicity (10%). Added quality filters rejecting routes with <10 coordinates, segment count >100, or length ratio >3x median to exclude malformed geometries. Generated processed route shapes with single selected variant per line/direction, reducing frontend parsing complexity and ensuring consistent map visualization without overlapping polylines.

## Metro Integration
- 2025-12-09: Added complete Metro Istanbul ingestion and APIs, including topology fetchers for lines/stations/directions, a dedicated FastAPI router/service, and React utilities (`useMetroTopology`, `useMetroSchedule`, `MetroLayer`) so Metro lines render on the map with stops, accessibility metadata, live departures, and direction selectors. Follow-up schema commits reorganized metro-specific Pydantic models under `src/api/schemas.py`.
- 2025-12-11: Completed the metro UX with M1→M1A fallback logic, forecasting hooks, a full-day `MetroScheduleModal`, and a stale-while-revalidate localStorage cache that delivers instant timetable reads even when the upstream API stalls. Metro alerts were intentionally removed during this pass to keep the MVP focused on reliable schedule + forecast signals.

## Special Line Handling (MARMARAY)
- 2025-12-15: Implemented hardcoded service hours (06:00-00:00 with midnight wrap) for MARMARAY line to resolve missing schedule data issues. Added special-case handling in both forecast and status APIs to prevent "Out of Service" errors across all 24 hours. Frontend bypasses schedule widget requirements and forces 24h chart display for MARMARAY with custom empty state messages.

## Multi-Day Batch Forecasting
- 2025-12-13: Extended batch forecast scheduler to support configurable multi-day ahead predictions (`days_ahead` parameter). Enhanced job execution tracking with target date columns and better error handling. Added admin UI controls for scheduling forecasts beyond T+1. Implemented database migration for new JobExecution columns supporting multi-day operations.

## UI/UX Component Refactoring
- 2025-12-15: Major frontend refactor extracting SearchBar and Nowcast into reusable `MapTopBar` component for consistent header across Map and Forecast pages. Added `PageHeader` component for Settings page. Introduced separate `isPanelMinimized` state in Zustand store for better panel collapse control. Enhanced out-of-service hour UX with empty state cards showing clock icons and helpful user tips in LineDetailPanel.

## Admin Dashboard Enhancement
- 2025-12-13: Complete admin panel redesign with card-based layout, improved visual hierarchy, and consistent spacing. Enhanced all admin components (`SchedulerPanel`, `ForecastCoverage`, `MetroCachePanel`, `ReportsPanel`, `UserManagement`) with better typography and color scheme. Removed deprecated code and simplified scheduler controls.
