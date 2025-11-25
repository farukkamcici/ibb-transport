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





# --- NOWCAST ---


FALLBACK_NOWCAST_DATA = {


    "temperature_2m": 15.0,


    "precipitation": 0.0,


    "wind_speed_10m": 5.0,


}





def fetch_nowcast_weather_data_sync(lat: float, lon: float) -> dict:


    """


    Synchronous version of weather fetching for nowcasting (15-minute intervals).


    """


    params = {


        "latitude": lat,


        "longitude": lon,


        "minutely_15": "temperature_2m,precipitation,wind_speed_10m",


        "forecast_days": 1,


        "timezone": "Europe/Istanbul"


    }





    max_retries = 3


    for attempt in range(max_retries):


        try:


            logger.info(f"Fetching nowcast weather (Sync), attempt {attempt + 1}...")


            with httpx.Client(timeout=10.0) as client:


                response = client.get(WEATHER_API_URL, params=params)


                response.raise_for_status()


                data = response.json()


                return _process_nowcast_response(data)





        except Exception as e:


            logger.warning(f"Nowcast weather fetch failed (Attempt {attempt + 1}): {e}")


            time.sleep(2)





    logger.error("All nowcast weather retries failed. Using FALLBACK data.")


    return {f"T+{i*15}": FALLBACK_NOWCAST_DATA for i in range(4)} # Fallback for next hour





def _process_nowcast_response(data: dict) -> dict:


    """Helper to parse Open-Meteo 15-minute interval response."""


    if 'minutely_15' not in data:


        raise ValueError("Invalid API response for nowcast")





    nowcast_data = data['minutely_15']


    forecasts = {}


    for i, time_str in enumerate(nowcast_data['time']):


        # Get the time difference from now in minutes


        time_diff = (datetime.fromisoformat(time_str) - datetime.now()).total_seconds() / 60


        # Round to nearest 15 minutes


        time_key = f"T+{round(time_diff / 15) * 15}"


        forecasts[time_key] = {


            "temperature_2m": nowcast_data['temperature_2m'][i],


            "precipitation": nowcast_data['precipitation'][i],


            "wind_speed_10m": nowcast_data['wind_speed_10m'][i],


        }


    return forecasts





# --- ASYNC VERSION (Optional/Legacy) ---


async def fetch_weather_forecast(date: str, hour: int, lat: float, lon: float):


    pass

