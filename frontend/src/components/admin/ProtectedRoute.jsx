"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || 'tr';

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(`/${locale}/admin/login`);
    }
  }, [isAuthenticated, loading, router, locale]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6" aria-busy="true">
          <Skeleton className="h-6 w-40 bg-white/10" />
          <div className="mt-4">
            <SkeletonText lines={3} lineClassName="bg-white/10" />
          </div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
