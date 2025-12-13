"use client";

import { useState } from 'react';
import { useMap } from 'react-leaflet';
import useAppStore from '@/store/useAppStore';
import { Navigation } from 'lucide-react';

const LocateButton = () => {
  const map = useMap();
  const { setUserLocation, setAlertMessage, isPanelOpen } = useAppStore();
  const [loading, setLoading] = useState(false);

  const handleLocate = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = [latitude, longitude];
        setUserLocation(newPos);
        map.flyTo(newPos, 14);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        console.error("Error getting user location:", error);
        let message = "Konum bilgisi alınamadı. Lütfen tarayıcı ayarlarınızı kontrol edin.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Konum bilgisi mevcut değil.";
        } else if (error.code === error.TIMEOUT) {
          message = "Konum bilgisi alınamadı, zaman aşımına uğradı.";
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

  return (
    <div 
      className="leaflet-bottom leaflet-right transition-all duration-300" 
      style={{ zIndex: 1000, bottom: isPanelOpen ? '12rem' : '5rem' }}
    >
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          className="flex items-center justify-center w-12 h-12 border-2 border-surface bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-200"
          title="Konumumu bul"
        >
          {loading ? (
            <Navigation className="h-6 w-6 text-surface/70 animate-pulse" />
          ) : (
            <Navigation className="h-6 w-6 text-surface" />
          )}
        </button>
      </div>
    </div>
  );
};

export default LocateButton;
