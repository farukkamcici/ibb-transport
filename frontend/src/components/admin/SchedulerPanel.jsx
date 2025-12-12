"use client";
import { useState } from 'react';
import { format } from 'date-fns';
import axios from 'axios';

export default function SchedulerPanel({ schedulerStatus, onPauseResume, getAuthHeaders, onRefresh }) {
  const [triggeringJob, setTriggeringJob] = useState(null);
  const [message, setMessage] = useState("");
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  
  if (!schedulerStatus) return null;

  const isRunning = schedulerStatus.status === 'running';
  const isPaused = schedulerStatus.status === 'paused';

  const handleTriggerJob = async (jobId) => {
    setTriggeringJob(jobId);
    setMessage("");
    
    try {
      const headers = getAuthHeaders();
      let endpoint = '';
      
      switch(jobId) {
        case 'daily_forecast':
          endpoint = `${API_URL}/admin/scheduler/trigger/forecast`;
          break;
        case 'cleanup_old_forecasts':
          endpoint = `${API_URL}/admin/scheduler/trigger/cleanup`;
          break;
        case 'data_quality_check':
          endpoint = `${API_URL}/admin/scheduler/trigger/quality-check`;
          break;
        case 'metro_schedule_prefetch':
          await axios.post(`${API_URL}/admin/metro/cache/refresh`, { mode: 'all', force: true }, { headers });
          setMessage(`✅ Metro timetable refresh scheduled!`);
          setTimeout(() => {
            onRefresh?.();
            setMessage("");
          }, 2000);
          setTriggeringJob(null);
          return;
        default:
          throw new Error('Unknown job type');
      }

      await axios.post(endpoint, {}, { headers });
      setMessage(`✅ Job '${jobId}' triggered successfully!`);
      
      // Refresh after 2 seconds
      setTimeout(() => {
        onRefresh?.();
        setMessage("");
      }, 2000);
      
    } catch (error) {
      setMessage(`❌ Failed to trigger job: ${error.response?.data?.detail || error.message}`);
    } finally {
      setTriggeringJob(null);
    }
  };

  return (
    <div className="space-y-4">
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

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.includes("❌") 
              ? 'bg-red-950/30 border border-red-900/50 text-red-300' 
              : 'bg-green-950/30 border border-green-900/50 text-green-300'
          }`}>
            {message}
          </div>
        )}

        {schedulerStatus.jobs && schedulerStatus.jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {schedulerStatus.jobs.map((job) => {
              const nextRun = job.next_run ? new Date(job.next_run) : null;
              const lastRun = job.last_run ? new Date(job.last_run) : null;
              const errorRate = job.run_count > 0 
                ? ((job.error_count / job.run_count) * 100).toFixed(1) 
                : 0;
              const isTriggering = triggeringJob === job.id;

              return (
                <div key={job.id} className="bg-gray-950 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white mb-1">{job.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">{job.id}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      job.last_status === 'success' ? 'bg-green-950 text-green-400' :
                      job.last_status?.includes('failed') ? 'bg-red-950 text-red-400' :
                      job.last_status === 'healthy' ? 'bg-green-950 text-green-400' :
                      job.last_status === 'issues_found' ? 'bg-yellow-950 text-yellow-400' :
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

                  {/* Manual Trigger Button */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => handleTriggerJob(job.id)}
                      disabled={isTriggering}
                      className="w-full py-2 bg-blue-900/20 hover:bg-blue-900/30 text-blue-400 border border-blue-900/50 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isTriggering ? (
                        <>
                          <span className="animate-spin h-3 w-3 border-2 border-blue-400/20 border-t-blue-400 rounded-full"></span>
                          Running...
                        </>
                      ) : (
                        <>
                          <span>▶️</span>
                          Run Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-600 flex items-center gap-2">
          <span>🌍 Timezone: {schedulerStatus.timezone || 'Europe/Istanbul'}</span>
          <span>•</span>
          <span>🔄 Auto-refresh: 5s</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-md font-bold text-white mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleTriggerJob('daily_forecast')}
            disabled={triggeringJob === 'daily_forecast'}
            className="p-4 bg-blue-950/30 hover:bg-blue-950/50 border border-blue-900/50 rounded-lg text-left transition-all disabled:opacity-50"
          >
            <div className="text-2xl mb-2">🔮</div>
            <div className="text-sm font-bold text-blue-400">Generate Forecast</div>
            <div className="text-xs text-gray-500 mt-1">Run forecast for tomorrow</div>
          </button>

          <button
            onClick={() => handleTriggerJob('cleanup_old_forecasts')}
            disabled={triggeringJob === 'cleanup_old_forecasts'}
            className="p-4 bg-red-950/30 hover:bg-red-950/50 border border-red-900/50 rounded-lg text-left transition-all disabled:opacity-50"
          >
            <div className="text-2xl mb-2">🗑️</div>
            <div className="text-sm font-bold text-red-400">Cleanup Old Data</div>
            <div className="text-xs text-gray-500 mt-1">Delete forecasts older than 3 days</div>
          </button>

          <button
            onClick={() => handleTriggerJob('data_quality_check')}
            disabled={triggeringJob === 'data_quality_check'}
            className="p-4 bg-green-950/30 hover:bg-green-950/50 border border-green-900/50 rounded-lg text-left transition-all disabled:opacity-50"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-sm font-bold text-green-400">Quality Check</div>
            <div className="text-xs text-gray-500 mt-1">Verify data integrity</div>
          </button>
        </div>
      </div>
    </div>
  );
}
