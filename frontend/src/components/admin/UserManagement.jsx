"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { KeyRound, Plus, Shield, Trash2, Users } from 'lucide-react';

export default function UserManagement({ API_URL, getAuthHeaders }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const fetchUsers = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API_URL}/admin/users`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    
    if (newUser.password.length < 6) {
      setMessage("❌ Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/users`, newUser, { headers });
      setMessage(`✅ User '${newUser.username}' created successfully`);
      setNewUser({ username: '', password: '' });
      setShowCreateModal(false);
      fetchUsers();
    } catch (error) {
      setMessage(`❌ ${error.response?.data?.detail || 'Failed to create user'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage("❌ New passwords don't match");
      setLoading(false);
      return;
    }

    if (passwordData.new_password.length < 6) {
      setMessage("❌ New password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/admin/users/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, { headers });
      setMessage("✅ Password changed successfully");
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      setShowPasswordModal(false);
    } catch (error) {
      setMessage(`❌ ${error.response?.data?.detail || 'Failed to change password'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`⚠️ Delete admin user '${username}'? This action cannot be undone.`)) return;

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/admin/users/${username}`, { headers });
      setMessage(`✅ User '${username}' deleted successfully`);
      fetchUsers();
    } catch (error) {
      setMessage(`❌ ${error.response?.data?.detail || 'Failed to delete user'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-200" />
            Admin Users
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage admin panel access and credentials</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
          >
            <KeyRound className="h-4 w-4" />
            Change Password
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-900/40 bg-blue-950/30 text-blue-200 hover:bg-blue-950/45"
          >
            <Plus className="h-4 w-4" />
            Create User
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg text-sm border ${
          message.includes("❌") 
            ? 'bg-red-950/30 border-red-900/50 text-red-300' 
            : 'bg-green-950/30 border-green-900/50 text-green-300'
        }`}>
          {message}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-300" />
            <h3 className="text-sm font-semibold text-white">Users</h3>
          </div>
          <div className="text-xs text-gray-500">{users.length} total</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/30 text-gray-300 uppercase text-[10px] font-semibold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-white font-bold">{user.username}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                    {format(new Date(user.created_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                    {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy HH:mm') : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(user.username)}
                      className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Create admin user</h3>
            <p className="text-xs text-gray-500 mb-4">Grant access to the admin panel.</p>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Change password</h3>
            <p className="text-xs text-gray-500 mb-4">Update your admin credentials.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-semibold transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
