import React, { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import { ArmyModernizationCard } from "./ArmyModernizationCard";
import {
  computeNationTechMetrics,
  getArmyGenerationInfo,
  getCommandersForMode,
  getNationModernizedTier,
} from "../../data/world2026Data";
import {
  BatchRecruitUnitMode,
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
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  AoH3MenuBanner,
  CommanderPortraitSvg,
  UnitTypeIllustrationSvg,
} from "../illustrations/AoH3Illustrations";

type MilitaryTab = "RECRUIT" | "COMMANDERS" | "RANKINGS";

export const MilitaryDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  playerEconomy,
  selectedTerritory,
  territories,
  nations,
  onRecruitUnit,
  onBatchRecruitUnits,
  onHireMercenary,
  onRecruitOrAssignGeneral,
  onBestowFavorOnLord,
  onToggleCallLordToBanner,
  onModernizeNationalArmy,
  onSelectTerritory,
  gameMode = "EMPIRES_1440",
}) => {
  const [militaryTab, setMilitaryTab] = useState<MilitaryTab>("RECRUIT");
  const [rankingSortBy, setRankingSortBy] = useState<
    "SCORE" | "GDP" | "ARMY" | "TECH" | "PRESTIGE" | "CAPITAL"
  >("SCORE");
  const [recruitmentTab, setRecruitmentTab] = useState<"REGULAR" | "MERCENARY">(
    "REGULAR"
  );
  const [batchUnitMode, setBatchUnitMode] =
    useState<BatchRecruitUnitMode>("MIXED");

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
  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const manpowerCap = computeNationManpowerCap(playerNation, territories);

  const { fiefCountByCommander, rankedList, playerRankIndex } = useMemo(() => {
    const fiefCounts = new Map<string, number>();
    const statsByNation = new Map<
      string,
      { ownedCount: number; army: number; gdp: number }
    >();

    for (const t of Object.values(territories)) {
      if (!t) continue;
      if (t.ownerId === playerNation.id && t.fiefLordId) {
        fiefCounts.set(t.fiefLordId, (fiefCounts.get(t.fiefLordId) || 0) + 1);
      }
      const prev = statsByNation.get(t.ownerId) || {
        ownedCount: 0,
        army: 0,
        gdp: 0,
      };
      prev.ownedCount += 1;
      prev.army += t.garrison || 0;
      prev.gdp +=
        t.baseGdp *
        (1 +
          (t.buildings.factory || 0) * 0.25 +
          (t.buildings.capitalPalace || 0) * 0.15);
      statsByNation.set(t.ownerId, prev);
    }

    const list = Object.values(nations)
      .filter((n) => !n.isEliminated)
      .map((n) => {
        const st = statsByNation.get(n.id) || {
          ownedCount: 0,
          army: 0,
          gdp: 0,
        };
        const metrics = computeNationTechMetrics(n, territories, gameMode);
        const economyScore = Math.round(st.gdp * 1.9 + n.treasury * 0.08);
        const armyScore = Math.round(st.army / 180);
        const techScore = Math.round(metrics.techLevel * 120);
        const prestigeScore = Math.round(metrics.prestige * 1.15);
        const capitalTerritoryScore = Math.round(
          metrics.capitalLevel * 95 + st.ownedCount * 48
        );
        const score =
          economyScore +
          armyScore +
          techScore +
          prestigeScore +
          capitalTerritoryScore;
        return {
          nation: n,
          ownedCount: st.ownedCount,
          army: st.army,
          gdp: st.gdp,
          techLevel: metrics.techLevel,
          maxTechLevel: metrics.maxTechLevel,
          capitalLevel: metrics.capitalLevel,
          prestige: metrics.prestige,
          score,
        };
      })
      .sort((a, b) => {
        if (rankingSortBy === "GDP")
          return (
            b.gdp + b.nation.treasury * 0.05 - (a.gdp + a.nation.treasury * 0.05)
          );
        if (rankingSortBy === "ARMY") return b.army - a.army;
        if (rankingSortBy === "TECH")
          return b.techLevel - a.techLevel || b.score - a.score;
        if (rankingSortBy === "PRESTIGE")
          return b.prestige - a.prestige || b.score - a.score;
        if (rankingSortBy === "CAPITAL")
          return (
            b.capitalLevel * 10 +
            b.ownedCount -
            (a.capitalLevel * 10 + a.ownedCount) || b.score - a.score
          );
        return b.score - a.score;
      });

    return {
      fiefCountByCommander: fiefCounts,
      rankedList: list,
      playerRankIndex: list.findIndex((r) => r.nation.id === playerNation.id),
    };
  }, [territories, nations, playerNation.id, rankingSortBy, gameMode]);

  const unitRows = [
    {
      unitType: "infantry" as const,
      lineBadge: `1. HAT · ${activeArmyGen.infantryClassLabel.toUpperCase()}`,
      title: activeArmyGen.infantryName,
      shortName: activeArmyGen.infantryShort,
      atk: 14 + modernizedTier * 5,
      def: 16 + modernizedTier * 5,
      spd: (4.5 + modernizedTier * 0.4).toFixed(1),
      regiments: [
        { amount: 1000, gold: 120, label: "+1.000" },
        { amount: 3000, gold: 200, label: "+3.000" },
        { amount: 5000, gold: 250, label: "+5.000" },
      ],
    },
    {
      unitType: "armor" as const,
      lineBadge: `KANAT · ${activeArmyGen.armorClassLabel.toUpperCase()}`,
      title: activeArmyGen.armorName,
      shortName: activeArmyGen.armorShort,
      atk: 20 + modernizedTier * 6,
      def: 12 + modernizedTier * 4,
      spd: (7.8 + modernizedTier * 0.6).toFixed(1),
      regiments: [
        { amount: 1000, gold: 180, label: "+1.000" },
        { amount: 2500, gold: 420, label: "+2.500" },
        { amount: 5000, gold: 780, label: "+5.000" },
      ],
    },
    {
      unitType: "airDrone" as const,
      lineBadge: `2. HAT · ${activeArmyGen.airArtilleryClassLabel.toUpperCase()}`,
      title: activeArmyGen.airArtilleryName,
      shortName: activeArmyGen.airArtilleryShort,
      atk: 24 + modernizedTier * 7,
      def: 8 + modernizedTier * 3,
      spd: (3.8 + modernizedTier * 0.7).toFixed(1),
      regiments: [
        { amount: 1000, gold: 500, label: "+1.000" },
        { amount: 2500, gold: 1100, label: "+2.500" },
      ],
    },
  ];

  const bannerCfg =
    militaryTab === "RECRUIT"
      ? {
          artKey: "INFANTRY" as const,
          branch: "MILITARY" as const,
          title: "Ordugâh & Seferberlik",
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

      {/* AoH3 3-Tab Switcher: Ordu Bas · Paşalar · Sıralama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Ordu ve Sıralama Sekmeleri"
          className="grid grid-cols-3 gap-1 bg-[#120e0a] p-1 rounded-xl border border-[#caa15a]/30 w-full sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={militaryTab === "RECRUIT"}
            data-testid="mil-tab-recruit"
            onClick={() => setMilitaryTab("RECRUIT")}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              militaryTab === "RECRUIT"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow"
                : "text-[#d8cbb5] hover:text-[#faf3e3]"
            }`}
          >
            <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 shrink-0" />
            <span>Ordu Bas</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={militaryTab === "COMMANDERS"}
            data-testid="mil-tab-commanders"
            onClick={() => setMilitaryTab("COMMANDERS")}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              militaryTab === "COMMANDERS"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow"
                : "text-[#d8cbb5] hover:text-[#faf3e3]"
            }`}
          >
            <AoH3GlyphSvg name="crown" className="w-3.5 h-3.5 shrink-0" />
            <span>
              {gameMode === "EMPIRES_1440" ? "Paşalar" : "Komutanlar"}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={militaryTab === "RANKINGS"}
            data-testid="mil-tab-rankings"
            onClick={() => setMilitaryTab("RANKINGS")}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              militaryTab === "RANKINGS"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow"
                : "text-[#d8cbb5] hover:text-[#faf3e3]"
            }`}
          >
            <AoH3GlyphSvg name="trophy" className="w-3.5 h-3.5 shrink-0" />
            <span>Sıralama</span>
          </button>
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
                                  {reg.gold}A ·{" "}
                                  {(reg.amount / 1000).toFixed(
                                    reg.amount % 1000 === 0 ? 0 : 1
                                  )}
                                  B
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
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="trophy" className="w-4 h-4 text-[#e0b86e]" />
              <span>
                {gameMode === "EMPIRES_1440"
                  ? "1440 Devlet Güç Sıralaması"
                  : "2026 Küresel Güç Sıralaması"}
              </span>
            </h3>
            {playerRankIndex >= 0 && (
              <span className="font-mono-num text-xs font-bold text-[#e0b86e]">
                Sıranız: #{playerRankIndex + 1} / {rankedList.length}
              </span>
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

          <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
            {rankedList.slice(0, 45).map((entry, idx) => (
              <button
                key={entry.nation.id}
                type="button"
                onClick={() =>
                  onSelectTerritory(entry.nation.capitalTerritoryId)
                }
                className={`w-full min-h-[48px] px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  entry.nation.id === playerNation.id
                    ? "bg-[#211a12] border-[#e0b86e] shadow"
                    : "bg-[#18130e] hover:bg-[#221b14] border-[#caa15a]/25"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono-num text-xs font-bold text-[#e0b86e] w-6 shrink-0">
                    #{idx + 1}
                  </span>
                  <NationFlagCanvasBadge
                    nationId={entry.nation.id}
                    flagCode={entry.nation.flagCode}
                    color={entry.nation.color}
                    width={34}
                    height={24}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#f3ead7] truncate">
                      {cleanNationName(entry.nation.name)}
                      {entry.nation.vassalOf && (
                        <span className="ml-1.5 text-[10px] text-[#e0b86e] font-normal">
                          (Vasal)
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#c5b79e] font-mono-num flex flex-wrap items-center gap-x-1.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#f3ead7]">
                        <AoH3GlyphSvg name="sword" className="w-2.5 h-2.5 text-[#e0b86e]" />
                        <span>{(entry.army / 1000).toFixed(1)}B</span>
                      </span>
                      <span>·</span>
                      <span className="text-[#e0b86e] font-semibold">
                        {Math.floor(entry.nation.treasury).toLocaleString("tr-TR")} A
                      </span>
                      <span>·</span>
                      <span>Tek.{entry.techLevel.toFixed(1)}</span>
                      <span>·</span>
                      <span>{entry.ownedCount} Ey.</span>
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono-num shrink-0">
                  <div className="text-xs font-bold text-[#e0b86e]">
                    {entry.score.toLocaleString("tr-TR")}
                  </div>
                  <div className="text-[10px] text-[#b8a990] inline-flex items-center justify-end gap-0.5">
                    <AoH3GlyphSvg name="star" className="w-2.5 h-2.5 text-[#e0b86e]" />
                    <span>{entry.prestige}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
