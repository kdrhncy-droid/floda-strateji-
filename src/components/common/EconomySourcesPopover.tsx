import React, { useCallback, useEffect, useRef } from 'react';
import { X, Coins, Hammer } from 'lucide-react';
import { Nation, Territory } from '../../types/game';
import { computeNationEconomySummary } from '../../engine/simulationEngine';
import { RESOURCE_INFO } from '../../data/world2026Data';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { cleanNationName } from '../../utils/formatters';
import { ResourceSvg } from '../illustrations/AoH3Illustrations';

export function useLongPress(
  onLongPress: () => void,
  delayMs = 260
): {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  consumeLongPressFlag: () => boolean;
} {
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      triggeredRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        triggeredRef.current = true;
        timerRef.current = null;
        onLongPress();
      }, delayMs);
    },
    [clearTimer, delayMs, onLongPress]
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const consumeLongPressFlag = useCallback(() => {
    if (triggeredRef.current) {
      triggeredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    consumeLongPressFlag,
  };
}

interface EconomySourcesPopoverProps {
  nation: Nation | null;
  territories: Record<string, Territory>;
  onClose: () => void;
}

export const EconomySourcesPopover: React.FC<EconomySourcesPopoverProps> = ({
  nation,
  territories,
  onClose,
}) => {
  const dialogRef = useAccessibleDialog(Boolean(nation), onClose);
  const backdropPressedRef = useRef(false);

  if (!nation) return null;

  const summary = computeNationEconomySummary(nation, territories);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/70 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        backdropPressedRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (backdropPressedRef.current && e.target === e.currentTarget) {
          onClose();
        }
        backdropPressedRef.current = false;
      }}
      data-testid="economy-sources-popover"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`${cleanNationName(nation.name)} Ekonomi Kaynakları`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[82dvh] flex flex-col rounded-2xl bg-[#14100c] border border-[#caa15a]/65 shadow-2xl text-[#f3ead7] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#100d09] border-b border-[#caa15a]/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <NationFlagCanvasBadge
              nationId={nation.id}
              flagCode={nation.flagCode}
              color={nation.color}
              width={32}
              height={22}
            />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-display font-bold text-[#faf3e3] truncate">
                {cleanNationName(nation.name)}
              </div>
              <div className="text-[10.5px] text-[#e0b86e] font-semibold">
                Mevcut Ekonomi &amp; Yatırım Kaynakları
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Ekonomi kaynaklarını kapat"
            className="w-8 h-8 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/35 flex items-center justify-center text-[#c5b79e] hover:text-[#faf3e3] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 space-y-3 overflow-y-auto">
          {/* Total Summary */}
          <div className="rounded-xl bg-[#1d1610] border border-[#e0b86e]/45 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#e0b86e]" />
              <div>
                <div className="text-[11px] font-bold text-[#f3ead7]">
                  Mevcut Ekonomi
                </div>
                <div className="text-[10px] text-[#b8a990]">
                  {summary.provinceCount} Eyalet · Ort. Yatırım ×
                  {summary.avgInvestmentMult.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-right font-mono-num">
              <div className="text-base font-extrabold text-[#e0b86e]">
                {summary.totalEconomy.toLocaleString('tr-TR')}
              </div>
            </div>
          </div>

          {/* Resource Breakdown */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#b8a990] px-1">
              Doğal Kaynaklardan Sağlanan Ekonomi
            </div>
            {summary.resourceSources.length === 0 ? (
              <div className="text-xs text-[#8e806a] italic px-2 py-2">
                Kaynak verisi bulunamadı.
              </div>
            ) : (
              <div className="space-y-1.5">
                {summary.resourceSources.map((src) => {
                  const resMeta = RESOURCE_INFO[src.resource];
                  return (
                    <div
                      key={src.resource}
                      className="rounded-xl bg-[#19140f] border border-[#caa15a]/25 px-3 py-2 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-[#f3ead7] truncate">
                          <ResourceSvg
                            resource={src.resource}
                            className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                          />
                          <span className="truncate">
                            {resMeta?.name || src.label}
                          </span>
                          <span className="text-[10px] font-mono-num text-[#b8a990]">
                            ({src.provinceCount} Şehir)
                          </span>
                        </span>
                        <span className="font-mono-num font-extrabold text-[#e0b86e] shrink-0">
                          {src.economyContribution.toLocaleString('tr-TR')} (%
                          {src.sharePct})
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#0d0a07] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]"
                          style={{ width: `${Math.max(4, src.sharePct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Building Investment Breakdown */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#b8a990] px-1 flex items-center gap-1.5">
              <Hammer className="w-3 h-3 text-[#e0b86e]" />
              <span>Yapı &amp; Yatırım Kaynakları</span>
            </div>
            {summary.investments.length === 0 ? (
              <div className="rounded-xl bg-[#18130e] border border-[#caa15a]/20 px-3 py-2 text-[11px] text-[#9b8e78]">
                Henüz gelişmiş sanayi/ticaret yapı yatırımı bulunmuyor (temel eyalet üretimi).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {summary.investments.map((inv) => (
                  <div
                    key={inv.buildingId}
                    className="rounded-xl bg-[#18130e] border border-[#caa15a]/25 px-2.5 py-2 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#f3ead7] truncate">
                        {inv.label}
                      </div>
                      <div className="text-[10px] text-[#b8a990] font-mono-num">
                        Toplam Sv.{inv.totalLevels}
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-emerald-300 shrink-0">
                      +{inv.estimatedEconomyValue.toLocaleString('tr-TR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
