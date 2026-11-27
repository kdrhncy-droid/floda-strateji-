import React from "react";
import { Crown } from "lucide-react";
import {
  GameModeId,
  IdeologyId,
  Nation,
  Territory,
} from "../../../types/game";
import { NationEconomyBreakdown } from "../../../engine/simulationEngine";
import { ArmyModernizationCard } from "../ArmyModernizationCard";
import {
  FORMABLE_EMPIRES,
  getReformsForMode,
  IDEOLOGIES,
} from "../../../data/world2026Data";
import { AoH3GlyphName, AoH3GlyphSvg } from "../../illustrations/AoH3Illustrations";

const IDEOLOGY_GLYPHS: Record<string, AoH3GlyphName> = {
  DEMOCRACY: "scale",
  AUTHORITARIAN: "shield",
  MONARCHY: "crown",
  SOCIALIST: "star",
  MILITARY_JUNTA: "sword",
  TECHNO_CORPORATISM: "science",
};

const REFORM_GLYPHS: AoH3GlyphName[] = [
  "scroll",
  "sword",
  "anchor",
  "hammer",
  "science",
  "scale",
];

export interface StateReformsSectionProps {
  playerNation: Nation;
  playerEconomy: NationEconomyBreakdown;
  territories: Record<string, Territory>;
  activeReforms: ReturnType<typeof getReformsForMode>;
  gameMode: GameModeId;
  onChangeIdeology: (ideology: IdeologyId) => void;
  onEnactReform: (reformId: string) => void;
  onFormEmpire: (empireId: string) => void;
  onModernizeNationalArmy: () => void;
}

export const StateReformsSection: React.FC<StateReformsSectionProps> = ({
  playerNation,
  playerEconomy,
  territories,
  activeReforms,
  gameMode,
  onChangeIdeology,
  onEnactReform,
  onFormEmpire,
  onModernizeNationalArmy,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left 6 Cols: Ideology + Army Modernization */}
      <div className="lg:col-span-6 space-y-4">
        <ArmyModernizationCard
          playerNation={playerNation}
          totalGarrison={playerEconomy.totalGarrison}
          gameMode={gameMode}
          onModernizeNationalArmy={onModernizeNationalArmy}
        />

        <div className="bg-[#15110d] border border-[#caa15a]/30 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-display font-bold text-[#f3ead7]">
            Devlet İdeolojisi ve Rejim Seçimi
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(IDEOLOGIES).map((ideo) => {
              const isCurrent = playerNation.ideology === ideo.id;
              const glyphName = IDEOLOGY_GLYPHS[ideo.id] ?? "crown";
              return (
                <button
                  type="button"
                  key={ideo.id}
                  onClick={() => onChangeIdeology(ideo.id)}
                  aria-pressed={isCurrent}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    isCurrent
                      ? "bg-[#241c13] border-2 border-[#e0b86e] text-[#faf3e3] shadow-lg"
                      : "bg-[#1a1510] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/55"
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCurrent
                        ? "bg-[#2c2216] border-[#e0b86e]/60 text-[#e0b86e]"
                        : "bg-[#14100c] border-[#caa15a]/30 text-[#caa15a]"
                    }`}
                    aria-hidden="true"
                  >
                    <AoH3GlyphSvg name={glyphName} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#faf3e3] truncate">
                      {ideo.name}
                    </div>
                    <div className="text-[10px] font-mono-num text-[#d8cbb5] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#e0b86e]">
                        Vergi{" "}
                        {ideo.taxBonus >= 0 ? `+${ideo.taxBonus}` : ideo.taxBonus}
                      </span>
                      <span className="opacity-40">·</span>
                      <span
                        className={
                          ideo.militaryAttackBonus < 0
                            ? "text-rose-300"
                            : "text-[#f3ead7]"
                        }
                      >
                        Ordu{" "}
                        {ideo.militaryAttackBonus >= 0
                          ? `+${ideo.militaryAttackBonus}`
                          : ideo.militaryAttackBonus}
                      </span>
                      {isCurrent && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="text-[#e0b86e] font-bold">Aktif</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right 6 Cols: National Reforms + Formable Empires */}
      <div className="lg:col-span-6 space-y-4">
        {/* National Reforms */}
        <div className="bg-[#15110d] border border-[#caa15a]/30 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-display font-bold text-[#f3ead7]">
            Ulusal Reformlar ve Kanunlar
          </h3>
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {activeReforms.map((ref, reformIndex) => {
              const enacted = playerNation.enactedReforms.includes(ref.id);
              const canAfford =
                !enacted &&
                playerNation.treasury >= ref.costGold &&
                playerNation.researchPoints >= ref.costResearch;
              const reformGlyph =
                REFORM_GLYPHS[reformIndex % REFORM_GLYPHS.length];
              return (
                <div
                  key={ref.id}
                  className="bg-[#1b1611] border border-[#caa15a]/25 rounded-xl p-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[#241c13] border border-[#caa15a]/35 text-[#e0b86e] flex items-center justify-center shrink-0">
                      <AoH3GlyphSvg name={reformGlyph} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#faf3e3] truncate">
                        {ref.name}
                      </div>
                      <div className="text-[10px] text-[#e0b86e] line-clamp-1">
                        {ref.effectLabel}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onEnactReform(ref.id)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap cursor-pointer ${
                      enacted
                        ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/40 cursor-default"
                        : canAfford
                        ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e]"
                        : "bg-[#120f0c] text-[#7c6f5c] border border-[#352b20] cursor-not-allowed"
                    }`}
                  >
                    {enacted
                      ? "Yürürlükte"
                      : `${ref.costGold}G · ${ref.costResearch} RP`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formable Empires */}
        <div className="bg-[#15110d] border border-[#caa15a]/45 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-display font-bold text-[#e0b86e] flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#caa15a] shrink-0" />
              <span>Tarihi İmparatorluk İlanı</span>
            </h3>
            <span className="font-mono-num text-xs text-[#b8a990] whitespace-nowrap">
              {playerEconomy.territoryCount} Eyalet ·{" "}
              {playerNation.unlockedTechs.length} Tek.
            </span>
          </div>
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {FORMABLE_EMPIRES.filter(
              (emp) =>
                !emp.allowedNationIds ||
                emp.allowedNationIds.includes(playerNation.id)
            ).map((emp) => {
              const alreadyFormed = playerNation.formedEmpireId === emp.id;
              const reqTechs = emp.requiredTechCount ?? 0;
              const reqGold = emp.goldCost ?? 0;
              const reqIds = emp.requiredTerritoryIds ?? [];
              const reqNames = emp.requiredTerritoryNames ?? [];
              const hasProvinces =
                playerEconomy.territoryCount >= emp.requiredProvinces;
              const hasTechs =
                playerNation.unlockedTechs.length >= reqTechs;
              const hasGold = playerNation.treasury >= reqGold;
              const missingCityIndices = reqIds
                .map((tid, idx) =>
                  territories[tid]?.ownerId === playerNation.id ? -1 : idx
                )
                .filter((idx) => idx >= 0);
              const hasAllKeyCities = missingCityIndices.length === 0;

              const canForm =
                !alreadyFormed &&
                hasProvinces &&
                hasTechs &&
                hasGold &&
                hasAllKeyCities;

              return (
                <div
                  key={emp.id}
                  className="bg-[#1b1611] border border-[#caa15a]/25 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#faf3e3]">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-[#e0b86e] font-semibold mt-0.5">
                        {emp.bonusSummary}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canForm}
                      onClick={() => onFormEmpire(emp.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap cursor-pointer ${
                        alreadyFormed
                          ? "bg-[#241c13] text-[#e0b86e] border border-[#e0b86e]/45 cursor-default"
                          : canForm
                          ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                          : "bg-[#120f0c] text-[#7c6f5c] border border-[#352b20] cursor-not-allowed"
                      }`}
                    >
                      {alreadyFormed
                        ? "İlan Edildi"
                        : canForm
                        ? "İmparatorluğu İlan Et"
                        : "Şartlar Eksik"}
                    </button>
                  </div>

                  {!alreadyFormed && (
                    <div className="pt-2 border-t border-[#caa15a]/15 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-mono-num">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          hasProvinces ? "text-[#e0b86e]" : "text-[#8e806a]"
                        }`}
                      >
                        <AoH3GlyphSvg
                          name={hasProvinces ? "check" : "lock"}
                          className="w-2.5 h-2.5 shrink-0"
                        />
                        <span>
                          {playerEconomy.territoryCount}/{emp.requiredProvinces}{" "}
                          Eyalet
                        </span>
                      </span>

                      {reqTechs > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            hasTechs ? "text-[#e0b86e]" : "text-[#8e806a]"
                          }`}
                        >
                          <AoH3GlyphSvg
                            name={hasTechs ? "check" : "lock"}
                            className="w-2.5 h-2.5 shrink-0"
                          />
                          <span>
                            {playerNation.unlockedTechs.length}/{reqTechs}{" "}
                            Teknoloji
                          </span>
                        </span>
                      )}

                      {reqGold > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            hasGold ? "text-[#e0b86e]" : "text-[#8e806a]"
                          }`}
                        >
                          <AoH3GlyphSvg
                            name={hasGold ? "check" : "lock"}
                            className="w-2.5 h-2.5 shrink-0"
                          />
                          <span>{reqGold} Altın</span>
                        </span>
                      )}

                      {reqIds.map((tid, idx) => {
                        const isOwned =
                          territories[tid]?.ownerId === playerNation.id;
                        const cityName =
                          reqNames[idx] || territories[tid]?.name || tid;
                        return (
                          <span
                            key={tid}
                            className={`inline-flex items-center gap-1 ${
                              isOwned ? "text-[#e0b86e]" : "text-rose-300"
                            }`}
                          >
                            <AoH3GlyphSvg
                              name={isOwned ? "check" : "lock"}
                              className="w-2.5 h-2.5 shrink-0"
                            />
                            <AoH3GlyphSvg
                              name="star"
                              className="w-2.5 h-2.5 shrink-0"
                            />
                            <span>{cityName}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
