// frontend/src/components/ui/CrowdChart.jsx
'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts';
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const getCrowdColor = (occupancy_pct) => {
  if (occupancy_pct >= 70) return '#ef4444';
  if (occupancy_pct >= 50) return '#f97316';
  if (occupancy_pct >= 30) return '#eab308';
  return '#10b981';
};

export default function CrowdChart({ data }) {
  const t = useTranslations('lineDetail');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const point = payload[0].payload;

    // Out-of-service hours
    if (!point.in_service || point.occupancy_pct === null) {
      return (
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/95 p-3 shadow-xl backdrop-blur-sm">
          <p className="text-xs font-semibold text-gray-400">
            {t('chart.hourLabel', { hour: point.hour })}
          </p>
          <p className="text-sm font-bold text-slate-300 mt-1">{t('chart.outOfService')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('chart.noTripsScheduled')}</p>
        </div>
      );
    }

    const crowdLabel = point.crowd_level ? t(`crowdLevels.${point.crowd_level}`) : t('crowdLevels.Unknown');

    return (
      <div className="rounded-lg border border-white/10 bg-surface/95 p-3 shadow-xl backdrop-blur-sm">
        <p className="text-xs font-semibold text-gray-400">
          {t('chart.hourLabel', { hour: point.hour })}
        </p>
        <p className="text-sm font-bold text-text mt-1">
          {t('chart.occupancyLabel', { pct: point.occupancy_pct })}
        </p>
        <p className="text-xs text-secondary mt-1">
          {t('chart.levelLabel', { level: crowdLabel })}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {t('chart.passengersApprox', { count: numberFormatter.format(Math.round(point.predicted_value)) })}
        </p>
      </div>
    );
  };
  
  const formattedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      hour: item.hour,
      // Use null for out-of-service hours to create gaps in the chart
      occupancy_pct: item.in_service ? item.occupancy_pct : null,
      crowd_level: item.crowd_level,
      predicted_value: item.predicted_value,
      in_service: item.in_service,
      color: item.in_service ? getCrowdColor(item.occupancy_pct) : '#64748b',
    }));
  }, [data]);
  
  // Find out-of-service hour ranges for background shading
  const outOfServiceRanges = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const ranges = [];
    let rangeStart = null;
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      
      if (!item.in_service) {
        if (rangeStart === null) {
          rangeStart = item.hour;
        }
      } else {
        if (rangeStart !== null) {
          ranges.push({ start: rangeStart, end: data[i - 1].hour + 1 });
          rangeStart = null;
        }
      }
    }
    
    // Handle case where last hours are out of service
    if (rangeStart !== null) {
      ranges.push({ start: rangeStart, end: 24 });
    }
    
    return ranges;
  }, [data]);

  if (!formattedData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {tErrors('noForecastData')}
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
              <stop offset="50%" stopColor="#eab308" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          
          {/* Shade out-of-service hours */}
          {outOfServiceRanges.map((range, idx) => (
            <ReferenceArea
              key={idx}
              x1={range.start}
              x2={range.end}
              fill="#1e293b"
              fillOpacity={0.3}
              stroke="none"
            />
          ))}

          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval={2}
            tickFormatter={(hour) => `${hour}h`}
          />

          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(value) => `${value}%`}
          />

          <Tooltip 
            content={<CustomTooltip />}
            cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: false, y: true }}
            shared={false}
            trigger="hover"
            wrapperStyle={{ outline: 'none' }}
          />

          <Area 
            type="monotone" 
            dataKey="occupancy_pct" 
            stroke="#3b82f6" 
            fill="url(#colorOccupancy)" 
            strokeWidth={2}
            animationDuration={800}
            connectNulls={false}
            activeDot={{
              r: 4,
              fill: '#3b82f6',
              stroke: '#fff',
              strokeWidth: 2,
              style: { cursor: 'pointer' }
            }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
