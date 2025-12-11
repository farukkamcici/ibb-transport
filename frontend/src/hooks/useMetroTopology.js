/**
 * useMetroTopology Hook
 * 
 * Provides access to metro network topology data with client-side caching.
 * Topology is static and loaded once per session.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMetroTopology } from '@/lib/metroApi';

// In-memory cache for topology (persists across component remounts)
let cachedTopology = null;
let topologyPromise = null;

export default function useMetroTopology() {
  const [topology, setTopology] = useState(cachedTopology);
  const [loading, setLoading] = useState(!cachedTopology);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // If already cached, use it
    if (cachedTopology) {
      setTopology(cachedTopology);
      setLoading(false);
      return;
    }

    // If fetch is in progress, wait for it
    if (topologyPromise) {
      topologyPromise
        .then(data => {
          if (isMounted.current) {
            setTopology(data);
            setLoading(false);
          }
        })
        .catch(err => {
          if (isMounted.current) {
            setError(err.message);
            setLoading(false);
          }
        });
      return;
    }

    // Start new fetch
    setLoading(true);
    topologyPromise = getMetroTopology();

    topologyPromise
      .then(data => {
        cachedTopology = data;
        if (isMounted.current) {
          setTopology(data);
          setError(null);
        }
      })
      .catch(err => {
        if (isMounted.current) {
          setError(err.message || 'Failed to load metro topology');
        }
      })
      .finally(() => {
        topologyPromise = null;
        if (isMounted.current) {
          setLoading(false);
        }
      });
  }, []);

  /**
   * Get all metro lines.
   */
  const getLines = useCallback(() => {
    return topology?.lines || {};
  }, [topology]);

  /**
   * Get specific line by code.
   * Handles M1 → M1A fallback for database compatibility.
   */
  const getLine = useCallback((lineCode) => {
    if (!topology?.lines) return null;
    
    // Direct match
    if (topology.lines[lineCode]) {
      return topology.lines[lineCode];
    }
    
    // Fallback: M1 → M1A (database has M1, topology has M1A/M1B)
    if (lineCode === 'M1') {
      return topology.lines['M1A'] || null;
    }
    
    return null;
  }, [topology]);

  /**
   * Get line by numeric ID.
   */
  const getLineById = useCallback((lineId) => {
    if (!topology?.lines) return null;
    
    for (const [code, line] of Object.entries(topology.lines)) {
      if (line.id === lineId) {
        return line;
      }
    }
    return null;
  }, [topology]);

  /**
   * Get all stations for a line.
   */
  const getStations = useCallback((lineCode) => {
    return topology?.lines?.[lineCode]?.stations || [];
  }, [topology]);

  /**
   * Get station by ID within a line.
   */
  const getStation = useCallback((lineCode, stationId) => {
    const stations = getStations(lineCode);
    return stations.find(s => s.id === stationId) || null;
  }, [topology, getStations]);

  /**
   * Get line coordinates for polyline.
   */
  const getLineCoordinates = useCallback((lineCode) => {
    const stations = getStations(lineCode);
    return stations
      .sort((a, b) => a.order - b.order)
      .map(s => [s.coordinates.lat, s.coordinates.lng])
      .filter(coord => coord[0] && coord[1]);
  }, [getStations]);

  /**
   * Get available directions for a station.
   */
  const getStationDirections = useCallback((lineCode, stationId) => {
    const station = getStation(lineCode, stationId);
    return station?.directions || [];
  }, [getStation]);

  /**
   * Search stations by name across all lines.
   */
  const searchStations = useCallback((query) => {
    if (!topology?.lines || !query) return [];

    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [lineCode, line] of Object.entries(topology.lines)) {
      for (const station of line.stations) {
        const nameMatch = station.name.toLowerCase().includes(searchTerm);
        const descMatch = station.description.toLowerCase().includes(searchTerm);

        if (nameMatch || descMatch) {
          results.push({
            lineCode,
            lineName: line.name,
            lineColor: line.color,
            station
          });
        }
      }
    }

    return results;
  }, [topology]);

  /**
   * Force refresh topology from backend.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    cachedTopology = null;
    topologyPromise = null;

    try {
      const data = await getMetroTopology();
      cachedTopology = data;
      if (isMounted.current) {
        setTopology(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.message || 'Failed to refresh topology');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  return {
    topology,
    loading,
    error,
    getLines,
    getLine,
    getLineById,
    getStations,
    getStation,
    getLineCoordinates,
    getStationDirections,
    searchStations,
    refresh
  };
}
