"""
Analyze route variants in IBB GeoJSON dataset to determine selection logic.

This script identifies lines with multiple variants (e.g., main routes vs depot runs)
and provides side-by-side comparison of their properties to help decide which
variant to use for map rendering.

Input: data/raw/Guzergahlar_181224_geojson.json (or .geojson)
Output: Console report with variant comparisons

Author: Data Engineering Team
Date: 2025-12-02
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict


def load_geojson(file_path: Path) -> Dict[str, Any]:
    """
    Load GeoJSON file from disk.
    
    Args:
        file_path: Path to the GeoJSON file
        
    Returns:
        Parsed GeoJSON data as dictionary
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        json.JSONDecodeError: If the file is not valid JSON
    """
    if not file_path.exists():
        raise FileNotFoundError(f"GeoJSON file not found: {file_path}")
    
    print(f"Loading GeoJSON from: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"✓ Loaded {len(data.get('features', []))} features\n")
    return data


def count_geometry_points(geometry: Dict[str, Any]) -> int:
    """
    Count total coordinate points in a geometry.
    
    Args:
        geometry: GeoJSON geometry object
        
    Returns:
        Total number of coordinate points
    """
    if not geometry or 'coordinates' not in geometry:
        return 0
    
    geo_type = geometry.get('type', '')
    coordinates = geometry['coordinates']
    
    if geo_type == 'MultiLineString':
        # MultiLineString: [ [ [lng, lat], [lng, lat] ], [ [lng, lat], [lng, lat] ] ]
        return sum(len(segment) for segment in coordinates if segment)
    
    elif geo_type == 'LineString':
        # LineString: [ [lng, lat], [lng, lat], [lng, lat] ]
        return len(coordinates)
    
    else:
        return 0


def extract_variant_info(feature: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract relevant variant information from a feature.
    
    Args:
        feature: GeoJSON feature
        
    Returns:
        Dictionary with variant metadata
    """
    properties = feature.get('properties', {})
    geometry = feature.get('geometry', {})
    
    point_count = count_geometry_points(geometry)
    
    # Determine detail level based on point count
    if point_count > 1000:
        detail_level = "Very High Detail"
    elif point_count > 500:
        detail_level = "High Detail"
    elif point_count > 200:
        detail_level = "Medium Detail"
    elif point_count > 50:
        detail_level = "Low Detail"
    else:
        detail_level = "Very Low Detail"
    
    return {
        'hat_kodu': properties.get('HAT_KODU', 'N/A'),
        'yon': properties.get('YON', 'N/A'),
        'point_count': point_count,
        'detail_level': detail_level,
        'uzunluk': properties.get('UZUNLUK', 'N/A'),
        'guzergah_kodu': properties.get('GUZERGAH_K', 'N/A'),
        'guzergah_aciklama': properties.get('GUZERGAH_A', 'N/A'),
        'ring': properties.get('RING_MI', 'N/A'),
        'hat_adi': properties.get('HAT_ADI', 'N/A'),
        'segment_count': len(geometry.get('coordinates', [])) if geometry.get('type') == 'MultiLineString' else 1
    }


def group_variants_by_line(geojson_data: Dict[str, Any], target_lines: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group all variants by line code.
    
    Args:
        geojson_data: Parsed GeoJSON data
        target_lines: List of line codes to analyze
        
    Returns:
        Dictionary mapping line codes to list of variant info
    """
    variants = defaultdict(list)
    
    features = geojson_data.get('features', [])
    
    for feature in features:
        properties = feature.get('properties', {})
        hat_kodu = properties.get('HAT_KODU', '').strip()
        
        if hat_kodu in target_lines:
            variant_info = extract_variant_info(feature)
            variants[hat_kodu].append(variant_info)
    
    return dict(variants)


def print_variant_comparison(line_code: str, variants: List[Dict[str, Any]]) -> None:
    """
    Print detailed comparison of variants for a single line.
    
    Args:
        line_code: Line code (e.g., "14KS")
        variants: List of variant information dictionaries
    """
    print("\n" + "=" * 100)
    print(f"ANALYSIS FOR LINE: {line_code}")
    print("=" * 100)
    
    if not variants:
        print("  ⚠️  No variants found for this line")
        return
    
    # Group by direction
    gidis_variants = [v for v in variants if v['yon'] == 'GİDİŞ']
    donus_variants = [v for v in variants if v['yon'] == 'DÖNÜŞ']
    
    # Print GİDİŞ variants
    if gidis_variants:
        print(f"\n📍 DIRECTION: GİDİŞ (Forward) - {len(gidis_variants)} variant(s)")
        print("-" * 100)
        
        # Sort by point count (descending) to show most detailed first
        gidis_variants.sort(key=lambda x: x['point_count'], reverse=True)
        
        for i, variant in enumerate(gidis_variants, 1):
            print(f"\nVariant #{i}:")
            print(f"  📊 Points:       {variant['point_count']:,} ({variant['detail_level']})")
            print(f"  📏 Length:       {variant['uzunluk']}")
            print(f"  🔑 Route Code:   {variant['guzergah_kodu']}")
            print(f"  📝 Description:  {variant['guzergah_aciklama']}")
            print(f"  ⭕ Ring:         {variant['ring']}")
            print(f"  🧩 Segments:     {variant['segment_count']}")
            
            # Highlight if this appears to be depot/garage route
            desc_lower = variant['guzergah_aciklama'].lower()
            if 'garaj' in desc_lower or 'depo' in desc_lower or 'depar' in desc_lower:
                print(f"  ⚠️  WARNING: Possible depot/garage route")
    
    # Print DÖNÜŞ variants
    if donus_variants:
        print(f"\n📍 DIRECTION: DÖNÜŞ (Return) - {len(donus_variants)} variant(s)")
        print("-" * 100)
        
        # Sort by point count (descending)
        donus_variants.sort(key=lambda x: x['point_count'], reverse=True)
        
        for i, variant in enumerate(donus_variants, 1):
            print(f"\nVariant #{i}:")
            print(f"  📊 Points:       {variant['point_count']:,} ({variant['detail_level']})")
            print(f"  📏 Length:       {variant['uzunluk']}")
            print(f"  🔑 Route Code:   {variant['guzergah_kodu']}")
            print(f"  📝 Description:  {variant['guzergah_aciklama']}")
            print(f"  ⭕ Ring:         {variant['ring']}")
            print(f"  🧩 Segments:     {variant['segment_count']}")
            
            # Highlight if this appears to be depot/garage route
            desc_lower = variant['guzergah_aciklama'].lower()
            if 'garaj' in desc_lower or 'depo' in desc_lower or 'depar' in desc_lower:
                print(f"  ⚠️  WARNING: Possible depot/garage route")
    
    # Recommendation
    print("\n💡 RECOMMENDATION")
    print("-" * 100)
    
    if len(variants) == 2 and len(gidis_variants) == 1 and len(donus_variants) == 1:
        print("✅ Clean structure: 1 GİDİŞ + 1 DÖNÜŞ variant")
        print("   → Use both variants as-is")
    elif len(variants) > 2:
        print("⚠️  Multiple variants detected. Selection logic needed:")
        print("   1. Prefer variants with highest point count (most detailed)")
        print("   2. Exclude depot/garage routes (check description)")
        print("   3. Prefer ring routes (RING_MI = EVET) if available")
        print("   4. Check if GUZERGAH_KODU contains 'D' prefix (depot indicator)")
        
        # Suggest best candidates
        if gidis_variants:
            best_gidis = max(gidis_variants, key=lambda x: x['point_count'])
            print(f"\n   Best GİDİŞ candidate: {best_gidis['guzergah_kodu']}")
            print(f"     - {best_gidis['point_count']:,} points, {best_gidis['detail_level']}")
        
        if donus_variants:
            best_donus = max(donus_variants, key=lambda x: x['point_count'])
            print(f"\n   Best DÖNÜŞ candidate: {best_donus['guzergah_kodu']}")
            print(f"     - {best_donus['point_count']:,} points, {best_donus['detail_level']}")
    else:
        print("⚠️  Unusual structure (missing direction?)")
        print("   → Manual inspection required")


def print_summary_table(all_variants: Dict[str, List[Dict[str, Any]]]) -> None:
    """
    Print summary table of all analyzed lines.
    
    Args:
        all_variants: Dictionary mapping line codes to variants
    """
    print("\n" + "=" * 100)
    print("SUMMARY TABLE")
    print("=" * 100)
    print(f"{'Line':<10} {'Total':>8} {'GİDİŞ':>8} {'DÖNÜŞ':>8} {'Status':<20}")
    print("-" * 100)
    
    for line_code in sorted(all_variants.keys()):
        variants = all_variants[line_code]
        gidis_count = sum(1 for v in variants if v['yon'] == 'GİDİŞ')
        donus_count = sum(1 for v in variants if v['yon'] == 'DÖNÜŞ')
        total = len(variants)
        
        if total == 2 and gidis_count == 1 and donus_count == 1:
            status = "✅ Clean"
        elif total > 2:
            status = "⚠️  Multiple variants"
        else:
            status = "⚠️  Incomplete"
        
        print(f"{line_code:<10} {total:>8} {gidis_count:>8} {donus_count:>8} {status:<20}")
    
    print("=" * 100)


def main():
    """
    Main execution function.
    """
    print("=" * 100)
    print("IBB ROUTE VARIANT ANALYZER")
    print("=" * 100)
    print()
    
    # Define paths
    project_root = Path(__file__).resolve().parents[2]
    
    # Try multiple possible filenames
    possible_files = [
        "Guzergahlar_181224_geojson.json",
        "Guzergahlar_181224_geojson.geojson",
        "ibb_hat_guzergahlari.json",
        "ibb_hat_guzergahlari.geojson"
    ]
    
    input_path = None
    for filename in possible_files:
        test_path = project_root / "data" / "raw" / filename
        if test_path.exists():
            input_path = test_path
            break
    
    if not input_path:
        print(f"❌ Error: GeoJSON file not found. Tried:")
        for filename in possible_files:
            print(f"   - data/raw/{filename}")
        return 1
    
    try:
        # Load data
        geojson_data = load_geojson(input_path)
        
        # Define target lines with known issues
        target_lines = ["14KS", "19F", "76B", "15F"]
        
        print(f"🎯 Target lines for analysis: {', '.join(target_lines)}")
        print()
        
        # Group variants
        print("Analyzing variants...")
        all_variants = group_variants_by_line(geojson_data, target_lines)
        
        if not all_variants:
            print("❌ No variants found for any target lines")
            return 1
        
        # Print summary table
        print_summary_table(all_variants)
        
        # Print detailed comparison for each line
        for line_code in sorted(all_variants.keys()):
            print_variant_comparison(line_code, all_variants[line_code])
        
        # Final summary
        print("\n" + "=" * 100)
        print("✓ ANALYSIS COMPLETE")
        print("=" * 100)
        
        total_lines = len(all_variants)
        total_variants = sum(len(variants) for variants in all_variants.values())
        
        print(f"\nAnalyzed {total_lines} line(s) with {total_variants} total variant(s)")
        print("\nNext steps:")
        print("  1. Review variant details above")
        print("  2. Implement selection logic in process_route_shapes.py")
        print("  3. Prioritize: Highest point count + Exclude depot routes")
        print("  4. Test selected variants on map")
        
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
