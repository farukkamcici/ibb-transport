"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import { format, addDays } from 'date-fns';
import {
  Activity,
  ShieldCheck,
  Sparkles,
  Trash2,
  LayoutDashboard,
  Wand2,
  CalendarClock,
  TrainFront,
  FileText,
  Users as UsersIcon,
  ListChecks,
  RefreshCw,
  LogOut,
  AlertTriangle,
  DatabaseZap
} from 'lucide-react';
import SchedulerPanel from '@/components/admin/SchedulerPanel';
import ForecastCoverage from '@/components/admin/ForecastCoverage';
import UserManagement from '@/components/admin/UserManagement';
import ReportsPanel from '@/components/admin/ReportsPanel';
import MetroCachePanel from '@/components/admin/MetroCachePanel';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// Tabs
const tabs = [
  { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
  { id: 'operations', name: 'Forecast Ops', icon: Wand2 },
  { id: 'scheduler', name: 'Scheduler', icon: CalendarClock },
  { id: 'metro-cache', name: 'Metro Cache', icon: TrainFront },
  { id: 'reports', name: 'Reports', icon: FileText },
  { id: 'users', name: 'Users', icon: UsersIcon },
  { id: 'jobs', name: 'Jobs', icon: ListChecks },
];

const StatCard = ({ title, value, status, subtext, icon: Icon }) => (
  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-5 shadow-sm backdrop-blur hover:border-white/15 transition-colors">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
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
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-slate-800/40">
          <Icon className="h-5 w-5 text-gray-300" />
        </div>
      )}
    </div>
  </div>
);

function AdminDashboardContent() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || 'tr';
  const { logout, user, getAuthHeaders } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [selectedError, setSelectedError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [jobLimit, setJobLimit] = useState(20);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [forecastCoverage, setForecastCoverage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [numDays, setNumDays] = useState(2);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [newReportsCount, setNewReportsCount] = useState(0);
  const [metroCacheStatus, setMetroCacheStatus] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/admin/login`);
  };

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, jobsRes, schedRes, covRes, reportsStatsRes, metroCacheRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`, { headers }),
        axios.get(`${API_URL}/admin/jobs?limit=${jobLimit}`, { headers }),
        axios.get(`${API_URL}/admin/scheduler/status`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/admin/forecasts/coverage`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/admin/reports/stats/summary`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/admin/metro/cache/status`, { headers }).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setSchedulerStatus(schedRes.data);
      setForecastCoverage(covRes.data);
      setMetroCacheStatus(metroCacheRes.data);
      
      if (reportsStatsRes.data) {
        setNewReportsCount(reportsStatsRes.data.by_status?.new || 0);
      }
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
      const response = await axios.post(
        `${API_URL}/admin/forecast/trigger?target_date=${selectedDate}&num_days=${numDays}`, 
        {}, 
        { headers }
      );
      
      if (response.data) {
        setTriggerMessage(`🚀 Forecast job started for ${response.data.num_days} day(s) (${response.data.start_date} to ${response.data.end_date}). This may take a few minutes.`);
      } else {
        setTriggerMessage(`🚀 Job started for ${selectedDate}. It usually takes ~30 seconds per day.`);
      }
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

  const handleDatabaseCleanup = async () => {
    if (cleanupConfirmText !== "DELETE") {
      setTriggerMessage("❌ Please type DELETE to confirm");
      return;
    }
    
    setIsCleaningUp(true);
    setTriggerMessage("");
    
    try {
      const headers = getAuthHeaders();
      const res = await axios.delete(`${API_URL}/admin/database/cleanup-all`, { headers });
      setTriggerMessage(`✅ ${res.data.message}: ${res.data.deleted_forecasts} forecasts + ${res.data.deleted_jobs} jobs deleted`);
      setShowCleanupModal(false);
      setCleanupConfirmText("");
      fetchData();
    } catch (error) {
      setTriggerMessage(`❌ ${error.response?.data?.detail || 'Database cleanup failed'}`);
    } finally {
      setIsCleaningUp(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/10 bg-slate-950/80">
          <div className="px-4 py-4 border-b border-white/10">
            <div className="text-sm text-gray-400">Istanbul Transport</div>
            <div className="text-lg font-semibold tracking-tight">Admin</div>
            <div className="mt-2 text-xs text-gray-500 font-mono">@{user?.username}</div>
          </div>
          <nav className="p-2 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors relative ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                  <span className="flex-1 text-left">{tab.name}</span>
                  {tab.id === 'reports' && newReportsCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {newReportsCount > 9 ? '9+' : newReportsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto p-3 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs text-gray-400">Admin</div>
                <div className="text-base font-semibold truncate">
                  {tabs.find((t) => t.id === activeTab)?.name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  onClick={handleLogout}
                  className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>

            {/* Tabs (mobile) */}
            <div className="lg:hidden px-4 sm:px-6 pb-3 overflow-x-auto">
              <div className="flex gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap border ${
                        active
                          ? 'bg-white/10 text-white border-white/10'
                          : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.name}
                      {tab.id === 'reports' && newReportsCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {newReportsCount > 9 ? '9+' : newReportsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Messages */}
        {triggerMessage && (
          <div className={`mb-6 p-4 rounded-lg text-sm border flex items-center gap-3 ${
            triggerMessage.includes("❌") 
              ? 'bg-red-950/30 border-red-900/50 text-red-300' 
              : 'bg-blue-950/30 border-blue-900/50 text-blue-300'
          } animate-in fade-in slide-in-from-top-2 duration-300`}>
            {triggerMessage}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                icon={TrainFront}
                title="Total Lines"
                value={stats.total_lines}
                subtext="Active transport lines"
              />
              <StatCard
                icon={DatabaseZap}
                title="Forecast Records"
                value={stats.total_forecasts.toLocaleString()}
                subtext="Hourly predictions stored"
              />
              <StatCard
                icon={CalendarClock}
                title="Last Execution"
                value={stats.last_run_status}
                status={stats.last_run_status}
                subtext={stats.last_run_time ? format(new Date(stats.last_run_time), 'MMM d, HH:mm:ss') : 'Never'}
              />
            </div>

            <ForecastCoverage coverage={forecastCoverage} onDeleteDate={handleDeleteDate} />
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Control Panel */}
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6">
              <h3 className="text-base font-semibold text-white mb-4">Forecast Operations</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date Picker */}
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Start Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-950/60 text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Number of Days */}
                <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                  <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Number of Days</label>
                  <select
                    value={numDays}
                    onChange={(e) => setNumDays(Number(e.target.value))}
                    className="w-full bg-slate-950/60 text-white px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value={1}>1 day (T+1)</option>
                    <option value={2}>2 days (T+1, T+2)</option>
                    <option value={3}>3 days (T+1, T+2, T+3)</option>
                  </select>
                </div>

                {/* Run Forecast */}
                <div className="bg-black/20 rounded-lg p-4 flex flex-col border border-white/5">
                  <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Generate Forecast</label>
                  <button
                    onClick={handleTrigger}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Running…' : 'Run Forecast'}
                  </button>
                </div>

                {/* Test */}
                <div className="bg-black/20 rounded-lg p-4 flex flex-col border border-white/5">
                  <label className="block text-xs text-gray-500 font-bold uppercase mb-2">Quick Test</label>
                  <button
                    onClick={handleTest}
                    disabled={isTesting}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all disabled:opacity-50"
                  >
                    {isTesting ? 'Testing…' : 'Run Test'}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleReset}
                  className="w-full bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg py-3 font-medium transition-all"
                >
                  Reset Stuck Jobs
                </button>
              </div>
            </div>

            {/* Test Results */}
            {testResult && (
              <div className="bg-gray-900 border border-purple-900/50 rounded-xl p-6">
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
              </div>
            )}

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                <div>
                  <h3 className="text-lg font-bold text-red-400">Danger Zone</h3>
                  <p className="text-gray-400 text-sm mt-1">Irreversible database operations</p>
                </div>
              </div>
              
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-bold mb-1">Delete All Database Data</h4>
                    <p className="text-gray-400 text-sm">
                      Remove all forecasts and job history. Transport lines and admin users will be preserved.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCleanupModal(true)}
                    className="ml-4 px-6 py-3 bg-red-900/50 hover:bg-red-900 text-red-300 hover:text-white border border-red-900 rounded-lg font-bold transition-all whitespace-nowrap"
                  >
                    🗑️ Delete All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metro Cache */}
        {activeTab === 'metro-cache' && (
          <MetroCachePanel 
            status={metroCacheStatus}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
          />
        )}

        {/* Scheduler Tab */}
        {activeTab === 'scheduler' && (
          <SchedulerPanel 
            schedulerStatus={schedulerStatus} 
            onPauseResume={handlePauseResume}
            getAuthHeaders={getAuthHeaders}
            onRefresh={fetchData}
          />
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <ReportsPanel API_URL={API_URL} getAuthHeaders={getAuthHeaders} />
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <UserManagement API_URL={API_URL} getAuthHeaders={getAuthHeaders} />
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-white/[0.03] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-white">Job History</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Latest executions and outcomes</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Show:</label>
                <select
                  value={jobLimit}
                  onChange={(e) => setJobLimit(Number(e.target.value))}
                  className="bg-slate-950/60 text-white text-xs px-2 py-1 rounded border border-white/10 focus:outline-none focus:border-blue-600"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-black/30 text-gray-300 uppercase text-[10px] font-semibold tracking-wider border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Job Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Target Date</th>
                    <th className="px-6 py-4">Start Time</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4 text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jobs.map((job) => {
                    const duration = job.end_time
                      ? ((new Date(job.end_time) - new Date(job.start_time)) / 1000).toFixed(1) + 's'
                      : 'Running...';
                    
                    // Job type icons and colors
                    const jobTypeConfig = {
                      'daily_forecast': { icon: Sparkles, color: 'text-blue-300', label: 'Forecast' },
                      'cleanup_old_forecasts': { icon: Trash2, color: 'text-red-300', label: 'Cleanup' },
                      'data_quality_check': { icon: ShieldCheck, color: 'text-green-300', label: 'Quality Check' },
                      'metro_schedule_prefetch': { icon: TrainFront, color: 'text-purple-300', label: 'Metro Cache' }
                    };
                    const config = jobTypeConfig[job.job_type] || { icon: Activity, color: 'text-gray-300', label: job.job_type };
                    const JobIcon = config.icon;

                    return (
                      <tr key={job.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                              <JobIcon className={`h-4 w-4 ${config.color}`} />
                            </span>
                            <div className="flex flex-col">
                              <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                              {job.job_metadata?.num_days && job.job_metadata.num_days > 1 && (
                                <span className="text-[10px] text-gray-500">({job.job_metadata.num_days} days)</span>
                              )}
                            </div>
                          </div>
                        </td>
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
                            {job.error_message && (
                              <button
                                onClick={() => setSelectedError(job.error_message)}
                                className="text-[10px] text-red-300 hover:text-red-200 underline"
                              >
                                View Error
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white font-bold text-sm">
                              {job.target_date ? (
                                job.end_date && job.end_date !== job.target_date ? (
                                  `${format(new Date(job.target_date), 'MMM dd')} - ${format(new Date(job.end_date), 'MMM dd, yyyy')}`
                                ) : (
                                  format(new Date(job.target_date), 'MMM dd, yyyy')
                                )
                              ) : 'N/A'}
                            </span>
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
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-600 italic">
                        No jobs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Error Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 max-w-3xl w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Error Log
              </h3>
              <button onClick={() => setSelectedError(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="bg-black/40 rounded-lg p-4 border border-white/10">
              <pre className="text-xs text-gray-300 overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                {selectedError}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Database Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border-2 border-red-900/50 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-xl font-bold text-red-400">Confirm Database Cleanup</h3>
            </div>
            
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-4">
              <p className="text-white font-bold mb-2">This will permanently delete:</p>
              <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                <li>All forecast records ({stats?.total_forecasts?.toLocaleString() || 0} records)</li>
                <li>All job execution history</li>
              </ul>
              <p className="text-green-400 text-sm mt-3 font-medium">✅ Preserved:</p>
              <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                <li>Transport lines metadata</li>
                <li>Admin users and credentials</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-red-400 mb-2">
                Type <span className="bg-red-950/50 px-2 py-1 rounded font-mono text-white">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={cleanupConfirmText}
                onChange={(e) => setCleanupConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-4 py-2 bg-gray-950 border border-red-900/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-600 font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCleanupModal(false);
                  setCleanupConfirmText("");
                }}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDatabaseCleanup}
                disabled={isCleaningUp || cleanupConfirmText !== "DELETE"}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCleaningUp ? '⏳ Deleting...' : '🗑️ Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
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
