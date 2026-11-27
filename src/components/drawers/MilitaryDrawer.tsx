import React, { useEffect, useMemo, useRef, useState } from "react";
import { Anchor, Bot, Check, Crosshair, Lock, MapPin, Navigation, Search, TrendingUp, X } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import { ArmyModernizationCard } from "./ArmyModernizationCard";
import {
  ARMY_GENERATIONS_1440,
  ARMY_GENERATIONS_2026,
  getArmyGenerationInfo,
  getCommandersForMode,
  getNationModernizedTier,
  getNationUnlockedMilTier,
} from "../../data/world2026Data";
import {
  BatchRecruitUnitMode,
  calculateRecruitGoldCost,
  calculateRecruitmentDurationDays,
  MERCENARY_COMPANIES,
} from "../../engine/empireAndArmyActions";
import {
  BESTOW_FAVOR_GOLD_COST,
  getLordLoyaltySummary,
  getLordRetinueTroops,
} from "../../engine/pashaAndFiefEngine";
import { computeNationManpowerCap } from "../../engine/simulationEngine";
import { NationFlagCanvasBadge } from "../../map/nationFlagRenderer";
import { cleanNationName, cleanProvinceName } from "../../utils/formatters";
import { sound } from "../../utils/soundEngine";
import { EconomySourcesPopover } from "../common/EconomySourcesPopover";
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  AoH3MenuBanner,
  CommanderPortraitSvg,
  UnitTypeIllustrationSvg,
} from "../illustrations/AoH3Illustrations";
import { Nation } from "../../types/game";
import { computeWorldPowerRankings } from "../../engine/worldRankings";

type MilitaryTab = "TREE" | "FORCES" | "RECRUIT" | "COMMANDERS" | "RANKINGS";

export const MilitaryDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  playerEconomy,
  selectedTerritory,
  territories,
  nations,
  battles = [],
  movements,
  seaArmies = [],
  selectedSeaArmyId = null,
  aiCommanderEnabled = false,
  aiCommanderStance = "BALANCED",
  onRecruitUnit,
  onBatchRecruitUnits,
  onHireMercenary,
  onRecruitOrAssignGeneral,
  onBestowFavorOnLord,
  onToggleCallLordToBanner,
  onModernizeNationalArmy,
  onSelectTerritory,
  onSelectSeaArmy,
  onStartArmyOrderMode,
  onStartSeaArmyOrder,
  onStartBatchMarch,
  onToggleAiCommander,
  onSetAiCommanderStance,
  onInspectNation,
  onClose,
  gameMode = "EMPIRES_1440",
  openRankingsSignal = 0,
}) => {
  const [militaryTab, setMilitaryTab] = useState<MilitaryTab>(() =>
    openRankingsSignal > 0 ? "RANKINGS" : "TREE"
  );
  const lastRankingsSignalRef = useRef<number>(openRankingsSignal);
  useEffect(() => {
    if (openRankingsSignal > 0 && openRankingsSignal !== lastRankingsSignalRef.current) {
      lastRankingsSignalRef.current = openRankingsSignal;
      setMilitaryTab("RANKINGS");
    }
  }, [openRankingsSignal]);
  const [inspectedEconomyNation, setInspectedEconomyNation] =
    useState<Nation | null>(null);
  const rankHoldTimerRef = useRef<number | null>(null);
  const rankHoldTriggeredRef = useRef(false);
  const [rankingSortBy, setRankingSortBy] = useState<
    "SCORE" | "GDP" | "ARMY" | "TECH" | "PRESTIGE" | "CAPITAL"
  >("SCORE");
  const [rankingSearch, setRankingSearch] = useState("");
  const [recruitmentTab, setRecruitmentTab] = useState<"REGULAR" | "MERCENARY">(
    "REGULAR"
  );
  const [batchUnitMode, setBatchUnitMode] =
    useState<BatchRecruitUnitMode>("MIXED");

  useEffect(() => {
    return () => {
      if (rankHoldTimerRef.current !== null) {
        window.clearTimeout(rankHoldTimerRef.current);
      }
    };
  }, []);

  const ownedProvinces = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNation.id)
        .sort(
          (a, b) => Number(b.isCapital) - Number(a.isCapital) || b.garrison - a.garrison
        ),
    [territories, playerNation.id]
  );

  const preferredCityId =
    selectedTerritory && selectedTerritory.ownerId === playerNation.id
      ? selectedTerritory.id
      : territories[playerNation.capitalTerritoryId]?.ownerId === playerNation.id
      ? playerNation.capitalTerritoryId
      : ownedProvinces[0]?.id || "";

  const [recruitCityId, setRecruitCityId] = useState<string>(preferredCityId);

  useEffect(() => {
    if (
      !recruitCityId ||
      !territories[recruitCityId] ||
      territories[recruitCityId].ownerId !== playerNation.id
    ) {
      setRecruitCityId(preferredCityId);
    }
  }, [recruitCityId, territories, playerNation.id, preferredCityId]);

  const activeRecruitCity =
    territories[recruitCityId] &&
    territories[recruitCityId].ownerId === playerNation.id
      ? territories[recruitCityId]
      : territories[preferredCityId] || null;

  const eraCommanders = getCommandersForMode(gameMode);
  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const generationList =
    gameMode === "EMPIRES_1440" ? ARMY_GENERATIONS_1440 : ARMY_GENERATIONS_2026;
  const manpowerCap = computeNationManpowerCap(playerNation, territories);

  // Forces outliner data (migrated from AoH3OutlinerWidget)
  const relevantBattles = useMemo(
    () =>
      battles.filter(
        (b) =>
          b.attackerId === playerNation.id || b.defenderId === playerNation.id
      ),
    [battles, playerNation.id]
  );

  const relevantMovements = useMemo(
    () =>
      movements.filter((m) => {
        if (m.ownerId === playerNation.id) return true;
        const targetOwner = territories[m.toTerritoryId]?.ownerId;
        return targetOwner === playerNation.id;
      }),
    [movements, playerNation.id, territories]
  );

  const allPlayerArmies = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNation.id && t.garrison >= 200)
        .sort((a, b) => b.garrison - a.garrison),
    [territories, playerNation.id]
  );

  const playerSeaArmies = useMemo(
    () =>
      seaArmies
        .filter((s) => s.ownerId === playerNation.id && s.troops > 0)
        .sort((a, b) => b.troops - a.troops),
    [seaArmies, playerNation.id]
  );

  const totalStandingArmy = useMemo(
    () =>
      allPlayerArmies.reduce((sum, t) => sum + (t.garrison || 0), 0) +
      playerSeaArmies.reduce((sum, s) => sum + (s.troops || 0), 0) +
      relevantMovements
        .filter((m) => m.ownerId === playerNation.id)
        .reduce((sum, m) => sum + (m.troops || 0), 0),
    [allPlayerArmies, playerSeaArmies, relevantMovements, playerNation.id]
  );

  const { fiefCountByCommander, rankedList, playerRankIndex } = useMemo(() => {
    const fiefCounts = new Map<string, number>();
    for (const t of Object.values(territories)) {
      if (t && t.ownerId === playerNation.id && t.fiefLordId) {
        fiefCounts.set(t.fiefLordId, (fiefCounts.get(t.fiefLordId) || 0) + 1);
      }
    }
    const list = computeWorldPowerRankings(
      nations,
      territories,
      movements,
      gameMode,
      rankingSortBy
    );

    return {
      fiefCountByCommander: fiefCounts,
      rankedList: list,
      playerRankIndex: list.findIndex((r) => r.nation.id === playerNation.id),
    };
  }, [territories, nations, movements, playerNation.id, rankingSortBy, gameMode]);

  const unitRows = [
    {
      unitType: "infantry" as const,
      lineBadge: `1. HAT · ${activeArmyGen.infantryClassLabel.toUpperCase()}`,
      title: activeArmyGen.infantryName,
      shortName: activeArmyGen.infantryShort,
      atk: 14 + modernizedTier * 5,
      def: 16 + modernizedTier * 5,
      spd: (4.5 + modernizedTier * 0.4).toFixed(1),
      regiments: [1000, 3000, 5000].map((amount) => ({
        amount,
        gold: calculateRecruitGoldCost("infantry", amount, playerNation),
        days: calculateRecruitmentDurationDays(
          amount,
          "infantry",
          activeRecruitCity,
          playerNation
        ),
        label: `+${amount.toLocaleString("tr-TR")}`,
      })),
    },
    {
      unitType: "armor" as const,
      lineBadge: `KANAT · ${activeArmyGen.armorClassLabel.toUpperCase()}`,
      title: activeArmyGen.armorName,
      shortName: activeArmyGen.armorShort,
      atk: 20 + modernizedTier * 6,
      def: 12 + modernizedTier * 4,
      spd: (7.8 + modernizedTier * 0.6).toFixed(1),
      regiments: [1000, 2500, 5000].map((amount) => ({
        amount,
        gold: calculateRecruitGoldCost("armor", amount, playerNation),
        days: calculateRecruitmentDurationDays(
          amount,
          "armor",
          activeRecruitCity,
          playerNation
        ),
        label: `+${amount.toLocaleString("tr-TR")}`,
      })),
    },
    {
      unitType: "airDrone" as const,
      lineBadge: `2. HAT · ${activeArmyGen.airArtilleryClassLabel.toUpperCase()}`,
      title: activeArmyGen.airArtilleryName,
      shortName: activeArmyGen.airArtilleryShort,
      atk: 24 + modernizedTier * 7,
      def: 8 + modernizedTier * 3,
      spd: (3.8 + modernizedTier * 0.7).toFixed(1),
      regiments: [1000, 2500].map((amount) => ({
        amount,
        gold: calculateRecruitGoldCost("airDrone", amount, playerNation),
        days: calculateRecruitmentDurationDays(
          amount,
          "airDrone",
          activeRecruitCity,
          playerNation
        ),
        label: `+${amount.toLocaleString("tr-TR")}`,
      })),
    },
  ];

  const bannerCfg =
    militaryTab === "TREE"
      ? {
          artKey: "INFANTRY" as const,
          branch: "MILITARY" as const,
          title: "Birlik Ağacı & Nesil Gelişimi",
          subtitle: `${activeArmyGen.generationLabel} (${activeArmyGen.eraTitle}) · Açık Nesil ${unlockedMilTier + 1}/${generationList.length}`,
          icon: "sword" as AoH3GlyphName,
        }
      : militaryTab === "FORCES"
      ? {
          artKey: "FORTRESS" as const,
          branch: "MILITARY" as const,
          title: "Ordularım, Filolar & Cephe",
          subtitle: `${(totalStandingArmy / 1000).toFixed(1)}B Toplam Asker · ${allPlayerArmies.length} Garnizon${
            playerSeaArmies.length > 0 ? ` · ${playerSeaArmies.length} Filo` : ""
          }`,
          icon: "shield" as AoH3GlyphName,
        }
      : militaryTab === "RECRUIT"
      ? {
          artKey: "INFANTRY" as const,
          branch: "MILITARY" as const,
          title: "Seferberlik & Asker Basımı",
          subtitle: `Ordu ${(playerEconomy.totalGarrison / 1000).toFixed(1)}B · İG ${(
            playerNation.manpower / 1000
          ).toFixed(1)}B/${(manpowerCap / 1000).toFixed(0)}B`,
          icon: "sword" as AoH3GlyphName,
        }
      : militaryTab === "COMMANDERS"
      ? {
          artKey: "COURT" as const,
          branch: "MILITARY" as const,
          title:
            gameMode === "EMPIRES_1440"
              ? "Paşalar & Sancak Beyleri"
              : "Komutanlar & Kurmaylar",
          subtitle: `${playerNation.clanInfluence ?? 120} Nüfuz · ${activeArmyGen.generationLabel}`,
          icon: "crown" as AoH3GlyphName,
        }
      : {
          artKey: "FORTRESS" as const,
          branch: "MILITARY" as const,
          title:
            gameMode === "EMPIRES_1440"
              ? "1440 Devlet Güç Sıralaması"
              : "2026 Küresel Güç Sıralaması",
          subtitle:
            playerRankIndex >= 0
              ? `Küresel Sıranız: #${playerRankIndex + 1} / ${rankedList.length}`
              : `${rankedList.length} Devlet`,
          icon: "trophy" as AoH3GlyphName,
        };

  return (
    <div className="space-y-3">
      {/* AoH3 Illustrated Oil-Painting Header Banner */}
      <AoH3MenuBanner
        artKey={bannerCfg.artKey}
        branch={bannerCfg.branch}
        title={bannerCfg.title}
        subtitle={bannerCfg.subtitle}
        icon={bannerCfg.icon}
        rightSlot={
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#14100c]/85 border border-[#caa15a]/35 font-mono-num text-[11px] text-[#e0b86e]">
            <span>{activeArmyGen.eraTitle}</span>
          </div>
        }
      />

      {/* AoH3 5-Tab Switcher: Birlik Ağacı · Ordularım · Ordu Bas · Paşalar · Sıralama */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Askerî Komuta Sekmeleri"
          className="flex items-center gap-1 bg-[#120e0a] p-1 rounded-xl border border-[#caa15a]/30 w-full lg:w-auto overflow-x-auto no-scrollbar"
        >
          {(
            [
              { id: "TREE" as const, label: "Birlik Ağacı", icon: "science" as AoH3GlyphName, testId: "mil-tab-tree" },
              {
                id: "FORCES" as const,
                label: `Ordularım (${allPlayerArmies.length + playerSeaArmies.length})`,
                icon: "shield" as AoH3GlyphName,
                testId: "mil-tab-forces",
              },
              { id: "RECRUIT" as const, label: "Ordu Bas", icon: "sword" as AoH3GlyphName, testId: "mil-tab-recruit" },
              {
                id: "COMMANDERS" as const,
                label: gameMode === "EMPIRES_1440" ? "Paşalar" : "Komutanlar",
                icon: "crown" as AoH3GlyphName,
                testId: "mil-tab-commanders",
              },
              { id: "RANKINGS" as const, label: "Sıralama", icon: "trophy" as AoH3GlyphName, testId: "mil-tab-rankings" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={militaryTab === t.id}
              data-testid={t.testId}
              onClick={() => {
                sound.playClick();
                setMilitaryTab(t.id);
              }}
              className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                militaryTab === t.id
                  ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow"
                  : "text-[#d8cbb5] hover:text-[#faf3e3]"
              }`}
            >
              <AoH3GlyphSvg name={t.icon} className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Inline National Manpower & Army Strip */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono-num text-[#c5b79e]">
          <span>
            Ordu{" "}
            <strong className="text-[#f3ead7]">
              {(playerEconomy.totalGarrison / 1000).toFixed(1)}B
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            İG{" "}
            <strong className="text-[#e0b86e]">
              {(playerNation.manpower / 1000).toFixed(1)}B /{" "}
              {(manpowerCap / 1000).toFixed(0)}B
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            {activeArmyGen.generationLabel}
            {playerRankIndex >= 0 ? ` · #${playerRankIndex + 1}` : ""}
          </span>
        </div>
      </div>

      {/* TAB 0: BİRLİK AĞACI (Visual Tech-Tree Style Unit Progression) */}
      {militaryTab === "TREE" && (
        <div data-testid="military-unit-tree" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-7">
              <ArmyModernizationCard
                playerNation={playerNation}
                totalGarrison={playerEconomy.totalGarrison}
                gameMode={gameMode}
                onModernizeNationalArmy={onModernizeNationalArmy}
              />
            </div>
            {activeRecruitCity && (
              <div className="lg:col-span-5 rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#e0b86e]">
                    Hızlı Eğitim Şehri
                  </span>
                  <span className="font-mono-num text-[11px] text-[#c5b79e]">
                    {Math.round(playerNation.treasury).toLocaleString("tr-TR")} A ·{" "}
                    {(playerNation.manpower / 1000).toFixed(1)}B İG
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Birlik ağacı hızlı eğitim şehri"
                    value={activeRecruitCity.id}
                    onChange={(e) => setRecruitCityId(e.target.value)}
                    className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1 rounded-xl bg-[#0d0a07] border border-[#caa15a]/40 text-xs font-semibold text-[#f3ead7]"
                  >
                    {ownedProvinces.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {cleanProvinceName(prov.name)} ({(prov.garrison / 1000).toFixed(1)}B)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setMilitaryTab("RECRUIT")}
                    className="min-h-[38px] px-3 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#caa15a]/45 text-xs font-bold text-[#e0b86e] shrink-0 cursor-pointer"
                  >
                    Toplu Bas →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal Multi-Era Visual Unit Progression Grid (1444 -> 2026) */}
          <div className="rounded-2xl bg-[#110d0a] border border-[#caa15a]/35 p-3 overflow-x-auto">
            <div
              className="space-y-2.5"
              style={{ minWidth: `${110 + generationList.length * 145}px` }}
            >
              {/* Tier Headers */}
              <div
                className="grid gap-2 items-center"
                style={{
                  gridTemplateColumns: `110px repeat(${generationList.length}, minmax(135px, 1fr))`,
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9b8e78] px-1">
                  Sınıf / Nesil
                </div>
                {generationList.map((gen) => {
                  const isCurrent = gen.tier === modernizedTier;
                  const isUnlocked = gen.tier <= unlockedMilTier;
                  return (
                    <div
                      key={gen.tier}
                      className={`rounded-xl px-2.5 py-1.5 border text-center ${
                        isCurrent
                          ? "bg-[#261d12] border-[#e0b86e]"
                          : isUnlocked
                          ? "bg-[#1a150f] border-[#caa15a]/45"
                          : "bg-[#14100d] border-[#2e261d] opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[11px] font-display font-extrabold text-[#f3ead7]">
                        <span>{gen.generationLabel}</span>
                        {isCurrent && (
                          <span className="px-1 py-0 rounded bg-[#e0b86e] text-[#14100c] text-[8.5px] font-black">
                            AKTİF
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] text-[#b8a990] truncate">
                        {gen.eraTitle}
                      </div>
                      <div className="text-[9px] font-mono-num text-[#e0b86e] mt-0.5">
                        {gen.tier === 0
                          ? "Başlangıç"
                          : isUnlocked
                          ? `Açık (+%${gen.combatBonusPct} Güç)`
                          : `Kilitli · Tek.`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3 Visual Unit Rows */}
              {(
                [
                  {
                    unitType: "infantry" as const,
                    rowLabel: "1. Hat · Piyade",
                    goldCost: calculateRecruitGoldCost("infantry", 1000, playerNation),
                    getName: (g: (typeof generationList)[number]) => g.infantryName,
                    getClass: (g: (typeof generationList)[number]) => g.infantryClassLabel,
                    getAtk: (t: number) => 14 + t * 5,
                    getDef: (t: number) => 16 + t * 5,
                    getSpd: (t: number) => (4.5 + t * 0.4).toFixed(1),
                  },
                  {
                    unitType: "armor" as const,
                    rowLabel: "Kanat · Süvari / Zırhlı",
                    goldCost: calculateRecruitGoldCost("armor", 1000, playerNation),
                    getName: (g: (typeof generationList)[number]) => g.armorName,
                    getClass: (g: (typeof generationList)[number]) => g.armorClassLabel,
                    getAtk: (t: number) => 20 + t * 6,
                    getDef: (t: number) => 12 + t * 4,
                    getSpd: (t: number) => (7.8 + t * 0.6).toFixed(1),
                  },
                  {
                    unitType: "airDrone" as const,
                    rowLabel: "2. Hat · Topçu / SİHA",
                    goldCost: calculateRecruitGoldCost("airDrone", 1000, playerNation),
                    getName: (g: (typeof generationList)[number]) => g.airArtilleryName,
                    getClass: (g: (typeof generationList)[number]) => g.airArtilleryClassLabel,
                    getAtk: (t: number) => 24 + t * 7,
                    getDef: (t: number) => 8 + t * 3,
                    getSpd: (t: number) => (3.8 + t * 0.7).toFixed(1),
                  },
                ]
              ).map((line) => (
                <div
                  key={line.unitType}
                  className="grid gap-2 items-stretch"
                  style={{
                    gridTemplateColumns: `110px repeat(${generationList.length}, minmax(135px, 1fr))`,
                  }}
                >
                  <div className="rounded-xl bg-[#18130e] border border-[#caa15a]/25 p-2 flex flex-col items-center justify-center text-center gap-1">
                    <UnitTypeIllustrationSvg
                      unitType={line.unitType}
                      modeId={gameMode}
                      className="w-8 h-8"
                    />
                    <span className="text-[10px] font-bold text-[#e0b86e] leading-tight">
                      {line.rowLabel}
                    </span>
                  </div>

                  {generationList.map((gen) => {
                    const unlocked = gen.tier <= unlockedMilTier;
                    const isCurrent = gen.tier === modernizedTier;
                    const canQuickRecruit =
                      unlocked &&
                      Boolean(activeRecruitCity) &&
                      playerNation.treasury >= line.goldCost &&
                      playerNation.manpower >= 1000;

                    return (
                      <div
                        key={gen.tier}
                        data-testid={`unit-tree-card-${line.unitType}-${gen.tier}`}
                        className={`relative rounded-xl p-2 border flex flex-col justify-between gap-1.5 transition-all ${
                          isCurrent
                            ? "bg-gradient-to-b from-[#2b2013] to-[#1a140d] border-[#e0b86e] shadow-md"
                            : unlocked
                            ? "bg-[#1a1510] border-[#caa15a]/45"
                            : "bg-[#13100c] border-[#2d251d] opacity-65"
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <UnitTypeIllustrationSvg
                            unitType={line.unitType}
                            modeId={gameMode}
                            className="w-8 h-8 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10.5px] font-bold text-[#f3ead7] leading-tight line-clamp-2">
                              {line.getName(gen)}
                            </div>
                            <div className="text-[9px] text-[#b8a990] truncate">
                              {line.getClass(gen)}
                            </div>
                          </div>
                          {unlocked ? (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Lock className="w-3 h-3 text-[#7c6f5b] shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[9.5px] font-mono-num text-[#d8cbb5] bg-black/35 rounded-md px-1.5 py-0.5">
                          <span>⚔ {line.getAtk(gen.tier)}</span>
                          <span>🛡 {line.getDef(gen.tier)}</span>
                          <span>⚡ {line.getSpd(gen.tier)}</span>
                        </div>

                        {isCurrent && activeRecruitCity ? (
                          <button
                            type="button"
                            disabled={!canQuickRecruit}
                            onClick={() =>
                              onRecruitUnit(
                                activeRecruitCity.id,
                                line.unitType,
                                1000,
                                line.goldCost
                              )
                            }
                            className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                              canQuickRecruit
                                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] hover:brightness-110 cursor-pointer"
                                : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                            }`}
                          >
                            +1.000 Bas ({line.goldCost}A)
                          </button>
                        ) : (
                          <div className="text-center text-[9px] font-semibold text-[#9b8e78]">
                            {unlocked ? "Açıldı" : `Teknoloji Gerekli`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ORDULARIM & CEPHE (Migrated from Floating AoH3OutlinerWidget) */}
      {militaryTab === "FORCES" && (
        <div data-testid="military-forces-panel" className="space-y-3">
          {/* Header Action Strip + YZ Commander */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6 rounded-2xl bg-[#14100c] border border-[#caa15a]/40 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-display font-bold text-[#f3ead7]">
                  {(totalStandingArmy / 1000).toFixed(1)}B Toplam Kuvvet
                </div>
                <div className="text-[11px] text-[#b8a990] font-mono-num">
                  {allPlayerArmies.length} Konuşlu Garnizon ·{" "}
                  {playerSeaArmies.length} Deniz Filosu ·{" "}
                  {relevantMovements.length} Yürüyüş
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {onStartBatchMarch && (
                  <button
                    type="button"
                    data-testid="forces-batch-march-btn"
                    onClick={() => {
                      sound.playClick();
                      onClose();
                      onStartBatchMarch();
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] text-xs font-extrabold cursor-pointer"
                  >
                    Toplu Sevk (Harita)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setMilitaryTab("RECRUIT");
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#caa15a]/45 text-xs font-bold text-[#e0b86e] cursor-pointer"
                >
                  Ordu Bas →
                </button>
              </div>
            </div>

            {(onToggleAiCommander || onSetAiCommanderStance) && (
              <div className="lg:col-span-6 rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#f3ead7]">
                    <Bot
                      className={`w-4 h-4 ${
                        aiCommanderEnabled ? "text-emerald-400" : "text-[#e0b86e]"
                      }`}
                    />
                    <span>YZ Cephe Komutanı</span>
                  </div>
                  {onToggleAiCommander && (
                    <button
                      type="button"
                      data-testid="forces-ai-toggle-btn"
                      onClick={onToggleAiCommander}
                      aria-pressed={aiCommanderEnabled}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        aiCommanderEnabled
                          ? "bg-emerald-500 text-[#14100c] border-emerald-300"
                          : "bg-[#1b1510] hover:bg-[#261e16] text-[#d8cbb5] border-[#3a2f22]"
                      }`}
                    >
                      {aiCommanderEnabled ? "Açık" : "Kapalı"}
                    </button>
                  )}
                </div>
                {onSetAiCommanderStance && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: "BALANCED", label: "Dengeli" },
                        { id: "AGGRESSIVE", label: "Taarruz" },
                        { id: "DEFENSIVE", label: "Savunma" },
                      ] as const
                    ).map((st) => {
                      const active = aiCommanderStance === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          data-testid={`forces-ai-stance-${st.id.toLowerCase()}`}
                          aria-pressed={active}
                          onClick={() => onSetAiCommanderStance(st.id)}
                          className={`min-h-[34px] py-1 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            active
                              ? "bg-[#caa15a] text-[#14100c] border-[#f3ead7]"
                              : "bg-[#1b1510] hover:bg-[#261e16] text-[#d8cbb5] border-[#3a2f22]"
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
          </div>

          {/* Live Battles + Active Marches */}
          {(relevantBattles.length > 0 || relevantMovements.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {relevantBattles.length > 0 && (
                <div className="rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 space-y-2">
                  <div className="text-xs font-bold text-[#e0b86e] flex items-center gap-1.5">
                    <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5" />
                    <span>Süren Muharebeler ({relevantBattles.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {relevantBattles.map((btl) => {
                      const terrName = cleanProvinceName(
                        territories[btl.territoryId]?.name || btl.territoryId
                      );
                      const total = Math.max(
                        1,
                        btl.attackerTroops + btl.defenderTroops
                      );
                      const attPct = Math.round(
                        (btl.attackerTroops / total) * 100
                      );
                      return (
                        <button
                          key={btl.id}
                          type="button"
                          onClick={() => {
                            sound.playSelectTerritory();
                            onClose();
                            onSelectTerritory(btl.territoryId);
                          }}
                          className="w-full p-2 rounded-xl bg-[#241c13]/80 border border-[#caa15a]/45 text-left cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-[#f3ead7]">
                            <span className="truncate">{terrName}</span>
                            <span className="font-mono-num text-[11px] text-[#e0b86e]">
                              {(btl.attackerTroops / 1000).toFixed(1)}B vs{" "}
                              {(btl.defenderTroops / 1000).toFixed(1)}B
                            </span>
                          </div>
                          <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#caa15a] overflow-hidden">
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

              {relevantMovements.length > 0 && (
                <div className="rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 space-y-2">
                  <div className="text-xs font-bold text-[#e0b86e]">
                    Hareket Halindeki Ordular ({relevantMovements.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {relevantMovements.map((mv) => {
                      const isOwn = mv.ownerId === playerNation.id;
                      const fromName = mv.fromCoords
                        ? "Deniz Filosu"
                        : cleanProvinceName(
                            territories[mv.fromTerritoryId]?.name ||
                              mv.fromTerritoryId
                          );
                      const toName = mv.toCoords
                        ? mv.targetSeaName || "Açık Deniz"
                        : cleanProvinceName(
                            territories[mv.toTerritoryId]?.name ||
                              mv.toTerritoryId
                          );
                      return (
                        <button
                          key={mv.id}
                          type="button"
                          onClick={() => {
                            sound.playSelectTerritory();
                            onClose();
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
                          className={`w-full p-2 rounded-xl border text-left cursor-pointer ${
                            isOwn
                              ? "bg-[#1a1510] border-[#caa15a]/35 hover:border-[#e0b86e]"
                              : "bg-rose-950/45 border-rose-500/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span
                              className={`flex items-center gap-1.5 truncate ${
                                isOwn ? "text-[#f3ead7]" : "text-rose-200"
                              }`}
                            >
                              {mv.isNaval ? (
                                <Anchor className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                              ) : (
                                <Navigation className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                              )}
                              <span className="truncate">
                                {fromName} → {toName}
                              </span>
                            </span>
                            <span className="font-mono-num text-[11px] text-[#e0b86e] shrink-0">
                              {(mv.troops / 1000).toFixed(1)}B
                            </span>
                          </div>
                          <div className="mt-1.5 w-full h-1.5 rounded-full bg-[#2a2117] overflow-hidden">
                            <div
                              className={`h-full ${
                                isOwn ? "bg-[#e0b86e]" : "bg-rose-500"
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
            </div>
          )}

          {/* Naval Fleets */}
          {playerSeaArmies.length > 0 && (
            <div className="rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#e0b86e]">
                <span>Deniz Filolarımız ({playerSeaArmies.length})</span>
                <span className="text-[10.5px] font-normal text-[#b8a990]">
                  Açık Deniz &amp; Çıkarma
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {playerSeaArmies.map((fleet) => {
                  const isSelected = fleet.id === selectedSeaArmyId;
                  return (
                    <div
                      key={fleet.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-[#241c13] border-[#e0b86e]"
                          : "bg-[#1a1510] border-[#caa15a]/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          sound.playSelectTerritory();
                          onClose();
                          onSelectSeaArmy?.(fleet.id);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <Anchor className="w-4 h-4 text-[#e0b86e] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[#faf3e3] truncate">
                            {fleet.name}
                          </div>
                          <div className="text-[10.5px] font-mono-num text-[#e0b86e]">
                            {(fleet.troops / 1000).toFixed(1)}B Asker
                          </div>
                        </div>
                      </button>
                      {onStartSeaArmyOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onClose();
                            onStartSeaArmyOrder(fleet.id);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#caa15a] hover:bg-[#e0b86e] text-[#14100c] font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>Sevk</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stationed Land Armies */}
          <div className="rounded-2xl bg-[#14100c] border border-[#caa15a]/35 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#e0b86e]">
              <span>Konuşlu Ordularımız ({allPlayerArmies.length})</span>
              <span className="text-[10.5px] font-normal text-[#b8a990]">
                Odaklan veya doğrudan sevk emri ver
              </span>
            </div>
            {allPlayerArmies.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#9b8e78]">
                200+ asker bulunduran konuşlu ordunuz yok.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {allPlayerArmies.map((terr, idx) => {
                  const isSelected = terr.id === selectedTerritory?.id;
                  const inf =
                    terr.units?.infantry ?? Math.round(terr.garrison * 0.7);
                  const arm =
                    terr.units?.armor ?? Math.round(terr.garrison * 0.2);
                  const sup =
                    terr.units?.airDrone ??
                    Math.max(0, terr.garrison - inf - arm);
                  const totalU = Math.max(1, inf + arm + sup);
                  const infPct = Math.round((inf / totalU) * 100);
                  const armPct = Math.round((arm / totalU) * 100);
                  return (
                    <div
                      key={terr.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-[#241c13] border-[#e0b86e]"
                          : "bg-[#1a1510] border-[#caa15a]/25 hover:border-[#caa15a]/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          sound.playSelectTerritory();
                          onClose();
                          onSelectTerritory(terr.id);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="w-6 h-6 rounded-lg bg-[#120e0a] border border-[#caa15a]/40 flex items-center justify-center text-[10px] font-mono-num font-bold text-[#e0b86e] shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[#faf3e3] truncate">
                              {cleanProvinceName(terr.name)}
                            </span>
                            <span className="text-[11px] font-mono-num font-extrabold text-[#e0b86e] shrink-0">
                              {(terr.garrison / 1000).toFixed(1)}B
                            </span>
                          </div>
                          <div className="mt-1 w-full h-1 rounded-full bg-[#3b2f21] overflow-hidden flex">
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
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onClose();
                          onSelectTerritory(terr.id);
                          onStartArmyOrderMode(terr.id);
                        }}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Sevk</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: ORDU BAS */}
      {militaryTab === "RECRUIT" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-3">
            {activeRecruitCity && (
              <div className="bg-[#14110e] border border-[#caa15a]/45 rounded-2xl p-3.5 space-y-3 shadow-xl">
                {/* Header & Resource Summary */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                    <AoH3GlyphSvg name="users" className="w-4 h-4 text-[#e0b86e] shrink-0" />
                    <span>Ordugah &amp; Seferberlik</span>
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-mono-num text-[#d8cbb5]">
                    <span className="text-[#e0b86e] font-bold">
                      {Math.round(playerNation.treasury).toLocaleString("tr-TR")} A
                    </span>
                    <span className="text-[#caa15a]/40">·</span>
                    <span className="text-emerald-400 font-bold">
                      +{playerEconomy.dailyManpower} İG/g
                    </span>
                  </div>
                </div>

                {/* Regular vs Mercenary Tabs */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0e0b08] border border-[#caa15a]/30">
                  <button
                    type="button"
                    data-testid="recruit-tab-regular"
                    onClick={() => setRecruitmentTab("REGULAR")}
                    className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      recruitmentTab === "REGULAR"
                        ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                        : "text-[#d8cbb5] hover:text-[#faf3e3]"
                    }`}
                  >
                    <AoH3GlyphSvg name="shield" className="w-3.5 h-3.5 shrink-0" />
                    <span>Nizamiye (İG + Altın)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="recruit-tab-mercenary"
                    onClick={() => setRecruitmentTab("MERCENARY")}
                    className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      recruitmentTab === "MERCENARY"
                        ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                        : "text-[#d8cbb5] hover:text-[#faf3e3]"
                    }`}
                  >
                    <AoH3GlyphSvg name="gold" className="w-3.5 h-3.5 shrink-0" />
                    <span>Paralı Asker (0 İG)</span>
                  </button>
                </div>

                {/* City Selector */}
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="military-recruit-city"
                    className="sr-only"
                  >
                    Toplanma Şehri
                  </label>
                  <select
                    id="military-recruit-city"
                    value={activeRecruitCity.id}
                    onChange={(e) => setRecruitCityId(e.target.value)}
                    className="flex-1 min-w-0 min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#0d0a07] border border-[#caa15a]/40 text-xs font-semibold text-[#f3ead7] focus:outline-none focus:border-[#e0b86e]"
                  >
                    {ownedProvinces.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {cleanProvinceName(prov.name)} (
                        {(prov.garrison / 1000).toFixed(1)}B)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onSelectTerritory(activeRecruitCity.id)}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#271e17] border border-[#caa15a]/35 text-xs font-semibold text-[#e0b86e] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Odaklan</span>
                  </button>
                </div>

                {/* Asker Ocağı Bonus & Active Recruitment Queue */}
                {((activeRecruitCity.buildings?.armyHearth ?? 0) > 0 ||
                  (activeRecruitCity.recruitmentQueue?.length ?? 0) > 0) && (
                  <div className="rounded-xl bg-[#14100c] border border-[#caa15a]/30 p-2 space-y-1.5 text-[11px]">
                    {(activeRecruitCity.buildings?.armyHearth ?? 0) > 0 && (
                      <div className="flex items-center justify-between gap-2 text-emerald-300 font-semibold">
                        <span>
                          Asker Ocağı Sv.{activeRecruitCity.buildings.armyHearth} Aktif
                        </span>
                        <span className="font-mono-num text-[10px]">
                          Bakım -%{Math.min(60, (activeRecruitCity.buildings.armyHearth ?? 0) * 12)} · Süre -%
                          {Math.min(60, (activeRecruitCity.buildings.armyHearth ?? 0) * 15)}
                        </span>
                      </div>
                    )}
                    {(activeRecruitCity.recruitmentQueue ?? []).map((job, idx) => {
                      const doneDays = Math.max(0, job.progressDays || 0);
                      const remDays = Math.max(1, job.totalDays - doneDays);
                      const pct =
                        idx === 0
                          ? Math.min(
                              99,
                              Math.round((doneDays / Math.max(1, job.totalDays)) * 100)
                            )
                          : 0;
                      return (
                        <div
                          key={job.id}
                          className="flex items-center justify-between gap-2 text-[10.5px] text-[#e8dcc8] bg-[#1c1610] px-2 py-1 rounded-lg border border-[#caa15a]/25"
                        >
                          <span className="truncate font-semibold">
                            {idx === 0 ? "Eğitimde" : `Sırada #${idx + 1}`}: {job.label} (+{(job.troops || 0).toLocaleString("tr-TR")})
                          </span>
                          <span className="font-mono-num font-bold text-[#e0b86e] shrink-0">
                            {idx === 0 ? `%${pct} · ${remDays}g` : `${job.totalDays}g`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {recruitmentTab === "REGULAR" ? (
                  <div className="space-y-2">
                    {unitRows.map((row) => (
                      <div
                        key={row.unitType}
                        className="p-2.5 rounded-xl border border-[#caa15a]/35 bg-[#1b1510] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UnitTypeIllustrationSvg
                            unitType={row.unitType}
                            modeId={gameMode}
                            className="w-10 h-10 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#e0b86e]">
                              {row.lineBadge}
                            </div>
                            <div className="text-xs font-bold text-[#f3ead7] truncate">
                              {row.title}
                            </div>
                            {/* AoH3 Clean Icon Stat Row (SVG in Obsidian+Gold) */}
                            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono-num font-bold text-[#d8cbb5]">
                              <span
                                className="inline-flex items-center gap-1"
                                title="Saldırı Gücü"
                              >
                                <AoH3GlyphSvg name="sword" className="w-3 h-3 text-[#e0b86e]" />
                                <span>{row.atk}</span>
                              </span>
                              <span
                                className="inline-flex items-center gap-1"
                                title="Savunma Gücü"
                              >
                                <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e]" />
                                <span>{row.def}</span>
                              </span>
                              <span
                                className="inline-flex items-center gap-0.5"
                                title="Hareket Hızı"
                              >
                                <AoH3GlyphSvg name="speed" className="w-3.5 h-3.5 text-[#e0b86e]" />
                                <span>{row.spd}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {row.regiments.map((reg) => {
                            const affordable =
                              playerNation.treasury >= reg.gold &&
                              playerNation.manpower >= reg.amount;
                            return (
                              <button
                                key={reg.amount}
                                type="button"
                                disabled={!affordable}
                                onClick={() =>
                                  onRecruitUnit(
                                    activeRecruitCity.id,
                                    row.unitType,
                                    reg.amount,
                                    reg.gold
                                  )
                                }
                                className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                  affordable
                                    ? "bg-[#120e0a] hover:bg-[#241c13] border-[#caa15a]/45 hover:border-[#e0b86e] text-[#f3ead7]"
                                    : "bg-[#0d0a07] border-[#caa15a]/15 text-[#6e624f] cursor-not-allowed"
                                }`}
                              >
                                <div className="text-[11px] font-extrabold text-[#e0b86e]">
                                  {reg.label}
                                </div>
                                <div className="text-[9.5px] font-mono-num text-[#c5b79e]">
                                  {reg.gold}A · {reg.days}g
                                </div>
                              </button>
                            );
                          })}
                          {onBatchRecruitUnits && (
                            <button
                              type="button"
                              data-testid={`military-max-${row.unitType}`}
                              onClick={() =>
                                onBatchRecruitUnits(
                                  "SINGLE_MAX",
                                  row.unitType,
                                  activeRecruitCity.id
                                )
                              }
                              className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#e0b86e]/70 bg-gradient-to-r from-[#caa15a]/25 to-[#e0b86e]/25 hover:from-[#caa15a] hover:to-[#e0b86e] text-[#e0b86e] hover:text-[#14100c] text-center transition-all cursor-pointer"
                            >
                              <div className="text-[11px] font-extrabold flex items-center justify-center gap-1">
                                <AoH3GlyphSvg name="bolt" className="w-3 h-3 shrink-0" />
                                <span>Maks</span>
                              </div>
                              <div className="text-[9px] font-mono-num opacity-90">
                                {row.shortName}
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="aoh3-mercenary-panel">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {MERCENARY_COMPANIES.map((merc) => {
                        const canAffordMerc =
                          playerNation.treasury >= merc.costGold;
                        const title =
                          gameMode === "EMPIRES_1440"
                            ? merc.historicalName
                            : merc.modernName;
                        const mercIcon: AoH3GlyphName =
                          merc.id === "merc_siege_corps"
                            ? "artillery"
                            : merc.id === "merc_pikemen"
                            ? "shield"
                            : "sword";
                        const mercAtk = Math.round(
                          (merc.composition.infantry * 16 +
                            merc.composition.armor * 24 +
                            merc.composition.airDrone * 28) /
                            Math.max(1, merc.troops) +
                            modernizedTier * 4
                        );
                        const mercDef = Math.round(
                          (merc.composition.infantry * 18 +
                            merc.composition.armor * 14 +
                            merc.composition.airDrone * 10) /
                            Math.max(1, merc.troops) +
                            modernizedTier * 4
                        );
                        const mercSpd = (
                          (merc.composition.infantry * 4.5 +
                            merc.composition.armor * 7.8 +
                            merc.composition.airDrone * 4.0) /
                          Math.max(1, merc.troops)
                        ).toFixed(1);

                        return (
                          <div
                            key={merc.id}
                            className="p-2.5 rounded-xl bg-[#1b1510] border border-[#caa15a]/35 flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-display font-bold text-[#f3ead7] flex items-center gap-1.5 truncate">
                                  <AoH3GlyphSvg
                                    name={mercIcon}
                                    className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                                  />
                                  <span className="truncate">{title}</span>
                                </span>
                                <span className="font-mono-num text-[11px] font-extrabold text-[#e0b86e] shrink-0">
                                  +{(merc.troops / 1000).toFixed(1)}B
                                </span>
                              </div>

                              {/* AoH3 Stat Row */}
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono-num font-bold text-[#d8cbb5]">
                                <span className="inline-flex items-center gap-1">
                                  <AoH3GlyphSvg name="sword" className="w-3 h-3 text-[#e0b86e]" />
                                  <span>{mercAtk}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e]" />
                                  <span>{mercDef}</span>
                                </span>
                                <span className="inline-flex items-center gap-0.5">
                                  <AoH3GlyphSvg name="speed" className="w-3.5 h-3.5 text-[#e0b86e]" />
                                  <span>{mercSpd}</span>
                                </span>
                              </div>

                              <div className="mt-1.5 text-[10px] font-mono-num text-[#b8a990] flex flex-wrap gap-x-2">
                                {merc.composition.infantry > 0 && (
                                  <span>
                                    Piy {(merc.composition.infantry / 1000).toFixed(1)}B
                                  </span>
                                )}
                                {merc.composition.armor > 0 && (
                                  <span>
                                    Süv {(merc.composition.armor / 1000).toFixed(1)}B
                                  </span>
                                )}
                                {merc.composition.airDrone > 0 && (
                                  <span>
                                    Top {(merc.composition.airDrone / 1000).toFixed(1)}B
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!canAffordMerc}
                              data-testid={`hire-mercenary-${merc.id}`}
                              onClick={() => {
                                if (onHireMercenary) {
                                  onHireMercenary(activeRecruitCity.id, merc.id);
                                } else {
                                  onRecruitUnit(
                                    activeRecruitCity.id,
                                    "infantry",
                                    merc.troops,
                                    merc.costGold
                                  );
                                }
                              }}
                              className={`w-full min-h-[44px] py-1.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                canAffordMerc
                                  ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16b] hover:to-[#ecc77e] text-[#14100c] shadow"
                                  : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/20 cursor-not-allowed"
                              }`}
                            >
                              <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 shrink-0" />
                              <span>Kirala · {merc.costGold}A (0 İG)</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 5 cols: Batch Recruitment + Army Modernization + Composition */}
          <div className="lg:col-span-5 space-y-3">
            {activeRecruitCity && onBatchRecruitUnits && (
              <div
                data-testid="military-batch-recruit-panel"
                className="p-3.5 rounded-2xl bg-[#14100c] border border-[#caa15a]/40 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold text-[#f3ead7] flex items-center gap-1.5">
                    <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Toplu Seferberlik</span>
                  </span>
                  <span className="text-[10px] text-[#b8a990]">
                    {cleanProvinceName(activeRecruitCity.name)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    {
                      id: "MIXED" as const,
                      label: "Karma",
                      icon: "sword" as AoH3GlyphName,
                    },
                    {
                      id: "infantry" as const,
                      label: activeArmyGen.infantryShort,
                      icon: "shield" as AoH3GlyphName,
                    },
                    {
                      id: "armor" as const,
                      label: activeArmyGen.armorShort,
                      icon: "cavalry" as AoH3GlyphName,
                    },
                    {
                      id: "airDrone" as const,
                      label: activeArmyGen.airArtilleryShort,
                      icon: "artillery" as AoH3GlyphName,
                    },
                  ].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      data-testid={`military-batch-mode-${u.id}`}
                      onClick={() => setBatchUnitMode(u.id)}
                      className={`min-h-[40px] px-1.5 py-1.5 rounded-lg border text-[10.5px] font-extrabold flex items-center justify-center gap-1 truncate transition-all cursor-pointer ${
                        batchUnitMode === u.id
                          ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] border-[#e0b86e]"
                          : "bg-[#1b1510] text-[#d8cbb5] border-[#caa15a]/30 hover:border-[#caa15a]/60"
                      }`}
                    >
                      <AoH3GlyphSvg name={u.icon} className="w-3 h-3 shrink-0" />
                      <span className="truncate">{u.label}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    data-testid="military-batch-border-btn"
                    onClick={() =>
                      onBatchRecruitUnits(
                        "BORDER",
                        batchUnitMode,
                        activeRecruitCity.id,
                        1
                      )
                    }
                    className="min-h-[44px] py-2 px-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/45 text-[#f3ead7] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <AoH3GlyphSvg name="shield" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Sınırlara</span>
                  </button>
                  <button
                    type="button"
                    data-testid="military-batch-all-btn"
                    onClick={() =>
                      onBatchRecruitUnits(
                        "ALL",
                        batchUnitMode,
                        activeRecruitCity.id,
                        1
                      )
                    }
                    className="min-h-[44px] py-2 px-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/45 text-[#f3ead7] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <AoH3GlyphSvg name="globe" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>Tüm Ülke</span>
                  </button>
                  <button
                    type="button"
                    data-testid="military-batch-single-max-btn"
                    onClick={() =>
                      onBatchRecruitUnits(
                        "SINGLE_MAX",
                        batchUnitMode,
                        activeRecruitCity.id
                      )
                    }
                    className="min-h-[44px] py-2 px-2 rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16b] hover:to-[#ecc77e] text-[#14100c] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <AoH3GlyphSvg name="bolt" className="w-3.5 h-3.5 shrink-0" />
                    <span>Şehir Maks</span>
                  </button>
                </div>
              </div>
            )}

            <ArmyModernizationCard
              playerNation={playerNation}
              totalGarrison={playerEconomy.totalGarrison}
              gameMode={gameMode}
              onModernizeNationalArmy={onModernizeNationalArmy}
            />

            {/* Visual National Army Composition Strip (Obsidian + Gold) */}
            <div className="grid grid-cols-3 gap-2 bg-[#14100c] border border-[#caa15a]/30 rounded-2xl p-2.5">
              <div className="flex items-center gap-2 bg-[#1b1510] border border-[#caa15a]/30 rounded-xl p-2 min-w-0">
                <UnitTypeIllustrationSvg
                  unitType="infantry"
                  modeId={gameMode}
                  className="w-8 h-8 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] text-[#d8cbb5] truncate">
                    {activeArmyGen.infantryShort}
                  </div>
                  <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                    {(playerEconomy.totalUnits.infantry / 1000).toFixed(1)}B
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-[#1b1510] border border-[#caa15a]/30 rounded-xl p-2 min-w-0">
                <UnitTypeIllustrationSvg
                  unitType="armor"
                  modeId={gameMode}
                  className="w-8 h-8 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] text-[#d8cbb5] truncate">
                    {activeArmyGen.armorShort}
                  </div>
                  <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                    {(playerEconomy.totalUnits.armor / 1000).toFixed(1)}B
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-[#1b1510] border border-[#caa15a]/30 rounded-xl p-2 min-w-0">
                <UnitTypeIllustrationSvg
                  unitType="airDrone"
                  modeId={gameMode}
                  className="w-8 h-8 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] text-[#d8cbb5] truncate">
                    {activeArmyGen.airArtilleryShort}
                  </div>
                  <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
                    {(playerEconomy.totalUnits.airDrone / 1000).toFixed(1)}B
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAŞALAR & KOMUTANLAR */}
      {militaryTab === "COMMANDERS" && (
        <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#caa15a]/20 pb-2.5">
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="crown" className="w-4 h-4 text-[#e0b86e]" />
              <span>
                {gameMode === "EMPIRES_1440"
                  ? "Paşalar & Sancak Beyleri"
                  : "Komutanlar & Kurmaylar"}
              </span>
            </h3>
            <div className="flex items-center gap-2 font-mono-num text-xs text-[#d8cbb5]">
              <span className="text-[#e0b86e] font-bold flex items-center gap-1">
                <AoH3GlyphSvg name="fleur" className="w-3.5 h-3.5 shrink-0" />
                <span>{playerNation.clanInfluence ?? 120} Nüfuz</span>
              </span>
              <span className="text-[#caa15a]/40">·</span>
              <span className="text-[#f3ead7] font-bold">
                {activeArmyGen.generationLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
            {eraCommanders.map((cmd) => {
              const isRecruited = playerNation.recruitedGeneralIds?.includes(
                cmd.id
              );
              const isActive = playerNation.activeGeneralId === cmd.id;
              const isCalledToBanner =
                playerNation.bannerCalledLordIds?.includes(cmd.id);
              const canAfford = playerNation.treasury >= cmd.costGold;
              const loyaltyInfo = isRecruited
                ? getLordLoyaltySummary(playerNation, cmd.id, territories)
                : null;
              const fiefCount = loyaltyInfo
                ? loyaltyInfo.fiefCount
                : fiefCountByCommander.get(cmd.id) || 0;
              const retinueSize = getLordRetinueTroops(cmd.id, territories);
              const canBestow =
                isRecruited &&
                Boolean(onBestowFavorOnLord) &&
                playerNation.treasury >= BESTOW_FAVOR_GOLD_COST &&
                (loyaltyInfo?.loyalty ?? 100) < 100;

              return (
                <div
                  key={cmd.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                    loyaltyInfo && loyaltyInfo.tone === "ROSE"
                      ? "bg-rose-950/30 border-rose-500/65"
                      : isActive || isCalledToBanner
                      ? "bg-[#211910] border-[#e0b86e]"
                      : "bg-[#1b1510] border-[#caa15a]/30"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <CommanderPortraitSvg
                      specialty={
                        cmd.attackBonus >= cmd.defenseBonus
                          ? "OFFENSE"
                          : "DEFENSE"
                      }
                      loyalty={loyaltyInfo?.loyalty ?? 85}
                      className="w-11 h-11 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-[#f3ead7] truncate">
                          {cmd.name}
                          {fiefCount > 0 ? ` · ${fiefCount} Tımar` : ""}
                        </span>
                        {loyaltyInfo && (
                          <span
                            className={`text-[10.5px] font-mono-num font-bold inline-flex items-center gap-1 shrink-0 ${
                              loyaltyInfo.tone === "ROSE"
                                ? "text-rose-400"
                                : loyaltyInfo.tone === "AMBER"
                                ? "text-[#e0b86e]"
                                : "text-emerald-400"
                            }`}
                          >
                            <AoH3GlyphSvg name="heart" className="w-3 h-3 shrink-0" />
                            <span>%{loyaltyInfo.loyalty}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono-num text-[#e0b86e] mt-0.5">
                        {cmd.title} · +{(retinueSize / 1000).toFixed(1)}B Sancak
                      </div>

                      <div className="font-mono-num text-[11px] text-[#d8cbb5] mt-0.5 flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="sword" className="w-3 h-3 text-[#e0b86e]" />
                          <span>+%{cmd.attackBonus}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e]" />
                          <span>+%{cmd.defenseBonus}</span>
                        </span>
                        <span>−%{cmd.casualtyReduction} Kayıp</span>
                      </div>
                    </div>
                  </div>

                  {loyaltyInfo && (
                    <div className="space-y-1">
                      <div className="w-full h-1.5 rounded-full bg-[#0d0a07] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            loyaltyInfo.tone === "ROSE"
                              ? "bg-rose-500"
                              : loyaltyInfo.tone === "AMBER"
                              ? "bg-[#e0b86e]"
                              : "bg-emerald-400"
                          }`}
                          style={{ width: `${loyaltyInfo.loyalty}%` }}
                        />
                      </div>
                      {loyaltyInfo.warningReason && (
                        <div className="text-[10px] text-rose-300 flex items-center gap-1 truncate">
                          <AoH3GlyphSvg name="alert" className="w-3 h-3 shrink-0" />
                          <span className="truncate">{loyaltyInfo.warningReason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isRecruited && onBestowFavorOnLord && (
                      <button
                        type="button"
                        onClick={() => onBestowFavorOnLord(cmd.id)}
                        disabled={!canBestow}
                        className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          canBestow
                            ? "bg-[#241c13] hover:bg-[#31261a] text-[#e0b86e] border border-[#caa15a]/45"
                            : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                        }`}
                      >
                        <AoH3GlyphSvg name="gift" className="w-3 h-3 shrink-0" />
                        <span>İhsan ({BESTOW_FAVOR_GOLD_COST}A)</span>
                      </button>
                    )}
                    {isRecruited && (
                      <button
                        type="button"
                        onClick={() => onToggleCallLordToBanner(cmd.id)}
                        className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          isCalledToBanner
                            ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] border border-[#e0b86e]"
                            : "bg-[#1b1510] hover:bg-[#261d14] text-[#f3ead7] border border-[#caa15a]/40"
                        }`}
                      >
                        <AoH3GlyphSvg name="fleur" className="w-3 h-3 shrink-0" />
                        <span>
                          {isCalledToBanner ? "Sancakta" : "Sancağa Çağır (35)"}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRecruitOrAssignGeneral(cmd.id)}
                      disabled={!isRecruited && !canAfford}
                      className={`min-h-[44px] flex-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                          : isRecruited
                          ? "bg-[#261e16] hover:bg-[#33281d] text-[#f3ead7] border border-[#caa15a]/40"
                          : canAfford
                          ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                          : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                          <span>Başkomutan</span>
                        </>
                      ) : isRecruited ? (
                        <span>Serdar Ata</span>
                      ) : (
                        <span>Atama ({cmd.costGold}A)</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DÜNYA GÜÇ SIRALAMASI */}
      {militaryTab === "RANKINGS" && (
        <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                <AoH3GlyphSvg name="trophy" className="w-4 h-4 text-[#e0b86e]" />
                <span>
                  {gameMode === "EMPIRES_1440"
                    ? "1440 Devlet Güç Sıralaması"
                    : "2026 Küresel Güç Sıralaması"}
                </span>
              </h3>
              <p className="text-[11px] text-[#b8a990] mt-0.5">
                Rakiplerin sizden neden güçlü olduğunu görün; kaynakları görmek için Ekonomi butonuna basılı tutun.
              </p>
            </div>
            {playerRankIndex >= 0 && (
              <span className="font-mono-num text-xs font-bold text-[#e0b86e]">
                Sıranız: #{playerRankIndex + 1} / {rankedList.length}
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#b8a990] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={rankingSearch}
              onChange={(e) => setRankingSearch(e.target.value)}
              placeholder="Sıralamada devlet ara..."
              aria-label="Güç sıralamasında devlet ara"
              data-testid="power-rank-search-input"
              className="w-full min-h-[38px] pl-8 pr-8 py-1.5 rounded-xl bg-[#0f0c09] border border-[#caa15a]/30 focus:border-[#e0b86e] focus:outline-none text-xs text-[#faf3e3] placeholder:text-[#8e806a]"
            />
            {rankingSearch && (
              <button
                type="button"
                onClick={() => setRankingSearch("")}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[#b8a990] hover:text-[#faf3e3] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-[#0f0c09] p-1 rounded-xl border border-[#caa15a]/30">
            {(
              [
                { id: "SCORE", label: "Toplam" },
                { id: "GDP", label: "Ekonomi" },
                { id: "ARMY", label: "Ordu" },
                { id: "TECH", label: "Teknoloji" },
                { id: "PRESTIGE", label: "Prestij" },
                { id: "CAPITAL", label: "Toprak" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`power-rank-sort-${tab.id}`}
                onClick={() => setRankingSortBy(tab.id)}
                className={`min-h-[40px] py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-colors truncate cursor-pointer ${
                  rankingSortBy === tab.id
                    ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                    : "text-[#b8a990] hover:text-[#faf3e3]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {(() => {
              const playerEntry = rankedList.find(
                (r) => r.nation.id === playerNation.id
              );
              const normQuery = rankingSearch.trim().toLocaleLowerCase("tr-TR");
              const indexedList = rankedList.map((entry, idx) => ({
                entry,
                rank: idx + 1,
              }));
              const visibleRows = normQuery
                ? indexedList.filter(({ entry }) =>
                    cleanNationName(entry.nation.name)
                      .toLocaleLowerCase("tr-TR")
                      .includes(normQuery)
                  )
                : indexedList;

              if (visibleRows.length === 0) {
                return (
                  <div className="p-6 text-center rounded-xl bg-[#18130e] border border-[#caa15a]/25 text-xs text-[#b8a990]">
                    Aramaya uygun devlet bulunamadı.
                  </div>
                );
              }

              return visibleRows.map(({ entry, rank }) => {
                const isPlayer = entry.nation.id === playerNation.id;
                const reasons: { label: string; tone: "rose" | "gold" | "sky" }[] = [];
                if (!isPlayer && playerEntry) {
                  if (entry.army > playerEntry.army * 1.05) {
                    reasons.push({
                      label: `Ordu +${((entry.army - playerEntry.army) / 1000).toFixed(1)}B`,
                      tone: "rose",
                    });
                  }
                  if (entry.totalEconomy > playerEntry.totalEconomy * 1.05) {
                    reasons.push({
                      label: `Ekonomi +${(entry.totalEconomy - playerEntry.totalEconomy).toLocaleString("tr-TR")}`,
                      tone: "gold",
                    });
                  }
                  if (entry.techLevel > playerEntry.techLevel + 0.1) {
                    reasons.push({
                      label: `Tek. +${(entry.techLevel - playerEntry.techLevel).toFixed(1)}`,
                      tone: "sky",
                    });
                  }
                  if (entry.ownedCount > playerEntry.ownedCount) {
                    reasons.push({
                      label: `+${entry.ownedCount - playerEntry.ownedCount} Eyalet`,
                      tone: "gold",
                    });
                  }
                }

                return (
                  <div
                    key={entry.nation.id}
                    data-testid={`power-rank-row-${entry.nation.id}`}
                    className={`rounded-xl border px-2.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                      isPlayer
                        ? "bg-[#211a12] border-[#e0b86e] shadow"
                        : "bg-[#18130e] border-[#caa15a]/25 hover:border-[#caa15a]/55"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onInspectNation) {
                          sound.playClick();
                          onInspectNation(entry.nation.id);
                        } else {
                          onSelectTerritory(entry.nation.capitalTerritoryId);
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <span className="font-mono-num text-xs font-bold text-[#e0b86e] w-6 shrink-0">
                        #{rank}
                      </span>
                      <NationFlagCanvasBadge
                        nationId={entry.nation.id}
                        flagCode={entry.nation.flagCode}
                        color={entry.nation.color}
                        width={34}
                        height={24}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[#f3ead7] truncate">
                            {cleanNationName(entry.nation.name)}
                          </span>
                          {entry.nation.vassalOf && (
                            <span className="text-[10px] text-[#e0b86e]">
                              (Vasal)
                            </span>
                          )}
                          {isPlayer && (
                            <span className="px-1.5 py-0 rounded bg-[#e0b86e] text-[#14100c] text-[9px] font-black">
                              SİZ
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-[#c5b79e] font-mono-num flex flex-wrap items-center gap-x-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#f3ead7]">
                            <AoH3GlyphSvg name="sword" className="w-2.5 h-2.5 text-[#e0b86e]" />
                            <span>{(entry.army / 1000).toFixed(1)}B</span>
                          </span>
                          <span>Tek.{entry.techLevel.toFixed(1)}</span>
                          <span>{entry.ownedCount} Ey.</span>
                          <span>★ {entry.prestige}</span>
                        </div>

                        {/* Why stronger / weaker comparison chips */}
                        {!isPlayer && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {reasons.length > 0 ? (
                              <>
                                <span className="text-[9.5px] font-bold text-[#9b8e78]">
                                  Neden güçlü:
                                </span>
                                {reasons.map((r) => (
                                  <span
                                    key={r.label}
                                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono-num font-bold border ${
                                      r.tone === "rose"
                                        ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
                                        : r.tone === "sky"
                                        ? "bg-sky-950/50 border-sky-400/40 text-sky-200"
                                        : "bg-[#251d13] border-[#caa15a]/45 text-[#e0b86e]"
                                    }`}
                                  >
                                    {r.label}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-950/50 border border-emerald-500/35 text-emerald-300">
                                Siz bu devletten öndesiniz
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Right: Mevcut Ekonomi Hold Pill + Power Score */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`rank-economy-hold-${entry.nation.id}`}
                        onPointerDown={(e) => {
                          if (e.button !== 0 && e.pointerType === "mouse") return;
                          rankHoldTriggeredRef.current = false;
                          if (rankHoldTimerRef.current !== null) {
                            window.clearTimeout(rankHoldTimerRef.current);
                          }
                          rankHoldTimerRef.current = window.setTimeout(() => {
                            rankHoldTriggeredRef.current = true;
                            sound.playClick();
                            setInspectedEconomyNation(entry.nation);
                          }, 260);
                        }}
                        onPointerUp={() => {
                          if (rankHoldTimerRef.current !== null) {
                            window.clearTimeout(rankHoldTimerRef.current);
                            rankHoldTimerRef.current = null;
                          }
                        }}
                        onPointerLeave={() => {
                          if (rankHoldTimerRef.current !== null) {
                            window.clearTimeout(rankHoldTimerRef.current);
                            rankHoldTimerRef.current = null;
                          }
                        }}
                        onPointerCancel={() => {
                          if (rankHoldTimerRef.current !== null) {
                            window.clearTimeout(rankHoldTimerRef.current);
                            rankHoldTimerRef.current = null;
                          }
                        }}
                        onClick={() => {
                          if (rankHoldTriggeredRef.current) {
                            rankHoldTriggeredRef.current = false;
                            return;
                          }
                          sound.playClick();
                          setInspectedEconomyNation(entry.nation);
                        }}
                        title="Mevcut Ekonomi kaynakları için basılı tutun"
                        className="px-2 py-1 rounded-lg bg-[#120e0a] hover:bg-[#241c13] border border-[#caa15a]/40 text-right cursor-pointer select-none"
                      >
                        <div className="text-[9px] text-[#b8a990] flex items-center justify-end gap-1">
                          <TrendingUp className="w-2.5 h-2.5 text-[#e0b86e]" />
                          <span>Ekonomi</span>
                        </div>
                        <div className="font-mono-num text-[11px] font-extrabold text-[#e0b86e]">
                          {entry.totalEconomy.toLocaleString("tr-TR")}
                        </div>
                      </button>

                      <div className="text-right font-mono-num min-w-[46px]">
                        <div className="text-xs font-extrabold text-[#faf3e3]">
                          {entry.score.toLocaleString("tr-TR")}
                        </div>
                        <div className="text-[9.5px] text-[#9b8e78]">Güç</div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <EconomySourcesPopover
        nation={inspectedEconomyNation}
        territories={territories}
        onClose={() => setInspectedEconomyNation(null)}
      />
    </div>
  );
};
