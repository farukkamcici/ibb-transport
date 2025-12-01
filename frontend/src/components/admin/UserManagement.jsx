"use client";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

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
          <h2 className="text-2xl font-bold text-white">👥 Admin User Management</h2>
          <p className="text-gray-400 text-sm mt-1">Manage admin panel access and credentials</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-4 py-2 bg-blue-900/50 hover:bg-blue-900 text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-800"
          >
            🔑 Change My Password
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-900/50 hover:bg-green-900 text-green-300 rounded-lg text-sm font-medium transition-colors border border-green-800"
          >
            ➕ Create Admin User
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-md font-bold text-white">Admin Users ({users.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950 text-gray-300 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Last Login</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
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
                      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                    >
                      🗑️ Delete
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Create New Admin User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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