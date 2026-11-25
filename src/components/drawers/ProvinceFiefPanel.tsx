import React from "react";
import { Nation, Territory } from "../../types/game";
import { COMMANDERS } from "../../data/world2026Data";
import {
  BESTOW_FAVOR_GOLD_COST,
  calculateAdministrativeStrain,
  getLordArchetype,
  getLordLoyaltySummary,
} from "../../engine/pashaAndFiefEngine";
import {
  AoH3GlyphSvg,
  AoH3MenuBanner,
  CommanderPortraitSvg,
} from "../illustrations/AoH3Illustrations";

interface ProvinceFiefPanelProps {
  playerNation: Nation;
  selectedTerritory: Territory;
  territories: Record<string, Territory>;
  isVisibleOnMobile: boolean;
  onAssignFiefLord: (territoryId: string, lordId: string | null) => void;
  onBestowFavorOnLord?: (lordId: string) => void;
}

export const ProvinceFiefPanel: React.FC<ProvinceFiefPanelProps> = ({
  playerNation,
  selectedTerritory,
  territories,
  isVisibleOnMobile,
  onAssignFiefLord,
  onBestowFavorOnLord,
}) => {
  const playerOwnedTerrs = Object.values(territories).filter(
    (t) => t.ownerId === playerNation.id
  );
  const adminStrain = calculateAdministrativeStrain(playerOwnedTerrs);
  const recruitedLords = COMMANDERS.filter((c) =>
    playerNation.recruitedGeneralIds?.includes(c.id)
  );

  return (
    <div
      className={`bg-[#14100c]/95 border border-[#caa15a]/40 rounded-2xl p-4 space-y-2.5 ${
        isVisibleOnMobile ? "block" : "hidden lg:block"
      }`}
    >
      <AoH3MenuBanner
        artKey="COURT"
        branch="ADMINISTRATION"
        title="Tımar & Vali Atama"
        subtitle={`Has ${adminStrain.directOwnedCount}/${adminStrain.capacityLimit} · Tımar ${adminStrain.fiefAssignedCount}${
          adminStrain.excessCount > 0 ? ` (−%${adminStrain.penaltyPct} Vergi)` : ""
        }`}
        icon="crown"
        className="h-14"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
        {recruitedLords.map((lord) => {
          const isCurrentHolder = selectedTerritory.fiefLordId === lord.id;
          const archetypeInfo = getLordArchetype(lord.id);
          const loyaltyInfo = getLordLoyaltySummary(
            playerNation,
            lord.id,
            territories
          );
          const canBestow =
            Boolean(onBestowFavorOnLord) &&
            playerNation.treasury >= BESTOW_FAVOR_GOLD_COST &&
            loyaltyInfo.loyalty < 100;

          return (
            <div
              key={lord.id}
              className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 ${
                isCurrentHolder
                  ? "bg-[#221a12] border-[#e0b86e] text-[#faf3e3] shadow"
                  : loyaltyInfo.tone === "ROSE"
                  ? "bg-rose-950/30 border-rose-500/60 text-[#f3ead7]"
                  : "bg-[#1b1510] border-[#caa15a]/30 text-[#f3ead7]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CommanderPortraitSvg
                  specialty="OFFENSE"
                  loyalty={loyaltyInfo.loyalty}
                  className="w-10 h-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[#faf3e3] flex items-center gap-1 truncate">
                      <AoH3GlyphSvg name="fleur" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                      <span className="truncate">
                        {lord.name}
                        {isCurrentHolder ? " · Vali" : ""}
                      </span>
                    </span>
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
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-[#e0b86e]">
                    <span>{archetypeInfo.badge}</span>
                    <span className="text-[#b8a990] font-mono-num">
                      {loyaltyInfo.fiefCount} Tımar
                    </span>
                  </div>
                  {loyaltyInfo.warningReason && (
                    <div className="text-[10px] text-rose-300 mt-0.5 flex items-center gap-1 truncate">
                      <AoH3GlyphSvg name="alert" className="w-3 h-3 shrink-0" />
                      <span className="truncate">{loyaltyInfo.warningReason}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    onAssignFiefLord(
                      selectedTerritory.id,
                      isCurrentHolder ? null : lord.id
                    )
                  }
                  className={`flex-1 min-h-[44px] py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    isCurrentHolder
                      ? "bg-rose-950/75 hover:bg-rose-900/80 text-rose-200 border border-rose-500/45"
                      : "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16b] hover:to-[#ecc77e] text-[#14100c]"
                  }`}
                >
                  {isCurrentHolder ? "Azlet (−22 Sad.)" : "Tımar Ver (+12 Sad.)"}
                </button>
                {onBestowFavorOnLord && (
                  <button
                    type="button"
                    onClick={() => onBestowFavorOnLord(lord.id)}
                    disabled={!canBestow}
                    title={`İhsan Ver (${BESTOW_FAVOR_GOLD_COST}A → +18 Sadakat)`}
                    className={`min-h-[44px] py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      canBestow
                        ? "bg-[#241c13] hover:bg-[#31261a] text-[#e0b86e] border border-[#caa15a]/45"
                        : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                    }`}
                  >
                    <AoH3GlyphSvg name="gift" className="w-3 h-3 shrink-0" />
                    <span>İhsan</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
