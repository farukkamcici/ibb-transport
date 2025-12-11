"use client";

import { useState } from 'react';
import axios from 'axios';
import { formatDistanceToNow, format } from 'date-fns';

export default function MetroCachePanel({ status, getAuthHeaders, onRefresh }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  const [message, setMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pairForm, setPairForm] = useState({ stationId: "", directionId: "", targetDate: "" });
  const [cleanupDays, setCleanupDays] = useState(5);

  if (!status) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-sm text-gray-400">Loading metro cache status...</p>
      </div>
    );
  }

  const today = status.today || {};
  const storage = status.storage || {};
  const runtime = status.runtime || {};
  const pendingPairs = runtime.pending_pairs || [];

  const refreshStatus = async () => {
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  };

  const triggerRefresh = async (force = false) => {
    setIsRefreshing(true);
    setMessage("");
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/metro/cache/refresh`, { mode: 'all', force }, { headers });
      setMessage(force ? '🚇 Forced refresh scheduled.' : '🚇 Refresh scheduled.');
      setTimeout(refreshStatus, 1500);
    } catch (error) {
      setMessage(`❌ Failed to schedule refresh: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerPairRefresh = async () => {
    if (!pairForm.stationId || !pairForm.directionId) {
      setMessage('❌ Station ID and Direction ID are required');
      return;
    }
    setIsRefreshing(true);
    setMessage("");
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/metro/cache/refresh`, {
        mode: 'pair',
        station_id: Number(pairForm.stationId),
        direction_id: Number(pairForm.directionId),
        target_date: pairForm.targetDate || undefined
      }, { headers });
      setMessage('✅ Pair refresh scheduled');
      setPairForm({ ...pairForm, targetDate: "" });
      setTimeout(refreshStatus, 1500);
    } catch (error) {
      setMessage(`❌ Pair refresh failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerCleanup = async () => {
    if (!cleanupDays || cleanupDays < 1) {
      setMessage('❌ Cleanup days must be >= 1');
      return;
    }
    setIsRefreshing(true);
    setMessage("");
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/metro/cache/cleanup?days=${cleanupDays}`, {}, { headers });
      setMessage(`🧹 Cleanup scheduled (cutoff ${cleanupDays} day(s))`);
      setTimeout(refreshStatus, 1500);
    } catch (error) {
      setMessage(`❌ Cleanup failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-white text-lg font-bold flex items-center gap-2">🚇 Metro Timetable Cache</h3>
            {runtime.last_run && (
              <p className="text-xs text-gray-500">
                Last run {formatDistanceToNow(new Date(runtime.last_run), { addSuffix: true })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => triggerRefresh(false)}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-900/20 border border-blue-800 text-blue-300 hover:bg-blue-900/30 disabled:opacity-50"
            >
              🔄 Refresh All
            </button>
            <button
              onClick={() => triggerRefresh(true)}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-purple-900/20 border border-purple-800 text-purple-300 hover:bg-purple-900/30 disabled:opacity-50"
            >
              ⚠️ Force Refresh
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.startsWith('❌') ? 'bg-red-950/30 border border-red-900/40 text-red-200' : 'bg-green-950/30 border border-green-900/40 text-green-200'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            title="Total Pairs"
            value={today.pairs_total || 0}
            subtext="Station + direction combos"
          />
          <Stat
            title="Cached Today"
            value={`${today.pairs_cached || 0} / ${today.pairs_total || 0}`}
            subtext={`${today.fresh_pairs || 0} fresh • ${today.stale_pairs || 0} stale`}
          />
          <Stat
            title="Pending Pairs"
            value={pendingPairs.length}
            subtext={runtime.retry_job_active ? 'Retry job active' : 'No retry job'}
            status={runtime.retry_job_active ? 'warning' : 'success'}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-950/70 border border-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-white mb-2">Refresh Single Pair</h4>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Station ID"
                className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-white"
                value={pairForm.stationId}
                onChange={(e) => setPairForm({ ...pairForm, stationId: e.target.value })}
              />
              <input
                type="number"
                placeholder="Direction ID"
                className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-white"
                value={pairForm.directionId}
                onChange={(e) => setPairForm({ ...pairForm, directionId: e.target.value })}
              />
              <input
                type="date"
                className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-white"
                value={pairForm.targetDate}
                onChange={(e) => setPairForm({ ...pairForm, targetDate: e.target.value })}
              />
              <button
                onClick={triggerPairRefresh}
                disabled={isRefreshing}
                className="w-full bg-blue-900/30 border border-blue-800 rounded-lg py-2 text-xs font-bold text-blue-200 hover:bg-blue-900/40 disabled:opacity-50"
              >
                🎯 Refresh Pair
              </button>
            </div>
          </div>

          <div className="bg-gray-950/70 border border-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-white mb-2">Cleanup Old Rows</h4>
            <div className="space-y-2">
              <input
                type="number"
                min="1"
                className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-white"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Number(e.target.value))}
              />
              <button
                onClick={triggerCleanup}
                disabled={isRefreshing}
                className="w-full bg-amber-900/30 border border-amber-800 rounded-lg py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:opacity-50"
              >
                🧹 Cleanup
              </button>
              <p className="text-[11px] text-gray-500">Rows older than this many days will be deleted.</p>
            </div>
          </div>

          <div className="bg-gray-950/70 border border-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-white mb-2">Storage Info</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>Entries: <span className="text-white font-bold">{storage.entries_total || 0}</span></li>
              <li>Retention: {storage.retention_days || 5} days</li>
              <li>
                Last Entry: {storage.last_entry_at ? format(new Date(storage.last_entry_at), 'MMM dd HH:mm') : '—'}
              </li>
              <li>
                Retry Job: {runtime.retry_job_active ? 'Active' : 'Idle'}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-bold text-sm">Pending Pairs ({pendingPairs.length})</h4>
          {runtime.target_date && (
            <span className="text-xs text-gray-500">Target date: {runtime.target_date}</span>
          )}
        </div>
        {pendingPairs.length === 0 ? (
          <p className="text-sm text-gray-500">All station/direction pairs are up to date. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2">Line</th>
                  <th className="pb-2">Station</th>
                  <th className="pb-2">Direction</th>
                  <th className="pb-2">Attempts</th>
                  <th className="pb-2">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {pendingPairs.map((pair) => (
                  <tr key={`${pair.station_id}-${pair.direction_id}`} className="border-t border-gray-800 text-gray-300">
                    <td className="py-2 font-mono text-[11px]">{pair.line_code || '—'}</td>
                    <td className="py-2">{pair.station_name || pair.station_id}</td>
                    <td className="py-2">{pair.direction_name || pair.direction_id}</td>
                    <td className="py-2">
                      <span className={`font-bold ${pair.attempts > 5 ? 'text-red-400' : 'text-yellow-300'}`}>
                        {pair.attempts || 0}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 max-w-xs truncate" title={pair.last_error || ''}>
                      {pair.last_error || 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, subtext, status }) {
  const colorMap = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400'
  };

  return (
    <div className="bg-gray-950/70 border border-gray-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className={`text-3xl font-bold text-white ${status ? colorMap[status] : ''}`}>{value}</p>
      {subtext && <p className="text-[11px] text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}
