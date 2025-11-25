import pandas as pd
import lightgbm as lgb
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..schemas import UserPredictionRequest, ModelInput, PredictionResponse
from ..services.weather import fetch_weather_forecast
from ..services.store import FeatureStore
from ..db import get_db
from ..models import TransportLine
from ..state import get_model, get_feature_store, COLUMN_ORDER

router = APIRouter()

# Define placeholder coordinates for Istanbul
ISTANBUL_LAT = 41.0082
ISTANBUL_LON = 28.9784

@router.post("/predict", response_model=PredictionResponse)
async def predict(
    request: UserPredictionRequest, 
    db: Session = Depends(get_db), 
    model: lgb.Booster = Depends(get_model),
    store: FeatureStore = Depends(get_feature_store)
):
    # Validate that the line exists in the database
    line = db.query(TransportLine).filter(TransportLine.line_name == request.line_name).first()
    if not line:
        raise HTTPException(status_code=404, detail=f"Line '{request.line_name}' not found.")

    # Step 1: Get Calendar features from the store
    calendar_features = store.get_calendar_features(request.date)
    if not calendar_features:
        raise HTTPException(status_code=404, detail=f"Calendar data not found for date: {request.date}")

    # Step 2: Get Weather from the weather service
    weather_data = await fetch_weather_forecast(
        date=request.date,
        hour=request.hour,
        lat=ISTANBUL_LAT,
        lon=ISTANBUL_LON
    )
    if not weather_data:
        raise HTTPException(status_code=504, detail="Could not fetch live weather data.")

    # Step 3: Get historical lags from the store
    lag_features = store.get_historical_lags(request.line_name, request.hour)

    # Step 4: Combine all data sources into the ModelInput
    try:
        model_input_data = {
            "line_name": request.line_name,
            "hour_of_day": request.hour,
            **calendar_features,
            **weather_data,
            **lag_features,
        }
        model_input = ModelInput(**model_input_data)
    except Exception as e:
        error_detail = {
            "message": f"Failed to construct model input: {e}",
            "received_data": {
                "request": request.model_dump(),
                "calendar_features": calendar_features,
                "weather_data": weather_data,
                "lag_features": lag_features,
            },
            "expected_model_input_keys": list(ModelInput.model_fields.keys())
        }
        raise HTTPException(status_code=400, detail=error_detail)

    # Step 5: Create DataFrame, predict, and post-process
    df = pd.DataFrame([model_input.model_dump()])
    df = df[COLUMN_ORDER]
    df['line_name'] = df['line_name'].astype('category')
    df['season'] = df['season'].astype('category')
    
    prediction_array = model.predict(df)
    final_prediction = max(0, prediction_array[0])

    # Step 6: Get crowd level label from the store
    crowd_level = store.get_crowd_level(request.line_name, final_prediction)
    
    return PredictionResponse(prediction=final_prediction, crowd_level=crowd_level)
