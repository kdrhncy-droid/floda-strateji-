import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  Bot,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Flag,
  Flame,
  Handshake,
  Landmark,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
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
import {
  buildNationDiplomacySummary,
  DiplomacyPeerEntry,
} from '../../engine/nationDiplomacySummary';
import {
  calculateNationEconomy,
  computeNationEconomySummary,
  getOrCreateRelation,
  isAtWar,
} from '../../engine/simulationEngine';
import { EconomySourcesPopover, useLongPress } from '../common/EconomySourcesPopover';
import {
  AI_PERSONALITY_META,
  resolveNationAiPersonality,
} from '../../engine/seasonSupplyAndAiProfile';
import { calculateVassalAnnexCost } from '../../engine/diplomacyAndWarActions';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';
import {
  cleanNationName,
  cleanProvinceName,
  formatTroopsShort,
} from '../../utils/formatters';
import { DiplomaticActionType, PeaceDealType } from '../drawers/drawerTypes';
import { AoH3GlyphSvg, AoH3MenuBanner } from '../illustrations/AoH3Illustrations';

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

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  entries: DiplomacyPeerEntry[];
  accentClass: string;
  emptyText: string;
  onSelectNation: (nationId: string) => void;
  renderBadge?: (entry: DiplomacyPeerEntry) => React.ReactNode;
}

const DiplomacySectionCard: React.FC<SectionProps> = ({
  title,
  icon,
  entries,
  accentClass,
  emptyText,
  onSelectNation,
  renderBadge,
}) => {
  return (
    <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${accentClass}`}>
          {icon}
          <span>{title}</span>
        </div>
        <span className="font-mono-num text-[11px] font-bold text-[#b2a58f]">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-[#8e806a] italic">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => {
            const name = cleanNationName(entry.nation.name);
            return (
              <button
                key={entry.nation.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectNation(entry.nation.id);
                }}
                title={`${name} ülkesini incele`}
                className="group min-h-[36px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1e1a15] hover:bg-[#2a241d] border border-[#3a3228] hover:border-[#c89d54]/60 transition-colors text-left cursor-pointer"
              >
                <NationFlagCanvasBadge
                  nationId={entry.nation.id}
                  flagCode={entry.nation.flagCode}
                  color={entry.nation.color}
                  width={22}
                  height={15}
                />
                <span className="text-[11px] font-semibold text-[#f3ead7] group-hover:text-[#e0b86e] max-w-[130px] truncate">
                  {name}
                </span>
                {renderBadge ? (
                  renderBadge(entry)
                ) : (
                  <span
                    className={`font-mono-num text-[10px] font-bold ${
                      entry.relationScore >= 25
                        ? 'text-[#e0b86e]'
                        : entry.relationScore <= -25
                        ? 'text-rose-400'
                        : 'text-[#b8a990]'
                    }`}
                  >
                    {entry.relationScore > 0
                      ? `+${entry.relationScore}`
                      : entry.relationScore}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

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
    const armySum: Record<string, number> = {};
    const popSum: Record<string, number> = {};

    for (const t of Object.values(territories)) {
      if (!t?.ownerId) continue;
      provCount[t.ownerId] = (provCount[t.ownerId] || 0) + 1;
      armySum[t.ownerId] = (armySum[t.ownerId] || 0) + (t.garrison || 0);
      popSum[t.ownerId] = (popSum[t.ownerId] || 0) + (t.population || 0);
    }
    for (const mv of movements) {
      if (mv?.ownerId) {
        armySum[mv.ownerId] = (armySum[mv.ownerId] || 0) + (mv.troops || 0);
      }
    }

    const alive = Object.values(nations).filter(
      (n) => n && !n.isEliminated && (provCount[n.id] || 0) > 0
    );

    const ranked = [...alive]
      .map((n) => {
        const provs = provCount[n.id] || 0;
        const army = armySum[n.id] || 0;
        const pop = popSum[n.id] || 0;
        const techCount = (n.unlockedTechs || []).length;
        const score = Math.round(
          army / 500 + provs * 18 + pop / 250 + techCount * 20
        );
        return { nation: n, provs, army, pop, score };
      })
      .sort((a, b) => b.score - a.score);

    const sortedSelect = [...alive].sort((a, b) => {
      if (a.id === playerNationId) return -1;
      if (b.id === playerNationId) return 1;
      return (
        (provCount[b.id] || 0) - (provCount[a.id] || 0) ||
        a.name.localeCompare(b.name, 'tr')
      );
    });

    return { livingNations: sortedSelect, worldRankings: ranked };
  }, [nations, territories, movements, playerNationId]);

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
      warBlockReason = 'Müttefik ülkeye savaş açılamaz (önce ittifakı feshedin).';
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

  // Sections for Tab 2 (Diplomacy Web) — Unified Obsidian + Antique Gold (+ Crimson for War/Hostile)
  const diplomacyCards = [
    {
      key: 'wars',
      title: 'Aktif Savaşlar',
      icon: <Swords className="w-3.5 h-3.5 text-rose-400" />,
      entries: summary.activeWars,
      accentClass: 'text-rose-300',
      emptyText: 'Aktif savaş yok.',
      renderBadge: (entry: DiplomacyPeerEntry) => (
        <span
          className={`font-mono-num text-[10px] font-bold ${
            (entry.warScore || 0) >= 0 ? 'text-[#e0b86e]' : 'text-rose-300'
          }`}
        >
          {(entry.warScore || 0) > 0 ? `+${entry.warScore}` : entry.warScore}%
        </span>
      ),
    },
    {
      key: 'offensive',
      title: 'Saldırı Paktı & Tam İttifak',
      icon: <Swords className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.offensiveAllies,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Tam ittifak yok.',
    },
    {
      key: 'defensive',
      title: 'Savunma Paktları',
      icon: <Shield className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.defensivePacts,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Savunma paktı yok.',
    },
    {
      key: 'trade',
      title: 'Ticaret Anlaşmaları',
      icon: <Coins className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.tradePartners,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Ticaret anlaşması yok.',
    },
    {
      key: 'truce',
      title: 'Aktif Barış & Ateşkesler',
      icon: <Timer className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.activeTruces,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Aktif ateşkes yok.',
      renderBadge: (entry: DiplomacyPeerEntry) => (
        <span className="font-mono-num text-[10px] font-bold text-[#e0b86e]">
          {entry.truceDaysRemaining}g
        </span>
      ),
    },
    {
      key: 'nap',
      title: 'Saldırmazlık Paktları',
      icon: <Handshake className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.nonAggressionPacts,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Saldırmazlık paktı yok.',
    },
    {
      key: 'access',
      title: 'Askerî Geçiş İzinleri',
      icon: <Compass className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.militaryAccess,
      accentClass: 'text-[#d8cbb5]',
      emptyText: 'Askerî geçiş izni yok.',
    },
    {
      key: 'vassals',
      title: 'Vasal Devletler',
      icon: <Crown className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.vassals,
      accentClass: 'text-[#e0b86e]',
      emptyText: 'Bağlı vasal yok.',
    },
    {
      key: 'friendly',
      title: 'Dost Ülkeler (≥ +25)',
      icon: <Handshake className="w-3.5 h-3.5 text-[#e0b86e]" />,
      entries: summary.friendlyNations,
      accentClass: 'text-[#f3ead7]',
      emptyText: 'Dost ülke yok.',
    },
    {
      key: 'hostile',
      title: 'Hasım Ülkeler (≤ -25)',
      icon: <Ban className="w-3.5 h-3.5 text-rose-400" />,
      entries: summary.hostileNations,
      accentClass: 'text-rose-300',
      emptyText: 'Hasım ülke yok.',
    },
  ];

  const nonEmptyCards = diplomacyCards.filter((c) => c.entries.length > 0);
  const emptyCards = diplomacyCards.filter((c) => c.entries.length === 0);

  // Core diplomatic ties shown immediately on Overview tab
  const quickPactGroups = [
    {
      key: 'wars',
      label: 'Savaşta',
      colorClass: 'border-rose-500/45 bg-rose-950/35 text-rose-200',
      entries: summary.activeWars,
    },
    {
      key: 'offensive',
      label: 'Tam İttifak',
      colorClass: 'border-[#caa15a]/50 bg-[#1b1510] text-[#f3ead7]',
      entries: summary.offensiveAllies,
    },
    {
      key: 'defensive',
      label: 'Savunma Paktı',
      colorClass: 'border-[#caa15a]/45 bg-[#1b1510] text-[#f3ead7]',
      entries: summary.defensivePacts,
    },
    {
      key: 'trade',
      label: 'Ticaret',
      colorClass: 'border-[#caa15a]/45 bg-[#1b1510] text-[#e0b86e]',
      entries: summary.tradePartners,
    },
    {
      key: 'nap',
      label: 'Saldırmazlık',
      colorClass: 'border-[#caa15a]/35 bg-[#1b1510] text-[#d8cbb5]',
      entries: summary.nonAggressionPacts,
    },
    {
      key: 'vassals',
      label: 'Vasal',
      colorClass: 'border-[#caa15a]/50 bg-[#1b1510] text-[#e0b86e]',
      entries: summary.vassals,
    },
  ].filter((g) => g.entries.length > 0);

  const totalActiveDiplomacyCount =
    summary.activeWars.length +
    summary.offensiveAllies.length +
    summary.defensivePacts.length +
    summary.tradePartners.length +
    summary.nonAggressionPacts.length +
    summary.activeTruces.length +
    summary.vassals.length;

  const stabilityPct = Math.max(0, Math.min(100, Math.round(summary.nation.stability)));
  const stabilityBarColor =
    stabilityPct >= 40
      ? 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
      : 'bg-rose-500';
  const aePct = Math.max(
    0,
    Math.min(100, Math.round(summary.nation.aggressiveExpansion))
  );
  const techProgressPct = Math.max(
    4,
    Math.min(100, Math.round((techMetrics.techLevel / techMetrics.maxTechLevel) * 100))
  );

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
                      İlişki {playerRel.score > 0 ? `+${playerRel.score}` : playerRel.score}
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
                  <span>{IDEOLOGIES[summary.nation.ideology]?.name ?? 'Monarşi'}</span>
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
                    label: isPlayerNation ? 'Özet & Paktlar' : 'Özet & Eylemler',
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
                    onPointerDown={isEconomyTab ? economyLongPress.onPointerDown : undefined}
                    onPointerUp={isEconomyTab ? economyLongPress.onPointerUp : undefined}
                    onPointerLeave={isEconomyTab ? economyLongPress.onPointerLeave : undefined}
                    onPointerCancel={isEconomyTab ? economyLongPress.onPointerCancel : undefined}
                    onClick={() => {
                      if (isEconomyTab && economyLongPress.consumeLongPressFlag()) return;
                      sound.playClick();
                      setModalTab(tab.id);
                    }}
                    title={isEconomyTab ? 'Ekonomi kaynakları için basılı tutabilirsiniz' : undefined}
                    className={`min-h-[38px] px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer select-none ${
                      active
                        ? 'bg-[#c89d54] text-[#14100c] shadow'
                        : 'text-[#cfc3ae] hover:text-white hover:bg-[#272019]'
                    }`}
                  >
                    {tab.icon}
                    <span className="sm:hidden truncate">{tab.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Single Unified Scrollable Body (keeps portrait AND landscape phones roomy) */}
        <div className="p-3 sm:p-4 overflow-y-auto overscroll-contain flex-1 space-y-3">
          <AoH3MenuBanner
            artKey={activePlayerWar ? 'FORTRESS' : 'COURT'}
            branch={activePlayerWar ? 'MILITARY' : 'ADMINISTRATION'}
            icon={activePlayerWar ? 'sword' : 'crown'}
            title={`${cleanName} · ${summary.rulerName}`}
            subtitle={`${IDEOLOGIES[summary.nation.ideology]?.name ?? 'Monarşi'} · ${summary.provinceCount} Eyalet · #${worldRank} Güç Sırası`}
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
            <>
              {/* 8 Visual AoH3-Style National Telemetry Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Hazine & Günlük Net */}
                <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Coins className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Hazine</span>
                    </span>
                    <span
                      className={`font-mono-num font-bold ${
                        econ.netDailyGold >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {netGoldLabel}/g
                    </span>
                  </div>
                  <div className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none">
                    {Math.round(summary.nation.treasury).toLocaleString('tr-TR')}
                  </div>
                </div>

                {/* 2. İstikrar & Halk Düzeni */}
                <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Scale className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>İstikrar</span>
                    </span>
                    <span
                      className={`font-mono-num font-bold ${
                        aePct >= 50 ? 'text-rose-400' : 'text-[#b2a58f]'
                      }`}
                      title="Agresif Genişleme"
                    >
                      AE %{aePct}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono-num text-base font-extrabold text-[#f6ecd7] leading-none">
                      %{stabilityPct}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${stabilityBarColor}`}
                        style={{ width: `${stabilityPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Ordu & İnsan Gücü */}
                <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Swords className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Ordu</span>
                    </span>
                    <span className="font-mono-num text-[#d8cbb5] font-semibold">
                      +{econ.dailyManpower}/g
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-mono-num text-base font-extrabold text-[#e0bc78] leading-none">
                      {formatTroopsShort(summary.totalArmy)}
                    </span>
                    <span className="font-mono-num text-[10px] text-[#b2a58f]">
                      Rez: {formatTroopsShort(summary.nation.manpower)}
                    </span>
                  </div>
                </div>

                {/* 4. Nüfus & Büyüme Oranı */}
                <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
                  <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Nüfus</span>
                    </span>
                    <span className="font-mono-num font-bold text-[#e0b86e]">
                      +%{monthlyPopGrowthPct}/ay
                    </span>
                  </div>
                  <div className="font-mono-num text-base font-extrabold text-[#f6ecd7] leading-none">
                    {popLabel}
                  </div>
                </div>

                {/* 5. Teknoloji & Çağ */}
                <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <BookOpen className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Teknoloji</span>
                    </span>
                    <span className="font-mono-num font-bold text-[#e0b86e]">
                      {techCount} Tek
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono-num text-sm font-extrabold text-[#f6ecd7] leading-none">
                        Sv. {techMetrics.techLevel}
                      </span>
                      <span className="font-mono-num text-[10px] text-[#d8cbb5]">
                        +{techMetrics.monthlyTechGrowth}/ay
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] transition-all"
                        style={{ width: `${techProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Başkent & Toprak (Tıklayınca haritada odaklanır) */}
                <button
                  type="button"
                  onClick={focusNationCapital}
                  className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer"
                  title="Başkenti haritada göster"
                >
                  <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Başkent</span>
                    </span>
                    <span className="font-mono-num font-bold text-[#e0bc78]">
                      {summary.provinceCount} Eyalet
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-sm font-bold text-[#f6ecd7] truncate leading-tight">
                      {capitalName}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                  </div>
                </button>

                {/* 7. Ekonomi (Ülkem: Brüt Gelir/Gider · Diğer Ülkeler: Yalnızca Mevcut Ekonomi + Basılı Tut Kaynaklar) */}
                <button
                  type="button"
                  data-testid="modal-economy-tile"
                  onPointerDown={economyLongPress.onPointerDown}
                  onPointerUp={economyLongPress.onPointerUp}
                  onPointerLeave={economyLongPress.onPointerLeave}
                  onPointerCancel={economyLongPress.onPointerCancel}
                  onClick={() => {
                    if (economyLongPress.consumeLongPressFlag()) return;
                    sound.playClick();
                    setModalTab('ECONOMY');
                  }}
                  className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer select-none"
                  title="Ekonomi kaynakları ve yatırımlar için basılı tutun"
                >
                  <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <TrendingUp className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>{isPlayerNation ? 'Ekonomi' : 'Mevcut Ekonomi'}</span>
                    </span>
                    <span className="font-mono-num text-[#d8cbb5]">
                      {isPlayerNation
                        ? `Enf %${summary.nation.inflation.toFixed(1)}`
                        : 'Basılı tut'}
                    </span>
                  </div>
                  {isPlayerNation ? (
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="font-mono-num text-sm font-extrabold text-emerald-300 leading-none">
                        +{grossDailyIncome.toFixed(1)}/g
                      </span>
                      <span className="font-mono-num text-[10px] text-rose-300/90">
                        -{totalDailyExpense.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between w-full gap-1">
                      <span
                        data-testid="modal-foreign-economy-value"
                        className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none"
                      >
                        {economySummary.totalEconomy.toLocaleString('tr-TR')}
                      </span>
                      <span className="text-[9.5px] text-[#9b8e78]">Kaynaklar</span>
                    </div>
                  )}
                </button>

                {/* 8. Dünya Sıralaması & Prestij */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setModalTab('ECONOMY');
                  }}
                  className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer"
                  title="Dünya Güç Sıralaması"
                >
                  <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Trophy className="w-3.5 h-3.5 text-[#e0b86e]" />
                      <span>Güç Sırası</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[#e0b86e] font-mono-num">
                      <Sparkles className="w-3 h-3" />
                      {techMetrics.prestige}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between w-full">
                    <span className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none">
                      #{worldRank}
                    </span>
                    <span className="text-[10px] text-[#b2a58f] font-mono-num">
                      / {livingNations.length} Devlet
                    </span>
                  </div>
                </button>
              </div>

              {/* Koalisyon / Agresiflik & Savaş Yorgunluğu Göstergesi */}
              {(() => {
                const aeVal = Math.min(
                  100,
                  Math.max(0, Math.round(summary.nation.aggressiveExpansion || 0))
                );
                const weVal = Math.min(
                  100,
                  Math.max(0, Math.round(summary.nation.warExhaustion || 0))
                );
                const coalitionActive =
                  aeVal >= 100 ||
                  wars.some(
                    (w) =>
                      w.isCoalitionWar &&
                      (w.defenderId === summary.nation.id ||
                        w.defenders.includes(summary.nation.id))
                  );
                return (
                  <section
                    data-testid="nation-coalition-status"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    <div
                      className={`rounded-xl border p-2.5 space-y-1.5 ${
                        coalitionActive
                          ? 'bg-rose-950/50 border-rose-500/60'
                          : aeVal >= 75
                          ? 'bg-amber-950/35 border-amber-500/45'
                          : 'bg-[#120f0c] border-[#342d24]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[#e0bc78] inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="flag" className="w-3.5 h-3.5 text-rose-400" />
                          <span>Koalisyon &amp; Agresiflik</span>
                        </span>
                        <span
                          className={`font-mono-num font-extrabold ${
                            coalitionActive
                              ? 'text-rose-300'
                              : aeVal >= 75
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          {aeVal} / 100
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#0a0806] border border-[#3a3126] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            coalitionActive
                              ? 'bg-rose-500'
                              : aeVal >= 75
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${aeVal}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#b2a58f] leading-snug">
                        {coalitionActive
                          ? 'DÜNYA KOALİSYONU AKTİF! Agresiflik 100 eşiğine ulaştı.'
                          : aeVal >= 75
                          ? `Koalisyon tehlikesi yüksek! ${100 - aeVal} puan sonra tüm dünya savaş açar.`
                          : 'Agresiflik 100\'e ulaşırsa bütün dünya koalisyon kurup savaş açar.'}
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#120f0c] border border-[#342d24] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[#e0bc78] inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-amber-400" />
                          <span>Savaş Yorgunluğu</span>
                        </span>
                        <span
                          className={`font-mono-num font-extrabold ${
                            weVal >= 55
                              ? 'text-rose-300'
                              : weVal >= 25
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          %{weVal}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#0a0806] border border-[#3a3126] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            weVal >= 55
                              ? 'bg-rose-500'
                              : weVal >= 25
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${weVal}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#b2a58f] leading-snug">
                        {weVal > 0
                          ? `Vergi/Üretim -%${Math.round(weVal * 0.45)} · Ordu Morali -%${Math.round(weVal * 0.42)} · Bakım +%${Math.round(weVal * 0.7)}`
                          : 'Ülke dinç ve seferberliğe hazır. Uzun savaşlar ekonomiyi yıpratır.'}
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Clean Active Pacts & Wars Strip (Zero Empty-Box Clutter) */}
              <section className="rounded-xl bg-[#120f0c] border border-[#342d24] p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#e0bc78]">
                    <Handshake className="w-3.5 h-3.5 text-[#c89d54]" />
                    <span>Aktif Paktlar & Savaşlar</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-num font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/30 text-rose-300 inline-flex items-center gap-1">
                      <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
                      <span>{summary.activeWars.length}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#e0b86e] inline-flex items-center gap-1">
                      <AoH3GlyphSvg name="handshake" className="w-3 h-3 shrink-0" />
                      <span>{summary.offensiveAllies.length}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#d8cbb5] inline-flex items-center gap-1">
                      <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                      <span>{summary.defensivePacts.length}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#e0b86e] inline-flex items-center gap-1">
                      <AoH3GlyphSvg name="gold" className="w-3 h-3 shrink-0" />
                      <span>{summary.tradePartners.length}</span>
                    </span>
                  </div>
                </div>

                {quickPactGroups.length === 0 ? (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#9b8e78] bg-[#1a1611] rounded-lg px-3 py-2 border border-[#2d261e]">
                    <span>Henüz aktif savaş, ittifak veya pakt bulunmuyor.</span>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setModalTab('DIPLOMACY');
                      }}
                      className="text-[#e0b86e] font-bold hover:underline shrink-0 cursor-pointer"
                    >
                      İlişkiler →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quickPactGroups.map((grp) => (
                      <div key={grp.key} className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#a69881]">
                          {grp.label} ({grp.entries.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {grp.entries.map((entry) => {
                            const entryName = cleanNationName(entry.nation.name);
                            return (
                              <button
                                key={entry.nation.id}
                                type="button"
                                onClick={() => {
                                  sound.playClick();
                                  onSelectInspectedNation(entry.nation.id);
                                }}
                                className={`min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-left transition-colors cursor-pointer ${grp.colorClass}`}
                              >
                                <NationFlagCanvasBadge
                                  nationId={entry.nation.id}
                                  flagCode={entry.nation.flagCode}
                                  color={entry.nation.color}
                                  width={22}
                                  height={15}
                                />
                                <span className="text-[11px] font-bold max-w-[130px] truncate">
                                  {entryName}
                                </span>
                                {grp.key === 'wars' ? (
                                  <span className="font-mono-num text-[10px] font-extrabold">
                                    {(entry.warScore || 0) > 0
                                      ? `+${entry.warScore}`
                                      : entry.warScore}
                                    %
                                  </span>
                                ) : (
                                  <span className="font-mono-num text-[10px] opacity-85">
                                    {entry.relationScore > 0
                                      ? `+${entry.relationScore}`
                                      : entry.relationScore}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Player Controls OR Grouped Foreign Diplomatic Actions */}
              {isPlayerNation ? (
                <section className="rounded-xl bg-[#120f0c] border border-[#c89d54]/30 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bot
                        className={`w-4 h-4 ${
                          aiCommanderEnabled
                            ? 'text-[#e0b86e]'
                            : 'text-[#c89d54]'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold text-[#f6ecd7]">
                          Otomatik Ordu Komutanı (YZ)
                        </div>
                        <div className="text-[10px] text-[#9b8e78]">
                          Açıkken ordularınızı otomatik yönetir ve savunur
                        </div>
                      </div>
                    </div>

                    {onToggleAiCommander && (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onToggleAiCommander();
                        }}
                        aria-pressed={aiCommanderEnabled}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          aiCommanderEnabled
                            ? 'border-[#e0b86e] bg-[#251d13] text-[#e0b86e]'
                            : 'border-[#c89d54]/45 bg-[#211d18] hover:bg-[#2b251e] text-[#f0e6d2]'
                        }`}
                      >
                        <span>
                          {aiCommanderEnabled
                            ? isPlayerAtWar
                              ? 'Açık · Durdur'
                              : 'Hazır · Kapat'
                            : 'Komutayı Devret'}
                        </span>
                      </button>
                    )}
                  </div>

                  {onSetAiCommanderStance && (
                    <div className="grid grid-cols-3 gap-1.5 bg-[#1b1611] border border-[#2f2820] rounded-xl p-1">
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
                            aria-pressed={active}
                            onClick={() => {
                              sound.playClick();
                              onSetAiCommanderStance(st.id);
                            }}
                            className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              active
                                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                                : 'text-[#cfc3ae] hover:text-white hover:bg-[#272019]'
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-xl bg-[#120f0c] border border-[#c89d54]/30 p-3 space-y-2.5">
                  {warBlockReason && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#1d1710] border border-[#caa15a]/45 text-[11px] text-[#f3ead7]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                        <span className="leading-snug">{warBlockReason}</span>
                      </div>
                      {playerRel && playerRel.score > -30 && (
                        <button
                          type="button"
                          onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600/35 hover:bg-rose-600/55 border border-rose-400/50 text-rose-100 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Flame className="w-3 h-3" />
                          <span>Hakaret (-30)</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* AoH3-Style Icon + Short Label Diplomatic Actions Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {activePlayerWar ? (
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          if (onOpenWarModal) {
                            onClose();
                            onOpenWarModal(activePlayerWar.id);
                          } else {
                            onPeaceDeal(activePlayerWar.id, 'WHITE_PEACE');
                          }
                        }}
                        className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d] text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                      >
                        <Swords className="w-4 h-4 shrink-0" />
                        <span className="leading-tight truncate max-w-full">Barış Masası</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="modal-declare-war-btn"
                        onClick={() =>
                          onDiplomaticAction(summary.nation.id, 'DECLARE_WAR')
                        }
                        className={`min-h-[54px] px-2 py-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                          warBlockReason
                            ? 'bg-rose-950/75 border border-rose-500/40 text-rose-200 hover:bg-rose-900/80'
                            : 'bg-rose-700 hover:bg-rose-600 text-white shadow'
                        }`}
                      >
                        <Swords className="w-4 h-4 shrink-0" />
                        <span className="leading-tight truncate max-w-full">Savaş İlanı</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid="modal-improve-relations-btn"
                      onClick={() => onDiplomaticAction(summary.nation.id, 'IMPROVE')}
                      title="Diplomatik elçi gönder (+3/gün · 10 gün)"
                      className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#271f17] border border-[#caa15a]/40 text-[#f3ead7] text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <Handshake className="w-4 h-4 shrink-0 text-[#e0b86e]" />
                      <span className="leading-tight truncate max-w-full">+İlişki</span>
                      <span className="text-[9px] text-[#e0b86e] font-mono-num">+3/g · 10g</span>
                    </button>

                    <button
                      type="button"
                      data-testid="modal-damage-relations-btn"
                      onClick={() => onDiplomaticAction(summary.nation.id, 'DAMAGE')}
                      title="İlişki bozma elçisi gönder (-3/gün · 10 gün)"
                      className="min-h-[54px] px-2 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/55 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <TrendingDown className="w-4 h-4 shrink-0 text-rose-300" />
                      <span className="leading-tight truncate max-w-full">-İlişki</span>
                      <span className="text-[9px] text-rose-300 font-mono-num">-3/g · 10g</span>
                    </button>

                    <button
                      type="button"
                      data-testid="modal-insult-btn"
                      onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
                      title="Diplomatik hakaret (-30 ilişki · +1 prestij · 5 gün soğuma)"
                      className="min-h-[54px] px-2 py-1.5 rounded-xl bg-rose-950/45 hover:bg-rose-900/55 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <Flame className="w-4 h-4 shrink-0 text-rose-300" />
                      <span className="leading-tight truncate max-w-full">Hakaret Et</span>
                      <span className="text-[9px] text-rose-300 font-mono-num">
                        {(() => {
                          const lastTick =
                            nations[playerNationId]?.lastInsultTickByNation?.[
                              summary.nation.id
                            ];
                          const rem =
                            lastTick !== undefined ? Math.max(0, 5 - (tick - lastTick)) : 0;
                          return rem > 0 ? `${rem}g soğuma` : '-30 · 5g';
                        })()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDiplomaticAction(summary.nation.id, 'TRADE')}
                      className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        playerRel?.hasTradeAgreement
                          ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] border-[#e0b86e]'
                          : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
                      }`}
                    >
                      <Coins className={`w-4 h-4 shrink-0 ${playerRel?.hasTradeAgreement ? 'text-[#14100c]' : 'text-[#e0b86e]'}`} />
                      <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                        <span>Ticaret</span>
                        {playerRel?.hasTradeAgreement && (
                          <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="modal-offensive-pact-btn"
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'OFFENSIVE_PACT')
                      }
                      className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        playerRel?.allianceType === 'OFFENSIVE'
                          ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                          : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
                      }`}
                    >
                      <Swords className="w-4 h-4 shrink-0 text-[#e0b86e]" />
                      <span className="leading-tight truncate max-w-full">
                        {playerRel?.allianceType === 'OFFENSIVE' ? 'İttifak Feshi' : 'Tam İttifak'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'DEFENSIVE_PACT')
                      }
                      className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        playerRel?.allianceType === 'DEFENSIVE'
                          ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                          : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
                      }`}
                    >
                      <Shield className="w-4 h-4 shrink-0 text-[#e0b86e]" />
                      <span className="leading-tight truncate max-w-full">
                        {playerRel?.allianceType === 'DEFENSIVE' ? 'Savunma Feshi' : 'Savunma'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'NON_AGGRESSION')
                      }
                      className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        playerRel?.hasNonAggression
                          ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                          : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
                      }`}
                    >
                      <Timer className="w-4 h-4 shrink-0 text-[#e0b86e]" />
                      <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                        <span>{playerRel?.hasNonAggression ? 'Saldırmaz' : 'Saldırmazlık'}</span>
                        {playerRel?.hasNonAggression && (
                          <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'MILITARY_ACCESS')
                      }
                      className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                        playerRel?.hasMilitaryAccess
                          ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                          : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
                      }`}
                    >
                      <Compass className="w-4 h-4 shrink-0 text-[#e0b86e]" />
                      <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                        <span>{playerRel?.hasMilitaryAccess ? 'Geçiş' : 'Askerî Geçiş'}</span>
                        {playerRel?.hasMilitaryAccess && (
                          <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                        )}
                      </span>
                    </button>

                    {summary.nation.vassalOf === playerNationId ? (
                      <button
                        type="button"
                        data-testid="modal-annex-vassal-btn"
                        onClick={() =>
                          onDiplomaticAction(summary.nation.id, 'ANNEX_VASSAL')
                        }
                        title="Vasal devleti ilhak et (+20 İlişki gerekir)"
                        className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#e0b86e]/60 text-[#e0b86e] text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                      >
                        <Crown className="w-4 h-4 shrink-0" />
                        <span className="leading-tight truncate max-w-full">
                          İlhak ({vassalAnnexCost}A)
                        </span>
                      </button>
                    ) : !activePlayerWar ? (
                      <button
                        type="button"
                        data-testid="modal-ultimatum-vassal-btn"
                        onClick={() =>
                          onDiplomaticAction(summary.nation.id, 'ULTIMATUM_VASSAL')
                        }
                        title="20 DP · Vasallık ültimatomu gönder"
                        className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#271f17] border border-[#caa15a]/45 text-[#e0b86e] text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                      >
                        <Crown className="w-4 h-4 shrink-0" />
                        <span className="leading-tight truncate max-w-full">Vasallık</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={focusNationCapital}
                      className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#211c16] hover:bg-[#2c251d] border border-[#42382b] text-[#f0e6d2] text-[11px] font-semibold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-[#e0b86e] shrink-0" />
                      <span className="leading-tight truncate max-w-full">Harita</span>
                    </button>
                  </div>

                  {/* Covert Espionage Action Strip (AoH3 Compact 3-Column Grid) */}
                  <div className="pt-2 border-t border-[#c89d54]/20 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      data-testid={`diplo-spy-fort-${summary.nation.id}`}
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'ESPIONAGE_SABOTAGE_FORT')
                      }
                      title="Kale Sabotajı (25 DP · 220 Altın)"
                      className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#f3ead7] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1 truncate max-w-full">
                        <AoH3GlyphSvg name="fortress" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>Sur Sabotaj</span>
                      </span>
                      <span className="font-mono-num text-[9.5px] text-[#e0b86e]">220A</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`diplo-spy-revolt-${summary.nation.id}`}
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'ESPIONAGE_INCITE_REVOLT')
                      }
                      title="İsyan Kışkırt (30 DP · 260 Altın)"
                      className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#f3ead7] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1 truncate max-w-full">
                        <AoH3GlyphSvg name="revolt" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>İsyan Kışkırt</span>
                      </span>
                      <span className="font-mono-num text-[9.5px] text-[#e0b86e]">260A</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`diplo-spy-siphon-${summary.nation.id}`}
                      onClick={() =>
                        onDiplomaticAction(summary.nation.id, 'ESPIONAGE_SIPHON_TREASURY')
                      }
                      title="Hazine & Bilim Sızdır (20 DP · 150 Altın)"
                      className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#e0b86e] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1 truncate max-w-full">
                        <AoH3GlyphSvg name="scroll" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>Hazine Sızdır</span>
                      </span>
                      <span className="font-mono-num text-[9.5px] text-[#e0b86e]">150A</span>
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {modalTab === 'DIPLOMACY' && (
            <div className="space-y-3">
              {/* Conquered & Annexed Nations Ledger */}
              <section className="rounded-xl bg-amber-950/20 border border-amber-500/35 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Flag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fethedilen & İlhak Edilen Ülkeler</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#120f0c] border border-amber-500/30 font-mono-num text-[10px] font-bold text-amber-200">
                    {summary.conqueredNations.length}
                  </span>
                </div>
                {summary.conqueredNations.length === 0 ? (
                  <p className="text-[11px] text-[#9b8e78] italic">
                    Henüz başka bir devletten fethedilen toprak yok.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {summary.conqueredNations.map((item) => (
                      <div
                        key={item.nation.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1a1611] border border-amber-500/30"
                      >
                        <NationFlagCanvasBadge
                          nationId={item.nation.id}
                          flagCode={item.nation.flagCode}
                          color={item.nation.color}
                          width={22}
                          height={15}
                        />
                        <span className="text-[11px] font-bold text-amber-100 max-w-[140px] truncate">
                          {cleanNationName(item.nation.name)}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            item.isEliminated
                              ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-200 border border-amber-500/35'
                          }`}
                        >
                          {item.isEliminated
                            ? `İlhak (${item.capturedProvinceCount})`
                            : `+${item.capturedProvinceCount} Eyalet`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Non-empty diplomatic relations first */}
              {nonEmptyCards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {nonEmptyCards.map((card) => (
                    <DiplomacySectionCard
                      key={card.key}
                      title={card.title}
                      icon={card.icon}
                      entries={card.entries}
                      accentClass={card.accentClass}
                      emptyText={card.emptyText}
                      onSelectNation={onSelectInspectedNation}
                      renderBadge={card.renderBadge}
                    />
                  ))}
                </div>
              )}

              {summary.embargoes.length > 0 && (
                <DiplomacySectionCard
                  title="Ticaret Ambargoları"
                  icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
                  entries={summary.embargoes}
                  accentClass="text-rose-300"
                  emptyText="Aktif ambargo yok."
                  onSelectNation={onSelectInspectedNation}
                  renderBadge={(entry) => (
                    <span className="text-[10px] font-bold text-rose-300">
                      {entry.embargoDirection === 'MUTUAL'
                        ? 'Karşılıklı'
                        : entry.embargoDirection === 'OUTGOING'
                        ? 'Uyguluyor'
                        : 'Maruz'}
                    </span>
                  )}
                />
              )}

              {/* Empty Categories Collapsible Summary instead of 10 empty cards */}
              {emptyCards.length > 0 && (
                <details className="rounded-xl bg-[#13110e] border border-[#2d261e] p-2.5 text-xs">
                  <summary className="cursor-pointer font-semibold text-[#9b8e78] hover:text-[#cfc3ae] select-none flex items-center justify-between">
                    <span>Diğer Kategoriler ({emptyCards.length} boş)</span>
                    <span className="text-[10px] opacity-75">Göster / Gizle</span>
                  </summary>
                  <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {emptyCards.map((card) => (
                      <DiplomacySectionCard
                        key={card.key}
                        title={card.title}
                        icon={card.icon}
                        entries={card.entries}
                        accentClass={card.accentClass}
                        emptyText={card.emptyText}
                        onSelectNation={onSelectInspectedNation}
                        renderBadge={card.renderBadge}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {modalTab === 'ECONOMY' && (
            <div className="space-y-3">
              {/* Player: Full Daily Income/Expense Ledger · Foreign: ONLY Mevcut Ekonomi + Basılı Tut Kaynaklar */}
              {isPlayerNation ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 inline-flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Günlük Gelirler</span>
                      </span>
                      <span className="font-mono-num text-xs font-extrabold text-emerald-300">
                        +{grossDailyIncome.toFixed(1)} A/g
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { label: 'Vergi Geliri', val: econ.taxIncome },
                        { label: 'Üretim & Atölye', val: econ.productionIncome },
                        { label: 'Ticaret & Anlaşmalar', val: econ.tradeIncome },
                        { label: 'Boğaz & Kervan', val: econ.straitTollIncome + econ.caravanTradeIncome },
                        { label: 'Vasal & Abluka', val: econ.vassalIncome + econ.seizedBlockadeIncome },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#cfc3ae]">{row.label}</span>
                          <span className="font-mono-num font-bold text-emerald-200">
                            +{row.val.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 inline-flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" />
                        <span>Günlük Giderler &amp; Denge</span>
                      </span>
                      <span className="font-mono-num text-xs font-extrabold text-rose-300">
                        -{totalDailyExpense.toFixed(1)} A/g
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { label: 'Ordu Bakımı', val: econ.militaryUpkeep },
                        { label: 'Enflasyon Kaybı', val: econ.inflationPenalty },
                        { label: 'Ödenen Vasal Haracı', val: econ.vassalTributeOut },
                        { label: 'Abluka Kesintisi', val: econ.blockadePenaltyLoss },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-[11px]">
                          <span className="text-[#cfc3ae]">{row.label}</span>
                          <span className="font-mono-num font-bold text-rose-200">
                            -{row.val.toFixed(1)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-1.5 border-t border-[#2d261e] flex items-center justify-between text-xs font-bold">
                        <span className="text-[#f0e6d2]">Günlük Net Kâr</span>
                        <span
                          className={`font-mono-num ${
                            econ.netDailyGold >= 0 ? 'text-emerald-300' : 'text-rose-400'
                          }`}
                        >
                          {netGoldLabel} A/gün
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <section
                  data-testid="foreign-current-economy-card"
                  className="rounded-xl bg-[#13110e] border border-[#caa15a]/40 p-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-[#e0b86e] flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      <span>Mevcut Ekonomi</span>
                    </div>
                    <div className="font-mono-num text-xl font-extrabold text-[#faf3e3] mt-0.5">
                      {economySummary.totalEconomy.toLocaleString('tr-TR')}
                    </div>
                    <div className="text-[11px] text-[#b2a58f] mt-0.5">
                      {economySummary.provinceCount} Eyalet · Ort. Yatırım ×
                      {economySummary.avgInvestmentMult.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="foreign-economy-sources-btn"
                    onPointerDown={economyLongPress.onPointerDown}
                    onPointerUp={economyLongPress.onPointerUp}
                    onPointerLeave={economyLongPress.onPointerLeave}
                    onPointerCancel={economyLongPress.onPointerCancel}
                    onClick={() => {
                      if (economyLongPress.consumeLongPressFlag()) return;
                      sound.playClick();
                      setShowEconomyPopover(true);
                    }}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#e0b86e]/55 text-xs font-bold text-[#e0b86e] flex flex-col items-end cursor-pointer select-none"
                  >
                    <span>Ekonomi Kaynaklarını Gör</span>
                    <span className="text-[10px] font-normal text-[#c5b79e]">
                      (Ekonomi butonuna basılı tutun)
                    </span>
                  </button>
                </section>
              )}

              {/* Tech, Population Growth & Infrastructure */}
              <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#e0b86e] inline-flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Bilim, Büyüme & Altyapı</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[#e0bc78]">
                    {techMetrics.eraLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
                    <div className="text-[10px] text-[#b2a58f]">Teknoloji Seviyesi</div>
                    <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                      {techMetrics.techLevel} / {techMetrics.maxTechLevel}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
                    <div className="text-[10px] text-[#b2a58f]">Günlük Araştırma</div>
                    <div className="font-mono-num text-xs font-bold text-[#f3ead7]">
                      +{econ.dailyResearch.toFixed(1)} AP
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
                    <div className="text-[10px] text-[#b2a58f]">Nüfus Büyümesi</div>
                    <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                      +%{monthlyPopGrowthPct} /ay
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
                    <div className="text-[10px] text-[#b2a58f]">Başkent Seviyesi</div>
                    <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                      Sv. {techMetrics.capitalLevel} · Saray {techMetrics.capitalPalaceLevel}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-[#cfc3ae]">
                  <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
                    <AoH3GlyphSvg name="book" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Okul:</span>
                    <strong className="text-[#f3ead7]">{techMetrics.schoolCount}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
                    <AoH3GlyphSvg name="crown" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Lise:</span>
                    <strong className="text-[#f3ead7]">{techMetrics.highSchoolCount}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
                    <AoH3GlyphSvg name="trophy" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Üniversite:</span>
                    <strong className="text-[#f3ead7]">{techMetrics.universityCount}</strong>
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
                    <AoH3GlyphSvg name="science" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Açık Teknoloji:</span>
                    <strong className="text-[#e0b86e]">{techCount}</strong>
                  </span>
                </div>
              </section>

              {/* Top 5 World Powers Comparison */}
              <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#e0b86e]">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Dünya Büyük Güçleri (İlk 5)</span>
                  </span>
                  <span className="font-mono-num text-[11px] text-[#cfc3ae]">
                    Seçili: #{worldRank}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {worldRankings.slice(0, 5).map((item, idx) => {
                    const isSelected = item.nation.id === summary.nation.id;
                    return (
                      <button
                        key={item.nation.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onSelectInspectedNation(item.nation.id);
                        }}
                        className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#251d14] border-[#e0b86e]/65 text-[#f3ead7]'
                            : 'bg-[#1a1611] hover:bg-[#241e18] border-[#2f2820] text-[#e5dac6]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono-num text-xs font-extrabold text-[#e0b86e] w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <NationFlagCanvasBadge
                            nationId={item.nation.id}
                            flagCode={item.nation.flagCode}
                            color={item.nation.color}
                            width={22}
                            height={15}
                          />
                          <span className="text-xs font-bold truncate">
                            {cleanNationName(item.nation.name)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono-num shrink-0">
                          <span className="text-[#cfc3ae]">{item.provs} Ey.</span>
                          <span className="text-[#e0b86e] font-bold">
                            {formatTroopsShort(item.army)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
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
