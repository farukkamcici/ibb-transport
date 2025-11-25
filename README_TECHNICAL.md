# README_TECHNICAL.md

**Istanbul Public Transit Crowding Prediction Platform - Technical Documentation**

---

## Technical Abstract

This project implements a **LightGBM-based global forecasting model** for hourly public transportation ridership prediction in Istanbul, leveraging **24+ exogenous features** including weather data (Open-Meteo), calendar dimensions, and engineered lag/rolling window features. The system deploys a **FastAPI microservice architecture** with **Polars-optimized feature store**, **PostgreSQL persistence**, and a **React/Next.js Progressive Web Application** providing interactive crowd density visualization through **Leaflet maps** and **Recharts time-series analytics**. The platform achieves **sub-baseline MAE performance** through time-series cross-validation and serves **real-time crowd scoring** via percentile-ranking algorithms for operational decision support.

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
   - `main.py`: FastAPI app with model loading & CORS configuration
   - `services/store.py`: **Feature Store** with intelligent lag retrieval
   - `routers/`: RESTful endpoints for forecasting, nowcasting, and line search

---

## Data Sources & Feature Engineering Strategy

### Primary Data Sources

| **Source** | **Format** | **Features Extracted** | **Update Frequency** |
|------------|------------|------------------------|----------------------|
| **İBB Open Data** | Hourly passenger CSV | `passenger_count`, `line_name`, `datetime` | Static (historical) |
| **Open-Meteo API** | JSON (Historical + Forecast) | `temperature_2m`, `precipitation`, `wind_speed_10m` | Hourly |
| **Turkish Holiday Calendar** | Manual CSV | `is_holiday`, `holiday_win_m1/p1`, `is_school_term` | Annual |

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

## UI Platform Architecture & User Experience Flow

### Frontend Technology Stack

**Framework**: **Next.js 16** with **App Router** architecture
**Styling**: **Tailwind CSS** with custom design system  
**Mapping**: **React Leaflet** with OpenStreetMap tiles
**State Management**: **Zustand** (lightweight Redux alternative)
**Charts**: **Recharts** for time-series crowd visualization
**PWA**: Progressive Web App with offline capabilities

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
- **User Location**: GPS integration with animated position marker
- **Transport Layers**: (Future) GeoJSON overlays for line geometries
- **Custom Controls**: LocateButton for geolocation services

**MapCaller.jsx**: Dynamic import wrapper for SSR compatibility (Leaflet requires client-side rendering)

#### **3. Prediction Interface** (`components/ui/`)

**LineDetailPanel.jsx**: **Core prediction interface**
```typescript
// State-driven panel with real-time API integration
const LineDetailPanel = () => {
  const { selectedLine, selectedHour } = useAppStore();
  const [forecastData, setForecastData] = useState([]);
  
  useEffect(() => {
    getForecast(selectedLine.id, new Date())
      .then(setForecastData)
      .catch(handleError);
  }, [selectedLine]);
  
  return (
    <div className="fixed bottom-0 rounded-t-3xl bg-surface p-6">
      <CrowdStatusDisplay />
      <TimeSlider />
      <CrowdChart data={forecastData} />
    </div>
  );
};
```

**TimeSlider.jsx**: Hour selection interface (0-23 range slider)
**CrowdChart.jsx**: **Recharts** area chart with gradient visualization
**SearchBar.jsx**: Debounced line search with API integration

### State Management Architecture

**Zustand Store** (`store/useAppStore.js`):
```typescript
const useAppStore = create((set) => ({
  // Core application state
  selectedLine: null,        // Currently viewed transport line
  isPanelOpen: false,        // Detail panel visibility
  selectedHour: new Date().getHours(), // Time selector (0-23)
  userLocation: null,        // GPS coordinates [lat, lng]
  alertMessage: null,        // User notifications
  
  // State mutations  
  setSelectedLine: (line) => set({ selectedLine: line, isPanelOpen: true }),
  setSelectedHour: (hour) => set({ selectedHour: hour }),
  setUserLocation: (location) => set({ userLocation: location }),
}));
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