"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Car } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

const TrafficBadge = () => {
    const tTraffic = useTranslations('traffic');
    const [trafficData, setTrafficData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const lastFetchRef = useRef(null);

    const fetchTrafficData = useCallback(async () => {
        const now = Date.now();
        if (lastFetchRef.current && (now - lastFetchRef.current) < 300000) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/traffic/istanbul`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            if (!response.ok) throw new Error('TRAFFIC_FETCH_FAILED');

            const data = await response.json();
            if (data && data.percent !== null) {
                setTrafficData(data);
                lastFetchRef.current = now;
            }
        } catch (err) {
            console.error('Traffic fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrafficData();

        const interval = setInterval(() => {
            fetchTrafficData();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [fetchTrafficData]);

    const percent = trafficData?.percent;

    return (
        <Tooltip.Provider>
            <Tooltip.Root open={showTooltip} onOpenChange={setShowTooltip}>
                <Tooltip.Trigger asChild>
                    <div
                        className="relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a2332] shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]"
                    >
                        <div className="flex h-11 items-center gap-2 px-4">
                            <Car className="text-text" size={16} />
                            <div className="flex items-center px-1">
                                <div className="text-base font-bold leading-tight text-text">
                                    {loading || percent == null ? '--' : `%${percent}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        className="z-[1300] max-w-[280px] rounded-xl border border-white/10 bg-[#1a2332] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                        sideOffset={8}
                    >
                        <div className="space-y-2">
                            <div className="text-sm font-semibold text-text">{tTraffic('title')}</div>
                            <div className="text-xs leading-relaxed text-secondary/80">
                                {tTraffic('description')}
                            </div>
                            <div className="pt-1 text-[10px] text-secondary/50">
                                {tTraffic('source')}
                            </div>
                        </div>
                        <Tooltip.Arrow className="fill-[#1a2332]" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
};

export default TrafficBadge;
