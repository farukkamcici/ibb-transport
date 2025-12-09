"""
Metro Istanbul API Models.

Pydantic models for Metro Istanbul Mobile API v2 responses.
Used for static topology ingestion and dynamic real-time data.

Author: Backend Team
Date: 2025-12-08
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============================================================================
# COMMON MODELS
# ============================================================================

class MetroError(BaseModel):
    """Error model for Metro API responses."""
    Code: Optional[str] = None
    Message: Optional[str] = None


class MetroAPIResponse(BaseModel):
    """Base response wrapper for all Metro API calls."""
    Success: bool
    Error: Optional[MetroError] = None


# ============================================================================
# STATION & LINE TOPOLOGY MODELS (STATIC DATA)
# ============================================================================

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


# ============================================================================
# API RESPONSE WRAPPERS
# ============================================================================

class StationListResponse(MetroAPIResponse):
    """Response for GetStationById and GetStations."""
    Data: Optional[List[Station]] = None


class LineListResponse(MetroAPIResponse):
    """Response for GetLines."""
    Data: Optional[List[Line]] = None


class DirectionListResponse(MetroAPIResponse):
    """Response for GetDirections and GetDirectionById."""
    Data: Optional[List[LineDirection]] = None


# ============================================================================
# REAL-TIME SCHEDULE MODELS (DYNAMIC DATA)
# ============================================================================

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
    Data: Optional[List[TrainArrival]] = None


# ============================================================================
# STATION DISTANCE/DURATION MODELS
# ============================================================================

class StationDistance(BaseModel):
    """Travel time between stations."""
    FromStationId: int
    ToStationId: int
    FromStationName: str
    ToStationName: str
    DurationMinutes: int = Field(..., description="Travel time in minutes")


class StationDistanceResponse(MetroAPIResponse):
    """Response for GetStationBetweenTime."""
    Data: Optional[List[StationDistance]] = None


# ============================================================================
# SERVICE STATUS & ANNOUNCEMENTS (ALERTS)
# ============================================================================

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
    Data: Optional[List[ServiceStatus]] = None


class AnnouncementRequest(BaseModel):
    """Request for GetAnnouncementsByLine."""
    Language: str = Field("TR", description="TR, EN, AR")
    Line: str = Field(..., description="M1, M2, M3, M1A, M1B, TF1, TF2")


class AnnouncementResponse(MetroAPIResponse):
    """Response for GetAnnouncementsByLine."""
    Data: Optional[List[Announcement]] = None


# ============================================================================
# REQUEST MODELS FOR BACKEND API
# ============================================================================

class DirectionRequest(BaseModel):
    """Request for GetDirectionsByLineIdAndStationId."""
    LineId: int
    StationId: int


# ============================================================================
# AGGREGATED MODELS FOR FRONTEND (BACKEND ENRICHMENT)
# ============================================================================

class NetworkStatusLine(BaseModel):
    """Aggregated line status for frontend consumption."""
    line_code: str
    line_name: str
    status: str  # ACTIVE, OUT_OF_SERVICE, DISRUPTED
    alerts: List[Announcement] = []
    last_updated: datetime


class NetworkStatusResponse(BaseModel):
    """Aggregated network status (combines status + announcements)."""
    lines: dict[str, NetworkStatusLine]
    fetched_at: datetime
