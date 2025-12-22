from sqlalchemy import Column, Integer, String, Date, Float, UniqueConstraint, DateTime, Text, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class ReportType(enum.Enum):
    """Report type enumeration"""
    bug = "bug"
    data = "data"
    feature = "feature"

class TransportLine(Base):
    __tablename__ = "transport_lines"

    line_name = Column(String, primary_key=True, index=True)
    transport_type_id = Column(Integer)
    road_type = Column(String)
    line = Column(String)

class DailyForecast(Base):
    __tablename__ = "daily_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    line_name = Column(String, index=True, nullable=False)
    date = Column(Date, nullable=False)
    hour = Column(Integer, nullable=False)
    predicted_value = Column(Float, nullable=False)
    occupancy_pct = Column(Integer, nullable=False)
    crowd_level = Column(String, nullable=False)
    max_capacity = Column(Integer, nullable=False)
    trips_per_hour = Column(Integer, nullable=True)
    vehicle_capacity = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint('line_name', 'date', 'hour', name='_line_date_hour_uc'),
    )

class JobExecution(Base):
    """Tracks the execution history of batch jobs."""
    __tablename__ = "job_executions"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String, default="daily_forecast")
    target_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    records_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    job_metadata = Column(JSON, nullable=True)

class AdminUser(Base):
    """Admin users for accessing the admin panel."""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

class UserReport(Base):
    """User reports for bug reports, data issues, and feature requests."""
    __tablename__ = "user_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(SQLEnum(ReportType), nullable=False, index=True)
    line_code = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=False)
    contact_email = Column(String, nullable=True)
    status = Column(String, default="new", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MetroScheduleCache(Base):
    """Daily snapshot of Metro Istanbul timetables per station/direction."""
    __tablename__ = "metro_schedules"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, nullable=False, index=True)
    direction_id = Column(Integer, nullable=False, index=True)
    line_code = Column(String, nullable=True, index=True)
    station_name = Column(String, nullable=True)
    direction_name = Column(String, nullable=True)
    valid_for = Column(Date, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source_status = Column(String, nullable=False, default="SUCCESS")
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint('station_id', 'direction_id', 'valid_for', name='uq_station_direction_valid_date'),
    )


class BusScheduleCache(Base):
    """Daily snapshot of IETT planned bus schedules per line."""
    __tablename__ = "bus_schedules"

    id = Column(Integer, primary_key=True, index=True)
    line_code = Column(String, nullable=False, index=True)
    valid_for = Column(Date, nullable=False, index=True)
    day_type = Column(String(1), nullable=False, index=True)  # I/C/P
    payload = Column(JSON, nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source_status = Column(String, nullable=False, default="SUCCESS")
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint('line_code', 'valid_for', 'day_type', name='uq_bus_line_valid_day_type'),
    )
