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
import { cleanNationName } from '../../utils/formatters';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { getTechArtwork } from '../drawers/techArtwork';

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

  const artwork = isVictory
    ? getTechArtwork('COURT', 'ADMINISTRATION')
    : getTechArtwork('FORTRESS', 'MILITARY');
  const nationName = cleanNationName(playerNation.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overscroll-contain">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-outcome-title"
        tabIndex={-1}
        className={`w-full max-w-md max-h-[calc(100dvh-1.5rem)] rounded-2xl border-2 shadow-[0_24px_70px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col bg-[#14100c] text-[#f3ead7] ${
          isVictory ? 'border-[#e0b86e]/80' : 'border-rose-500/70'
        }`}
      >
        {/* Illustrated Oil-Painting Header */}
        <div
          className="relative px-5 py-5 border-b border-[#caa15a]/35 text-center space-y-2 shrink-0 overflow-hidden"
          style={{ background: artwork.fallbackGradient }}
        >
          <img
            src={artwork.src}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="sync"
            referrerPolicy="no-referrer"
            style={{ objectPosition: artwork.objectPosition }}
            className="absolute inset-0 w-full h-full object-cover brightness-75"
          />
          <div
            className={`absolute inset-0 ${
              isVictory
                ? 'bg-gradient-to-t from-[#14100c] via-[#14100c]/70 to-[#2a1f10]/55'
                : 'bg-gradient-to-t from-[#14100c] via-[#14100c]/75 to-rose-950/60'
            }`}
          />

          <div className="relative space-y-2">
            <div
              className={`w-13 h-13 mx-auto rounded-2xl flex items-center justify-center shadow-lg ${
                isVictory
                  ? 'bg-[#1b1510]/90 border border-[#e0b86e]/65 text-[#e0b86e]'
                  : 'bg-rose-950/85 border border-rose-400/60 text-rose-300'
              }`}
            >
              {isVictory ? (
                <Crown className="w-7 h-7" />
              ) : (
                <Skull className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <h2
                id="campaign-outcome-title"
                className={`font-display font-extrabold text-xl tracking-wide uppercase drop-shadow ${
                  isVictory ? 'text-[#e0b86e]' : 'text-rose-300'
                }`}
              >
                {isVictory ? 'Büyük Cihan Zaferi!' : 'Devlet Yıkıldı'}
              </h2>
              <p className="text-xs text-[#d8cbb5] leading-relaxed max-w-xs mx-auto">
                {isVictory
                  ? `${nationName}, dünya eyaletlerinin %${stats.dominancePct} kadarını sancağı altında birleştirerek çağın hakimi oldu.`
                  : `${nationName} tüm topraklarını kaybetti ve sefer sona erdi.`}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/30">
            <div className="flex items-center gap-3 min-w-0">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={42}
                height={30}
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-[#faf3e3] truncate">
                  {nationName}
                </div>
                <div className="text-[11px] text-[#b8a990]">
                  {gameMode === 'EMPIRES_1440'
                    ? '1440 İmparatorluklar Çağı'
                    : '2026 Küresel Strateji'}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-[#9b8e78] uppercase">Tarih</div>
              <div className="text-xs font-mono-num font-bold text-[#e0b86e]">
                {formatGameDate(tick, gameMode)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/25">
              <div className="flex items-center gap-1.5 text-[11px] text-[#b8a990] mb-1">
                <Globe2 className="w-3.5 h-3.5 text-[#e0b86e]" />
                <span>Hakimiyet</span>
              </div>
              <div className="font-mono-num font-bold text-sm text-[#faf3e3]">
                {stats.ownedCount} / {stats.totalCount}{' '}
                <span className="text-[#e0b86e] text-xs">
                  (%{stats.dominancePct})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/25">
              <div className="flex items-center gap-1.5 text-[11px] text-[#b8a990] mb-1">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Toplam Ordu</span>
              </div>
              <div className="font-mono-num font-bold text-sm text-[#faf3e3]">
                {stats.totalArmy.toLocaleString('tr-TR')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/25">
              <div className="flex items-center gap-1.5 text-[11px] text-[#b8a990] mb-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hazine</span>
              </div>
              <div className="font-mono-num font-bold text-sm text-[#faf3e3]">
                {Math.round(playerNation.treasury).toLocaleString('tr-TR')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/25">
              <div className="flex items-center gap-1.5 text-[11px] text-[#b8a990] mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#e0b86e]" />
                <span>Sefer Süresi</span>
              </div>
              <div className="font-mono-num font-bold text-sm text-[#faf3e3]">
                {tick.toLocaleString('tr-TR')} Gün
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {isVictory && (
              <button
                type="button"
                onClick={onContinueAfterVictory}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:brightness-105 text-[#14100c] font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Haritada Devam Et (Sonsuz Sefer)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRestartCampaign}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                isVictory
                  ? 'bg-[#231c15] hover:bg-[#30261d] text-[#faf3e3] border border-[#caa15a]/45'
                  : 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:brightness-105 text-[#14100c] shadow-lg'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Yeni Sefer Başlat</span>
            </button>

            <button
              type="button"
              onClick={onReturnToTitleMenu}
              className="w-full min-h-[44px] py-2 px-4 rounded-xl bg-[#19140f] hover:bg-[#231c15] border border-[#caa15a]/25 text-[#d8cbb5] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
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
