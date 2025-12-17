"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useAppStore from '@/store/useAppStore';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Droplets, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

// Istanbul coordinates (center of the city)
const ISTANBUL_COORDS = [41.0082, 28.9784];


const TemperatureBadge = () => {
    const tCommon = useTranslations('common');
    const tWeather = useTranslations('weather');
    const locale = useLocale();
    const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [nowTs, setNowTs] = useState(() => new Date().getTime());
    const { setAlertMessage } = useAppStore();
    
    const lastFetchRef = useRef(null);
    const collapseTimeoutRef = useRef(null);

    const fetchWeatherData = useCallback(async () => {
        // Prevent excessive calls - minimum 5 minutes between fetches
        const now = Date.now();
        if (lastFetchRef.current && (now - lastFetchRef.current) < 300000) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/nowcast?lat=${ISTANBUL_COORDS[0]}&lon=${ISTANBUL_COORDS[1]}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            if (!response.ok) throw new Error('WEATHER_FETCH_FAILED');

            const data = await response.json();
            if (data && Object.keys(data).length > 0) {
                setWeatherData(data);
                lastFetchRef.current = now;
            } else {
                throw new Error('WEATHER_EMPTY_RESPONSE');
            }
        } catch (err) {
            setError(tWeather('unavailable'));
            setAlertMessage(tWeather('unavailable'));
        } finally {
            setLoading(false);
        }
    }, [setAlertMessage, tWeather]);

    useEffect(() => {
        // Fetch weather on mount
        fetchWeatherData();

        // Auto-refresh every 30 minutes
        const interval = setInterval(() => {
            fetchWeatherData();
        }, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, [fetchWeatherData]);

    // Handle expansion with auto-collapse
    const handleToggle = useCallback((e) => {
        // Prevent event propagation to avoid interfering with other UI elements
        e.stopPropagation();
        e.preventDefault();
        
        setIsExpanded(prev => {
            const newState = !prev;
            
            // Clear any existing collapse timeout
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
            
            // If expanding, set auto-collapse after 8 seconds
            if (newState) {
                collapseTimeoutRef.current = setTimeout(() => {
                    setIsExpanded(false);
                }, 5000);
            }
            
            return newState;
        });
    }, []);

    const handleCloseExpanded = useCallback((e) => {
        e.stopPropagation();
        e.preventDefault();

        if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
        }
        setIsExpanded(false);
    }, []);

    useEffect(() => {
        if (!isExpanded) return;

        const tick = () => setNowTs(new Date().getTime());
        const timeoutId = setTimeout(tick, 0);
        const intervalId = setInterval(tick, 30 * 1000);

        return () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
    }, [isExpanded]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, []);

    // Parse API response - format is "hour_0" (current), "hour_1", "hour_2", etc.
    // hour_0 = current hour, hour_1 to hour_6 = next 6 hours forecast
    const currentWeather = weatherData?.hour_0;
    const currentTemp = currentWeather?.temperature_2m;

    // Get future hours forecast (hour_1 through hour_6)
    const futureHours = [1, 2, 3, 4, 5, 6]
        .map(i => {
            const hourKey = `hour_${i}`;
            const data = weatherData?.[hourKey];
            if (!data) return null;
            
            // Extract hour from time string (format: "18:00")
            const timeStr = data.time || '';
            const hour = timeStr ? parseInt(timeStr.split(':')[0]) : 0;
            
            return {
                key: hourKey,
                actualHour: hour,
                data: data
            };
        })
        .filter(item => item !== null);

    const spring = { type: 'spring', stiffness: 500, damping: 30 };
    const now = new Date(nowTs);
    const nowDateLabel = new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short'
    }).format(now);
    const nowTimeLabel = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit'
    }).format(now);

    return (
        <motion.div
            layout
            transition={spring}
            className={
                `relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a2332] shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] origin-top hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 ${
                    isExpanded ? 'z-[1200]' : 'z-[1001]'
                }`
            }
            style={{ originY: 0, originX: 0.5 }}
            onClick={handleToggle}
        >
            <AnimatePresence mode="wait" initial={false}>
                {!isExpanded ? (
                    <motion.div
                        key="pill"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={spring}
                        className="flex h-11 items-center gap-2 px-4"
                    >
                        {loading ? (
                            <div className="flex items-center px-1">
                                <Skeleton className="h-4 w-10 bg-white/20" />
                                <span className="sr-only">Loading weather</span>
                            </div>
                        ) : error ? (
                            <AlertTriangle className="text-orange-400" size={16} />
                        ) : (
                            <div className="flex items-center px-1">
                                <div className="text-base font-bold leading-tight text-text">
                                    {currentTemp ? Math.round(currentTemp) : '--'}°C
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="panel"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={spring}
                        className="w-[220px] sm:w-[260px]"
                    >
                        <div className="flex h-12 items-center gap-2 px-3">
                            {loading ? (
                                <div className="flex flex-col justify-center space-y-1 px-1">
                                    <Skeleton className="h-4 w-10 bg-white/20" />
                                    <Skeleton className="h-3 w-12 bg-white/10" />
                                    <span className="sr-only">Loading weather</span>
                                </div>
                            ) : error ? (
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="text-orange-400" size={16} />
                                    <span className="text-xs text-gray-300">{error}</span>
                                </div>
                            ) : (
                                <div className="flex flex-1 items-center justify-between">
                                    <div className="flex flex-col justify-center px-1">
                                        <div className="text-base font-bold leading-tight text-text">
                                            {currentTemp ? Math.round(currentTemp) : '--'}°C
                                        </div>
                                        <div className="text-[10px] font-medium leading-tight text-secondary/70">
                                            {tCommon('istanbul')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="mr-1 text-[10px] font-medium text-secondary/60">
                                            {nowDateLabel} • {nowTimeLabel}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCloseExpanded}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-background/20 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                            aria-label={tCommon('close')}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/10 px-3 pb-3 pt-2">
                            {loading && !weatherData ? (
                                <div className="space-y-1" aria-busy="true">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div
                                            key={`weather-skeleton-${index}`}
                                            className="flex items-center justify-between rounded-xl bg-background/30 px-2.5 py-1.5"
                                        >
                                            <Skeleton className="h-4 w-12 bg-white/10" />
                                            <Skeleton className="h-4 w-10 bg-white/10" />
                                        </div>
                                    ))}
                                </div>
                            ) : weatherData && currentWeather && futureHours.length > 0 ? (
                                <div className="space-y-1">
                                    {futureHours.map(({ key, actualHour, data }) => (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between rounded-xl bg-background/30 px-2.5 py-1.5"
                                        >
                                            <div className="text-[11px] font-semibold text-gray-300">
                                                {actualHour.toString().padStart(2, '0')}:00
                                            </div>

                                            <div className="min-w-[35px] text-center text-sm font-bold text-text">
                                                {Math.round(data.temperature_2m)}°C
                                            </div>

                                            <div className="flex min-w-[52px] items-center justify-end gap-1 rounded-lg bg-primary/5 px-1.5 py-0.5">
                                                <Droplets className="text-primary/70" size={12} />
                                                <span className="text-xs font-medium text-text">
                                                    {data.precipitation !== undefined
                                                        ? `${numberFormatter.format(data.precipitation)}mm`
                                                        : `0mm`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            <div className="pt-2 text-center text-[9px] text-secondary/40">
                                {tWeather('autoCloses')}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default TemperatureBadge;
