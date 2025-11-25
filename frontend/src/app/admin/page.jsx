"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays } from 'date-fns';

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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [selectedError, setSelectedError] = useState(null);

  // Default: Yarın
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  const fetchData = async () => {
    try {
      const [statsRes, jobsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/stats`),
        axios.get(`${API_URL}/admin/jobs`)
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
    } catch (error) {
      console.error("Admin data fetch error:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTrigger = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    setTriggerMessage("");
    try {
      await axios.post(`${API_URL}/admin/forecast/trigger?target_date=${selectedDate}`);
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
      const res = await axios.post(`${API_URL}/admin/jobs/reset`);
      setTriggerMessage(`🧹 ${res.data.message}`);
      fetchData();
    } catch (e) {
      setTriggerMessage("❌ Failed to reset jobs.");
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
              Transport AI Monitor
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
                System Status & ETL Pipeline Control
            </p>
          </div>

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

        {/* Job History Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
            <h3 className="text-md font-bold text-white tracking-wide">Job Execution History</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Last 10 jobs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-950 text-gray-300 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Job Type</th>
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
                      <td className="px-6 py-4 text-gray-300 font-medium">{job.job_type}</td>
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