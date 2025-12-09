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


# ============================================================================
# METRO ISTANBUL API SCHEMAS
# ============================================================================

class MetroError(BaseModel):
    """Error model for Metro API responses."""
    Code: Optional[str] = None
    Message: Optional[str] = None


class MetroAPIResponse(BaseModel):
    """Base response wrapper for all Metro API calls."""
    Success: bool
    Error: Optional[MetroError] = None


class StationDetailInfo(BaseModel):
    """Station accessibility and location details."""
    Escolator: Optional[int] = Field(None, description="Number of escalators (typo in API)")
    Lift: Optional[int] = Field(None, description="Number of elevators/lifts")
    BabyRoom: bool = Field(False, description="Baby care room available")
    WC: bool = Field(False, description="Restroom available")
    Masjid: bool = Field(False, description="Prayer room available")
    Latitude: str = Field(..., description="Station latitude (string format)")
    Longitude: str = Field(..., description="Station longitude (string format)")


class Station(BaseModel):
    """Metro station information."""
    Id: int = Field(..., description="Unique station ID (required for TimeTable API)")
    Name: str = Field(..., description="Station name (uppercase)")
    LineId: int = Field(..., description="Parent line ID")
    LineName: str = Field(..., description="Line code (e.g., M1A, M2)")
    Description: str = Field(..., description="Localized station name")
    Order: int = Field(..., description="Station sequence on the line")
    IsActive: Optional[bool] = None
    FunctionalCode: str = Field(..., description="Internal metro system code")
    DetailInfo: StationDetailInfo


class Line(BaseModel):
    """Metro line information."""
    Id: int = Field(..., description="Unique line ID")
    Name: str = Field(..., description="Line code (M1A, M2, etc.)")
    Description: Optional[str] = None
    Color: Optional[str] = Field(None, description="Hex color code for map rendering")
    IsActive: bool = True


class LineDirection(BaseModel):
    """Direction information for a metro line."""
    Id: int = Field(..., description="Direction ID (required for TimeTable)")
    Name: str = Field(..., description="Direction name (e.g., 'Havalimanı İstikameti')")
    LineId: int
    StationId: Optional[int] = Field(None, description="Associated station ID")


class StationListResponse(MetroAPIResponse):
    """Response for GetStationById and GetStations."""
    Data: Optional[list[Station]] = None


class LineListResponse(MetroAPIResponse):
    """Response for GetLines."""
    Data: Optional[list[Line]] = None


class DirectionListResponse(MetroAPIResponse):
    """Response for GetDirections and GetDirectionById."""
    Data: Optional[list[LineDirection]] = None


class TimeTableRequest(BaseModel):
    """Request model for GetTimeTable and GetStationBetweenTime."""
    BoardingStationId: int = Field(..., description="Station ID from topology")
    DirectionId: int = Field(..., description="Direction ID from topology")
    DateTime: datetime = Field(default_factory=datetime.now, description="Query timestamp")


class TrainArrival(BaseModel):
    """Individual train arrival information."""
    TrainId: Optional[str] = None
    DestinationStationName: Optional[str] = None
    RemainingMinutes: Optional[int] = Field(None, description="Minutes until arrival")
    ArrivalTime: Optional[str] = Field(None, description="Formatted arrival time")
    IsCrowded: Optional[bool] = Field(None, description="Crowding indicator")


class TimeTableResponse(MetroAPIResponse):
    """Response for GetTimeTable."""
    Data: Optional[list[TrainArrival]] = None


class StationDistance(BaseModel):
    """Travel time between stations."""
    FromStationId: int
    ToStationId: int
    FromStationName: str
    ToStationName: str
    DurationMinutes: int = Field(..., description="Travel time in minutes")


class StationDistanceResponse(MetroAPIResponse):
    """Response for GetStationBetweenTime."""
    Data: Optional[list[StationDistance]] = None


class ServiceStatus(BaseModel):
    """Operational status for a metro line."""
    LineCode: str = Field(..., description="Line code (M1A, M2, etc.)")
    LineName: str
    Status: str = Field(..., description="ACTIVE, OUT_OF_SERVICE, DISRUPTED")
    LastUpdateTime: Optional[datetime] = None


class Announcement(BaseModel):
    """Service announcement/alert for a line."""
    Id: int
    LineCode: str
    Title: str
    Message: str
    PublishDate: datetime
    Language: str = Field("TR", description="TR, EN, AR")
    Priority: Optional[str] = Field(None, description="HIGH, MEDIUM, LOW")


class ServiceStatusResponse(MetroAPIResponse):
    """Response for GetServiceStatuses."""
    Data: Optional[list[ServiceStatus]] = None


class AnnouncementRequest(BaseModel):
    """Request for GetAnnouncementsByLine."""
    Language: str = Field("TR", description="TR, EN, AR")
    Line: str = Field(..., description="M1, M2, M3, M1A, M1B, TF1, TF2")


class AnnouncementResponse(MetroAPIResponse):
    """Response for GetAnnouncementsByLine."""
    Data: Optional[list[Announcement]] = None


class DirectionRequest(BaseModel):
    """Request for GetDirectionsByLineIdAndStationId."""
    LineId: int
    StationId: int


class NetworkStatusLine(BaseModel):
    """Aggregated line status for frontend consumption."""
    line_code: str
    line_name: str
    status: str
    alerts: list[Announcement] = []
    last_updated: datetime


class NetworkStatusResponse(BaseModel):
    """Aggregated network status (combines status + announcements)."""
    lines: dict[str, NetworkStatusLine]
    fetched_at: datetime
