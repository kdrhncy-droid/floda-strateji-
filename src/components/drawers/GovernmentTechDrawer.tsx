import React, { useMemo, useState } from "react";
import { Crown, FlaskConical, ScrollText } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import {
  computeNationTechMetrics,
  getNationModernizedTier,
  getNationUnlockedMilTier,
  getReformsForMode,
  getTechTreeForMode,
} from "../../data/world2026Data";
import { TechTreeSection } from "./government/TechTreeSection";
import { DivanCapitalSection } from "./government/DivanCapitalSection";
import { StateReformsSection } from "./government/StateReformsSection";

export const GovernmentTechDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  playerEconomy,
  territories,
  onChangeIdeology,
  onEnactReform,
  onFormEmpire,
  onUnlockTech,
  onStartResearch,
  onCancelResearch,
  onBoostResearch,
  onToggleAutoResearch,
  onUpdateBudget,
  onModernizeNationalArmy,
  onSelectTerritory,
  tick = 0,
  gameMode = "EMPIRES_1440",
}) => {
  const [drawerSection, setDrawerSection] = useState<"TECH" | "DIVAN" | "STATE">("TECH");

  const techMetrics = useMemo(
    () =>
      computeNationTechMetrics(
        playerNation,
        territories,
        gameMode,
        playerEconomy.dailyResearch
      ),
    [playerNation, territories, gameMode, playerEconomy.dailyResearch]
  );

  const capitalTerritory =
    territories[playerNation.capitalTerritoryId] ??
    Object.values(territories).find(
      (t) => t && t.ownerId === playerNation.id && t.isCapital
    ) ??
    Object.values(territories).find((t) => t && t.ownerId === playerNation.id) ??
    null;

  const activeTechTree = useMemo(
    () => getTechTreeForMode(gameMode),
    [gameMode]
  );
  const activeReforms = useMemo(
    () => getReformsForMode(gameMode),
    [gameMode]
  );

  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedMilTier = getNationModernizedTier(playerNation);
  const hasPendingArmyUpgrade = unlockedMilTier > modernizedMilTier;

  return (
    <div className="space-y-2.5 relative">
      {/* Top Mode Switcher: Tech Tree vs. Divan & Başkent vs. State / Reforms / Empires */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Hükümet ve Teknoloji Sekmeleri"
          className="grid grid-cols-3 lg:flex items-center gap-1 bg-[#120f0c] p-1 rounded-xl border border-[#caa15a]/30 w-full lg:w-auto max-w-full overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "TECH"}
            data-testid="gov-tab-tech"
            onClick={() => setDrawerSection("TECH")}
            className={`min-h-[44px] flex-1 lg:flex-initial px-2 lg:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "TECH"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span>Teknoloji</span>
            <span
              className={`hidden lg:inline font-mono-num text-[10px] font-extrabold ${
                drawerSection === "TECH" ? "text-[#14110e]/80" : "text-amber-300"
              }`}
            >
              {playerNation.unlockedTechs.length}/{activeTechTree.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "DIVAN"}
            data-testid="gov-tab-divan"
            onClick={() => setDrawerSection("DIVAN")}
            className={`min-h-[44px] flex-1 lg:flex-initial px-2 lg:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "DIVAN"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span className="lg:hidden">Divan</span>
            <span className="hidden lg:inline">
              {gameMode === "EMPIRES_1440"
                ? "Divan & Başkent"
                : "Başkent & Eğitim"}
            </span>
            <span
              className={`hidden lg:inline font-mono-num text-[10px] font-extrabold ${
                drawerSection === "DIVAN" ? "text-[#14110e]/80" : "text-[#e0b86e]"
              }`}
            >
              Sv.{techMetrics.capitalLevel}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={drawerSection === "STATE"}
            data-testid="gov-tab-state"
            onClick={() => setDrawerSection("STATE")}
            className={`min-h-[44px] flex-1 lg:flex-initial px-2 lg:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              drawerSection === "STATE"
                ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14110e] shadow"
                : "text-[#d8cbb5] hover:text-white"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5 shrink-0" />
            <span className="lg:hidden">Reform</span>
            <span className="hidden lg:inline">Rejim &amp; İmparatorluk</span>
          </button>
        </div>

        {/* Inline Unboxed Technology Level & Capital Telemetry */}
        <div
          data-testid="aoh3-tech-level-strip"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#c5b79e] font-mono-num"
        >
          <span>
            Tek. Düzeyi{" "}
            <strong className="text-[#e0b86e]">
              {techMetrics.techLevel.toFixed(2)} / Maks {techMetrics.maxTechLevel.toFixed(1)}
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Aylık{" "}
            <strong className="text-[#e0b86e]">
              +{techMetrics.monthlyTechGrowth.toFixed(2)}
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Başkent{" "}
            <strong className="text-[#f3ead7]">
              Sv.{techMetrics.capitalLevel}/10
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Günlük{" "}
            <strong className="text-[#f3ead7]">
              +{playerEconomy.dailyResearch.toFixed(1)} RP
            </strong>
          </span>
          {hasPendingArmyUpgrade && (
            <>
              <span className="text-[#caa15a]/40">·</span>
              <button
                type="button"
                onClick={onModernizeNationalArmy}
                className="text-xs font-sans font-bold text-amber-300 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                Orduyu Modernize Et (Sv.{unlockedMilTier})
              </button>
            </>
          )}
        </div>
      </div>

      {drawerSection === "TECH" ? (
        <TechTreeSection
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          gameMode={gameMode}
          activeTechTree={activeTechTree}
          onUnlockTech={onUnlockTech}
          onStartResearch={onStartResearch}
          onCancelResearch={onCancelResearch}
          onBoostResearch={onBoostResearch}
          onToggleAutoResearch={onToggleAutoResearch}
          onUpdateBudget={onUpdateBudget}
        />
      ) : drawerSection === "DIVAN" ? (
        <DivanCapitalSection
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          capitalTerritory={capitalTerritory}
          techMetrics={techMetrics}
          modernizedMilTier={modernizedMilTier}
          gameMode={gameMode}
          tick={tick}
          onSelectTerritory={onSelectTerritory}
        />
      ) : (
        <StateReformsSection
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          territories={territories}
          activeReforms={activeReforms}
          gameMode={gameMode}
          onChangeIdeology={onChangeIdeology}
          onEnactReform={onEnactReform}
          onFormEmpire={onFormEmpire}
          onModernizeNationalArmy={onModernizeNationalArmy}
        />
      )}
    </div>
  );
};
