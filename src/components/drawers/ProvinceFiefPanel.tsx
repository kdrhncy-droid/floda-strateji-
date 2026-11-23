import React from "react";
import { Crown } from "lucide-react";
import { Nation, Territory } from "../../types/game";
import { COMMANDERS } from "../../data/world2026Data";
import {
  BESTOW_FAVOR_GOLD_COST,
  calculateAdministrativeStrain,
  getLordArchetype,
  getLordLoyaltySummary,
} from "../../engine/pashaAndFiefEngine";
import { CommanderPortraitSvg } from "../illustrations/AoH3Illustrations";

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
      className={`bg-slate-950/80 border border-purple-500/40 rounded-2xl p-4 space-y-2.5 ${
        isVisibleOnMobile ? "block" : "hidden lg:block"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
            <Crown className="w-4 h-4 text-purple-400" />
            Tımar (Fief) Yönetimi — Şehri Paşaya / Lorda Ver
          </h3>
          <p className="text-[11px] text-slate-400">
            Tımar verilen Lord, kendi bütçesiyle bu şehre{" "}
            <strong className="text-emerald-400">her hafta +1.400 asker</strong>{" "}
            koyar, kaleyi onarır ve isyanı önler.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {adminStrain.excessCount > 0 ? (
          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200">
            <strong>⚠️ İdari Kapasite Uyarısı:</strong> Doğrudan yönettiğiniz has
            toprak ({adminStrain.directOwnedCount}/{adminStrain.capacityLimit}{" "}
            limit). Fazla {adminStrain.excessCount} sahipsiz eyalet bürokrasi
            aşırı yüküne (-%{adminStrain.penaltyPct} Vergi Verimliliği) yol
            açıyor. Fazla şehirleri Lordlarınıza Tımar vererek hem bu yükten
            kurtulun hem de Lordların otonom yatırımlarından faydalanın!
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300">
            <strong>🏛️ İdari Denge:</strong> Has Topraklar (
            {adminStrain.directOwnedCount}/{adminStrain.capacityLimit}) · Lord
            Tımarları ({adminStrain.fiefAssignedCount}) · Sıfır Bürokratik
            Kayıp.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
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
                    ? "bg-purple-950/70 border-purple-400 text-white shadow-md shadow-purple-500/20"
                    : loyaltyInfo.tone === "ROSE"
                    ? "bg-rose-950/35 border-rose-500/60 text-slate-200"
                    : "bg-slate-900 border-slate-700 text-slate-200"
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
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span className="truncate">⚜ {lord.name}</span>
                        {isCurrentHolder && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/40 text-purple-200 shrink-0">
                            Vali
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono-num font-bold shrink-0 ${
                          loyaltyInfo.tone === "ROSE"
                            ? "bg-rose-500/25 text-rose-300"
                            : loyaltyInfo.tone === "AMBER"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        ♥ %{loyaltyInfo.loyalty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-amber-300">
                      <span>{archetypeInfo.badge}</span>
                      <span className="text-slate-400">
                        {loyaltyInfo.fiefCount} Tımar
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-1 line-clamp-1">
                      {loyaltyInfo.warningReason || archetypeInfo.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    onClick={() =>
                      onAssignFiefLord(
                        selectedTerritory.id,
                        isCurrentHolder ? null : lord.id
                      )
                    }
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                      isCurrentHolder
                        ? "bg-rose-900/60 hover:bg-rose-800/70 text-rose-200 border border-rose-500/40"
                        : "bg-purple-600 hover:bg-purple-500 text-white"
                    }`}
                  >
                    {isCurrentHolder ? "Azlet (-22 ♥)" : "Tımar Ver (+12 ♥)"}
                  </button>
                  {onBestowFavorOnLord && (
                    <button
                      onClick={() => onBestowFavorOnLord(lord.id)}
                      disabled={!canBestow}
                      title={`Hil'at & İhsan Ver (${BESTOW_FAVOR_GOLD_COST} Altın -> +18 Sadakat)`}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                        canBestow
                          ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      🎁 İhsan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
