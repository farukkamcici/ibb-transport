'use client';

import { useMemo } from 'react';
import { X, TrainFront, Loader, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import useMetroSchedule from '@/hooks/useMetroSchedule';

const formatMinutes = (value) => {
  if (value == null) return '—';
  if (value <= 0) return '<1';
  return value;
};

export default function MetroStationInfoCard({ station, lineName, directionId, onClose }) {
  const tSchedule = useTranslations('schedule');
  const tCommon = useTranslations('common');

  const stationDirections = useMemo(() => {
    return station?.directions || [];
  }, [station]);

  const hasSelectedDirection = Boolean(directionId);
  const supportsSelectedDirection = hasSelectedDirection
    ? stationDirections.some(dir => dir.id === directionId)
    : false;
  const activeDirectionId = hasSelectedDirection && supportsSelectedDirection ? directionId : null;

  const activeDirection = useMemo(() => {
    if (!activeDirectionId) {
      return null;
    }
    return stationDirections.find(dir => dir.id === activeDirectionId) || null;
  }, [stationDirections, activeDirectionId]);

  const {
    loading,
    error,
    getNextTrains,
    lastFetchTime
  } = useMetroSchedule(station?.id, activeDirectionId, {
    enabled: Boolean(station?.id && activeDirectionId)
  });

  const upcomingTrains = activeDirectionId ? getNextTrains(4) : [];
  const lastUpdatedLabel = lastFetchTime
    ? `${tSchedule('lastUpdated')}: ${lastFetchTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : null;

  let content = null;

  if (!station) {
    return null;
  }

  if (!hasSelectedDirection) {
    content = (
      <p className="text-xs text-slate-400">
        {tSchedule('chooseDirectionHint')}
      </p>
    );
  } else if (!supportsSelectedDirection) {
    content = (
      <p className="text-xs text-amber-300 flex items-center gap-2">
        <AlertTriangle size={14} />
        {tSchedule('directionUnavailable')}
      </p>
    );
  } else if (loading) {
    content = (
      <div className="flex items-center justify-center py-6">
        <Loader className="animate-spin text-primary" size={18} />
      </div>
    );
  } else if (error) {
    content = (
      <p className="text-xs text-red-400 flex items-center gap-2">
        <AlertTriangle size={14} />
        {tCommon('error')}: {error}
      </p>
    );
  } else if (upcomingTrains.length === 0) {
    content = (
      <p className="text-xs text-slate-400">
        {tSchedule('noUpcomingTrains')}
      </p>
    );
  } else {
    content = (
      <div className="space-y-2">
        {upcomingTrains.map((train, idx) => (
          <div
            key={train.TrainId || `${station.id}-${activeDirectionId || 'none'}-${idx}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {train.DestinationStationName || '—'}
              </p>
              <p className="text-[11px] text-slate-400">
                {train.ArrivalTime || ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-400">
                {formatMinutes(train.RemainingMinutes)}
              </p>
              <p className="text-[11px] text-slate-400">
                {train.RemainingMinutes === 1 ? tSchedule('minute') : tSchedule('minutes')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-24 left-4 z-[950] w-80 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <TrainFront className="h-3.5 w-3.5 text-primary" />
            <span>{lineName}</span>
            {activeDirection?.name && (
              <span className="text-slate-300">• {activeDirection.name}</span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {station.description || station.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 p-1 text-slate-300 transition hover:border-white/30 hover:text-white"
          aria-label={tCommon('close')}
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          {tSchedule('liveArrivals')}
        </p>
        {content}
      </div>

      {lastUpdatedLabel && activeDirection && (
        <p className="mt-3 text-[11px] text-slate-500">
          {lastUpdatedLabel}
        </p>
      )}
    </div>
  );
}
