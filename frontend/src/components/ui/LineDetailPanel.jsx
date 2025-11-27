'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import useAppStore from '@/store/useAppStore';
import { X, TrendingUp, Loader, ServerCrash, Users, Info, MapPin, Route, Star } from 'lucide-react';
import TimeSlider from './TimeSlider';
import CrowdChart from './CrowdChart';
import { cn } from '@/lib/utils';
import { getForecast } from '@/lib/api';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';

const crowdLevelConfig = {
  "Low": { color: "text-emerald-400", progressColor: "bg-emerald-500" },
  "Medium": { color: "text-yellow-400", progressColor: "bg-yellow-500" },
  "High": { color: "text-orange-400", progressColor: "bg-orange-500" },
  "Very High": { color: "text-red-400", progressColor: "bg-red-500" },
  "Unknown": { color: "text-gray-400", progressColor: "bg-gray-500" },
};

export default function LineDetailPanel() {
  const t = useTranslations('lineDetail');
  const getTransportLabel = useGetTransportLabel();
  const { selectedLine, isPanelOpen, closePanel, selectedHour, toggleFavorite, isFavorite } = useAppStore();
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  if (!isPanelOpen || !selectedLine) return null;

  const currentHourData = forecastData.find(f => f.hour === selectedHour);
  const crowdLevel = currentHourData?.crowd_level;
  const status = currentHourData ? crowdLevelConfig[crowdLevel] : null;
  const metadata = selectedLine.metadata;
  const transportType = metadata ? getTransportType(metadata.transport_type_id) : null;
  const isFav = isFavorite(selectedLine.id);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] flex flex-col rounded-t-3xl bg-surface p-6 pb-20 shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto">
      
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white">
              {selectedLine.id}
            </span>
            {transportType && (
              <span className={`px-2 py-1 rounded text-xs font-medium border ${transportType.bgColor} ${transportType.textColor} ${transportType.borderColor}`}>
                {getTransportLabel(transportType.labelKey)}
              </span>
            )}
          </div>
          {metadata?.line && (
            <div className="flex items-start gap-2 text-sm text-gray-300 bg-background/50 rounded-lg p-3 border border-white/5">
              <Route className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <p className="flex-1">{metadata.line}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button 
            onClick={() => toggleFavorite(selectedLine.id)} 
            className={cn(
              "rounded-full bg-background p-2 hover:bg-white/10 transition-colors",
              isFav ? "text-yellow-400" : "text-gray-400"
            )}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={20} fill={isFav ? "currentColor" : "none"} />
          </button>
          <button onClick={closePanel} className="rounded-full bg-background p-2 text-gray-400 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-background p-4 border border-white/5">
        <div className="flex flex-col min-h-[120px]">
          {loading && <div className="flex-1 flex items-center justify-center"><Loader className="animate-spin text-primary" /></div>}
          {error && !loading && (
            <div className="flex-1 flex items-center justify-center gap-2 text-red-400">
              <ServerCrash size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {currentHourData && status && !loading && !error && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{t('estimatedCrowd', { hour: selectedHour })}</p>
                  <h3 className={cn("text-2xl font-bold", status.color)}>
                    {t(`crowdLevels.${crowdLevel}`)}
                  </h3>
                </div>
                <div className={cn("rounded-full p-3 bg-white/5", status.color)}>
                  <TrendingUp size={24} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-secondary mb-1">
                  <span>{t('occupancy')}: {currentHourData.occupancy_pct}%</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {currentHourData.max_capacity.toLocaleString()}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2.5">
                  <div 
                    className={cn("h-2.5 rounded-full", status.progressColor)} 
                    style={{ width: `${currentHourData.occupancy_pct}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2 text-xs text-gray-400">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>
                  {t('predictedPassengers')}: <span className="font-semibold text-secondary">{Math.round(currentHourData.predicted_value).toLocaleString()}</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <TimeSlider />

      <div className="mt-4 h-48 w-full">
        <p className="mb-2 text-xs font-medium text-gray-400">{t('forecast24h')}</p>
        {loading ? <div className="h-full flex items-center justify-center"><Loader className="animate-spin text-primary" /></div> : <CrowdChart data={forecastData} />}
      </div>
    </div>
  );
}
