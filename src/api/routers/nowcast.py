from fastapi import APIRouter, HTTPException
from src.api.services.weather import fetch_nowcast_weather_data_sync

router = APIRouter()

@router.get("/nowcast", tags=["Nowcast"])
def get_nowcast(lat: float = 41.0082, lon: float = 28.9784):
    """
    Get 15-minute interval weather nowcast for the next hour.
    """
    try:
        nowcast_data = fetch_nowcast_weather_data_sync(lat, lon)
        return nowcast_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
