from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class ReportTypeEnum(str, Enum):
    """Report type enumeration for API"""
    bug = "bug"
    data = "data"
    feature = "feature"

class ReportCreate(BaseModel):
    """Schema for creating a new user report"""
    report_type: ReportTypeEnum
    line_code: Optional[str] = None
    description: str = Field(..., min_length=10, max_length=2000)
    contact_email: Optional[EmailStr] = None

class ReportUpdate(BaseModel):
    """Schema for updating report status"""
    status: str = Field(..., pattern="^(new|in_progress|resolved|closed)$")

class ReportResponse(BaseModel):
    """Schema for report response (admin view)"""
    id: int
    report_type: str
    line_code: Optional[str]
    description: str
    contact_email: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

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
