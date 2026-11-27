import React from "react";
import { Anchor, Bot, Crosshair, Navigation } from "lucide-react";
import {
  ActiveBattle,
  AiCommanderStance,
  ArmyMovement,
  Nation,
  SeaArmy,
  Territory,
} from "../../../types/game";
import { cleanProvinceName } from "../../../utils/formatters";
import { sound } from "../../../utils/soundEngine";
import { AoH3GlyphSvg } from "../../illustrations/AoH3Illustrations";

export interface ForcesFrontSectionProps {
  playerNation: Nation;
  territories: Record<string, Territory>;
  selectedTerritory: Territory | null;
  seaArmies: SeaArmy[];
  selectedSeaArmyId: string | null;
  allPlayerArmies: Territory[];
  playerSeaArmies: SeaArmy[];
  relevantBattles: ActiveBattle[];
  relevantMovements: ArmyMovement[];
  totalStandingArmy: number;
  aiCommanderEnabled: boolean;
  aiCommanderStance: AiCommanderStance;
  onSelectTerritory: (territoryId: string) => void;
  onSelectSeaArmy?: (seaArmyId: string) => void;
  onStartArmyOrderMode: (territoryId: string) => void;
  onStartSeaArmyOrder?: (seaArmyId: string) => void;
  onStartBatchMarch?: () => void;
  onToggleAiCommander?: () => void;
  onSetAiCommanderStance?: (stance: AiCommanderStance) => void;
  onOpenRecruitTab: () => void;
  onClose: () => void;
}

export const ForcesFrontSection: React.FC<ForcesFrontSectionProps> = ({
  playerNation,
  territories,
  selectedTerritory,
  seaArmies,
  selectedSeaArmyId,
  allPlayerArmies,
  playerSeaArmies,
  relevantBattles,
  relevantMovements,
  totalStandingArmy,
  aiCommanderEnabled,
  aiCommanderStance,
  onSelectTerritory,
  onSelectSeaArmy,
  onStartArmyOrderMode,
  onStartSeaArmyOrder,
  onStartBatchMarch,
  onToggleAiCommander,
  onSetAiCommanderStance,
  onOpenRecruitTab,
  onClose,
}) => {
  return (
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
                onOpenRecruitTab();
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
                  const attPct = Math.round((btl.attackerTroops / total) * 100);
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
                        territories[mv.toTerritoryId]?.name || mv.toTerritoryId
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
              const inf = terr.units?.infantry ?? Math.round(terr.garrison * 0.7);
              const arm = terr.units?.armor ?? Math.round(terr.garrison * 0.2);
              const sup =
                terr.units?.airDrone ?? Math.max(0, terr.garrison - inf - arm);
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
  );
};
