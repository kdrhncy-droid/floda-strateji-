import React from "react";
import { Check, Lock } from "lucide-react";
import { GameModeId, Nation, Territory } from "../../../types/game";
import { NationEconomyBreakdown } from "../../../engine/simulationEngine";
import { ArmyModernizationCard } from "../ArmyModernizationCard";
import { ARMY_GENERATIONS_1440 } from "../../../data/world2026Data";
import { calculateRecruitGoldCost } from "../../../engine/empireAndArmyActions";
import { cleanProvinceName } from "../../../utils/formatters";
import { UnitEraArtworkThumb } from "../UnitEraArtworkThumb";

export interface UnitTreeSectionProps {
  playerNation: Nation;
  playerEconomy: NationEconomyBreakdown;
  gameMode: GameModeId;
  ownedProvinces: Territory[];
  activeRecruitCity: Territory | null;
  setRecruitCityId: (id: string) => void;
  generationList: typeof ARMY_GENERATIONS_1440;
  unlockedMilTier: number;
  modernizedTier: number;
  onModernizeNationalArmy: () => void;
  onRecruitUnit: (
    territoryId: string,
    unitType: "infantry" | "armor" | "airDrone",
    amount: number,
    goldCost: number
  ) => void;
  onOpenRecruitTab: () => void;
}

export const UnitTreeSection: React.FC<UnitTreeSectionProps> = ({
  playerNation,
  playerEconomy,
  gameMode,
  ownedProvinces,
  activeRecruitCity,
  setRecruitCityId,
  generationList,
  unlockedMilTier,
  modernizedTier,
  onModernizeNationalArmy,
  onRecruitUnit,
  onOpenRecruitTab,
}) => {
  return (
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
                    {cleanProvinceName(prov.name)} (
                    {(prov.garrison / 1000).toFixed(1)}B)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenRecruitTab}
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
          {[
            {
              unitType: "infantry" as const,
              rowLabel: "1. Hat · Piyade",
              goldCost: calculateRecruitGoldCost("infantry", 1000, playerNation),
              getName: (g: (typeof generationList)[number]) => g.infantryName,
              getClass: (g: (typeof generationList)[number]) =>
                g.infantryClassLabel,
              getAtk: (t: number) => 14 + t * 5,
              getDef: (t: number) => 16 + t * 5,
              getSpd: (t: number) => (4.5 + t * 0.4).toFixed(1),
            },
            {
              unitType: "armor" as const,
              rowLabel: "Kanat · Süvari / Zırhlı",
              goldCost: calculateRecruitGoldCost("armor", 1000, playerNation),
              getName: (g: (typeof generationList)[number]) => g.armorName,
              getClass: (g: (typeof generationList)[number]) =>
                g.armorClassLabel,
              getAtk: (t: number) => 20 + t * 6,
              getDef: (t: number) => 12 + t * 4,
              getSpd: (t: number) => (7.8 + t * 0.6).toFixed(1),
            },
            {
              unitType: "airDrone" as const,
              rowLabel: "2. Hat · Topçu / SİHA",
              goldCost: calculateRecruitGoldCost("airDrone", 1000, playerNation),
              getName: (g: (typeof generationList)[number]) =>
                g.airArtilleryName,
              getClass: (g: (typeof generationList)[number]) =>
                g.airArtilleryClassLabel,
              getAtk: (t: number) => 24 + t * 7,
              getDef: (t: number) => 8 + t * 3,
              getSpd: (t: number) => (3.8 + t * 0.7).toFixed(1),
            },
          ].map((line) => (
            <div
              key={line.unitType}
              className="grid gap-2 items-stretch"
              style={{
                gridTemplateColumns: `110px repeat(${generationList.length}, minmax(135px, 1fr))`,
              }}
            >
              <div className="rounded-xl bg-[#18130e] border border-[#caa15a]/25 p-2 flex flex-col items-center justify-center text-center gap-1.5">
                <UnitEraArtworkThumb
                  unitType={line.unitType}
                  gameMode={gameMode}
                  tier={modernizedTier}
                  alt={line.rowLabel}
                  className="w-14 h-10 rounded-lg"
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
                    className={`relative rounded-xl p-2 border flex flex-col justify-between gap-1.5 transition-all group ${
                      isCurrent
                        ? "bg-gradient-to-b from-[#2b2013] to-[#1a140d] border-[#e0b86e] shadow-md"
                        : unlocked
                        ? "bg-[#1a1510] border-[#caa15a]/45"
                        : "bg-[#13100c] border-[#2d251d] opacity-65"
                    }`}
                  >
                    <div className="relative">
                      <UnitEraArtworkThumb
                        unitType={line.unitType}
                        gameMode={gameMode}
                        tier={gen.tier}
                        alt={line.getName(gen)}
                        showEraPill
                        className="w-full h-14 rounded-lg"
                      />
                      <span className="absolute top-1 right-1 p-0.5 rounded bg-black/75 border border-[#caa15a]/35">
                        {unlocked ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 text-[#7c6f5b] shrink-0" />
                        )}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10.5px] font-bold text-[#f3ead7] leading-tight line-clamp-2">
                        {line.getName(gen)}
                      </div>
                      <div className="text-[9px] text-[#b8a990] truncate">
                        {line.getClass(gen)}
                      </div>
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
  );
};
