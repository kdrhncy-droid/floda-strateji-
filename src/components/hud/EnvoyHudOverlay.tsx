import React from 'react';
import { Handshake, TrendingDown, X } from 'lucide-react';
import { DiplomaticEnvoy, DiplomaticRelation, Nation } from '../../types/game';
import { getOrCreateRelation } from '../../engine/simulationEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';

interface EnvoyHudOverlayProps {
  envoys: DiplomaticEnvoy[];
  playerNationId: string;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  hidden?: boolean;
  hasActiveToast?: boolean;
  onCancelEnvoy: (envoyId: string) => void;
  onInspectNation?: (nationId: string) => void;
}

export const EnvoyHudOverlay: React.FC<EnvoyHudOverlayProps> = ({
  envoys,
  playerNationId,
  nations,
  relations,
  hidden = false,
  hasActiveToast = false,
  onCancelEnvoy,
  onInspectNation,
}) => {
  if (hidden || envoys.length === 0) return null;

  return (
    <div
      data-testid="envoy-hud-overlay"
      className={`hud-envoy-overlay pointer-events-none absolute right-2 z-25 flex flex-col items-end gap-1.5 max-w-[min(248px,calc(100vw-1rem))] max-h-[38dvh] overflow-y-auto ${
        hasActiveToast
          ? 'top-[6.1rem] sm:top-[3.5rem]'
          : 'top-[3.2rem] sm:top-[3.35rem]'
      }`}
    >
      {envoys.map((envoy) => {
        const target = nations[envoy.targetNationId];
        if (!target || target.isEliminated) return null;

        const rel = getOrCreateRelation(relations, playerNationId, target.id);
        const isImprove = envoy.mission === 'IMPROVE';
        const progressPct = Math.max(
          8,
          Math.min(
            100,
            Math.round(
              ((envoy.totalDays - envoy.daysRemaining) / Math.max(1, envoy.totalDays)) *
                100
            )
          )
        );
        const relLabel = rel.score > 0 ? `+${rel.score}` : `${rel.score}`;
        const deltaLabel =
          envoy.dailyDelta > 0
            ? `+${envoy.dailyDelta}/g`
            : `${envoy.dailyDelta}/g`;

        return (
          <div
            key={envoy.id}
            data-testid={`envoy-hud-card-${target.id}`}
            className={`pointer-events-auto w-[228px] sm:w-[244px] rounded-xl border px-2.5 py-1.5 shadow-xl backdrop-blur-md text-[#f3ead7] ${
              isImprove
                ? 'bg-[#15120e]/95 border-[#caa15a]/55'
                : 'bg-[#1c1113]/95 border-rose-500/50'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onInspectNation?.(target.id);
                }}
                className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                title={`${cleanNationName(target.name)} diplomasisini aç`}
              >
                <NationFlagCanvasBadge
                  nationId={target.id}
                  flagCode={target.flagCode}
                  color={target.color}
                  width={22}
                  height={15}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold truncate leading-tight">
                    {cleanNationName(target.name)}
                  </div>
                  <div className="flex items-center gap-1 text-[9.5px] font-mono-num leading-tight">
                    {isImprove ? (
                      <Handshake className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                    )}
                    <span
                      className={
                        rel.score >= 25
                          ? 'text-emerald-300 font-bold'
                          : rel.score <= -25
                          ? 'text-rose-300 font-bold'
                          : 'text-[#e0b86e] font-bold'
                      }
                    >
                      {relLabel}
                    </span>
                    <span className="text-[#8e806a]">·</span>
                    <span
                      className={
                        isImprove ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'
                      }
                    >
                      {deltaLabel}
                    </span>
                    <span className="text-[#8e806a]">·</span>
                    <span className="text-[#b8a990]">{envoy.daysRemaining}g</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                aria-label={`${cleanNationName(target.name)} elçisini geri çağır`}
                onClick={() => {
                  sound.playClick();
                  onCancelEnvoy(envoy.id);
                }}
                className="w-5 h-5 rounded-md bg-black/45 hover:bg-black/75 border border-[#caa15a]/30 flex items-center justify-center text-[#b8a990] hover:text-white shrink-0 cursor-pointer"
                title="Elçiyi geri çağır"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-1 w-full h-1 rounded-full bg-black/55 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isImprove
                    ? 'bg-gradient-to-r from-[#caa15a] to-emerald-400'
                    : 'bg-gradient-to-r from-amber-600 to-rose-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
