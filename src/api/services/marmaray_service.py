"""
Marmaray Static Schedule Service

Provides trips-per-hour calculations based on static departure schedules.
Uses dual-loop operational model (Outer: Halkalı-Gebze, Inner: Ataköy-Pendik).

Data Source: frontend/public/data/marmaray_static_schedule.json
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class MarmarayService:
    """
    Manages static Marmaray departure schedules and trips-per-hour calculations.
    
    Attributes:
        schedule_data: Loaded JSON schedule data
    """
    
    def __init__(self, schedule_path: Optional[str] = None):
        """
        Initialize Marmaray service.
        
        Args:
            schedule_path: Path to marmaray_static_schedule.json.
                          Defaults to frontend/public/data/marmaray_static_schedule.json
        """
        if schedule_path is None:
            # Default path from project root
            project_root = Path(__file__).parent.parent.parent.parent
            schedule_path = project_root / "frontend" / "public" / "data" / "marmaray_static_schedule.json"
        
        self.schedule_path = Path(schedule_path)
        self.schedule_data: Optional[Dict] = None
        self._load_schedule()
    
    def _load_schedule(self) -> None:
        """Load static schedule from JSON file."""
        try:
            if not self.schedule_path.exists():
                logger.warning(f"Marmaray schedule file not found: {self.schedule_path}")
                self.schedule_data = None
                return
            
            with open(self.schedule_path, 'r', encoding='utf-8') as f:
                self.schedule_data = json.load(f)
            
            logger.info(f"✅ Marmaray static schedule loaded: {self.schedule_path}")
            logger.info(f"   Version: {self.schedule_data.get('version', 'unknown')}")
            
        except Exception as e:
            logger.error(f"Failed to load Marmaray schedule: {e}")
            self.schedule_data = None
    
    def _count_trips_in_hour(self, departure_list: List[str], target_hour: int) -> int:
        """
        Count departures in a specific hour (e.g., 08:00-08:59).
        
        Args:
            departure_list: List of departure times (HH:MM format)
            target_hour: Target hour (0-23)
            
        Returns:
            Number of departures in that hour
        """
        if not departure_list:
            return 0
        
        count = 0
        for departure_time in departure_list:
            try:
                hour = int(departure_time.split(':')[0])
                if hour == target_hour:
                    count += 1
            except (ValueError, IndexError):
                logger.warning(f"Invalid departure time format: {departure_time}")
                continue
        
        return count
    
    def get_trips_per_hour(self, hour: int, is_weekend: bool = False) -> int:
        """
        Calculate total trips per hour across all 4 terminals.
        
        This sums departures from:
        - Halkalı → Gebze (Outer loop)
        - Ataköy → Gebze (Inner loop)
        - Gebze → Halkalı (Outer loop)
        - Pendik → Halkalı (Inner loop)
        
        Args:
            hour: Target hour (0-23)
            is_weekend: True for Friday/Saturday night extended hours
            
        Returns:
            Total number of departures in that hour
            
        Example:
            >>> service.get_trips_per_hour(8, is_weekend=False)
            24  # Peak hour with both loops running
            
            >>> service.get_trips_per_hour(22, is_weekend=False)
            8   # Late evening, inner loop closed (only outer running)
        """
        if not self.schedule_data:
            logger.warning("Marmaray schedule not loaded, returning 0 trips")
            return 0
        
        if not (0 <= hour <= 23):
            logger.warning(f"Invalid hour: {hour}, must be 0-23")
            return 0
        
        day_type = "weekend" if is_weekend else "weekday"
        departures = self.schedule_data.get("departures", {})
        
        try:
            # Count trips from all 4 terminals
            halkali_trips = self._count_trips_in_hour(
                departures.get("to_gebze", {}).get("halkali", {}).get(day_type, []),
                hour
            )
            atakoy_trips = self._count_trips_in_hour(
                departures.get("to_gebze", {}).get("atakoy", {}).get(day_type, []),
                hour
            )
            gebze_trips = self._count_trips_in_hour(
                departures.get("to_halkali", {}).get("gebze", {}).get(day_type, []),
                hour
            )
            pendik_trips = self._count_trips_in_hour(
                departures.get("to_halkali", {}).get("pendik", {}).get(day_type, []),
                hour
            )
            
            total = halkali_trips + atakoy_trips + gebze_trips + pendik_trips
            
            return total
            
        except Exception as e:
            logger.error(f"Error calculating trips for hour {hour}: {e}")
            return 0
    
    def get_all_trips_per_hour(self, is_weekend: bool = False) -> List[int]:
        """
        Get trips-per-hour for all 24 hours.
        
        Args:
            is_weekend: True for Friday/Saturday night extended hours
            
        Returns:
            List of 24 integers, one per hour
            
        Example:
            >>> service.get_all_trips_per_hour(is_weekend=False)
            [0, 0, 0, 0, 0, 8, 24, 24, 24, ..., 8, 4, 0]
        """
        return [self.get_trips_per_hour(hour, is_weekend) for hour in range(24)]
    
    def get_operating_hours(self, is_weekend: bool = False) -> Dict[str, Dict[str, str]]:
        """
        Get operating hours for outer and inner loops.
        
        Args:
            is_weekend: True for Friday/Saturday night extended hours
            
        Returns:
            Dict with first/last times for each loop
        """
        if not self.schedule_data:
            return {}
        
        day_type = "weekend" if is_weekend else "weekday"
        return self.schedule_data.get("operating_hours", {}).get(day_type, {})
    
    def get_vehicle_capacity_info(self) -> Dict:
        """
        Get vehicle capacity information.
        
        Returns:
            Dict with capacity details (ten_car, five_car, average, mix_ratio)
        """
        if not self.schedule_data:
            return {"average": 2500}
        
        return self.schedule_data.get("vehicle_capacity", {"average": 2500})
    
    def reload_schedule(self) -> bool:
        """
        Reload schedule from disk (useful for admin endpoints).
        
        Returns:
            True if reload successful, False otherwise
        """
        try:
            self._load_schedule()
            return self.schedule_data is not None
        except Exception as e:
            logger.error(f"Failed to reload Marmaray schedule: {e}")
            return False


# Singleton instance
marmaray_service = MarmarayService()