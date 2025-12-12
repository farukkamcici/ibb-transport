/**
 * useMetroSchedule Hook
 * 
 * Fetches and manages live train arrival data for metro stations.
 * Auto-refreshes every 30 seconds when active.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMetroSchedule } from '@/lib/metroApi';

const REFRESH_INTERVAL = 30000; // 30 seconds

export default function useMetroSchedule(stationId, directionId, options = {}) {
  const { autoRefresh = true, enabled = true } = options;

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  const isMounted = useRef(true);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!stationId || !directionId || !enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getMetroSchedule(stationId, directionId);

      if (isMounted.current) {
        setSchedule(data);
        setLastFetchTime(new Date());
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.message || 'Failed to fetch train schedule');
        setSchedule(null);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [stationId, directionId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh || !enabled || !stationId || !directionId) {
      return;
    }

    refreshTimerRef.current = setInterval(() => {
      fetchSchedule();
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, enabled, stationId, directionId, fetchSchedule]);

  /**
   * Get next N arriving trains.
   */
  const getNextTrains = useCallback((count = 3) => {
    if (!schedule?.Success || !schedule?.Data) {
      return [];
    }

    // Format A: Backend returns "live arrivals" already.
    // Expected items: {RemainingMinutes, ArrivalTime, DestinationStationName, TrainId}
    const looksLikeLiveArrivals = Array.isArray(schedule.Data)
      && schedule.Data.some((item) => typeof item?.RemainingMinutes === 'number');

    if (looksLikeLiveArrivals) {
      return schedule.Data
        .filter(train => train.RemainingMinutes != null)
        .sort((a, b) => a.RemainingMinutes - b.RemainingMinutes)
        .slice(0, count);
    }

    // Format B: Cached/raw GetTimeTable payload (Data[0].TimeInfos[].Times[] = ["HH:MM"]).
    // Convert next departure times into pseudo "arrivals" with RemainingMinutes.
    const timeInfos = schedule?.Data?.[0]?.TimeInfos;
    const times = timeInfos?.Times;
    if (!Array.isArray(times) || times.length === 0) {
      return [];
    }

    const destination = schedule?.Data?.[0]?.LastStation || schedule?.Data?.[0]?.Direction || null;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const next = times
      .map((timeStr) => {
        if (typeof timeStr !== 'string') {
          return null;
        }
        const [hRaw, mRaw] = timeStr.split(':');
        const hours = Number(hRaw);
        const minutes = Number(mRaw);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
          return null;
        }
        const totalMinutes = hours * 60 + minutes;
        const diff = totalMinutes - nowMinutes;
        if (diff < 0) {
          return null;
        }

        return {
          TrainId: `TT-${stationId}-${directionId}-${timeStr}`,
          DestinationStationName: destination,
          RemainingMinutes: diff,
          ArrivalTime: timeStr,
        };
      })
      .filter(Boolean)
      .slice(0, count);

    return next;
  }, [schedule, stationId, directionId]);

  /**
   * Check if there are trains arriving soon (within N minutes).
   */
  const hasTrainsSoon = useCallback((withinMinutes = 5) => {
    const nextTrains = getNextTrains(1);
    return nextTrains.length > 0 && nextTrains[0].RemainingMinutes <= withinMinutes;
  }, [getNextTrains]);

  return {
    schedule,
    loading,
    error,
    lastFetchTime,
    getNextTrains,
    hasTrainsSoon,
    refresh: fetchSchedule
  };
}
