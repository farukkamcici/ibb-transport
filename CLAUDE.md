# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Istanbul Transport Crowding Prediction Platform** - an ML-powered web application that predicts public transportation line crowding 24 hours ahead using historical passenger data, weather patterns, and calendar features. The system serves predictions through a FastAPI backend with a Next.js frontend featuring interactive maps and crowd level visualizations.

## Development Commands

### Backend (Python/FastAPI)
- **Install dependencies**: `pip install -r requirements.txt`
- **Start API server**: `uvicorn src.api.main:app --reload --port 8000`
- **Docker deployment**: `docker-compose up --build`
- **Initialize database**: Automatically handled on first API startup

### Frontend (Next.js)
- **Install dependencies**: `cd frontend && npm install`
- **Development server**: `cd frontend && npm run dev`
- **Build**: `cd frontend && npm run build`
- **Start production**: `cd frontend && npm start`
- **Lint**: `cd frontend && npm run lint`

### ML Pipeline
- **Load raw data**: `python src/data_prep/load_raw.py`
- **Clean data**: `python src/data_prep/clean_data.py`
- **Build features**: `python src/features/build_final_features.py`
- **Train model**: `python src/model/train_model.py`
- **Evaluate model**: `python src/model/eval_model.py`
- **Split features**: `python src/features/split_features.py`

## Architecture

### Data Flow
1. **Raw Data** (`data/raw/`) → **Interim Processing** (`data/interim/`) → **Processed Features** (`data/processed/`)
2. **Feature Engineering**: Combines lag/rolling features, calendar dimensions, and weather data
3. **Model Training**: LightGBM with time-series cross-validation
4. **Prediction Pipeline**: Batch forecasts (daily) + real-time nowcasting

### Backend Architecture (FastAPI)
- **Main App**: `src/api/main.py` - Handles model loading, CORS, and router registration
- **Database Models**: `src/api/models.py` - SQLAlchemy models for transport lines, forecasts, and job tracking
- **API Routers**:
  - `routers/forecast.py` - Pre-calculated 24h forecasts
  - `routers/nowcast.py` - Real-time weather nowcasting
  - `routers/lines.py` - Transport line metadata
  - `routers/admin.py` - Admin operations
- **Feature Store**: `services/store.py` - Polars-based feature retrieval with lag calculation strategies
- **Database**: PostgreSQL with auto-initialization from `transport_meta.parquet`

### Frontend Architecture (Next.js)
- **App Router**: `/app` directory with pages for forecast, admin, settings
- **Components**:
  - `map/` - Leaflet-based interactive maps
  - `ui/` - Reusable UI components (charts, search, navigation)
- **State Management**: Zustand store (`store/useAppStore.js`)
- **Styling**: Tailwind CSS with custom design system
- **PWA**: Progressive Web App capabilities with offline support

### ML Pipeline Architecture
- **Data Preparation**: Polars-based ETL in `src/data_prep/`
- **Feature Engineering**: Time-based features, weather integration, lag/rolling windows in `src/features/`
- **Modeling**: LightGBM with hyperparameter configs in `src/model/config/`
- **Evaluation**: SHAP analysis, baseline comparisons, time-series metrics

## Key Design Patterns

### Model Deployment
- **Global Model**: Single LightGBM model handles all transport lines via categorical encoding
- **Feature Store**: Smart lag retrieval using seasonal matching (same month/day) with fallbacks
- **Crowd Level Calculation**: Combines percentile ranking and peak index for interpretable scoring

### Data Processing
- **Time Series Handling**: Europe/Istanbul timezone with proper lag feature calculation
- **Outlier Management**: Winsorization by transport line to handle anomalies
- **Missing Data**: Forward-fill strategy for weather data gaps

### API Design
- **Caching Strategy**: Redis integration ready for high-frequency predictions
- **Error Handling**: Global exception handling with proper HTTP status codes
- **Database Connection**: Connection pooling with health checks

## Testing and Quality

### Run Tests
- **Backend tests**: Not yet implemented - add pytest configuration
- **Frontend tests**: Not yet implemented - add Jest/Testing Library setup
- **Data quality checks**: `python src/features/check_features_quality.py`

### Model Validation
- **Cross-validation**: Time series split with multiple horizons (1h, 6h, 12h, 24h)
- **Baseline comparison**: Lag-based and moving average baselines
- **Error analysis**: Hour-of-day and line-specific performance metrics

## Important File Paths

### Configuration
- **Model configs**: `src/model/config/v*.yaml` - LightGBM hyperparameters
- **Frontend config**: `frontend/next.config.js` - Next.js and PWA settings
- **Docker**: `docker-compose.yml` - Full stack deployment

### Data Files
- **Models**: `models/lgbm_transport_v*.txt` - Trained LightGBM models
- **Features**: `data/processed/features_pl.parquet` - Ready-to-use feature set
- **Metadata**: `data/processed/transport_meta.parquet` - Line information
- **Reports**: `reports/` - Model evaluation reports and visualizations

### Key Components
- **Model Loading**: `src/api/state.py` - Global application state
- **Database Init**: `src/api/utils/init_db.py` - Auto-population logic
- **Weather Service**: `src/api/services/weather.py` - Open-Meteo integration
- **Batch Processing**: `src/api/services/batch_forecast.py` - Daily prediction jobs

## Development Guidelines

### Adding New Features
1. **API endpoints**: Add new routers in `src/api/routers/` and register in `main.py`
2. **Database changes**: Update models in `models.py` and handle migrations
3. **Frontend pages**: Use App Router convention in `frontend/src/app/`
4. **Components**: Follow existing patterns in `frontend/src/components/`

### Model Updates
1. **New model versions**: Increment version in config files and update model path in `main.py`
2. **Feature changes**: Regenerate feature sets and update Feature Store schema
3. **Evaluation**: Run full evaluation pipeline and update reports

### Common Issues
- **Model loading errors**: Ensure model files exist in `models/` directory
- **Database connection**: Verify PostgreSQL is running and `.env` file is configured
- **Frontend build**: Check Node.js version compatibility (requires Node 16+)
- **CORS issues**: Verify frontend URL is in allowed origins list