'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import useAppStore from '@/store/useAppStore';
import useRoutePolyline from '@/hooks/useRoutePolyline';
import useMediaQuery from '@/hooks/useMediaQuery';
import { 
  X, 
  ServerCrash, 
  Users, 
  Star,
  Minimize2,
  RotateCcw,
  Clock,
  Info
} from 'lucide-react';
import TimeSlider from './TimeSlider';
import CrowdChart from './CrowdChart';
import ScheduleWidget from '../line-detail/ScheduleWidget';
import MetroScheduleWidget from '../line-detail/MetroScheduleWidget';
import ScheduleModal from '../line-detail/ScheduleModal';
import MetroScheduleModal from '../line-detail/MetroScheduleModal';
import StatusBanner from './StatusBanner';
import AlertsModal from './AlertsModal';
import CapacityModal from './CapacityModal';
import { cn } from '@/lib/utils';
import { getForecast, getLineStatus, getCapacityMeta, getCapacityMix } from '@/lib/api';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';
import useMetroTopology from '@/hooks/useMetroTopology';
import { ChevronDown } from 'lucide-react';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

const crowdLevelConfig = {
  "Low": { color: "text-emerald-400", progressColor: "bg-emerald-500", badge: "bg-emerald-500/20 border-emerald-500/30" },
  "Medium": { color: "text-yellow-400", progressColor: "bg-yellow-500", badge: "bg-yellow-500/20 border-yellow-500/30" },
  "High": { color: "text-orange-400", progressColor: "bg-orange-500", badge: "bg-orange-500/20 border-orange-500/30" },
  "Very High": { color: "text-red-400", progressColor: "bg-red-500", badge: "bg-red-500/20 border-red-500/30" },
  "Unknown": { color: "text-gray-400", progressColor: "bg-gray-500", badge: "bg-gray-500/20 border-gray-500/30" },
};

const outOfServiceStyles = {
  color: 'text-slate-300',
  badge: 'bg-slate-500/15 border-slate-500/30',
};

export default function LineDetailPanel() {
  const t = useTranslations('lineDetail');
  const tErrors = useTranslations('errors');
  const getTransportLabel = useGetTransportLabel();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const pathname = usePathname();
  const isFavoritesPage = pathname?.includes('/forecast');
  const controls = useAnimation();
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  
  const { 
    selectedLine, 
    isPanelOpen, 
    isPanelMinimized,
    setPanelMinimized,
    closePanel, 
    selectedHour, 
    toggleFavorite, 
    isFavorite,
    selectedDirection,
    metroSelection,
    setSelectedDirection,
    setShowRoute,
    setMetroSelection,
    resetMetroSelection
  } = useAppStore();

  const handleBackdropClick = useCallback(() => {
    // On the map page, clicking outside should only minimize (keep selected line).
    if (!isFavoritesPage) {
      setPanelMinimized(true);
      return;
    }

    closePanel();
  }, [isFavoritesPage, setPanelMinimized, closePanel]);

  const selectedLineId = selectedLine?.id ?? null;
  
  const { getAvailableDirections, getPolyline, getDirectionInfo } = useRoutePolyline();
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lineStatus, setLineStatus] = useState(null);
  
  // Detect if selected line is metro
  const isMetroLine = !!selectedLineId && /^[MFT]/.test(selectedLineId);
  
  const [hasRouteData, setHasRouteData] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [showCapacityTooltip, setShowCapacityTooltip] = useState(false);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const [capacityMeta, setCapacityMeta] = useState(null);
  const [capacityMix, setCapacityMix] = useState([]);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityError, setCapacityError] = useState(null);
  const capacityCacheRef = useRef(new Map());
  const [panelSize, setPanelSize] = useState({ width: 440, height: 520 });
  const resizeRef = useRef(null);
  
  // Metro-specific state
  const { getLine } = useMetroTopology();

  const metroLine = isMetroLine ? getLine(selectedLineId) : null;
  const metroStations = useMemo(() => {
    if (!metroLine?.stations) return [];
    return [...metroLine.stations].sort((a, b) => a.order - b.order);
  }, [metroLine]);

  const selectedMetroStationId = useMemo(() => {
    const desired = metroSelection?.stationId;
    if (desired && metroStations.some((s) => s.id === desired)) {
      return desired;
    }
    return metroStations[0]?.id ?? null;
  }, [metroSelection?.stationId, metroStations]);

  const currentMetroStation = useMemo(() => {
    return metroStations.find((s) => s.id === selectedMetroStationId) || null;
  }, [metroStations, selectedMetroStationId]);

  const metroDirections = useMemo(() => {
    return currentMetroStation?.directions ?? [];
  }, [currentMetroStation]);

  const selectedMetroDirectionId = useMemo(() => {
    if (!currentMetroStation) {
      return null;
    }

    const desired = metroSelection?.directionId;
    if (desired && metroDirections.some((d) => d.id === desired)) {
      return desired;
    }

    return metroDirections?.[0]?.id ?? null;
  }, [currentMetroStation, metroSelection?.directionId, metroDirections]);

  // Keep the shared metro selection in sync (single source of truth).
  useEffect(() => {
    if (!isMetroLine || !selectedLine) {
      resetMetroSelection();
      return;
    }

    if (!selectedLine.id || !selectedMetroStationId || !selectedMetroDirectionId) {
      return;
    }

    const needsUpdate =
      metroSelection?.lineCode !== selectedLine.id ||
      metroSelection?.stationId !== selectedMetroStationId ||
      metroSelection?.directionId !== selectedMetroDirectionId;

    if (needsUpdate) {
      setMetroSelection(selectedLine.id, selectedMetroStationId, selectedMetroDirectionId);
    }
  }, [
    isMetroLine,
    selectedLine,
    selectedMetroStationId,
    selectedMetroDirectionId,
    metroSelection?.lineCode,
    metroSelection?.stationId,
    metroSelection?.directionId,
    setMetroSelection,
    resetMetroSelection
  ]);
  const panelRef = useRef(null);
  const initialPositionSet = useRef(false);
  const INITIAL_PANEL_SIZE = { width: 440, height: 520 };
  const INITIAL_PANEL_POSITION = { top: '5rem', left: '1rem' };

  useEffect(() => {
    if (isPanelOpen && selectedLine) {
      queueMicrotask(() => {
        setLoading(true);
        setError(null);
        setForecastData([]);
      });
      
      const targetDate = new Date();
      
      // Fetch forecast + line status.
      // For metro/rail, status is used only for the out-of-service banner.
      const promises = [
        getForecast(selectedLine.id, targetDate, selectedDirection),
        getLineStatus(selectedLine.id, selectedDirection)
      ];
      
      Promise.all(promises)
        .then((results) => {
          setForecastData(results[0]);
          setLineStatus(results[1]);
          setError(null);
        })
        .catch(err => {
          const message = (() => {
            const raw = err?.message || '';
            const line = selectedLine?.id || '';

            if (/network error/i.test(raw)) return tErrors('networkError');
            if (/not found/i.test(raw)) return tErrors('notFound');
            if (/no forecast/i.test(raw)) return tErrors('noForecast', { line });
            if (/server error/i.test(raw)) return tErrors('serverError');

            return tErrors('serverError');
          })();

          setError(message);
          setForecastData([]);
          console.error('Data fetch error:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      queueMicrotask(() => {
        setForecastData([]);
        setError(null);
        setLineStatus(null);
      });
    }
  }, [isPanelOpen, selectedLine, selectedDirection, isMetroLine, tErrors]);

  useEffect(() => {
    if (!isDesktop && showCapacityTooltip) {
      const handleClickOutside = () => setShowCapacityTooltip(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCapacityTooltip, isDesktop]);

  useEffect(() => {
    setIsCapacityModalOpen(false);
    setCapacityMeta(null);
    setCapacityMix([]);
    setCapacityLoading(false);
    setCapacityError(null);
  }, [selectedLineId]);

  const openCapacityModal = useCallback(() => {
    const lineCode = selectedLine?.id;
    if (!lineCode) return;

    setIsCapacityModalOpen(true);
    setShowCapacityTooltip(false);

    const cached = capacityCacheRef.current.get(lineCode);
    if (cached) {
      setCapacityMeta(cached.meta);
      setCapacityMix(cached.mix);
      setCapacityError(null);
      return;
    }

    setCapacityLoading(true);
    setCapacityError(null);

    Promise.all([getCapacityMeta(lineCode), getCapacityMix(lineCode, 10)])
      .then(([meta, mix]) => {
        capacityCacheRef.current.set(lineCode, { meta, mix });
        setCapacityMeta(meta);
        setCapacityMix(mix);
      })
      .catch((err) => {
        console.error('Capacity fetch error:', err);
        setCapacityError(tErrors('serverError'));
      })
      .finally(() => {
        setCapacityLoading(false);
      });
  }, [selectedLine, tErrors]);

  useEffect(() => {
    let isMounted = true;
    
    if (selectedLine && isPanelOpen) {
      const checkRouteData = async () => {
        const availableDirs = getAvailableDirections(selectedLine.id);
        if (availableDirs.length > 0) {
          const polyline = await getPolyline(selectedLine.id, selectedDirection);
          if (isMounted) {
            const hasData = polyline && polyline.length > 0;
            setHasRouteData(hasData);
            if (hasData) {
              setShowRoute(true);
            }
          }
        } else {
          if (isMounted) {
            setHasRouteData(false);
            setShowRoute(false);
          }
        }
      };
      
      checkRouteData();
    } else {
      queueMicrotask(() => {
        if (!isMounted) return;
        setHasRouteData(false);
        setShowRoute(false);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedLine, selectedDirection, isPanelOpen, getAvailableDirections, getPolyline, setShowRoute]);

  useEffect(() => {
    if (!isDesktop && isPanelMinimized) {
      controls.start({ y: 0 });
    }
  }, [isPanelMinimized, isDesktop, controls]);

  useEffect(() => {
    if (isDesktop && isPanelOpen && !initialPositionSet.current && panelRef.current) {
      const viewportHeight = window.innerHeight;
      const panelHeight = panelSize.height;
      
      if (panelHeight > viewportHeight - 160) {
        queueMicrotask(() => {
          setPanelSize((prev) => ({
            width: prev.width,
            height: viewportHeight - 160
          }));
        });
      }
      
      initialPositionSet.current = true;
    }
    
    if (!isPanelOpen) {
      initialPositionSet.current = false;
    }
  }, [isPanelOpen, isDesktop, panelSize.height]);

  const isMarmaray = selectedLineId === 'MARMARAY';
  
  const hasAnyInServiceHour = useMemo(
    () => forecastData.some((item) => item.in_service),
    [forecastData]
  );

  const directionInfo = useMemo(() => {
    if (!selectedLineId) return {};
    return getDirectionInfo(selectedLineId);
  }, [getDirectionInfo, selectedLineId]);

  const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const toggleMinimize = () => {
    setPanelMinimized(!isPanelMinimized);
    vibrate(10);
  };

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    const velocity = info.velocity.y;
    
    if (velocity > 500 || info.offset.y > threshold) {
      setPanelMinimized(true);
      controls.start({ y: 0 });
      vibrate(10);
    } else if (velocity < -500 || info.offset.y < -threshold) {
      setPanelMinimized(false);
      controls.start({ y: 0 });
      vibrate(10);
    } else {
      controls.start({ y: 0 });
    }
  };

  const handleDirectionChange = (dir) => {
    setSelectedDirection(dir);
    vibrate(5);
  };

  const handleResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelSize.width;
    const startHeight = panelSize.height;
    const aspectRatio = startWidth / startHeight;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const newWidth = Math.max(320, Math.min(900, startWidth + deltaX));
      const newHeight = newWidth / aspectRatio;
      
      setPanelSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
  };

  if (!isPanelOpen || !selectedLine) return null;

  const currentHourData = forecastData.find((f) => f.hour === selectedHour);
  const isOutOfServiceHour =
    !!currentHourData &&
    (
      currentHourData.in_service === false ||
      currentHourData.crowd_level === 'Out of Service' ||
      currentHourData.occupancy_pct == null
    );

  const crowdLevel = isOutOfServiceHour
    ? 'Out of Service'
    : (currentHourData?.crowd_level || 'Unknown');

  const status = isOutOfServiceHour
    ? null
    : (crowdLevelConfig[crowdLevel] || crowdLevelConfig.Unknown);

  const shouldShowForecastChart = loading || forecastData.length > 0;
  const metadata = selectedLine.metadata ?? null;
  const transportType = metadata ? getTransportType(metadata.transport_type_id) : null;

  const m1aLine = isMetroLine ? getLine('M1A') : null;
  const m1bLine = isMetroLine ? getLine('M1B') : null;
  const displayLineLabel = (isMetroLine && selectedLineId === 'M1')
    ? [m1aLine?.description, m1bLine?.description].filter(Boolean).join(' / ')
    : metadata?.line;

  const isFav = isFavorite(selectedLineId);
  const availableDirections = getAvailableDirections(selectedLineId);

  return (
    <>
      <AnimatePresence>
        {((!isDesktop && !isPanelMinimized) || (isDesktop && isFavoritesPage && !isPanelMinimized)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[898] bg-[#0f172a]/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
        )}
      </AnimatePresence>
      
      <motion.div
        ref={constraintsRef}
        className="fixed inset-0 z-[899] pointer-events-none"
      >
        <motion.div
          ref={panelRef}
          drag={isDesktop ? true : "y"}
          dragListener={isDesktop ? false : true}
          dragControls={isDesktop ? dragControls : undefined}
          dragConstraints={isDesktop ? false : { top: 0, bottom: 0 }}
          dragElastic={isDesktop ? 0 : 0.2}
          dragMomentum={false}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
          onDragEnd={!isDesktop ? handleDragEnd : undefined}
          animate={controls}
          initial={false}
          transition={{ 
            duration: 0.25, 
            ease: [0.25, 0.1, 0.25, 1],
            boxShadow: { duration: 0.25, ease: 'easeOut' }
          }}
          className={cn(
            "overflow-hidden pointer-events-auto border bg-[#0f172a]",
            isDesktop 
              ? "absolute rounded-2xl border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]" 
              : cn(
                  "fixed left-0 right-0 bottom-0 rounded-t-[28px] shadow-[0_-8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
                  isFavoritesPage
                    ? "border-t-white/[0.10] border-x-white/[0.10] border-b-transparent"
                    : "border-t-white/[0.08] border-x-white/[0.08] border-b-transparent"
                )
          )}
          style={!isDesktop ? {
            height: isPanelMinimized ? 'auto' : (isFavoritesPage ? 'fit-content' : 'min(55vh, calc(100vh - 6rem))'),
            maxHeight: 'calc(100vh - 5rem)',
            paddingBottom: '84px',
            transition: 'height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.25s ease-out'
          } : {
            top: INITIAL_PANEL_POSITION.top,
            left: INITIAL_PANEL_POSITION.left,
            width: `${panelSize.width}px`,
            height: isPanelMinimized ? 'auto' : 'fit-content',
            minHeight: isPanelMinimized ? 'auto' : (isFavoritesPage ? 'auto' : `${panelSize.height}px`),
            maxHeight: 'calc(100vh - 8rem)'
          }}
        >
          <div className="flex flex-col h-full">
            
            {/* STICKY HEADER */}
            <div className="flex-shrink-0 border-b border-white/5">
              {/* Desktop Drag Handle */}
              {isDesktop && (
                <div 
                  onPointerDown={(e) => {
                    if (!e.target.closest('button')) {
                      dragControls.start(e);
                    }
                  }}
                  className="flex items-center justify-between py-2 px-3 border-b border-white/5 cursor-move select-none"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanelMinimized(!isPanelMinimized);
                        vibrate(5);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 cursor-pointer"
                      title={isPanelMinimized ? t('expand') : t('minimize')}
                    >
                      <Minimize2 size={12} />
                      <span className="text-[10px] font-medium">{isPanelMinimized ? t('expand') : t('minimize')}</span>
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPanelSize(INITIAL_PANEL_SIZE);
                        if (panelRef.current) {
                          const style = panelRef.current.style;
                          style.transform = 'translate(0px, 0px)';
                          style.top = INITIAL_PANEL_POSITION.top;
                          style.left = INITIAL_PANEL_POSITION.left;
                        }
                        vibrate(5);
                      }}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 cursor-pointer"
                      title={t('resetPosition')}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  
                  <div className="flex-1" />
                  
                  <button 
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      closePanel();
                    }}
                    className="rounded-full bg-background p-1.5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Mobile Drag Handle */}
              {!isDesktop && (
                <div 
                  onClick={toggleMinimize}
                  className="relative flex items-center justify-center py-3 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full" />
                  <div className="w-10 h-1 bg-white/30 rounded-full" />
                </div>
              )}

              {/* Line Info Row */}
              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white shrink-0">
                    {selectedLine.id}
                  </span>
                  {displayLineLabel && (
                    <span className="text-xs text-gray-300 truncate min-w-0">
                      {displayLineLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {currentHourData && !loading && !error && (
                    isOutOfServiceHour ? (
                      <div className={cn(
                        "rounded-lg px-2 py-1 border text-[11px] font-bold",
                        outOfServiceStyles.badge,
                        outOfServiceStyles.color
                      )}>
                        {t('emptyState.outOfServiceBadge')}
                      </div>
                    ) : (
                      status && (
                        <div className={cn(
                          "rounded-lg px-2 py-1 border text-xs font-bold",
                          status.badge,
                          status.color
                        )}>
                          {currentHourData.occupancy_pct}%
                        </div>
                      )
                    )
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(selectedLine.id);
                      vibrate(5);
                    }}
                    className={cn(
                      "rounded-full bg-background p-1.5 hover:bg-white/10 transition-colors",
                      isFav ? "text-yellow-400" : "text-white/50"
                    )}
                    aria-label={isFav ? t('removeFromFavorites') : t('addToFavorites')}
                  >
                    <Star size={16} fill={isFav ? "currentColor" : "none"} />
                  </button>
                  {!isDesktop && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        closePanel();
                      }}
                      className="rounded-full bg-background p-1.5 text-white/50 hover:bg-white/10"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Direction/Station Selectors */}
              {isMetroLine ? (
                // Metro: Station and Direction Select Menus
                <div className="px-4 pb-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Station Selector */}
                    <div className="relative">
                      <select
                        value={selectedMetroStationId || ''}
                        onChange={(e) => {
                          const newStationId = parseInt(e.target.value);
                          const newStation = metroStations.find(s => s.id === newStationId);
                          if (!newStation) return;

                          const nextDirectionId = newStation.directions?.[0]?.id ?? null;

                          setMetroSelection(selectedLine.id, newStationId, nextDirectionId);
                        }}
                        className="w-full appearance-none bg-background/60 border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                      >
                        {metroStations.map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.description || station.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                    </div>

                    {/* Direction Selector */}
                    <div className="relative">
                      <select
                        value={selectedMetroDirectionId || ''}
                        onChange={(e) => {
                          const newDirectionId = parseInt(e.target.value);
                          setMetroSelection(selectedLine.id, selectedMetroStationId, newDirectionId);
                        }}
                        className="w-full appearance-none bg-background/60 border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                        disabled={metroDirections.length === 0}
                      >
                        {metroDirections.map((direction) => (
                          <option key={direction.id} value={direction.id}>
                            {direction.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                    </div>
                  </div>
                </div>
              ) : (
                // Bus: Direction Tabs (Segmented Control)
                availableDirections.length > 1 && (
                  <div className="px-4 pb-2">
                    <div className="flex gap-1 p-0.5 bg-background rounded-lg">
                      {availableDirections.map(dir => {
                        const info = directionInfo[dir];
                        const label = info?.label || (dir === 'G' ? t('schedule.outbound') : dir === 'D' ? t('schedule.inbound') : dir);
                        const isLongLabel = label.length > 20;
                        
                        return (
                          <button
                            key={dir}
                            onClick={() => {
                              handleDirectionChange(dir);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-md font-medium transition-all touch-manipulation h-8 truncate min-w-0",
                              isLongLabel && !isDesktop ? "text-[10px]" : "text-xs",
                              selectedDirection === dir
                                ? "bg-primary text-white shadow-sm"
                                : "text-white/50 hover:text-white/80 hover:bg-white/5"
                            )}
                            title={label}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* BODY - Only show if not minimized */}
            {!isPanelMinimized && (
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-background/50">
                
                {/* Card Layout */}
                <div className="p-4 space-y-3">
                  
                  {/* Status Banner */}
                  {lineStatus && lineStatus.status !== 'ACTIVE' && (
                    <StatusBanner 
                      status={lineStatus} 
                      onClick={() => {
                        // Only bus alerts open the modal; metro/rail OUT_OF_SERVICE is informational.
                        if (!isMetroLine && lineStatus.alerts && lineStatus.alerts.length > 0) {
                          setIsAlertsModalOpen(true);
                          vibrate(5);
                        }
                      }}
                    />
                  )}
                  
                  {/* Cards Grid - Desktop: Side by Side, Mobile: Stacked */}
                  <div className={cn(
                    "grid gap-3",
                    isDesktop ? "md:grid-cols-5" : "grid-cols-1"
                  )}>
                    
                    {/* Card 1: Crowd Status (The Remote Control) */}
                    <div className={cn(
                      "rounded-xl bg-background border border-white/5 flex flex-col",
                      isDesktop ? "md:col-span-3" : ""
                    )}>
                      {loading && (
                        <div className="p-3 space-y-3" aria-busy="true">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-5 w-14 rounded-md" />
                          </div>
                          <Skeleton className="h-7 w-24 rounded-md" />
                          <SkeletonText lines={2} />
                          <div className="pt-2">
                            <Skeleton className="h-2 w-full rounded" />
                          </div>
                          <span className="sr-only">Loading line details</span>
                        </div>
                      )}
                      
                      {error && !loading && (
                        <div className="flex items-center justify-center gap-2 text-red-400 py-8 px-3">
                          <ServerCrash size={16} />
                          <span className="text-xs text-center">{error}</span>
                        </div>
                      )}
                      
                      {!loading && !error && (
                        <div className="p-3 space-y-3">
                          {/* Crowd Info with Time Badge */}
                          <div className="space-y-2">
                            {/* Desktop: Single Row Header + Crowd Level Below */}
                            {isDesktop ? (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[9px] text-gray-400">
                                      {t('estimatedCrowd')}
                                    </p>
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                      {selectedHour}:00
                                    </span>
                                  </div>
                                  {isOutOfServiceHour ? (
                                    <div className={cn(
                                      "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                      outOfServiceStyles.badge,
                                      outOfServiceStyles.color
                                    )}>
                                      {t('emptyState.outOfServiceBadge')}
                                    </div>
                                  ) : (
                                    currentHourData && status && (
                                      <div className={cn(
                                        "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                        status.badge,
                                        status.color
                                      )}>
                                        {currentHourData.occupancy_pct}%
                                      </div>
                                    )
                                  )}
                                </div>
                                <h3 className={cn(
                                  "text-sm font-bold",
                                  isOutOfServiceHour ? outOfServiceStyles.color : status?.color
                                )}>
                                  {isOutOfServiceHour
                                    ? t('emptyState.outOfServiceTitle', { hour: selectedHour })
                                    : t(`crowdLevels.${crowdLevel}`)}
                                </h3>
                              </>
                            ) : (
                              /* Mobile: Two Row Layout */
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[10px] text-gray-400">
                                      {t('estimatedCrowd')}
                                    </p>
                                    <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                      {selectedHour}:00
                                    </span>
                                  </div>
                                  <h3 className={cn(
                                    "text-base font-bold",
                                    isOutOfServiceHour ? outOfServiceStyles.color : status?.color
                                  )}>
                                    {isOutOfServiceHour
                                      ? t('emptyState.outOfServiceTitle', { hour: selectedHour })
                                      : t(`crowdLevels.${crowdLevel}`)}
                                  </h3>
                                </div>
                                {isOutOfServiceHour ? (
                                  <div className={cn(
                                    "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                    outOfServiceStyles.badge,
                                    outOfServiceStyles.color
                                  )}>
                                    {t('emptyState.outOfServiceBadge')}
                                  </div>
                                ) : (
                                  currentHourData && status && (
                                    <div className={cn(
                                      "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                      status.badge,
                                      status.color
                                    )}>
                                      {currentHourData.occupancy_pct}%
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {currentHourData ? (
                              isOutOfServiceHour ? (
                                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/30 p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-700/30">
                                      <Clock size={16} className="text-slate-200" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                                        {t('emptyState.outOfServiceDescription')}
                                      </p>
                                      <p className="text-[11px] text-gray-500 mt-2">
                                        {t('emptyState.outOfServiceTip')}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                                    <div 
                                      className={cn("h-1.5 rounded-full transition-all duration-500", status.progressColor)} 
                                      style={{ width: `${currentHourData.occupancy_pct}%` }}
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-gray-400">
                                      {t('predicted')}: <span className="font-semibold text-gray-300">
                                        {Math.round(currentHourData.predicted_value).toLocaleString()}
                                      </span> <span className="text-gray-500">{t('passengers')}</span>
                                    </span>
                                    <div className="relative">
                                      <span 
                                        className="flex items-center gap-1 text-gray-400 cursor-pointer"
                                        onMouseEnter={() => isDesktop && setShowCapacityTooltip(true)}
                                        onMouseLeave={() => isDesktop && setShowCapacityTooltip(false)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCapacityModal();
                                          vibrate(5);
                                        }}
                                      >
                                        <span className="text-[9px] text-gray-500">{t('maxCapacity')}</span>
                                        <Users size={10} className="text-gray-500" /> 
                                        <span className="font-semibold text-gray-300">{currentHourData.max_capacity.toLocaleString()}</span>
                                      </span>
                                      {showCapacityTooltip && (
                                        <div className="absolute right-0 bottom-full mb-2 px-2 py-1.5 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 whitespace-nowrap">
                                          <p className="text-[10px] text-gray-300">{t('maxCapacityTooltip')}</p>
                                          <div className="absolute right-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )
                            ) : (
                              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/30 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-700/30">
                                    <Info size={16} className="text-slate-200" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-200">{tErrors('noForecastData')}</p>
                                    <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                                      {t('emptyState.noForecastHint')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Time Slider integrated into Card */}
                          <div className="pt-2 border-t border-white/5">
                            <TimeSlider />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Schedule Widget */}
                    <div className={cn(isDesktop ? "md:col-span-2" : "", 'space-y-2')}>
                      {isMetroLine ? (
                        <MetroScheduleWidget 
                          lineCode={selectedLine.id}
                          stationId={selectedMetroStationId}
                          directionId={selectedMetroDirectionId}
                          compact={true}
                          limit={isDesktop ? 5 : 3}
                          onShowFullSchedule={() => setIsScheduleModalOpen(true)}
                        />
                      ) : (
                        <ScheduleWidget 
                          lineCode={selectedLine.id} 
                          direction={selectedDirection}
                          onShowFullSchedule={() => setIsScheduleModalOpen(true)}
                          compact={true}
                          limit={isDesktop ? 5 : 3}
                          transportType={transportType}
                        />
                      )}
                    </div>
                  </div>

                  {/* Card 3: 24h Chart - Only show if forecast data exists OR if Marmaray */}
                  {(shouldShowForecastChart || (isMarmaray && !loading)) && (
                    <div className="rounded-xl bg-background border border-white/5 overflow-hidden relative">
                      <div className="px-3 py-2 border-b border-white/5">
                        <p className="text-xs font-medium text-gray-400">
                          {t('forecast24h')}
                        </p>
                      </div>
                      <div className="px-3 pb-3 pt-2 h-44 relative">
                        {loading ? (
                          <div className="h-full flex flex-col justify-center gap-3" aria-busy="true">
                            <Skeleton className="h-3 w-28" />
                            <div className="grid grid-cols-6 gap-2 items-end">
                              {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton
                                  key={`chart-skeleton-${index}`}
                                  className={cn(
                                    'w-full rounded',
                                    index % 3 === 0 ? 'h-10' : index % 3 === 1 ? 'h-14' : 'h-8'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="sr-only">Loading 24 hour forecast</span>
                          </div>
                        ) : (hasAnyInServiceHour || isMarmaray) ? (
                          <CrowdChart data={forecastData} />
                        ) : (
                          <div className="flex h-full items-center justify-center px-4 text-center">
                            <p className="text-sm text-gray-400">
                              {t('emptyState.outOfServiceDescription')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
          
          {/* Desktop Resize Handle */}
          {isDesktop && !isPanelMinimized && (
            <div
              ref={resizeRef}
              onMouseDown={handleResize}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize group flex items-end justify-end p-1"
              style={{ touchAction: 'none' }}
            >
              <div className="w-4 h-4 border-r-2 border-b-2 border-gray-500 group-hover:border-primary transition-colors rounded-br" />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Schedule Modal - Different for Metro vs Bus */}
      {isMetroLine ? (
        <MetroScheduleModal 
          lineCode={selectedLine.id}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          initialStationId={selectedMetroStationId}
          initialDirectionId={selectedMetroDirectionId}
        />
      ) : (
        <ScheduleModal 
          lineCode={selectedLine.id}
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          initialDirection={selectedDirection}
          directionInfo={directionInfo}
        />
      )}
      
      {/* AlertsModal - Only for Bus lines */}
      {!isMetroLine && (
        <AlertsModal 
          isOpen={isAlertsModalOpen}
          onClose={() => setIsAlertsModalOpen(false)}
          messages={lineStatus?.alerts || []}
          lineCode={selectedLine.id}
        />
      )}

      {!isMetroLine && selectedLine && (
        <CapacityModal
          isOpen={isCapacityModalOpen}
          onClose={() => setIsCapacityModalOpen(false)}
          lineCode={selectedLine.id}
          currentHourData={currentHourData}
          capacityMeta={capacityMeta}
          capacityMix={capacityMix}
          loading={capacityLoading}
          error={capacityError}
        />
      )}
    </>
  );
}
