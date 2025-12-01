# README_TECHNICAL.md

**Istanbul Public Transit Crowding Prediction Platform - Technical Documentation**

---

## Technical Abstract

This project implements a **LightGBM-based global forecasting model** for hourly public transportation ridership prediction in Istanbul, leveraging **24+ exogenous features** including weather data (Open-Meteo), calendar dimensions, and engineered lag/rolling window features. The system deploys a **FastAPI microservice architecture** with **Polars-optimized feature store**, **PostgreSQL persistence**, **APScheduler-based automated forecast generation**, and a **React/Next.js Progressive Web Application** with **Framer Motion animations**, **JWT authentication**, and **IETT SOAP API integration** for real-time bus stop geometries and route visualization. The platform provides **interactive Leaflet maps** with **45,000+ bus stops** and **500+ line routes**, **Recharts time-series analytics**, **multi-year seasonal lag fallback** strategy, and **locale-aware UI** (Turkish/English) with **favorites system** and **haptic feedback** for mobile users.

---

## Project Architecture

### Directory Structure & Data Pipeline

The codebase follows a **modular data science architecture** with clear separation of concerns:

```
├── src/
│   ├── data_prep/          # Raw → Interim data processing (Polars ETL)
│   ├── features/           # Feature engineering & dimensionality pipeline  
│   ├── model/              # Training, validation & hyperparameter configs
│   └── api/                # FastAPI microservice & database layer
├── data/
│   ├── raw/                # İBB transport CSV + holiday calendars
│   ├── interim/            # Aggregated parquet outputs  
│   └── processed/          # Model-ready feature matrices + split datasets
├── models/                 # Serialized LightGBM boosters (.txt format)
├── reports/                # Evaluation metrics, SHAP analysis, visualizations
└── frontend/               # Next.js PWA with Leaflet integration
```

### Pipeline Flow

**Raw → Processed → Training → API Deployment:**

1. **ETL Phase** (`src/data_prep/`):
   - `load_raw.py`: Aggregates İBB CSV files → `transport_hourly.parquet` 
   - `clean_data.py`: Missing value handling, outlier winsorization
   - `explore_data.py`: EDA and data quality profiling

2. **Feature Engineering** (`src/features/`):
   - `build_calendar_dim.py`: Holiday calendars + school term encodings
   - `build_weather_dim.py`: Open-Meteo API integration (historical + forecast)
   - `build_log_rolling_transport_data.py`: Lag/rolling window feature generation  
   - `build_final_features.py`: **Polars-based joins** → unified feature matrix
   - `split_features.py`: Time-based train/validation/test splits

3. **Modeling Pipeline** (`src/model/`):
   - `train_model.py`: YAML-configured LightGBM training with early stopping
   - `eval_model.py`: Baseline comparison + SHAP explainability analysis
   - `test_model.py`: Hold-out test evaluation with error decomposition

4. **API Service** (`src/api/`):
   - `main.py`: FastAPI app with model loading, CORS, and JWT authentication
   - `auth.py`: JWT token generation, bcrypt password hashing, protected route dependencies
   - `scheduler.py`: APScheduler integration with 3 automated cron jobs (forecast/cleanup/quality-check)
   - `services/store.py`: **Feature Store** with multi-year seasonal lag fallback strategy
   - `services/batch_forecast.py`: Batch prediction service with retry logic and fallback statistics
   - `routers/`: RESTful endpoints for forecasting, nowcasting, admin operations, and line search

---

## Data Sources & Feature Engineering Strategy

### Primary Data Sources

| **Source** | **Format** | **Features Extracted** | **Update Frequency** |
|------------|------------|------------------------|----------------------|
| **İBB Open Data** | Hourly passenger CSV | `passenger_count`, `line_name`, `datetime` | Static (historical) |
| **Open-Meteo API** | JSON (Historical + Forecast) | `temperature_2m`, `precipitation`, `wind_speed_10m` | Hourly |
| **Turkish Holiday Calendar** | Manual CSV | `is_holiday`, `holiday_win_m1/p1`, `is_school_term` | Annual |
| **IETT SOAP API** | XML (DurakDetay_GYY) | 45,000+ bus stop geometries with lat/lng coordinates | On-demand |
| **IETT Route API** | XML (getGuzergah_json) | 500+ bus line routes with ordered stop sequences | On-demand |

### Feature Engineering Justification

#### **1. Temporal Features**
- **`hour_of_day`**: Captures intraday periodicity (rush hours vs. off-peak)
- **`day_of_week`**: Weekend vs. weekday behavioral patterns  
- **`month`, `season`**: Seasonal ridership variations (summer holidays, winter weather)
- **`is_weekend`**: Binary encoding for weekend demand differences

#### **2. Weather Exogenous Variables**  
- **`temperature_2m`**: Extreme temperatures drive increased public transport usage
- **`precipitation`**: Rainfall significantly increases ridership (umbrella effect)
- **`wind_speed_10m`**: High winds discourage walking, increase transit demand

#### **3. Calendar Dimension Engineering**
- **`is_holiday`**: Public holidays alter normal commuting patterns
- **`holiday_win_m1/p1`**: Holiday spillover effects (day before/after)
- **`is_school_term`**: School schedule impacts family travel patterns

#### **4. Lag & Rolling Window Features**
**Strategic lag selection** based on transportation periodicity:
- **`lag_24h`**: Previous day same-hour (strongest predictor)
- **`lag_48h`**: Two-day lag for Tuesday→Thursday patterns  
- **`lag_168h`**: Weekly seasonality (Monday→Monday)
- **`roll_mean_24h`**: 24-hour moving average (trend smoothing)
- **`roll_std_24h`**: Rolling volatility (demand uncertainty quantification)

**Anti-overfitting consideration**: No short-term lags (1h, 2h, 3h) in production model v6 to prevent **temporal leakage** and improve **generalization**.

### Data Aggregation Logic

**Transport Hourly Aggregation:**
```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as datetime,
  line_name,
  SUM(passenger_count) as passage_sum,
  EXTRACT(hour FROM timestamp) as transition_hour
FROM raw_transport 
GROUP BY datetime, line_name, transition_hour
```

**Timezone Handling**: All timestamps normalized to `Europe/Istanbul` to handle **DST transitions** correctly.

**Outlier Management**: **Z-score winsorization** applied per transport line (cap at ±3σ) to handle anomalous events without data loss.

---

## Modeling Approach & Academic Justification

### Model Selection: LightGBM Gradient Boosting

**Primary Model:** Microsoft LightGBM (Gradient Boosting Decision Trees)

**Academic Justification:**
1. **Tabular Data Efficiency**: Superior performance vs. LSTM/neural approaches for **structured time-series with exogenous features** [[Makridakis M4 Competition](https://www.sciencedirect.com/science/article/abs/pii/S0169207018300785)]
2. **Missing Value Handling**: Native support for missing weather data without imputation bias
3. **Categorical Feature Integration**: Optimal encoding for `line_name` as high-cardinality categorical
4. **Training Speed**: 10-100x faster than deep learning for equivalent accuracy on this dataset size
5. **Interpretability**: SHAP integration enables **feature attribution analysis** required for academic evaluation

### Global Model Strategy vs. Individual Line Models

**Design Decision**: **Single global model** with `line_name` as categorical feature

**Justification:**
- **Regularization Effect**: Shared parameters across lines reduce overfitting vs. individual models
- **Cold Start Problem**: New transportation lines benefit from cross-line learned patterns  
- **Maintenance Simplicity**: Single model deployment vs. managing 100+ line-specific models
- **Data Efficiency**: Lines with limited historical data benefit from global pattern learning

**Trade-off**: Slight accuracy reduction for low-frequency lines vs. **significant operational benefits**.

### Hyperparameter Configuration (Model v6)

**Final Production Configuration** (`src/model/config/v6.yaml`):

```yaml
params:
  objective: "regression"
  metric: ["l1", "l2"]  
  boosting_type: "gbdt"
  learning_rate: 0.03        # Conservative for anti-overfitting
  num_leaves: 31             # Balanced tree complexity
  min_data_in_leaf: 500      # Regularization for transport line diversity  
  feature_fraction: 0.8      # Feature bagging
  bagging_fraction: 0.8      # Row bagging  
  lambda_l1: 0.1             # L1 regularization
  lambda_l2: 1.0             # L2 regularization
```

**Rationale**: Configuration optimized through **3-fold time-series cross-validation** with **early stopping** (100 rounds) to prevent temporal overfitting.

---

## Evaluation Framework & Metrics

### Validation Strategy

**Time-Series Cross-Validation** with **temporal integrity**:
- **Training Set**: Historical data (earliest 80% of timeline)
- **Validation Set**: Recent 2-6 months  
- **Test Set**: Final 2 months (hold-out for unbiased evaluation)

**No random splitting** to prevent **future leakage** in time-series context.

### Primary Metrics

| **Metric** | **Formula** | **Academic Justification** |
|------------|-------------|----------------------------|
| **MAE** | `mean(abs(y_true - y_pred))` | **Scale-interpretable** error in passenger count units |
| **SMAPE** | `100 * mean(abs(y_true - y_pred) / (abs(y_true) + abs(y_pred))/2)` | **Scale-invariant** for cross-line comparison |
| **MAE@Peak** | MAE computed only during rush hours | **Business-critical** error evaluation |

### Baseline Comparisons

**Implemented Baselines** for academic benchmarking:
1. **Lag-24h**: Previous day same-hour (`y_pred = lag_24h`)
2. **Hour-of-Week Average**: Historical mean by `(day_of_week, hour)` combination  
3. **Seasonal Naïve**: Previous week same-hour (`y_pred = lag_168h`)

**Academic Standard**: Model must outperform **all baselines** for publication validity.

### Explainability Analysis

**SHAP (SHapley Additive exPlanations) Integration**:
- **Global Feature Importance**: Ranking across all transport lines
- **Local Explanations**: Per-prediction feature attribution
- **Temporal Decomposition**: Lag vs. weather vs. calendar feature contributions  

**Academic Purpose**: Required for thesis **methodology justification** and **practical insights** for İBB stakeholders.

---

## Crowd Scoring Algorithm

### Mathematical Formulation

**Objective**: Convert raw ridership predictions into **interpretable crowd density levels** (0-100 scale).

**Two-Component Scoring System**:

1. **Percentile Ranking** (`percentile_rank`):
   ```python
   percentile_rank = scipy.stats.percentileofscore(
       historical_data[(line_name, hour_of_day)], 
       prediction_value
   ) / 100
   ```

2. **Peak Index** (`peak_index`):  
   ```python
   peak_index = prediction_value / historical_max_by_line[line_name]
   ```

3. **Composite Crowd Score**:
   ```python
   crowd_score = 0.6 * percentile_rank + 0.4 * peak_index
   ```

### Score Interpretation Logic

| **Score Range** | **Crowd Level** | **UI Color** | **Semantic Meaning** |
|-----------------|-----------------|--------------|----------------------|
| 0.00 - 0.20 | Very Low | 🟢 Green | Comfortable, seats available |
| 0.20 - 0.40 | Low | 🟢 Light Green | Minor crowding, mostly seated |
| 0.40 - 0.60 | Medium | 🟡 Yellow | Moderate density, standing room |  
| 0.60 - 0.80 | High | 🟠 Orange | Crowded, limited standing space |
| 0.80 - 1.00 | Very High | 🔴 Red | Packed, uncomfortable conditions |

**Design Rationale**: 
- **Contextual Scoring**: "High" means high *for that specific line and hour*, not absolute capacity
- **Dual Perspective**: Percentile captures **relative unusualness**; peak index captures **absolute utilization**
- **Weighted Average**: 60/40 weighting empirically optimized for user feedback alignment

---

## Automation & Scheduling System

### APScheduler Integration

**Cron Job Architecture** (`src/api/scheduler.py`):

The platform implements a comprehensive automated forecast generation system using **AsyncIOScheduler** for FastAPI compatibility:

**Job 1: Daily Forecast Generation** (02:00 Europe/Istanbul)
- Generates T+1 day forecasts for all transport lines (500+ lines × 24 hours)
- Implements 3-attempt retry logic with exponential backoff (1min → 2min → 4min)
- Batch prediction optimization reduces execution time from O(n) to O(1) per line
- Tracks `target_date` in `job_executions` table for monitoring

**Job 2: Forecast Cleanup** (03:00)
- Maintains rolling 3-day window (T-1, T, T+1) by deleting forecasts older than 3 days
- Enforces minimum 3-day retention to prevent accidental data loss
- Automatically rotates: new T+1 generated at 02:00, old T-3 deleted at 03:00

**Job 3: Data Quality Check** (04:00)
- Verifies forecast coverage, Feature Store health, and fallback statistics
- Logs warnings but doesn't block operations (proactive issue detection)
- Monitors zero fallback rate with alerts when exceeding 5%

**Robustness Features:**
- **Misfire grace time**: 1-2 hours - allows jobs to run even if scheduled time missed due to server downtime
- **Job coalescing**: Multiple missed schedules combine into single execution, avoiding duplicate work
- **Graceful shutdown**: Waits for running jobs to complete before stopping

### Admin Control APIs

**Scheduler Management Endpoints:**
- `GET /admin/scheduler/status` - View scheduler state and all job information
- `POST /admin/scheduler/pause` / `POST /admin/scheduler/resume` - Maintenance control
- `POST /admin/scheduler/trigger/{job_type}` - Manual job execution (forecast/cleanup/quality-check)
- `DELETE /admin/forecasts/date/{date}` - Delete all forecasts for specific date
- `GET /admin/forecasts/coverage` - 7-day forecast availability summary with status indicators
- `DELETE /admin/database/cleanup-all` - Bulk deletion of forecasts and job history with confirmation workflow

**Feature Store Monitoring:**
- `GET /admin/feature-store/stats` - Fallback statistics (seasonal match %, hour fallback %, zero fallback %)
- `POST /admin/feature-store/reset-stats` - Reset counters for fresh tracking
- `POST /admin/forecast/test` - Performance testing with configurable line/hour counts

---

## Authentication & Security

### JWT-Based Admin Authentication

**Backend Security** (`src/api/auth.py`):
- **Token Configuration**: HS256 algorithm, 24-hour expiration, secret key from `ADMIN_SECRET_KEY` env var
- **Password Hashing**: bcrypt via passlib with 72-byte truncation for compatibility
- **Protected Routes**: `get_current_user()` FastAPI dependency validates JWT and returns authenticated user
- **Database Schema**: `admin_users` table with username, hashed_password, created_at, last_login columns

**Admin User Management APIs:**
- `POST /admin/login` - Accepts username/password, returns JWT access token
- `GET /admin/users` - List all admin users with usernames and last login timestamps
- `GET /admin/users/me` - Return authenticated admin's profile
- `POST /admin/users` - Create new admin user with password hashing
- `POST /admin/users/change-password` - Update password for existing user
- `DELETE /admin/users/{username}` - Remove admin user (prevents deletion of last admin)

**Frontend Authentication** (`frontend/src/contexts/AuthContext.jsx`):
- **React Context**: Global admin session management with `login()`, `logout()`, `isLoading` states
- **Token Storage**: localStorage persistence with `adminToken` key for cross-page-reload authentication
- **Protected Routes**: `ProtectedRoute` wrapper component checks authentication before rendering admin pages
- **Locale-Aware Navigation**: Login/logout flows preserve language selection (Turkish/English)

---

## Data Ingestion & Route Visualization

### IETT SOAP API Integration

**Bus Stop Geometry Ingestion** (`src/data_prep/fetch_geometries.py`):
- Fetches 45,000+ unique bus stop records from IETT's `DurakDetay_GYY` SOAP service
- Multi-step flow: (1) Get all stop codes via `getHatDurakListesi_json`, (2) Batch process 100 stops at a time, (3) Extract geometry from `getKoordinatGetir_json`
- Data structure: `{stop_code: {name, lat, lng, district, type}}`
- Implements retry mechanism with exponential backoff (2s → 4s → 8s delays)
- Caching strategy for fault tolerance during batch processing
- Output: `frontend/public/data/stops_geometry.json` (90MB+ structured JSON)

**Line Routes Ingestion** (`src/data_prep/fetch_line_routes.py`):
- Fetches ordered stop sequences for 500+ bus lines from `getGuzergah_json` SOAP endpoint
- Handles bidirectional routes: "G" (gidiş/outbound) and "D" (dönüş/return)
- Multi-level structure: `{line_code: {direction: [ordered_stop_codes]}}`
- Validation for empty routes, missing directions, and malformed responses
- Output: `frontend/public/data/line_routes.json` (67MB+ structured JSON)

### Frontend Route System

**useRoutePolyline Hook** (`frontend/src/hooks/useRoutePolyline.js`):
- Module-level caching with singleton loading pattern (`stopsCache`, `routesCache`, `loadingPromise`)
- **`getRouteStops(lineCode, direction)`**: Returns detailed stop objects `[{code, name, lat, lng, district}]`
- **`getDirectionInfo(lineCode)`**: Generates dynamic direction labels by extracting destination stop names
  - Format: `"{DESTINATION_STOP_NAME} Yönü"` (e.g., "KADIKÖY Yönü" instead of "Gidiş")
  - Stop name formatting: removes suffixes (MAH., CAD., SOK.) and converts to uppercase
  - Returns metadata: `{label, firstStop, lastStop, firstStopCode, lastStopCode}` per direction
- **`getPolyline(lineCode, direction)`**: Returns lat/lng coordinate arrays for Leaflet rendering
- **`getAvailableDirections(lineCode)`**: Determines which directions exist for a line

**MapView Enhancements** (`frontend/src/components/map/MapView.jsx`):
- **Polyline Rendering**: Blue routes with `lineCap="round"` and `lineJoin="round"` for smooth appearance
- **Interactive Stop Markers**: `<CircleMarker>` components with tooltips displaying stop names on hover
  - **Start Stop**: Green filled circle (radius=6) with "Start" label
  - **End Stop**: Red filled circle (radius=6) with "End" label  
  - **Regular Stops**: White filled circles with blue borders (radius=4, weight=2)
- **Auto-Fit Bounds**: `MapController` component uses `useMap()` hook to pan/zoom showing full route with 50px padding
- **Performance Optimization**: `useMemo` for route coordinates and stops to prevent unnecessary recalculations

---

## UI Platform Architecture & User Experience Flow

### Frontend Technology Stack

**Framework**: **Next.js 16** with **App Router** and **React 19**
**Styling**: **Tailwind CSS** with custom design system  
**Animations**: **Framer Motion 12** for advanced gestures and transitions
**Mapping**: **React Leaflet 5** with CartoDB light tiles and IETT route overlays
**State Management**: **Zustand 5** with localStorage persistence middleware
**Charts**: **Recharts** for time-series crowd visualization
**Internationalization**: **next-intl 4.5.5** for Turkish/English localization
**PWA**: **@ducanh2912/next-pwa** with offline capabilities and home screen installation

### Component Architecture

#### **1. Core Layout Structure** (`frontend/src/app/`)

```typescript
// Main application layout with floating components
export default function Home() {
  return (
    <main className="relative flex h-[100dvh] w-screen flex-col">
      <SearchBar />           // Floating top search 
      <MapCaller />          // Full-screen interactive map
      <BottomNav />          // Navigation tabs  
      <LineDetailPanel />    // Slide-up prediction panel
    </main>
  );
}
```

#### **2. Interactive Map System** (`components/map/`)

**MapView.jsx**: Leaflet integration with Istanbul-centered view
- **Base Layer**: CartoDB light tiles for mobile-optimized rendering
- **User Location**: GPS integration with animated position marker (pulsing blue dot)
- **Route Visualization**: Polyline rendering for 500+ bus lines with 45,000+ stop markers
- **Interactive Markers**: CircleMarker components with tooltips, distinctive start (green)/end (red) styling
- **Auto-Fit Bounds**: Automatic map panning/zooming when routes displayed
- **Custom Controls**: LocateButton with dynamic positioning based on panel state

**LocateButton.jsx**: Geolocation service with responsive positioning
- Dynamic `bottom` property: `12rem` (panel open) vs `5rem` (panel closed)
- Smooth transition animations (`transition-all duration-300`)
- Loading state with spinner icon during GPS acquisition

**MapCaller.jsx**: Dynamic import wrapper for SSR compatibility (Leaflet requires client-side rendering)

#### **3. Prediction Interface** (`components/ui/`)

**LineDetailPanel.jsx**: **Core prediction interface with Framer Motion**
```typescript
// State-driven panel with animations and gestures
const LineDetailPanel = () => {
  const { selectedLine, selectedHour, showRoute, selectedDirection } = useAppStore();
  const [forecastData, setForecastData] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const controls = useAnimation();
  
  // Drag-to-minimize gesture (mobile only)
  const handleDragEnd = (event, info) => {
    const threshold = 100;
    if (info.offset.y > threshold || info.velocity.y > 500) {
      setIsMinimized(true);
      vibrate(10);
    }
  };
  
  return (
    <motion.div 
      drag={!isDesktop ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      animate={controls}
      className={cn(
        "fixed z-[899] bg-slate-900/95 backdrop-blur-md",
        isDesktop ? "top-20 left-4 w-96" : "bottom-16 left-0 right-0"
      )}
    >
      {/* Minimized state: Line code + route name + occupancy % + direction toggle */}
      {/* Expanded state: Full data + time slider + 24h chart + route controls */}
      <CrowdStatusDisplay />
      <TimeSlider />
      <CrowdChart data={forecastData} />
      <RouteControls />
    </motion.div>
  );
};
```

**Key Features:**
- **Framer Motion Integration**: Drag gestures, elastic constraints, AnimatePresence for smooth transitions
- **Haptic Feedback**: `navigator.vibrate()` API (10ms major actions, 5ms minor)
- **Responsive Layouts**: Desktop sidebar (384px fixed width) vs mobile drawer (full-width)
- **Minimize/Expand**: Click/drag to toggle between compact and full views
- **Route Visualization**: Direction selector with dynamic labels ("KADIKÖY Yönü"), show/hide toggle
- **Internationalization**: All strings localized via `useTranslations('lineDetail')` hook
- **Favorites System**: Star button with localStorage persistence

**TimeSlider.jsx**: Hour selection interface (0-23 range slider) with vibration feedback
**CrowdChart.jsx**: **Recharts** area chart with gradient visualization and collapsible mobile view
**SearchBar.jsx**: Debounced line search with numeric keyboard support (`inputMode="numeric"`)
**WeatherBadge.jsx**: Istanbul weather nowcast with dropdown hourly forecast

### State Management Architecture

**Zustand Store** (`store/useAppStore.js`):
```typescript
const useAppStore = create(
  persist(
    (set, get) => ({
      // Core application state
      selectedLine: null,        // Currently viewed transport line
      isPanelOpen: false,        // Detail panel visibility
      selectedHour: new Date().getHours(), // Time selector (0-23)
      userLocation: null,        // GPS coordinates [lat, lng]
      alertMessage: null,        // User notifications
      
      // Route visualization state
      showRoute: false,          // Route polyline visibility toggle
      selectedDirection: 'G',    // Active direction (G=gidiş, D=dönüş)
      
      // Favorites system
      favorites: [],             // Array of favorited line IDs
      toggleFavorite: (lineId) => {
        const favs = get().favorites;
        set({ 
          favorites: favs.includes(lineId) 
            ? favs.filter(id => id !== lineId) 
            : [...favs, lineId]
        });
      },
      isFavorite: (lineId) => get().favorites.includes(lineId),
      
      // State mutations  
      setSelectedLine: (line) => set({ selectedLine: line, isPanelOpen: true }),
      setSelectedHour: (hour) => set({ selectedHour: hour }),
      setUserLocation: (location) => set({ userLocation: location }),
      setShowRoute: (show) => set({ showRoute: show }),
      setSelectedDirection: (dir) => set({ selectedDirection: dir }),
      closePanel: () => set({ isPanelOpen: false, selectedLine: null, showRoute: false }),
    }),
    {
      name: 'ibb-transport-storage',
      partialize: (state) => ({ favorites: state.favorites }), // Only persist favorites
    }
  )
);
```

**State Flow**:
1. User searches transport line → `setSelectedLine()` → Panel opens
2. User adjusts time slider → `setSelectedHour()` → Chart re-renders for new hour
3. Location permission granted → `setUserLocation()` → Map centers on user
4. API errors → `setAlertMessage()` → Toast notification displays

### API Integration Layer

**HTTP Client** (`lib/api.js`):
```typescript
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,  // Environment-based backend URL
  headers: { 'Content-Type': 'application/json' },
});

// Primary forecast endpoint
export const getForecast = async (lineName, date) => {
  const dateString = format(date, 'yyyy-MM-dd');
  const response = await apiClient.get(`/forecast/${lineName}?target_date=${dateString}`);
  return response.data;  // Returns: HourlyForecast[]
};
```

**Error Handling Strategy**:
- **Network Failures**: Graceful degradation with cached data fallback  
- **API Errors**: User-friendly error messages with retry mechanisms
- **Loading States**: Skeleton UI during async operations

### User Interaction Flow

**Primary User Journey**:

1. **Landing**: User arrives at map-centered interface
2. **Search**: Types transport line name in floating search bar
3. **Selection**: Clicks on search result → Line detail panel slides up
4. **API Call**: `getForecast(lineName, today)` fetches 24h predictions
5. **Visualization**: Area chart renders with color-coded crowd levels
6. **Time Exploration**: User drags time slider (0-23 hours)
7. **Real-time Updates**: Chart highlights selected hour with detailed metrics
8. **Decision**: User identifies optimal travel time based on crowd predictions

**Advanced Features**:
- **Favorites**: Save frequently used lines for quick access
- **Notifications**: PWA push notifications for high-crowd alerts
- **Offline Mode**: Cached predictions available without internet
- **Geolocation**: GPS integration for location-based line recommendations

---

## Reproducibility & Development Workflow

### Data Pipeline Execution

**Complete pipeline reproduction**:

```bash
# 1. Raw data preparation
python src/data_prep/load_raw.py          # CSV → Parquet aggregation
python src/data_prep/clean_data.py        # Outlier handling & quality control

# 2. Feature engineering  
python src/features/build_calendar_dim.py    # Holiday calendar generation
python src/features/build_weather_dim.py     # Open-Meteo API integration  
python src/features/build_log_rolling_transport_data.py  # Lag/rolling features
python src/features/build_final_features.py  # Multi-table joins → unified matrix

# 3. Data validation
python src/features/check_features_quality.py   # Quality assurance reporting

# 4. Train/test splitting  
python src/features/split_features.py       # Time-based dataset partitioning

# 5. Model training & evaluation
python src/model/train_model.py            # LightGBM training with YAML configs  
python src/model/eval_model.py             # SHAP analysis & baseline comparison
python src/model/test_model.py             # Hold-out test evaluation

# 6. API deployment
uvicorn src.api.main:app --reload --port 8000   # FastAPI service
cd frontend && npm run dev                       # Next.js development server
```

### Configuration Management

**YAML-based Hyperparameter Control** (`src/model/config/`):
- **`common.yaml`**: Shared settings (paths, feature definitions)
- **`v6.yaml`**: Production model configuration with anti-overfitting parameters
- **Versioning**: Clear model evolution tracking for academic reproducibility

### Docker Deployment

**Production deployment** with automatic database initialization:
```bash
docker-compose up --build     # Builds API + PostgreSQL services
# Automatically loads transport metadata and initializes schema
```

### Key Implementation Details

**Feature Store Optimization** (`src/api/services/store.py`):
- **Polars-based** feature retrieval (10x faster than Pandas for large datasets)
- **Seasonal lag strategy**: Prioritizes same-month/day historical matches for prediction
- **Memory-efficient**: Selective column loading and Float32 casting for production deployment

**Database Auto-Initialization** (`src/api/utils/init_db.py`):
- **Zero-configuration setup**: Automatically populates transport line metadata  
- **Idempotent execution**: Safe to re-run without data duplication
- **Health checks**: Database connection verification with retry logic

---

## Academic Contributions & Thesis Integration

### Novel Methodological Contributions

1. **Global Model Architecture**: Demonstration of single-model superiority vs. line-specific models for transportation forecasting
2. **Lag Feature Engineering**: Systematic evaluation of temporal window selection for urban transit prediction
3. **Weather Integration**: Quantification of meteorological impact on public transportation demand  
4. **Crowd Scoring Algorithm**: Novel percentile + peak index composite scoring for user-interpretable density levels

### Datasets for Academic Validation

**Generated Research Assets**:
- **`reports/evaluation_summary_all.csv`**: Cross-model performance comparison  
- **`reports/feature_importance_*.csv`**: SHAP-based feature attribution analysis
- **`reports/figs/shap_summary_*.png`**: Visualization for thesis methodology chapter
- **Model artifacts**: Serialized LightGBM boosters for result reproduction

### Baseline Benchmarks

**Academic Standard Comparisons**:
- **Naïve forecasting methods**: Lag-based predictions  
- **Classical time-series**: Seasonal decomposition approaches
- **Ensemble benchmarks**: Multiple model averaging for accuracy bounds

This technical implementation serves as the **complete methodology foundation** for academic evaluation, combining **production-ready software engineering** with **rigorous machine learning research standards**.