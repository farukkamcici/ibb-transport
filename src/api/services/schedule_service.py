"""
IETT Planned Schedule Service.

Fetches bus schedules from IETT API and caches them for efficient access.
Filters schedules by day type (weekday/Saturday/Sunday).

Author: Backend Team
Date: 2025-12-02
"""

import requests
import logging
from datetime import datetime, time
from typing import Dict, List, Optional
from cachetools import TTLCache
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

# Cache schedules for 24 hours (86400 seconds)
# Key: line_code_date, Value: {'G': [...], 'D': [...]}
_schedule_cache = TTLCache(maxsize=1000, ttl=86400)


class IETTScheduleService:
    """
    Service for fetching and caching IETT bus schedules.
    """
    
    IETT_API_URL = "https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx/GetPlanlananSeferSaati_json"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; IBB-Transport-Platform/1.0)',
            'Accept': 'application/json'
        })
    
    def _get_day_type(self) -> str:
        """
        Determine day type based on current day of week.
        
        Returns:
            "I" for weekdays (Monday-Friday)
            "C" for Saturday
            "P" for Sunday
        """
        weekday = datetime.now().weekday()
        
        if weekday == 6:  # Sunday
            return "P"
        elif weekday == 5:  # Saturday
            return "C"
        else:  # Monday-Friday
            return "I"
    
    def _parse_time(self, time_str: str) -> Optional[time]:
        """
        Parse time string to time object for sorting.
        
        Args:
            time_str: Time string in various formats (e.g., "06:00", "6:0", "06:00:00")
            
        Returns:
            time object or None if parsing fails
        """
        try:
            # Try common formats
            for fmt in ["%H:%M", "%H:%M:%S", "%I:%M %p"]:
                try:
                    return datetime.strptime(time_str.strip(), fmt).time()
                except ValueError:
                    continue
            
            # Try parsing manually for edge cases
            parts = time_str.strip().split(':')
            if len(parts) >= 2:
                hour = int(parts[0])
                minute = int(parts[1])
                return time(hour=hour, minute=minute)
                
        except Exception as e:
            logger.warning(f"Failed to parse time '{time_str}': {e}")
        
        return None
    
    def _fetch_from_iett(self, line_code: str) -> Optional[List[Dict]]:
        """
        Fetch schedule data from IETT API.
        
        Args:
            line_code: Bus line code (e.g., "15F")
            
        Returns:
            List of schedule records or None if request fails
        """
        try:
            # Try JSON endpoint first
            params = {'HatKodu': line_code}
            response = self.session.get(
                self.IETT_API_URL,
                params=params,
                timeout=10
            )
            response.raise_for_status()
            
            data = response.json()
            
            # IETT API returns nested structure
            if isinstance(data, dict):
                # Try common response structures
                schedule_data = (
                    data.get('GetPlanlananSeferSaati_jsonResult') or
                    data.get('d') or
                    data.get('data') or
                    data
                )
            else:
                schedule_data = data
            
            # Ensure it's a list
            if not isinstance(schedule_data, list):
                logger.warning(f"Unexpected response format for line {line_code}")
                return None
            
            return schedule_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch schedule for line {line_code}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching schedule for line {line_code}: {e}")
            return None
    
    def get_schedule(self, line_code: str) -> Dict[str, List[str]]:
        """
        Get filtered and sorted schedule for a bus line.
        
        Args:
            line_code: Bus line code (e.g., "15F")
            
        Returns:
            Dictionary with directions as keys and sorted time lists as values
            Example: {"G": ["06:00", "06:20", ...], "D": ["07:00", "07:30", ...]}
        """
        # Check cache first
        cache_key = f"{line_code}_{datetime.now().strftime('%Y-%m-%d')}"
        if cache_key in _schedule_cache:
            logger.debug(f"Cache hit for schedule: {line_code}")
            return _schedule_cache[cache_key]
        
        logger.info(f"Fetching schedule for line {line_code} from IETT API")
        
        # Fetch from API
        raw_data = self._fetch_from_iett(line_code)
        if not raw_data:
            logger.warning(f"No schedule data available for line {line_code}")
            return {"G": [], "D": []}
        
        # Get today's day type
        day_type = self._get_day_type()
        logger.debug(f"Filtering for day type: {day_type}")
        
        # Filter and organize by direction
        schedules_by_direction = {"G": [], "D": []}
        
        for record in raw_data:
            try:
                # Extract fields (handle different field name cases)
                schedule_day_type = record.get('SGUNTIPI') or record.get('sguntipi') or record.get('GunTipi')
                direction = record.get('SYON') or record.get('syon') or record.get('Yon')
                time_str = record.get('DT') or record.get('dt') or record.get('Saat')
                
                # Skip if missing required fields
                if not all([schedule_day_type, direction, time_str]):
                    continue
                
                # Filter by day type
                if schedule_day_type != day_type:
                    continue
                
                # Add to appropriate direction
                if direction in schedules_by_direction:
                    schedules_by_direction[direction].append(time_str)
                    
            except Exception as e:
                logger.warning(f"Error processing schedule record: {e}")
                continue
        
        # Sort times chronologically
        for direction in schedules_by_direction:
            times = schedules_by_direction[direction]
            
            # Parse times for sorting
            parsed_times = []
            for time_str in times:
                parsed = self._parse_time(time_str)
                if parsed:
                    parsed_times.append((parsed, time_str))
            
            # Sort and extract original strings
            parsed_times.sort(key=lambda x: x[0])
            schedules_by_direction[direction] = [time_str for _, time_str in parsed_times]
        
        # Cache result
        _schedule_cache[cache_key] = schedules_by_direction
        
        logger.info(
            f"Schedule fetched for line {line_code}: "
            f"G={len(schedules_by_direction['G'])} trips, "
            f"D={len(schedules_by_direction['D'])} trips"
        )
        
        return schedules_by_direction
    
    def clear_cache(self, line_code: Optional[str] = None):
        """
        Clear schedule cache.
        
        Args:
            line_code: If provided, clear only this line's cache. Otherwise clear all.
        """
        if line_code:
            cache_key = f"{line_code}_{datetime.now().strftime('%Y-%m-%d')}"
            _schedule_cache.pop(cache_key, None)
            logger.info(f"Cleared cache for line {line_code}")
        else:
            _schedule_cache.clear()
            logger.info("Cleared all schedule cache")
    
    def get_cache_stats(self) -> Dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache size and hit rate info
        """
        return {
            "cache_size": len(_schedule_cache),
            "max_size": _schedule_cache.maxsize,
            "ttl_seconds": _schedule_cache.ttl
        }


# Global singleton instance
schedule_service = IETTScheduleService()
