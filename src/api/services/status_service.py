"""
Line Status Service - Unified Alerts and Operation Hours.

Combines IETT disruption alerts with schedule-based operation hours
to provide comprehensive line status information.

Author: Backend Team
Date: 2025-12-03
"""

import requests
import logging
import re
import json
from datetime import datetime, time, timedelta
from typing import Dict, Optional, List
from cachetools import TTLCache
import xml.etree.ElementTree as ET
from .schedule_service import schedule_service
from .metro_service import metro_service
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

# Cache status for 5 minutes (300 seconds)
_status_cache = TTLCache(maxsize=500, ttl=300)


class LineStatus:
    """Line status enumeration."""
    ACTIVE = "ACTIVE"
    WARNING = "WARNING"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"


class IETTStatusService:
    """
    Service for determining line operational status.
    Checks both IETT disruption alerts and operating hours.
    """
    
    IETT_ALERTS_URL = "https://api.ibb.gov.tr/iett/UlasimDinamikVeri/Duyurular.asmx"
    
    SOAP_ENVELOPE_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetDuyurular_json xmlns="http://tempuri.org/" />
  </soap:Body>
</soap:Envelope>"""
    
    def __init__(self):
        self.tz = ZoneInfo('Europe/Istanbul')
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/GetDuyurular_json',
            'Origin': 'https://api.ibb.gov.tr',
            'Referer': 'https://api.ibb.gov.tr/iett/UlasimDinamikVeri/Duyurular.asmx',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0'
        })
    
    def _parse_update_time(self, time_str: str) -> Optional[datetime]:
        """
        Parse GUNCELLEME_SAATI field from IETT API.
        
        Format from API: "Kayit Saati: 04:09" or "Kayit Saati: 16:07"
        We extract the time and combine with today's date.
        
        Args:
            time_str: Time string from API
            
        Returns:
            datetime object or None if parsing fails
        """
        try:
            # Extract time from "Kayit Saati: HH:MM" format
            if "Kayit Saati:" in time_str or "Kayıt Saati:" in time_str:
                time_part = time_str.split(":")[-2:]  # Get last two parts ["04", "09"]
                if len(time_part) == 2:
                    hour = int(time_part[0].strip().split()[-1])  # Extract hour
                    minute = int(time_part[1].strip())
                    
                    # Combine with today's date
                    today = datetime.now(self.tz).date()
                    update_time = datetime.combine(today, time(hour=hour, minute=minute))
                    
                    # If time is 04:00 (early morning update), it might be for today
                    # If current time is before 04:00, the update is from yesterday
                    now = datetime.now(self.tz)
                    if now.hour < 4 and hour >= 4:
                        # It's past midnight but before 4am, update is from yesterday
                        update_time = update_time - timedelta(days=1)
                    
                    return update_time
        except Exception as e:
            logger.warning(f"Failed to parse update time '{time_str}': {e}")
        
        return None
    
    def _extract_time_string(self, time_str: str) -> str:
        """
        Extract just the HH:MM time from GUNCELLEME_SAATI field.
        
        Args:
            time_str: Time string from API (e.g., "Kayit Saati: 04:09")
            
        Returns:
            Formatted time string (e.g., "04:09") or empty string if parsing fails
        """
        try:
            # Use regex to extract HH:MM pattern
            match = re.search(r'(\d{1,2}):(\d{2})', time_str)
            if match:
                hour = match.group(1).zfill(2)  # Pad with zero if needed
                minute = match.group(2)
                return f"{hour}:{minute}"
        except Exception:
            pass
        return ""
    
    def _fetch_alerts(self, line_code: str) -> List[Dict]:
        """
        Fetch disruption alerts from IETT API.
        
        GetDuyurular_json returns a JSON string wrapped in XML/SOAP envelope.
        Response format: <GetDuyurular_jsonResult>[{"HATKODU":"10", "MESAJ":"...", ...}, ...]</GetDuyurular_jsonResult>
        
        Only returns alerts from the last 24 hours (based on GUNCELLEME_SAATI).
        
        Response fields: HATKODU, HAT, TIP, GUNCELLEME_SAATI, MESAJ
        
        Args:
            line_code: Line code to check for alerts (e.g., "10", "10B")
            
        Returns:
            List of alert objects with text, time, and type fields
        """
        try:
            soap_body = self.SOAP_ENVELOPE_TEMPLATE
            
            response = self.session.post(
                self.IETT_ALERTS_URL,
                data=soap_body.encode('utf-8'),
                timeout=10
            )
            response.raise_for_status()
            
            # Extract JSON string from XML using regex
            json_match = re.search(r'<GetDuyurular_jsonResult>(.*?)</GetDuyurular_jsonResult>', 
                                   response.text, 
                                   re.DOTALL)
            
            if not json_match:
                logger.warning(f"Could not find GetDuyurular_jsonResult in IETT API response")
                return []
            
            json_string = json_match.group(1).strip()
            alerts_data = json.loads(json_string)
            
            if not isinstance(alerts_data, list):
                logger.error(f"Expected JSON array from IETT API, got {type(alerts_data)}")
                return []
            
            # Collect all alerts for this line
            alerts = []
            now = datetime.now(self.tz)
            cutoff_time = now - timedelta(hours=24)
            
            for item in alerts_data:
                # Extract fields
                hat_code = item.get('HATKODU', '').strip()
                mesaj_text = item.get('MESAJ', '').strip()
                update_time_str = item.get('GUNCELLEME_SAATI', '')
                tip = item.get('TIP', '').strip()
                
                # Exact match on HATKODU (case-insensitive)
                if hat_code.upper() == line_code.upper() and mesaj_text:
                    # Check timestamp - only include alerts from last 24 hours
                    if update_time_str:
                        update_time = self._parse_update_time(update_time_str)
                        
                        if update_time and update_time < cutoff_time:
                            continue
                    
                    # Extract time string for display
                    time_str = self._extract_time_string(update_time_str) if update_time_str else ""
                    
                    alerts.append({
                        "text": mesaj_text,
                        "time": time_str,
                        "type": tip
                    })
            
            if alerts:
                logger.info(f"Found {len(alerts)} active alert(s) for line {line_code}")
            
            return alerts
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch alerts for line {line_code}: {e}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error for alerts: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching alerts: {e}")
            return []
    
    def _parse_time(self, time_str: str) -> Optional[time]:
        """
        Parse time string to time object.
        
        Args:
            time_str: Time string (e.g., "06:00", "23:30")
            
        Returns:
            time object or None if parsing fails
        """
        try:
            parts = time_str.strip().split(':')
            if len(parts) >= 2:
                hour = int(parts[0])
                minute = int(parts[1])
                return time(hour=hour, minute=minute)
        except Exception as e:
            logger.warning(f"Failed to parse time '{time_str}': {e}")
        return None
    
    def _check_operation_hours(self, line_code: str, direction: Optional[str] = None) -> Dict:
        """
        Check if line is currently in operation based on schedule.
        
        Args:
            line_code: Line code to check
            direction: Optional direction ('G' or 'D'). If provided, checks only that direction.
                      If None, checks all directions combined (legacy behavior).
            
        Returns:
            Dictionary with in_operation (bool) and next_service_time (str or None)
        """
        try:
            # Special case: Marmaray - hardcoded service hours (06:00 - 00:00)
            if line_code == 'MARMARAY':
                now = datetime.now(self.tz).time()
                first_service = time(6, 0)
                last_service = time(0, 0)
                
                # Wraps midnight: service from 06:00 to 00:00 (next day)
                in_service = now >= first_service or now <= last_service
                
                if in_service:
                    return {"in_operation": True, "next_service_time": None, "reason": None}
                else:
                    return {
                        "in_operation": False,
                        "next_service_time": "06:00",
                        "reason": "OUTSIDE_SERVICE_HOURS"
                    }
            
            # Metro / rail: derive operation hours from topology instead of bus schedule.
            if isinstance(line_code, str) and line_code and line_code[0] in ('M', 'F', 'T'):
                line = metro_service.get_line(line_code)
                if line:
                    first_service = self._parse_time(line.get('first_time') or '')
                    last_service = self._parse_time(line.get('last_time') or '')
                    if not first_service or not last_service:
                        return {"in_operation": True, "next_service_time": None}

                    now = datetime.now(self.tz).time()
                    wraps = last_service < first_service

                    if not wraps:
                        in_service = first_service <= now <= last_service
                    else:
                        # Example: 06:00 -> 00:30
                        in_service = now >= first_service or now <= last_service

                    if in_service:
                        return {"in_operation": True, "next_service_time": None, "reason": None}

                    # Out of service: next service is the daily first_service.
                    return {
                        "in_operation": False,
                        "next_service_time": first_service.strftime("%H:%M"),
                        "reason": "OUTSIDE_TOPOLOGY_WINDOW"
                    }

            schedule = schedule_service.get_schedule(line_code)
            data_status = schedule.get('data_status', 'UNKNOWN')
            has_service_today = schedule.get('has_service_today', True)

            if data_status == 'NO_DATA':
                logger.warning(f"No schedule payload for {line_code}; assuming active")
                return {"in_operation": True, "next_service_time": None, "reason": "NO_DATA"}
            
            # Get times from specified direction(s)
            all_times = []
            directions_to_check = [direction] if direction else ['G', 'D']
            
            for dir_code in directions_to_check:
                times = schedule.get(dir_code, [])
                for time_str in times:
                    parsed = self._parse_time(time_str)
                    if parsed:
                        all_times.append(parsed)
            
            if not all_times:
                if not has_service_today or data_status == 'NO_SERVICE_DAY':
                    logger.info(f"Line {line_code} has no planned service for current day type")
                    return {"in_operation": False, "next_service_time": None, "reason": "NO_SERVICE_DAY"}

                # Unknown state - assume active (benefit of doubt)
                return {"in_operation": True, "next_service_time": None, "reason": "UNKNOWN"}
            
            # Sort times
            all_times.sort()
            
            # Get current time
            now = datetime.now(self.tz).time()
            
            # Find first and last service times
            first_service = all_times[0]
            last_service = all_times[-1]
            
            logger.debug(
                f"Operation hours check for {line_code} direction {direction}: "
                f"now={now.strftime('%H:%M')}, first={first_service.strftime('%H:%M')}, "
                f"last={last_service.strftime('%H:%M')}, total_trips={len(all_times)}"
            )
            
            # Check if current time is within operating hours
            if first_service <= now <= last_service:
                logger.info(f"Line {line_code} direction {direction} is IN SERVICE")
                return {"in_operation": True, "next_service_time": None, "reason": None}
            else:
                # Out of service - find next service time
                next_service = None
                if now < first_service:
                    # Before first service
                    next_service = first_service.strftime("%H:%M")
                    logger.info(f"Line {line_code} direction {direction} OUT OF SERVICE - before first service")
                else:
                    # After last service - next service is tomorrow's first service
                    next_service = first_service.strftime("%H:%M")
                    logger.info(f"Line {line_code} direction {direction} OUT OF SERVICE - after last service")
                
                reason = 'BEFORE_WINDOW' if now < first_service else 'AFTER_WINDOW'
                return {"in_operation": False, "next_service_time": next_service, "reason": reason}
                
        except Exception as e:
            logger.error(f"Error checking operation hours for line {line_code}: {e}")
            # On error, assume active
            return {"in_operation": True, "next_service_time": None, "reason": "ERROR"}
    
    def get_line_status(self, line_code: str, direction: Optional[str] = None) -> Dict:
        """
        Get comprehensive line status including alerts and operation hours.
        
        Args:
            line_code: Line code to check
            direction: Optional direction ('G' or 'D'). If provided, checks operation hours
                      for that specific direction only.
            
        Returns:
            Dictionary with status, messages (list), and metadata
            Example: {
                "status": "WARNING",
                "messages": ["Alert 1", "Alert 2"],
                "next_service_time": None
            }
        """
        logger.info(f"Fetching status for line {line_code}" + (f" direction {direction}" if direction else ""))
        
        # Metro / rail: we don't use IETT bus alerts.
        if isinstance(line_code, str) and line_code and line_code[0] in ('M', 'F', 'T'):
            operation_info = self._check_operation_hours(line_code, direction=None)
            if not operation_info["in_operation"]:
                next_time = operation_info.get("next_service_time")
                reason = operation_info.get("reason")
                if reason == 'NO_SERVICE_DAY':
                    message = "Hat bugün planlı sefer yapmıyor."
                elif next_time:
                    message = f"Hat şu an hizmet vermemektedir. İlk sefer: {next_time}"
                else:
                    message = "Hat şu an hizmet vermemektedir."
                return {
                    "status": LineStatus.OUT_OF_SERVICE,
                    "alerts": [{"text": message, "time": "", "type": ""}],
                    "next_service_time": next_time
                }

            return {
                "status": LineStatus.ACTIVE,
                "alerts": [],
                "next_service_time": None
            }

        # Step 1: Check for alerts (with caching - alerts don't change frequently)
        # Cache key for alerts includes date to ensure fresh data on new day
        current_date = datetime.now(self.tz).strftime('%Y-%m-%d')
        alerts_cache_key = f"alerts:{line_code}:{current_date}"
        
        if alerts_cache_key in _status_cache:
            logger.debug(f"Cache hit for alerts: {line_code}")
            alert_objects = _status_cache[alerts_cache_key]
        else:
            alert_objects = self._fetch_alerts(line_code)
            _status_cache[alerts_cache_key] = alert_objects
            logger.debug(f"Cached alerts for {line_code} on {current_date}")
        
        if alert_objects:
            # Don't cache the final result - operation hours need fresh check
            return {
                "status": LineStatus.WARNING,
                "alerts": alert_objects,
                "next_service_time": None
            }
        
        # Step 2: Check operation hours (NO CACHING - needs to be real-time)
        # Operation hours change every minute, so we always check fresh
        operation_info = self._check_operation_hours(line_code, direction)
        
        if not operation_info["in_operation"]:
            next_time = operation_info.get("next_service_time")
            reason = operation_info.get("reason")
            if reason == 'NO_SERVICE_DAY':
                message = "Hat bugün planlı sefer yapmıyor."
            elif next_time:
                message = f"Hat şu an hizmet vermemektedir. İlk sefer: {next_time}"
            else:
                message = "Hat şu an hizmet vermemektedir."
            
            return {
                "status": LineStatus.OUT_OF_SERVICE,
                "alerts": [{"text": message, "time": "", "type": ""}],
                "next_service_time": next_time
            }
        
        # Step 3: All clear - line is active
        return {
            "status": LineStatus.ACTIVE,
            "alerts": [],
            "next_service_time": None
        }
    
    def clear_cache(self, line_code: Optional[str] = None):
        """
        Clear status cache.
        
        Args:
            line_code: If provided, clear only this line's cache. Otherwise clear all.
        """
        if line_code:
            _status_cache.pop(line_code, None)
            logger.info(f"Cleared status cache for line {line_code}")
        else:
            _status_cache.clear()
            logger.info("Cleared all status cache")
    
    def get_cache_stats(self) -> Dict:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache size and TTL info
        """
        return {
            "cache_size": len(_status_cache),
            "max_size": _status_cache.maxsize,
            "ttl_seconds": _status_cache.ttl
        }


# Global singleton instance
status_service = IETTStatusService()
