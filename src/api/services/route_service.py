"""
In-Memory Route Shape Service.

This service loads bus route geometries from line_shapes.json into memory at startup
and provides fast access without repeated file reads or database queries.

Author: Backend Team
Date: 2025-12-02
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class RouteService:
    """
    Singleton service for managing route shape data in memory.
    
    This service loads route geometries once at startup and keeps them in RAM
    for fast access during API requests.
    """
    
    _instance = None
    _shapes: Dict[str, Dict[str, List[List[float]]]] = {}
    _loaded: bool = False
    _version: str = "unknown"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RouteService, cls).__new__(cls)
        return cls._instance
    
    def load_data(self) -> bool:
        """
        Load route shape data from JSON file into memory.
        
        Tries multiple paths to support both Docker and local development:
        - /app/data/processed/line_shapes.json (Docker)
        - data/processed/line_shapes.json (Local dev)
        
        Returns:
            bool: True if data loaded successfully, False otherwise
        """
        if self._loaded:
            logger.info("Route shapes already loaded in memory")
            return True
        
        # Define possible file paths
        possible_paths = [
            Path("/app/data/processed/line_shapes.json"),  # Docker
            Path("data/processed/line_shapes.json"),        # Local dev (relative)
            Path(__file__).resolve().parents[3] / "data" / "processed" / "line_shapes.json",  # Local dev (absolute)
        ]
        
        file_path = None
        for path in possible_paths:
            if path.exists():
                file_path = path
                break
        
        if not file_path:
            logger.warning(
                f"Route shapes file not found. Tried paths: {[str(p) for p in possible_paths]}"
            )
            logger.warning("Route shape endpoints will return empty data")
            self._loaded = True  # Mark as loaded to prevent repeated attempts
            return False
        
        try:
            logger.info(f"Loading route shapes from: {file_path}")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self._version = data.get('version', 'unknown')
            self._shapes = data.get('shapes', {})
            
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
            
            logger.info(
                f"✓ Route shapes loaded successfully: "
                f"{len(self._shapes)} lines, "
                f"{sum(len(dirs) for dirs in self._shapes.values())} directions, "
                f"{file_size_mb:.2f} MB, "
                f"version {self._version}"
            )
            
            self._loaded = True
            return True
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse route shapes JSON: {e}")
            return False
        
        except Exception as e:
            logger.error(f"Unexpected error loading route shapes: {e}", exc_info=True)
            return False
    
    def get_route(self, line_code: str) -> Dict[str, List[List[float]]]:
        """
        Get route shape data for a specific line.
        
        Args:
            line_code: Transport line code (e.g., "76B", "19F", "M2")
            
        Returns:
            Dictionary with direction keys ("G", "D") mapping to coordinate arrays.
            Returns empty dict if line not found.
            
        Example:
            {
                "G": [[41.123, 29.456], [41.124, 29.457], ...],
                "D": [[41.125, 29.458], [41.126, 29.459], ...]
            }
        """
        if not self._loaded:
            logger.warning("Route shapes not loaded, attempting to load now")
            self.load_data()
        
        return self._shapes.get(line_code, {})
    
    def get_all_lines(self) -> List[str]:
        """
        Get list of all line codes with available route shapes.
        
        Returns:
            List of line codes (e.g., ["76B", "19F", "M2", ...])
        """
        if not self._loaded:
            logger.warning("Route shapes not loaded, attempting to load now")
            self.load_data()
        
        return list(self._shapes.keys())
    
    def has_route(self, line_code: str) -> bool:
        """
        Check if route shape data exists for a specific line.
        
        Args:
            line_code: Transport line code
            
        Returns:
            bool: True if route data exists, False otherwise
        """
        if not self._loaded:
            self.load_data()
        
        return line_code in self._shapes
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about loaded route shapes.
        
        Returns:
            Dictionary with stats including line count, direction count, etc.
        """
        if not self._loaded:
            return {
                'loaded': False,
                'message': 'Route shapes not loaded'
            }
        
        total_directions = sum(len(dirs) for dirs in self._shapes.values())
        total_points = sum(
            sum(len(coords) for coords in dirs.values())
            for dirs in self._shapes.values()
        )
        
        return {
            'loaded': True,
            'version': self._version,
            'total_lines': len(self._shapes),
            'total_directions': total_directions,
            'total_coordinate_points': total_points,
            'avg_points_per_direction': total_points / total_directions if total_directions > 0 else 0
        }
    
    def reload_data(self) -> bool:
        """
        Force reload of route shape data from file.
        
        Useful for development or when data file is updated.
        
        Returns:
            bool: True if reload successful, False otherwise
        """
        logger.info("Forcing reload of route shapes")
        self._loaded = False
        self._shapes = {}
        return self.load_data()


# Global singleton instance
route_service = RouteService()