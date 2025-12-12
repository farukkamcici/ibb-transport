"use client";
import { format, parseISO } from 'date-fns';
import { CalendarDays, Trash2 } from 'lucide-react';

export default function ForecastCoverage({ coverage, onDeleteDate }) {
  if (!coverage || !coverage.coverage) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-800/40">
            <CalendarDays className="h-4 w-4 text-gray-200" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Forecast Coverage</h3>
            <p className="text-[11px] text-gray-500">Next 7 days (includes T-1, T, T+1)</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-gray-300 uppercase text-[10px] font-semibold tracking-wider border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Forecasts</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {coverage.coverage.map((item, index) => {
              const date = parseISO(item.date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dateObj = new Date(date);
              dateObj.setHours(0, 0, 0, 0);
              
              const isToday = dateObj.getTime() === today.getTime();
              const isPast = dateObj < today;
              const isFuture = dateObj > today;

              return (
                <tr key={item.date} className={`hover:bg-white/[0.03] transition-colors ${isToday ? 'bg-blue-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{format(date, 'MMM dd, yyyy')}</span>
                      <span className="text-xs text-gray-500">
                        {isToday ? 'Today (T)' : isPast ? `T${Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24))}` : `T+${Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24))}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border ${
                      item.status === 'complete' ? 'bg-green-950/30 text-green-300 border-green-900/40' :
                      item.status === 'partial' ? 'bg-yellow-950/30 text-yellow-300 border-yellow-900/40' :
                      'bg-red-950/30 text-red-300 border-red-900/40'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        item.status === 'complete' ? 'bg-green-400' :
                        item.status === 'partial' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`}></span>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white font-bold">
                    {item.forecast_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">
                    {item.lines_covered}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.forecast_count > 0 && (
                      <button
                        onClick={() => onDeleteDate(item.date)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-950/30 px-3 py-1.5 rounded-lg transition-colors border border-red-900/30"
                        title={`Delete ${item.forecast_count} forecasts`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span>Complete (&gt;10k)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <span>Partial (1-10k)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <span>Missing (0)</span>
        </div>
      </div>
    </div>
  );
}
