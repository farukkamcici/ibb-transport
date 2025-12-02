from sqlalchemy import Column, Integer, String, Date, Float, UniqueConstraint, DateTime, Text, Enum as SQLEnum
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

    __table_args__ = (
        UniqueConstraint('line_name', 'date', 'hour', name='_line_date_hour_uc'),
    )

class JobExecution(Base):
    """Tracks the execution history of batch jobs."""
    __tablename__ = "job_executions"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String, default="daily_forecast")
    target_date = Column(Date, nullable=True)  # Which date the forecast is for
    status = Column(String) # RUNNING, SUCCESS, FAILED
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    records_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

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