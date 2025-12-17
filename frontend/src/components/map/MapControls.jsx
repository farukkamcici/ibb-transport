"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { DomEvent } from 'leaflet';
import { Minus, Navigation, Plus } from 'lucide-react';

import useAppStore from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export default function MapControls() {
  const map = useMap();
  const containerRef = useRef(null);
  const { setUserLocation, setAlertMessage, isPanelOpen, isPanelMinimized } = useAppStore();
  const [isLocating, setIsLocating] = useState(false);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    if (!containerRef.current) return;
    DomEvent.disableClickPropagation(containerRef.current);
    DomEvent.disableScrollPropagation(containerRef.current);
  }, []);

  useEffect(() => {
    const onZoomEnd = () => setZoom(map.getZoom());
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [map]);

  const canZoomIn = zoom < map.getMaxZoom();
  const canZoomOut = zoom > map.getMinZoom();

  const singleButtonBaseClassName =
    'flex items-center justify-center w-11 h-11 rounded-full border border-white/10 bg-[#1a2332]/90 text-text backdrop-blur transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70';

  const zoomGroupClassName =
    'flex w-11 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a2332]/90 text-text shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]';

  const zoomButtonClassName =
    'flex h-11 w-11 items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70';

  const dividerClassName = 'h-px w-full bg-white/10';

  const disabledClassName = 'opacity-50 cursor-not-allowed';
  const enabledClassName = 'hover:bg-surface';

  const handleZoomIn = () => {
    if (!canZoomIn) return;
    map.zoomIn();
  };

  const handleZoomOut = () => {
    if (!canZoomOut) return;
    map.zoomOut();
  };

  const handleLocate = () => {
    if (isLocating) return;
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = [latitude, longitude];
        setUserLocation(newPos);
        map.flyTo(newPos, Math.max(map.getZoom(), 14));
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        console.error('Error getting user location:', error);

        let message = 'Konum bilgisi alınamadı. Lütfen tarayıcı ayarlarınızı kontrol edin.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Konum bilgisi mevcut değil.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Konum bilgisi alınamadı, zaman aşımına uğradı.';
        }
        setAlertMessage(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const bottomOffset = useMemo(() => {
    if (!isPanelOpen) {
      return 'calc(env(safe-area-inset-bottom) + 5rem)';
    }

    if (isPanelMinimized) {
      return 'calc(env(safe-area-inset-bottom) + 14rem)';
    }

    return 'calc(env(safe-area-inset-bottom) + 12rem)';
  }, [isPanelMinimized, isPanelOpen]);

  return (
    <div
      className="leaflet-bottom leaflet-right transition-all duration-300"
      style={{ zIndex: 1000, bottom: bottomOffset }}
      ref={containerRef}
    >
      <div className="leaflet-control">
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(zoomGroupClassName, 'hidden md:flex')}
            role="group"
            aria-label="Harita yakınlaştırma"
          >
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={!canZoomIn}
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
              className={cn(
                zoomButtonClassName,
                canZoomIn ? enabledClassName : disabledClassName
              )}
            >
              <Plus className="h-5 w-5" />
            </button>

            <div className={dividerClassName} aria-hidden="true" />

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
              className={cn(
                zoomButtonClassName,
                canZoomOut ? enabledClassName : disabledClassName
              )}
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleLocate}
            title="Konumumu bul"
            aria-label="Konumumu bul"
            className={cn(singleButtonBaseClassName, enabledClassName, 'h-12 w-12')}
          >
            <Navigation
              className={cn(
                'h-6 w-6',
                isLocating ? 'text-primary animate-pulse' : 'text-text'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
