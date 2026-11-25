import React, { useState, useMemo } from 'react';
import {
  Anchor,
  Bot,
  Shield,
  Navigation,
  ChevronRight,
  ChevronLeft,
  Crosshair,
} from 'lucide-react';
import {
  ActiveBattle,
  ActiveWar,
  AiCommanderStance,
  ArmyMovement,
  BottomDrawerTab,
  Nation,
  SeaArmy,
  Territory,
} from '../../types/game';
import { sound } from '../../utils/soundEngine';

import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { calculateWarPeaceBudget } from '../../engine/diplomacyAndWarActions';
import { AoH3GlyphSvg } from '../illustrations/AoH3Illustrations';

interface AoH3OutlinerWidgetProps {
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  battles?: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies?: SeaArmy[];
  selectedTerritoryId: string | null;
  selectedSeaArmyId?: string | null;
  aiCommanderEnabled?: boolean;
  aiCommanderStance?: AiCommanderStance;
  onSelectTerritory: (id: string) => void;
  onSelectSeaArmy?: (id: string) => void;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onStartArmyOrder: (id: string) => void;
  onStartSeaArmyOrder?: (id: string) => void;
  onStartBatchMarch?: () => void;
  onToggleAiCommander?: () => void;
  onSetAiCommanderStance?: (stance: AiCommanderStance) => void;
  onOpenWarModal?: (warId: string) => void;
}

function getWarScoreColorStyle(score: number): {
  pillBg: string;
  pillBorder: string;
  textColor: string;
} {
  if (score >= 55) {
    return {
      pillBg: 'rgba(6, 78, 59, 0.96)',
      pillBorder: '#10B981',
      textColor: '#6EE7B7',
    };
  }
  if (score >= 20) {
    return {
      pillBg: 'rgba(6, 95, 70, 0.92)',
      pillBorder: '#34D399',
      textColor: '#A7F3D0',
    };
  }
  if (score > 0) {
    return {
      pillBg: 'rgba(15, 62, 48, 0.9)',
      pillBorder: 'rgba(52, 211, 153, 0.65)',
      textColor: '#D1FAE5',
    };
  }
  if (score <= -55) {
    return {
      pillBg: 'rgba(127, 29, 29, 0.96)',
      pillBorder: '#F43F5E',
      textColor: '#FDA4AF',
    };
  }
  if (score <= -20) {
    return {
      pillBg: 'rgba(136, 19, 55, 0.92)',
      pillBorder: '#FB7185',
      textColor: '#FECDD3',
    };
  }
  if (score < 0) {
    return {
      pillBg: 'rgba(76, 17, 36, 0.9)',
      pillBorder: 'rgba(251, 113, 133, 0.65)',
      textColor: '#FFE4E6',
    };
  }
  return {
    pillBg: 'rgba(24, 21, 17, 0.94)',
    pillBorder: 'rgba(202, 161, 90, 0.55)',
    textColor: '#FDE68A',
  };
}

export const LiveWarHudBadges: React.FC<{
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onOpenWarModal?: (warId: string) => void;
}> = ({
  playerNationId,
  nations,
  territories,
  wars,
  onSetActiveTab,
  onOpenWarModal,
}) => {
  const playerNation = nations[playerNationId];
  const playerWars = useMemo(
    () =>
      wars.filter(
        (w) =>
          w.attackerId === playerNationId ||
          w.defenderId === playerNationId ||
          w.attackers.includes(playerNationId) ||
          w.defenders.includes(playerNationId)
      ),
    [wars, playerNationId]
  );

  if (playerWars.length === 0 || !playerNation) return null;

  return (
    <div
      data-testid="live-war-hud-badges"
      className="flex flex-wrap items-start gap-1.5 sm:gap-2 pointer-events-none max-w-full"
    >
      {playerWars.map((war) => {
        const isAttacker =
          war.attackerId === playerNationId ||
          war.attackers.includes(playerNationId);
        const enemyId = isAttacker ? war.defenderId : war.attackerId;
        const enemy = nations[enemyId];
        if (!enemy) return null;

        const budgetInfo = calculateWarPeaceBudget(
          war,
          playerNationId,
          territories
        );
        const displayScore =
          budgetInfo.signedWarScore >= 0
            ? Math.max(budgetInfo.signedWarScore, budgetInfo.availableBudget)
            : budgetInfo.signedWarScore;
        const colorStyle = getWarScoreColorStyle(displayScore);
        const cleanEnemyName = enemy.name.replace(/\s*\((1440|2026)\)\s*$/, '');

        return (
          <button
            key={war.id}
            type="button"
            data-testid={`war-hud-badge-${war.id}`}
            onClick={() => {
              sound.playClick();
              if (onOpenWarModal) {
                onOpenWarModal(war.id);
              } else {
                onSetActiveTab('DIPLOMACY');
              }
            }}
            title={`${cleanEnemyName} Savaşı (${displayScore > 0 ? `+${displayScore}` : displayScore}%) — Savaş Masası & Barış Konferansı için tıklayın`}
            className="pointer-events-auto group flex flex-col items-center rounded-xl p-1.5 pb-1 transition-transform active:scale-95 hover:scale-[1.03] shadow-2xl cursor-pointer border"
            style={{
              backgroundColor: 'rgba(16, 14, 12, 0.94)',
              borderColor: colorStyle.pillBorder,
            }}
          >
            {/* Top Row: [Player Flag] ⚔ [Enemy Flag] */}
            <div className="flex items-center gap-1.5 px-1">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={24}
                height={16}
              />
              <AoH3GlyphSvg
                name="sword"
                className="w-3 h-3 text-[#e0b86e] drop-shadow shrink-0"
              />
              <NationFlagCanvasBadge
                nationId={enemy.id}
                flagCode={enemy.flagCode}
                color={enemy.color}
                width={24}
                height={16}
              />
            </div>

            {/* Bottom Row: Dynamic Green / Red War Score Percentage */}
            <div
              className="mt-1 w-full px-2 py-0.5 rounded-md border text-[10px] font-mono-num font-extrabold text-center tracking-tight transition-colors"
              style={{
                backgroundColor: colorStyle.pillBg,
                borderColor: colorStyle.pillBorder,
                color: colorStyle.textColor,
              }}
            >
              {displayScore > 0 ? `+${displayScore}%` : `${displayScore}%`}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const AoH3OutlinerWidget: React.FC<AoH3OutlinerWidgetProps> = ({
  playerNationId,
  nations,
  territories,
  battles = [],
  movements,
  seaArmies = [],
  selectedTerritoryId,
  selectedSeaArmyId = null,
  aiCommanderEnabled = false,
  aiCommanderStance = 'BALANCED',
  onSelectTerritory,
  onSelectSeaArmy,
  onSetActiveTab,
  onStartArmyOrder,
  onStartSeaArmyOrder,
  onStartBatchMarch,
  onToggleAiCommander,
  onSetAiCommanderStance,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const relevantBattles = useMemo(
    () =>
      battles.filter(
        (b) =>
          b.attackerId === playerNationId || b.defenderId === playerNationId
      ),
    [battles, playerNationId]
  );

  const relevantMovements = useMemo(
    () =>
      movements.filter((m) => {
        if (m.ownerId === playerNationId) return true;
        const targetOwner = territories[m.toTerritoryId]?.ownerId;
        return targetOwner === playerNationId;
      }),
    [movements, playerNationId, territories]
  );

  const allPlayerArmies = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNationId && t.garrison >= 200)
        .sort((a, b) => b.garrison - a.garrison),
    [territories, playerNationId]
  );

  const playerSeaArmies = useMemo(
    () =>
      seaArmies
        .filter((s) => s.ownerId === playerNationId && s.troops > 0)
        .sort((a, b) => b.troops - a.troops),
    [seaArmies, playerNationId]
  );

  const totalStandingArmy = useMemo(
    () =>
      allPlayerArmies.reduce((sum, t) => sum + (t.garrison || 0), 0) +
      playerSeaArmies.reduce((sum, s) => sum + (s.troops || 0), 0) +
      relevantMovements
        .filter((m) => m.ownerId === playerNationId)
        .reduce((sum, m) => sum + (m.troops || 0), 0),
    [allPlayerArmies, playerSeaArmies, relevantMovements, playerNationId]
  );

  const totalArmyUnitsCount = allPlayerArmies.length + playerSeaArmies.length;

  return (
    <aside className="hud-outliner relative z-30 flex flex-col items-end pointer-events-none shrink-0">
      {/* AoH3 Ordularım (Army Roster Menu) Button */}
      <button
        data-testid="aoh3-army-roster-toggle"
        onClick={() => {
          sound.playClick();
          setIsOpen((prev) => !prev);
        }}
        className={`aoh3-plaque pointer-events-auto min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md border shadow-xl flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer ${
          relevantBattles.length > 0
            ? 'bg-amber-500 text-slate-950 border-amber-300'
            : isOpen
            ? 'bg-[#caa15a] text-[#14110e] border-[#f3ead7]'
            : 'bg-[#14110e]/95 border-[#caa15a]/55 text-[#f3ead7] hover:border-[#caa15a]'
        }`}
        title="Ordu ve Filo Menüsü (Tüm Kara Orduları, Deniz Filoları ve Hızlı Sevk)"
      >
        <Shield className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
        <span className="whitespace-nowrap">
          Ordular ({totalArmyUnitsCount})
        </span>
        <span className="px-1 sm:px-1.5 py-0.2 rounded bg-black/45 border border-[#caa15a]/35 text-[9.5px] sm:text-[10px] font-mono-num text-[#e0b86e]">
          {(totalStandingArmy / 1000).toFixed(1)}B
        </span>
        {relevantMovements.length > 0 && (
          <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded bg-[#caa15a]/20 border border-[#caa15a]/50 text-[10px] font-mono-num text-[#f3ead7]">
            {relevantMovements.length} Yürüyüş
          </span>
        )}
        {isOpen ? (
          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>

      {/* Expanded AoH3 Army Roster Menu — Anchored right-0 so it never overflows mobile screens */}
      {isOpen && (
        <div className="pointer-events-auto absolute right-0 top-full mt-1.5 w-[min(320px,calc(100vw-1rem))] max-h-[min(56vh,calc(100dvh-11rem))] overflow-y-auto aoh3-panel aoh3-chamfer rounded-xl text-xs text-[#f3ead7] z-40">
          <div className="sticky top-0 z-10 aoh3-panel-title rounded-t-[11px]">
            <span className="aoh3-panel-title-text">Ordular &amp; Cephe</span>
            <span className="aoh3-panel-title-rule" />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="aoh3-panel-close"
              aria-label="Ordu menüsünü kapat"
            >
              ✕
            </button>
          </div>
          <div className="p-2.5 space-y-2.5">
          {/* Header Summary */}
          <div className="flex items-center justify-between gap-2 px-1 pb-1.5 border-b border-[#caa15a]/25">
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-wide text-[#c5b79e] truncate">
                Toplam: {(totalStandingArmy / 1000).toFixed(1)}B Asker ·{' '}
                {allPlayerArmies.length} Garnizon
                {playerSeaArmies.length > 0
                  ? ` · ${playerSeaArmies.length} Filo`
                  : ''}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onStartBatchMarch && (
                <button
                  type="button"
                  data-testid="outliner-batch-march-btn"
                  onClick={() => {
                    sound.playClick();
                    setIsOpen(false);
                    onStartBatchMarch();
                  }}
                  className="px-2 py-1 rounded-lg bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/55 text-[#f3ead7] text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  Toplu Sevk
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setIsOpen(false);
                  onSetActiveTab('MILITARY');
                }}
                className="px-2 py-1 rounded-lg bg-[#caa15a]/20 hover:bg-[#caa15a]/35 border border-[#caa15a]/50 text-[#e0b86e] text-[10px] font-bold shrink-0 cursor-pointer"
              >
                Ordu Bas →
              </button>
            </div>
          </div>

          {/* AI Commander & Stance Controls */}
          {(onToggleAiCommander || onSetAiCommanderStance) && (
            <div className="p-1.5 rounded-lg bg-black/50 border border-[#caa15a]/25 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bot
                    className={`w-3.5 h-3.5 shrink-0 ${
                      aiCommanderEnabled ? 'text-emerald-400' : 'text-[#e0b86e]'
                    }`}
                  />
                  <span className="text-[10px] font-bold text-[#f3ead7] truncate">
                    YZ Cephe Komutanı
                  </span>
                </div>
                {onToggleAiCommander && (
                  <button
                    type="button"
                    data-testid="outliner-ai-toggle-btn"
                    onClick={onToggleAiCommander}
                    aria-pressed={aiCommanderEnabled}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      aiCommanderEnabled
                        ? 'bg-emerald-500 text-[#14100c] border-emerald-300'
                        : 'bg-[#1b1510] hover:bg-[#261e16] text-[#d8cbb5] border-[#3a2f22]'
                    }`}
                  >
                    {aiCommanderEnabled ? 'Açık' : 'Kapalı'}
                  </button>
                )}
              </div>

              {onSetAiCommanderStance && (
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'BALANCED', label: 'Dengeli' },
                      { id: 'AGGRESSIVE', label: 'Taarruz' },
                      { id: 'DEFENSIVE', label: 'Savunma' },
                    ] as const
                  ).map((st) => {
                    const active = aiCommanderStance === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        data-testid={`outliner-ai-stance-${st.id.toLowerCase()}`}
                        aria-pressed={active}
                        onClick={() => onSetAiCommanderStance(st.id)}
                        className={`py-1 px-1.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7]'
                            : 'bg-[#1b1510] hover:bg-[#261e16] text-[#d8cbb5] border-[#3a2f22]'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

            {/* Section 0: Live On-Map Battles */}
            {relevantBattles.length > 0 && (
              <div>
                <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-[#e0b86e] flex items-center gap-1">
                  <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
                  <span>SÜREN MUHAREBELER ({relevantBattles.length})</span>
                </div>
                <div className="space-y-1.5 mt-1.5">
                  {relevantBattles.map((btl) => {
                    const terrName =
                      territories[btl.territoryId]?.name.replace(/^★\s*/, '') ||
                      btl.territoryId;
                    const total = Math.max(
                      1,
                      btl.attackerTroops + btl.defenderTroops
                    );
                    const attPct = Math.round((btl.attackerTroops / total) * 100);
                    return (
                      <button
                        key={btl.id}
                        onClick={() => {
                          sound.playSelectTerritory();
                          setIsOpen(false);
                          onSelectTerritory(btl.territoryId);
                        }}
                        className="w-full p-2 rounded-lg bg-[#241c13]/75 border border-[#caa15a]/55 text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#f3ead7]">
                          <span className="truncate flex items-center gap-1">
                            <AoH3GlyphSvg name="sword" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            <span className="truncate">{terrName}</span>
                          </span>
                          <span className="font-mono-num text-[10px] text-[#e0b86e]">
                            {(btl.attackerTroops / 1000).toFixed(1)}B vs{' '}
                            {(btl.defenderTroops / 1000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="mt-1 w-full h-1.5 rounded-full bg-[#caa15a] overflow-hidden">
                          <div
                            className="h-full bg-rose-600"
                            style={{ width: `${attPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: Marching Armies */}
            {relevantMovements.length > 0 && (
              <div>
                <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-[#e0b86e]">
                  HAREKET HALİNDEKİ ORDULAR ({relevantMovements.length})
                </div>
                <div className="space-y-1.5 mt-1.5">
                  {relevantMovements.map((mv) => {
                    const isOwn = mv.ownerId === playerNationId;
                    const fromName =
                      territories[mv.fromTerritoryId]?.name.replace(/^★\s*/, '') ||
                      (mv.fromCoords ? 'Deniz Filosu' : mv.fromTerritoryId);
                    const toName = mv.toCoords
                      ? mv.targetSeaName || 'Açık Deniz'
                      : territories[mv.toTerritoryId]?.name.replace(/^★\s*/, '') ||
                        mv.toTerritoryId;
                    return (
                      <button
                        key={mv.id}
                        onClick={() => {
                          sound.playSelectTerritory();
                          setIsOpen(false);
                          if (!mv.toCoords && territories[mv.toTerritoryId]) {
                            onSelectTerritory(mv.toTerritoryId);
                          } else if (
                            mv.targetSeaArmyId &&
                            onSelectSeaArmy &&
                            seaArmies.some((s) => s.id === mv.targetSeaArmyId)
                          ) {
                            onSelectSeaArmy(mv.targetSeaArmyId);
                          } else if (territories[mv.fromTerritoryId]) {
                            onSelectTerritory(mv.fromTerritoryId);
                          }
                        }}
                        className={`w-full p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isOwn
                            ? 'bg-black/55 border-[#caa15a]/40 hover:border-[#e0b86e]'
                            : 'bg-rose-950/50 border-rose-500/60 hover:border-rose-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-bold flex items-center gap-1 truncate ${
                              isOwn ? 'text-[#f3ead7]' : 'text-rose-300'
                            }`}
                          >
                            {mv.isNaval ? (
                              <Anchor className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            ) : (
                              <Navigation className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            )}
                            <span className="truncate">
                              {fromName} → {toName}
                            </span>
                          </span>
                          <span className="font-mono-num text-[10px] font-bold text-[#e0b86e] shrink-0">
                            {(mv.troops / 1000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="mt-1 w-full h-1.5 rounded-full bg-[#2a2117] overflow-hidden">
                          <div
                            className={`h-full ${
                              isOwn ? 'bg-[#e0b86e]' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, mv.progress)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1.5: Stationed Naval Fleets (SeaArmies) */}
            {playerSeaArmies.length > 0 && (
              <div>
                <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-[#e0b86e] flex items-center justify-between">
                  <span>DENİZ FİLOLARIMIZ ({playerSeaArmies.length})</span>
                  <span className="text-[9px] text-[#c5b79e] font-normal">
                    Açık Deniz & Abluka
                  </span>
                </div>
                <div className="space-y-1 mt-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {playerSeaArmies.map((fleet) => {
                    const isSelected = fleet.id === selectedSeaArmyId;
                    const inf = fleet.units?.infantry ?? Math.round(fleet.troops * 0.7);
                    const arm = fleet.units?.armor ?? Math.round(fleet.troops * 0.2);
                    const sup = fleet.units?.airDrone ?? Math.max(0, fleet.troops - inf - arm);
                    const totalU = Math.max(1, inf + arm + sup);
                    const infPct = Math.round((inf / totalU) * 100);
                    const armPct = Math.round((arm / totalU) * 100);
                    return (
                      <div
                        key={fleet.id}
                        className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-[#caa15a]/20 border-[#e0b86e]'
                            : 'bg-black/45 border-[#caa15a]/25 hover:border-[#caa15a]/55'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            sound.playSelectTerritory();
                            setIsOpen(false);
                            onSelectSeaArmy?.(fleet.id);
                          }}
                          className="flex items-center gap-1.5 min-w-0 text-left flex-1 cursor-pointer"
                        >
                          <span className="w-5 h-5 rounded bg-[#1b1510] border border-[#caa15a]/45 flex items-center justify-center text-[#e0b86e] shrink-0">
                            <Anchor className="w-3 h-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-[#faf3e3] truncate">
                                {fleet.name}
                              </span>
                              <span className="text-[10px] font-mono-num font-extrabold text-[#e0b86e] shrink-0">
                                {(fleet.troops / 1000).toFixed(1)}B
                              </span>
                            </div>
                            <div className="mt-1 w-full h-1 rounded-full bg-[#4a3a26] overflow-hidden flex">
                              <div
                                className="h-full bg-[#e0b86e]"
                                style={{ width: `${infPct}%` }}
                              />
                              <div
                                className="h-full bg-[#b89146]"
                                style={{ width: `${armPct}%` }}
                              />
                            </div>
                          </div>
                        </button>
                        {onStartSeaArmyOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              sound.playClick();
                              setIsOpen(false);
                              onStartSeaArmyOrder(fleet.id);
                            }}
                            title="Bu Deniz Filosuna Kıyı Çıkarması veya Deniz Sevk Emri Ver"
                            className="px-2 py-1 rounded-md bg-[#caa15a] hover:bg-[#e0b86e] text-[#14100c] font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>Sevk</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: All Stationed Player Armies (AoH3 Army Roster) */}
            <div>
              <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-[#e0b86e] flex items-center justify-between">
                <span>KONUŞLU ORDULARIMIZ ({allPlayerArmies.length})</span>
                <span className="text-[9px] text-[#c5b79e] font-normal">
                  Piyade / Süvari / Topçu
                </span>
              </div>
              <div className="space-y-1 mt-1.5 max-h-56 overflow-y-auto pr-0.5">
                {allPlayerArmies.map((terr, idx) => {
                  const isSelected = terr.id === selectedTerritoryId;
                  const inf = terr.units?.infantry ?? Math.round(terr.garrison * 0.7);
                  const arm = terr.units?.armor ?? Math.round(terr.garrison * 0.2);
                  const sup = terr.units?.airDrone ?? Math.max(0, terr.garrison - inf - arm);
                  const totalU = Math.max(1, inf + arm + sup);
                  const infPct = Math.round((inf / totalU) * 100);
                  const armPct = Math.round((arm / totalU) * 100);
                  return (
                    <div
                      key={terr.id}
                      className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-[#caa15a]/20 border-[#e0b86e]'
                          : 'bg-black/45 border-[#caa15a]/20 hover:border-[#caa15a]/45'
                      }`}
                    >
                      <button
                        onClick={() => {
                          sound.playSelectTerritory();
                          onSelectTerritory(terr.id);
                        }}
                        className="flex items-center gap-1.5 min-w-0 text-left flex-1 cursor-pointer"
                      >
                        <span className="w-5 h-5 rounded bg-[#1b1510] border border-[#caa15a]/40 flex items-center justify-center text-[10px] font-mono-num font-bold text-[#e0b86e] shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-[#faf3e3] truncate">
                              {terr.name.replace(/^★\s*/, '')}
                            </span>
                            <span className="text-[10px] font-mono-num font-extrabold text-[#e0b86e] shrink-0">
                              {(terr.garrison / 1000).toFixed(1)}B
                            </span>
                          </div>
                          {/* Unit composition bar */}
                          <div className="mt-1 w-full h-1 rounded-full bg-[#4a3a26] overflow-hidden flex">
                            <div
                              className="h-full bg-[#e0b86e]"
                              style={{ width: `${infPct}%` }}
                            />
                            <div
                              className="h-full bg-[#b89146]"
                              style={{ width: `${armPct}%` }}
                            />
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          sound.playClick();
                          setIsOpen(false);
                          onSelectTerritory(terr.id);
                          onStartArmyOrder(terr.id);
                        }}
                        title="Bu Orduya Haritadan Hedef Seçerek Yürüyüş Emri Ver"
                        className="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Sevk</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        )}
      </aside>
  );
};
