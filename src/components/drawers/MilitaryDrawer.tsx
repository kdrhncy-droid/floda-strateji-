import React, { useEffect, useMemo, useState } from "react";
import { Award, Coins, MapPin, Shield, Swords, TrendingUp, UserPlus } from "lucide-react";
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
  CommanderPortraitSvg,
  UnitTypeIllustrationSvg,
} from "../illustrations/AoH3Illustrations";

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
  const [rankingSortBy, setRankingSortBy] = useState<
    "SCORE" | "GDP" | "ARMY" | "TECH" | "PRESTIGE" | "CAPITAL"
  >("SCORE");
  const [recruitmentTab, setRecruitmentTab] = useState<"REGULAR" | "MERCENARY">("REGULAR");
  const [batchUnitMode, setBatchUnitMode] = useState<BatchRecruitUnitMode>("MIXED");

  const ownedProvinces = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNation.id)
        .sort((a, b) => Number(b.isCapital) - Number(a.isCapital) || b.garrison - a.garrison),
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
          return b.gdp + b.nation.treasury * 0.05 - (a.gdp + a.nation.treasury * 0.05);
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

  return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 6 Cols: AoH3 3-Line Recruitment & Mercenary Hiring, Army Modernization, Generals */}
              <div className="lg:col-span-6 space-y-4">
                {activeRecruitCity && (
                  <div className="bg-[#14110e] border border-[#caa15a]/50 rounded-2xl p-4 space-y-3 shadow-xl">
                    {/* Top Header + Resources */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-display font-bold text-amber-200 flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>AoH3 Ordugah &amp; Kiralık Asker Karargâhı</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono-num">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                          {Math.round(playerNation.treasury).toLocaleString('tr-TR')} Altın
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold"
                          title={`İnsan Gücü: ${Math.round(playerNation.manpower).toLocaleString('tr-TR')} / ${computeNationManpowerCap(playerNation, territories).toLocaleString('tr-TR')} (+${playerEconomy.dailyManpower.toLocaleString('tr-TR')}/gün)`}
                        >
                          {Math.round(playerNation.manpower).toLocaleString('tr-TR')} /{' '}
                          {(computeNationManpowerCap(playerNation, territories) / 1000).toFixed(0)}B İG
                          {playerNation.manpower < computeNationManpowerCap(playerNation, territories)
                            ? ` (+${playerEconomy.dailyManpower}/gün)`
                            : ' (MAX)'}
                        </span>
                      </div>
                    </div>

                    {/* AoH3 Mode Tabs: Regular Army (Nizamiye) vs Mercenary Hiring (Paralı Asker Kiralama) */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/50 border border-[#caa15a]/30">
                      <button
                        type="button"
                        data-testid="recruit-tab-regular"
                        onClick={() => setRecruitmentTab("REGULAR")}
                        className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          recruitmentTab === "REGULAR"
                            ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                            : "text-[#d8cbb5] hover:text-white"
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Nizamiye Ordu Bas (İG + Altın)</span>
                      </button>
                      <button
                        type="button"
                        data-testid="recruit-tab-mercenary"
                        onClick={() => setRecruitmentTab("MERCENARY")}
                        className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          recruitmentTab === "MERCENARY"
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow"
                            : "text-[#d8cbb5] hover:text-white"
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>Paralı Asker Kirala (0 İG)</span>
                      </button>
                    </div>

                    {/* Province / Barracks Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <label htmlFor="military-recruit-city" className="text-[11px] font-semibold text-[#c5b79e] shrink-0">
                        Toplanma Şehri:
                      </label>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <select
                          id="military-recruit-city"
                          value={activeRecruitCity.id}
                          onChange={(e) => setRecruitCityId(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/60 border border-[#caa15a]/40 text-xs font-semibold text-[#f3ead7] focus:outline-none focus:border-amber-400"
                        >
                          {ownedProvinces.map((prov) => (
                            <option key={prov.id} value={prov.id}>
                              {prov.isCapital ? '★ ' : ''}
                              {cleanProvinceName(prov.name)} ({(prov.garrison / 1000).toFixed(1)}B Garnizon)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onSelectTerritory(activeRecruitCity.id)}
                          title="Seçili şehri haritada göster"
                          className="px-2.5 py-1.5 rounded-xl bg-black/50 hover:bg-black/75 border border-[#caa15a]/35 text-[11px] font-semibold text-amber-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Odaklan</span>
                        </button>
                      </div>
                    </div>

                    {recruitmentTab === "REGULAR" ? (
                      /* AoH3 3-Line Tactical Recruitment Grid (1. Hat Piyade / Kanat Süvari / 2. Hat Topçu) */
                      <div className="space-y-2">
                        {[
                          {
                            unitType: "infantry" as const,
                            lineBadge: `1. HAT · ${activeArmyGen.infantryClassLabel.toUpperCase()}`,
                            title: activeArmyGen.infantryName,
                            shortName: activeArmyGen.infantryShort,
                            desc: "Ön cephede piyade ve okçu ateş desteğiyle ana savunma ve hücum hattını tutar.",
                            borderTone: "border-emerald-500/40 bg-emerald-950/20",
                            badgeTone: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
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
                            desc: "Hızlı kanat manevrası, atlı okçu tacizi ve ağır yarma taarruzu gerçekleştirir.",
                            borderTone: "border-amber-500/40 bg-amber-950/20",
                            badgeTone: "bg-amber-500/20 text-amber-300 border-amber-500/40",
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
                            desc: "Arka hattan düşman saflarını ve kale surlarını yoğun ateş altına alır.",
                            borderTone: "border-sky-500/40 bg-sky-950/20",
                            badgeTone: "bg-sky-500/20 text-sky-300 border-sky-500/40",
                            regiments: [
                              { amount: 1000, gold: 500, label: "+1.000" },
                              { amount: 2500, gold: 1100, label: "+2.500" },
                            ],
                          },
                        ].map((row) => (
                          <div
                            key={row.unitType}
                            className={`p-2.5 rounded-xl border ${row.borderTone} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UnitTypeIllustrationSvg
                                unitType={row.unitType}
                                modeId={gameMode}
                                className="w-9 h-9 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${row.badgeTone}`}>
                                    {row.lineBadge}
                                  </span>
                                  <span className="text-xs font-bold text-[#f3ead7] truncate">
                                    {row.title}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#b8a990] line-clamp-1 mt-0.5">
                                  {row.desc}
                                </p>
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
                                    className={`px-2.5 py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                      affordable
                                        ? "bg-black/60 hover:bg-amber-500/25 border-[#caa15a]/50 hover:border-amber-400 text-[#f3ead7]"
                                        : "bg-black/30 border-slate-800 text-slate-500 cursor-not-allowed"
                                    }`}
                                  >
                                    <div className="text-[11px] font-extrabold text-amber-300">
                                      {reg.label}
                                    </div>
                                    <div className="text-[9px] font-mono-num text-[#c5b79e]">
                                      {reg.gold}A · {(reg.amount / 1000).toFixed(reg.amount % 1000 === 0 ? 0 : 1)}B İG
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
                                  title={`Bu şehirde hazine ve insan gücünün yettiği kadar maksimum ${row.shortName} bas`}
                                  className="px-2.5 py-1.5 rounded-lg border border-amber-400/70 bg-amber-500/25 hover:bg-amber-500 hover:text-slate-950 text-amber-200 text-center transition-all cursor-pointer"
                                >
                                  <div className="text-[11px] font-extrabold">
                                    ⚡ Maks
                                  </div>
                                  <div className="text-[9px] font-mono-num opacity-90">
                                    {row.shortName}
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* AoH3 Toplu Asker Bas & Ulusal Seferberlik Panel */}
                        {onBatchRecruitUnits && (
                          <div
                            data-testid="military-batch-recruit-panel"
                            className="p-3 rounded-xl bg-black/55 border border-amber-500/45 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-display font-bold text-amber-200 flex items-center gap-1.5">
                                <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Toplu Asker Bas &amp; Ulusal Seferberlik</span>
                              </span>
                              <span className="text-[10px] text-[#c5b79e]">
                                Birlik sınıfı seçip tek tıkla tüm ülkeye basın
                              </span>
                            </div>

                            {/* Unit Class Selector for Batch Recruitment */}
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                {
                                  id: "MIXED" as const,
                                  label: "⚔️ Karma Ordu",
                                  sub: "Piyade+Süvari+Topçu",
                                  active: "bg-purple-500 text-white border-purple-300",
                                  idle: "bg-slate-900/90 text-purple-200 border-purple-500/40",
                                },
                                {
                                  id: "infantry" as const,
                                  label: `🛡 ${activeArmyGen.infantryShort}`,
                                  sub: "1. Hat Piyade",
                                  active: "bg-emerald-500 text-slate-950 border-emerald-300",
                                  idle: "bg-slate-900/90 text-emerald-200 border-emerald-500/40",
                                },
                                {
                                  id: "armor" as const,
                                  label: `🐎 ${activeArmyGen.armorShort}`,
                                  sub: "Kanat Süvari/Zırhlı",
                                  active: "bg-amber-500 text-slate-950 border-amber-300",
                                  idle: "bg-slate-900/90 text-amber-200 border-amber-500/40",
                                },
                                {
                                  id: "airDrone" as const,
                                  label: `💣 ${activeArmyGen.airArtilleryShort}`,
                                  sub: "2. Hat Topçu/Hava",
                                  active: "bg-sky-400 text-slate-950 border-sky-200",
                                  idle: "bg-slate-900/90 text-sky-200 border-sky-500/40",
                                },
                              ].map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  data-testid={`military-batch-mode-${u.id}`}
                                  onClick={() => setBatchUnitMode(u.id)}
                                  className={`px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                                    batchUnitMode === u.id ? u.active : u.idle
                                  }`}
                                >
                                  <div className="text-[10.5px] font-extrabold truncate">
                                    {u.label}
                                  </div>
                                  <div className="text-[9px] opacity-85 truncate">
                                    {u.sub}
                                  </div>
                                </button>
                              ))}
                            </div>

                            {/* Batch Scope Action Buttons */}
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
                                className="py-2 px-2.5 rounded-xl bg-emerald-600/85 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <span>🛡 Sınır Şehirlerine Toplu Bas</span>
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
                                className="py-2 px-2.5 rounded-xl bg-sky-600/85 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <span>🌍 Tüm Eyaletlere Toplu Bas</span>
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
                                className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <span>⚡ Seçili Şehirde Maks Bas</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* AoH3 Mercenary Hiring (Kiralık Ordu / Paralı Askerler — Instant Deployment, 0 Manpower Cost) */
                      <div className="space-y-2" data-testid="aoh3-mercenary-panel">
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between">
                          <span>
                            ⚡ <strong>Age of History 3 Paralı Asker Sistemi:</strong> İnsan gücü (İG) harcamaz, sadece Altın ile anında seçili şehre katılır!
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {MERCENARY_COMPANIES.map((merc) => {
                            const canAffordMerc = playerNation.treasury >= merc.costGold;
                            const title =
                              gameMode === "EMPIRES_1440"
                                ? merc.historicalName
                                : merc.modernName;
                            const desc = merc.tagline;
                            return (
                              <div
                                key={merc.id}
                                className="p-2.5 rounded-xl bg-black/55 border border-[#caa15a]/40 flex flex-col justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="text-xs font-display font-bold text-amber-200 flex items-center gap-1">
                                      <span>{merc.icon}</span>
                                      <span>{title}</span>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 font-mono-num text-[10px] font-extrabold text-emerald-300">
                                      +{(merc.troops / 1000).toFixed(1)}B Asker
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#b8a990] mt-1 leading-snug">
                                    {desc}
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-mono-num">
                                    {merc.composition.infantry > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                        Piyade {(merc.composition.infantry / 1000).toFixed(1)}B
                                      </span>
                                    )}
                                    {merc.composition.armor > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        Süvari/Zırhlı {(merc.composition.armor / 1000).toFixed(1)}B
                                      </span>
                                    )}
                                    {merc.composition.airDrone > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                        Topçu/Destek {(merc.composition.airDrone / 1000).toFixed(1)}B
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
                                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    canAffordMerc
                                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow"
                                      : "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                                  }`}
                                >
                                  <Swords className="w-3.5 h-3.5" />
                                  <span>
                                    Kirala ({merc.costGold} Altın · 0 İG)
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <ArmyModernizationCard
                  playerNation={playerNation}
                  totalGarrison={playerEconomy.totalGarrison}
                  gameMode={gameMode}
                  onModernizeNationalArmy={onModernizeNationalArmy}
                />

                {/* AoH3 Visual National Army Composition Strip */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center gap-2 bg-slate-900/90 border border-emerald-500/30 rounded-xl p-2 min-w-0">
                    <UnitTypeIllustrationSvg
                      unitType="infantry"
                      modeId={gameMode}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] text-emerald-300/90 font-bold truncate">
                        {activeArmyGen.infantryClassLabel}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">
                        {activeArmyGen.infantryShort}
                      </div>
                      <div className="font-mono-num text-xs font-bold text-emerald-300">
                        {(playerEconomy.totalUnits.infantry / 1000).toFixed(1)}B
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 rounded-xl p-2 min-w-0">
                    <UnitTypeIllustrationSvg
                      unitType="armor"
                      modeId={gameMode}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] text-amber-300/90 font-bold truncate">
                        {activeArmyGen.armorClassLabel}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">
                        {activeArmyGen.armorShort}
                      </div>
                      <div className="font-mono-num text-xs font-bold text-amber-300">
                        {(playerEconomy.totalUnits.armor / 1000).toFixed(1)}B
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900/90 border border-sky-500/30 rounded-xl p-2 min-w-0">
                    <UnitTypeIllustrationSvg
                      unitType="airDrone"
                      modeId={gameMode}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] text-sky-300/90 font-bold truncate">
                        {activeArmyGen.airArtilleryClassLabel}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">
                        {activeArmyGen.airArtilleryShort}
                      </div>
                      <div className="font-mono-num text-xs font-bold text-sky-300">
                        {(playerEconomy.totalUnits.airDrone / 1000).toFixed(1)}B
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generals / Bannerlord Clan Lords & Sancak Ordusu */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      {gameMode === 'EMPIRES_1440'
                        ? 'Paşalar, Sancak Beyleri ve Sefer Çağrısı'
                        : 'Klan Lordları, Komutanlar ve Sancak Çağrısı'}
                    </h3>
                    <div className="flex items-center gap-2 font-mono-num text-xs">
                      <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold">
                        ⚜ {playerNation.clanInfluence ?? 120} Nüfuz
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                        {activeArmyGen.generationLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Nüfuz (⚜) harcayarak Lordları <strong>Sancağa Çağırın</strong>; kuşatma ve taarruz seferlerinize kendi şahsi muhafız ordularıyla katılırlar!
                  </p>

                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {eraCommanders.map((cmd) => {
                      const isRecruited =
                        playerNation.recruitedGeneralIds?.includes(cmd.id);
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
                      const retinueSize = getLordRetinueTroops(
                        cmd.id,
                        territories
                      );
                      const canBestow =
                        isRecruited &&
                        Boolean(onBestowFavorOnLord) &&
                        playerNation.treasury >= BESTOW_FAVOR_GOLD_COST &&
                        (loyaltyInfo?.loyalty ?? 100) < 100;

                      return (
                        <div
                          key={cmd.id}
                          className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                            loyaltyInfo && loyaltyInfo.tone === 'ROSE'
                              ? 'bg-rose-950/35 border-rose-500/70'
                              : isActive
                              ? 'bg-amber-500/15 border-amber-500'
                              : isCalledToBanner
                              ? 'bg-purple-950/30 border-purple-500/50'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <CommanderPortraitSvg
                                specialty={
                                  cmd.attackBonus >= cmd.defenseBonus
                                    ? 'OFFENSE'
                                    : 'DEFENSE'
                                }
                                loyalty={loyaltyInfo?.loyalty ?? 85}
                                className="w-10 h-10 shrink-0"
                              />
                              <div>
                                <div className="text-xs font-bold text-white flex flex-wrap items-center gap-1.5">
                                  <span>{cmd.name}</span>
                                  {fiefCount > 0 && (
                                    <span className="text-[10px] font-semibold text-purple-300">
                                      ({fiefCount} Tımar)
                                    </span>
                                  )}
                                  {loyaltyInfo && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono-num font-bold ${
                                        loyaltyInfo.tone === 'ROSE'
                                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50'
                                          : loyaltyInfo.tone === 'AMBER'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          : loyaltyInfo.tone === 'SKY'
                                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      }`}
                                    >
                                      ♥ %{loyaltyInfo.loyalty} {loyaltyInfo.statusLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {cmd.title} · Şahsi Sancak Birliği:{' '}
                                  <strong className="font-mono-num text-amber-300">
                                    +{(retinueSize / 1000).toFixed(1)}B Asker
                                  </strong>
                                </div>
                                <div className="font-mono-num text-[11px] text-emerald-400 mt-0.5">
                                  Taarruz +%{cmd.attackBonus} · Savunma +%
                                  {cmd.defenseBonus} · Kayıp -%{cmd.casualtyReduction}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {isRecruited && onBestowFavorOnLord && (
                                <button
                                  onClick={() => onBestowFavorOnLord(cmd.id)}
                                  disabled={!canBestow}
                                  title={`Paşaya Hil'at & İhsan takdim et (${BESTOW_FAVOR_GOLD_COST} Altın -> +18 Sadakat)`}
                                  className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-[11px] font-bold transition-colors ${
                                    canBestow
                                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40'
                                      : 'bg-slate-800/70 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                                  }`}
                                >
                                  🎁 İhsan ({BESTOW_FAVOR_GOLD_COST}A)
                                </button>
                              )}
                              {isRecruited && (
                                <button
                                  onClick={() => onToggleCallLordToBanner(cmd.id)}
                                  className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                                    isCalledToBanner
                                      ? 'bg-purple-600 text-white border border-purple-400'
                                      : 'bg-purple-950/60 hover:bg-purple-900/70 text-purple-200 border border-purple-500/40'
                                  }`}
                                >
                                  {isCalledToBanner
                                    ? '⚜ Sancakta'
                                    : 'Sancağa Çağır (35 ⚜)'}
                                </button>
                              )}
                              <button
                                onClick={() => onRecruitOrAssignGeneral(cmd.id)}
                                disabled={!isRecruited && !canAfford}
                                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold shrink-0 transition-colors ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950'
                                    : isRecruited
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    : canAfford
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                {isActive
                                  ? 'Başkomutan'
                                  : isRecruited
                                  ? 'Serdar Ata'
                                  : `Atama (${cmd.costGold} Altın)`}
                              </button>
                            </div>
                          </div>

                          {/* Loyalty Progress Bar & Warning Reason */}
                          {loyaltyInfo && (
                            <div className="space-y-1">
                              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    loyaltyInfo.tone === 'ROSE'
                                      ? 'bg-rose-500'
                                      : loyaltyInfo.tone === 'AMBER'
                                      ? 'bg-amber-400'
                                      : loyaltyInfo.tone === 'SKY'
                                      ? 'bg-sky-400'
                                      : 'bg-emerald-400'
                                  }`}
                                  style={{ width: `${loyaltyInfo.loyalty}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>
                                  {loyaltyInfo.warningReason
                                    ? `⚠️ ${loyaltyInfo.warningReason}`
                                    : '✓ Tımar idaresinden hoşnut (%25 altında isyan riski doğar)'}
                                </span>
                                <span className="font-mono-num">
                                  Haftalık: {loyaltyInfo.weeklyDrift >= 0 ? `+${loyaltyInfo.weeklyDrift}` : loyaltyInfo.weeklyDrift}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 6 Cols: Filterable 6-Pillar Global Superpower Leaderboard */}
              <div className="lg:col-span-6 bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#e0b86e]" />
                    {gameMode === 'EMPIRES_1440'
                      ? '1440 İmparatorluk Güç Sıralaması (6 Kriter)'
                      : '2026 Küresel Süper Güç Sıralaması (6 Kriter)'}
                  </h3>
                  {playerRankIndex >= 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#caa15a]/20 border border-[#caa15a]/45 font-mono-num text-xs font-bold text-amber-200">
                      Dünya Sıranız: #{playerRankIndex + 1} / {rankedList.length}
                    </span>
                  )}
                </div>

                {/* 6-Way AoH3 Sort Filter: Toplam Güç, Ekonomi, Ordu, Teknoloji, Prestij, Başkent & Toprak */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-[#0f0c09] p-1 rounded-xl border border-[#caa15a]/30">
                  {(
                    [
                      { id: 'SCORE', label: 'Toplam Güç' },
                      { id: 'GDP', label: 'Ekonomi' },
                      { id: 'ARMY', label: 'Ordu' },
                      { id: 'TECH', label: 'Teknoloji' },
                      { id: 'PRESTIGE', label: 'Prestij' },
                      { id: 'CAPITAL', label: 'Bşk. & Toprak' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      data-testid={`power-rank-sort-${tab.id}`}
                      onClick={() => setRankingSortBy(tab.id)}
                      className={`py-1.5 px-1.5 rounded-lg text-[10.5px] font-bold transition-colors truncate cursor-pointer ${
                        rankingSortBy === tab.id
                          ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]'
                          : 'text-[#b8a990] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {rankedList.slice(0, 45).map((entry, idx) => (
                    <button
                      key={entry.nation.id}
                      onClick={() =>
                        onSelectTerritory(entry.nation.capitalTerritoryId)
                      }
                      className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        entry.nation.id === playerNation.id
                          ? 'bg-[#211a12] border-[#caa15a]/75 shadow'
                          : 'bg-[#18130e] hover:bg-[#221b14] border-[#caa15a]/25'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-num text-xs font-bold text-[#b8a990] w-6 shrink-0">
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
                              <span className="ml-1.5 text-[10px] text-amber-300 font-normal">
                                (Vasal)
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-[#c5b79e] font-mono-num flex flex-wrap items-center gap-x-1.5">
                            <span className="text-emerald-300 font-semibold">
                              {(entry.army / 1000).toFixed(1)}B Ordu
                            </span>
                            <span>·</span>
                            <span className="text-amber-300 font-semibold">
                              {Math.floor(entry.nation.treasury).toLocaleString('tr-TR')} A
                            </span>
                            <span>·</span>
                            <span className="text-sky-300">
                              Tek.{entry.techLevel.toFixed(1)}
                            </span>
                            <span>·</span>
                            <span>
                              Bşk.{entry.capitalLevel} · {entry.ownedCount} Ey.
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono-num shrink-0">
                        <div className="text-xs font-bold text-amber-300">
                          {entry.score.toLocaleString('tr-TR')} Puan
                        </div>
                        <div className="text-[10px] text-[#b8a990]">
                          {Math.round(entry.gdp)} GSYİH · ★{entry.prestige}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
  );
};
