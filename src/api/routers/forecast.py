from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from typing import List
from ..db import get_db
from ..models import DailyForecast
from pydantic import BaseModel

router = APIRouter()

class HourlyForecastResponse(BaseModel):
    hour: int
    predicted_value: float
    occupancy_pct: int
    crowd_level: str
    max_capacity: int

@router.get("/forecast/{line_name}", response_model=List[HourlyForecastResponse])
def get_daily_forecast(line_name: str, target_date: date, db: Session = Depends(get_db)):
    """
    Retrieves the pre-calculated 24-hour forecast for a specific line and date.
    """
    forecasts = db.query(DailyForecast).filter(
        DailyForecast.line_name == line_name,
        DailyForecast.date == target_date
    ).order_by(DailyForecast.hour).all()

    if not forecasts:
        raise HTTPException(
            status_code=404, 
            detail=f"No forecast found for line '{line_name}' on date '{target_date}'. Please run the batch job."
        )
        
    return forecasts
