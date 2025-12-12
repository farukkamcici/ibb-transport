'use client';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import BottomNav from '@/components/ui/BottomNav';
import LineDetailPanel from '@/components/ui/LineDetailPanel';
import useAppStore from '@/store/useAppStore';
import { Star, TrendingUp, MapPin, Loader, AlertTriangle } from 'lucide-react';
import { getLineMetadata, getForecast, getLineStatus } from '@/lib/api';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';
import { cn } from '@/lib/utils';

const crowdLevelConfig = {
  "Low": { color: "text-emerald-400", bgColor: "bg-emerald-500/20", badge: "bg-emerald-500" },
  "Medium": { color: "text-yellow-400", bgColor: "bg-yellow-500/20", badge: "bg-yellow-500" },
  "High": { color: "text-orange-400", bgColor: "bg-orange-500/20", badge: "bg-orange-500" },
  "Very High": { color: "text-red-400", bgColor: "bg-red-500/20", badge: "bg-red-500" },
};

function FavoriteLineCard({ lineId }) {
  const t = useTranslations('forecast');
  const locale = useLocale();
  const getTransportLabel = useGetTransportLabel();
  const { setSelectedLine } = useAppStore();
  const [metadata, setMetadata] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [lineStatus, setLineStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meta, forecastData, statusData] = await Promise.all([
          getLineMetadata(lineId),
          getForecast(lineId, new Date()),
          getLineStatus(lineId)
        ]);
        
        setMetadata(meta);
        setLineStatus(statusData);
        
        const currentHour = new Date().getHours();
        const current = forecastData.find(f => f.hour === currentHour);
        setCurrentStatus(current);
      } catch (error) {
        console.error('Error fetching line data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lineId]);

  const handleCardClick = () => {
    if (metadata) {
      const lineObject = {
        id: metadata.line_name,
        name: metadata.line_name,
        metadata: {
          transport_type_id: metadata.transport_type_id,
          road_type: metadata.road_type,
          line: metadata.line,
        }
      };
      setSelectedLine(lineObject);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-surface p-6 border border-white/5 min-h-[100px]">
        <Loader className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!metadata) return null;

  const transportType = getTransportType(metadata.transport_type_id);
  const crowdLevel = currentStatus?.crowd_level || 'Unknown';
  const config = crowdLevelConfig[crowdLevel] || { color: "text-gray-400", bgColor: "bg-gray-500/20", badge: "bg-gray-500" };

  return (
    <button
      onClick={handleCardClick}
      className={cn(
        "w-full flex flex-col gap-3 rounded-xl bg-surface p-4 border border-white/5 hover:bg-white/5 transition-all text-left relative",
        lineStatus?.status === 'OUT_OF_SERVICE' && "opacity-70"
      )}
    >
      {lineStatus?.status === 'WARNING' && (
        <div className="absolute -top-1 -right-1">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative flex items-center justify-center w-6 h-6 bg-red-500 rounded-full border-2 border-background">
              <AlertTriangle size={12} className="text-white" />
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white">
            {metadata.line_name}
          </span>
          {transportType && (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${transportType.bgColor} ${transportType.textColor} ${transportType.borderColor}`}>
              {getTransportLabel(transportType.labelKey)}
            </span>
          )}
        </div>
        {currentStatus && (
          <div className={cn("px-2 py-1 rounded-lg text-xs font-semibold", config.badge, "text-white")}>
            {t(`crowdLevels.${crowdLevel}`)}
          </div>
        )}
      </div>

      {metadata.line && (
        <p className="text-sm text-gray-300 line-clamp-1">{metadata.line}</p>
      )}

      {currentStatus && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <TrendingUp size={12} />
            {t('occupancy')}: {currentStatus.occupancy_pct}%
          </span>
          <span>
            {t('passengers')}: {Math.round(currentStatus.predicted_value).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
          </span>
        </div>
      )}
    </button>
  );
}

export default function ForecastPage() {
  const t = useTranslations('forecast');
  const router = useRouter();
  const { favorites } = useAppStore();

  const handleGoToMap = () => {
    router.push('/');
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-background pb-20 font-sans text-text">
      <div className="p-6 pt-12">
        <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="rounded-full bg-surface p-6 mb-4 border border-white/5">
              <Star size={48} className="text-gray-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              {t('emptyState.title')}
            </h2>
            <p className="text-sm text-gray-400 mb-6 max-w-md">
              {t('emptyState.description')}
            </p>
            <button
              onClick={handleGoToMap}
              className="px-6 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <MapPin size={18} />
              {t('emptyState.button')}
            </button>
          </div>
        ) : (
          favorites.map((lineId) => (
            <FavoriteLineCard key={lineId} lineId={lineId} />
          ))
        )}
      </div>

      <BottomNav />
      <LineDetailPanel />
    </main>
  );
}
