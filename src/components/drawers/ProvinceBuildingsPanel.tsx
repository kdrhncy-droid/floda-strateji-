import React from "react";
import { Hammer, Check, Anchor, Lock, Crown } from "lucide-react";
import { BuildingType, Nation, Territory } from "../../types/game";
import { BUILDINGS, getTechTreeForMode } from "../../data/world2026Data";
import { isTerritoryCoastal } from "../../engine/worldBuilder";
import { BuildingIllustrationSvg } from "../illustrations/AoH3Illustrations";
import { getTechArtwork } from "./techArtwork";
import { useGameStore } from "../../store/useGameStore";

interface ProvinceBuildingsPanelProps {
  playerNation: Nation;
  selectedTerritory: Territory;
  isVisibleOnMobile: boolean;
  onUpgradeBuilding: (territoryId: string, building: BuildingType) => void;
}

export const ProvinceBuildingsPanel: React.FC<ProvinceBuildingsPanelProps> = ({
  playerNation,
  selectedTerritory,
  isVisibleOnMobile,
  onUpgradeBuilding,
}) => {
  const gameMode = useGameStore((s) => s.gameMode) ?? "EMPIRES_1440";
  const isCoastal = isTerritoryCoastal(selectedTerritory);
  const isCapital =
    Boolean(selectedTerritory.isCapital) ||
    playerNation.capitalTerritoryId === selectedTerritory.id;
  const techTree = getTechTreeForMode(gameMode);

  // Filter buildings so capitalPalace is prominently shown in the capital or at the end with a capital badge
  const visibleBuildings = BUILDINGS.filter(
    (b) => !b.requiresCapital || isCapital
  );

  return (
    <div
      className={`bg-[#14100c]/95 border border-[#caa15a]/35 rounded-2xl p-4 space-y-3 ${
        isVisibleOnMobile ? "block" : "hidden lg:block"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2 flex-wrap">
            <Hammer className="w-4 h-4 text-[#e0b86e]" />
            <span>İnşaat, Maarif &amp; Altyapı</span>
            <span
              data-testid="province-coastal-badge"
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                isCoastal
                  ? "bg-sky-500/15 text-sky-300 border-sky-500/35"
                  : "bg-[#1c1610] text-[#b8a990] border-[#caa15a]/25"
              }`}
            >
              {isCoastal ? "⚓ Kıyı Şehri" : "🏔️ İç Kara"}
            </span>
            {isCapital && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40">
                👑 Başkent
              </span>
            )}
          </h3>
          <p className="hidden sm:block text-xs text-[#b8a990] mt-0.5">
            Age of History 3 tarzı resimli bina kartları: Mektep, Medrese ve Darülfünun teknoloji tavanınızı büyütür; kışla ve fabrikalar üretimi katlar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {visibleBuildings.map((b) => {
          const currentLvl = selectedTerritory.buildings[b.id] || 0;
          const isMax = currentLvl >= b.maxLevel;
          const missingCoast = Boolean(b.requiresCoastal && !isCoastal);
          const missingCapital = Boolean(b.requiresCapital && !isCapital);
          const requiredTech = b.requiredTechId
            ? techTree.find((t) => t.id === b.requiredTechId) ?? null
            : null;
          const missingTech = Boolean(
            b.requiredTechId &&
              !playerNation.unlockedTechs.includes(b.requiredTechId)
          );
          const cost = Math.round(b.baseCost * Math.pow(1.35, currentLvl));
          const queuedItem = selectedTerritory.constructionQueue?.find(
            (q) => q.building === b.id
          );
          const canAfford =
            !missingCoast &&
            !missingCapital &&
            !missingTech &&
            playerNation.treasury >= cost &&
            !isMax &&
            !queuedItem;
          const estDays = Math.max(14, 18 + currentLvl * 14);
          const displayTitle =
            gameMode === "EMPIRES_1440" && b.eraName1440
              ? b.eraName1440
              : b.name;
          const artwork = getTechArtwork(b.artKey ?? "ENGINEERING");

          return (
            <div
              key={b.id}
              data-testid={`building-card-${b.id}`}
              className={`bg-[#18130e] border rounded-xl overflow-hidden flex flex-col justify-between transition-all ${
                missingCoast || missingTech || missingCapital
                  ? "border-[#caa15a]/20 opacity-85"
                  : currentLvl > 0
                  ? "border-emerald-500/45 shadow-sm"
                  : "border-[#caa15a]/35 hover:border-[#e0b86e]/65"
              }`}
            >
              {/* AoH3 Illustrated Oil-Painting Header Banner */}
              <div
                className="relative h-16 w-full overflow-hidden border-b border-[#caa15a]/25"
                style={{ background: artwork.fallbackGradient }}
              >
                <img
                  src={artwork.src}
                  alt={displayTitle}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  style={{ objectPosition: artwork.objectPosition }}
                  className={`w-full h-full object-cover ${
                    missingTech || missingCoast ? "grayscale-[50%] brightness-75" : "brightness-90"
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#18130e] via-[#18130e]/50 to-black/30" />

                <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-black/70 border border-[#caa15a]/35 text-[9.5px] font-mono-num font-bold text-[#e8c682]">
                    {cost} Altın · {estDays}g
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono-num text-[10px] font-extrabold border ${
                      currentLvl > 0
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/45"
                        : "bg-black/70 text-amber-300 border-[#caa15a]/35"
                    }`}
                  >
                    Sv.{currentLvl}/{b.maxLevel}
                  </span>
                </div>

                <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-2">
                  <BuildingIllustrationSvg
                    buildingKey={b.id}
                    className="w-6 h-6 shrink-0 drop-shadow"
                  />
                  <span className="text-xs font-display font-bold text-[#faf3e3] truncate drop-shadow">
                    {displayTitle}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <p className="text-[10.5px] leading-snug text-[#c5b79e]">
                    {b.description}
                  </p>
                  <div className="text-[10.5px] leading-snug text-emerald-300 mt-1 font-semibold">
                    {b.effectSummary}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {b.requiresCoastal && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${
                          missingCoast
                            ? "bg-amber-950/60 text-amber-300 border-amber-500/35"
                            : "bg-sky-950/60 text-sky-300 border-sky-500/35"
                        }`}
                      >
                        <Anchor className="w-2.5 h-2.5 shrink-0" />
                        <span>
                          {missingCoast ? "Kıyı Şehri Gerekli" : "Kıyı Limanı Uygun"}
                        </span>
                      </span>
                    )}

                    {b.requiresCapital && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-950/60 text-amber-200 border border-amber-500/40">
                        <Crown className="w-2.5 h-2.5 shrink-0" />
                        <span>Başkent Külliyesi</span>
                      </span>
                    )}

                    {requiredTech && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold border ${
                          missingTech
                            ? "bg-rose-950/65 text-rose-200 border-rose-500/40"
                            : "bg-emerald-950/60 text-emerald-300 border-emerald-500/35"
                        }`}
                      >
                        {missingTech ? (
                          <Lock className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <Check className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span>
                          Teknoloji: {requiredTech.shortTitle ?? requiredTech.name}
                        </span>
                      </span>
                    )}
                  </div>

                  {queuedItem && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono-num text-amber-300">
                        <span className="truncate">
                          {queuedItem.specialtyName
                            ? `${queuedItem.specialtyName} (Sv. ${queuedItem.targetLevel})`
                            : `İnşa Sürüyor (Sv. ${queuedItem.targetLevel})`}
                        </span>
                        <span className="shrink-0 ml-1">
                          {queuedItem.totalDays - queuedItem.progressDays} Gün Kaldı
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0d0a07] rounded-full overflow-hidden border border-[#caa15a]/30">
                        <div
                          className="h-full bg-gradient-to-r from-[#caa15a] to-[#e0b86e] rounded-full transition-all"
                          style={{
                            width: `${Math.max(
                              5,
                              Math.round(
                                (queuedItem.progressDays /
                                  queuedItem.totalDays) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  disabled={!canAfford}
                  data-testid={`upgrade-building-${b.id}`}
                  onClick={() => onUpgradeBuilding(selectedTerritory.id, b.id)}
                  className={`w-full min-h-[38px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    missingTech
                      ? "bg-[#14100c] text-rose-300/85 border border-rose-500/30 cursor-not-allowed"
                      : missingCoast
                      ? "bg-[#14100c] text-amber-300/75 border border-[#caa15a]/25 cursor-not-allowed"
                      : queuedItem
                      ? "bg-amber-950/50 text-amber-300 border border-amber-500/40 cursor-default"
                      : isMax
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 cursor-not-allowed"
                      : canAfford
                      ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] shadow"
                      : "bg-[#120e0a] text-[#8e806a] border border-[#caa15a]/20 cursor-not-allowed"
                  }`}
                >
                  {missingTech ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />{" "}
                      <span>
                        {requiredTech?.shortTitle ?? "Teknoloji"} Gerekli
                      </span>
                    </>
                  ) : missingCoast ? (
                    <>
                      <Anchor className="w-3.5 h-3.5" /> Kıyı Gerekli
                    </>
                  ) : queuedItem ? (
                    <>
                      <Hammer className="w-3.5 h-3.5 animate-spin" /> İnşa
                      Ediliyor
                    </>
                  ) : isMax ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Maksimum Seviye
                    </>
                  ) : (
                    <>
                      <Hammer className="w-3.5 h-3.5" /> İnşa Et / Yükselt (
                      {cost}A)
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

