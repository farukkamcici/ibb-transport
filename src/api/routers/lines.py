from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import case
from typing import List
from ..db import get_db
from ..models import TransportLine

router = APIRouter()

@router.get("/lines/search", response_model=List[str])
def search_lines(query: str, db: Session = Depends(get_db)):
    """
    Searches for transport lines, prioritizing matches:
    1. Exact match
    2. Starts with query
    3. Contains query
    """
    if not query:
        return []
        
    search_query = f"%{query}%"
    
    # Define a CASE statement to rank results
    ordering_logic = case(
        (TransportLine.line_name == query, 1),
        (TransportLine.line_name.ilike(f"{query}%"), 2),
        else_=3
    )

    lines = db.query(TransportLine.line_name).filter(
        TransportLine.line_name.ilike(search_query)
    ).order_by(
        ordering_logic,
        TransportLine.line_name # Secondary sort alphabetically
    ).limit(10).all()
    
    return [line[0] for line in lines]
