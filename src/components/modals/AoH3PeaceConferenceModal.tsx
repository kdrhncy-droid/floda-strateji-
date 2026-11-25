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
import {
  AoH3GlyphSvg,
  AoH3MenuBanner,
  ResourceSvg,
} from '../illustrations/AoH3Illustrations';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in pointer-events-auto">
      <div className="relative w-full max-w-5xl max-h-[92vh] landscape:max-h-[96vh] bg-[#14100c]/98 border border-[#caa15a]/55 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f3ead7]">
        {/* Modal Header with Illustrated Banner */}
        <div className="p-2.5 sm:p-3 bg-[#17120d] border-b border-[#caa15a]/35 flex items-center justify-between shrink-0 gap-2.5">
          <div className="flex-1 min-w-0">
            <AoH3MenuBanner
              artKey="COURT"
              branch="ADMINISTRATION"
              icon="dove"
              title={`Barış Konferansı Masası · ${war.name}`}
              subtitle={`Muhatap: ${enemyNation.name} · Savaş Skoru: ${
                budget.playerWarScore > 0 ? `+${budget.playerWarScore}` : budget.playerWarScore
              }%${budget.isFullyOccupied ? ' · TAM İŞGAL (%100)' : ''}`}
              className="h-14 sm:h-16"
            />
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            aria-label="Barış konferansını kapat"
            className="p-2 rounded-xl bg-[#1b1510] border border-[#3a2f22] text-[#b8a990] hover:text-[#faf3e3] hover:border-[#caa15a]/50 transition-colors shrink-0 cursor-pointer"
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
              <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/35 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#e0b86e]">
                    <Star className="w-4 h-4 fill-[#e0b86e] text-[#e0b86e]" />
                    Barış Yıldızı Puanı (Warscore Stars)
                  </span>
                  <span
                    className={`font-mono-num text-sm flex items-center gap-1 ${
                      budget.remainingStars >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    <AoH3GlyphSvg name="star" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                    <span>{budget.spentStars} / {budget.totalStars}</span>
                  </span>
                </div>

                <div className="w-full h-2.5 bg-[#0f0c09] rounded-full overflow-hidden border border-[#3a2f22]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      budget.remainingStars >= 0
                        ? 'bg-gradient-to-r from-[#8f6a34] via-[#caa15a] to-[#e0b86e]'
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

                <div className="flex items-center justify-between text-[11px] text-[#b8a990]">
                  <span className="inline-flex items-center gap-1">
                    <span>Kalan Bütçe:</span>
                    <strong
                      className={`font-mono-num inline-flex items-center gap-0.5 ${
                        budget.remainingStars >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      <span>{budget.remainingStars >= 0 ? '+' : ''}{budget.remainingStars}</span>
                      <AoH3GlyphSvg name="star" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                    </strong>
                  </span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      budget.acceptanceChance >= 75
                        ? 'text-emerald-300'
                        : budget.acceptanceChance >= 40
                        ? 'text-[#e0b86e]'
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
              <div className="p-3 rounded-xl bg-[#1b1510] border border-[#3a2f22] space-y-2">
                <div className="text-xs font-bold text-[#faf3e3] flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-[#e0b86e]" />
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
                        ? 'bg-[#2a2117] border-[#caa15a] text-[#f3ead7]'
                        : 'bg-[#14100c] border-[#3a2f22] text-[#d8cbb5] hover:border-[#caa15a]/45'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandReparations
                            ? 'bg-[#caa15a] border-[#f3ead7] text-[#14100c]'
                            : 'border-[#6e604c]'
                        }`}
                      >
                        {demandReparations && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-[#e0b86e]" />
                          Harp Tazminatı Al
                        </div>
                        <div className="text-[10px] text-[#b8a990]">
                          Düşman hazinesinin %45'i anında hazinenize aktarılır.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-[#e0b86e] flex items-center gap-0.5 shrink-0">
                      <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                      <span>{TREATY_STAR_COSTS.REPARATIONS}</span>
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
                        ? 'bg-[#2a2117] border-[#caa15a] text-[#f3ead7]'
                        : 'bg-[#14100c] border-[#3a2f22] text-[#d8cbb5] hover:border-[#caa15a]/45'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandVassal
                            ? 'bg-[#caa15a] border-[#f3ead7] text-[#14100c]'
                            : 'border-[#6e604c]'
                        }`}
                      >
                        {demandVassal && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-[#e0b86e]" />
                          Vasallaştırma (Tabi Devlet Yap)
                        </div>
                        <div className="text-[10px] text-[#b8a990]">
                          Devlet bağımsızlığını kaybeder ve himayenize girer.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-[#e0b86e] flex items-center gap-0.5 shrink-0">
                      <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                      <span>{TREATY_STAR_COSTS.VASSALIZE}</span>
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
                        ? 'bg-[#2a2117] border-[#caa15a] text-[#f3ead7]'
                        : 'bg-[#14100c] border-[#3a2f22] text-[#d8cbb5] hover:border-[#caa15a]/45'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          demandDisarm
                            ? 'bg-[#caa15a] border-[#f3ead7] text-[#14100c]'
                            : 'border-[#6e604c]'
                        }`}
                      >
                        {demandDisarm && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-[#e0b86e]" />
                          Askerden Arındırma (Silahsızlanma)
                        </div>
                        <div className="text-[10px] text-[#b8a990]">
                          Kalan tüm düşman garnizonları -%50 terhis edilir.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-[#e0b86e] flex items-center gap-0.5 shrink-0">
                      <AoH3GlyphSvg name="star" className="w-3 h-3 shrink-0" />
                      <span>{TREATY_STAR_COSTS.DISARM}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Informational Hint */}
              <div className="p-2.5 rounded-xl bg-[#0f0c09] border border-[#3a2f22] text-[11px] text-[#b8a990] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#e0b86e] shrink-0 mt-0.5" />
                <p>
                  Savaşta cephede fethettiğiniz ve işgal altında tuttuğunuz eyaletler{' '}
                  <strong className="text-[#e0b86e]">-%35 Yıldız İndirimi</strong>{' '}
                  ile talep edilir. Barış imzalandığında 120 günlük ateşkes başlar.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                disabled={budget.acceptanceChance < 50 && !budget.isFullyOccupied}
                onClick={handleSignPeaceDeal}
                className={`w-full min-h-[46px] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                  budget.acceptanceChance >= 50 || budget.isFullyOccupied
                    ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#e0b86e] hover:to-[#f3ead7] text-[#14100c]'
                    : 'bg-[#1b1510] text-[#7e705a] cursor-not-allowed border border-[#3a2f22]'
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
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/35 text-[#f3ead7] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Beyaz Barış (Statüko)
                </button>
                <button
                  onClick={clearAllSelections}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0f0c09] hover:bg-[#1b1510] border border-[#3a2f22] text-[#b8a990] hover:text-[#f3ead7] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Seçimleri Sıfırla
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols in Landscape): Selectable Enemy Provinces */}
          <div className="lg:col-span-7 space-y-3 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3a2f22] pb-2">
              <div className="text-xs font-bold text-[#faf3e3] flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#e0b86e]" />
                <span>Talep Edilebilecek Düşman Eyaletleri</span>
                <span className="font-mono-num text-[11px] text-[#b8a990]">
                  ({demandedTerritoryIds.length}/{availableEnemyTerritories.length}{' '}
                  Seçildi)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={selectAllOccupied}
                  className="px-2 py-1 rounded-lg bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[10px] text-[#e0b86e] font-semibold cursor-pointer"
                >
                  İşgalleri Seç
                </button>
                <button
                  onClick={selectAllProvinces}
                  className="px-2 py-1 rounded-lg bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[10px] text-[#f3ead7] font-semibold cursor-pointer"
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
                        ? 'bg-[#2a2117] border-[#e0b86e] text-[#faf3e3] shadow-md'
                        : isOcc
                        ? 'bg-[#241c13]/75 border-[#caa15a]/45 text-[#f3ead7] hover:bg-[#2a2117]'
                        : 'bg-[#1b1510] border-[#3a2f22] text-[#d8cbb5] hover:border-[#caa15a]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border ${
                            isSelected
                              ? 'bg-[#caa15a] border-[#f3ead7] text-[#14100c]'
                              : 'border-[#6e604c]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate flex items-center gap-1">
                            <span>{t.name}</span>
                            {t.isCapital && (
                              <span className="text-[10px] text-[#e0b86e] font-normal inline-flex items-center gap-0.5 shrink-0">
                                <AoH3GlyphSvg name="star" className="w-2.5 h-2.5 shrink-0" />
                                <span>Başkent</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#b8a990] flex items-center gap-1.5 flex-wrap">
                            <span>{t.baseGdp} GSYİH</span>
                            <span>·</span>
                            <span>
                              {(t.garrison / 1000).toFixed(1)}B Garnizon
                            </span>
                            <span>·</span>
                            <span className="text-[#e0b86e] inline-flex items-center gap-0.5">
                              <ResourceSvg resource={t.resource} className="w-2.5 h-2.5 shrink-0" />
                              <span>{t.resource}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono-num font-bold text-[#e0b86e] flex items-center gap-0.5 justify-end">
                          <Star className="w-3 h-3 fill-[#e0b86e] text-[#e0b86e]" />
                          <span>{starCost}</span>
                        </div>
                        {isOcc && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[#caa15a]/20 border border-[#caa15a]/45 text-[#e0b86e] font-bold block mt-0.5">
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
