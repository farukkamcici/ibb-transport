"use client";
import { useState } from 'react';
import { format } from 'date-fns';
import axios from 'axios';
import {
  Activity,
  Clock,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Trash2
} from 'lucide-react';

export default function SchedulerPanel({ schedulerStatus, onPauseResume, getAuthHeaders, onRefresh }) {
  const [triggeringJob, setTriggeringJob] = useState(null);
  const [message, setMessage] = useState("");
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  
  if (!schedulerStatus) return null;

  const isRunning = schedulerStatus.status === 'running';
  const isPaused = schedulerStatus.status === 'paused';

  const getJobIcon = (jobId) => {
    switch (jobId) {
      case 'daily_forecast':
        return Sparkles;
      case 'cleanup_old_forecasts':
        return Trash2;
      case 'data_quality_check':
        return ShieldCheck;
      case 'metro_schedule_prefetch':
        return TrainFront;
      default:
        return Activity;
    }
  };

  const handleTriggerJob = async (jobId) => {
    setTriggeringJob(jobId);
    setMessage("");
    
    try {
      const headers = getAuthHeaders();
      let endpoint = '';
      let params = {};
      
      switch(jobId) {
        case 'daily_forecast':
          endpoint = `${API_URL}/admin/scheduler/trigger/forecast`;
          params = { num_days: 2 };
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

      const response = await axios.post(endpoint, params, { headers });
      
      if (jobId === 'daily_forecast' && response.data) {
        setMessage(`✅ Forecast triggered for ${response.data.num_days} day(s): ${response.data.start_date} to ${response.data.end_date}`);
      } else {
        setMessage(`✅ Job '${jobId}' triggered successfully!`);
      }
      
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
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-800/40">
              <Clock className="h-4 w-4 text-gray-200" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Scheduler</h3>
              <p className="text-[11px] text-gray-500">Cron status & manual triggers</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              isRunning
                ? 'bg-green-950/30 text-green-300 border-green-900/40'
                : isPaused
                ? 'bg-yellow-950/30 text-yellow-300 border-yellow-900/40'
                : 'bg-slate-900/40 text-gray-300 border-white/10'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                isRunning ? 'bg-green-400' : isPaused ? 'bg-yellow-400' : 'bg-gray-500'
              }`} />
              {schedulerStatus.status?.toUpperCase() || 'UNKNOWN'}
            </span>

            <button
              onClick={onPauseResume}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                isPaused
                  ? 'bg-green-950/30 text-green-300 border-green-900/40 hover:bg-green-950/50'
                  : 'bg-yellow-950/30 text-yellow-300 border-yellow-900/40 hover:bg-yellow-950/50'
              }`}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm border ${
            message.includes("❌") 
              ? 'bg-red-950/30 border border-red-900/50 text-red-300' 
              : 'bg-green-950/30 border border-green-900/50 text-green-300'
          }`}>
            {message}
          </div>
        )}

        {schedulerStatus.jobs && schedulerStatus.jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {schedulerStatus.jobs.map((job) => {
              const nextRun = job.next_run ? new Date(job.next_run) : null;
              const lastRun = job.last_run ? new Date(job.last_run) : null;
              const errorRate = job.run_count > 0 
                ? ((job.error_count / job.run_count) * 100).toFixed(1) 
                : 0;
              const isTriggering = triggeringJob === job.id;
              const JobIcon = getJobIcon(job.id);

              return (
                <div key={job.id} className="rounded-xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/30">
                          <JobIcon className="h-4 w-4 text-gray-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{job.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono truncate">{job.id}</div>
                        </div>
                      </div>
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
                      className="w-full py-2 bg-blue-900/20 hover:bg-blue-900/30 text-blue-300 border border-blue-900/40 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isTriggering ? (
                        <>
                          <span className="animate-spin h-3 w-3 border-2 border-blue-400/20 border-t-blue-400 rounded-full"></span>
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
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
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleTriggerJob('daily_forecast')}
            disabled={triggeringJob === 'daily_forecast'}
            className="p-4 bg-blue-950/25 hover:bg-blue-950/40 border border-blue-900/40 rounded-xl text-left transition-all disabled:opacity-50"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900/20 border border-blue-900/30">
              <Sparkles className="h-4 w-4 text-blue-200" />
            </div>
            <div className="text-sm font-semibold text-blue-200">Generate Forecast</div>
            <div className="text-xs text-gray-500 mt-1">Run forecast for next 2 days (T+1, T+2)</div>
          </button>

          <button
            onClick={() => handleTriggerJob('cleanup_old_forecasts')}
            disabled={triggeringJob === 'cleanup_old_forecasts'}
            className="p-4 bg-red-950/25 hover:bg-red-950/40 border border-red-900/40 rounded-xl text-left transition-all disabled:opacity-50"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-red-900/20 border border-red-900/30">
              <Trash2 className="h-4 w-4 text-red-200" />
            </div>
            <div className="text-sm font-semibold text-red-200">Cleanup Old Data</div>
            <div className="text-xs text-gray-500 mt-1">Delete forecasts older than 3 days</div>
          </button>

          <button
            onClick={() => handleTriggerJob('data_quality_check')}
            disabled={triggeringJob === 'data_quality_check'}
            className="p-4 bg-green-950/25 hover:bg-green-950/40 border border-green-900/40 rounded-xl text-left transition-all disabled:opacity-50"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-green-900/20 border border-green-900/30">
              <ShieldCheck className="h-4 w-4 text-green-200" />
            </div>
            <div className="text-sm font-semibold text-green-200">Quality Check</div>
            <div className="text-xs text-gray-500 mt-1">Verify forecast coverage (T-1, T, T+1)</div>
          </button>
        </div>
      </div>
    </div>
  );
}
