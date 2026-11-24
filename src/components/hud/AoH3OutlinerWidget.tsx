import React, { useState, useMemo } from 'react';
import {
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
  Territory,
} from '../../types/game';
import { sound } from '../../utils/soundEngine';

import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { calculateWarPeaceBudget } from '../../engine/diplomacyAndWarActions';

interface AoH3OutlinerWidgetProps {
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  battles?: ActiveBattle[];
  movements: ArmyMovement[];
  selectedTerritoryId: string | null;
  aiCommanderEnabled?: boolean;
  aiCommanderStance?: AiCommanderStance;
  onSelectTerritory: (id: string) => void;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onStartArmyOrder: (id: string) => void;
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
              <span className="text-[11px] font-bold text-amber-400 drop-shadow">
                ⚔
              </span>
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
  selectedTerritoryId,
  aiCommanderEnabled = false,
  aiCommanderStance = 'BALANCED',
  onSelectTerritory,
  onSetActiveTab,
  onStartArmyOrder,
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

  const totalStandingArmy = useMemo(
    () =>
      allPlayerArmies.reduce((sum, t) => sum + (t.garrison || 0), 0) +
      relevantMovements
        .filter((m) => m.ownerId === playerNationId)
        .reduce((sum, m) => sum + (m.troops || 0), 0),
    [allPlayerArmies, relevantMovements, playerNationId]
  );

  return (
    <aside className="hud-outliner relative z-30 flex flex-col items-end pointer-events-none shrink-0">
      {/* AoH3 Ordularım (Army Roster Menu) Button */}
      <button
        data-testid="aoh3-army-roster-toggle"
        onClick={() => {
          sound.playClick();
          setIsOpen((prev) => !prev);
        }}
        className={`pointer-events-auto min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-xl border shadow-xl flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer ${
          relevantBattles.length > 0
            ? 'bg-amber-500 text-slate-950 border-amber-300'
            : isOpen
            ? 'bg-[#caa15a] text-[#14110e] border-[#f3ead7]'
            : 'bg-[#14110e]/95 border-[#caa15a]/55 text-[#f3ead7] hover:border-[#caa15a]'
        }`}
        title="Age of History 3 Ordu Menüsü (Tüm Ordular, Yürüyüşler ve Hızlı Sevk)"
      >
        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="whitespace-nowrap">
          Ordular ({allPlayerArmies.length})
        </span>
        <span className="px-1 sm:px-1.5 py-0.2 rounded bg-black/45 border border-[#caa15a]/35 text-[9.5px] sm:text-[10px] font-mono-num text-amber-300">
          {(totalStandingArmy / 1000).toFixed(1)}B
        </span>
        {relevantMovements.length > 0 && (
          <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded bg-sky-500/25 border border-sky-400/50 text-[10px] font-mono-num text-sky-200">
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
        <div className="pointer-events-auto absolute right-0 top-full mt-1.5 w-[min(320px,calc(100vw-1rem))] max-h-[min(56vh,calc(100dvh-11rem))] overflow-y-auto rounded-xl bg-[#14110e]/98 border border-[#caa15a]/65 shadow-2xl p-2.5 space-y-2.5 text-xs text-[#f3ead7] z-40">
          {/* Header Summary */}
          <div className="flex items-center justify-between gap-2 px-1 pb-1.5 border-b border-[#caa15a]/25">
            <div className="min-w-0">
              <div className="text-[11px] font-display font-bold text-amber-300 truncate">
                ORDULARIM
              </div>
              <div className="text-[10px] text-[#c5b79e] truncate">
                Toplam: {(totalStandingArmy / 1000).toFixed(1)}B Asker · {allPlayerArmies.length} Garnizon
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
                  className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/55 text-sky-200 text-[10px] font-bold shrink-0 cursor-pointer"
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
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[10px] font-bold shrink-0 cursor-pointer"
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
                      aiCommanderEnabled ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span className="text-[10px] font-bold text-amber-100 truncate">
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
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
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
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
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
                <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-amber-300">
                  ⚔️ SÜREN MUHAREBELER ({relevantBattles.length})
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
                        className="w-full p-2 rounded-lg bg-amber-950/50 border border-amber-500/60 text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-200">
                          <span className="truncate">⚔️ {terrName}</span>
                          <span className="font-mono-num text-[10px]">
                            {(btl.attackerTroops / 1000).toFixed(1)}B vs{' '}
                            {(btl.defenderTroops / 1000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="mt-1 w-full h-1.5 rounded-full bg-blue-600 overflow-hidden">
                          <div
                            className="h-full bg-rose-500"
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
                <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-sky-300">
                  HAREKET HALİNDEKİ ORDULAR ({relevantMovements.length})
                </div>
                <div className="space-y-1.5 mt-1.5">
                  {relevantMovements.map((mv) => {
                    const isOwn = mv.ownerId === playerNationId;
                    const fromName =
                      territories[mv.fromTerritoryId]?.name.replace(/^★\s*/, '') ||
                      mv.fromTerritoryId;
                    const toName =
                      territories[mv.toTerritoryId]?.name.replace(/^★\s*/, '') ||
                      mv.toTerritoryId;
                    return (
                      <button
                        key={mv.id}
                        onClick={() => {
                          sound.playSelectTerritory();
                          setIsOpen(false);
                          onSelectTerritory(mv.toTerritoryId);
                        }}
                        className={`w-full p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isOwn
                            ? 'bg-black/55 border-sky-500/40 hover:border-sky-400'
                            : 'bg-rose-950/50 border-rose-500/60 hover:border-rose-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-bold flex items-center gap-1 truncate ${
                              isOwn ? 'text-sky-300' : 'text-rose-300'
                            }`}
                          >
                            <Navigation className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {fromName} → {toName}
                            </span>
                          </span>
                          <span className="font-mono-num text-[10px] font-bold text-amber-300 shrink-0">
                            {(mv.troops / 1000).toFixed(1)}B
                          </span>
                        </div>
                        <div className="mt-1 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${
                              isOwn ? 'bg-sky-400' : 'bg-rose-500'
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

            {/* Section 2: All Stationed Player Armies (AoH3 Army Roster) */}
            <div>
              <div className="px-1 pb-1 border-b border-[#caa15a]/20 text-[10px] font-bold text-emerald-400 flex items-center justify-between">
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
                          ? 'bg-amber-500/20 border-amber-400'
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
                        <span className="w-5 h-5 rounded bg-emerald-950/90 border border-emerald-500/40 flex items-center justify-center text-[10px] font-mono-num font-bold text-emerald-300 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-white truncate">
                              {terr.name.replace(/^★\s*/, '')}
                            </span>
                            <span className="text-[10px] font-mono-num font-extrabold text-amber-300 shrink-0">
                              {(terr.garrison / 1000).toFixed(1)}B
                            </span>
                          </div>
                          {/* Unit composition bar */}
                          <div className="mt-1 w-full h-1 rounded-full bg-sky-500/70 overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${infPct}%` }}
                            />
                            <div
                              className="h-full bg-amber-400"
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
        )}
      </aside>
  );
};
