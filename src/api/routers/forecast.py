from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List
import logging
from ..db import get_db
from ..models import DailyForecast, TransportLine
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

class HourlyForecastResponse(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    predicted_value: float = Field(..., ge=0, description="Predicted passenger count")
    occupancy_pct: int = Field(..., ge=0, le=100, description="Occupancy percentage")
    crowd_level: str = Field(..., description="Crowd level: Low, Medium, High, Very High")
    max_capacity: int = Field(..., gt=0, description="Maximum line capacity")

    class Config:
        json_schema_extra = {
            "example": {
                "hour": 8,
                "predicted_value": 65827.69,
                "occupancy_pct": 70,
                "crowd_level": "High",
                "max_capacity": 94091
            }
        }

@router.get("/forecast/{line_name}", response_model=List[HourlyForecastResponse])
def get_daily_forecast(
    line_name: str,
    target_date: date = Query(..., description="Target date in YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    """
    Retrieves the pre-calculated 24-hour forecast for a specific line and date.
    
    Args:
        line_name: Transport line identifier (e.g., '34', 'M2', '500T')
        target_date: Date for the forecast (YYYY-MM-DD)
    
    Returns:
        List of 24 hourly forecasts with crowd levels and predictions
    
    Raises:
        HTTPException 400: Invalid line name or date range
        HTTPException 404: No forecast data available
        HTTPException 500: Server error
    """
    try:
        line_exists = db.query(TransportLine).filter(
            TransportLine.line_name == line_name
        ).first()
        
        if not line_exists:
            logger.warning(f"Forecast requested for non-existent line: {line_name}")
            raise HTTPException(
                status_code=404,
                detail=f"Transport line '{line_name}' not found. Please verify the line name."
            )
        
        max_date = datetime.now().date() + timedelta(days=7)
        if target_date > max_date:
            raise HTTPException(
                status_code=400,
                detail=f"Forecast date cannot be more than 7 days in the future. Requested: {target_date}, Max: {max_date}"
            )
        
        forecasts = db.query(DailyForecast).filter(
            DailyForecast.line_name == line_name,
            DailyForecast.date == target_date
        ).order_by(DailyForecast.hour).all()

        if not forecasts:
            logger.warning(f"No forecast data for line '{line_name}' on {target_date}")
            raise HTTPException(
                status_code=404,
                detail=f"No forecast available for line '{line_name}' on {target_date}. The batch forecast job may need to run."
            )
        
        if len(forecasts) != 24:
            logger.error(f"Incomplete forecast data for line '{line_name}' on {target_date}: {len(forecasts)}/24 hours")
        
        return forecasts
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching forecast for {line_name} on {target_date}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching the forecast. Please try again later."
        )
