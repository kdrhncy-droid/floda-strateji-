import React, { useMemo, useRef, useState } from 'react';
import {
  Crown,
  Handshake,
  Landmark,
  Swords,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ActiveWar,
  AiCommanderStance,
  ArmyMovement,
  BottomDrawerTab,
  DiplomaticRelation,
  GameModeId,
  Nation,
  SeaArmy,
  Territory,
} from '../../types/game';
import {
  computeNationTechMetrics,
  IDEOLOGIES,
} from '../../data/world2026Data';
import { buildNationDiplomacySummary } from '../../engine/nationDiplomacySummary';
import {
  calculateNationEconomy,
  computeNationEconomySummary,
  getOrCreateRelation,
  isAtWar,
} from '../../engine/simulationEngine';
import {
  EconomySourcesPopover,
  useLongPress,
} from '../common/EconomySourcesPopover';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from '../../engine/seasonSupplyAndAiProfile';
import { calculateVassalAnnexCost } from '../../engine/diplomacyAndWarActions';
import { computeWorldPowerRankings } from '../../engine/worldRankings';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';
import { cleanNationName, cleanProvinceName } from '../../utils/formatters';
import { DiplomaticActionType, PeaceDealType } from '../drawers/drawerTypes';
import { AoH3MenuBanner } from '../illustrations/AoH3Illustrations';
import { NationOverviewTab } from './diplomacy/NationOverviewTab';
import { NationRelationsWebTab } from './diplomacy/NationRelationsWebTab';
import { NationEconomyTab } from './diplomacy/NationEconomyTab';

type ModalTabId = 'OVERVIEW' | 'DIPLOMACY' | 'ECONOMY';

interface NationDiplomacyModalProps {
  isOpen: boolean;
  inspectedNationId: string | null;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  tick: number;
  gameMode: GameModeId;
  aiCommanderEnabled?: boolean;
  aiCommanderStance?: AiCommanderStance;
  isPlayerAtWar?: boolean;
  onToggleAiCommander?: () => void;
  onSetAiCommanderStance?: (stance: AiCommanderStance) => void;
  onClose: () => void;
  onSelectInspectedNation: (nationId: string) => void;
  onSelectTerritory: (territoryId: string) => void;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onDiplomaticAction: (
    targetNationId: string,
    action: DiplomaticActionType
  ) => void;
  onPeaceDeal: (warId: string, dealType: PeaceDealType) => void;
  onOpenWarModal?: (warId: string) => void;
  seaArmies?: SeaArmy[];
}

function computeMonthlyPopGrowthPct(
  nation: Nation,
  territories: Record<string, Territory>
): number {
  const owned = Object.values(territories).filter(
    (t) => t && t.ownerId === nation.id
  );
  if (owned.length === 0) return 0;

  const unlocked = nation.unlockedTechs || [];
  const popTechMult =
    1 +
    (unlocked.includes('eco_1b') ? 0.25 : 0) +
    (unlocked.includes('sci_1b') ? 0.3 : 0);

  let totalPop = 0;
  let totalDailyGrowth = 0;

  for (const t of owned) {
    const pop = Math.max(0, t.population || 0);
    const buildings = t.buildings || {};
    const unrestFactor = Math.max(0.25, 1 - (t.unrest || 0) / 140);
    const dailyRate =
      (0.00035 * unrestFactor +
        (buildings.supplyDepot || 0) * 0.00008 +
        (buildings.granary || 0) * 0.00018) *
      popTechMult;
    totalPop += pop;
    totalDailyGrowth += pop * dailyRate;
  }

  if (totalPop <= 0) return 0;
  return Number((((totalDailyGrowth / totalPop) * 30) * 100).toFixed(2));
}

export const NationDiplomacyModal: React.FC<NationDiplomacyModalProps> = ({
  isOpen,
  inspectedNationId,
  playerNationId,
  nations,
  territories,
  relations,
  wars,
  movements,
  tick,
  gameMode,
  aiCommanderEnabled = false,
  aiCommanderStance = 'BALANCED',
  isPlayerAtWar = false,
  onToggleAiCommander,
  onSetAiCommanderStance,
  onClose,
  onSelectInspectedNation,
  onSelectTerritory,
  onDiplomaticAction,
  onPeaceDeal,
  onOpenWarModal,
  seaArmies = [],
}) => {
  const dialogRef = useAccessibleDialog(isOpen, onClose);
  const modalBackdropPressedRef = useRef(false);
  const [modalTab, setModalTab] = useState<ModalTabId>('OVERVIEW');
  const [showEconomyPopover, setShowEconomyPopover] = useState(false);
  const economyLongPress = useLongPress(() => {
    sound.playClick();
    setShowEconomyPopover(true);
  });
  const targetId = inspectedNationId || playerNationId;

  const summary = useMemo(
    () =>
      isOpen
        ? buildNationDiplomacySummary({
            targetNationId: targetId,
            nations,
            territories,
            relations,
            wars,
            movements,
            tick,
            gameMode,
          })
        : null,
    [isOpen, targetId, nations, territories, relations, wars, movements, tick, gameMode]
  );

  const { livingNations, worldRankings } = useMemo(() => {
    const provCount: Record<string, number> = {};
    for (const t of Object.values(territories)) {
      if (!t?.ownerId) continue;
      provCount[t.ownerId] = (provCount[t.ownerId] || 0) + 1;
    }

    const alive = Object.values(nations).filter(
      (n) => n && !n.isEliminated && (provCount[n.id] || 0) > 0
    );

    const ranked = computeWorldPowerRankings(
      nations,
      territories,
      movements,
      gameMode,
      'SCORE'
    );

    const sortedSelect = [...alive].sort((a, b) => {
      if (a.id === playerNationId) return -1;
      if (b.id === playerNationId) return 1;
      return (
        (provCount[b.id] || 0) - (provCount[a.id] || 0) ||
        a.name.localeCompare(b.name, 'tr')
      );
    });

    return { livingNations: sortedSelect, worldRankings: ranked };
  }, [nations, territories, movements, gameMode, playerNationId]);

  if (!isOpen || !summary) return null;

  const isPlayerNation = summary.nation.id === playerNationId;
  const cleanName = cleanNationName(summary.nation.name);

  const econ = calculateNationEconomy(
    summary.nation,
    territories,
    nations,
    relations,
    movements,
    wars,
    gameMode,
    seaArmies
  );
  const economySummary = computeNationEconomySummary(summary.nation, territories);
  const techMetrics = computeNationTechMetrics(
    summary.nation,
    territories,
    gameMode,
    econ.dailyResearch
  );
  const monthlyPopGrowthPct = computeMonthlyPopGrowthPct(
    summary.nation,
    territories
  );

  const capitalTerritory =
    territories[summary.nation.capitalTerritoryId || summary.nation.id] ||
    Object.values(territories).find((t) => t.ownerId === summary.nation.id);
  const capitalName = cleanProvinceName(capitalTerritory?.name) || '—';

  const techCount = (summary.nation.unlockedTechs || []).length;
  const popLabel =
    econ.totalPopulation >= 1000
      ? `${(econ.totalPopulation / 1000).toFixed(1)}M`
      : `${Math.round(econ.totalPopulation)}B`;
  const netGoldLabel =
    econ.netDailyGold >= 0
      ? `+${econ.netDailyGold.toFixed(1)}`
      : econ.netDailyGold.toFixed(1);
  const grossDailyIncome =
    econ.taxIncome +
    econ.productionIncome +
    econ.tradeIncome +
    econ.straitTollIncome +
    econ.caravanTradeIncome +
    econ.vassalIncome +
    econ.seizedBlockadeIncome;
  const totalDailyExpense =
    econ.militaryUpkeep +
    econ.vassalTributeOut +
    econ.blockadePenaltyLoss +
    econ.inflationPenalty;

  const rankIndex = worldRankings.findIndex(
    (r) => r.nation.id === summary.nation.id
  );
  const worldRank = rankIndex >= 0 ? rankIndex + 1 : livingNations.length;

  const playerRel = !isPlayerNation
    ? getOrCreateRelation(relations, playerNationId, summary.nation.id)
    : null;
  const activePlayerWar = !isPlayerNation
    ? isAtWar(wars, playerNationId, summary.nation.id)
    : undefined;
  const inspectedPersonalityMeta = !isPlayerNation
    ? AI_PERSONALITY_META[resolveNationAiPersonality(summary.nation, territories)]
    : null;
  const vassalAnnexCost = !isPlayerNation
    ? calculateVassalAnnexCost(summary.nation.id, territories)
    : 0;

  let warBlockReason: string | null = null;
  if (!isPlayerNation && !activePlayerWar && playerRel) {
    if (playerRel.isAllied || playerRel.allianceType) {
      warBlockReason =
        'Müttefik ülkeye savaş açılamaz (önce ittifakı feshedin).';
    } else if (playerRel.hasNonAggression) {
      warBlockReason = 'Saldırmazlık paktı aktif (önce paktı iptal edin).';
    } else if (playerRel.truceUntilTick > tick) {
      warBlockReason = `Ateşkes sürüyor (${Math.max(
        1,
        playerRel.truceUntilTick - tick
      )} gün kaldı).`;
    } else if (playerRel.score > -30) {
      warBlockReason = `İlişki ${
        playerRel.score > 0 ? `+${playerRel.score}` : playerRel.score
      } (savaş için -30 veya altı gerekir).`;
    }
  }

  const focusNationCapital = () => {
    if (capitalTerritory) {
      sound.playClick();
      onSelectTerritory(capitalTerritory.id);
      onClose();
    }
  };

  const totalActiveDiplomacyCount =
    summary.activeWars.length +
    summary.offensiveAllies.length +
    summary.defensivePacts.length +
    summary.tradePartners.length +
    summary.nonAggressionPacts.length +
    summary.activeTruces.length +
    summary.vassals.length;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 overscroll-contain"
        onPointerDown={(e) => {
          modalBackdropPressedRef.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (modalBackdropPressedRef.current && e.target === e.currentTarget) {
            onClose();
          }
          modalBackdropPressedRef.current = false;
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nation-diplomacy-modal-title"
          tabIndex={-1}
          className="w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#17130f] border border-[#c89d54]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f0e6d2]"
        >
          {/* Slim Phone-Friendly Header */}
          <div className="px-3 sm:px-5 py-2.5 bg-[#120f0c] border-b border-[#c89d54]/30 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-lg p-0.5 bg-[#241d15] border border-[#c89d54]/45 shrink-0">
                  <NationFlagCanvasBadge
                    nationId={summary.nation.id}
                    flagCode={summary.nation.flagCode}
                    color={summary.nation.color}
                    width={42}
                    height={28}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2
                      id="nation-diplomacy-modal-title"
                      className="font-display font-bold text-sm sm:text-base text-[#f6ecd7] truncate"
                    >
                      {cleanName}
                    </h2>
                    {isPlayerNation ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#c89d54] text-[#110f0d] text-[10px] font-black tracking-wide">
                        DEVLETİNİZ
                      </span>
                    ) : activePlayerWar ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold inline-flex items-center gap-1">
                        <Swords className="w-3 h-3" />
                        <span>SAVAŞTA</span>
                      </span>
                    ) : playerRel ? (
                      <span
                        className={`px-1.5 py-0.5 rounded-md border font-mono-num text-[10px] font-bold ${
                          playerRel.score >= 25
                            ? 'bg-[#211a11] border-[#e0b86e]/50 text-[#e0b86e]'
                            : playerRel.score <= -25
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                            : 'bg-[#221c15] border-[#42382b] text-[#cfc3ae]'
                        }`}
                      >
                        İlişki{' '}
                        {playerRel.score > 0
                          ? `+${playerRel.score}`
                          : playerRel.score}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-[11px] text-[#cfc3ae] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="text-[#e0bc78] font-semibold inline-flex items-center gap-1">
                      <Crown className="w-3 h-3 text-[#c89d54] shrink-0" />
                      <span className="truncate max-w-[140px] sm:max-w-none">
                        {summary.rulerName}
                      </span>
                    </span>
                    <span className="text-[#5d5243]">·</span>
                    <span>
                      {IDEOLOGIES[summary.nation.ideology]?.name ?? 'Monarşi'}
                    </span>
                    {inspectedPersonalityMeta && (
                      <>
                        <span className="text-[#5d5243]">·</span>
                        <span
                          className="text-[#e0b86e] font-semibold"
                          title={inspectedPersonalityMeta.description}
                          data-testid="modal-ai-personality"
                        >
                          {inspectedPersonalityMeta.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!isPlayerNation && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onSelectInspectedNation(playerNationId);
                    }}
                    className="min-h-[38px] px-2.5 rounded-xl bg-[#241c13] hover:bg-[#312619] border border-[#caa15a]/50 text-[#e0b86e] text-[11px] font-bold cursor-pointer whitespace-nowrap"
                  >
                    Ülkem
                  </button>
                )}

                <select
                  aria-label="İncelenecek ülkeyi seçin"
                  value={summary.nation.id}
                  onChange={(e) => {
                    sound.playClick();
                    onSelectInspectedNation(e.target.value);
                  }}
                  className="hidden sm:block max-w-[190px] min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#211c16] border border-[#c89d54]/35 text-xs text-[#f3ead7] font-semibold focus:outline-none focus:border-[#e0bc78]"
                >
                  {livingNations.map((nat) => (
                    <option key={nat.id} value={nat.id}>
                      {nat.id === playerNationId ? '[Devletim] ' : ''}
                      {cleanNationName(nat.name)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onClose();
                  }}
                  aria-label="Ülke penceresini kapat"
                  className="w-10 h-10 rounded-xl bg-[#211c16] hover:bg-[#2c251d] border border-[#42382b] flex items-center justify-center text-[#cfc3ae] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile-only full-width Nation Switcher + Segmented Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <select
                aria-label="Başka ülke seçin"
                value={summary.nation.id}
                onChange={(e) => {
                  sound.playClick();
                  onSelectInspectedNation(e.target.value);
                }}
                className="sm:hidden w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#211c16] border border-[#c89d54]/35 text-xs text-[#f3ead7] font-semibold focus:outline-none focus:border-[#e0bc78]"
              >
                {livingNations.map((nat) => (
                  <option key={nat.id} value={nat.id}>
                    {nat.id === playerNationId ? '[Devletim] ' : ''}
                    {cleanNationName(nat.name)}
                  </option>
                ))}
              </select>

              <div
                role="tablist"
                aria-label="Ülke inceleme sekmeleri"
                className="grid grid-cols-3 gap-1 w-full bg-[#1d1813] p-1 rounded-xl border border-[#342d24]"
              >
                {(
                  [
                    {
                      id: 'OVERVIEW',
                      shortLabel: 'Özet',
                      label: isPlayerNation
                        ? 'Özet & Paktlar'
                        : 'Özet & Eylemler',
                      icon: <Landmark className="w-3.5 h-3.5 shrink-0" />,
                    },
                    {
                      id: 'DIPLOMACY',
                      shortLabel: `İlişki (${totalActiveDiplomacyCount})`,
                      label: `İlişki Ağı (${totalActiveDiplomacyCount})`,
                      icon: <Handshake className="w-3.5 h-3.5 shrink-0" />,
                    },
                    {
                      id: 'ECONOMY',
                      shortLabel: 'Ekonomi',
                      label: 'Ekonomi & Bilim',
                      icon: <TrendingUp className="w-3.5 h-3.5 shrink-0" />,
                    },
                  ] as const
                ).map((tab) => {
                  const active = modalTab === tab.id;
                  const isEconomyTab = tab.id === 'ECONOMY';
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={`modal-tab-${tab.id.toLowerCase()}`}
                      onPointerDown={
                        isEconomyTab ? economyLongPress.onPointerDown : undefined
                      }
                      onPointerUp={
                        isEconomyTab ? economyLongPress.onPointerUp : undefined
                      }
                      onPointerLeave={
                        isEconomyTab
                          ? economyLongPress.onPointerLeave
                          : undefined
                      }
                      onPointerCancel={
                        isEconomyTab
                          ? economyLongPress.onPointerCancel
                          : undefined
                      }
                      onClick={() => {
                        if (
                          isEconomyTab &&
                          economyLongPress.consumeLongPressFlag()
                        ) {
                          return;
                        }
                        sound.playClick();
                        setModalTab(tab.id);
                      }}
                      title={
                        isEconomyTab
                          ? 'Ekonomi kaynakları için basılı tutabilirsiniz'
                          : undefined
                      }
                      className={`min-h-[38px] px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer select-none ${
                        active
                          ? 'bg-[#c89d54] text-[#14100c] shadow'
                          : 'text-[#cfc3ae] hover:text-white hover:bg-[#272019]'
                      }`}
                    >
                      {tab.icon}
                      <span className="sm:hidden truncate">
                        {tab.shortLabel}
                      </span>
                      <span className="hidden sm:inline truncate">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Single Unified Scrollable Body */}
          <div className="p-3 sm:p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
            <AoH3MenuBanner
              artKey={activePlayerWar ? 'FORTRESS' : 'COURT'}
              branch={activePlayerWar ? 'MILITARY' : 'ADMINISTRATION'}
              icon={activePlayerWar ? 'sword' : 'crown'}
              title={`${cleanName} · ${summary.rulerName}`}
              subtitle={`${
                IDEOLOGIES[summary.nation.ideology]?.name ?? 'Monarşi'
              } · ${summary.provinceCount} Eyalet · #${worldRank} Güç Sırası`}
              className="hidden sm:block h-16 [@media(max-height:500px)]:hidden"
            />

            {/* Overlord Banner if vassal */}
            {summary.overlord && (
              <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/50 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#e0b86e] font-semibold flex items-center gap-1.5 min-w-0">
                  <Crown className="w-4 h-4 text-[#e0b86e] shrink-0" />
                  <span className="truncate">
                    Hami:{' '}
                    <strong className="text-[#f3ead7]">
                      {cleanNationName(summary.overlord.name)}
                    </strong>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onSelectInspectedNation(summary.overlord!.id);
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#251d14] hover:bg-[#31261a] border border-[#caa15a]/50 text-[#e0b86e] text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  İncele
                </button>
              </div>
            )}

            {modalTab === 'OVERVIEW' && (
              <NationOverviewTab
                summary={summary}
                isPlayerNation={isPlayerNation}
                playerNationId={playerNationId}
                nations={nations}
                wars={wars}
                tick={tick}
                gameMode={gameMode}
                econ={econ}
                economySummary={economySummary}
                techMetrics={techMetrics}
                monthlyPopGrowthPct={monthlyPopGrowthPct}
                capitalName={capitalName}
                techCount={techCount}
                popLabel={popLabel}
                netGoldLabel={netGoldLabel}
                grossDailyIncome={grossDailyIncome}
                totalDailyExpense={totalDailyExpense}
                worldRank={worldRank}
                livingNationsCount={livingNations.length}
                playerRel={playerRel}
                activePlayerWar={activePlayerWar}
                warBlockReason={warBlockReason}
                vassalAnnexCost={vassalAnnexCost}
                aiCommanderEnabled={aiCommanderEnabled}
                aiCommanderStance={aiCommanderStance}
                isPlayerAtWar={isPlayerAtWar}
                economyLongPress={economyLongPress}
                onToggleAiCommander={onToggleAiCommander}
                onSetAiCommanderStance={onSetAiCommanderStance}
                onSelectInspectedNation={onSelectInspectedNation}
                onFocusCapital={focusNationCapital}
                onOpenEconomyTab={() => setModalTab('ECONOMY')}
                onOpenDiplomacyTab={() => setModalTab('DIPLOMACY')}
                onDiplomaticAction={onDiplomaticAction}
                onPeaceDeal={onPeaceDeal}
                onOpenWarModal={onOpenWarModal}
                onClose={onClose}
              />
            )}

            {modalTab === 'DIPLOMACY' && (
              <NationRelationsWebTab
                summary={summary}
                onSelectInspectedNation={onSelectInspectedNation}
              />
            )}

            {modalTab === 'ECONOMY' && (
              <NationEconomyTab
                inspectedNation={summary.nation}
                isPlayerNation={isPlayerNation}
                econ={econ}
                economySummary={economySummary}
                techMetrics={techMetrics}
                monthlyPopGrowthPct={monthlyPopGrowthPct}
                techCount={techCount}
                netGoldLabel={netGoldLabel}
                grossDailyIncome={grossDailyIncome}
                totalDailyExpense={totalDailyExpense}
                worldRank={worldRank}
                worldRankings={worldRankings}
                economyLongPress={economyLongPress}
                onOpenEconomyPopover={() => setShowEconomyPopover(true)}
                onSelectInspectedNation={onSelectInspectedNation}
              />
            )}
          </div>
        </div>
      </div>

      <EconomySourcesPopover
        nation={showEconomyPopover ? summary.nation : null}
        territories={territories}
        onClose={() => setShowEconomyPopover(false)}
      />
    </>
  );
};
