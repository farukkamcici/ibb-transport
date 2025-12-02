"""
Analyze IBB Route GeoJSON topology to diagnose "spaghetti line" issues.

This script inspects the internal structure of MultiLineString geometries to understand
connectivity problems, segment ordering, and potential reversals that cause chaotic
route rendering on maps.

Input: data/raw/ibb_hat_guzergahlari.geojson
Output: Console report with topology analysis

Author: Geospatial Analysis Team
Date: 2025-12-02
"""

import json
import math
from pathlib import Path
from typing import List, Tuple, Dict, Any


def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
    """
    Calculate the great-circle distance between two points on Earth.
    
    Args:
        coord1: [lng, lat] in degrees
        coord2: [lng, lat] in degrees
        
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lng1, lat1 = coord1[0], coord1[1]
    lng2, lat2 = coord2[0], coord2[1]
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    # Haversine formula
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def euclidean_distance(coord1: List[float], coord2: List[float]) -> float:
    """
    Calculate simple Euclidean distance (faster, good for small distances).
    
    Args:
        coord1: [lng, lat] in degrees
        coord2: [lng, lat] in degrees
        
    Returns:
        Distance in degrees (approximate)
    """
    return math.sqrt((coord1[0] - coord2[0]) ** 2 + (coord1[1] - coord2[1]) ** 2)


def format_coord(coord: List[float]) -> str:
    """Format coordinate for display."""
    return f"[{coord[0]:.6f}, {coord[1]:.6f}]"


def analyze_segment_connectivity(segments: List[List[List[float]]]) -> Dict[str, Any]:
    """
    Analyze connectivity between consecutive segments.
    
    Args:
        segments: List of LineString coordinates (each is list of [lng, lat] points)
        
    Returns:
        Dictionary with analysis results
    """
    total_segments = len(segments)
    connectivity_issues = []
    reverse_candidates = []
    
    for i in range(total_segments - 1):
        current_seg = segments[i]
        next_seg = segments[i + 1]
        
        if not current_seg or not next_seg:
            continue
        
        current_end = current_seg[-1]
        current_start = current_seg[0]
        next_start = next_seg[0]
        next_end = next_seg[-1]
        
        # Calculate all possible connection distances
        end_to_start = haversine_distance(current_end, next_start)  # Normal order
        end_to_end = haversine_distance(current_end, next_end)      # Next reversed?
        start_to_start = haversine_distance(current_start, next_start)  # Current reversed?
        start_to_end = haversine_distance(current_start, next_end)  # Both reversed?
        
        # Find minimum distance (best connection)
        distances = {
            'end_to_start': end_to_start,
            'end_to_end': end_to_end,
            'start_to_start': start_to_start,
            'start_to_end': start_to_end
        }
        
        min_connection = min(distances, key=distances.get)
        min_distance = distances[min_connection]
        
        # Check for issues
        issue = {
            'segment_pair': (i, i + 1),
            'current_start': current_start,
            'current_end': current_end,
            'next_start': next_start,
            'next_end': next_end,
            'distances': distances,
            'best_connection': min_connection,
            'best_distance_km': min_distance,
            'has_gap': min_distance > 0.1,  # > 100 meters
            'likely_reversed': min_connection != 'end_to_start'
        }
        
        if issue['has_gap'] or issue['likely_reversed']:
            connectivity_issues.append(issue)
        
        # Detect probable reversals
        if min_connection == 'end_to_end' and min_distance < 0.01:
            reverse_candidates.append({
                'segment': i + 1,
                'reason': 'Next segment appears reversed (current_end connects to next_end)',
                'distance_km': min_distance
            })
        elif min_connection == 'start_to_start' and min_distance < 0.01:
            reverse_candidates.append({
                'segment': i,
                'reason': 'Current segment appears reversed (current_start connects to next_start)',
                'distance_km': min_distance
            })
    
    return {
        'total_segments': total_segments,
        'connectivity_issues': connectivity_issues,
        'reverse_candidates': reverse_candidates,
        'has_issues': len(connectivity_issues) > 0
    }


def analyze_line_geometry(line_code: str, direction: str, geojson_data: Dict[str, Any]) -> None:
    """
    Analyze a specific line's geometry structure.
    
    Args:
        line_code: Line code (e.g., "76B")
        direction: Direction ("GİDİŞ" or "DÖNÜŞ")
        geojson_data: Parsed GeoJSON data
    """
    features = geojson_data.get('features', [])
    
    # Find the feature
    target_feature = None
    for feature in features:
        props = feature.get('properties', {})
        if props.get('HAT_KODU') == line_code and props.get('YON') == direction:
            target_feature = feature
            break
    
    if not target_feature:
        print(f"\n❌ Line {line_code} (Direction: {direction}) not found in GeoJSON.")
        return
    
    geometry = target_feature.get('geometry', {})
    geo_type = geometry.get('type', '')
    coordinates = geometry.get('coordinates', [])
    
    print("\n" + "=" * 80)
    print(f"ROUTE TOPOLOGY ANALYSIS")
    print("=" * 80)
    print(f"Line Code: {line_code}")
    print(f"Direction: {direction}")
    print(f"Geometry Type: {geo_type}")
    print(f"Total Segments: {len(coordinates)}")
    print("=" * 80)
    
    if geo_type != 'MultiLineString':
        print(f"\n⚠️  Warning: Expected MultiLineString, got {geo_type}")
        if geo_type == 'LineString':
            print("   This is a simple LineString (no segments to analyze)")
            print(f"   Total points: {len(coordinates)}")
        return
    
    # Segment overview
    print("\n📊 SEGMENT OVERVIEW")
    print("-" * 80)
    for i, segment in enumerate(coordinates[:5]):  # Show first 5
        if not segment:
            continue
        start = segment[0]
        end = segment[-1]
        print(f"Segment {i + 1}:")
        print(f"  Points: {len(segment)}")
        print(f"  Start:  {format_coord(start)}")
        print(f"  End:    {format_coord(end)}")
        
        if i < len(coordinates) - 1:
            next_segment = coordinates[i + 1]
            if next_segment:
                next_start = next_segment[0]
                gap = haversine_distance(end, next_start)
                print(f"  Gap to next segment: {gap:.4f} km")
        print()
    
    if len(coordinates) > 5:
        print(f"... and {len(coordinates) - 5} more segments")
    
    # Connectivity analysis
    print("\n🔗 CONNECTIVITY ANALYSIS")
    print("-" * 80)
    
    analysis = analyze_segment_connectivity(coordinates)
    
    if not analysis['has_issues']:
        print("✅ All segments are well-connected (gaps < 100m)")
    else:
        print(f"⚠️  Found {len(analysis['connectivity_issues'])} connectivity issues:\n")
        
        for issue in analysis['connectivity_issues'][:10]:  # Show first 10 issues
            seg_idx = issue['segment_pair'][0]
            next_idx = issue['segment_pair'][1]
            
            print(f"Issue between Segment {seg_idx + 1} → Segment {next_idx + 1}:")
            print(f"  Seg {seg_idx + 1} ends at:   {format_coord(issue['current_end'])}")
            print(f"  Seg {next_idx + 1} starts at: {format_coord(issue['next_start'])}")
            print(f"\n  Connection Distances:")
            print(f"    End→Start (normal):      {issue['distances']['end_to_start']:.4f} km")
            print(f"    End→End (next reversed): {issue['distances']['end_to_end']:.4f} km")
            print(f"    Start→Start (curr rev):  {issue['distances']['start_to_start']:.4f} km")
            print(f"    Start→End (both rev):    {issue['distances']['start_to_end']:.4f} km")
            print(f"\n  ✓ Best connection: {issue['best_connection']} ({issue['best_distance_km']:.4f} km)")
            
            if issue['has_gap']:
                print(f"  ⚠️  GAP DETECTED: {issue['best_distance_km']:.4f} km")
            if issue['likely_reversed']:
                print(f"  🔄 REVERSAL SUSPECTED: {issue['best_connection']}")
            print()
        
        if len(analysis['connectivity_issues']) > 10:
            print(f"... and {len(analysis['connectivity_issues']) - 10} more issues")
    
    # Reversal candidates
    print("\n🔄 REVERSAL DETECTION")
    print("-" * 80)
    
    if not analysis['reverse_candidates']:
        print("✅ No obvious segment reversals detected")
    else:
        print(f"⚠️  Found {len(analysis['reverse_candidates'])} probable reversals:\n")
        for candidate in analysis['reverse_candidates'][:10]:
            print(f"  Segment {candidate['segment'] + 1}:")
            print(f"    Reason: {candidate['reason']}")
            print(f"    Distance: {candidate['distance_km']:.6f} km")
            print()
    
    # Conclusion
    print("\n📋 CONCLUSION")
    print("-" * 80)
    
    if not analysis['has_issues']:
        print("✅ Route geometry appears well-formed")
        print("   - All segments are connected")
        print("   - No reversals detected")
        print("   - Flattening should work correctly")
    else:
        print("⚠️  Route geometry has structural issues:")
        print(f"   - {len(analysis['connectivity_issues'])} connectivity problems")
        print(f"   - {len(analysis['reverse_candidates'])} suspected reversals")
        print("\n💡 RECOMMENDATIONS:")
        print("   1. Implement segment reordering algorithm")
        print("   2. Check for reversed segments and flip coordinates")
        print("   3. Consider using topology-aware routing algorithms")
        print("   4. Fill small gaps (<100m) with linear interpolation")
    
    print("=" * 80)


def main():
    """
    Main execution function.
    """
    print("=" * 80)
    print("IBB ROUTE TOPOLOGY ANALYZER")
    print("=" * 80)
    
    # Define paths
    project_root = Path(__file__).resolve().parents[2]
    input_path = project_root / "data" / "raw" / "ibb_hat_guzergahlari.geojson"
    
    # Try alternative extensions
    if not input_path.exists():
        input_path = project_root / "data" / "raw" / "ibb_hat_guzergahlari.json"
    
    if not input_path.exists():
        print(f"\n❌ Error: GeoJSON file not found at {input_path}")
        return 1
    
    # Load data
    print(f"\nLoading: {input_path.name}")
    with open(input_path, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)
    
    print(f"✓ Loaded {len(geojson_data.get('features', []))} features")
    
    # Analyze specific lines
    test_cases = [
        ("76B", "GİDİŞ"),
        ("19F", "GİDİŞ"),
        ("500T", "GİDİŞ"),
    ]
    
    for line_code, direction in test_cases:
        try:
            analyze_line_geometry(line_code, direction, geojson_data)
        except Exception as e:
            print(f"\n❌ Error analyzing {line_code} ({direction}): {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("✓ Analysis complete")
    print("=" * 80)
    
    return 0


if __name__ == "__main__":
    exit(main())