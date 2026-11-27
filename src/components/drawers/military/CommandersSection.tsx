import React from "react";
import { GameModeId, Nation, Territory } from "../../../types/game";
import { getArmyGenerationInfo, getCommandersForMode } from "../../../data/world2026Data";
import {
  BESTOW_FAVOR_GOLD_COST,
  getLordLoyaltySummary,
  getLordRetinueTroops,
} from "../../../engine/pashaAndFiefEngine";
import {
  AoH3GlyphSvg,
  CommanderPortraitSvg,
} from "../../illustrations/AoH3Illustrations";

export interface CommandersSectionProps {
  playerNation: Nation;
  territories: Record<string, Territory>;
  gameMode: GameModeId;
  activeArmyGen: ReturnType<typeof getArmyGenerationInfo>;
  fiefCountByCommander: Map<string, number>;
  onRecruitOrAssignGeneral: (generalId: string) => void;
  onBestowFavorOnLord?: (generalId: string) => void;
  onToggleCallLordToBanner: (generalId: string) => void;
}

export const CommandersSection: React.FC<CommandersSectionProps> = ({
  playerNation,
  territories,
  gameMode,
  activeArmyGen,
  fiefCountByCommander,
  onRecruitOrAssignGeneral,
  onBestowFavorOnLord,
  onToggleCallLordToBanner,
}) => {
  const eraCommanders = getCommandersForMode(gameMode);

  return (
    <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#caa15a]/20 pb-2.5">
        <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
          <AoH3GlyphSvg name="crown" className="w-4 h-4 text-[#e0b86e]" />
          <span>
            {gameMode === "EMPIRES_1440"
              ? "Paşalar & Sancak Beyleri"
              : "Komutanlar & Kurmaylar"}
          </span>
        </h3>
        <div className="flex items-center gap-2 font-mono-num text-xs text-[#d8cbb5]">
          <span className="text-[#e0b86e] font-bold flex items-center gap-1">
            <AoH3GlyphSvg name="fleur" className="w-3.5 h-3.5 shrink-0" />
            <span>{playerNation.clanInfluence ?? 120} Nüfuz</span>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span className="text-[#f3ead7] font-bold">
            {activeArmyGen.generationLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
        {eraCommanders.map((cmd) => {
          const isRecruited = playerNation.recruitedGeneralIds?.includes(cmd.id);
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
          const retinueSize = getLordRetinueTroops(cmd.id, territories);
          const canBestow =
            isRecruited &&
            Boolean(onBestowFavorOnLord) &&
            playerNation.treasury >= BESTOW_FAVOR_GOLD_COST &&
            (loyaltyInfo?.loyalty ?? 100) < 100;

          return (
            <div
              key={cmd.id}
              className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                loyaltyInfo && loyaltyInfo.tone === "ROSE"
                  ? "bg-rose-950/30 border-rose-500/65"
                  : isActive || isCalledToBanner
                  ? "bg-[#211910] border-[#e0b86e]"
                  : "bg-[#1b1510] border-[#caa15a]/30"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <CommanderPortraitSvg
                  specialty={
                    cmd.attackBonus >= cmd.defenseBonus ? "OFFENSE" : "DEFENSE"
                  }
                  loyalty={loyaltyInfo?.loyalty ?? 85}
                  className="w-11 h-11 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[#f3ead7] truncate">
                      {cmd.name}
                      {fiefCount > 0 ? ` · ${fiefCount} Tımar` : ""}
                    </span>
                    {loyaltyInfo && (
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
                    )}
                  </div>

                  <div className="text-[11px] font-mono-num text-[#e0b86e] mt-0.5">
                    {cmd.title} · +{(retinueSize / 1000).toFixed(1)}B Sancak
                  </div>

                  <div className="font-mono-num text-[11px] text-[#d8cbb5] mt-0.5 flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1">
                      <AoH3GlyphSvg
                        name="sword"
                        className="w-3 h-3 text-[#e0b86e]"
                      />
                      <span>+%{cmd.attackBonus}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <AoH3GlyphSvg
                        name="shield"
                        className="w-3 h-3 text-[#e0b86e]"
                      />
                      <span>+%{cmd.defenseBonus}</span>
                    </span>
                    <span>−%{cmd.casualtyReduction} Kayıp</span>
                  </div>
                </div>
              </div>

              {loyaltyInfo && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-[#0d0a07] overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        loyaltyInfo.tone === "ROSE"
                          ? "bg-rose-500"
                          : loyaltyInfo.tone === "AMBER"
                          ? "bg-[#e0b86e]"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${loyaltyInfo.loyalty}%` }}
                    />
                  </div>
                  {loyaltyInfo.warningReason && (
                    <div className="text-[10px] text-rose-300 flex items-center gap-1 truncate">
                      <AoH3GlyphSvg name="alert" className="w-3 h-3 shrink-0" />
                      <span className="truncate">{loyaltyInfo.warningReason}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {isRecruited && onBestowFavorOnLord && (
                  <button
                    type="button"
                    onClick={() => onBestowFavorOnLord(cmd.id)}
                    disabled={!canBestow}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      canBestow
                        ? "bg-[#241c13] hover:bg-[#31261a] text-[#e0b86e] border border-[#caa15a]/45"
                        : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                    }`}
                  >
                    <AoH3GlyphSvg name="gift" className="w-3 h-3 shrink-0" />
                    <span>İhsan ({BESTOW_FAVOR_GOLD_COST}A)</span>
                  </button>
                )}
                {isRecruited && (
                  <button
                    type="button"
                    onClick={() => onToggleCallLordToBanner(cmd.id)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      isCalledToBanner
                        ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] border border-[#e0b86e]"
                        : "bg-[#1b1510] hover:bg-[#261d14] text-[#f3ead7] border border-[#caa15a]/40"
                    }`}
                  >
                    <AoH3GlyphSvg name="fleur" className="w-3 h-3 shrink-0" />
                    <span>
                      {isCalledToBanner ? "Sancakta" : "Sancağa Çağır (35)"}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRecruitOrAssignGeneral(cmd.id)}
                  disabled={!isRecruited && !canAfford}
                  className={`min-h-[44px] flex-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                      : isRecruited
                      ? "bg-[#261e16] hover:bg-[#33281d] text-[#f3ead7] border border-[#caa15a]/40"
                      : canAfford
                      ? "bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]"
                      : "bg-[#120e0a] text-[#6e624f] border border-[#caa15a]/15 cursor-not-allowed"
                  }`}
                >
                  {isActive ? (
                    <>
                      <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                      <span>Başkomutan</span>
                    </>
                  ) : isRecruited ? (
                    <span>Serdar Ata</span>
                  ) : (
                    <span>Atama ({cmd.costGold}A)</span>
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
