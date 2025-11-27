// frontend/src/components/ui/CrowdChart.jsx
'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useMemo } from 'react';

const getCrowdColor = (occupancy_pct) => {
  if (occupancy_pct >= 70) return '#ef4444';
  if (occupancy_pct >= 50) return '#f97316';
  if (occupancy_pct >= 30) return '#eab308';
  return '#10b981';
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-surface/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-gray-400">Hour: {data.hour}:00</p>
      <p className="text-sm font-bold text-text mt-1">Occupancy: {data.occupancy_pct}%</p>
      <p className="text-xs text-secondary mt-1">Level: {data.crowd_level}</p>
      <p className="text-xs text-gray-400 mt-1">
        ~{Math.round(data.predicted_value).toLocaleString()} passengers
      </p>
    </div>
  );
};

export default function CrowdChart({ data }) {
  const formattedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      hour: item.hour,
      occupancy_pct: item.occupancy_pct,
      crowd_level: item.crowd_level,
      predicted_value: item.predicted_value,
      color: getCrowdColor(item.occupancy_pct),
    }));
  }, [data]);

  if (!formattedData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No forecast data available
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

          <Tooltip content={<CustomTooltip />} />

          <Area 
            type="monotone" 
            dataKey="occupancy_pct" 
            stroke="#3b82f6" 
            fill="url(#colorOccupancy)" 
            strokeWidth={2}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}