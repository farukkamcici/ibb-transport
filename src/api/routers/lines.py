from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case, or_, func
from typing import List, Dict
from ..db import get_db
from ..models import TransportLine
from ..services.route_service import route_service
from ..services.metro_service import metro_service
from pydantic import BaseModel
import unicodedata

router = APIRouter()

class TransportLineResponse(BaseModel):
    line_name: str
    transport_type_id: int
    road_type: str
    line: str

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    line_name: str
    transport_type_id: int
    road_type: str
    line: str
    relevance_score: int

    class Config:
        from_attributes = True

def turkish_lower(text: str) -> str:
    """Convert text to lowercase using Turkish locale rules."""
    replacements = {
        'İ': 'i',
        'I': 'ı',
        'Ğ': 'ğ',
        'Ü': 'ü',
        'Ş': 'ş',
        'Ö': 'ö',
        'Ç': 'ç'
    }
    for upper, lower in replacements.items():
        text = text.replace(upper, lower)
    return text.lower()

@router.get("/lines/search", response_model=List[SearchResult])
def search_lines(query: str, db: Session = Depends(get_db)):
    """
    Searches for transport lines with rich metadata, prioritizing matches:
    1. Exact line_name match (score: 1)
    2. Starts with query in line_name (score: 2)
    3. Contains query in line_name (score: 3)
    4. Matches in route description (score: 4)
    
    Supports Turkish character normalization (İ/i, I/ı, etc.)
    """
    if not query:
        return []
    
    # 1. Strip trailing/leading whitespace
    clean_input = query.strip()
    
    # 2. Normalize for Turkish (case-insensitive)
    normalized_query = turkish_lower(clean_input)
    
    # 3. Create a "compact" version (remove internal spaces) for flexible matching
    # This handles "km 42" -> "km42" matching against "KM42"
    compact_query = normalized_query.replace(" ", "")
    
    search_query = f"%{normalized_query}%"
    compact_search_pattern = f"%{compact_query}%"
    
    # DB-side compact version of line_name
    db_line_compact = func.replace(TransportLine.line_name, ' ', '')

    # Define a CASE statement to rank results with relevance scoring
    ordering_logic = case(
        (TransportLine.line_name.ilike(normalized_query), 1),             # Exact match (Original)
        (db_line_compact.ilike(compact_query), 2),                        # Exact match (Ignoring spaces)
        (TransportLine.line_name.ilike(f"{normalized_query}%"), 3),       # Starts with (Original)
        (db_line_compact.ilike(f"{compact_query}%"), 4),                  # Starts with (Ignoring spaces)
        (TransportLine.line_name.ilike(search_query), 5),                 # Contains (Original)
        else_=6
    )

    # Search in line_name (flexible) and line description (standard)
    lines = db.query(TransportLine, ordering_logic.label('relevance_score')).filter(
        or_(
            TransportLine.line_name.ilike(search_query),
            TransportLine.line.ilike(search_query),
            # Add flexible space handling:
            # Check if "KM42" (db) matches "km42" (user input "km 42")
            db_line_compact.ilike(compact_search_pattern)
        )
    ).order_by(
        ordering_logic,
        TransportLine.line_name
    ).limit(15).all()
    
    results: List[SearchResult] = []

    for row in lines:
        base = SearchResult(
            line_name=row.TransportLine.line_name,
            transport_type_id=row.TransportLine.transport_type_id,
            road_type=row.TransportLine.road_type,
            line=row.TransportLine.line,
            relevance_score=row.relevance_score
        )

        # Best-practice UX: expose M1A/M1B as separate searchable lines.
        # Forecasts remain keyed by "M1" in the DB, but topology/schedule differ.
        if base.line_name == 'M1':
            for split_code in ('M1A', 'M1B'):
                topo = metro_service.get_line(split_code) or {}
                desc = topo.get('description') or base.line
                results.append(
                    SearchResult(
                        line_name=split_code,
                        transport_type_id=base.transport_type_id,
                        road_type=base.road_type,
                        line=desc,
                        relevance_score=base.relevance_score
                    )
                )
            continue

        results.append(base)

    return results

@router.get("/lines/{line_name}", response_model=TransportLineResponse)
def get_line_metadata(line_name: str, db: Session = Depends(get_db)):
    """
    Retrieves metadata for a specific transport line.
    """
    base_line_name = 'M1' if line_name in ('M1A', 'M1B') else line_name
    line = db.query(TransportLine).filter(
        TransportLine.line_name == base_line_name
    ).first()
    
    if not line:
        raise HTTPException(
            status_code=404,
            detail=f"Transport line '{line_name}' not found."
        )
    
    # For split M1 lines, override the outward-facing code + description.
    if line_name in ('M1A', 'M1B'):
        topo = metro_service.get_line(line_name) or {}
        return TransportLineResponse(
            line_name=line_name,
            transport_type_id=line.transport_type_id,
            road_type=line.road_type,
            line=topo.get('description') or line.line
        )

    return line


@router.get("/lines/{line_code}/route", response_model=Dict[str, List[List[float]]])
def get_line_route(line_code: str):
    """
    Retrieves route shape geometry for a specific transport line.
    
    Returns coordinate arrays for each direction (G=Gidiş/Forward, D=Dönüş/Return).
    Data is served from in-memory cache for fast access.
    
    Args:
        line_code: Transport line code (e.g., "76B", "19F", "M2")
    
    Returns:
        Dictionary with direction keys mapping to coordinate arrays:
        {
            "G": [[lat, lng], [lat, lng], ...],
            "D": [[lat, lng], [lat, lng], ...]
        }
        Returns empty dict if route not found.
    
    Example:
        GET /lines/76B/route
        {
            "G": [[41.0082, 28.9784], [41.0085, 28.9790], ...],
            "D": [[41.0086, 28.9795], [41.0089, 28.9800], ...]
        }
    """
    route_data = route_service.get_route(line_code)
    
    # Return empty dict if not found (not a 404, as the line may exist without route data)
    return route_data
