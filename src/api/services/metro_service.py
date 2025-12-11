"""
Metro Istanbul Service Layer.

Provides centralized access to metro topology data and helper functions.
Static topology is loaded from metro_topology.json at startup and cached in memory.

Architecture:
    - Singleton pattern for topology access
    - Lazy loading with validation
    - Helper methods for station/line lookups
    - Direction filtering support

Author: Backend Team
Date: 2025-12-09
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class MetroService:
    """
    Metro topology service (Singleton).
    
    Provides fast in-memory access to metro_topology.json data.
    """
    
    _instance = None
    _topology: Optional[Dict] = None
    _loaded_at: Optional[datetime] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize service (lazy load on first access)."""
        if self._topology is None:
            self.load_topology()
    
    def load_topology(self) -> None:
        """
        Load metro topology from JSON file.
        
        Path: frontend/public/data/metro_topology.json
        
        Raises:
            FileNotFoundError: If topology file doesn't exist
            json.JSONDecodeError: If file is invalid JSON
        """
        topology_path = Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "data" / "metro_topology.json"
        
        logger.info(f"Loading metro topology from: {topology_path}")
        
        if not topology_path.exists():
            raise FileNotFoundError(f"Metro topology file not found: {topology_path}")
        
        with open(topology_path, 'r', encoding='utf-8') as f:
            self._topology = json.load(f)
        
        self._loaded_at = datetime.now()
        
        # Validate structure
        if not isinstance(self._topology, dict) or 'lines' not in self._topology:
            raise ValueError("Invalid metro topology structure: missing 'lines' key")
        
        line_count = len(self._topology.get('lines', {}))
        station_count = self._topology.get('metadata', {}).get('total_stations', 0)
        
        logger.info(f"✓ Metro topology loaded: {line_count} lines, {station_count} stations")
    
    def get_topology(self) -> Dict:
        """
        Get complete topology data.
        
        Returns:
            Complete topology dictionary with lines and metadata
        """
        if self._topology is None:
            self.load_topology()
        return self._topology
    
    def get_lines(self) -> Dict[str, Dict]:
        """
        Get all metro lines.
        
        Returns:
            Dictionary keyed by line code (e.g., "M1A") with line data
        """
        return self.get_topology().get('lines', {})
    
    def get_line(self, line_code: str) -> Optional[Dict]:
        """
        Get specific line by code.
        
        Args:
            line_code: Line code (e.g., "M1A", "F1")
            
        Returns:
            Line data dict or None if not found
        """
        return self.get_lines().get(line_code)
    
    def get_line_by_id(self, line_id: int) -> Optional[Dict]:
        """
        Get line by numeric ID.
        
        Args:
            line_id: Line ID from Metro API
            
        Returns:
            Line data dict or None if not found
        """
        for line_code, line_data in self.get_lines().items():
            if line_data.get('id') == line_id:
                return line_data
        return None
    
    def get_stations(self, line_code: str) -> List[Dict]:
        """
        Get all stations for a line.
        
        Args:
            line_code: Line code
            
        Returns:
            List of station dicts sorted by order
        """
        line = self.get_line(line_code)
        if not line:
            return []
        return line.get('stations', [])
    
    def get_station(self, line_code: str, station_id: int) -> Optional[Dict]:
        """
        Get specific station by ID.
        
        Args:
            line_code: Line code
            station_id: Station ID
            
        Returns:
            Station dict or None if not found
        """
        stations = self.get_stations(line_code)
        for station in stations:
            if station.get('id') == station_id:
                return station
        return None
    
    def get_station_directions(self, line_code: str, station_id: int) -> List[Dict]:
        """
        Get available directions for a station.
        
        Args:
            line_code: Line code
            station_id: Station ID
            
        Returns:
            List of direction dicts with id and name
        """
        station = self.get_station(line_code, station_id)
        if not station:
            return []
        return station.get('directions', [])
    
    def get_line_coordinates(self, line_code: str) -> List[List[float]]:
        """
        Get line coordinates for map polyline.
        
        Extracts [lat, lng] pairs from all stations in order.
        
        Args:
            line_code: Line code
            
        Returns:
            List of [lat, lng] coordinate pairs
        """
        stations = self.get_stations(line_code)
        
        coordinates = []
        for station in sorted(stations, key=lambda s: s.get('order', 0)):
            coords = station.get('coordinates', {})
            lat = coords.get('lat')
            lng = coords.get('lng')
            if lat and lng:
                coordinates.append([lat, lng])
        
        return coordinates
    
    def get_terminus_stations(self, line_code: str) -> Dict[str, Dict]:
        """
        Get first and last stations on a line.
        
        Args:
            line_code: Line code
            
        Returns:
            Dict with 'start' and 'end' station data
        """
        stations = self.get_stations(line_code)
        if not stations:
            return {'start': None, 'end': None}
        
        sorted_stations = sorted(stations, key=lambda s: s.get('order', 0))
        
        return {
            'start': sorted_stations[0],
            'end': sorted_stations[-1]
        }
    
    def find_station_by_name(self, station_name: str) -> List[Dict]:
        """
        Search for stations by name across all lines.
        
        Args:
            station_name: Station name (case-insensitive)
            
        Returns:
            List of dicts with line_code, line_name, and station data
        """
        results = []
        search_name = station_name.lower()
        
        for line_code, line_data in self.get_lines().items():
            for station in line_data.get('stations', []):
                station_display = station.get('name', '').lower()
                station_desc = station.get('description', '').lower()
                
                if search_name in station_display or search_name in station_desc:
                    results.append({
                        'line_code': line_code,
                        'line_name': line_data.get('name'),
                        'line_color': line_data.get('color'),
                        'station': station
                    })
        
        return results
    
    def get_station_direction_pairs(self) -> List[Dict]:
        """
        Enumerate all station/direction combinations across the network.

        Returns:
            List of dicts with metadata for each pair
        """
        pairs: List[Dict] = []
        for line_code, line_data in self.get_lines().items():
            stations = line_data.get('stations', []) or []
            for station in stations:
                directions = station.get('directions', []) or []
                for direction in directions:
                    pairs.append({
                        'line_code': line_code,
                        'line_id': line_data.get('id'),
                        'line_name': line_data.get('description') or line_data.get('name'),
                        'station_id': station.get('id'),
                        'station_name': station.get('description') or station.get('name'),
                        'direction_id': direction.get('id'),
                        'direction_name': direction.get('name')
                    })
        return pairs
    
    def get_metadata(self) -> Dict:
        """
        Get topology metadata.
        
        Returns:
            Metadata dict with generation info and stats
        """
        return self.get_topology().get('metadata', {})
    
    def reload_topology(self) -> None:
        """
        Force reload of topology from disk.
        
        Use after manual topology updates.
        """
        logger.info("Reloading metro topology...")
        self._topology = None
        self.load_topology()


# Singleton instance
metro_service = MetroService()
