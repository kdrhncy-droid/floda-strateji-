import React, { useMemo } from 'react';
import {
  Calendar,
  Coins,
  Crown,
  Globe2,
  Home,
  Play,
  RotateCcw,
  Shield,
  Skull,
} from 'lucide-react';
import { GameModeId, Nation, Territory } from '../../types/game';
import { formatGameDate } from '../../engine/simulationEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

interface CampaignOutcomeModalProps {
  outcome: 'VICTORY' | 'DEFEAT';
  playerNation: Nation;
  territories: Record<string, Territory>;
  tick: number;
  gameMode: GameModeId;
  onContinueAfterVictory: () => void;
  onRestartCampaign: () => void;
  onReturnToTitleMenu: () => void;
}

export const CampaignOutcomeModal: React.FC<CampaignOutcomeModalProps> = ({
  outcome,
  playerNation,
  territories,
  tick,
  gameMode,
  onContinueAfterVictory,
  onRestartCampaign,
  onReturnToTitleMenu,
}) => {
  const isVictory = outcome === 'VICTORY';
  const dialogRef = useAccessibleDialog(true, () => {
    if (isVictory) onContinueAfterVictory();
  });

  const stats = useMemo(() => {
    const allTerrs = Object.values(territories);
    const owned = allTerrs.filter((t) => t.ownerId === playerNation.id);
    const totalArmy = owned.reduce((acc, t) => acc + t.garrison, 0);
    const dominancePct =
      allTerrs.length > 0
        ? Math.round((owned.length / allTerrs.length) * 100)
        : 0;
    return {
      ownedCount: owned.length,
      totalCount: allTerrs.length,
      dominancePct,
      totalArmy,
    };
  }, [territories, playerNation.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-outcome-title"
        tabIndex={-1}
        className={`w-full max-w-md rounded-2xl border-2 shadow-2xl overflow-hidden text-slate-100 ${
          isVictory
            ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/40 border-amber-500/70'
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-rose-950/40 border-rose-500/70'
        }`}
      >
        <div
          className={`px-5 py-5 border-b text-center space-y-2.5 ${
            isVictory
              ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-amber-500/30'
              : 'bg-gradient-to-r from-rose-950/70 via-slate-900 to-rose-950/70 border-rose-500/30'
          }`}
        >
          <div
            className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center shadow-lg ${
              isVictory
                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                : 'bg-rose-500/20 border border-rose-400/50 text-rose-300'
            }`}
          >
            {isVictory ? (
              <Crown className="w-8 h-8" />
            ) : (
              <Skull className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <h2
              id="campaign-outcome-title"
              className={`font-display font-extrabold text-xl tracking-wide uppercase ${
                isVictory ? 'text-amber-300' : 'text-rose-300'
              }`}
            >
              {isVictory ? 'Büyük Cihan Zaferi!' : 'Devlet Yıkıldı'}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              {isVictory
                ? `${playerNation.name}, dünya eyaletlerinin %${stats.dominancePct} kadarını sancağı altında birleştirerek çağın tartışmasız hakimi oldu.`
                : `${playerNation.name} tüm topraklarını kaybetti ve sefer sona erdi.`}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={42}
                height={30}
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-white truncate">
                  {playerNation.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {gameMode === 'EMPIRES_1440'
                    ? '1440 İmparatorluklar Çağı'
                    : '2026 Küresel Strateji'}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 uppercase">Tarih</div>
              <div className="text-xs font-mono font-bold text-amber-300">
                {formatGameDate(tick, gameMode)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Globe2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Hakimiyet</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {stats.ownedCount} / {stats.totalCount}{' '}
                <span className="text-amber-300 text-xs">
                  (%{stats.dominancePct})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Toplam Ordu</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {stats.totalArmy.toLocaleString('tr-TR')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hazine</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {Math.round(playerNation.treasury).toLocaleString('tr-TR')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#e0b86e]" />
                <span>Sefer Süresi</span>
              </div>
              <div className="font-mono font-bold text-sm text-white">
                {tick.toLocaleString('tr-TR')} Gün
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {isVictory && (
              <button
                onClick={onContinueAfterVictory}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Haritada Devam Et (Sonsuz Sefer)</span>
              </button>
            )}

            <button
              onClick={onRestartCampaign}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                isVictory
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-lg shadow-amber-500/25'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Yeni Sefer Başlat</span>
            </button>

            <button
              onClick={onReturnToTitleMenu}
              className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Ana Menüye Dön</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
