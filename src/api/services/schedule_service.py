"""
IETT Planned Schedule Service.

Fetches bus schedules from IETT API (SOAP/XML) and caches them for efficient access.
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
    Service for fetching and caching IETT bus schedules via SOAP/XML.
    """
    
    IETT_API_URL = "https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx"
    
    SOAP_ENVELOPE_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetPlanlananSeferSaati_XML xmlns="http://tempuri.org/">
      <HatKodu>{line_code}</HatKodu>
    </GetPlanlananSeferSaati_XML>
  </soap:Body>
</soap:Envelope>"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; IBB-Transport-Platform/1.0)',
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/GetPlanlananSeferSaati_XML'
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
    
    def _parse_xml_response(self, xml_text: str) -> Optional[List[Dict]]:
        """
        Parse SOAP XML response to extract schedule data.
        
        Args:
            xml_text: Raw XML response text
            
        Returns:
            List of schedule records or None if parsing fails
        """
        try:
            root = ET.fromstring(xml_text)
            
            # Define namespaces
            namespaces = {
                'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                'diffgr': 'urn:schemas-microsoft-com:xml-diffgram-v1',
                'msdata': 'urn:schemas-microsoft-com:xml-msdata'
            }
            
            # Navigate to NewDataSet -> Table elements
            # Path: soap:Body -> GetPlanlananSeferSaati_XMLResponse -> GetPlanlananSeferSaati_XMLResult -> diffgr:diffgram -> NewDataSet -> Table
            body = root.find('.//NewDataSet', namespaces)
            if body is None:
                # Try without namespace
                body = root.find('.//NewDataSet')
            
            if body is None:
                logger.warning("No NewDataSet found in XML response")
                return None
            
            # Extract all Table elements
            tables = body.findall('.//Table')
            if not tables:
                logger.warning("No Table elements found in XML response")
                return None
            
            schedule_data = []
            for table in tables:
                record = {}
                for child in table:
                    # Remove namespace prefix from tag
                    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    record[tag] = child.text if child.text else ""
                
                if record:
                    schedule_data.append(record)
            
            return schedule_data
            
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error parsing XML: {e}")
            return None
    
    def _fetch_from_iett(self, line_code: str) -> Optional[List[Dict]]:
        """
        Fetch schedule data from IETT SOAP API.
        
        Args:
            line_code: Bus line code (e.g., "15F")
            
        Returns:
            List of schedule records or None if request fails
        """
        try:
            # Prepare SOAP envelope
            soap_body = self.SOAP_ENVELOPE_TEMPLATE.format(line_code=line_code)
            
            # Send POST request
            response = self.session.post(
                self.IETT_API_URL,
                data=soap_body.encode('utf-8'),
                timeout=15
            )
            response.raise_for_status()
            
            # Parse XML response
            schedule_data = self._parse_xml_response(response.text)
            
            if schedule_data is None:
                logger.warning(f"No schedule data parsed for line {line_code}")
                return None
            
            return schedule_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch schedule for line {line_code}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching schedule for line {line_code}: {e}")
            return None
    
    def _parse_route_name(self, route_name: str) -> Dict[str, str]:
        """
        Parse route name to extract start and end stops.
        
        Args:
            route_name: Route name string (e.g., "KADIKÖY - PENDİK")
            
        Returns:
            Dictionary with start and end stop names
        """
        if not route_name or ' - ' not in route_name:
            return {"start": "", "end": ""}
        
        parts = route_name.split(' - ', 1)
        if len(parts) == 2:
            return {"start": parts[0].strip(), "end": parts[1].strip()}
        
        return {"start": "", "end": ""}
    
    def get_schedule(self, line_code: str) -> Dict:
        """
        Get filtered and sorted schedule for a bus line with route metadata.
        
        Args:
            line_code: Bus line code (e.g., "15F")
            
        Returns:
            Dictionary with directions, times, and metadata
            Example: {
                "G": ["06:00", "06:20", ...], 
                "D": ["07:00", "07:30", ...],
                "meta": {
                    "G": {"start": "KADIKÖY", "end": "PENDİK"},
                    "D": {"start": "PENDİK", "end": "KADIKÖY"}
                }
            }
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
            logger.warning(f"No schedule data available for line {line_code} - returning empty")
            empty_result = {"G": [], "D": [], "meta": {}}
            _schedule_cache[cache_key] = empty_result
            return empty_result
        
        # Get today's day type
        day_type = self._get_day_type()
        logger.debug(f"Filtering for day type: {day_type}")
        
        # Filter and organize by direction
        schedules_by_direction = {"G": [], "D": []}
        route_names_by_direction = {}
        
        for record in raw_data:
            try:
                # Extract fields from XML (SHATKODU, SYON, SGUNTIPI, DT, HATADI)
                schedule_day_type = record.get('SGUNTIPI') or record.get('sguntipi') or record.get('GunTipi')
                direction = record.get('SYON') or record.get('syon') or record.get('Yon')
                time_str = record.get('DT') or record.get('dt') or record.get('Saat')
                route_name = record.get('HATADI') or record.get('hatadi') or record.get('HatAdi') or ""
                
                # Skip if missing required fields
                if not all([schedule_day_type, direction, time_str]):
                    continue
                
                # Filter by day type
                if schedule_day_type != day_type:
                    continue
                
                # Store route name for this direction
                if direction not in route_names_by_direction and route_name:
                    route_names_by_direction[direction] = route_name
                
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
        
        # Build metadata with route direction info
        meta = {}
        
        # Parse route names for each direction
        for direction, route_name in route_names_by_direction.items():
            parsed_route = self._parse_route_name(route_name)
            
            if direction == 'G':
                # Gidiş: A -> B
                meta['G'] = {
                    "start": parsed_route.get("start", ""),
                    "end": parsed_route.get("end", "")
                }
            elif direction == 'D':
                # Dönüş: B -> A (reversed)
                meta['D'] = {
                    "start": parsed_route.get("end", ""),
                    "end": parsed_route.get("start", "")
                }
        
        # Prepare final result
        result = {
            **schedules_by_direction,
            "meta": meta
        }
        
        # Cache result
        _schedule_cache[cache_key] = result
        
        logger.info(
            f"Schedule fetched for line {line_code}: "
            f"G={len(schedules_by_direction['G'])} trips, "
            f"D={len(schedules_by_direction['D'])} trips, "
            f"meta={meta}"
        )
        
        return result
    
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
