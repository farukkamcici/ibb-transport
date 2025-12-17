from fastapi import APIRouter
from fastapi.responses import JSONResponse
import httpx
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# Cache storage
_traffic_cache: Optional[dict] = None
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 300  # 5 minutes

@router.get("/traffic/istanbul")
async def get_istanbul_traffic():
    """
    Proxy endpoint for Istanbul-wide traffic congestion index.
    
    Data source: IMM/UYM public traffic feed (used by city dashboards).
    Caches for 5 minutes to reduce load and respect unknown rate limits.
    """
    global _traffic_cache, _cache_timestamp
    
    now = datetime.now()
    
    # Return cached data if still valid
    if _traffic_cache and _cache_timestamp:
        age = (now - _cache_timestamp).total_seconds()
        if age < CACHE_TTL_SECONDS:
            return JSONResponse(_traffic_cache)
    
    # Fetch fresh data
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://tkmservices.ibb.gov.tr/web/api/TrafficData/v1/TrafficIndex_Sc1_Cont",
                headers={"User-Agent": "IstanbulTransportApp/1.0"}
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract traffic index (TI is primary, fallback to TI_Av)
            ti = data.get("TI")
            ti_av = data.get("TI_Av")
            percent = ti if ti is not None else ti_av
            
            if percent is None:
                return JSONResponse(
                    {"percent": None, "source": "IMM_UYM", "updatedAt": now.isoformat()},
                    status_code=200
                )
            
            # Build response
            result = {
                "percent": int(percent),
                "source": "IMM_UYM",
                "updatedAt": now.isoformat()
            }
            
            # Update cache
            _traffic_cache = result
            _cache_timestamp = now
            
            return JSONResponse(result)
            
    except httpx.HTTPStatusError as e:
        return JSONResponse(
            {"percent": None, "source": "IMM_UYM", "updatedAt": now.isoformat(), "error": "upstream_error"},
            status_code=200
        )
    except Exception as e:
        return JSONResponse(
            {"percent": None, "source": "IMM_UYM", "updatedAt": now.isoformat(), "error": "fetch_failed"},
            status_code=200
        )
