"use client";
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Mail, RefreshCw, Trash2 } from 'lucide-react';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

const REPORT_TYPE_CONFIG = {
  bug: { label: 'Bug', color: 'bg-red-950/30 text-red-300 border-red-900/40' },
  data: { label: 'Data', color: 'bg-amber-950/30 text-amber-300 border-amber-900/40' },
  feature: { label: 'Feature', color: 'bg-blue-950/30 text-blue-300 border-blue-900/40' }
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-900/30 text-blue-400 border-blue-900/50' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-900/30 text-green-400 border-green-900/50' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-900/30 text-gray-400 border-gray-700/50' }
];

function ReportRow({ report, onStatusChange, onDelete, onExpand, isExpanded }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const typeConfig = REPORT_TYPE_CONFIG[report.report_type] || REPORT_TYPE_CONFIG.bug;
  const statusConfig = STATUS_OPTIONS.find(s => s.value === report.status) || STATUS_OPTIONS[0];

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    await onStatusChange(report.id, newStatus);
    setIsUpdating(false);
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'dd MMM HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <tr className="hover:bg-white/[0.03] transition-colors border-b border-white/5">
        <td className="px-4 py-3">
          <div className="text-xs text-gray-500 font-mono">
            {formatDate(report.created_at)}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
        </td>
        <td className="px-4 py-3">
          {report.line_code ? (
            <span className="inline-flex px-2 py-1 bg-gray-800 text-white rounded text-xs font-mono">
              {report.line_code}
            </span>
          ) : (
            <span className="text-gray-600 text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 max-w-md">
          <div className="flex items-center gap-2">
            <div className={`text-sm text-gray-300 ${isExpanded ? '' : 'truncate'}`}>
              {report.description}
            </div>
            {report.description.length > 50 && (
              <button
                onClick={() => onExpand(report.id)}
                className="text-blue-300 hover:text-blue-200 text-xs whitespace-nowrap inline-flex items-center gap-1"
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {report.contact_email ? (
            <span className="inline-flex items-center justify-center" title={report.contact_email}>
              <Mail className="h-4 w-4 text-green-300" />
            </span>
          ) : (
            <span className="text-gray-600">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          <select
            value={report.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isUpdating}
            className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${statusConfig.color} bg-transparent`}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value} className="bg-gray-900 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => onDelete(report.id)}
            className="text-red-300 hover:text-red-200 text-sm transition-colors"
            title="Delete report"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-white/[0.02] border-b border-white/5">
          <td colSpan="7" className="px-4 py-4">
            <div className="space-y-2">
              <div>
                <span className="text-xs text-gray-500 font-bold">Full Description:</span>
                <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{report.description}</p>
              </div>
              {report.contact_email && (
                <div>
                  <span className="text-xs text-gray-500 font-bold">Contact Email:</span>
                  <p className="text-sm text-blue-400 mt-1">
                    <a href={`mailto:${report.contact_email}`}>{report.contact_email}</a>
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 font-bold">Report ID:</span>
                <p className="text-xs text-gray-400 mt-1 font-mono">{report.id}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReportsPanel({ API_URL, getAuthHeaders }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [expandedReports, setExpandedReports] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const fetchReports = async () => {
    try {
      const headers = getAuthHeaders();
      
      let url = `${API_URL}/admin/reports?limit=100`;
      if (filterStatus !== 'all') url += `&status=${filterStatus}`;
      if (filterType !== 'all') url += `&report_type=${filterType}`;
      
      const [reportsRes, statsRes] = await Promise.all([
        fetch(url, { headers }),
        fetch(`${API_URL}/admin/reports/stats/summary`, { headers })
      ]);

      if (!reportsRes.ok) throw new Error('Failed to fetch reports');
      
      const reportsData = await reportsRes.json();
      const statsData = statsRes.ok ? await statsRes.json() : null;
      
      setReports(reportsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filterStatus, filterType]);

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(`${API_URL}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      // Optimistic update
      setReports(reports.map(r => 
        r.id === reportId ? { ...r, status: newStatus } : r
      ));
      
      // Refresh stats
      fetchReports();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/admin/reports/${reportId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) throw new Error('Failed to delete report');
      
      setReports(reports.filter(r => r.id !== reportId));
      fetchReports(); // Refresh to update stats
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('Failed to delete report');
    }
  };

  const handleExpand = (reportId) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  if (loading && !stats) {
    return (
      <div className="py-10" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`reports-stat-skeleton-${index}`} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <Skeleton className="h-3 w-24" />
              <div className="mt-3">
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <Skeleton className="h-4 w-36" />
          <div className="mt-3">
            <SkeletonText lines={2} />
          </div>
        </div>
        <span className="sr-only">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="text-xs text-gray-500 font-bold uppercase mb-1">Total Reports</div>
            <div className="text-2xl font-bold text-white">{stats.total_reports}</div>
          </div>
          <div className="rounded-xl border border-blue-900/40 bg-blue-950/25 p-4">
            <div className="text-xs text-blue-500 font-bold uppercase mb-1">New Reports</div>
            <div className="text-2xl font-bold text-blue-400">{stats.by_status?.new || 0}</div>
          </div>
          <div className="rounded-xl border border-yellow-900/40 bg-yellow-950/25 p-4">
            <div className="text-xs text-yellow-500 font-bold uppercase mb-1">In Progress</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.by_status?.in_progress || 0}</div>
          </div>
          <div className="rounded-xl border border-green-900/40 bg-green-950/25 p-4">
            <div className="text-xs text-green-500 font-bold uppercase mb-1">Recent (7d)</div>
            <div className="text-2xl font-bold text-green-400">{stats.recent_reports_7d}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-bold">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-bold">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All</option>
              {Object.entries(REPORT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchReports}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold transition-colors border border-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/[0.03]">
          <h3 className="text-sm font-semibold text-white">User Reports</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{reports.length} items</p>
        </div>
        
        {error && (
          <div className="p-4 bg-red-950/30 border-b border-red-900/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30 text-gray-300 uppercase text-[10px] font-semibold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Line</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-600 italic">
                    No reports found.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onExpand={handleExpand}
                    isExpanded={expandedReports.has(report.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
