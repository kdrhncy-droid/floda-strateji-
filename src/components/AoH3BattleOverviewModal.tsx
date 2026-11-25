import React, { useMemo, useState } from 'react';
import {
  Swords,
  Shield,
  X,
  Zap,
  Target,
  Castle,
  ArrowRight,
  Handshake,
  Crown,
  Coins,
  Flag,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  ActiveBattle,
  ActiveSiege,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  Territory,
} from '../types/game';
import { NationFlagCanvasBadge } from '../map/nationFlagRenderer';
import { TERRAIN_INFO } from '../engine/pashaAndFiefEngine';
import {
  calculateProvinceDevelopment,
  getOrCreateRelation,
} from '../engine/simulationEngine';
import {
  calculateProvincePeaceScoreCost,
  calculateWarPeaceBudget,
  PeaceConferenceRequest,
} from '../engine/diplomacyAndWarActions';
import { sound } from '../utils/soundEngine';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { getTechArtwork } from './drawers/techArtwork';
import { AoH3GlyphSvg, AoH3MenuBanner } from './illustrations/AoH3Illustrations';

interface AoH3BattleOverviewModalProps {
  battle?: ActiveBattle | null;
  siege?: ActiveSiege | null;
  territory: Territory;
  playerNationId: string;
  nations: Record<string, Nation>;
  onClose: () => void;
  onApplyTacticalOrder?: (tactic: 'TURAN' | 'BOMBARD' | 'RETREAT') => void;
}

export const AoH3BattleOverviewModal: React.FC<AoH3BattleOverviewModalProps> = ({
  battle,
  siege,
  territory,
  playerNationId,
  nations,
  onClose,
  onApplyTacticalOrder,
}) => {
  const dialogRef = useAccessibleDialog(Boolean(battle || siege), onClose);
  if (!battle && !siege) return null;

  const attackerId = battle ? battle.attackerId : siege!.attackerId;
  const defenderId = battle ? battle.defenderId : siege!.defenderId;
  const attackerNation = nations[attackerId];
  const defenderNation = nations[defenderId];
  if (!attackerNation || !defenderNation) return null;

  const isPlayerAttacker = attackerId === playerNationId;
  const isPlayerDefender = defenderId === playerNationId;
  const isPlayerInvolved = isPlayerAttacker || isPlayerDefender;
  const canBombardSiegeWalls =
    !battle && Boolean(siege && siege.attackerId === playerNationId);
  const hasTacticalOrders = Boolean(
    (battle && isPlayerInvolved) || canBombardSiegeWalls
  );
  const turanAlreadyUsed = Boolean(
    battle && (isPlayerAttacker ? battle.attackerTuranUsed : battle.defenderTuranUsed)
  );
  const enemyTroopsForPlayer = battle
    ? isPlayerAttacker
      ? battle.defenderTroops
      : battle.attackerTroops
    : 0;
  const bombardmentBelowFloor = Boolean(battle && enemyTroopsForPlayer <= 200);

  const terrainMeta = TERRAIN_INFO[territory.terrain || 'OVA'] || TERRAIN_INFO.OVA;
  const combatWidth = battle?.combatWidth || 25000;

  const attTroops = battle ? battle.attackerTroops : siege!.attackerTroops;
  const defTroops = battle ? battle.defenderTroops : territory.garrison;
  const totalTroops = Math.max(1, attTroops + defTroops);
  const attRatio = Math.max(0.08, Math.min(0.92, attTroops / totalTroops));

  const attMorale = battle ? (battle.attackerMorale ?? 100) : 100;
  const defMorale = battle ? (battle.defenderMorale ?? 100) : 100;

  const attFrontTotal = battle
    ? (battle.attackerFrontline ?? Math.round(attTroops * 0.8))
    : Math.round(attTroops * 0.75);
  const attBack = battle
    ? (battle.attackerBackline ?? Math.round(attTroops * 0.2))
    : Math.round(attTroops * 0.25);

  const defFrontTotal = battle
    ? (battle.defenderFrontline ?? Math.round(defTroops * 0.85))
    : Math.round(defTroops * 0.85);
  const defBack = battle
    ? (battle.defenderBackline ?? Math.round(defTroops * 0.15))
    : Math.round(defTroops * 0.15);

  // Split frontline into Ön Hat (Infantry) & Kanat (Cavalry/Armor) for AoH3 visual grid
  const attFrontCenter = Math.round(attFrontTotal * 0.72);
  const attFlank = Math.max(0, attFrontTotal - attFrontCenter);
  const defInfRatio = territory.garrison > 0
    ? Math.max(0.55, Math.min(0.85, (territory.units?.infantry ?? territory.garrison * 0.7) / Math.max(1, territory.garrison)))
    : 0.72;
  const defFrontCenter = Math.round(defFrontTotal * defInfRatio);
  const defFlank = Math.max(0, defFrontTotal - defFrontCenter);

  const REGIMENT_SLOTS = 10;
  const slotCapacity = Math.max(1000, Math.round(combatWidth / 1.8));
  const computeFilledCells = (count: number, cap: number) =>
    count <= 0 ? 0 : Math.max(1, Math.min(REGIMENT_SLOTS, Math.round((count / Math.max(1, cap)) * REGIMENT_SLOTS)));

  const attBackCells = computeFilledCells(attBack, slotCapacity * 0.45);
  const attFrontCells = computeFilledCells(attFrontCenter, slotCapacity * 0.75);
  const attFlankCells = computeFilledCells(attFlank, slotCapacity * 0.35);

  const defFrontCells = computeFilledCells(defFrontCenter, slotCapacity * 0.75);
  const defFlankCells = computeFilledCells(defFlank, slotCapacity * 0.35);
  const defBackCells = battle
    ? computeFilledCells(defBack, slotCapacity * 0.45)
    : computeFilledCells(((territory.castleWallHp ?? 100) / 100) * slotCapacity * 0.45, slotCapacity * 0.45);

  const wallHp = territory.castleWallHp ?? 100;

  const headerArt = getTechArtwork(battle ? 'INFANTRY' : 'FORTRESS', 'MILITARY');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-overview-title"
        tabIndex={-1}
        className="relative w-full max-w-3xl bg-[#14100c] border border-[#caa15a]/50 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Illustrated Oil-Painting Header Banner */}
        <div
          className="relative px-4 sm:px-5 py-3.5 border-b border-[#caa15a]/35 flex items-center justify-between gap-3 overflow-hidden"
          style={{ background: headerArt.fallbackGradient }}
        >
          <img
            src={headerArt.src}
            alt={territory.name}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            style={{ objectPosition: headerArt.objectPosition }}
            className="absolute inset-0 w-full h-full object-cover brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0b08]/95 via-[#14100c]/80 to-[#0e0b08]/92" />

          <div className="relative flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#14100c]/85 border border-[#caa15a]/50 flex items-center justify-center text-[#e0b86e] shrink-0 shadow">
              {battle ? <Swords className="w-5 h-5" /> : <Castle className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="battle-overview-title"
                  className="text-sm sm:text-base font-display font-bold text-[#faf3e3] uppercase tracking-wide truncate drop-shadow"
                >
                  {battle
                    ? `${territory.name} Muharebesi`
                    : `${territory.name} Kuşatması`}
                </h2>
                <span className="font-mono-num text-[11px] font-bold text-[#e0b86e] shrink-0">
                  {battle ? `Tur ${battle.round || 1}` : `%${Math.round(siege?.progress || 0)}`}
                </span>
              </div>
              <div className="text-[11px] font-mono-num text-[#c5b79e] flex items-center gap-2 truncate">
                <span>{terrainMeta.name}</span>
                <span>·</span>
                <span>Genişlik {(combatWidth / 1000).toFixed(0)}B</span>
                <span>·</span>
                <span>Sur %{wallHp}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Muharebe veya kuşatma özetini kapat"
            className="relative min-w-[44px] min-h-[44px] rounded-xl bg-[#14100c]/75 border border-[#caa15a]/35 text-[#d8cbb5] hover:text-white hover:bg-[#241c13] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Faction Tug of War Balance Bar (Antique Gold vs Crimson) */}
        <div className="w-full bg-[#0d0a07] h-2.5 relative flex overflow-hidden border-b border-[#caa15a]/20">
          <div
            className={`h-full transition-all duration-300 ${
              isPlayerAttacker
                ? 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
                : 'bg-gradient-to-r from-rose-800 to-rose-500'
            }`}
            style={{ width: `${attRatio * 100}%` }}
          />
          <div
            className={`h-full transition-all duration-300 ${
              isPlayerAttacker
                ? 'bg-gradient-to-r from-rose-700 to-rose-500'
                : 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
            }`}
            style={{ width: `${(1 - attRatio) * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#f3ead7] shadow-[0_0_8px_#e0b86e]"
            style={{ left: `${attRatio * 100}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Two Armies Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Attacker Card */}
            <div
              className={`p-3 rounded-xl border ${
                isPlayerAttacker
                  ? 'bg-[#1d1710] border-[#e0b86e]/60'
                  : 'bg-[#1b1510] border-rose-500/45'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <NationFlagCanvasBadge
                    nationId={attackerId}
                    flagCode={attackerNation.flagCode}
                    color={attackerNation.color}
                    width={30}
                    height={20}
                  />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#f3ead7] truncate">
                      {attackerNation.name}
                    </div>
                    <div className="text-[10.5px] text-[#b8a990] truncate">
                      Saldıran · {battle?.attackerCommanderName || 'Hükümdar'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div
                    className={`text-base font-extrabold ${
                      isPlayerAttacker ? 'text-[#e0b86e]' : 'text-rose-300'
                    }`}
                  >
                    {(attTroops / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Moral %{attMorale}
                  </div>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#0d0a07] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isPlayerAttacker
                      ? 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
                      : 'bg-gradient-to-r from-rose-700 to-rose-400'
                  }`}
                  style={{ width: `${Math.max(5, attMorale)}%` }}
                />
              </div>
            </div>

            {/* Defender Card */}
            <div
              className={`p-3 rounded-xl border ${
                !isPlayerAttacker
                  ? 'bg-[#1d1710] border-[#e0b86e]/60'
                  : 'bg-[#1b1510] border-rose-500/45'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <NationFlagCanvasBadge
                    nationId={defenderId}
                    flagCode={defenderNation.flagCode}
                    color={defenderNation.color}
                    width={30}
                    height={20}
                  />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-[#f3ead7] truncate">
                      {defenderNation.name}
                    </div>
                    <div className="text-[10.5px] text-[#b8a990] truncate">
                      Savunan · {battle?.defenderCommanderName || 'Garnizon'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div
                    className={`text-base font-extrabold ${
                      !isPlayerAttacker ? 'text-[#e0b86e]' : 'text-rose-300'
                    }`}
                  >
                    {(defTroops / 1000).toFixed(1)}B
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Moral %{defMorale}
                  </div>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-[#0d0a07] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    !isPlayerAttacker
                      ? 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
                      : 'bg-gradient-to-r from-rose-700 to-rose-400'
                  }`}
                  style={{ width: `${Math.max(5, defMorale)}%` }}
                />
              </div>
            </div>
          </div>

          {/* AoH3 Visual Checkered Battlefield Grid (Ön Hat / Kanat / Arka Hat) */}
          <div
            data-testid="aoh3-battle-formation-grid"
            className="rounded-xl bg-[#0e0b08] border border-[#caa15a]/35 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between text-[11px] font-display font-bold text-[#e0b86e] border-b border-[#caa15a]/20 pb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 shrink-0" />
                <span>Savaş Meydanı Dizilimi</span>
              </span>
              <span className="font-mono-num text-[10px] text-[#b8a990]">
                Ön Hat · Kanat · Arka Hat
              </span>
            </div>

            {/* Attacker Lines */}
            <div className="space-y-1.5">
              {[
                {
                  label: 'Arka Hat',
                  sub: 'Topçu',
                  count: attBack,
                  filled: attBackCells,
                  fillClass: isPlayerAttacker
                    ? 'bg-[#b38945]/85 border-[#e0b86e]/85'
                    : 'bg-rose-800/85 border-rose-500/80',
                },
                {
                  label: 'Kanat',
                  sub: 'Süvari',
                  count: attFlank,
                  filled: attFlankCells,
                  fillClass: isPlayerAttacker
                    ? 'bg-[#caa15a]/85 border-[#f0cf8e]/85'
                    : 'bg-rose-700/85 border-rose-400/80',
                },
                {
                  label: 'Ön Hat',
                  sub: 'Piyade',
                  count: attFrontCenter,
                  filled: attFrontCells,
                  fillClass: isPlayerAttacker
                    ? 'bg-[#e0b86e]/90 border-[#f7e1b2]/90'
                    : 'bg-rose-500/85 border-rose-300/85',
                },
              ].map((line) => (
                <div
                  key={`att-${line.label}`}
                  className="grid grid-cols-[76px_minmax(0,1fr)_52px] items-center gap-2 text-[10.5px]"
                >
                  <div
                    className={`truncate font-semibold ${
                      isPlayerAttacker ? 'text-[#f3ead7]' : 'text-rose-200'
                    }`}
                  >
                    {line.label}{' '}
                    <span className="text-[9px] text-[#a79880]">({line.sub})</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: REGIMENT_SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 rounded-[3px] border transition-colors ${
                          i < line.filled
                            ? line.fillClass
                            : 'bg-[#19140f] border-[#caa15a]/15'
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className={`text-right font-mono-num font-bold ${
                      isPlayerAttacker ? 'text-[#e0b86e]' : 'text-rose-300'
                    }`}
                  >
                    {(line.count / 1000).toFixed(1)}B
                  </div>
                </div>
              ))}
            </div>

            {/* Clash Divider */}
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#caa15a]/60 to-transparent" />
              <span className="text-[10px] font-display font-extrabold tracking-widest text-[#e0b86e] uppercase">
                CEPHEDE TEMAS
              </span>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#caa15a]/60 to-transparent" />
            </div>

            {/* Defender Lines */}
            <div className="space-y-1.5">
              {[
                {
                  label: 'Ön Hat',
                  sub: 'Piyade',
                  countLabel: `${(defFrontCenter / 1000).toFixed(1)}B`,
                  filled: defFrontCells,
                  fillClass: !isPlayerAttacker
                    ? 'bg-[#e0b86e]/90 border-[#f7e1b2]/90'
                    : 'bg-rose-500/85 border-rose-300/85',
                },
                {
                  label: 'Kanat',
                  sub: 'Süvari',
                  countLabel: `${(defFlank / 1000).toFixed(1)}B`,
                  filled: defFlankCells,
                  fillClass: !isPlayerAttacker
                    ? 'bg-[#caa15a]/85 border-[#f0cf8e]/85'
                    : 'bg-rose-700/85 border-rose-400/80',
                },
                {
                  label: battle ? 'Arka Hat' : 'Surlar',
                  sub: battle ? 'Destek' : 'Kale',
                  countLabel: battle ? `${(defBack / 1000).toFixed(1)}B` : `%${wallHp}`,
                  filled: defBackCells,
                  fillClass: !isPlayerAttacker
                    ? 'bg-[#b38945]/85 border-[#e0b86e]/85'
                    : 'bg-rose-800/85 border-rose-500/80',
                },
              ].map((line) => (
                <div
                  key={`def-${line.label}`}
                  className="grid grid-cols-[76px_minmax(0,1fr)_52px] items-center gap-2 text-[10.5px]"
                >
                  <div
                    className={`truncate font-semibold ${
                      !isPlayerAttacker ? 'text-[#f3ead7]' : 'text-rose-200'
                    }`}
                  >
                    {line.label}{' '}
                    <span className="text-[9px] text-[#a79880]">({line.sub})</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: REGIMENT_SLOTS }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 rounded-[3px] border transition-colors ${
                          i < line.filled
                            ? line.fillClass
                            : 'bg-[#19140f] border-[#caa15a]/15'
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className={`text-right font-mono-num font-bold ${
                      !isPlayerAttacker ? 'text-[#e0b86e]' : 'text-rose-300'
                    }`}
                  >
                    {line.countLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Siege Status Banner if territory has active siege */}
          {siege && (
            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/45 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Castle className="w-5 h-5 text-[#e0b86e] shrink-0" />
                <div className="text-xs font-bold text-[#f3ead7] truncate">
                  Kuşatma: %{Math.round(siege.progress)} · Sur: %{wallHp}
                </div>
              </div>
              <span className="text-xs font-mono-num font-bold text-[#e0b86e] shrink-0">
                {(siege.attackerTroops / 1000).toFixed(1)}B Kuşatmacı
              </span>
            </div>
          )}

          {/* Tactical Command Action Buttons */}
          {hasTacticalOrders && onApplyTacticalOrder && (
            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/30 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs font-display font-bold text-[#e0b86e]">
                Komutan Emri:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {battle && (
                  <button
                    type="button"
                    disabled={turanAlreadyUsed}
                    onClick={() => {
                      sound.playWarHorn();
                      onApplyTacticalOrder('TURAN');
                    }}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-[#241c13] hover:bg-[#32261a] disabled:opacity-50 disabled:cursor-not-allowed border border-[#caa15a]/50 text-[#f3ead7] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#e0b86e]" />
                    <span>
                      {turanAlreadyUsed
                        ? 'Hilal & Turan (Kullanıldı)'
                        : 'Hilal & Turan (+%18)'}
                    </span>
                  </button>
                )}
                {(battle || canBombardSiegeWalls) && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playWarHorn();
                      onApplyTacticalOrder('BOMBARD');
                    }}
                    disabled={
                      bombardmentBelowFloor ||
                      (!battle &&
                        (territory.castleWallHp ?? siege?.wallIntegrity ?? 100) <= 0)
                    }
                    className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-[#241c13] hover:bg-[#32261a] disabled:opacity-50 disabled:cursor-not-allowed border border-[#caa15a]/45 text-[#f3ead7] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5 text-[#e0b86e]" />
                    <span>
                      {battle
                        ? bombardmentBelowFloor
                          ? 'Eşik (200)'
                          : 'Topçu Ateşi'
                        : 'Surları Bombala (−20)'}
                    </span>
                  </button>
                )}
                {battle && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playMarch();
                      onApplyTacticalOrder('RETREAT');
                    }}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/45 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Geri Çekil</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#100d09] border-t border-[#caa15a]/25 text-right">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#241c14] hover:bg-[#31261b] border border-[#caa15a]/40 text-[#f3ead7] text-xs font-bold transition-all cursor-pointer"
          >
            Haritaya Dön
          </button>
        </div>
      </div>
    </div>
  );
};

export interface UnifiedWarAndPeaceModalProps {
  war: ActiveWar;
  playerWars: ActiveWar[];
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  movements: ArmyMovement[];
  tick: number;
  onSelectWar: (warId: string) => void;
  onCallAllyToWar: (warId: string, allyNationId: string) => void;
  onResolvePeaceConference: (request: PeaceConferenceRequest) => void;
  onClose: () => void;
}

export const UnifiedWarAndPeaceModal: React.FC<UnifiedWarAndPeaceModalProps> = ({
  war,
  playerWars,
  playerNationId,
  nations,
  territories,
  relations,
  movements,
  tick,
  onSelectWar,
  onCallAllyToWar,
  onResolvePeaceConference,
  onClose,
}) => {
  const dialogRef = useAccessibleDialog(Boolean(war), onClose);

  const budgetInfo = useMemo(
    () => calculateWarPeaceBudget(war, playerNationId, territories),
    [war, playerNationId, territories]
  );

  const {
    signedWarScore,
    occupiedEnemyProvinces,
    claimableEnemyProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  } = budgetInfo;

  // Default selection: pre-select any occupied enemy provinces that fit in the current budget
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState<string[]>(() =>
    occupiedEnemyProvinces.map((t) => t.id)
  );
  const [demandVassal, setDemandVassal] = useState<boolean>(false);
  const [demandTribute, setDemandTribute] = useState<boolean>(false);
  const [demandReparations, setDemandReparations] = useState<boolean>(false);

  const playerNation = nations[playerNationId];
  const enemyNation = nations[enemyNationId];

  const playerSideIds = isPlayerAttackerSide ? war.attackers : war.defenders;
  const enemySideIds = isPlayerAttackerSide ? war.defenders : war.attackers;

  const armyByNation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of Object.values(territories)) {
      if (!t?.ownerId) continue;
      map[t.ownerId] = (map[t.ownerId] || 0) + (t.garrison || 0);
    }
    for (const mv of movements) {
      if (!mv?.ownerId) continue;
      map[mv.ownerId] = (map[mv.ownerId] || 0) + (mv.troops || 0);
    }
    return map;
  }, [territories, movements]);

  const ourTotalArmy = playerSideIds.reduce(
    (sum, id) => sum + (armyByNation[id] || 0),
    0
  );
  const enemyTotalArmy = enemySideIds.reduce(
    (sum, id) => sum + (armyByNation[id] || 0),
    0
  );
  const combinedArmy = Math.max(1, ourTotalArmy + enemyTotalArmy);
  const ourPowerPct = Math.max(
    8,
    Math.min(92, Math.round((ourTotalArmy / combinedArmy) * 100))
  );

  const ourCasualties = isPlayerAttackerSide
    ? war.casualtiesAttacker
    : war.casualtiesDefender;
  const enemyCasualties = isPlayerAttackerSide
    ? war.casualtiesDefender
    : war.casualtiesAttacker;

  // Allies eligible to be called into this war
  const callableAllies = useMemo(() => {
    const list: Nation[] = [];
    for (const nat of Object.values(nations)) {
      if (
        !nat ||
        nat.isEliminated ||
        nat.id === playerNationId ||
        playerSideIds.includes(nat.id) ||
        enemySideIds.includes(nat.id)
      ) {
        continue;
      }
      const rel = getOrCreateRelation(relations, playerNationId, nat.id);
      const isAllyOrPact =
        rel.isAllied ||
        Boolean(rel.allianceType) ||
        nat.vassalOf === playerNationId;
      if (!isAllyOrPact) continue;

      const relWithEnemy = getOrCreateRelation(relations, nat.id, enemyNationId);
      if (relWithEnemy.truceUntilTick > tick && nat.vassalOf !== playerNationId) {
        continue;
      }
      list.push(nat);
    }
    return list;
  }, [
    nations,
    playerNationId,
    playerSideIds,
    enemySideIds,
    relations,
    enemyNationId,
    tick,
  ]);

  // Enrich claimable enemy provinces with development score & war score point cost
  const provinceEntries = useMemo(() => {
    return claimableEnemyProvinces
      .map((terr) => {
        const isOccupiedByUs =
          playerSideIds.includes(terr.ownerId) && Boolean(terr.isOccupied);
        const dev = calculateProvinceDevelopment(terr, enemyNation);
        const pointCost = calculateProvincePeaceScoreCost(
          terr,
          enemyNation,
          isOccupiedByUs
        );
        return {
          territory: terr,
          isOccupiedByUs,
          devScore: dev.developmentScore,
          pointCost,
        };
      })
      .sort((a, b) => {
        if (a.isOccupiedByUs !== b.isOccupiedByUs) {
          return a.isOccupiedByUs ? -1 : 1;
        }
        return a.pointCost - b.pointCost;
      });
  }, [claimableEnemyProvinces, playerSideIds, enemyNation]);

  const validSelectedIds = useMemo(() => {
    const validSet = new Set(provinceEntries.map((p) => p.territory.id));
    return selectedTerritoryIds.filter((id) => validSet.has(id));
  }, [selectedTerritoryIds, provinceEntries]);

  const isFullAnnexSelected =
    provinceEntries.length > 0 &&
    validSelectedIds.length === provinceEntries.length;

  const rawTerritoryCost = useMemo(() => {
    const selSet = new Set(validSelectedIds);
    let sum = 0;
    for (const item of provinceEntries) {
      if (selSet.has(item.territory.id)) {
        sum += item.pointCost;
      }
    }
    if (isFullAnnexSelected && sum > 100) {
      return 100;
    }
    return sum;
  }, [validSelectedIds, provinceEntries, isFullAnnexSelected]);

  const remainingProvincesCount = Math.max(
    0,
    provinceEntries.length - validSelectedIds.length
  );
  const vassalCost =
    demandVassal && remainingProvincesCount > 0
      ? remainingProvincesCount <= 3
        ? 35
        : 45
      : 0;
  const tributeCost = demandTribute ? 20 : 0;
  const reparationsCost = demandReparations ? 15 : 0;
  const totalSpentPoints =
    rawTerritoryCost + vassalCost + tributeCost + reparationsCost;

  const isOverBudget = totalSpentPoints > availableBudget;
  const canSignDemands = totalSpentPoints > 0 && !isOverBudget;

  const toggleProvinceDemand = (territoryId: string) => {
    sound.playClick();
    setSelectedTerritoryIds((prev) =>
      prev.includes(territoryId)
        ? prev.filter((id) => id !== territoryId)
        : [...prev, territoryId]
    );
  };

  const selectAllOccupied = () => {
    sound.playClick();
    setSelectedTerritoryIds(
      provinceEntries.filter((p) => p.isOccupiedByUs).map((p) => p.territory.id)
    );
  };

  const selectFullAnnexation = () => {
    sound.playClick();
    setSelectedTerritoryIds(provinceEntries.map((p) => p.territory.id));
    setDemandVassal(false);
  };

  if (!playerNation || !enemyNation) return null;

  const displayScore =
    signedWarScore >= 0
      ? Math.max(signedWarScore, availableBudget)
      : signedWarScore;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/82 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-war-modal-title"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#14110e] border border-[#caa15a]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f3ead7]"
      >
        {/* Top Header + Active War Switcher */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-[#17120d] border-b border-[#caa15a]/35 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#100d09] border border-[#caa15a]/35">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={26}
                height={18}
              />
              <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-[#e0b86e]" />
              <NationFlagCanvasBadge
                nationId={enemyNation.id}
                flagCode={enemyNation.flagCode}
                color={enemyNation.color}
                width={26}
                height={18}
              />
            </div>
            <div className="min-w-0">
              <h2
                id="unified-war-modal-title"
                className="font-display font-bold text-sm sm:text-base text-[#faf3e3] truncate"
              >
                {war.name.replace(/\s*\((1440|2026)\)\s*/g, '')}
              </h2>
              <p className="text-[11px] text-[#c5b79e]">
                Tek Merkezli Savaş Masası & Savaş Puanı Bütçeli Barış Konferansı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {playerWars.length > 1 && (
              <select
                value={war.id}
                onChange={(e) => {
                  sound.playClick();
                  onSelectWar(e.target.value);
                }}
                aria-label="Aktif savaş seç"
                className="px-2.5 py-1.5 rounded-xl bg-[#100d09] border border-[#caa15a]/40 text-xs font-bold text-[#e0b86e]"
              >
                {playerWars.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Savaş masasını kapat"
              className="w-8 h-8 rounded-xl bg-[#100d09] hover:bg-[#241c13] border border-[#caa15a]/30 flex items-center justify-center text-[#d8cbb5] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Power Balance & War Score Strip */}
        <div className="px-4 py-2.5 bg-[#1b1510] border-b border-[#caa15a]/25 space-y-1.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#e0b86e] inline-flex items-center gap-1.5">
              <AoH3GlyphSvg name="shield" className="w-3.5 h-3.5 shrink-0" />
              <span>
                Bizim Cephe: {(ourTotalArmy / 1000).toFixed(1)}B Asker · Kayıp:{' '}
                {(ourCasualties / 1000).toFixed(1)}B
              </span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg font-mono-num font-extrabold text-xs border ${
                displayScore > 0
                  ? 'bg-[#241c13] border-[#caa15a]/55 text-[#e0b86e]'
                  : displayScore < 0
                  ? 'bg-rose-950/75 border-rose-500/55 text-rose-200'
                  : 'bg-[#14100c] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              Savaş Skoru: {displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`} · İşgalimiz:{' '}
              {occupiedEnemyProvinces.length}/{claimableEnemyProvinces.length} Şehir
            </span>
            <span className="font-bold text-rose-300 inline-flex items-center gap-1.5">
              <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 shrink-0" />
              <span>
                Karşı Cephe: {(enemyTotalArmy / 1000).toFixed(1)}B Asker · Kayıp:{' '}
                {(enemyCasualties / 1000).toFixed(1)}B
              </span>
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-rose-900/70 overflow-hidden flex border border-black/50">
            <div
              className="h-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] transition-all duration-300"
              style={{ width: `${ourPowerPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-800 transition-all duration-300"
              style={{ width: `${100 - ourPowerPct}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content: Coalitions, Call Allies, and Point-Budget Peace Conference */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs">
          <AoH3MenuBanner
            artKey="FORTRESS"
            branch="MILITARY"
            title={war.name.replace(/\s*\((1440|2026)\)\s*/g, '')}
            subtitle={`Savaş Skoru ${displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`} · İşgal ${occupiedEnemyProvinces.length}/${claimableEnemyProvinces.length}`}
            icon="sword"
          />

          {/* 1. War Coalitions & Call Ally Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Our Coalition + Call Ally */}
            <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e0b86e] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Bizim Cephe & Müttefikler ({playerSideIds.length})</span>
                </span>
                <span className="text-[11px] font-mono-num text-[#f3ead7]">
                  Güç Oranı: %{ourPowerPct}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {playerSideIds.map((nId) => {
                  const nat = nations[nId];
                  if (!nat) return null;
                  return (
                    <div
                      key={nId}
                      className="px-2 py-1 rounded-lg bg-[#120e0b] border border-[#caa15a]/30 flex items-center gap-1.5"
                    >
                      <NationFlagCanvasBadge
                        nationId={nat.id}
                        flagCode={nat.flagCode}
                        color={nat.color}
                        width={18}
                        height={12}
                      />
                      <span className="font-bold text-[#f3ead7] text-[11px]">
                        {nat.name.replace(/\s*\((1440|2026)\)\s*$/, '')}
                      </span>
                      <span className="text-[10px] font-mono-num text-[#e0b86e]">
                        {((armyByNation[nId] || 0) / 1000).toFixed(1)}B
                      </span>
                    </div>
                  );
                })}
              </div>

              {callableAllies.length > 0 && (
                <div className="pt-1.5 border-t border-[#caa15a]/20 space-y-1.5">
                  <div className="text-[11px] font-bold text-[#e0b86e] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>Savaşa Çağrılabilir Müttefikler ({callableAllies.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {callableAllies.map((ally) => (
                      <button
                        key={ally.id}
                        type="button"
                        onClick={() => onCallAllyToWar(war.id, ally.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#241c13] hover:bg-[#31261a] border border-[#caa15a]/50 text-[#f3ead7] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <NationFlagCanvasBadge
                          nationId={ally.id}
                          flagCode={ally.flagCode}
                          color={ally.color}
                          width={16}
                          height={11}
                        />
                        <AoH3GlyphSvg name="horn" className="w-3 h-3 text-[#e0b86e]" />
                        <span>{ally.name.replace(/\s*\((1440|2026)\)\s*$/, '')} Çağır</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Enemy Coalition */}
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/35 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Karşı Cephe & Müttefikleri ({enemySideIds.length})</span>
                </span>
                <span className="text-[11px] font-mono-num text-rose-200">
                  Güç Oranı: %{100 - ourPowerPct}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {enemySideIds.map((nId) => {
                  const nat = nations[nId];
                  if (!nat) return null;
                  return (
                    <div
                      key={nId}
                      className="px-2 py-1 rounded-lg bg-black/45 border border-rose-500/30 flex items-center gap-1.5"
                    >
                      <NationFlagCanvasBadge
                        nationId={nat.id}
                        flagCode={nat.flagCode}
                        color={nat.color}
                        width={18}
                        height={12}
                      />
                      <span className="font-bold text-white text-[11px]">
                        {nat.name.replace(/\s*\((1440|2026)\)\s*$/, '')}
                      </span>
                      <span className="text-[10px] font-mono-num text-rose-300">
                        {((armyByNation[nId] || 0) / 1000).toFixed(1)}B
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Point-Budget Peace Conference Builder */}
          <div className="p-3.5 rounded-2xl bg-[#1b1510] border border-[#caa15a]/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-sm text-[#e0b86e] flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-[#caa15a]" />
                  <span>Savaş Puanı Bütçeli Barış Konferansı</span>
                </h3>
                <p className="text-[11px] text-[#c5b79e]">
                  Savaşta kazandığınız puan bütçesi kadar şehir talep edebilir, komple ilhak, vasal veya haraç şartlarını birleştirebilirsiniz.
                </p>
              </div>

              {/* Spent / Available War Score Budget Pill */}
              <div
                className={`px-3 py-1.5 rounded-xl border font-mono-num font-bold text-xs flex items-center gap-2 ${
                  isOverBudget
                    ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                    : totalSpentPoints > 0
                    ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                    : 'bg-[#120e0b] border-[#caa15a]/40 text-[#f3ead7]'
                }`}
              >
                <span>
                  Harcanan Puan: <strong>{totalSpentPoints}</strong> / Kazanılan Bütçe:{' '}
                  <strong>{availableBudget}</strong>
                </span>
              </div>
            </div>

            {/* Live Acceptance Status Banner (+25 War Score Requirement) */}
            <div
              className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                displayScore < 25
                  ? 'bg-[#14100c] border-[#caa15a]/45 text-[#e0b86e]'
                  : isOverBudget
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  : totalSpentPoints > 0
                  ? 'bg-[#221a12] border-[#e0b86e]/60 text-[#f3ead7]'
                  : 'bg-[#120e0b] border-[#caa15a]/25 text-[#d8cbb5]'
              }`}
            >
              <div className="flex items-center gap-2">
                {displayScore < 25 ? (
                  <AoH3GlyphSvg name="lock" className="w-4 h-4 text-[#e0b86e] shrink-0" />
                ) : isOverBudget ? (
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#e0b86e] shrink-0" />
                )}
                <span>
                  {displayScore < 25
                    ? `Savaş ilan edildikten hemen sonra barış yapılamaz! Barış antlaşması imzalayabilmek için Savaş Skorunda en az +25% önde olmalısınız (Mevcut: ${displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`}).`
                    : isOverBudget
                    ? `Puan Bütçesi Aşıldı (+${totalSpentPoints - availableBudget} Puan fazla). Daha fazla şehir işgal edin veya talepleri azaltın.`
                    : totalSpentPoints > 0
                    ? `${enemyNation.name} seçilen barış şartlarını (${totalSpentPoints} Puan) kabul ediyor!`
                    : 'Aşağıdan talep edeceğiniz şehirleri veya antlaşma şartlarını seçin.'}
                </span>
              </div>
            </div>

            {/* Territory Demand Section with Quick Buttons (Select Occupied / Full Annexation / Clear) */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#f3ead7] inline-flex items-center gap-1.5">
                  <AoH3GlyphSvg name="pin" className="w-3.5 h-3.5 text-[#e0b86e]" />
                  <span>
                    Şehir & Toprak Talepleri ({validSelectedIds.length}/{provinceEntries.length} Şehir Seçili · {rawTerritoryCost} Puan)
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllOccupied}
                    className="px-2.5 py-1 rounded-lg bg-[#241c13] hover:bg-[#31261a] border border-[#caa15a]/55 text-[#e0b86e] text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <AoH3GlyphSvg name="bolt" className="w-3 h-3" />
                    <span>İşgal Edilenleri Seç ({occupiedEnemyProvinces.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={selectFullAnnexation}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 ${
                      isFullAnnexSelected
                        ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] border-[#f3ead7]/60'
                        : 'bg-[#1d1710] hover:bg-[#2a2117] border-[#caa15a]/45 text-[#f3ead7]'
                    }`}
                  >
                    <AoH3GlyphSvg name="flag" className="w-3 h-3" />
                    <span>Komple İlhak Et (Tüm Şehirler)</span>
                  </button>
                  {validSelectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSelectedTerritoryIds([]);
                      }}
                      className="px-2 py-1 rounded-lg bg-[#120e0b] hover:bg-[#1e1813] border border-[#caa15a]/25 text-[#c5b79e] text-[11px] font-semibold cursor-pointer"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto p-1 rounded-xl bg-[#0e0b08] border border-[#caa15a]/20">
                {provinceEntries.map(({ territory, isOccupiedByUs, devScore, pointCost }) => {
                  const isSelected = validSelectedIds.includes(territory.id);
                  return (
                    <button
                      key={territory.id}
                      type="button"
                      onClick={() => toggleProvinceDemand(territory.id)}
                      className={`p-2 rounded-lg border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#2a2013] border-[#e0b86e] text-[#f3ead7] shadow'
                          : isOccupiedByUs
                          ? 'bg-[#1d1710] border-[#caa15a]/50 text-[#f3ead7] hover:border-[#e0b86e]'
                          : 'bg-[#120e0b] border-[#caa15a]/20 text-[#c5b79e] hover:border-[#caa15a]/45'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[11px] truncate">
                          {territory.name.replace(/^★\s*/, '')}
                        </div>
                        <div className="text-[10px] text-[#c5b79e] flex items-center gap-1">
                          <span className="inline-flex items-center gap-0.5">
                            <AoH3GlyphSvg name="star" className="w-2.5 h-2.5 text-[#caa15a]" />
                            <span>{devScore}</span>
                          </span>
                          {isOccupiedByUs && (
                            <span className="text-[#e0b86e] font-semibold">· İşgalde</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-extrabold shrink-0 ${
                          isSelected
                            ? 'bg-[#e0b86e] text-[#14100c]'
                            : 'bg-[#14100c] text-[#e0b86e] border border-[#caa15a]/30'
                        }`}
                      >
                        {pointCost}P
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strategic Treaty Clauses (Vassalize / Tribute / Reparations) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                disabled={isFullAnnexSelected}
                onClick={() => {
                  sound.playClick();
                  setDemandVassal((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  demandVassal && !isFullAnnexSelected
                    ? 'bg-[#281f13] border-[#e0b86e] text-[#f3ead7]'
                    : 'bg-[#120e0b] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Vasal Yap</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Kalan topraklarıyla bağlı devlet olur
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#caa15a]/20 border border-[#caa15a]/45 font-mono-num font-bold text-[11px] text-[#e0b86e] shrink-0">
                  {remainingProvincesCount <= 3 ? '35P' : '45P'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setDemandTribute((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  demandTribute
                    ? 'bg-[#281f13] border-[#e0b86e] text-[#f3ead7]'
                    : 'bg-[#120e0b] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Haraca Bağla</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Düzenli haraç ve gelir payı öder
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#caa15a]/20 border border-[#caa15a]/45 font-mono-num font-bold text-[11px] text-[#e0b86e] shrink-0">
                  20P
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setDemandReparations((v) => !v);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  demandReparations
                    ? 'bg-[#281f13] border-[#e0b86e] text-[#f3ead7]'
                    : 'bg-[#120e0b] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Savaş Tazminatı</span>
                  </div>
                  <div className="text-[10px] text-[#b8a990]">
                    Hazineden nakit altın tazminatı
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#caa15a]/20 border border-[#caa15a]/45 font-mono-num font-bold text-[11px] text-[#e0b86e] shrink-0">
                  15P
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Unified Action Bar: Peace Demand / White Peace / Surrender */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#17120d] border-t border-[#caa15a]/35 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canSignDemands || displayScore < 25}
              title={
                displayScore < 25
                  ? `Barış antlaşması için en az +25% Savaş Skoru gereklidir (Mevcut: ${displayScore}%)`
                  : undefined
              }
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'PEACE_DEMANDS',
                  demandedTerritoryIds: validSelectedIds,
                  demandVassal: demandVassal && !isFullAnnexSelected,
                  demandTribute,
                  demandReparations,
                })
              }
              className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d9b26b] hover:to-[#ecc77f] disabled:opacity-45 disabled:cursor-not-allowed text-[#14110e] font-extrabold text-xs shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <AoH3GlyphSvg
                name={displayScore < 25 ? 'lock' : 'scroll'}
                className="w-3.5 h-3.5 shrink-0"
              />
              <span>
                {displayScore < 25
                  ? 'Barış İmzala (+25% Skor Şartı)'
                  : `Barış Talebini İmzala (${totalSpentPoints}/${availableBudget} Puan)`}
              </span>
            </button>

            <button
              type="button"
              disabled={displayScore < 25}
              title={
                displayScore < 25
                  ? `Beyaz barış için en az +25% Savaş Skoru gereklidir (Mevcut: ${displayScore}%)`
                  : undefined
              }
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'WHITE_PEACE',
                })
              }
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#211a12] hover:bg-[#2c2318] disabled:opacity-45 disabled:cursor-not-allowed border border-[#caa15a]/35 text-[#f3ead7] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <AoH3GlyphSvg
                name={displayScore < 25 ? 'lock' : 'dove'}
                className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
              />
              <span>
                {displayScore < 25
                  ? 'Galipsiz Barış (+25% Şart)'
                  : 'Galipsiz Barış (Beyaz Barış)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onResolvePeaceConference({
                  warId: war.id,
                  mode: 'SURRENDER',
                })
              }
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <AoH3GlyphSvg name="flag" className="w-3.5 h-3.5 shrink-0" />
              <span>Teslim Ol</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#120e0b] hover:bg-[#1e1813] border border-[#caa15a]/30 text-[#d8cbb5] font-semibold text-xs cursor-pointer"
          >
            Haritaya Dön
          </button>
        </div>
      </div>
    </div>
  );
};

