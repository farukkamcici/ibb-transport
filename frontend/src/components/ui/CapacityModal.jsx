'use client';
import { X, Users, Bus, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

function clampPercent(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function CapacityModal({
  isOpen,
  onClose,
  lineCode,
  currentHourData,
  capacityMeta,
  capacityMix,
  loading,
  error,
}) {
  const t = useTranslations('lineDetail');

  if (!isOpen) return null;

  const expectedPerVehicle = capacityMeta?.expected_capacity_weighted_int || null;
  const effectiveCapacity = currentHourData?.max_capacity || null;
  const predicted = currentHourData?.predicted_value ?? null;

  const inferredTripsPerHour = (() => {
    if (!expectedPerVehicle || !effectiveCapacity) return null;
    return Math.max(1, Math.round(effectiveCapacity / expectedPerVehicle));
  })();

  const metaNote = capacityMeta?.confidence === 'fallback' ? t('capacityFallbackNote') : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]" onClick={onClose} />

      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <div
          className="bg-slate-900 rounded-xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/20">
                <Users size={20} className="text-sky-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t('capacityModalTitle')}</h2>
                <p className="text-sm text-gray-400">{t('lineCode')}: {lineCode}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(80vh-5rem)] p-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Bus size={14} />
                      <span>{t('capacityPerVehicle')}</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {expectedPerVehicle ? expectedPerVehicle.toLocaleString() : '—'}
                    </div>
                    {capacityMeta?.confidence && (
                      <div className="mt-1 text-[11px] text-gray-500">{capacityMeta.confidence}</div>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <TrendingUp size={14} />
                      <span>{t('capacityEffective')}</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {effectiveCapacity ? effectiveCapacity.toLocaleString() : '—'}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {t('capacityTripsPerHour')}: {inferredTripsPerHour ?? '—'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{t('capacityPredicted')}</span>
                    <span className="text-gray-500">{t('capacityOccupancy')}</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between">
                    <div className="text-lg font-semibold text-white">
                      {predicted == null ? '—' : Math.round(predicted).toLocaleString()}
                    </div>
                    <div className="text-sm font-semibold text-sky-200">
                      {clampPercent(currentHourData?.occupancy_pct) == null ? '—' : `${clampPercent(currentHourData?.occupancy_pct)}%`}
                    </div>
                  </div>
                  {metaNote && (
                    <div className="mt-2 text-[11px] text-gray-400">{metaNote}</div>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">{t('capacityVehicleMixTitle')}</div>

                  {capacityMix?.length ? (
                    <div className="mt-3 space-y-2">
                      {capacityMix.map((row, idx) => {
                        const model = row.representative_brand_model || '—';
                        const modelCapacity = row.model_capacity_int || null;
                        const share = row.share_by_vehicles != null ? `${Math.round(row.share_by_vehicles * 100)}%` : '—';
                        const scenarioCapacity =
                          inferredTripsPerHour && modelCapacity ? inferredTripsPerHour * modelCapacity : null;
                        const scenarioOcc =
                          predicted != null && scenarioCapacity ? clampPercent((predicted / scenarioCapacity) * 100) : null;

                        return (
                          <div key={idx} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950/30 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-xs text-white truncate">{model}</div>
                              <div className="text-[11px] text-gray-500">
                                {t('capacityPerVehicle')}: {modelCapacity ? modelCapacity.toLocaleString() : '—'} • {t('capacityShare')}: {share}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-300">
                                {t('capacityScenario')}: {scenarioCapacity ? scenarioCapacity.toLocaleString() : '—'}
                              </div>
                              <div className="text-[11px] text-sky-200">
                                {scenarioOcc == null ? '—' : `${scenarioOcc}%`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500">{t('capacityNoMix')}</div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

