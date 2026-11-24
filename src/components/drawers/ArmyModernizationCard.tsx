import React from 'react';
import { Nation } from '../../types/game';
import {
  calculateArmyModernizationCost,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
} from '../../data/world2026Data';

interface ArmyModernizationCardProps {
  playerNation: Nation;
  totalGarrison: number;
  gameMode: string;
  onModernizeNationalArmy: () => void;
}

export const ArmyModernizationCard: React.FC<ArmyModernizationCardProps> = ({
  playerNation,
  totalGarrison,
  gameMode,
  onModernizeNationalArmy,
}) => {
  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const targetArmyGen = getArmyGenerationInfo(gameMode, unlockedMilTier);
  const hasPendingArmyUpgrade = unlockedMilTier > modernizedTier;
  const modernizationCost = calculateArmyModernizationCost(
    playerNation,
    totalGarrison
  );
  const canAffordModernization =
    hasPendingArmyUpgrade && playerNation.treasury >= modernizationCost;

  const classCards = [
    {
      role: '1. Hat · Asker Sınıfı',
      classLabel: activeArmyGen.infantryClassLabel,
      unitName: activeArmyGen.infantryShort,
      nextUnitName: targetArmyGen.infantryShort,
      tone: 'border-emerald-500/35 bg-emerald-950/25 text-emerald-300',
    },
    {
      role: 'Kanat · Asker Sınıfı',
      classLabel: activeArmyGen.armorClassLabel,
      unitName: activeArmyGen.armorShort,
      nextUnitName: targetArmyGen.armorShort,
      tone: 'border-amber-500/35 bg-amber-950/25 text-amber-300',
    },
    {
      role: 'Destek · Asker Sınıfı',
      classLabel: activeArmyGen.airArtilleryClassLabel,
      unitName: activeArmyGen.airArtilleryShort,
      nextUnitName: targetArmyGen.airArtilleryShort,
      tone: 'border-sky-500/35 bg-sky-950/25 text-sky-300',
    },
  ];

  return (
    <div
      data-testid="army-modernization-card"
      className={`rounded-2xl p-3.5 border space-y-2.5 ${
        hasPendingArmyUpgrade
          ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-sky-950/50 border-amber-400/60 shadow-lg shadow-amber-500/10'
          : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 font-mono-num text-[11px] font-bold text-amber-300">
            {activeArmyGen.generationLabel}
          </span>
          <span className="text-xs font-bold text-white">
            {activeArmyGen.eraTitle}
          </span>
        </div>
        <span className="font-mono-num text-xs font-bold text-emerald-400">
          {activeArmyGen.combatBonusPct > 0
            ? `+%${activeArmyGen.combatBonusPct} Modernizasyon Gücü`
            : 'Temel Teçhizat'}
        </span>
      </div>

      {/* Explicit AoH3 Troop Classes Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {classCards.map((c) => (
          <div
            key={c.role}
            className={`rounded-xl px-2.5 py-1.5 border ${c.tone}`}
          >
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
              {c.role}
            </div>
            <div className="text-[11px] font-extrabold truncate mt-0.5">
              {c.classLabel}
            </div>
            <div className="text-[10px] text-slate-200 truncate">
              {hasPendingArmyUpgrade ? (
                <>
                  <span className="opacity-75">{c.unitName}</span>{' '}
                  <span className="text-amber-300 font-bold">→ {c.nextUnitName}</span>
                </>
              ) : (
                <span>Aktif: {c.unitName}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasPendingArmyUpgrade ? (
        <button
          data-testid="modernize-army-btn"
          disabled={!canAffordModernization}
          onClick={onModernizeNationalArmy}
          className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 transition-all cursor-pointer ${
            canAffordModernization
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <span className="text-center sm:text-left">
            ⚡ Birlikleri Yükselt: {targetArmyGen.generationLabel} ({targetArmyGen.eraTitle})
          </span>
          <span className="font-mono-num shrink-0 opacity-90">
            {modernizationCost} Altın · +%{targetArmyGen.combatBonusPct} Güç
          </span>
        </button>
      ) : (
        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-0.5">
          <span>
            {unlockedMilTier < 4
              ? 'Yeni asker sınıfları ve birlik yükseltmeleri için Askeri Teknoloji Ağacında ilerleyin.'
              : 'Tüm birlik sınıflarınız çağın zirve teknolojisine yükseltildi!'}
          </span>
          <span className="font-mono-num text-sky-400 font-semibold shrink-0 ml-2">
            Askeri Tek.: {unlockedMilTier}/4
          </span>
        </div>
      )}
    </div>
  );
};
