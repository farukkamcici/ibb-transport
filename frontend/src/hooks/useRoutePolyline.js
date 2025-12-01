'use client';
import { useState, useEffect, useCallback } from 'react';

let stopsCache = null;
let routesCache = null;
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
          fetch('/data/line_routes.json')
        ]);

        if (!stopsRes.ok || !routesRes.ok) {
          throw new Error('Failed to fetch route data');
        }

        const [stopsData, routesData] = await Promise.all([
          stopsRes.json(),
          routesRes.json()
        ]);

        stopsCache = stopsData.stops;
        routesCache = routesData.routes;
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

  const getPolyline = useCallback((lineCode, direction = 'G') => {
    const stops = getRouteStops(lineCode, direction);
    return stops.map(stop => [stop.lat, stop.lng]);
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
