import React from "react";
import { Hammer, Check } from "lucide-react";
import { BuildingType, Nation, Territory } from "../../types/game";
import { BUILDINGS } from "../../data/world2026Data";
import { BuildingIllustrationSvg } from "../illustrations/AoH3Illustrations";

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
  return (
    <div
      className={`bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 ${
        isVisibleOnMobile ? "block" : "hidden lg:block"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Hammer className="w-4 h-4 text-amber-400" />
            Binalar & Altyapı
          </h3>
          <p className="hidden sm:block text-xs text-slate-400">
            Binalar bölgenin ekonomik gelirini, savunmasını ve araştırma
            kapasitesini kalıcı olarak büyütür.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BUILDINGS.map((b) => {
          const currentLvl = selectedTerritory.buildings[b.id] || 0;
          const isMax = currentLvl >= b.maxLevel;
          const cost = Math.round(b.baseCost * Math.pow(1.35, currentLvl));
          const queuedItem = selectedTerritory.constructionQueue?.find(
            (q) => q.building === b.id
          );
          const canAfford =
            playerNation.treasury >= cost && !isMax && !queuedItem;
          const estDays = Math.max(14, 18 + currentLvl * 14);

          return (
            <div
              key={b.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col justify-between gap-2"
            >
              <div className="flex items-start gap-2.5">
                <BuildingIllustrationSvg
                  buildingKey={b.id}
                  className="w-10 h-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white truncate">
                      {b.name}
                    </span>
                    <span className="font-mono-num text-[11px] text-amber-400 font-semibold shrink-0">
                      Sv.{currentLvl}/{b.maxLevel}
                    </span>
                  </div>
                  <p className="text-[10.5px] leading-snug text-slate-400 mt-0.5">
                    {b.description}
                  </p>
                  <div className="text-[10.5px] leading-snug text-emerald-400 mt-0.5 font-medium">
                    {b.effectSummary}
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
                          {queuedItem.totalDays - queuedItem.progressDays} Gün
                          Kaldı
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
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
              </div>

              <div className="flex items-center justify-between gap-2 text-[10px] font-mono-num text-slate-400">
                <span>
                  {queuedItem
                    ? "İnşa sırası"
                    : isMax
                    ? "Tamamlandı"
                    : "Sonraki seviye"}
                </span>
                <span className="text-amber-300">
                  {!queuedItem && !isMax
                    ? `${cost}G · ${estDays}g`
                    : queuedItem
                    ? `${queuedItem.totalDays - queuedItem.progressDays}g kaldı`
                    : "—"}
                </span>
              </div>

              <button
                disabled={!canAfford}
                onClick={() => onUpgradeBuilding(selectedTerritory.id, b.id)}
                className={`w-full min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  queuedItem
                    ? "bg-amber-950/50 text-amber-300 border border-amber-500/40 cursor-default"
                    : isMax
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : canAfford
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                {queuedItem ? (
                  <>
                    <Hammer className="w-3.5 h-3.5 animate-spin" /> İnşa
                    ediliyor
                  </>
                ) : isMax ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Maksimum Seviye
                  </>
                ) : (
                  <>
                    <Hammer className="w-3.5 h-3.5" /> Yükselt
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
