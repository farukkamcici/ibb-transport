'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Clock, Loader, TrainFront } from 'lucide-react';
import { cn } from '@/lib/utils';
import useMetroTopology from '@/hooks/useMetroTopology';
import { getCachedSchedule, setCachedSchedule } from '@/lib/metroScheduleCache';

export default function MetroScheduleModal({ 
  lineCode, 
  isOpen, 
  onClose, 
  initialStationId,
  initialDirectionId 
}) {
  const t = useTranslations('schedule');
  const { getLine } = useMetroTopology();
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const metroLine = getLine(lineCode);
  const metroStations = metroLine?.stations?.sort((a, b) => a.order - b.order) || [];
  
  const [selectedStationId, setSelectedStationId] = useState(initialStationId);
  const [selectedDirectionId, setSelectedDirectionId] = useState(initialDirectionId);

  // Update selection when props change
  useEffect(() => {
    if (initialStationId) setSelectedStationId(initialStationId);
    if (initialDirectionId) setSelectedDirectionId(initialDirectionId);
  }, [initialStationId, initialDirectionId]);

  useEffect(() => {
    if (!isOpen || !selectedStationId || !selectedDirectionId) return;

    const fetchSchedule = async () => {
      // 1. Check cache first (instant)
      const cached = getCachedSchedule(selectedStationId, selectedDirectionId);
      
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
            BoardingStationId: selectedStationId,
            DirectionId: selectedDirectionId
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
        setCachedSchedule(selectedStationId, selectedDirectionId, data);
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
  }, [isOpen, selectedStationId, selectedDirectionId]);

  const getNextTimeIndex = (times) => {
    if (!times || times.length === 0) return -1;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (let i = 0; i < times.length; i++) {
      const [hours, minutes] = times[i].split(':').map(Number);
      const totalMinutes = hours * 60 + minutes;
      if (totalMinutes >= currentMinutes) {
        return i;
      }
    }

    return -1;
  };

  if (!isOpen) return null;

  const currentStation = metroStations.find(s => s.id === selectedStationId);
  const availableDirections = currentStation?.directions || [];
  const scheduleTimes = schedule?.Data?.[0]?.TimeInfos?.Times || [];
  const nextIndex = getNextTimeIndex(scheduleTimes);
  const destinationStation = schedule?.Data?.[0]?.LastStation || '';

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[80vh] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrainFront size={20} className="text-purple-400" />
            <h2 className="text-lg font-bold text-gray-200">{t('fullSchedule')}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-800 p-2 text-gray-400 hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Station and Direction Selectors */}
        <div className="px-6 py-3 border-b border-white/10 bg-slate-800/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Station Selector */}
            <div>
              <label className="block text-[10px] text-gray-400 mb-1.5">
                {t('selectStation')}
              </label>
              <select
                value={selectedStationId || ''}
                onChange={(e) => {
                  const newStationId = parseInt(e.target.value);
                  setSelectedStationId(newStationId);
                  const newStation = metroStations.find(s => s.id === newStationId);
                  if (newStation?.directions?.[0]) {
                    setSelectedDirectionId(newStation.directions[0].id);
                  }
                }}
                className="w-full appearance-none bg-slate-700/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
              >
                {metroStations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.description || station.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction Selector */}
            <div>
              <label className="block text-[10px] text-gray-400 mb-1.5">
                {t('selectDirection')}
              </label>
              <select
                value={selectedDirectionId || ''}
                onChange={(e) => setSelectedDirectionId(parseInt(e.target.value))}
                className="w-full appearance-none bg-slate-700/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                disabled={availableDirections.length === 0}
              >
                {availableDirections.map((direction) => (
                  <option key={direction.id} value={direction.id}>
                    {direction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Destination Info */}
          {destinationStation && (
            <div className="text-center">
              <p className="text-[10px] text-gray-500">
                {t('direction')}: <span className="text-purple-400 font-medium">{destinationStation}</span>
              </p>
            </div>
          )}
        </div>

        {/* Schedule Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="animate-spin text-purple-400" size={24} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Clock size={32} className="mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-500">{t('noScheduleAvailable')}</p>
            </div>
          ) : scheduleTimes.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={32} className="mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-500">{t('noScheduleAvailable')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {scheduleTimes.map((time, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "px-3 py-2 rounded-lg text-center text-sm font-medium border transition-colors",
                      idx === nextIndex
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                        : "bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700"
                    )}
                  >
                    {time}
                  </div>
                ))}
              </div>
              
              {/* Disclaimer */}
              <div className="mt-4 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-[10px] text-gray-400 text-center">
                  {t('metroScheduleDisclaimer')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
