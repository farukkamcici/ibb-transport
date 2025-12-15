'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Calendar, ChevronRight, TrainFront, Ship, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function ScheduleWidget({ lineCode, direction, onShowFullSchedule, compact = false, limit = 3, transportType = null, onScheduleSummary = null }) {
  const t = useTranslations('schedule');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lineCode) return;

    // Only fetch schedule for Bus and Metrobus (transport_type_id: 1)
    const isBusOrMetrobus = !transportType || transportType.id === 1;
    if (!isBusOrMetrobus) {
      setLoading(false);
      onScheduleSummary?.({
        type: 'BUS',
        lineCode,
        direction,
        hasTrips: false,
        firstDeparture: null,
        lastDeparture: null,
        status: 'unsupported',
        dataStatus: null
      });
      return;
    }

    const fetchSchedule = async () =>{
      setLoading(true);
      setError(null);
      setSchedule(null);
      onScheduleSummary?.({
        type: 'BUS',
        lineCode,
        direction,
        hasTrips: false,
        firstDeparture: null,
        lastDeparture: null,
        status: 'loading',
        dataStatus: null
      });
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lines/${lineCode}/schedule`);
        if (!response.ok) throw new Error('Failed to fetch schedule');
        const data = await response.json();
        setSchedule(data);
      } catch (err) {
        console.error('Schedule fetch error:', err);
        setError(err.message);
        onScheduleSummary?.({
          type: 'BUS',
          lineCode,
          direction,
          hasTrips: false,
          firstDeparture: null,
          lastDeparture: null,
          status: 'error',
          dataStatus: null
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [lineCode, transportType, direction, onScheduleSummary]);

  useEffect(() => {
    if (!onScheduleSummary) return;
    if (!schedule) return;

    const directionSchedule = schedule[direction] || [];
    onScheduleSummary({
      type: 'BUS',
      lineCode,
      direction,
      hasTrips: directionSchedule.length > 0,
      firstDeparture: directionSchedule[0] || null,
      lastDeparture: directionSchedule[directionSchedule.length - 1] || null,
      status: directionSchedule.length > 0 ? 'success' : 'empty',
      dataStatus: schedule?.data_status ?? null
    });
  }, [schedule, direction, lineCode, onScheduleSummary]);

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

  // Marmaray: Show empty state without schedule requirement
  const isMarmaray = lineCode === 'MARMARAY';
  
  if (isMarmaray) {
    return (
      <div className={cn(
        "rounded-xl bg-slate-800/50 border border-white/5",
        compact ? "p-2.5 h-full flex flex-col" : "p-4"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <TrainFront size={14} className="text-purple-400" />
          <h3 className="text-xs font-medium text-gray-300">{t('plannedTrips')}</h3>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-2">
          <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Info size={12} className="text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-purple-300">Tarife bilgisi mevcut değil</p>
              <p className="text-[10px] text-gray-400 mt-1">Marmaray için sefer bilgisi henüz entegre edilmedi.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Metro: Show frequency info card
  if (transportType && transportType.id === 2) {
    return (
      <div className={cn(
        "rounded-xl bg-slate-800/50 border border-white/5",
        compact ? "p-2.5 h-full flex flex-col" : "p-4"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <TrainFront size={14} className="text-purple-400" />
          <h3 className="text-xs font-medium text-gray-300">{t('plannedTrips')}</h3>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-2">
          <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Info size={12} className="text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-purple-300">Sefer Sıklığı: 3-8 dk</p>
              <p className="text-[10px] text-gray-400 mt-1">Canlı takip verisi bu hat tipi için henüz aktif değil.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ferry: Show pier info card
  if (transportType && transportType.id === 3) {
    return (
      <div className={cn(
        "rounded-xl bg-slate-800/50 border border-white/5",
        compact ? "p-2.5 h-full flex flex-col" : "p-4"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Ship size={14} className="text-cyan-400" />
          <h3 className="text-xs font-medium text-gray-300">{t('plannedTrips')}</h3>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-2">
          <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Info size={12} className="text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-cyan-300">Tarife için iskeleye danışınız</p>
              <p className="text-[10px] text-gray-400 mt-1">Vapur seferleri hava koşullarına göre değişiklik gösterebilir.</p>
            </div>
          </div>
        </div>
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
          <Clock size={14} className="text-secondary" />
          <h3 className="text-xs font-medium text-gray-400">{t('upcomingDepartures')}</h3>
        </div>
        <p className="text-xs text-gray-500">{t('noScheduleAvailable')}</p>
      </div>
    );
  }

  const directionSchedule = schedule[direction] || [];
  const upcomingTrips = getUpcomingDepartures(directionSchedule);
  const { first: firstDeparture, last: lastDeparture } = getFirstLastDepartures(directionSchedule);

  if (compact) {
    return (
      <div 
        onClick={onShowFullSchedule}
        className="rounded-xl bg-slate-800/50 border border-white/5 p-2 cursor-pointer hover:bg-slate-800/70 transition-colors h-full flex flex-col"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <Clock size={11} className="text-secondary" />
            <h3 className="text-[10px] font-medium text-gray-400">{t('plannedTrips')}</h3>
          </div>
          <ChevronRight size={11} className="text-gray-500" />
        </div>

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

        {upcomingTrips.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-2">
            <p className="text-[10px] text-gray-500">{t('noMoreTrips')}</p>
          </div>
        ) : (
          <>
            {/* Desktop: Vertical List */}
            <div className="hidden md:block space-y-1 flex-1">
              {upcomingTrips.map((trip, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center justify-between px-1.5 py-1 rounded border",
                    idx === 0 
                      ? "bg-blue-500/10 border-blue-500/30" 
                      : "bg-slate-700/30 border-white/5"
                  )}
                >
                  <span className={cn(
                    "text-xs font-bold",
                    idx === 0 ? "text-blue-400" : "text-gray-300"
                  )}>
                    {trip.timeStr}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)}h ${trip.diff % 60}m`}
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile: Horizontal Cards */}
            <div className="flex md:hidden gap-1.5 flex-1 items-center">
              {upcomingTrips.map((trip, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center rounded-md py-1.5 px-1 border min-w-0",
                    idx === 0 
                      ? "bg-blue-500/10 border-blue-500/30" 
                      : "bg-slate-700/30 border-white/5"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold truncate",
                    idx === 0 ? "text-blue-400" : "text-gray-300"
                  )}>
                    {trip.timeStr}
                  </span>
                  <span className="text-[9px] text-gray-500 mt-0.5 truncate">
                    {trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)}h ${trip.diff % 60}m`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800 border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-secondary" />
        <h3 className="text-sm font-medium text-gray-300">{t('upcomingDepartures')}</h3>
      </div>

      {upcomingTrips.length === 0 ? (
        <div className="py-4 text-center">
          <Calendar size={24} className="mx-auto mb-2 text-gray-500" />
          <p className="text-xs text-gray-500">{t('noMoreTrips')}</p>
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {upcomingTrips.map((trip, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg border",
                idx === 0
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-slate-700/50 border-white/5"
              )}
            >
              <span className={cn(
                "text-sm font-bold",
                idx === 0 ? "text-blue-400" : "text-gray-300"
              )}>
                {trip.timeStr}
              </span>
              <span className="text-xs text-gray-500">
                {trip.diff < 60 ? `${trip.diff} ${t('minutes')}` : `${Math.floor(trip.diff / 60)}:${String(trip.diff % 60).padStart(2, '0')} ${t('hours')}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onShowFullSchedule}
        className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium text-gray-300 transition-colors border border-white/5"
      >
        {t('seeFullSchedule')}
      </button>
    </div>
  );
}
