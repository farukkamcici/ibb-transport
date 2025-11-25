import httpx
import os
import logging
import time
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_fixed, RetryError

logger = logging.getLogger(__name__)

WEATHER_API_URL = os.getenv("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast")

FALLBACK_WEATHER_DATA = {
    "temperature_2m": 15.0,
    "precipitation": 0.0,
    "wind_speed_10m": 5.0,
}


# --- SYNC VERSION FOR BATCH JOBS ---
def fetch_daily_weather_data_sync(date: str, lat: float, lon: float) -> dict:
    """
    Synchronous version of weather fetching to avoid asyncio loop conflicts
    in background tasks. Includes manual retry logic.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation,wind_speed_10m",
        "start_date": date,
        "end_date": date,
        "timezone": "Europe/Istanbul"
    }

    # Manual Retry Loop (Simple & Robust)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(f"Fetching weather (Sync) for {date}, attempt {attempt + 1}...")
            with httpx.Client(timeout=10.0) as client:
                response = client.get(WEATHER_API_URL, params=params)
                response.raise_for_status()
                data = response.json()

                return _process_weather_response(data)  # Success!

        except Exception as e:
            logger.warning(f"Weather fetch failed (Attempt {attempt + 1}): {e}")
            time.sleep(2)  # Wait before retry

    # If we reach here, all retries failed. Return Fallback.
    logger.error("All weather retries failed. Using FALLBACK data.")
    return {hour: FALLBACK_WEATHER_DATA for hour in range(24)}


# --- HELPER ---
def _process_weather_response(data: dict) -> dict:
    """Helper to parse Open-Meteo JSON response."""
    if 'hourly' not in data:
        raise ValueError("Invalid API response")

    hourly_data = data['hourly']
    forecasts = {}
    for i, time_str in enumerate(hourly_data['time']):
        h = datetime.fromisoformat(time_str).hour
        forecasts[h] = {
            "temperature_2m": hourly_data['temperature_2m'][i],
            "precipitation": hourly_data['precipitation'][i],
            "wind_speed_10m": hourly_data['wind_speed_10m'][i],
        }
    return forecasts


# --- ASYNC VERSION (Optional/Legacy) ---
async def fetch_weather_forecast(date: str, hour: int, lat: float, lon: float):
    pass