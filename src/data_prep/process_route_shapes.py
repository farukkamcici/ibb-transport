"""
Process IBB Route GeoJSON with intelligent variant selection using weighted scoring.

This script selects the single best geometry for each Line+Direction from multiple
available variants by comparing against trusted stop data and applying quality filters.

Algorithm:
1. Spatial Match Score: Compare variant endpoints with trusted stops (±1000 pts)
2. Detail Score: Reward higher point counts for smooth curves (+points)
3. Negative Filters: Penalize depot/garage routes (-500 pts)
4. Selection: Pick highest scoring variant per line/direction

Input:
- data/raw/ibb_hat_guzergahlari.json (Raw GeoJSON with variants)
- frontend/public/data/line_routes.json (Trusted stop sequences)
- frontend/public/data/stops_geometry.json (Trusted stop coordinates)

Output:
- frontend/public/data/line_shapes.json (Clean, deduplicated shapes)

Author: Data Engineering Team
Date: 2025-12-02
"""

import json
import math
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from collections import defaultdict
from tqdm import tqdm


def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
    """
    Calculate great-circle distance between two points.
    
    Args:
        coord1: [lng, lat] in degrees
        coord2: [lng, lat] in degrees
        
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lng1, lat1 = coord1[0], coord1[1]
    lng2, lat2 = coord2[0], coord2[1]
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def map_direction(yon: str) -> str:
    """Map Turkish direction names to single-letter codes."""
    direction_map = {
        "GİDİŞ": "G",
        "GIDIŞ": "G",
        "DÖNÜŞ": "D",
        "DONUS": "D"
    }
    return direction_map.get(yon.upper().strip(), "G")


def swap_coordinates(coords: List[float]) -> List[float]:
    """Swap [Lng, Lat] to [Lat, Lng] for Leaflet."""
    return [coords[1], coords[0]]


def flatten_multilinestring(geometry: Dict[str, Any]) -> List[List[float]]:
    """
    Flatten MultiLineString coordinates into single polyline.
    
    Args:
        geometry: GeoJSON geometry object
        
    Returns:
        List of [Lat, Lng] coordinate pairs
    """
    if not geometry or 'coordinates' not in geometry:
        return []
    
    geo_type = geometry.get('type', '')
    coordinates = geometry['coordinates']
    
    flattened_points = []
    
    if geo_type == 'MultiLineString':
        for line_segment in coordinates:
            for point in line_segment:
                if len(point) >= 2:
                    flattened_points.append(swap_coordinates(point))
    
    elif geo_type == 'LineString':
        for point in coordinates:
            if len(point) >= 2:
                flattened_points.append(swap_coordinates(point))
    
    return flattened_points


def count_geometry_points(geometry: Dict[str, Any]) -> int:
    """Count total coordinate points in geometry."""
    if not geometry or 'coordinates' not in geometry:
        return 0
    
    geo_type = geometry.get('type', '')
    coordinates = geometry['coordinates']
    
    if geo_type == 'MultiLineString':
        return sum(len(segment) for segment in coordinates if segment)
    elif geo_type == 'LineString':
        return len(coordinates)
    
    return 0


def load_trusted_data(project_root: Path) -> Tuple[Dict, Dict]:
    """
    Load trusted stop sequence and geometry data.
    
    Returns:
        Tuple of (line_routes dict, stops_geometry dict)
    """
    print("Loading trusted reference data...")
    
    routes_path = project_root / "frontend" / "public" / "data" / "line_routes.json"
    stops_path = project_root / "frontend" / "public" / "data" / "stops_geometry.json"
    
    line_routes = {}
    stops_geometry = {}
    
    try:
        with open(routes_path, 'r', encoding='utf-8') as f:
            routes_data = json.load(f)
            line_routes = routes_data.get('routes', {})
        print(f"  ✓ Loaded {len(line_routes)} line routes")
    except FileNotFoundError:
        print(f"  ⚠️  Warning: {routes_path.name} not found, spatial matching disabled")
    
    try:
        with open(stops_path, 'r', encoding='utf-8') as f:
            stops_data = json.load(f)
            stops_geometry = stops_data.get('stops', {})
        print(f"  ✓ Loaded {len(stops_geometry)} stop coordinates")
    except FileNotFoundError:
        print(f"  ⚠️  Warning: {stops_path.name} not found, spatial matching disabled")
    
    return line_routes, stops_geometry


def get_trusted_endpoints(line_code: str, direction: str, 
                          line_routes: Dict, stops_geometry: Dict) -> Tuple[Optional[List[float]], Optional[List[float]]]:
    """
    Get trusted start and end coordinates for a line/direction.
    
    Returns:
        Tuple of (start_coord [lng, lat], end_coord [lng, lat]) or (None, None)
    """
    if not line_routes or not stops_geometry:
        return None, None
    
    line_data = line_routes.get(line_code)
    if not line_data:
        return None, None
    
    stop_codes = line_data.get(direction, [])
    if not stop_codes or len(stop_codes) < 2:
        return None, None
    
    start_code = stop_codes[0]
    end_code = stop_codes[-1]
    
    start_stop = stops_geometry.get(start_code)
    end_stop = stops_geometry.get(end_code)
    
    if not start_stop or not end_stop:
        return None, None
    
    start_coord = [start_stop.get('lng'), start_stop.get('lat')]
    end_coord = [end_stop.get('lng'), end_stop.get('lat')]
    
    if None in start_coord or None in end_coord:
        return None, None
    
    return start_coord, end_coord


def calculate_variant_score(variant: Dict[str, Any], 
                            trusted_start: Optional[List[float]], 
                            trusted_end: Optional[List[float]],
                            debug: bool = False) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate weighted score for a route variant.
    
    Args:
        variant: Variant metadata including geometry and properties
        trusted_start: [lng, lat] of trusted start stop
        trusted_end: [lng, lat] of trusted end stop
        debug: Whether to return detailed scoring breakdown
        
    Returns:
        Tuple of (total_score, score_breakdown_dict)
    """
    score = 0.0
    breakdown = {
        'spatial_match': 0,
        'detail_score': 0,
        'penalties': 0,
        'messages': []
    }
    
    # 1. SPATIAL MATCH SCORE (Most Important)
    if trusted_start and trusted_end and variant['flattened_coords']:
        variant_start = [variant['flattened_coords'][0][1], variant['flattened_coords'][0][0]]  # [lng, lat]
        variant_end = [variant['flattened_coords'][-1][1], variant['flattened_coords'][-1][0]]  # [lng, lat]
        
        dist_start = haversine_distance(variant_start, trusted_start)
        dist_end = haversine_distance(variant_end, trusted_end)
        
        if dist_start < 1.0 and dist_end < 1.0:
            score += 1000
            breakdown['spatial_match'] = 1000
            breakdown['messages'].append(f"✓ Strong spatial match (start: {dist_start:.3f}km, end: {dist_end:.3f}km)")
        elif dist_start < 1.0 or dist_end < 1.0:
            score += 200
            breakdown['spatial_match'] = 200
            breakdown['messages'].append(f"○ Partial spatial match (start: {dist_start:.3f}km, end: {dist_end:.3f}km)")
        else:
            breakdown['messages'].append(f"✗ Poor spatial match (start: {dist_start:.3f}km, end: {dist_end:.3f}km)")
    
    # 2. DETAIL SCORE (Reward higher point counts, but capped)
    point_count = variant['point_count']
    capped_points = min(point_count, 1000)
    detail_score = capped_points / 10
    score += detail_score
    breakdown['detail_score'] = detail_score
    if point_count > 1000:
        breakdown['messages'].append(f"+ Detail score: {detail_score:.1f} ({point_count} points, capped at 1000)")
    else:
        breakdown['messages'].append(f"+ Detail score: {detail_score:.1f} ({point_count} points)")
    
    # 3. CANONICAL ROUTE BONUS ("D0" suffix)
    route_code = variant.get('guzergah_kodu', '')
    if route_code and route_code.upper().endswith('_D0'):
        score += 500
        breakdown['canonical_bonus'] = 500
        breakdown['messages'].append("+ Canonical route bonus (_D0 suffix) (+500)")
    
    # 4. NEGATIVE FILTERS (Penalties)
    desc = variant.get('guzergah_aciklama') or ''
    desc_lower = desc.lower() if desc else ''
    penalty_keywords = ['garaj', 'depo', 'iski', 'İski', 'depar']
    
    for keyword in penalty_keywords:
        if keyword in desc_lower:
            score -= 500
            breakdown['penalties'] -= 500
            breakdown['messages'].append(f"✗ Penalty: '{keyword}' in description (-500)")
            break
    
    # 5. RING PREFERENCE (Bonus)
    if variant.get('ring') == 'EVET':
        score += 300
        breakdown['ring_bonus'] = 300
        breakdown['messages'].append("+ Ring route bonus (+300)")
    
    return score, breakdown


def group_variants_by_line_direction(geojson_data: Dict[str, Any]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    """
    Group all variants by (line_code, direction) tuple.
    
    Returns:
        Dictionary mapping (line_code, direction) to list of variant info
    """
    variants = defaultdict(list)
    
    features = geojson_data.get('features', [])
    
    for feature in features:
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})
        
        hat_kodu = properties.get('HAT_KODU', '').strip()
        yon = properties.get('YON', '').strip()
        
        if not hat_kodu or not yon:
            continue
        
        direction = map_direction(yon)
        
        flattened_coords = flatten_multilinestring(geometry)
        if not flattened_coords:
            continue
        
        variant_info = {
            'hat_kodu': hat_kodu,
            'yon': yon,
            'direction': direction,
            'point_count': count_geometry_points(geometry),
            'guzergah_kodu': properties.get('GUZERGAH_K', 'N/A'),
            'guzergah_aciklama': properties.get('GUZERGAH_A', 'N/A'),
            'uzunluk': properties.get('UZUNLUK', 'N/A'),
            'ring': properties.get('RING_MI', 'HAYIR'),
            'flattened_coords': flattened_coords
        }
        
        key = (hat_kodu, direction)
        variants[key].append(variant_info)
    
    return dict(variants)


def select_best_variants(variants_grouped: Dict[Tuple[str, str], List[Dict[str, Any]]],
                        line_routes: Dict,
                        stops_geometry: Dict,
                        debug_lines: List[str] = None) -> Dict[str, Dict[str, List[List[float]]]]:
    """
    Select best variant for each line/direction using weighted scoring.
    
    Args:
        variants_grouped: Grouped variants by (line_code, direction)
        line_routes: Trusted route data
        stops_geometry: Trusted stop coordinates
        debug_lines: List of line codes to show detailed scoring for
        
    Returns:
        Dictionary with structure: {line_code: {direction: [[lat, lng], ...]}}
    """
    shapes = {}
    
    if debug_lines is None:
        debug_lines = []
    
    print("\nSelecting best variants using weighted scoring...")
    
    for (line_code, direction), candidates in tqdm(variants_grouped.items(), desc="Processing lines"):
        
        # Get trusted endpoints
        trusted_start, trusted_end = get_trusted_endpoints(line_code, direction, line_routes, stops_geometry)
        
        # Calculate scores for all candidates
        scored_candidates = []
        
        for candidate in candidates:
            score, breakdown = calculate_variant_score(candidate, trusted_start, trusted_end, 
                                                       debug=(line_code in debug_lines))
            scored_candidates.append({
                'candidate': candidate,
                'score': score,
                'breakdown': breakdown
            })
        
        # Sort by score (descending)
        scored_candidates.sort(key=lambda x: x['score'], reverse=True)
        
        # Select winner
        winner = scored_candidates[0]
        
        # Debug output for specified lines
        if line_code in debug_lines:
            print(f"\n{'='*100}")
            print(f"DEBUG: Line {line_code} Direction {direction}")
            print(f"{'='*100}")
            print(f"Total candidates: {len(scored_candidates)}")
            print(f"Trusted endpoints available: {trusted_start is not None and trusted_end is not None}")
            
            for i, scored in enumerate(scored_candidates[:3], 1):  # Show top 3
                cand = scored['candidate']
                breakdown = scored['breakdown']
                
                print(f"\n{'─'*100}")
                print(f"Candidate #{i} (Score: {scored['score']:.1f}):")
                print(f"  Route Code: {cand['guzergah_kodu']}")
                print(f"  Description: {cand['guzergah_aciklama']}")
                print(f"  Points: {cand['point_count']:,}")
                print(f"  Ring: {cand['ring']}")
                print(f"\n  Scoring Breakdown:")
                print(f"    Spatial Match: {breakdown['spatial_match']}")
                print(f"    Detail Score: {breakdown['detail_score']:.1f}")
                print(f"    Penalties: {breakdown['penalties']}")
                print(f"    Total: {scored['score']:.1f}")
                print(f"\n  Messages:")
                for msg in breakdown['messages']:
                    print(f"    {msg}")
            
            print(f"\n{'─'*100}")
            print(f"🏆 WINNER: {winner['candidate']['guzergah_kodu']} (Score: {winner['score']:.1f})")
            print(f"{'='*100}")
        
        # Store winner
        if line_code not in shapes:
            shapes[line_code] = {}
        
        shapes[line_code][direction] = winner['candidate']['flattened_coords']
    
    return shapes


def main():
    """Main execution function."""
    print("=" * 100)
    print("IBB ROUTE SHAPE PROCESSOR V2 - INTELLIGENT VARIANT SELECTION")
    print("=" * 100)
    print()
    
    # Define paths
    project_root = Path(__file__).resolve().parents[2]
    input_path = project_root / "data" / "raw" / "ibb_hat_guzergahlari.json"
    
    if not input_path.exists():
        input_path = project_root / "data" / "raw" / "ibb_hat_guzergahlari.geojson"
    
    if not input_path.exists():
        input_path = project_root / "data" / "raw" / "Guzergahlar_181224_geojson.json"
    
    if not input_path.exists():
        print(f"❌ Error: GeoJSON file not found in data/raw/")
        return 1
    
    output_path = project_root / "frontend" / "public" / "data" / "line_shapes.json"
    
    try:
        # Load trusted reference data
        line_routes, stops_geometry = load_trusted_data(project_root)
        
        # Load GeoJSON
        print(f"\nLoading GeoJSON from: {input_path.name}")
        with open(input_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        print(f"✓ Loaded {len(geojson_data.get('features', []))} features")
        
        # Group variants
        print("\nGrouping variants by line and direction...")
        variants_grouped = group_variants_by_line_direction(geojson_data)
        print(f"✓ Found {len(variants_grouped)} unique line+direction combinations")
        
        # Count total variants vs unique lines
        total_variants = sum(len(v) for v in variants_grouped.values())
        unique_lines = len(set(key[0] for key in variants_grouped.keys()))
        print(f"  - Total variants: {total_variants}")
        print(f"  - Unique lines: {unique_lines}")
        print(f"  - Avg variants per line: {total_variants / len(variants_grouped):.1f}")
        
        # Select best variants (with debug output for problem lines)
        debug_lines = ["14KS", "19F", "76B", "15F"]
        shapes = select_best_variants(variants_grouped, line_routes, stops_geometry, debug_lines)
        
        # Save output
        output_data = {
            "version": "2.0",
            "shapes": shapes
        }
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        print(f"\nSaving output to: {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, separators=(',', ':'))
        
        file_size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"✓ Output saved successfully ({file_size_mb:.2f} MB)")
        
        # Summary statistics
        print("\n" + "=" * 100)
        print("SUMMARY STATISTICS")
        print("=" * 100)
        print(f"Lines processed: {len(shapes)}")
        print(f"Total directions: {sum(len(dirs) for dirs in shapes.values())}")
        
        # Count variants vs selections
        single_variant_lines = sum(1 for key, variants in variants_grouped.items() if len(variants) == 1)
        multi_variant_lines = len(variants_grouped) - single_variant_lines
        
        print(f"\nVariant Distribution:")
        print(f"  Single variant (no selection needed): {single_variant_lines}")
        print(f"  Multiple variants (scored & selected): {multi_variant_lines}")
        
        print("\n" + "=" * 100)
        print("✓ PROCESSING COMPLETED SUCCESSFULLY")
        print("=" * 100)
        
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        return 1
    
    except json.JSONDecodeError as e:
        print(f"\n❌ Error: Invalid JSON file")
        print(f"  {e}")
        return 1
    
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())