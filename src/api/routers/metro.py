"""
Metro Istanbul Backend API Router.

Dynamic data layer for real-time metro information.
All endpoints proxy Metro Istanbul API with intelligent caching.

Endpoints:
    POST /metro/schedule - Live train arrivals (60s cache)
    GET /metro/status - Network status + alerts (5min cache)
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
    AnnouncementRequest,
    ServiceStatusResponse,
    AnnouncementResponse,
    NetworkStatusResponse,
    NetworkStatusLine,
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

# Network Status: 5 minutes (status changes infrequently)
_status_cache = TTLCache(maxsize=50, ttl=300)

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
    Fetches real-time train arrivals for a specific station and direction.
    
    **Required from Frontend:**
    - BoardingStationId: Get from metro_topology.json
    - DirectionId: Get from metro_topology.json (station.directions)
    
    **Caching:** 60 seconds TTL (real-time data)
    
    **Upstream API:** POST /GetTimeTable
    """
)
async def get_train_schedule(request: TimeTableRequest = Body(...)):
    """
    Get live train arrival times for a station.
    
    Args:
        request: TimeTableRequest with StationId, DirectionId, DateTime
        
    Returns:
        List of upcoming trains with arrival times and crowding info
        
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
        # Prepare request payload
        payload = {
            "BoardingStationId": request.BoardingStationId,
            "DirectionId": request.DirectionId,
            "DateTime": request.DateTime.isoformat()
        }
        
        # Call Metro API
        response = session.post(
            f"{METRO_API_BASE}/GetTimeTable",
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
        
        # Cache and return
        _schedule_cache[cache_key] = data
        return data
        
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


# ============================================================================
# ENDPOINT 2: NETWORK STATUS (GET /metro/status)
# ============================================================================

@router.get(
    "/status",
    response_model=NetworkStatusResponse,
    summary="Get Metro Network Status",
    description="""
    Aggregated network status combining operational status and service alerts.
    
    **Combines two upstream calls:**
    1. GET /GetServiceStatuses - Line operational status
    2. POST /GetAnnouncementsByLine - Service alerts (Turkish)
    
    **Caching:** 5 minutes TTL
    
    **Returns:** Unified status object with alerts per line
    """
)
async def get_network_status():
    """
    Get complete metro network status with alerts.
    
    Aggregates operational status and announcements into a single response.
    
    Returns:
        NetworkStatusResponse with per-line status and alerts
        
    Raises:
        HTTPException 500: Metro API error
    """
    cache_key = "network_status"
    
    # Check cache
    if cache_key in _status_cache:
        logger.debug("Cache hit for network status")
        return _status_cache[cache_key]
    
    logger.info("Fetching metro network status")
    
    try:
        # Parallel fetch: service statuses and announcements
        status_response = session.get(
            f"{METRO_API_BASE}/GetServiceStatuses",
            timeout=10
        )
        status_response.raise_for_status()
        status_data = status_response.json()
        
        # Get announcements for each line (Turkish language)
        line_codes = ["M1", "M2", "M3", "M1A", "M1B", "M4", "M5", "M6", "M7", "M8", "M9", "TF1", "TF2"]
        all_announcements = {}
        
        for line_code in line_codes:
            try:
                ann_response = session.post(
                    f"{METRO_API_BASE}/GetAnnouncementsByLine",
                    json={"Language": "TR", "Line": line_code},
                    timeout=5
                )
                if ann_response.status_code == 200:
                    ann_data = ann_response.json()
                    if ann_data.get('Success'):
                        all_announcements[line_code] = ann_data.get('Data', [])
            except Exception as e:
                logger.warning(f"Failed to fetch announcements for {line_code}: {e}")
                all_announcements[line_code] = []
        
        # Build aggregated response
        if not status_data.get('Success'):
            raise HTTPException(status_code=500, detail="Failed to fetch service status")
        
        statuses = status_data.get('Data', [])
        
        # Aggregate by line
        network_status = {
            "lines": {},
            "fetched_at": datetime.utcnow()
        }
        
        for status in statuses:
            line_code = status.get('LineCode', 'UNKNOWN')
            
            network_status["lines"][line_code] = {
                "line_code": line_code,
                "line_name": status.get('LineName', line_code),
                "status": status.get('Status', 'UNKNOWN'),
                "alerts": all_announcements.get(line_code, []),
                "last_updated": datetime.utcnow()
            }
        
        # Cache result
        _status_cache[cache_key] = network_status
        
        return network_status
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch network status: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch metro network status"
        )


# ============================================================================
# ENDPOINT 3: TRAVEL DURATION (POST /metro/duration)
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
    
    if cache_type in [None, 'status']:
        count = len(_status_cache)
        _status_cache.clear()
        cleared.append(f"status ({count} entries)")
    
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
        "status": {
            "size": len(_status_cache),
            "max_size": _status_cache.maxsize,
            "ttl_seconds": _status_cache.ttl
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
