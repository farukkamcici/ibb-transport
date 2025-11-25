import MapCaller from '@/components/map/MapCaller';
import SearchBar from '@/components/ui/SearchBar';
import BottomNav from '@/components/ui/BottomNav';
import LineDetailPanel from '@/components/ui/LineDetailPanel';

export default function Home() {
  return (
    <main className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-background font-sans text-text">
      
      {/* Floating Header / Search & Weather - Unified Row */}
      <div className="absolute left-0 right-0 top-0 z-[1001] px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="w-full max-w-3xl mx-auto flex items-center gap-2 sm:gap-3 h-12">
          {/* Search Bar - Takes all available space */}
          <div className="flex-1 min-w-0">
            <SearchBar />
          </div>
          {/* Weather Badge will be rendered here with w-auto */}
        </div>
      </div>

      {/* Full Screen Map Layer */}
      <div className="flex-1 z-0 relative">
        <MapCaller />
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Line Detail Panel (conditionally rendered via Zustand) */}
      <LineDetailPanel />
    </main>
  );
}
