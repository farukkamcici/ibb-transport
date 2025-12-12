'use client';

import { useMemo } from 'react';
import { X, TrainFront, Loader, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import useMetroSchedule from '@/hooks/useMetroSchedule';
import useAppStore from '@/store/useAppStore';

const formatMinutes = (value) => {
  if (value == null) return '—';
  if (value <= 0) return '<1';
  return value;
};

export default function MetroStationInfoCard({ station, lineName, directionId, onClose }) {
  const tSchedule = useTranslations('schedule');
  const tCommon = useTranslations('common');

  const { metroSelection, setMetroSelection } = useAppStore();

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

  const upcomingTrains = activeDirectionId ? getNextTrains(3) : [];
  const lastUpdatedLabel = lastFetchTime
    ? `${tSchedule('lastUpdated')}: ${lastFetchTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : null;

  let content = null;

  if (!station) {
    return null;
  }

  const handleCycleDirection = () => {
    const currentLineCode = metroSelection?.lineCode || lineName;
    const currentStationId = metroSelection?.stationId || station?.id;

    if (!currentLineCode || !currentStationId) {
      return;
    }

    // Normal lines: cycle through directions available at the current station.
    const dirs = stationDirections;
    if (!Array.isArray(dirs) || dirs.length === 0) {
      return;
    }

    const currentDirId = activeDirectionId || metroSelection?.directionId || dirs[0].id;
    const currentIndex = Math.max(0, dirs.findIndex((d) => d.id === currentDirId));
    const nextDir = dirs[(currentIndex + 1) % dirs.length];

    setMetroSelection(currentLineCode, currentStationId, nextDir?.id ?? null);
  };

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
      <div className="space-y-1.5">
        {upcomingTrains.map((train, idx) => (
          <div
            key={train.TrainId || `${station.id}-${activeDirectionId || 'none'}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
          >
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/90">
              {train.DestinationStationName || '—'}
            </p>
            <div className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              {formatMinutes(train.RemainingMinutes)}{' '}
              {train.RemainingMinutes === 1 ? tSchedule('minute') : tSchedule('minutes')}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[950] flex items-start justify-center px-4 pt-20 md:items-end md:justify-end md:px-10 md:pb-24 md:pt-0">
      <div className="pointer-events-auto w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl md:max-w-sm">
        {/* Compact header bar */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
              <TrainFront className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-white/80">{lineName}</span>
              {activeDirection?.name && (
                <span className="text-slate-300">• {activeDirection.name}</span>
              )}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-white truncate">
              {station.description || station.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCycleDirection}
              className="rounded-full border border-white/10 p-1 text-slate-300 transition hover:border-white/30 hover:text-white"
              aria-label={tSchedule('selectDirection')}
              title={tSchedule('selectDirection')}
              disabled={stationDirections.length <= 1}
            >
              <ArrowLeftRight size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 p-1 text-slate-300 transition hover:border-white/30 hover:text-white"
              aria-label={tCommon('close')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 py-3">
          <div className="max-h-[32vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent">
            {content}
          </div>

          {lastUpdatedLabel && activeDirection && (
            <p className="mt-2 text-[10px] text-slate-500">
              {lastUpdatedLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
