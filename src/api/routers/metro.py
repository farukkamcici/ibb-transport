"""
Metro Istanbul Backend API Router.

Dynamic data layer for real-time metro information.
All endpoints proxy Metro Istanbul API with intelligent caching.

Endpoints:
    POST /metro/schedule - Live train arrivals (60s cache)
    POST /metro/duration - Travel time between stations (24h cache)

Architecture:
    - Frontend uses static metro_topology.json for map/coordinates
    - Backend provides real-time data through these cached endpoints
    - Cache keys include direction/line for granular invalidation

Author: Backend Team
Date: 2025-12-08
"""

from fastapi import APIRouter, HTTPException, Body
from cachetools import TTLCache
import requests
import logging
from datetime import datetime
from typing import List, Dict, Optional

from ..schemas import (
    TimeTableRequest,
    TimeTableResponse,
    MetroScheduleResponse,
    TrainArrival,
    StationDistanceResponse
)
from ..services.metro_service import metro_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metro", tags=["Metro"])

# Metro Istanbul API Configuration
METRO_API_BASE = "https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2"

# HTTP Session
session = requests.Session()
session.headers.update({
    'User-Agent': 'IBB-Transport-Platform/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
})

# Cache Configuration
# Schedule: 60 seconds (real-time data)
_schedule_cache = TTLCache(maxsize=500, ttl=60)

# Travel Duration: 24 hours (static infrastructure data)
_duration_cache = TTLCache(maxsize=1000, ttl=86400)


# ============================================================================
# ENDPOINT 0: STATIC TOPOLOGY (GET /metro/topology)
# ============================================================================

@router.get(
    "/topology",
    summary="Get Metro Topology",
    description="""
    Returns complete metro network topology with stations, coordinates, and directions.
    
    **Data Source:** Static file (metro_topology.json) loaded at startup
    
    **Use Case:** Frontend map rendering, station lookups, direction selection
    
    **Response Structure:**
    - lines: Dict of metro lines keyed by code (M1A, F1, etc.)
    - Each line contains: id, name, description, color, first_time, last_time, stations[]
    - Each station contains: id, name, coordinates, accessibility, directions[]
    
    **Performance:** Served from in-memory cache (instant response)
    """
)
async def get_metro_topology():
    """
    Get complete metro network topology.
    
    Returns:
        Topology dict with lines, stations, and metadata
        
    Raises:
        HTTPException 500: If topology file is missing or invalid
    """
    try:
        topology = metro_service.get_topology()
        return topology
    except Exception as e:
        logger.error(f"Failed to load metro topology: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load metro topology"
        )


@router.get(
    "/lines/{line_code}",
    summary="Get Single Metro Line",
    description="""
    Get detailed information for a specific metro line.
    
    **Path Parameter:**
    - line_code: Metro line code (e.g., M1A, M2, F1)
    
    **Returns:** Line data with all stations, coordinates, and directions
    """
)
async def get_metro_line(line_code: str):
    """
    Get specific metro line data.
    
    Args:
        line_code: Line code (M1A, M2, etc.)
        
    Returns:
        Line data dict
        
    Raises:
        HTTPException 404: Line not found
    """
    line_data = metro_service.get_line(line_code)
    
    if not line_data:
        raise HTTPException(
            status_code=404,
            detail=f"Metro line '{line_code}' not found"
        )
    
    return line_data


@router.get(
    "/lines/{line_code}/coordinates",
    summary="Get Line Coordinates for Map Polyline",
    description="""
    Get ordered coordinate pairs for drawing metro line on map.
    
    **Use Case:** Draw polyline connecting all stations in order
    
    **Returns:** List of [lat, lng] pairs
    """
)
async def get_line_coordinates(line_code: str):
    """
    Get line coordinates for map rendering.
    
    Args:
        line_code: Line code
        
    Returns:
        List of [lat, lng] coordinate pairs
        
    Raises:
        HTTPException 404: Line not found
    """
    coordinates = metro_service.get_line_coordinates(line_code)
    
    if not coordinates:
        raise HTTPException(
            status_code=404,
            detail=f"No coordinates found for line '{line_code}'"
        )
    
    return {"line_code": line_code, "coordinates": coordinates}


@router.get(
    "/stations/search",
    summary="Search Stations by Name",
    description="""
    Search for metro stations across all lines by name.
    
    **Query Parameter:**
    - q: Search query (case-insensitive)
    
    **Returns:** List of matching stations with their line info
    """
)
async def search_stations(q: str):
    """
    Search for stations by name.
    
    Args:
        q: Search query
        
    Returns:
        List of matching stations with line context
    """
    if not q or len(q) < 2:
        raise HTTPException(
            status_code=400,
            detail="Search query must be at least 2 characters"
        )
    
    results = metro_service.find_station_by_name(q)
    
    return {
        "query": q,
        "results": results,
        "count": len(results)
    }


# ============================================================================
# ENDPOINT 1: LIVE TRAIN SCHEDULE (POST /metro/schedule)
# ============================================================================

@router.post(
    "/schedule",
    response_model=TimeTableResponse,
    summary="Get Live Train Arrivals",
    description="""
    Fetches planned train departures and converts them to estimated arrivals.
    
    **Required from Frontend:**
    - BoardingStationId: Get from metro_topology.json
    - DirectionId: Get from metro_topology.json (station.directions)
    
    **Caching:** 60 seconds TTL (schedule data)
    
    **Upstream API:** POST /GetTimeTable
    
    **Note:** IBB API returns planned departure times, not live GPS. 
    Backend calculates "RemainingMinutes" based on current time.
    """
)
async def get_train_schedule(request: TimeTableRequest = Body(...)):
    """
    Get train departure schedule and convert to arrival estimates.
    
    Args:
        request: TimeTableRequest with StationId, DirectionId, DateTime
        
    Returns:
        List of upcoming trains with estimated arrival times
        
    Raises:
        HTTPException 404: Station/direction not found
        HTTPException 500: Metro API error
    """
    # Build cache key
    cache_key = f"schedule:{request.BoardingStationId}:{request.DirectionId}"
    
    # Check cache
    if cache_key in _schedule_cache:
        logger.debug(f"Cache hit for schedule: {cache_key}")
        return _schedule_cache[cache_key]
    
    logger.info(f"Fetching schedule for station {request.BoardingStationId}, direction {request.DirectionId}")
    
    try:
        # Prepare request payload (remove DateTime - API doesn't need it)
        payload = {
            "BoardingStationId": request.BoardingStationId,
            "DirectionId": request.DirectionId
        }
        
        # Call Metro API
        response = session.post(
            f"{METRO_API_BASE}/GetTimeTable",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        raw_data = response.json()
        
        # Validate response
        if not raw_data.get('Success'):
            error_msg = raw_data.get('Error', {}).get('Message', 'Unknown error')
            raise HTTPException(
                status_code=404,
                detail=f"Metro API error: {error_msg}"
            )
        
        # Transform response to frontend-compatible format
        transformed_data = _transform_schedule_response(raw_data)
        
        # Cache and return transformed data
        _schedule_cache[cache_key] = transformed_data
        return transformed_data
        
    except requests.exceptions.Timeout:
        logger.error("Metro API timeout")
        raise HTTPException(
            status_code=504,
            detail="Metro API timeout - please try again"
        )
    except requests.exceptions.RequestException as e:
        logger.error(f"Metro API request failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch train schedule"
        )


def _transform_schedule_response(raw_data: dict) -> dict:
    """
    Transform IBB Metro schedule response to frontend-compatible format.
    
    Converts planned departure times (HH:MM) to estimated arrivals with RemainingMinutes.
    
    Args:
        raw_data: Raw response from IBB GetTimeTable API
        
    Returns:
        Transformed response matching TimeTableResponse schema
    """
    if not raw_data.get('Data') or len(raw_data['Data']) == 0:
        return {
            "Success": True,
            "Error": None,
            "Data": []
        }
    
    schedule_data = raw_data['Data'][0]
    times = schedule_data.get('TimeInfos', {}).get('Times', [])
    destination = schedule_data.get('LastStation', 'Unknown')
    
    # Get current time in Istanbul timezone
    from datetime import datetime, timezone, timedelta
    istanbul_tz = timezone(timedelta(hours=3))
    now = datetime.now(istanbul_tz)
    current_time = now.time()
    
    # Convert times to TrainArrival objects
    arrivals = []
    for idx, time_str in enumerate(times):
        try:
            # Parse time (HH:MM format)
            parts = time_str.split(':')
            if len(parts) != 2:
                continue
                
            hour = int(parts[0])
            minute = int(parts[1])
            
            # Create datetime for comparison
            train_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Skip past trains
            if train_time <= now:
                continue
            
            # Calculate remaining minutes
            time_diff = train_time - now
            remaining_minutes = int(time_diff.total_seconds() / 60)
            
            # Only include trains within next 60 minutes
            if remaining_minutes > 60:
                continue
            
            arrivals.append({
                "TrainId": f"TRAIN_{idx}",
                "DestinationStationName": destination,
                "RemainingMinutes": remaining_minutes,
                "ArrivalTime": time_str,
                "IsCrowded": False  # Not available from API
            })
            
            # Limit to next 10 trains
            if len(arrivals) >= 10:
                break
                
        except (ValueError, IndexError) as e:
            logger.warning(f"Failed to parse time '{time_str}': {e}")
            continue
    
    return {
        "Success": True,
        "Error": None,
        "Data": arrivals
    }


# ============================================================================
# ENDPOINT 2: TRAVEL DURATION (POST /metro/duration)
# ============================================================================

@router.post(
    "/duration",
    response_model=StationDistanceResponse,
    summary="Get Travel Duration Between Stations",
    description="""
    Calculates travel time from a boarding station to all other stations in a direction.
    
    **Required from Frontend:**
    - BoardingStationId: Starting station ID
    - DirectionId: Direction of travel
    
    **Caching:** 24 hours TTL (infrastructure data rarely changes)
    
    **Upstream API:** POST /GetStationBetweenTime
    
    **Use Case:** Show "X minutes to Airport" on station detail popup
    """
)
async def get_travel_duration(request: TimeTableRequest = Body(...)):
    """
    Get travel times from a station to all downstream stations.
    
    Args:
        request: TimeTableRequest with StationId and DirectionId
        
    Returns:
        List of station distances with travel time in minutes
        
    Raises:
        HTTPException 404: Station/direction not found
        HTTPException 500: Metro API error
    """
    # Build cache key (date-agnostic, durations don't change daily)
    cache_key = f"duration:{request.BoardingStationId}:{request.DirectionId}"
    
    # Check cache
    if cache_key in _duration_cache:
        logger.debug(f"Cache hit for duration: {cache_key}")
        return _duration_cache[cache_key]
    
    logger.info(f"Fetching travel durations for station {request.BoardingStationId}")
    
    try:
        # Prepare request payload
        payload = {
            "BoardingStationId": request.BoardingStationId,
            "DirectionId": request.DirectionId,
            "DateTime": datetime.now().isoformat()
        }
        
        # Call Metro API
        response = session.post(
            f"{METRO_API_BASE}/GetStationBetweenTime",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # Validate response
        if not data.get('Success'):
            error_msg = data.get('Error', {}).get('Message', 'Unknown error')
            raise HTTPException(
                status_code=404,
                detail=f"Metro API error: {error_msg}"
            )
        
        # Cache and return (24h TTL)
        _duration_cache[cache_key] = data
        
        return data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch travel duration: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch travel duration"
        )


# ============================================================================
# ADMIN ENDPOINTS: CACHE MANAGEMENT
# ============================================================================

@router.post(
    "/admin/clear-cache",
    summary="Clear Metro Data Cache",
    description="Admin endpoint to manually clear all metro-related caches",
    tags=["Admin", "Metro"]
)
async def clear_metro_cache(cache_type: Optional[str] = None):
    """
    Clear metro data caches.
    
    Args:
        cache_type: Optional filter - 'schedule', 'status', 'duration', or None for all
        
    Returns:
        Success message with cleared cache stats
    """
    cleared = []
    
    if cache_type in [None, 'schedule']:
        count = len(_schedule_cache)
        _schedule_cache.clear()
        cleared.append(f"schedule ({count} entries)")
    
    if cache_type in [None, 'duration']:
        count = len(_duration_cache)
        _duration_cache.clear()
        cleared.append(f"duration ({count} entries)")
    
    logger.info(f"Cleared metro caches: {', '.join(cleared)}")
    
    return {
        "success": True,
        "message": f"Cleared caches: {', '.join(cleared)}"
    }


@router.get(
    "/admin/cache-stats",
    summary="Get Metro Cache Statistics",
    description="Get current cache sizes and TTL info",
    tags=["Admin", "Metro"]
)
async def get_cache_stats():
    """
    Get cache statistics for monitoring.
    
    Returns:
        Dict with cache sizes and configuration
    """
    return {
        "schedule": {
            "size": len(_schedule_cache),
            "max_size": _schedule_cache.maxsize,
            "ttl_seconds": _schedule_cache.ttl
        },
        "duration": {
            "size": len(_duration_cache),
            "max_size": _duration_cache.maxsize,
            "ttl_seconds": _duration_cache.ttl
        }
    }


@router.post(
    "/admin/reload-topology",
    summary="Reload Metro Topology",
    description="Force reload of metro_topology.json from disk",
    tags=["Admin", "Metro"]
)
async def reload_topology():
    """
    Reload metro topology from file.
    
    Use this after manually updating metro_topology.json.
    
    Returns:
        Success message with topology metadata
    """
    try:
        metro_service.reload_topology()
        metadata = metro_service.get_metadata()
        
        return {
            "success": True,
            "message": "Metro topology reloaded successfully",
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"Failed to reload topology: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload topology: {str(e)}"
        )
