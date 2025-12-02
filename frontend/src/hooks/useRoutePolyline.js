'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api';

let stopsCache = null;
let routesCache = null;
const shapesCache = new Map();
const pendingRequests = new Map();
const MAX_CACHE_SIZE = 100;
let loadingPromise = null;

export default function useRoutePolyline() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (stopsCache && routesCache) {
      return;
    }

    if (loadingPromise) {
      return;
    }

    loadingPromise = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [stopsRes, routesRes] = await Promise.all([
          fetch('/data/stops_geometry.json'),
          fetch('/data/line_routes.json'),
        ]);

        if (!stopsRes.ok || !routesRes.ok) {
          throw new Error('Failed to fetch route data');
        }

        const [stopsData, routesData] = await Promise.all([
          stopsRes.json(),
          routesRes.json(),
        ]);

        stopsCache = stopsData.stops;
        routesCache = routesData.routes;

        console.log(`Route data loaded successfully:
  - Stops: ${Object.keys(stopsCache).length}
  - Routes: ${Object.keys(routesCache).length}`);

      } catch (err) {
        console.error('Error loading route data:', err);
        setError(err.message);
        stopsCache = {};
        routesCache = {};
      } finally {
        setIsLoading(false);
        loadingPromise = null;
      }
    })();

    loadingPromise.catch(() => {});
  }, []);

  const getRouteStops = useCallback((lineCode, direction = 'G') => {
    if (!stopsCache || !routesCache) {
      return [];
    }

    const lineRoutes = routesCache[lineCode];
    if (!lineRoutes) {
      return [];
    }

    const stopCodes = lineRoutes[direction];
    if (!stopCodes || !Array.isArray(stopCodes)) {
      return [];
    }

    const stops = [];
    for (const stopCode of stopCodes) {
      const stop = stopsCache[stopCode];
      if (stop && stop.lat && stop.lng) {
        stops.push({
          code: stopCode,
          name: stop.name || 'Unknown Stop',
          lat: stop.lat,
          lng: stop.lng,
          district: stop.district
        });
      }
    }

    return stops;
  }, []);

  const getPolyline = useCallback(async (lineCode, direction = 'G') => {
    if (!stopsCache || !routesCache) {
      return [];
    }

    const cacheKey = `${lineCode}-${direction}`;
    
    if (shapesCache.has(cacheKey)) {
      return shapesCache.get(cacheKey);
    }

    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await apiClient.get(`/lines/${lineCode}/route`);
        const routeData = response.data;
        
        if (!routeData || typeof routeData !== 'object') {
          throw new Error('Invalid route data format');
        }

        const directionCoords = routeData[direction];
        
        if (!directionCoords || !Array.isArray(directionCoords) || directionCoords.length === 0) {
          console.warn(`No route data for ${lineCode} direction ${direction}, falling back to stops`);
          const stops = getRouteStops(lineCode, direction);
          const fallbackCoords = stops.map(stop => [stop.lat, stop.lng]);
          shapesCache.set(cacheKey, fallbackCoords);
          return fallbackCoords;
        }

        if (shapesCache.size >= MAX_CACHE_SIZE) {
          const firstKey = shapesCache.keys().next().value;
          shapesCache.delete(firstKey);
        }

        shapesCache.set(cacheKey, directionCoords);
        return directionCoords;
        
      } catch (error) {
        console.warn(`Failed to fetch route shape for ${lineCode}-${direction} from API, falling back to stops.`, error);
        const stops = getRouteStops(lineCode, direction);
        const fallbackCoords = stops.map(stop => [stop.lat, stop.lng]);
        return fallbackCoords;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }, [getRouteStops]);

  const getDirectionInfo = useCallback((lineCode) => {
    if (!stopsCache || !routesCache) {
      return {};
    }

    const lineRoutes = routesCache[lineCode];
    if (!lineRoutes) {
      return {};
    }

    const directions = {};

    Object.keys(lineRoutes).forEach(dir => {
      const stopCodes = lineRoutes[dir];
      if (!stopCodes || stopCodes.length === 0) {
        return;
      }

      const firstStopCode = stopCodes[0];
      const lastStopCode = stopCodes[stopCodes.length - 1];

      const firstStop = stopsCache[firstStopCode];
      const lastStop = stopsCache[lastStopCode];

      const firstStopName = firstStop?.name || 'Unknown';
      const lastStopName = lastStop?.name || 'Unknown';

      const formatStopName = (name) => {
        return name
          .toUpperCase()
          .replace(/\s+MAH\.?$/i, '')
          .replace(/\s+CAD\.?$/i, '')
          .replace(/\s+SOK\.?$/i, '')
          .trim();
      };

      directions[dir] = {
        label: `${formatStopName(lastStopName)} Yönü`,
        firstStop: firstStopName,
        lastStop: lastStopName,
        firstStopCode,
        lastStopCode
      };
    });

    return directions;
  }, []);

  const getAvailableDirections = useCallback((lineCode) => {
    if (!routesCache) {
      return [];
    }

    const lineRoutes = routesCache[lineCode];
    if (!lineRoutes) {
      return [];
    }

    return Object.keys(lineRoutes);
  }, []);

  return {
    getPolyline,
    getRouteStops,
    getDirectionInfo,
    getAvailableDirections,
    isLoading,
    error
  };
}
