from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time as datetime_time
from typing import List, Optional
import logging
from ..db import get_db
from ..models import DailyForecast, TransportLine
from ..services.schedule_service import schedule_service
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_time(time_str: str) -> Optional[datetime_time]:
    """
    Parse time string to time object.
    
    Args:
        time_str: Time string (e.g., "06:00", "23:30")
        
    Returns:
        time object or None if parsing fails
    """
    try:
        parts = time_str.strip().split(':')
        if len(parts) >= 2:
            hour = int(parts[0])
            minute = int(parts[1])
            return datetime_time(hour=hour, minute=minute)
    except Exception as e:
        logger.warning(f"Failed to parse time '{time_str}': {e}")
    return None


def _get_service_hours(line_code: str, direction: Optional[str] = None) -> Optional[tuple]:
    """
    Get service hours (first and last departure) for a line.
    
    Args:
        line_code: Line code
        direction: Optional direction ('G' or 'D'). If None, uses combined schedule.
        
    Returns:
        Tuple of (first_hour, last_hour) as integers, or None if no schedule available
    """
    try:
        schedule = schedule_service.get_schedule(line_code)
        
        # Collect times from specified direction(s)
        all_times = []
        directions_to_check = [direction] if direction else ['G', 'D']
        
        for dir_code in directions_to_check:
            times = schedule.get(dir_code, [])
            for time_str in times:
                parsed = _parse_time(time_str)
                if parsed:
                    all_times.append(parsed)
        
        if not all_times:
            logger.warning(f"No schedule data available for line {line_code}")
            return None
        
        # Sort and get first/last hours
        all_times.sort()
        first_hour = all_times[0].hour
        last_hour = all_times[-1].hour
        
        logger.debug(f"Service hours for {line_code} direction {direction}: {first_hour}:00 - {last_hour}:00")
        return (first_hour, last_hour)
        
    except Exception as e:
        logger.error(f"Error getting service hours for {line_code}: {e}")
        return None


def _is_hour_in_service(hour: int, service_hours: Optional[tuple]) -> bool:
    """
    Check if a given hour is within service hours.
    
    Includes +1 hour buffer after last departure to account for vehicles in transit.
    
    Args:
        hour: Hour to check (0-23)
        service_hours: Tuple of (first_hour, last_hour) or None
        
    Returns:
        True if in service, False otherwise
    """
    if service_hours is None:
        # No schedule data - assume in service (benefit of doubt)
        return True
    
    first_hour, last_hour = service_hours
    # Add +1 hour buffer after last departure for vehicles in transit
    extended_last_hour = min(23, last_hour + 1)
    return first_hour <= hour <= extended_last_hour

class HourlyForecastResponse(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    predicted_value: Optional[float] = Field(None, ge=0, description="Predicted passenger count (null if out of service)")
    occupancy_pct: Optional[int] = Field(None, ge=0, le=100, description="Occupancy percentage (null if out of service)")
    crowd_level: str = Field(..., description="Crowd level: Low, Medium, High, Very High, or Out of Service")
    max_capacity: int = Field(..., gt=0, description="Maximum line capacity")
    in_service: bool = Field(..., description="Whether the line is in service during this hour")

    class Config:
        json_schema_extra = {
            "example": {
                "hour": 8,
                "predicted_value": 65827.69,
                "occupancy_pct": 70,
                "crowd_level": "High",
                "max_capacity": 94091,
                "in_service": True
            }
        }

@router.get("/forecast/{line_name}", response_model=List[HourlyForecastResponse])
def get_daily_forecast(
    line_name: str,
    target_date: date = Query(..., description="Target date in YYYY-MM-DD format"),
    direction: Optional[str] = Query(None, description="Direction filter: 'G' (Outbound) or 'D' (Inbound). If provided, marks out-of-service hours based on that direction's schedule."),
    db: Session = Depends(get_db)
):
    """
    Retrieves the pre-calculated 24-hour forecast for a specific line and date.
    
    Marks hours as out-of-service based on the line's schedule. If direction is specified,
    uses only that direction's schedule; otherwise uses combined schedule from both directions.
    
    Args:
        line_name: Transport line identifier (e.g., '34', 'M2', '500T')
        target_date: Date for the forecast (YYYY-MM-DD)
        direction: Optional direction filter ('G' or 'D')
    
    Returns:
        List of 24 hourly forecasts with crowd levels and predictions.
        Hours outside service times will have null predicted_value/occupancy_pct and in_service=False.
    
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
        
        # Get service hours from schedule to mark out-of-service hours
        service_hours = _get_service_hours(line_name, direction)
        
        # Process forecasts to mark out-of-service hours
        processed_forecasts = []
        for forecast in forecasts:
            hour = forecast.hour
            in_service = _is_hour_in_service(hour, service_hours)
            
            if in_service:
                # Normal forecast data
                processed_forecasts.append({
                    "hour": hour,
                    "predicted_value": forecast.predicted_value,
                    "occupancy_pct": forecast.occupancy_pct,
                    "crowd_level": forecast.crowd_level,
                    "max_capacity": forecast.max_capacity,
                    "in_service": True
                })
            else:
                # Out of service - null the prediction values
                processed_forecasts.append({
                    "hour": hour,
                    "predicted_value": None,
                    "occupancy_pct": None,
                    "crowd_level": "Out of Service",
                    "max_capacity": forecast.max_capacity,
                    "in_service": False
                })
        
        return processed_forecasts
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching forecast for {line_name} on {target_date}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching the forecast. Please try again later."
        )
