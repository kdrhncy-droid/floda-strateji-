import React from 'react';
import { Nation } from '../../types/game';
import {
  calculateArmyModernizationCost,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
} from '../../data/world2026Data';
import { AoH3GlyphSvg } from '../illustrations/AoH3Illustrations';
import { getTechArtwork } from './techArtwork';

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

  const artwork = getTechArtwork(
    unlockedMilTier >= 3 ? 'ARTILLERY' : 'INFANTRY',
    'MILITARY'
  );

  const classCards = [
    {
      role: '1. Hat · Asker Sınıfı',
      classLabel: activeArmyGen.infantryClassLabel,
      unitName: activeArmyGen.infantryShort,
      nextUnitName: targetArmyGen.infantryShort,
      icon: 'sword' as const,
    },
    {
      role: 'Kanat · Asker Sınıfı',
      classLabel: activeArmyGen.armorClassLabel,
      unitName: activeArmyGen.armorShort,
      nextUnitName: targetArmyGen.armorShort,
      icon: 'cavalry' as const,
    },
    {
      role: 'Destek · Asker Sınıfı',
      classLabel: activeArmyGen.airArtilleryClassLabel,
      unitName: activeArmyGen.airArtilleryShort,
      nextUnitName: targetArmyGen.airArtilleryShort,
      icon: 'artillery' as const,
    },
  ];

  return (
    <div
      data-testid="army-modernization-card"
      className={`rounded-2xl p-3.5 border space-y-2.5 ${
        hasPendingArmyUpgrade
          ? 'bg-gradient-to-r from-[#241b11] via-[#17120c] to-[#1d160e] border-[#e0b86e]/70 shadow-lg shadow-[#caa15a]/10'
          : 'bg-[#14100c] border-[#caa15a]/35'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg overflow-hidden border border-[#caa15a]/50 shrink-0"
            style={{ background: artwork.fallbackGradient }}
          >
            <img
              src={artwork.src}
              alt={activeArmyGen.eraTitle}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              style={{ objectPosition: artwork.objectPosition }}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#241c13] border border-[#caa15a]/50 font-mono-num text-[11px] font-bold text-[#e0b86e]">
              {activeArmyGen.generationLabel}
            </span>
            <span className="text-xs font-bold text-[#f3ead7]">
              {activeArmyGen.eraTitle}
            </span>
          </div>
        </div>
        <span className="font-mono-num text-xs font-bold text-emerald-400">
          {activeArmyGen.combatBonusPct > 0
            ? `+%${activeArmyGen.combatBonusPct} Modernizasyon Gücü`
            : 'Temel Teçhizat'}
        </span>
      </div>

      {/* Explicit AoH3 Troop Classes Breakdown (Unified Obsidian + Antique Gold) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {classCards.map((c) => (
          <div
            key={c.role}
            className="rounded-xl px-2.5 py-1.5 border border-[#caa15a]/30 bg-[#1b1510]"
          >
            <div className="text-[9px] uppercase tracking-wider text-[#b8a990] font-bold flex items-center gap-1">
              <AoH3GlyphSvg name={c.icon} className="w-2.5 h-2.5 text-[#e0b86e]" />
              <span>{c.role}</span>
            </div>
            <div className="text-[11px] font-extrabold text-[#e0b86e] truncate mt-0.5">
              {c.classLabel}
            </div>
            <div className="text-[10px] text-[#d8cbb5] truncate">
              {hasPendingArmyUpgrade ? (
                <>
                  <span className="opacity-75">{c.unitName}</span>{' '}
                  <span className="text-[#f3ead7] font-bold">→ {c.nextUnitName}</span>
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
          type="button"
          data-testid="modernize-army-btn"
          disabled={!canAffordModernization}
          onClick={onModernizeNationalArmy}
          className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 transition-all cursor-pointer ${
            canAffordModernization
              ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16b] hover:to-[#ecc77e] text-[#14100c] shadow-md'
              : 'bg-[#120e0a] text-[#7c6f59] border border-[#caa15a]/25 cursor-not-allowed'
          }`}
        >
          <span className="text-center sm:text-left flex items-center gap-1.5">
            <AoH3GlyphSvg name="bolt" className="w-3.5 h-3.5 shrink-0" />
            <span>
              Birlikleri Yükselt: {targetArmyGen.generationLabel} ({targetArmyGen.eraTitle})
            </span>
          </span>
          <span className="font-mono-num shrink-0 opacity-90">
            {modernizationCost} Altın · +%{targetArmyGen.combatBonusPct} Güç
          </span>
        </button>
      ) : (
        <div className="text-[11px] text-[#b8a990] flex items-center justify-between pt-0.5">
          <span>
            {unlockedMilTier < 7
              ? 'Yeni asker sınıfları ve birlik yükseltmeleri için Askeri Teknoloji Ağacında ilerleyin.'
              : 'Tüm birlik sınıflarınız 2026 zirve teknolojisine yükseltildi!'}
          </span>
          <span className="font-mono-num text-[#e0b86e] font-semibold shrink-0 ml-2">
            Askeri Tek.: {unlockedMilTier}/7
          </span>
        </div>
      )}
    </div>
  );
};
