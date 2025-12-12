'use client';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '@/store/useAppStore';
import LocateButton from '@/components/ui/LocateButton';
import MetroLayer from '@/components/map/MetroLayer';
import MetroStationInfoCard from '@/components/map/MetroStationInfoCard';
import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import useRoutePolyline from '@/hooks/useRoutePolyline';
import useMetroTopology from '@/hooks/useMetroTopology';

const CENTER = [41.0082, 28.9784]; // Istanbul coordinates

const userLocationIcon = divIcon({
  html: renderToStaticMarkup(
    <div className="relative flex items-center justify-center">
      <div className="absolute w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
      <div className="absolute w-8 h-8 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
    </div>
  ),
  className: 'bg-transparent',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MapController({ routeCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = routeCoordinates.map(coord => [coord[0], coord[1]]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeCoordinates, map]);

  return null;
}

export default function MapView() {
  const tCommon = useTranslations('common');
  const {
    userLocation,
    selectedLine,
    selectedDirection,
    showRoute,
    metroSelection,
    setMetroSelection
  } = useAppStore();
  const { getPolyline, getRouteStops } = useRoutePolyline();
  const { getLine, loading: topologyLoading } = useMetroTopology();
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isStationCardOpen, setIsStationCardOpen] = useState(false);
  
  // Determine if selected line is metro
  const isMetroLine = useMemo(() => {
    if (!selectedLine?.id) return false;
    const lineCode = typeof selectedLine.id === 'string' ? selectedLine.id : '';
    return /^[MFT]/.test(lineCode);
  }, [selectedLine]);

  const metroLineCodeToRender = useMemo(() => {
    if (!isMetroLine || !selectedLine?.id) {
      return null;
    }
    return selectedLine.id;
  }, [isMetroLine, selectedLine]);

  const canonicalMetroLine = useMemo(() => {
    if (!isMetroLine || !metroLineCodeToRender) return null;
    const topoLine = getLine(metroLineCodeToRender);
    if (!topoLine) return null;
    return { code: topoLine.name || metroLineCodeToRender, data: topoLine };
  }, [isMetroLine, metroLineCodeToRender, getLine]);

  useEffect(() => {
    let isActive = true;
    // Only fetch bus route polylines if not metro
    if (showRoute && selectedLine && !isMetroLine) {
      const fetchPolyline = async () => {
        const polyline = await getPolyline(selectedLine.id, selectedDirection);
        if (isActive) {
          setRouteCoordinates(polyline);
        }
      };
      fetchPolyline();
    } else {
      queueMicrotask(() => {
        if (isActive) setRouteCoordinates([]);
      });
    }

    return () => {
      isActive = false;
    };
  }, [showRoute, selectedLine, selectedDirection, getPolyline, isMetroLine]);

  const shouldRenderMetroRoute = Boolean(isMetroLine && canonicalMetroLine?.code && canonicalMetroLine?.data);

  const baseMetroStations = useMemo(() => {
    if (!canonicalMetroLine?.data?.stations) {
      return [];
    }
    return [...canonicalMetroLine.data.stations].sort((a, b) => a.order - b.order);
  }, [canonicalMetroLine]);

  useEffect(() => {
    if (!shouldRenderMetroRoute) {
      queueMicrotask(() => setIsStationCardOpen(false));
    }
  }, [shouldRenderMetroRoute]);

  useEffect(() => {
    // Close card only when the selected line changes (not when M1 switches between M1A/M1B).
    queueMicrotask(() => setIsStationCardOpen(false));
  }, [selectedLine?.id]);

  const routeStops = useMemo(() => {
    // Only show bus route stops if not metro (metro uses MetroLayer)
    return showRoute && selectedLine && !isMetroLine
      ? getRouteStops(selectedLine.id, selectedDirection) 
      : [];
  }, [showRoute, selectedLine, selectedDirection, getRouteStops, isMetroLine]);

  const activeMetroDirectionId = useMemo(() => {
    if (!shouldRenderMetroRoute || !metroSelection?.lineCode || !canonicalMetroLine?.code) {
      return null;
    }
    return metroSelection.lineCode === canonicalMetroLine.code
      ? metroSelection.directionId
      : null;
  }, [metroSelection, canonicalMetroLine, shouldRenderMetroRoute]);

  const activeMetroStationId = useMemo(() => {
    if (!shouldRenderMetroRoute || !metroSelection?.lineCode || !canonicalMetroLine?.code) {
      return null;
    }
    return metroSelection.lineCode === canonicalMetroLine.code
      ? metroSelection.stationId
      : null;
  }, [metroSelection, canonicalMetroLine, shouldRenderMetroRoute]);

  const orderedMetroStations = useMemo(() => {
    if (!baseMetroStations || baseMetroStations.length === 0) {
      return [];
    }

    if (!activeMetroDirectionId) {
      return baseMetroStations;
    }

    const firstStation = baseMetroStations[0];
    const lastStation = baseMetroStations[baseMetroStations.length - 1];
    const firstSupportsDirection = firstStation?.directions?.some(dir => dir.id === activeMetroDirectionId);
    const lastSupportsDirection = lastStation?.directions?.some(dir => dir.id === activeMetroDirectionId);

    if (!firstSupportsDirection && lastSupportsDirection) {
      return [...baseMetroStations].reverse();
    }

    return baseMetroStations;
  }, [baseMetroStations, activeMetroDirectionId]);

  const activeMetroStation = useMemo(() => {
    if (!activeMetroStationId) {
      return null;
    }
    return orderedMetroStations.find((s) => s.id === activeMetroStationId) || null;
  }, [activeMetroStationId, orderedMetroStations]);

  const canRenderMetroLayer = shouldRenderMetroRoute && orderedMetroStations.length > 0 && !topologyLoading;

  // Handler for metro station clicks
  const handleMetroStationClick = (station, lineName) => {
    // Keep the info card in sync with LineDetailPanel selection.
    if (canonicalMetroLine?.code && station?.id) {
      setMetroSelection(
        canonicalMetroLine.code,
        station.id,
        activeMetroDirectionId ?? metroSelection?.directionId ?? null
      );
    }
    setIsStationCardOpen(true);
  };

  return (
    <MapContainer
      center={CENTER}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      <LocateButton />

      {userLocation && (
        <Marker position={userLocation} icon={userLocationIcon}>
        </Marker>
      )}

      {/* Metro layer - shows when metro line is selected */}
      {canRenderMetroLayer && (
        <MetroLayer
          selectedLineCode={canonicalMetroLine?.code || selectedLine.id}
          stationsOverride={orderedMetroStations}
          onStationClick={handleMetroStationClick}
        />
      )}

      {/* Bus route polylines - shows when bus line is selected */}
      {routeCoordinates.length > 0 && !isMetroLine && (
        <>
          <Polyline 
            positions={routeCoordinates} 
            color="#3b82f6"
            weight={4}
            opacity={0.7}
            lineCap="round"
            lineJoin="round"
          />
          
      {routeStops.map((stop, index) => {
            const isFirstStop = index === 0;
            const isLastStop = index === routeStops.length - 1;
            
            if (isFirstStop) {
              return (
                <CircleMarker
                  key={stop.code}
                  center={[stop.lat, stop.lng]}
                  radius={6}
                  pathOptions={{
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 1,
                    weight: 2
                  }}
                >
                      <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                    <div className="text-xs font-medium">
                      <div className="font-bold text-green-600">{tCommon('start')}</div>
                      <div>{stop.name}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            }
            
            if (isLastStop) {
              return (
                <CircleMarker
                  key={stop.code}
                  center={[stop.lat, stop.lng]}
                  radius={6}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    weight: 2
                  }}
                >
                  <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                    <div className="text-xs font-medium">
                      <div className="font-bold text-red-600">{tCommon('end')}</div>
                      <div>{stop.name}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            }
            
            return (
              <CircleMarker
                key={stop.code}
                center={[stop.lat, stop.lng]}
                radius={4}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#ffffff',
                  fillOpacity: 1,
                  weight: 2
                }}
              >
                <Tooltip direction="top" offset={[0, -5]} opacity={0.9}>
                  <div className="text-xs font-medium">{stop.name}</div>
                </Tooltip>
              </CircleMarker>
            );
          })}
          
          <MapController routeCoordinates={routeCoordinates} />
        </>
      )}

      {isStationCardOpen && activeMetroStation && (
        <MetroStationInfoCard
          station={activeMetroStation}
          lineName={canonicalMetroLine?.code || ''}
          directionId={activeMetroDirectionId}
          onClose={() => setIsStationCardOpen(false)}
        />
      )}
    </MapContainer>
  );
}
