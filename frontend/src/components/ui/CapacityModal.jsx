'use client';
import { X, Users, Bus, TrendingUp, Calendar } from 'lucide-react';
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

  const expectedPerVehicle = currentHourData?.vehicle_capacity || capacityMeta?.expected_capacity_weighted_int || null;
  const effectiveCapacity = currentHourData?.max_capacity || null;
  const predicted = currentHourData?.predicted_value ?? null;
  const tripsPerHour = currentHourData?.trips_per_hour ?? null;

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
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/20">
                      <TrendingUp size={16} className="text-sky-300" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t('capacityEffective')}</div>
                      <div className="text-[10px] text-gray-400">{t('capacityEffectiveDesc')}</div>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-sky-200">
                      {effectiveCapacity ? effectiveCapacity.toLocaleString() : '—'}
                    </div>
                    <div className="text-sm text-gray-400">{t('passengers')}</div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-500" />
                      <span className="text-gray-400">{t('capacityTripsPerHour')}:</span>
                      <span className="font-semibold text-white">{tripsPerHour ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bus size={12} className="text-gray-500" />
                      <span className="text-gray-400">{t('capacityPerVehicle')}:</span>
                      <span className="font-semibold text-white">{expectedPerVehicle ? expectedPerVehicle.toLocaleString() : '—'}</span>
                    </div>
                  </div>
                  {capacityMeta?.confidence && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      {t('capacityConfidence')}: {capacityMeta.confidence}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-gray-400" />
                    <div className="text-sm font-semibold text-white">{t('capacityCurrentHour')}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-gray-400">{t('capacityPredicted')}</div>
                      <div className="text-lg font-semibold text-white">
                        {predicted == null ? '—' : Math.round(predicted).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-400">{t('capacityOccupancy')}</div>
                      <div className="text-lg font-semibold text-sky-200">
                        {clampPercent(currentHourData?.occupancy_pct) == null ? '—' : `${clampPercent(currentHourData?.occupancy_pct)}%`}
                      </div>
                    </div>
                  </div>
                  {metaNote && (
                    <div className="mt-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-200">
                      {metaNote}
                    </div>
                  )}
                </div>

                {capacityMix?.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bus size={14} className="text-gray-400" />
                      <div className="text-sm font-semibold text-white">{t('capacityVehicleMixTitle')}</div>
                    </div>
                    <div className="text-[11px] text-gray-400 mb-3">
                      {t('capacityVehicleMixDesc')}
                    </div>

                    <div className="space-y-2">
                      {capacityMix.slice(0, 8).map((row, idx) => {
                        const model = row.representative_brand_model || '—';
                        const modelCapacity = row.model_capacity_int || null;
                        const share = row.share_by_vehicles != null ? `${Math.round(row.share_by_vehicles * 100)}%` : '—';
                        const scenarioCapacity =
                          tripsPerHour && modelCapacity ? tripsPerHour * modelCapacity : null;
                        const scenarioOcc =
                          predicted != null && scenarioCapacity ? clampPercent((predicted / scenarioCapacity) * 100) : null;
                        
                        const occupancyDelta = row.occupancy_delta_pct_vs_expected;
                        const deltaDisplay = occupancyDelta != null ? 
                          (occupancyDelta > 0 ? `+${occupancyDelta.toFixed(1)}%` : `${occupancyDelta.toFixed(1)}%`) : 
                          null;

                        return (
                          <div key={idx} className="rounded-md border border-white/10 bg-slate-950/30 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-white truncate">{model}</div>
                                <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500">
                                  <span>{t('capacityPerVehicle')}: <span className="text-gray-300">{modelCapacity ? modelCapacity.toLocaleString() : '—'}</span></span>
                                  <span>{t('capacityShare')}: <span className="text-gray-300">{share}</span></span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-medium text-gray-300">
                                  {scenarioCapacity ? scenarioCapacity.toLocaleString() : '—'}
                                </div>
                                <div className="text-[11px] font-semibold text-sky-200">
                                  {scenarioOcc == null ? '—' : `${scenarioOcc}%`}
                                  {deltaDisplay && (
                                    <span className={`ml-1 ${occupancyDelta > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                      ({deltaDisplay})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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

