"use client";
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import SchedulerPanel from '@/components/admin/SchedulerPanel';
import ForecastCoverage from '@/components/admin/ForecastCoverage';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// --- COMPONENTS ---

const StatCard = ({ title, value, status, subtext }) => (
  <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-sm hover:border-gray-700 transition-colors">
    <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-3xl font-bold text-white">{value}</span>
      {status && (
        <span className={`text-xs px-2 py-1 rounded-full ${
          status === 'SUCCESS' ? 'bg-green-900/50 text-green-400' :
          status === 'FAILED' ? 'bg-red-900/50 text-red-400' :
          status === 'RUNNING' ? 'bg-yellow-900/50 text-yellow-400 animate-pulse' :
          'bg-blue-900/50 text-blue-400'
        }`}>
          {status}
        </span>
      )}
    </div>
    {subtext && <p className="text-gray-500 text-xs mt-2">{subtext}</p>}
  </div>
);

const ErrorModal = ({ error, onClose }) => {
  if (!error) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-red-900/50 rounded-xl max-w-3xl w-full p-6 shadow-2xl ring-1 ring-red-900/20">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <span>⚠️</span> Execution Log
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                ✕
            </button>
        </div>
        <div className="bg-black rounded-lg p-4 border border-gray-800 overflow-hidden">
            <pre className="text-xs text-gray-300 overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono scrollbar-thin scrollbar-thumb-gray-700">
            {error}
            </pre>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---

function AdminDashboardContent() {
  const t = useTranslations('admin');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || 'tr';
  const { logout, user, getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [selectedError, setSelectedError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [featureStoreStats, setFeatureStoreStats] = useState(null);
  const [jobLimit, setJobLimit] = useState(20);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [forecastCoverage, setForecastCoverage] = useState(null);

  // Default: Yarın
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/admin/login`);
  };

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, jobsRes, fsStatsRes, schedRes, covRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`, { headers }),
        axios.get(`${API_URL}/admin/jobs?limit=${jobLimit}`, { headers }),
        axios.get(`${API_URL}/admin/feature-store/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/admin/scheduler/status`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/admin/forecasts/coverage`, { headers }).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setFeatureStoreStats(fsStatsRes.data);
      setSchedulerStatus(schedRes.data);
      setForecastCoverage(covRes.data);
    } catch (error) {
      console.error("Admin data fetch error:", error);
      if (error.response?.status === 401) {
        logout();
        router.push(`/${locale}/admin/login`);
      }
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [jobLimit]);

  const handleTrigger = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    setTriggerMessage("");
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/forecast/trigger?target_date=${selectedDate}`, {}, { headers });
      setTriggerMessage(`🚀 Job started for ${selectedDate}. It usually takes ~30 seconds.`);
      setTimeout(fetchData, 1000);
    } catch (error) {
      setTriggerMessage("❌ Error triggering job. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if(!confirm("⚠️ Are you sure? This will mark all stuck 'RUNNING' jobs as 'FAILED'.")) return;
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(`${API_URL}/admin/jobs/reset`, {}, { headers });
      setTriggerMessage(`🧹 ${res.data.message}`);
      fetchData();
    } catch (e) {
      setTriggerMessage("❌ Failed to reset jobs.");
    }
  }

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTriggerMessage("");
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(`${API_URL}/admin/forecast/test?num_lines=10&num_hours=6`, {}, { headers });
      setTestResult(res.data);
      setTriggerMessage("🧪 Test completed successfully!");
    } catch (e) {
      setTriggerMessage("❌ Test failed. Check console.");
      console.error(e);
    } finally {
      setIsTesting(false);
    }
  }

  const handlePauseResume = async () => {
    try {
      const headers = getAuthHeaders();
      const action = schedulerStatus?.status === 'paused' ? 'resume' : 'pause';
      await axios.post(`${API_URL}/admin/scheduler/${action}`, {}, { headers });
      setTriggerMessage(`⏸️ Scheduler ${action}d successfully`);
      fetchData();
    } catch (e) {
      setTriggerMessage("❌ Failed to toggle scheduler");
    }
  }

  const handleDeleteDate = async (dateStr) => {
    if (!confirm(`⚠️ Delete ALL forecasts for ${dateStr}?`)) return;
    try {
      const headers = getAuthHeaders();
      const res = await axios.delete(`${API_URL}/admin/forecasts/date/${dateStr}`, { headers });
      setTriggerMessage(`🗑️ Deleted ${res.data.deleted_count} forecasts for ${dateStr}`);
      fetchData();
    } catch (e) {
      setTriggerMessage("❌ Failed to delete forecasts");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 font-sans selection:bg-blue-900 selection:text-white">
      <ErrorModal error={selectedError} onClose={() => setSelectedError(null)} />

      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pb-6 border-b border-gray-800">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {t('title')}
            </h1>
            <p className="text-gray-400 mt-2 text-sm flex items-center gap-2">
                {t('dashboard')}
                <span className="text-gray-600">•</span>
                <span className="text-blue-400 font-mono text-xs">@{user?.username}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all border border-gray-800 hover:border-red-900/50"
            >
              🔒 Logout
            </button>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 bg-gray-900 p-2 rounded-xl border border-gray-800 shadow-lg">

            {/* Date Picker */}
            <div className="flex flex-col px-2 border-r border-gray-700">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Target Date</label>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-white text-sm focus:outline-none font-mono py-1"
                />
            </div>

            {/* Test Button */}
            <button
                onClick={handleTest}
                disabled={isTesting}
                className="px-4 py-2 text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 rounded-lg transition-all border border-transparent hover:border-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Quick performance test"
            >
                {isTesting ? "Testing..." : "🧪 Test"}
            </button>

            {/* Reset Button */}
            <button
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-900/50"
                title="Reset stuck jobs"
            >
                Reset Stuck
            </button>

            {/* Trigger Button */}
            <button
                onClick={handleTrigger}
                disabled={isLoading}
                className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-md ${
                isLoading 
                    ? 'bg-gray-800 cursor-not-allowed text-gray-500' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 hover:shadow-blue-900/40'
                }`}
            >
                {isLoading ? (
                <>
                    <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></span>
                    Running...
                </>
                ) : (
                <>
                    <span>⚡</span> Run Forecast
                </>
                )}
            </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {triggerMessage && (
          <div className={`p-4 rounded-lg text-sm border flex items-center gap-3 ${
              triggerMessage.includes("❌") 
              ? 'bg-red-950/30 border-red-900/50 text-red-300' 
              : 'bg-blue-950/30 border-blue-900/50 text-blue-300'
          } animate-in fade-in slide-in-from-top-2 duration-300`}>
            {triggerMessage}
          </div>
        )}

        {/* Test Results */}
        {testResult && (
          <div className="bg-gray-900 border border-purple-900/50 rounded-xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-purple-400">⚡ Performance Test Results</h3>
              <button onClick={() => setTestResult(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-950 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Config</div>
                <div className="text-sm font-mono text-white">{testResult.test_config}</div>
              </div>
              <div className="bg-gray-950 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Avg Lag Fetch</div>
                <div className="text-sm font-mono text-yellow-400">{testResult.avg_lag_fetch_time}</div>
              </div>
              <div className="bg-gray-950 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Bottleneck</div>
                <div className="text-sm font-bold text-red-400">{testResult.bottleneck}</div>
              </div>
              <div className="bg-gray-950 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Est. Full Job</div>
                <div className="text-sm font-mono text-green-400">{testResult.estimated_full_job_time}</div>
              </div>
            </div>

            <div className="bg-gray-950 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2">Timing Breakdown</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {Object.entries(testResult.timing_seconds).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-400">{key}:</span>
                    <span className="text-white">{value.toFixed(3)}s</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 bg-gray-950 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2">Sample Predictions</div>
              <div className="text-xs font-mono text-green-400">
                {testResult.sample_predictions.join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Lines"
              value={stats.total_lines}
              subtext="Active transport lines in DB"
            />
            <StatCard
              title="Forecast Records"
              value={stats.total_forecasts.toLocaleString()}
              subtext="Hourly predictions stored"
            />
            <StatCard
              title="Last Execution"
              value={stats.last_run_status}
              status={stats.last_run_status}
              subtext={stats.last_run_time ? format(new Date(stats.last_run_time), 'MMM d, HH:mm:ss') : 'Never'}
            />
          </div>
        )}

        {/* Feature Store Stats */}
        {featureStoreStats?.fallback_stats && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold text-white tracking-wide">📊 Feature Store Lag Fallback Statistics</h3>
              <div className="text-xs text-gray-500">
                Lookback: {featureStoreStats.config?.max_seasonal_lookback_years || 3} years
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Total Requests</div>
                <div className="text-2xl font-bold text-white">
                  {featureStoreStats.fallback_stats.total_requests?.toLocaleString() || 0}
                </div>
              </div>
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Seasonal Match</div>
                <div className="text-2xl font-bold text-green-400">
                  {featureStoreStats.fallback_stats.seasonal_pct?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  {featureStoreStats.fallback_stats.seasonal_match?.toLocaleString() || 0} hits
                </div>
              </div>
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Hour Fallback</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {featureStoreStats.fallback_stats.hour_fallback_pct?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  {featureStoreStats.fallback_stats.hour_fallback?.toLocaleString() || 0} hits
                </div>
              </div>
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Zero Fallback ⚠️</div>
                <div className={`text-2xl font-bold ${
                  (featureStoreStats.fallback_stats.zero_fallback_pct || 0) > 5 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {featureStoreStats.fallback_stats.zero_fallback_pct?.toFixed(1) || 0}%
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  {featureStoreStats.fallback_stats.zero_fallback?.toLocaleString() || 0} hits
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scheduler Status */}
        <SchedulerPanel 
          schedulerStatus={schedulerStatus}
          onPauseResume={handlePauseResume}
        />

        {/* Forecast Coverage */}
        <ForecastCoverage 
          coverage={forecastCoverage}
          onDeleteDate={handleDeleteDate}
        />

        {/* Job History Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
            <h3 className="text-md font-bold text-white tracking-wide">Job Execution History</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Show:</label>
              <select
                value={jobLimit}
                onChange={(e) => setJobLimit(Number(e.target.value))}
                className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-blue-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-gray-500">jobs</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-950 text-gray-300 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Target Date</th>
                  <th className="px-6 py-4">Start Time</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4 text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {jobs.map((job) => {
                  const duration = job.end_time
                    ? ((new Date(job.end_time) - new Date(job.start_time)) / 1000).toFixed(1) + 's'
                    : 'Running...';

                  return (
                    <tr key={job.id} className="hover:bg-gray-800/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            job.status === 'SUCCESS' ? 'bg-green-950 text-green-400 border-green-900/40' :
                            job.status === 'FAILED' ? 'bg-red-950 text-red-400 border-red-900/40' :
                            'bg-yellow-950 text-yellow-400 border-yellow-900/40 animate-pulse'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                                job.status === 'SUCCESS' ? 'bg-green-400' :
                                job.status === 'FAILED' ? 'bg-red-400' :
                                'bg-yellow-400'
                            }`}></span>
                            {job.status}
                            </span>

                            {/* View Log Button - Only visible on hover or if failed */}
                            {job.error_message && (
                                <button
                                    onClick={() => setSelectedError(job.error_message)}
                                    className="text-[10px] text-red-400 hover:text-white underline decoration-red-900 hover:decoration-white transition-all opacity-80 hover:opacity-100"
                                >
                                    View Error
                                </button>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-bold text-sm">
                            {job.target_date ? format(new Date(job.target_date), 'MMM dd, yyyy') : 'N/A'}
                          </span>
                          <span className="text-gray-500 text-[10px]">{job.job_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{format(new Date(job.start_time), 'yyyy-MM-dd HH:mm')}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{duration}</td>
                      <td className="px-6 py-4 text-right text-white font-bold font-mono">{job.records_processed.toLocaleString()}</td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-600 italic">
                      No jobs recorded yet. Trigger a forecast to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}