import React, { useEffect, useMemo, useRef, useState } from "react";
import { CommandDrawersProps } from "./drawerTypes";
import {
  ARMY_GENERATIONS_1440,
  ARMY_GENERATIONS_2026,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
} from "../../data/world2026Data";
import { computeNationManpowerCap } from "../../engine/simulationEngine";
import { sound } from "../../utils/soundEngine";
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  AoH3MenuBanner,
} from "../illustrations/AoH3Illustrations";
import { computeWorldPowerRankings } from "../../engine/worldRankings";
import { UnitTreeSection } from "./military/UnitTreeSection";
import { ForcesFrontSection } from "./military/ForcesFrontSection";
import { RecruitMercenarySection } from "./military/RecruitMercenarySection";
import { CommandersSection } from "./military/CommandersSection";
import {
  RankingSortBy,
  WorldRankingsSection,
} from "./military/WorldRankingsSection";

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
    if (
      openRankingsSignal > 0 &&
      openRankingsSignal !== lastRankingsSignalRef.current
    ) {
      lastRankingsSignalRef.current = openRankingsSignal;
      setMilitaryTab("RANKINGS");
    }
  }, [openRankingsSignal]);

  const [rankingSortBy, setRankingSortBy] = useState<RankingSortBy>("SCORE");

  const ownedProvinces = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNation.id)
        .sort(
          (a, b) =>
            Number(b.isCapital) - Number(a.isCapital) || b.garrison - a.garrison
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

  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const generationList =
    gameMode === "EMPIRES_1440" ? ARMY_GENERATIONS_1440 : ARMY_GENERATIONS_2026;
  const manpowerCap = computeNationManpowerCap(playerNation, territories);

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

  const bannerCfg =
    militaryTab === "TREE"
      ? {
          artKey: "INFANTRY" as const,
          branch: "MILITARY" as const,
          title: "Birlik Ağacı & Nesil Gelişimi",
          subtitle: `${activeArmyGen.generationLabel} (${activeArmyGen.eraTitle}) · Açık Nesil ${
            unlockedMilTier + 1
          }/${generationList.length}`,
          icon: "sword" as AoH3GlyphName,
        }
      : militaryTab === "FORCES"
      ? {
          artKey: "FORTRESS" as const,
          branch: "MILITARY" as const,
          title: "Ordularım, Filolar & Cephe",
          subtitle: `${(totalStandingArmy / 1000).toFixed(1)}B Toplam Asker · ${
            allPlayerArmies.length
          } Garnizon${
            playerSeaArmies.length > 0 ? ` · ${playerSeaArmies.length} Filo` : ""
          }`,
          icon: "shield" as AoH3GlyphName,
        }
      : militaryTab === "RECRUIT"
      ? {
          artKey: "INFANTRY" as const,
          branch: "MILITARY" as const,
          title: "Seferberlik & Asker Basımı",
          subtitle: `Ordu ${(playerEconomy.totalGarrison / 1000).toFixed(
            1
          )}B · İG ${(playerNation.manpower / 1000).toFixed(1)}B/${(
            manpowerCap / 1000
          ).toFixed(0)}B`,
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
          subtitle: `${playerNation.clanInfluence ?? 120} Nüfuz · ${
            activeArmyGen.generationLabel
          }`,
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
      {/* Illustrated Oil-Painting Header Banner */}
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

      {/* 5-Tab Switcher: Birlik Ağacı · Ordularım · Ordu Bas · Paşalar · Sıralama */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Askerî Komuta Sekmeleri"
          className="flex items-center gap-1 bg-[#120e0a] p-1 rounded-xl border border-[#caa15a]/30 w-full lg:w-auto overflow-x-auto no-scrollbar"
        >
          {[
            {
              id: "TREE" as const,
              label: "Birlik Ağacı",
              icon: "science" as AoH3GlyphName,
              testId: "mil-tab-tree",
            },
            {
              id: "FORCES" as const,
              label: `Ordularım (${allPlayerArmies.length + playerSeaArmies.length})`,
              icon: "shield" as AoH3GlyphName,
              testId: "mil-tab-forces",
            },
            {
              id: "RECRUIT" as const,
              label: "Ordu Bas",
              icon: "sword" as AoH3GlyphName,
              testId: "mil-tab-recruit",
            },
            {
              id: "COMMANDERS" as const,
              label: gameMode === "EMPIRES_1440" ? "Paşalar" : "Komutanlar",
              icon: "crown" as AoH3GlyphName,
              testId: "mil-tab-commanders",
            },
            {
              id: "RANKINGS" as const,
              label: "Sıralama",
              icon: "trophy" as AoH3GlyphName,
              testId: "mil-tab-rankings",
            },
          ].map((t) => (
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

      {militaryTab === "TREE" && (
        <UnitTreeSection
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          gameMode={gameMode}
          ownedProvinces={ownedProvinces}
          activeRecruitCity={activeRecruitCity}
          setRecruitCityId={setRecruitCityId}
          generationList={generationList}
          unlockedMilTier={unlockedMilTier}
          modernizedTier={modernizedTier}
          onModernizeNationalArmy={onModernizeNationalArmy}
          onRecruitUnit={onRecruitUnit}
          onOpenRecruitTab={() => setMilitaryTab("RECRUIT")}
        />
      )}

      {militaryTab === "FORCES" && (
        <ForcesFrontSection
          playerNation={playerNation}
          territories={territories}
          selectedTerritory={selectedTerritory}
          seaArmies={seaArmies}
          selectedSeaArmyId={selectedSeaArmyId}
          allPlayerArmies={allPlayerArmies}
          playerSeaArmies={playerSeaArmies}
          relevantBattles={relevantBattles}
          relevantMovements={relevantMovements}
          totalStandingArmy={totalStandingArmy}
          aiCommanderEnabled={aiCommanderEnabled}
          aiCommanderStance={aiCommanderStance}
          onSelectTerritory={onSelectTerritory}
          onSelectSeaArmy={onSelectSeaArmy}
          onStartArmyOrderMode={onStartArmyOrderMode}
          onStartSeaArmyOrder={onStartSeaArmyOrder}
          onStartBatchMarch={onStartBatchMarch}
          onToggleAiCommander={onToggleAiCommander}
          onSetAiCommanderStance={onSetAiCommanderStance}
          onOpenRecruitTab={() => setMilitaryTab("RECRUIT")}
          onClose={onClose}
        />
      )}

      {militaryTab === "RECRUIT" && (
        <RecruitMercenarySection
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          gameMode={gameMode}
          ownedProvinces={ownedProvinces}
          activeRecruitCity={activeRecruitCity}
          setRecruitCityId={setRecruitCityId}
          modernizedTier={modernizedTier}
          activeArmyGen={activeArmyGen}
          onSelectTerritory={onSelectTerritory}
          onRecruitUnit={onRecruitUnit}
          onBatchRecruitUnits={onBatchRecruitUnits}
          onHireMercenary={onHireMercenary}
          onModernizeNationalArmy={onModernizeNationalArmy}
        />
      )}

      {militaryTab === "COMMANDERS" && (
        <CommandersSection
          playerNation={playerNation}
          territories={territories}
          gameMode={gameMode}
          activeArmyGen={activeArmyGen}
          fiefCountByCommander={fiefCountByCommander}
          onRecruitOrAssignGeneral={onRecruitOrAssignGeneral}
          onBestowFavorOnLord={onBestowFavorOnLord}
          onToggleCallLordToBanner={onToggleCallLordToBanner}
        />
      )}

      {militaryTab === "RANKINGS" && (
        <WorldRankingsSection
          playerNation={playerNation}
          territories={territories}
          gameMode={gameMode}
          rankedList={rankedList}
          playerRankIndex={playerRankIndex}
          rankingSortBy={rankingSortBy}
          onChangeRankingSortBy={setRankingSortBy}
          onInspectNation={onInspectNation}
          onSelectTerritory={onSelectTerritory}
        />
      )}
    </div>
  );
};
