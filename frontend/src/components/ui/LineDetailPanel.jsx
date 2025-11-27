'use client';
import { useState, useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import { X, TrendingUp, Loader, ServerCrash, Users } from 'lucide-react';
import TimeSlider from './TimeSlider';
import CrowdChart from './CrowdChart';
import { cn } from '@/lib/utils';
import { getForecast } from '@/lib/api';

const crowdLevelConfig = {
  "Low": { text: "Low Density", color: "text-emerald-400", progressColor: "bg-emerald-500" },
  "Medium": { text: "Medium Density", color: "text-yellow-400", progressColor: "bg-yellow-500" },
  "High": { text: "High Density", color: "text-orange-400", progressColor: "bg-orange-500" },
  "Very High": { text: "Very High Density", color: "text-red-400", progressColor: "bg-red-500" },
  "Unknown": { text: "Unknown", color: "text-gray-400", progressColor: "bg-gray-500" },
};

export default function LineDetailPanel() {
  const { selectedLine, isPanelOpen, closePanel, selectedHour } = useAppStore();
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
  const status = currentHourData ? crowdLevelConfig[currentHourData.crowd_level] : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] flex flex-col rounded-t-3xl bg-surface p-6 pb-20 shadow-2xl transition-transform duration-300 ease-out">
      
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white">
              {selectedLine.id}
            </span>
            <h2 className="text-xl font-bold text-text">{selectedLine.name}</h2>
          </div>
        </div>
        <button onClick={closePanel} className="rounded-full bg-background p-2 text-gray-400 hover:bg-white/10">
          <X size={20} />
        </button>
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
                  <p className="text-xs text-gray-400">Estimated Crowd at {selectedHour}:00</p>
                  <h3 className={cn("text-2xl font-bold", status.color)}>
                    {status.text}
                  </h3>
                </div>
                <div className={cn("rounded-full p-3 bg-white/5", status.color)}>
                  <TrendingUp size={24} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-secondary mb-1">
                  <span>Occupancy: {currentHourData.occupancy_pct}%</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {currentHourData.max_capacity}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2.5">
                  <div 
                    className={cn("h-2.5 rounded-full", status.progressColor)} 
                    style={{ width: `${currentHourData.occupancy_pct}%` }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <TimeSlider />

      <div className="mt-4 h-48 w-full">
        <p className="mb-2 text-xs font-medium text-gray-400">24-Hour Forecast</p>
        {loading ? <div className="h-full flex items-center justify-center"><Loader className="animate-spin text-primary" /></div> : <CrowdChart data={forecastData} />}
      </div>
    </div>
  );
}