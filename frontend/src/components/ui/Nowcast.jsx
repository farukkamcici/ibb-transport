"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '@/store/useAppStore';
import { Loader, AlertTriangle, Droplets } from 'lucide-react';

// Istanbul coordinates (center of the city)
const ISTANBUL_COORDS = [41.0082, 28.9784];


const TemperatureBadge = () => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
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

            if (!response.ok) throw new Error('Unable to fetch weather data');

            const data = await response.json();
            if (data && Object.keys(data).length > 0) {
                setWeatherData(data);
                lastFetchRef.current = now;
            } else {
                throw new Error('No weather data received');
            }
        } catch (err) {
            setError(err.message);
            setAlertMessage('Weather data unavailable');
        } finally {
            setLoading(false);
        }
    }, [setAlertMessage]);

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
    const handleToggle = useCallback(() => {
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
                }, 8000);
            }
            
            return newState;
        });
    }, []);

    const handleMouseEnter = useCallback(() => {
        // Clear any existing timeout
        if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
        }
        
        if (!isExpanded) {
            // Delay before expanding on hover
            collapseTimeoutRef.current = setTimeout(() => {
                setIsExpanded(true);
                // Auto-collapse after 5 seconds
                collapseTimeoutRef.current = setTimeout(() => setIsExpanded(false), 5000);
            }, 300);
        }
    }, [isExpanded]);

    const handleMouseLeave = useCallback(() => {
        // Clear any pending timeout
        if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
        }
        
        // Delay before collapsing for better UX
        if (isExpanded) {
            collapseTimeoutRef.current = setTimeout(() => setIsExpanded(false), 800);
        }
    }, [isExpanded]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, []);

    // Parse API response - format is "T+0", "T+60", etc. (in minutes)
    const currentWeather = weatherData?.['T+0'];
    const currentTemp = currentWeather?.temperature_2m;

    // Get current time and calculate actual hours for future forecasts
    const now = new Date();
    const currentHour = now.getHours();
    
    // Get future hours data (60, 120, 180, 240, 300, 360 minutes = 1-6 hours ahead)
    const futureHours = [60, 120, 180, 240, 300, 360].map(minutes => {
        const hoursAhead = minutes / 60;
        return {
            key: `T+${minutes}`,
            actualHour: (currentHour + hoursAhead) % 24,
            data: weatherData?.[`T+${minutes}`]
        };
    }).filter(item => item.data);

    return (
        <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[1002] w-full max-w-3xl px-3 sm:px-4 pointer-events-none">
            <div className="flex items-center gap-2 sm:gap-3 h-12">
                {/* Spacer for SearchBar */}
                <div className="flex-1 min-w-0" />
                
                {/* Animated Weather Badge */}
                <div 
                    className={`
                        relative pointer-events-auto
                        bg-surface/95 backdrop-blur-md 
                        border border-primary/20 rounded-xl
                        shadow-lg 
                        transition-all duration-700 ease-in-out
                        cursor-pointer shrink-0
                        h-12
                        ${isExpanded 
                            ? 'w-[220px] sm:w-[260px]' 
                            : 'w-auto hover:scale-[1.02] active:scale-95'
                        }
                    `}
                    onClick={handleToggle}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                {/* Compact View - Fixed Height */}
                <div className="flex items-center gap-2 px-3 h-12 transition-all duration-300">
                    {loading ? (
                        <Loader className="text-primary animate-spin" size={16} />
                    ) : error ? (
                        <AlertTriangle className="text-orange-400" size={16} />
                    ) : (
                        <>
                            {/* Temperature and Location */}
                            <div className="flex flex-col justify-center transition-all duration-300 px-1">
                                <div className="text-base font-bold text-text leading-tight">
                                    {currentTemp ? Math.round(currentTemp) : '--'}°
                                </div>
                                <div className="text-[10px] text-secondary/70 leading-tight font-medium">
                                    İstanbul
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Expanded Details - Dropdown Popover */}
                <div 
                    className={`
                        absolute top-full left-0 right-0 mt-1 
                        bg-surface/95 backdrop-blur-md border border-primary/20 rounded-xl shadow-lg
                        transition-all duration-[400ms] ease-in-out origin-top
                        ${isExpanded 
                            ? 'opacity-100 scale-y-100 translate-y-0 pointer-events-auto delay-75' 
                            : 'opacity-0 scale-y-0 -translate-y-2 pointer-events-none'
                        }
                    `}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {weatherData && currentWeather && (
                        <div className="px-3 py-2.5 space-y-2">
                            {/* Next Hours Forecast - Vertical List */}
                            {futureHours.length > 0 && (
                                <div>
                                    <div className="text-[10px] text-secondary/60 font-medium mb-1.5 transition-all duration-300">Next Hours</div>
                                    <div className="space-y-1">
                                        {futureHours.map(({ key, actualHour, data }, index) => (
                                            <div 
                                                key={key} 
                                                className="flex items-center justify-between bg-primary/5 rounded-lg px-2.5 py-1.5 transition-all duration-300 hover:bg-primary/10 hover:scale-[1.02]"
                                                style={{
                                                    transitionDelay: isExpanded ? `${index * 50}ms` : '0ms'
                                                }}
                                            >
                                                {/* Time */}
                                                <div className="text-xs sm:text-sm font-semibold text-text min-w-[40px]">
                                                    {actualHour.toString().padStart(2, '0')}:00
                                                </div>

                                                {/* Temperature */}
                                                <div className="text-sm sm:text-base font-bold text-text min-w-[35px] text-center">
                                                    {Math.round(data.temperature_2m)}°
                                                </div>

                                                {/* Rain */}
                                                <div className="flex items-center gap-1 min-w-[50px] justify-end bg-primary/5 rounded px-1.5 py-0.5">
                                                    <Droplets className="text-primary/70" size={12} />
                                                    <span className="text-xs font-medium text-text">
                                                        {data.precipitation !== undefined ? `${data.precipitation.toFixed(1)}mm` : '0mm'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hint */}
                            <div className="text-[9px] text-secondary/40 text-center pt-0.5">
                                Auto-closes in a few seconds
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
};

export default TemperatureBadge;
