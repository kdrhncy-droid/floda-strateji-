import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { GameModeId, Nation, Territory } from "../../../types/game";
import { NationEconomyBreakdown } from "../../../engine/simulationEngine";
import { ArmyModernizationCard } from "../ArmyModernizationCard";
import { getArmyGenerationInfo } from "../../../data/world2026Data";
import {
  BatchRecruitUnitMode,
  calculateRecruitGoldCost,
  calculateRecruitmentDurationDays,
  MERCENARY_COMPANIES,
} from "../../../engine/empireAndArmyActions";
import { cleanProvinceName } from "../../../utils/formatters";
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
} from "../../illustrations/AoH3Illustrations";
import { UnitEraArtworkThumb } from "../UnitEraArtworkThumb";

export interface RecruitMercenarySectionProps {
  playerNation: Nation;
  playerEconomy: NationEconomyBreakdown;
  gameMode: GameModeId;
  ownedProvinces: Territory[];
  activeRecruitCity: Territory | null;
  setRecruitCityId: (id: string) => void;
  modernizedTier: number;
  activeArmyGen: ReturnType<typeof getArmyGenerationInfo>;
  onSelectTerritory: (territoryId: string) => void;
  onRecruitUnit: (
    territoryId: string,
    unitType: "infantry" | "armor" | "airDrone",
    amount: number,
    goldCost: number
  ) => void;
  onBatchRecruitUnits?: (
    scope: "BORDER" | "ALL" | "SINGLE_MAX",
    unitMode: BatchRecruitUnitMode,
    targetTerritoryId?: string,
    regimentsPerProvince?: number
  ) => void;
  onHireMercenary?: (territoryId: string, companyId: string) => void;
  onModernizeNationalArmy: () => void;
}

export const RecruitMercenarySection: React.FC<RecruitMercenarySectionProps> = ({
  playerNation,
  playerEconomy,
  gameMode,
  ownedProvinces,
  activeRecruitCity,
  setRecruitCityId,
  modernizedTier,
  activeArmyGen,
  onSelectTerritory,
  onRecruitUnit,
  onBatchRecruitUnits,
  onHireMercenary,
  onModernizeNationalArmy,
}) => {
  const [recruitmentTab, setRecruitmentTab] = useState<"REGULAR" | "MERCENARY">(
    "REGULAR"
  );
  const [batchUnitMode, setBatchUnitMode] =
    useState<BatchRecruitUnitMode>("MIXED");

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-7 space-y-3">
        {activeRecruitCity && (
          <div className="bg-[#14110e] border border-[#caa15a]/45 rounded-2xl p-3.5 space-y-3 shadow-xl">
            {/* Header & Resource Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                <AoH3GlyphSvg
                  name="users"
                  className="w-4 h-4 text-[#e0b86e] shrink-0"
                />
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
              <label htmlFor="military-recruit-city" className="sr-only">
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
                      Bakım -%
                      {Math.min(
                        60,
                        (activeRecruitCity.buildings.armyHearth ?? 0) * 12
                      )}{" "}
                      · Süre -%
                      {Math.min(
                        60,
                        (activeRecruitCity.buildings.armyHearth ?? 0) * 15
                      )}
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
                          Math.round(
                            (doneDays / Math.max(1, job.totalDays)) * 100
                          )
                        )
                      : 0;
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-2 text-[10.5px] text-[#e8dcc8] bg-[#1c1610] px-2 py-1 rounded-lg border border-[#caa15a]/25"
                    >
                      <span className="truncate font-semibold">
                        {idx === 0 ? "Eğitimde" : `Sırada #${idx + 1}`}:{" "}
                        {job.label} (+{(job.troops || 0).toLocaleString("tr-TR")})
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
                      <UnitEraArtworkThumb
                        unitType={row.unitType}
                        gameMode={gameMode}
                        tier={modernizedTier}
                        alt={row.title}
                        showEraPill
                        className="w-16 h-12 rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#e0b86e]">
                          {row.lineBadge}
                        </div>
                        <div className="text-xs font-bold text-[#f3ead7] truncate">
                          {row.title}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono-num font-bold text-[#d8cbb5]">
                          <span
                            className="inline-flex items-center gap-1"
                            title="Saldırı Gücü"
                          >
                            <AoH3GlyphSvg
                              name="sword"
                              className="w-3 h-3 text-[#e0b86e]"
                            />
                            <span>{row.atk}</span>
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            title="Savunma Gücü"
                          >
                            <AoH3GlyphSvg
                              name="shield"
                              className="w-3 h-3 text-[#e0b86e]"
                            />
                            <span>{row.def}</span>
                          </span>
                          <span
                            className="inline-flex items-center gap-0.5"
                            title="Hareket Hızı"
                          >
                            <AoH3GlyphSvg
                              name="speed"
                              className="w-3.5 h-3.5 text-[#e0b86e]"
                            />
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
                            <AoH3GlyphSvg
                              name="bolt"
                              className="w-3 h-3 shrink-0"
                            />
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

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono-num font-bold text-[#d8cbb5]">
                            <span className="inline-flex items-center gap-1">
                              <AoH3GlyphSvg
                                name="sword"
                                className="w-3 h-3 text-[#e0b86e]"
                              />
                              <span>{mercAtk}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <AoH3GlyphSvg
                                name="shield"
                                className="w-3 h-3 text-[#e0b86e]"
                              />
                              <span>{mercDef}</span>
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <AoH3GlyphSvg
                                name="speed"
                                className="w-3.5 h-3.5 text-[#e0b86e]"
                              />
                              <span>{mercSpd}</span>
                            </span>
                          </div>

                          <div className="mt-1.5 text-[10px] font-mono-num text-[#b8a990] flex flex-wrap gap-x-2">
                            {merc.composition.infantry > 0 && (
                              <span>
                                Piy{" "}
                                {(merc.composition.infantry / 1000).toFixed(1)}B
                              </span>
                            )}
                            {merc.composition.armor > 0 && (
                              <span>
                                Süv {(merc.composition.armor / 1000).toFixed(1)}B
                              </span>
                            )}
                            {merc.composition.airDrone > 0 && (
                              <span>
                                Top{" "}
                                {(merc.composition.airDrone / 1000).toFixed(1)}B
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
                          <AoH3GlyphSvg
                            name="sword"
                            className="w-3.5 h-3.5 shrink-0"
                          />
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
                <AoH3GlyphSvg
                  name="sword"
                  className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                />
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
                <AoH3GlyphSvg
                  name="shield"
                  className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                />
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
                <AoH3GlyphSvg
                  name="globe"
                  className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                />
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

        {/* Visual National Army Composition Strip */}
        <div className="grid grid-cols-3 gap-2 bg-[#14100c] border border-[#caa15a]/30 rounded-2xl p-2.5">
          <div className="flex items-center gap-2 bg-[#1b1510] border border-[#caa15a]/30 rounded-xl p-2 min-w-0">
            <UnitEraArtworkThumb
              unitType="infantry"
              gameMode={gameMode}
              tier={modernizedTier}
              alt={activeArmyGen.infantryShort}
              className="w-9 h-9 rounded-lg"
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
            <UnitEraArtworkThumb
              unitType="armor"
              gameMode={gameMode}
              tier={modernizedTier}
              alt={activeArmyGen.armorShort}
              className="w-9 h-9 rounded-lg"
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
            <UnitEraArtworkThumb
              unitType="airDrone"
              gameMode={gameMode}
              tier={modernizedTier}
              alt={activeArmyGen.airArtilleryShort}
              className="w-9 h-9 rounded-lg"
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
  );
};
