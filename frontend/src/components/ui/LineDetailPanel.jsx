'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import useAppStore from '@/store/useAppStore';
import useRoutePolyline from '@/hooks/useRoutePolyline';
import useMediaQuery from '@/hooks/useMediaQuery';
import { 
  X, 
  Loader, 
  ServerCrash, 
  Users, 
  Info, 
  MapPin, 
  Route, 
  Star,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight
} from 'lucide-react';
import TimeSlider from './TimeSlider';
import CrowdChart from './CrowdChart';
import { cn } from '@/lib/utils';
import { getForecast } from '@/lib/api';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';

const crowdLevelConfig = {
  "Low": { color: "text-emerald-400", progressColor: "bg-emerald-500", badge: "bg-emerald-500/20 border-emerald-500/30" },
  "Medium": { color: "text-yellow-400", progressColor: "bg-yellow-500", badge: "bg-yellow-500/20 border-yellow-500/30" },
  "High": { color: "text-orange-400", progressColor: "bg-orange-500", badge: "bg-orange-500/20 border-orange-500/30" },
  "Very High": { color: "text-red-400", progressColor: "bg-red-500", badge: "bg-red-500/20 border-red-500/30" },
  "Unknown": { color: "text-gray-400", progressColor: "bg-gray-500", badge: "bg-gray-500/20 border-gray-500/30" },
};

export default function LineDetailPanel() {
  const t = useTranslations('lineDetail');
  const getTransportLabel = useGetTransportLabel();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const controls = useAnimation();
  
  const { 
    selectedLine, 
    isPanelOpen, 
    closePanel, 
    selectedHour, 
    toggleFavorite, 
    isFavorite,
    selectedDirection,
    setSelectedDirection,
    showRoute,
    setShowRoute
  } = useAppStore();
  
  const { getAvailableDirections, getPolyline, getDirectionInfo, getRouteStops } = useRoutePolyline();
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  useEffect(() => {
    if (isPanelOpen && selectedLine) {
      setLoading(true);
      setError(null);
      setForecastData([]);
      
      const targetDate = new Date();
      
      getForecast(selectedLine.id, targetDate)
        .then(data => {
          setForecastData(data);
          setError(null);
        })
        .catch(err => {
          const errorMessage = err.message || "Could not fetch forecast. Please try again later.";
          setError(errorMessage);
          setForecastData([]);
          console.error('Forecast fetch error:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setForecastData([]);
      setError(null);
    }
  }, [isPanelOpen, selectedLine]);

  useEffect(() => {
    if (showRoute) {
      setIsMinimized(true);
    }
  }, [showRoute]);

  useEffect(() => {
    if (!isDesktop && isMinimized) {
      controls.start({ y: 0 });
    }
  }, [isMinimized, isDesktop, controls]);

  if (!isPanelOpen || !selectedLine) return null;

  const currentHourData = forecastData.find(f => f.hour === selectedHour);
  const crowdLevel = currentHourData?.crowd_level;
  const status = currentHourData ? crowdLevelConfig[crowdLevel] : null;
  const metadata = selectedLine.metadata;
  const transportType = metadata ? getTransportType(metadata.transport_type_id) : null;
  const isFav = isFavorite(selectedLine.id);
  const availableDirections = getAvailableDirections(selectedLine.id);
  const directionInfo = getDirectionInfo(selectedLine.id);
  const hasRouteData = availableDirections.length > 0 && getPolyline(selectedLine.id, selectedDirection).length > 0;

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

  const handleShowRouteToggle = () => {
    if (hasRouteData) {
      setShowRoute(!showRoute);
      vibrate(10);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isDesktop && !isMinimized && (
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
        drag={!isDesktop ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={cn(
          "fixed z-[899] bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden",
          isDesktop 
            ? "top-20 left-4 w-96 rounded-xl max-h-[calc(100vh-6rem)] transition-all duration-300" 
            : "bottom-16 left-0 right-0 rounded-t-3xl",
          isDesktop && isMinimized && "h-auto",
          isDesktop && !isMinimized && "max-h-[calc(100vh-6rem)]"
        )}
        style={!isDesktop ? {
          height: isMinimized ? 'auto' : (isChartExpanded ? '75vh' : '55vh'),
          transition: 'height 0.3s ease-out'
        } : {}}
      >
        <div className={cn(
          "flex flex-col",
          isMinimized ? "pb-3" : "pb-4"
        )}>
          
          <div 
            onClick={toggleMinimize}
            className="flex items-center justify-center py-2.5 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 touch-none"
          >
            <div className="w-12 h-1 bg-gray-600 rounded-full md:hidden" />
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{isMinimized ? 'Expand' : 'Minimize'}</span>
            </div>
          </div>

          {isMinimized ? (
            <div className="px-4 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white shrink-0">
                    {selectedLine.id}
                  </span>
                  {metadata?.line && (
                    <span className="text-xs text-gray-300 truncate">
                      {metadata.line}
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
                    aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star size={16} fill={isFav ? "currentColor" : "none"} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      closePanel();
                    }}
                    className="rounded-full bg-background p-1.5 text-gray-400 hover:bg-white/10"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {showRoute && availableDirections.length > 1 && (
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-primary shrink-0 animate-pulse" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate flex-1">
                      {directionInfo[selectedDirection]?.label || (selectedDirection === 'G' ? 'Gidiş' : selectedDirection === 'D' ? 'Dönüş' : selectedDirection)}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentIndex = availableDirections.indexOf(selectedDirection);
                        const nextIndex = (currentIndex + 1) % availableDirections.length;
                        handleDirectionChange(availableDirections[nextIndex]);
                      }}
                      className="shrink-0 p-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      title="Yön değiştir"
                    >
                      <ArrowLeftRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white shrink-0">
                        {selectedLine.id}
                      </span>
                      {metadata?.line && (
                        <span className="text-xs text-gray-300 truncate">
                          {metadata.line}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <button 
                      onClick={() => toggleFavorite(selectedLine.id)} 
                      className={cn(
                        "rounded-full bg-background p-1.5 hover:bg-white/10 transition-colors",
                        isFav ? "text-yellow-400" : "text-gray-400"
                      )}
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star size={16} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    <button 
                      onClick={closePanel} 
                      className="rounded-full bg-background p-1.5 text-gray-400 hover:bg-white/10"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-background p-3 border border-white/5">
                  {loading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader className="animate-spin text-primary" size={20} />
                    </div>
                  )}
                  
                  {error && !loading && (
                    <div className="flex items-center justify-center gap-2 text-red-400 py-4">
                      <ServerCrash size={16} />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}
                  
                  {currentHourData && status && !loading && !error && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">
                            {t('estimatedCrowd', { hour: selectedHour })}
                          </p>
                          <h3 className={cn("text-lg font-bold", status.color)}>
                            {t(`crowdLevels.${crowdLevel}`)}
                          </h3>
                        </div>
                        <div className={cn(
                          "rounded-lg px-3 py-2 border text-xs font-semibold",
                          status.badge,
                          status.color
                        )}>
                          {currentHourData.occupancy_pct}%
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Capacity</span>
                          <span className="flex items-center gap-1">
                            <Users size={10} /> 
                            {currentHourData.max_capacity.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2">
                          <div 
                            className={cn("h-2 rounded-full", status.progressColor)} 
                            style={{ width: `${currentHourData.occupancy_pct}%` }}
                          />
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t border-white/5 flex items-start gap-1.5 text-xs text-gray-400">
                        <Info size={12} className="shrink-0 mt-0.5" />
                        <p className="leading-tight">
                          Predicted: <span className="font-semibold text-secondary">
                            {Math.round(currentHourData.predicted_value).toLocaleString()}
                          </span> passengers
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 pb-2">
                <div className="rounded-xl bg-background p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-secondary" />
                      <p className="text-xs font-medium text-gray-300">Route View</p>
                    </div>
                    <button
                      onClick={() => {
                        if (hasRouteData) {
                          setShowRoute(!showRoute);
                        }
                      }}
                      disabled={!hasRouteData}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                        !hasRouteData && "opacity-40 cursor-not-allowed",
                        showRoute && hasRouteData
                          ? "bg-primary text-white" 
                          : "bg-background border border-white/10 text-gray-400 hover:bg-white/5"
                      )}
                      title={!hasRouteData ? "No route data available" : ""}
                    >
                      {showRoute ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {showRoute && availableDirections.length > 1 && (
                    <div className="flex gap-2 mt-2">
                      {availableDirections.map(dir => {
                        const info = directionInfo[dir];
                        const label = info?.label || (dir === 'G' ? 'Gidiş' : dir === 'D' ? 'Dönüş' : dir);
                        
                        return (
                          <button
                            key={dir}
                            onClick={() => {
                              setSelectedDirection(dir);
                              vibrate(5);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors truncate",
                              selectedDirection === dir
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-background border border-white/10 text-gray-400 hover:bg-white/5"
                            )}
                            title={label}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-4 space-y-3">
                <TimeSlider />

                <div className="rounded-xl bg-background border border-white/5 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsChartExpanded(!isChartExpanded);
                      vibrate(5);
                    }}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-400">
                      {t('forecast24h')}
                    </p>
                    {isChartExpanded ? (
                      <ChevronUp size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {(isChartExpanded || isDesktop) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 h-44">
                          {loading ? (
                            <div className="h-full flex items-center justify-center">
                              <Loader className="animate-spin text-primary" size={20} />
                            </div>
                          ) : (
                            <CrowdChart data={forecastData} />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
