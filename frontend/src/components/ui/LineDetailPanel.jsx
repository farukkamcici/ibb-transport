'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import useAppStore from '@/store/useAppStore';
import useRoutePolyline from '@/hooks/useRoutePolyline';
import useMediaQuery from '@/hooks/useMediaQuery';
import { 
  X, 
  TrendingUp, 
  Loader, 
  ServerCrash, 
  Users, 
  Info, 
  MapPin, 
  Route, 
  Star,
  ChevronDown,
  ChevronUp
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
  
  const { getAvailableDirections, getPolyline } = useRoutePolyline();
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

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

  if (!isPanelOpen || !selectedLine) return null;

  const currentHourData = forecastData.find(f => f.hour === selectedHour);
  const crowdLevel = currentHourData?.crowd_level;
  const status = currentHourData ? crowdLevelConfig[crowdLevel] : null;
  const metadata = selectedLine.metadata;
  const transportType = metadata ? getTransportType(metadata.transport_type_id) : null;
  const isFav = isFavorite(selectedLine.id);
  const availableDirections = getAvailableDirections(selectedLine.id);
  const hasRouteData = availableDirections.length > 0 && getPolyline(selectedLine.id, selectedDirection).length > 0;

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {!isDesktop && (
        <div 
          className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={closePanel}
        />
      )}
      
      <div className={cn(
        "fixed z-[999] bg-slate-900/95 backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden",
        isDesktop 
          ? "top-20 left-4 w-96 rounded-xl max-h-[calc(100vh-6rem)]" 
          : "bottom-0 left-0 right-0 rounded-t-3xl",
        isMinimized 
          ? "h-auto" 
          : isDesktop 
            ? "max-h-[calc(100vh-6rem)]" 
            : "h-[85vh]"
      )}>
        
        <div className={cn(
          "flex flex-col",
          isMinimized ? "pb-4" : "pb-20 md:pb-4"
        )}>
          
          <div 
            onClick={toggleMinimize}
            className="flex items-center justify-center py-2 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="w-12 h-1 bg-gray-600 rounded-full md:hidden" />
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{isMinimized ? 'Expand' : 'Minimize'}</span>
            </div>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white">
                    {selectedLine.id}
                  </span>
                  {transportType && (
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium border",
                      transportType.bgColor,
                      transportType.textColor,
                      transportType.borderColor
                    )}>
                      {getTransportLabel(transportType.labelKey)}
                    </span>
                  )}
                </div>
                {metadata?.line && (
                  <div className="flex items-start gap-2 text-xs text-gray-300 bg-background/50 rounded-lg p-2 border border-white/5">
                    <Route className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" />
                    <p className="flex-1 leading-tight">{metadata.line}</p>
                  </div>
                )}
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
                  {availableDirections.map(dir => (
                    <button
                      key={dir}
                      onClick={() => setSelectedDirection(dir)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        selectedDirection === dir
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-background border border-white/10 text-gray-400 hover:bg-white/5"
                      )}
                    >
                      {dir === 'G' ? 'Gidiş' : dir === 'D' ? 'Dönüş' : dir}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isMinimized && (
            <div className="overflow-y-auto flex-1 px-4 space-y-3">
              <TimeSlider />

              <div className="h-44">
                <p className="mb-2 text-xs font-medium text-gray-400">
                  {t('forecast24h')}
                </p>
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
    </>
  );
}