from pydantic import BaseModel

class UserPredictionRequest(BaseModel):
    """
    Schema for the request coming from the frontend.
    The backend will handle fetching calendar features, weather, and lags.
    """
    line_name: str
    date: str  # Expects "YYYY-MM-DD" format
    hour: int


class ModelInput(BaseModel):
    """
    The full internal schema required by the LightGBM model.
    This includes user data, weather data, and lag/rolling features.
    """
    # Categorical/Time Features from User + derived
    line_name: str
    hour_of_day: int
    day_of_week: int
    is_weekend: int
    month: int
    season: str
    is_school_term: int
    is_holiday: int
    holiday_win_m1: int
    holiday_win_p1: int

    # Weather Features from Service
    temperature_2m: float
    precipitation: float
    wind_speed_10m: float

    # Lags/Rolling Features (to be fetched from a feature store in the future)
    lag_24h: float
    lag_48h: float
    lag_168h: float
    roll_mean_24h: float
    roll_std_24h: float


class PredictionResponse(BaseModel):
    """
    Standard prediction response.
    """
    prediction: float
    crowd_level: str
