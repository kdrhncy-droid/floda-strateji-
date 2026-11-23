import React, { useState, useMemo } from 'react';
import {
  X,
  Star,
  Shield,
  Coins,
  Crown,
  Check,
  Handshake,
  AlertCircle,
  Building,
} from 'lucide-react';
import {
  ActiveWar,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
} from '../../types/game';
import {
  CustomPeaceDealProposal,
  calculateProvinceStarCost,
  evaluatePeaceConferenceBudget,
  TREATY_STAR_COSTS,
} from '../../engine/peaceConferenceEngine';
import { sound } from '../../utils/soundEngine';

interface AoH3PeaceConferenceModalProps {
  war: ActiveWar;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  gameMode?: GameModeId;
  onClose: () => void;
  onConfirmPeaceDeal: (proposal: CustomPeaceDealProposal) => void;
}

export const AoH3PeaceConferenceModal: React.FC<
  AoH3PeaceConferenceModalProps
> = ({
  war,
  playerNationId,
  nations,
  territories,
  relations,
  gameMode = 'EMPIRES_1440',
  onClose,
  onConfirmPeaceDeal,
}) => {
  const isPlayerAttackerSide = war.attackers.includes(playerNationId);
  const enemyId = isPlayerAttackerSide ? war.defenderId : war.attackerId;
  const playerNation = nations[playerNationId];
  const enemyNation = nations[enemyId];

  // List of enemy territories available for peace demands
  const availableEnemyTerritories = useMemo(() => {
    return Object.values(territories).filter((t) => {
      if (!t) return false;
      const isOwnedByEnemy = t.ownerId === enemyId;
      const isOccupiedByPlayer =
        t.ownerId === playerNationId &&
        t.isOccupied &&
        t.occupiedById === playerNationId &&
        t.coreOwnerId === enemyId;
      return isOwnedByEnemy || isOccupiedByPlayer;
    });
  }, [territories, enemyId, playerNationId]);

  // Initial state: automatically pre-select all territories the player already captured in battle!
  const [demandedTerritoryIds, setDemandedTerritoryIds] = useState<string[]>(
    () => {
      return availableEnemyTerritories
        .filter(
          (t) =>
            t.ownerId === playerNationId &&
            t.isOccupied &&
            t.occupiedById === playerNationId
        )
        .map((t) => t.id);
    }
  );

  const [demandVassal, setDemandVassal] = useState(false);
  const [demandReparations, setDemandReparations] = useState(false);
  const [demandDisarm, setDemandDisarm] = useState(false);

  // Compute live budget
  const proposal: CustomPeaceDealProposal = useMemo(() => {
    return {
      warId: war.id,
      demandedTerritoryIds,
      demandVassal,
      demandReparations,
      demandDisarm,
      isWhitePeace: false,
    };
  }, [war.id, demandedTerritoryIds, demandVassal, demandReparations, demandDisarm]);

  const budget = useMemo(() => {
    return evaluatePeaceConferenceBudget({
      war,
      playerNationId,
      enemyNationId: enemyId,
      territories,
      proposal,
    });
  }, [war, playerNationId, enemyId, territories, proposal]);

  const toggleTerritory = (tId: string) => {
    sound.playClick();
    setDemandedTerritoryIds((prev) =>
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId]
    );
  };

  const selectAllOccupied = () => {
    sound.playClick();
    const occupiedIds = availableEnemyTerritories
      .filter(
        (t) =>
          t.ownerId === playerNationId &&
          t.isOccupied &&
          t.occupiedById === playerNationId
      )
      .map((t) => t.id);
    setDemandedTerritoryIds(occupiedIds);
  };

  const selectAllProvinces = () => {
    sound.playClick();
    setDemandedTerritoryIds(availableEnemyTerritories.map((t) => t.id));
  };

  const clearAllSelections = () => {
    sound.playClick();
    setDemandedTerritoryIds([]);
    setDemandVassal(false);
    setDemandReparations(false);
    setDemandDisarm(false);
  };

  const handleWhitePeace = () => {
    sound.playTreaty();
    onConfirmPeaceDeal({
      warId: war.id,
      demandedTerritoryIds: [],
      demandVassal: false,
      demandReparations: false,
      demandDisarm: false,
      isWhitePeace: true,
    });
    onClose();
  };

  const handleSignPeaceDeal = () => {
    if (budget.acceptanceChance < 50 && !budget.isFullyOccupied) {
      sound.playClick();
      return;
    }
    sound.playTreaty();
    onConfirmPeaceDeal(proposal);
    onClose();
  };

  if (!playerNation || !enemyNation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fade-in pointer-events-auto">
      <div className="relative w-full max-w-5xl max-h-[92vh] landscape:max-h-[96vh] bg-[#090e1a]/98 border border-amber-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 border-b border-amber-500/30 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
              🕊️
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                <span>AoH3 Barış Konferansı Masası</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-semibold shrink-0">
                  {war.name}
                </span>
              </h2>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>
                  Muhatap: <strong className="text-white">{enemyNation.name}</strong>
                </span>
                <span>·</span>
                <span>
                  Savaş Skoru:{' '}
                  <strong
                    className={`font-mono-num ${
                      budget.playerWarScore >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {budget.playerWarScore > 0 ? `+` : ''}
                    {budget.playerWarScore}%
                  </strong>
                </span>
                {budget.isFullyOccupied && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold">
                    TAM İŞGAL (%100)
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dual Orientation Body (Responsive 1-Col on Portrait Mobile, 2-Col Split on Landscape/Tablet) */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          {/* Left Column (5 Cols in Landscape): Warscore Star Budget & Treaties */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Star Gauge Card */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    Barış Yıldızı Puanı (Warscore Stars)
                  </span>
                  <span
                    className={`font-mono-num text-sm ${
                      budget.remainingStars >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    ⭐ {budget.spentStars} / {budget.totalStars}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      budget.remainingStars >= 0
                        ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                        : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          5,
                          (budget.spentStars / Math.max(1, budget.totalStars)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Kalan Bütçe:{' '}
                    <strong
                      className={`font-mono-num ${
                        budget.remainingStars >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {budget.remainingStars >= 0 ? '+' : ''}
                      {budget.remainingStars} ⭐
                    </strong>
                  </span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      budget.acceptanceChance >= 75
                        ? 'text-emerald-300'
                        : budget.acceptanceChance >= 40
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    <span>Kabul İhtimali:</span>
                    <strong className="font-mono-num">
                      %{budget.acceptanceChance}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Special Diplomatic Peace Treaties */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  Özel Diplomatik Şartlar & Talepler
                </div>

                <div className="space-y-1.5">
                  {/* Demand War Reparations */}
                  <div
                    onClick={() => {
                      sound.playClick();
                      setDemandReparations(!demandReparations);
                    }}
                    className={`p-2 rounded-lg border cursor-pointer select-none flex items-center justify-between transition-colors ${
                      demandReparations
                        ? 'bg-amber-950/60 border-amber-500/70 text-amber-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandReparations
                            ? 'bg-amber-500 border-amber-400 text-slate-950'
                            : 'border-slate-600'
                        }`}
                      >
                        {demandReparations && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          Harp Tazminatı Al
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Düşman hazinesinin %45'i anında hazinenize aktarılır.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-amber-400">
                      ⭐ {TREATY_STAR_COSTS.REPARATIONS}
                    </span>
                  </div>

                  {/* Demand Vassalization */}
                  <div
                    onClick={() => {
                      sound.playClick();
                      setDemandVassal(!demandVassal);
                    }}
                    className={`p-2 rounded-lg border cursor-pointer select-none flex items-center justify-between transition-colors ${
                      demandVassal
                        ? 'bg-purple-950/60 border-purple-500/70 text-purple-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandVassal
                            ? 'bg-purple-500 border-purple-400 text-white'
                            : 'border-slate-600'
                        }`}
                      >
                        {demandVassal && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-purple-400" />
                          Vasallaştırma (Tabi Devlet Yap)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Devlet bağımsızlığını kaybeder ve himayenize girer.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-purple-400">
                      ⭐ {TREATY_STAR_COSTS.VASSALIZE}
                    </span>
                  </div>

                  {/* Demand Demilitarization */}
                  <div
                    onClick={() => {
                      sound.playClick();
                      setDemandDisarm(!demandDisarm);
                    }}
                    className={`p-2 rounded-lg border cursor-pointer select-none flex items-center justify-between transition-colors ${
                      demandDisarm
                        ? 'bg-sky-950/60 border-sky-500/70 text-sky-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandDisarm
                            ? 'bg-sky-500 border-sky-400 text-slate-950'
                            : 'border-slate-600'
                        }`}
                      >
                        {demandDisarm && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-sky-400" />
                          Askerden Arındırma (Silahsızlanma)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Kalan tüm düşman garnizonları -%50 terhis edilir.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-sky-400">
                      ⭐ {TREATY_STAR_COSTS.DISARM}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informational Hint */}
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Savaşta cephede fethettiğiniz ve işgal altında tuttuğunuz eyaletler{' '}
                  <strong className="text-emerald-300">-%35 Yıldız İndirimi</strong>{' '}
                  ile talep edilir. Barış imzalandığında 120 günlük ateşkes başlar.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                disabled={budget.acceptanceChance < 50 && !budget.isFullyOccupied}
                onClick={handleSignPeaceDeal}
                className={`w-full min-h-[46px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                  budget.acceptanceChance >= 50 || budget.isFullyOccupied
                    ? 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Handshake className="w-4 h-4" />
                <span>
                  Barış Antlaşmasını İmzala (
                  {demandedTerritoryIds.length > 0
                    ? `${demandedTerritoryIds.length} Eyalet İlhakı`
                    : 'Diplomatik Barış'}
                  )
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleWhitePeace}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  Beyaz Barış (Statüko)
                </button>
                <button
                  onClick={clearAllSelections}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
                >
                  Seçimleri Sıfırla
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols in Landscape): Selectable Enemy Provinces */}
          <div className="lg:col-span-7 space-y-3 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-400" />
                <span>Talep Edilebilecek Düşman Eyaletleri</span>
                <span className="font-mono-num text-[11px] text-slate-400">
                  ({demandedTerritoryIds.length}/{availableEnemyTerritories.length}{' '}
                  Seçildi)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={selectAllOccupied}
                  className="px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-[10px] text-emerald-300 font-semibold"
                >
                  İşgalleri Seç
                </button>
                <button
                  onClick={selectAllProvinces}
                  className="px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-[10px] text-amber-300 font-semibold"
                >
                  Tümünü Seç
                </button>
              </div>
            </div>

            {/* Scrollable list of enemy provinces */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] sm:max-h-[460px] overflow-y-auto pr-1">
              {availableEnemyTerritories.map((t) => {
                const isSelected = demandedTerritoryIds.includes(t.id);
                const isOcc = Boolean(
                  t.ownerId === playerNationId &&
                    t.isOccupied &&
                    t.occupiedById === playerNationId
                );
                const starCost = calculateProvinceStarCost(t, isOcc);

                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTerritory(t.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-400 text-white shadow-md shadow-amber-500/10'
                        : isOcc
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200 hover:bg-slate-900'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border ${
                            isSelected
                              ? 'bg-amber-500 border-amber-400 text-slate-950'
                              : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate flex items-center gap-1">
                            <span>{t.name}</span>
                            {t.isCapital && (
                              <span className="text-[10px] text-amber-400 font-normal">
                                ★ Başkent
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{t.baseGdp} GSYİH</span>
                            <span>·</span>
                            <span>
                              {(t.garrison / 1000).toFixed(1)}B Garnizon
                            </span>
                            <span>·</span>
                            <span className="text-amber-300/90">{t.resource}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono-num font-bold text-amber-300 flex items-center gap-0.5 justify-end">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{starCost}</span>
                        </div>
                        {isOcc && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold block mt-0.5">
                            -%35 İşgal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
