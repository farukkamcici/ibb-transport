"use client";
import { format } from 'date-fns';

export default function SchedulerPanel({ schedulerStatus, onPauseResume }) {
  if (!schedulerStatus) return null;

  const isRunning = schedulerStatus.status === 'running';
  const isPaused = schedulerStatus.status === 'paused';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-md font-bold text-white tracking-wide">⏰ Cron Job Scheduler</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isRunning ? 'bg-green-950 text-green-400 border border-green-900' :
            isPaused ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' :
            'bg-gray-950 text-gray-400 border border-gray-800'
          }`}>
            {schedulerStatus.status?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
        <button
          onClick={onPauseResume}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isPaused 
              ? 'bg-green-900/20 text-green-400 border border-green-900 hover:bg-green-900/30'
              : 'bg-yellow-900/20 text-yellow-400 border border-yellow-900 hover:bg-yellow-900/30'
          }`}
        >
          {isPaused ? '▶️ Resume' : '⏸️ Pause'} Scheduler
        </button>
      </div>

      {schedulerStatus.jobs && schedulerStatus.jobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {schedulerStatus.jobs.map((job) => {
            const nextRun = job.next_run ? new Date(job.next_run) : null;
            const lastRun = job.last_run ? new Date(job.last_run) : null;
            const errorRate = job.run_count > 0 
              ? ((job.error_count / job.run_count) * 100).toFixed(1) 
              : 0;

            return (
              <div key={job.id} className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white mb-1">{job.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{job.id}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    job.last_status === 'success' ? 'bg-green-950 text-green-400' :
                    job.last_status?.includes('failed') ? 'bg-red-950 text-red-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {job.last_status || 'N/A'}
                  </div>
                </div>

                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Next Run:</span>
                    <span className="text-white font-mono">
                      {nextRun ? format(nextRun, 'MMM dd, HH:mm') : 'Not scheduled'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Last Run:</span>
                    <span className="text-gray-400 font-mono">
                      {lastRun ? format(lastRun, 'MMM dd, HH:mm') : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Executions:</span>
                    <span className="text-white font-bold">{job.run_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Error Rate:</span>
                    <span className={`font-bold ${
                      errorRate > 10 ? 'text-red-400' : errorRate > 5 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {errorRate}% ({job.error_count || 0})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-600">
        Timezone: {schedulerStatus.timezone || 'Europe/Istanbul'}
      </div>
    </div>
  );
}
