/**
 * MetroScheduleWidget Component
 * 
 * Displays metro schedule matching bus ScheduleWidget design.
 * Station and direction selection handled by parent (LineDetailPanel).
 */

'use client';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCachedSchedule, setCachedSchedule } from '@/lib/metroScheduleCache';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function MetroScheduleWidget({ 
  lineCode,
  stationId,
  directionId,
  compact = false, 
  limit = 3,
  onShowFullSchedule
}) {
  const t = useTranslations('schedule');
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch full day schedule from backend with cache
  useEffect(() => {
    if (!stationId || !directionId) return;

    const fetchSchedule = async () => {
      // 1. Check cache first (instant)
      const cached = getCachedSchedule(stationId, directionId);
      
      if (cached) {
        setSchedule(cached);
        setLoading(false);
        setError(null);
        // Continue to background fetch for freshness
      } else {
        setLoading(true);
      }

      // 2. Fetch fresh data (with or without cache)
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/metro/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            BoardingStationId: stationId,
            DirectionId: directionId
          })
        });
        
        if (!response.ok) {
          // If we have cache, don't show error
          if (cached) {
            console.warn('Metro API failed, using cached data');
            return;
          }
          throw new Error('Failed to fetch schedule');
        }
        
        const data = await response.json();
        
        // 3. Update cache and state
        setCachedSchedule(stationId, directionId, data);
        setSchedule(data);
        setError(null);
      } catch (err) {
        console.error('Metro schedule fetch error:', err);
        
        // If we have cache, don't show error
        if (!cached) {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [stationId, directionId]);

  // Get upcoming departures (same logic as bus)
  const getUpcomingDepartures = (times) => {
    if (!times || times.length === 0) return [];

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const futureTimes = times
      .map(timeStr => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return { timeStr, totalMinutes, diff: totalMinutes - currentMinutes };
      })
      .filter(t => t.diff >= 0)
      .sort((a, b) => a.diff - b.diff);

    return futureTimes.slice(0, limit);
  };

  // Get first and last departures
  const getFirstLastDepartures = (times) => {
    if (!times || times.length === 0) return { first: null, last: null };
    return {
      first: times[0],
      last: times[times.length - 1]
    };
  };

  if (loading) {
    return (
      <div className={cn(
        "rounded-xl bg-slate-800/50 border border-white/5",
        compact ? "p-2" : "p-4"
      )} aria-busy="true">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3">
          <SkeletonText lines={2} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className={cn(
        "rounded-xl bg-slate-800/50 border border-white/5",
        compact ? "p-2" : "p-4"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-purple-400" />
          <h3 className="text-xs font-medium text-gray-400">{t('plannedTrips')}</h3>
        </div>
        <p className="text-xs text-gray-500">{t('noScheduleAvailable')}</p>
      </div>
    );
  }

  // Extract times from schedule response
  const scheduleTimes = schedule?.Data?.[0]?.TimeInfos?.Times || [];
  const upcomingTrips = getUpcomingDepartures(scheduleTimes);
  const { first: firstDeparture, last: lastDeparture } = getFirstLastDepartures(scheduleTimes);

  if (compact) {
    return (
      <div 
        onClick={onShowFullSchedule}
        className="rounded-xl bg-slate-800/50 border border-white/5 p-2 cursor-pointer hover:bg-slate-800/70 transition-colors h-full flex flex-col"
      >
        {/* Header with Chevron - matching bus design */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-purple-400" />
            <h3 className="text-[10px] font-medium text-gray-400">{t('plannedTrips')}</h3>
          </div>
          <ChevronRight size={11} className="text-gray-500" />
        </div>

        {/* First and Last Departures - matching bus design */}
        {firstDeparture && lastDeparture && (
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-500">{t('firstDeparture')}:</span>
              <span className="text-[10px] font-bold text-emerald-400">{firstDeparture}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-500">{t('lastDeparture')}:</span>
              <span className="text-[10px] font-bold text-orange-400">{lastDeparture}</span>
            </div>
          </div>
        )}

        {/* Upcoming Trips */}
        {upcomingTrips.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-2">
            <p className="text-[10px] text-gray-500">{t('noMoreTrips')}</p>
          </div>
        ) : (
          <>
            {/* Desktop: Vertical List - matching bus design */}
            <div className="hidden md:block space-y-1 flex-1">
              {upcomingTrips.map((trip, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center justify-between px-1.5 py-1 rounded border",
                    idx === 0 
                      ? "bg-purple-500/10 border-purple-500/30" 
                      : "bg-slate-700/30 border-white/5"
                  )}
                >
                  <span className={cn(
                    "text-xs font-bold",
                    idx === 0 ? "text-purple-400" : "text-gray-300"
                  )}>
                    {trip.timeStr}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {trip.diff === 0 ? t('onPlatform') : trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)} ${t('hours')} ${trip.diff % 60} ${t('minutes')}`}
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile: Horizontal Cards - matching bus design */}
            <div className="flex md:hidden gap-1.5 flex-1 items-center">
              {upcomingTrips.map((trip, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center rounded-md py-1.5 px-1 border min-w-0",
                    idx === 0 
                      ? "bg-purple-500/10 border-purple-500/30" 
                      : "bg-slate-700/30 border-white/5"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold truncate",
                    idx === 0 ? "text-purple-400" : "text-gray-300"
                  )}>
                    {trip.timeStr}
                  </span>
                  <span className="text-[9px] text-gray-500 mt-0.5 truncate">
                    {trip.diff === 0 ? t('onPlatform') : trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)} ${t('hours')} ${trip.diff % 60} ${t('minutes')}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Non-compact version (not used but kept for consistency)
  return (
    <div className="rounded-xl bg-slate-800 border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-purple-400" />
        <h3 className="text-sm font-medium text-gray-300">{t('upcomingDepartures')}</h3>
      </div>

      {upcomingTrips.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-gray-500">{t('noMoreTrips')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingTrips.map((trip, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg border",
                idx === 0
                  ? "bg-purple-500/10 border-purple-500/30"
                  : "bg-slate-700/50 border-white/5"
              )}
            >
              <span className={cn(
                "text-sm font-bold",
                idx === 0 ? "text-purple-400" : "text-gray-300"
              )}>
                {trip.timeStr}
              </span>
              <span className="text-xs text-gray-500">
                {trip.diff === 0 ? t('onPlatform') : trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)}:${String(trip.diff % 60).padStart(2, '0')} ${t('hours')}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
