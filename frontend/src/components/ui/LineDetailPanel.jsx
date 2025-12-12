'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import useAppStore from '@/store/useAppStore';
import useRoutePolyline from '@/hooks/useRoutePolyline';
import useMediaQuery from '@/hooks/useMediaQuery';
import { 
  X, 
  Loader, 
  ServerCrash, 
  Users, 
  Star,
  Minimize2,
  RotateCcw
} from 'lucide-react';
import TimeSlider from './TimeSlider';
import CrowdChart from './CrowdChart';
import ScheduleWidget from '../line-detail/ScheduleWidget';
import MetroScheduleWidget from '../line-detail/MetroScheduleWidget';
import ScheduleModal from '../line-detail/ScheduleModal';
import MetroScheduleModal from '../line-detail/MetroScheduleModal';
import StatusBanner from './StatusBanner';
import AlertsModal from './AlertsModal';
import { cn } from '@/lib/utils';
import { getForecast, getLineStatus } from '@/lib/api';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';
import useMetroTopology from '@/hooks/useMetroTopology';
import { ChevronDown } from 'lucide-react';

const crowdLevelConfig = {
  "Low": { color: "text-emerald-400", progressColor: "bg-emerald-500", badge: "bg-emerald-500/20 border-emerald-500/30" },
  "Medium": { color: "text-yellow-400", progressColor: "bg-yellow-500", badge: "bg-yellow-500/20 border-yellow-500/30" },
  "High": { color: "text-orange-400", progressColor: "bg-orange-500", badge: "bg-orange-500/20 border-orange-500/30" },
  "Very High": { color: "text-red-400", progressColor: "bg-red-500", badge: "bg-red-500/20 border-red-500/30" },
  "Unknown": { color: "text-gray-400", progressColor: "bg-gray-500", badge: "bg-gray-500/20 border-gray-500/30" },
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
  
  const { getAvailableDirections, getPolyline, getDirectionInfo } = useRoutePolyline();
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lineStatus, setLineStatus] = useState(null);
  
  // Detect if selected line is metro
  const isMetroLine = selectedLine && /^[MFT]/.test(selectedLine.id);
  
  useEffect(() => {
    if (isPanelOpen && isFavoritesPage) {
      queueMicrotask(() => setIsMinimized(false));
    }
  }, [isPanelOpen, isFavoritesPage]);
  const [hasRouteData, setHasRouteData] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [showCapacityTooltip, setShowCapacityTooltip] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 440, height: 520 });
  const resizeRef = useRef(null);
  
  // Metro-specific state
  const { getLine } = useMetroTopology();

  const metroLine = isMetroLine ? getLine(selectedLine?.id) : null;
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

  const metroDirections = currentMetroStation?.directions || [];

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
  }, [isPanelOpen, selectedLine, selectedDirection, isMetroLine]);

  useEffect(() => {
    if (!isDesktop && showCapacityTooltip) {
      const handleClickOutside = () => setShowCapacityTooltip(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCapacityTooltip, isDesktop]);

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
    if (!isDesktop && isMinimized) {
      controls.start({ y: 0 });
    }
  }, [isMinimized, isDesktop, controls]);

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

  if (!isPanelOpen || !selectedLine) return null;

  const currentHourData = forecastData.find(f => f.hour === selectedHour);
  const crowdLevel = currentHourData?.crowd_level;
  const status = currentHourData ? crowdLevelConfig[crowdLevel] : null;
  const metadata = selectedLine.metadata;
  const transportType = metadata ? getTransportType(metadata.transport_type_id) : null;
  const m1aLine = isMetroLine ? getLine('M1A') : null;
  const m1bLine = isMetroLine ? getLine('M1B') : null;
  const displayLineLabel = (isMetroLine && selectedLine.id === 'M1')
    ? [m1aLine?.description, m1bLine?.description].filter(Boolean).join(' / ')
    : metadata?.line;
  const isFav = isFavorite(selectedLine.id);
  const availableDirections = getAvailableDirections(selectedLine.id);
  const directionInfo = getDirectionInfo(selectedLine.id);

  const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    vibrate(10);
  };

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    const velocity = info.velocity.y;
    
    if (velocity > 500 || info.offset.y > threshold) {
      setIsMinimized(true);
      controls.start({ y: 0 });
      vibrate(10);
    } else if (velocity < -500 || info.offset.y < -threshold) {
      setIsMinimized(false);
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

  return (
    <>
      <AnimatePresence>
        {((!isDesktop && !isMinimized) || (isDesktop && isFavoritesPage && !isMinimized)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[898] bg-black/60 backdrop-blur-sm"
            onClick={closePanel}
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
          className={cn(
            "bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden pointer-events-auto",
            isDesktop 
              ? "absolute rounded-xl" 
              : "fixed bottom-16 left-0 right-0 rounded-t-3xl"
          )}
          style={!isDesktop ? {
            height: isMinimized ? 'auto' : (isFavoritesPage ? 'fit-content' : 'min(55vh, calc(100vh - 6rem))'),
            maxHeight: 'calc(100vh - 5rem)',
            transition: 'height 0.3s ease-out'
          } : {
            top: INITIAL_PANEL_POSITION.top,
            left: INITIAL_PANEL_POSITION.left,
            width: `${panelSize.width}px`,
            height: isMinimized ? 'auto' : 'fit-content',
            minHeight: isMinimized ? 'auto' : (isFavoritesPage ? 'auto' : `${panelSize.height}px`),
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
                        setIsMinimized(!isMinimized);
                        vibrate(5);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200 cursor-pointer"
                      title={isMinimized ? t('expand') : t('minimize')}
                    >
                      <Minimize2 size={12} />
                      <span className="text-[10px] font-medium">{isMinimized ? t('expand') : t('minimize')}</span>
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
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200 cursor-pointer"
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
                    className="rounded-full bg-background p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Mobile Drag Handle */}
              {!isDesktop && (
                <div 
                  onClick={toggleMinimize}
                  className="flex items-center justify-center py-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-1 bg-gray-600 rounded-full" />
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
                  {currentHourData && status && (
                    <div className={cn(
                      "rounded-lg px-2 py-1 border text-xs font-bold",
                      status.badge,
                      status.color
                    )}>
                      {currentHourData.occupancy_pct}%
                    </div>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(selectedLine.id);
                      vibrate(5);
                    }}
                    className={cn(
                      "rounded-full bg-background p-1.5 hover:bg-white/10 transition-colors",
                      isFav ? "text-yellow-400" : "text-gray-400"
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
                      className="rounded-full bg-background p-1.5 text-gray-400 hover:bg-white/10"
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
                        className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                      >
                        {metroStations.map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.description || station.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    {/* Direction Selector */}
                    <div className="relative">
                      <select
                        value={selectedMetroDirectionId || ''}
                        onChange={(e) => {
                          const newDirectionId = parseInt(e.target.value);
                          setMetroSelection(selectedLine.id, selectedMetroStationId, newDirectionId);
                        }}
                        className="w-full appearance-none bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 pr-8 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                        disabled={metroDirections.length === 0}
                      >
                        {metroDirections.map((direction) => (
                          <option key={direction.id} value={direction.id}>
                            {direction.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
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
                                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
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
            {!isMinimized && (
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/30 hover:scrollbar-thumb-gray-500">
                
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
                        <div className="flex items-center justify-center py-8">
                          <Loader className="animate-spin text-primary" size={20} />
                        </div>
                      )}
                      
                      {error && !loading && (
                        <div className="flex items-center justify-center gap-2 text-red-400 py-8 px-3">
                          <ServerCrash size={16} />
                          <span className="text-xs text-center">{error}</span>
                        </div>
                      )}
                      
                      {currentHourData && status && !loading && !error && (
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
                                  <div className={cn(
                                    "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                    status.badge,
                                    status.color
                                  )}>
                                    {currentHourData.occupancy_pct}%
                                  </div>
                                </div>
                                <h3 className={cn("text-sm font-bold", status.color)}>
                                  {t(`crowdLevels.${crowdLevel}`)}
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
                                  <h3 className={cn("text-base font-bold", status.color)}>
                                    {t(`crowdLevels.${crowdLevel}`)}
                                  </h3>
                                </div>
                                <div className={cn(
                                  "rounded-md px-2.5 py-1.5 border text-xs font-semibold",
                                  status.badge,
                                  status.color
                                )}>
                                  {currentHourData.occupancy_pct}%
                                </div>
                              </div>
                            )}
                            
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
                                  className="flex items-center gap-1 text-gray-400 cursor-help"
                                  onMouseEnter={() => isDesktop && setShowCapacityTooltip(true)}
                                  onMouseLeave={() => isDesktop && setShowCapacityTooltip(false)}
                                  onClick={(e) => {
                                    if (!isDesktop) {
                                      e.stopPropagation();
                                      setShowCapacityTooltip(!showCapacityTooltip);
                                      vibrate(5);
                                    }
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
                          </div>

                          {/* Time Slider integrated into Card */}
                          <div className="pt-2 border-t border-white/5">
                            <TimeSlider />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Schedule Widget */}
                    <div className={cn(isDesktop ? "md:col-span-2" : "")}>
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

                  {/* Card 3: 24h Chart - Only show if forecast data exists */}
                  {(forecastData.length > 0 || loading) && (
                    <div className="rounded-xl bg-background border border-white/5 overflow-hidden relative">
                      <div className="px-3 py-2 border-b border-white/5">
                        <p className="text-xs font-medium text-gray-400">
                          {t('forecast24h')}
                        </p>
                      </div>
                      <div className="px-3 pb-3 pt-2 h-44 relative">
                        {loading ? (
                          <div className="h-full flex items-center justify-center">
                            <Loader className="animate-spin text-primary" size={20} />
                          </div>
                        ) : (
                          <CrowdChart data={forecastData} />
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
          
          {/* Desktop Resize Handle */}
          {isDesktop && !isMinimized && (
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
    </>
  );
}
