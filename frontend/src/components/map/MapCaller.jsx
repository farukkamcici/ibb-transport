'use client';
import dynamic from 'next/dynamic';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

// Dynamically import MapView with SSR disabled to prevent 'window' errors
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface/80 p-5 shadow-lg">
        <div className="mb-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <SkeletonText lines={3} />
        <div className="mt-4">
          <Skeleton className="h-3 w-40" />
        </div>
        <span className="sr-only">Loading map</span>
      </div>
    </div>
  )
});

export default function MapCaller() {
  return <MapView />;
}
