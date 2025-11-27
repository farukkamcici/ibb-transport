from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case, or_, func
from typing import List
from ..db import get_db
from ..models import TransportLine
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
    
    # Normalize query for Turkish case-insensitive search
    normalized_query = turkish_lower(query)
    search_query = f"%{normalized_query}%"
    
    # Define a CASE statement to rank results with relevance scoring
    ordering_logic = case(
        (func.lower(TransportLine.line_name) == normalized_query, 1),
        (func.lower(TransportLine.line_name).like(f"{normalized_query}%"), 2),
        (func.lower(TransportLine.line_name).like(search_query), 3),
        else_=4
    )

    # Search in both line_name and line (route description) using LOWER for case-insensitive comparison
    lines = db.query(TransportLine, ordering_logic.label('relevance_score')).filter(
        or_(
            func.lower(TransportLine.line_name).like(search_query),
            func.lower(TransportLine.line).like(search_query)
        )
    ).order_by(
        ordering_logic,
        TransportLine.line_name
    ).limit(15).all()
    
    return [
        SearchResult(
            line_name=line.TransportLine.line_name,
            transport_type_id=line.TransportLine.transport_type_id,
            road_type=line.TransportLine.road_type,
            line=line.TransportLine.line,
            relevance_score=line.relevance_score
        )
        for line in lines
    ]

@router.get("/lines/{line_name}", response_model=TransportLineResponse)
def get_line_metadata(line_name: str, db: Session = Depends(get_db)):
    """
    Retrieves metadata for a specific transport line.
    """
    line = db.query(TransportLine).filter(
        TransportLine.line_name == line_name
    ).first()
    
    if not line:
        raise HTTPException(
            status_code=404,
            detail=f"Transport line '{line_name}' not found."
        )
    
    return line
