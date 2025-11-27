from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case
from typing import List
from ..db import get_db
from ..models import TransportLine
from pydantic import BaseModel

router = APIRouter()

class TransportLineResponse(BaseModel):
    line_name: str
    transport_type_id: int
    road_type: str
    line: str

    class Config:
        from_attributes = True

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
        TransportLine.line_name
    ).limit(10).all()
    
    return [line[0] for line in lines]

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
