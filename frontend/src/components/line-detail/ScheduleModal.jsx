'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Clock, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ScheduleModal({ lineCode, isOpen, onClose, initialDirection = 'G', directionInfo = {} }) {
  const t = useTranslations('schedule');
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialDirection);

  useEffect(() => {
    if (!isOpen || !lineCode) return;

    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lines/${lineCode}/schedule`);
        if (!response.ok) throw new Error('Failed to fetch schedule');
        const data = await response.json();
        setSchedule(data);
      } catch (err) {
        console.error('Schedule fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [isOpen, lineCode]);

  useEffect(() => {
    setActiveTab(initialDirection);
  }, [initialDirection]);

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

  const directionSchedule = schedule?.[activeTab] || [];
  const nextIndex = getNextTimeIndex(directionSchedule);

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-full max-w-2xl mx-4 max-h-[80vh] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-white/10">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-secondary" />
            <h2 className="text-lg font-bold text-gray-200">{t('fullSchedule')}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-800 p-2 text-gray-400 hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/10 bg-slate-800/50">
          <div className="flex gap-2">
            {Object.keys(schedule || {}).filter(key => key !== 'meta').map((dir) => {
              // Priority: API meta > directionInfo from route data > fallback
              const apiMeta = schedule?.meta?.[dir];
              const routeInfo = directionInfo[dir];
              
              let label;
              let startStop = null;
              
              if (apiMeta?.end) {
                // Use API metadata (from HATADI)
                label = apiMeta.end;
                startStop = apiMeta.start;
              } else if (routeInfo?.endStop) {
                // Fallback to route polyline data
                label = routeInfo.endStop;
                startStop = routeInfo.startStop;
              } else {
                // Final fallback: generic labels
                label = dir === 'G' ? t('outbound') : dir === 'D' ? t('inbound') : dir;
              }
              
              return (
                <button
                  key={dir}
                  onClick={() => setActiveTab(dir)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors truncate",
                    activeTab === dir
                      ? "bg-primary text-white"
                      : "bg-slate-700 text-gray-400 hover:bg-slate-600"
                  )}
                  title={label}
                >
                  <span className="block truncate">{label}</span>
                </button>
              );
            })}
          </div>
          {(() => {
            const apiMeta = schedule?.meta?.[activeTab];
            const routeInfo = directionInfo[activeTab];
            const startStop = apiMeta?.start || routeInfo?.startStop;
            
            return startStop ? (
              <div className="mt-2 text-center">
                <p className="text-[10px] text-gray-500">
                  {t('departureFrom')}: <span className="text-gray-400 font-medium">{startStop}</span>
                </p>
              </div>
            ) : null;
          })()}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="animate-spin text-primary" size={24} />
            </div>
          ) : directionSchedule.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={32} className="mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-500">{t('noScheduleAvailable')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {directionSchedule.map((time, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "px-3 py-2 rounded-lg text-center text-sm font-medium border transition-colors",
                    idx === nextIndex
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                      : "bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700"
                  )}
                >
                  {time}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
