"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || 'tr';
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.push(`/${locale}/admin`);
    }
  }, [isAuthenticated, router, locale]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, password);

    if (result.success) {
      router.push(`/${locale}/admin`);
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center text-3xl">
              🔐
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-400 text-sm">İstanbul Transport Platform</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-300 text-sm animate-in fade-in slide-in-from-top-2">
              ⚠️ {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24 bg-white/20" />
                  <span className="sr-only">Logging in...</span>
                </>
              ) : (
                <>
                  <span>🔓</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-xs">
              Admin access only. Unauthorized access is prohibited.
            </p>
          </div>
        </div>

        {/* Back to App Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push(`/${locale}`)}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Back to App
          </button>
        </div>
      </div>
    </div>
  );
}
