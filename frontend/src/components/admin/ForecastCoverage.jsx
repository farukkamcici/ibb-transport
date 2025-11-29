"use client";
import { format, parseISO } from 'date-fns';

export default function ForecastCoverage({ coverage, onDeleteDate }) {
  if (!coverage || !coverage.coverage) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-bold text-white tracking-wide">📅 Forecast Coverage (Next 7 Days)</h3>
        <div className="text-xs text-gray-500">Multi-day window: T-1, T, T+1</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-950 text-gray-300 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Forecasts</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
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
                <tr key={item.date} className={`hover:bg-gray-800/40 transition-colors ${
                  isToday ? 'bg-blue-950/20' : ''
                }`}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{format(date, 'MMM dd, yyyy')}</span>
                      <span className="text-xs text-gray-500">
                        {isToday ? 'Today (T)' : isPast ? `T${Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24))}` : `T+${Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24))}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                      item.status === 'complete' ? 'bg-green-950 text-green-400 border border-green-900' :
                      item.status === 'partial' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' :
                      'bg-red-950 text-red-400 border border-red-900'
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
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-900/50"
                        title={`Delete ${item.forecast_count} forecasts`}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
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
