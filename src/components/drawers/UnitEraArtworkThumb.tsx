import React, { useState } from 'react';
import { UnitType } from '../../types/game';
import {
  getRecruitUnitArtwork,
  getUnitVisualEraLabel,
} from './buildingArtwork';

interface UnitEraArtworkThumbProps {
  unitType: UnitType | 'MIXED';
  gameMode: string;
  tier: number;
  className?: string;
  alt?: string;
  showEraPill?: boolean;
}

export const UnitEraArtworkThumb: React.FC<UnitEraArtworkThumbProps> = ({
  unitType,
  gameMode,
  tier,
  className = 'w-11 h-11 rounded-lg',
  alt,
  showEraPill = false,
}) => {
  const [imgBroken, setImgBroken] = useState(false);
  const art = getRecruitUnitArtwork(unitType, gameMode, tier);
  const eraLabel = getUnitVisualEraLabel(gameMode, tier);

  return (
    <div
      data-testid={`unit-era-art-${unitType}-t${tier}`}
      className={`relative overflow-hidden border border-[#caa15a]/50 shadow-inner shrink-0 select-none ${className}`}
      style={{ background: art.fallbackGradient }}
      title={`${alt || unitType} · ${eraLabel}`}
    >
      {!imgBroken && (
        <img
          src={art.src}
          alt={alt || `${unitType} (${eraLabel})`}
          loading="eager"
          decoding="sync"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setImgBroken(true)}
          style={{ objectPosition: art.objectPosition }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20 pointer-events-none"
      />
      {showEraPill && (
        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 border border-[#caa15a]/45 text-[8.5px] font-bold text-[#e0b86e] leading-tight tracking-wide pointer-events-none">
          {eraLabel}
        </span>
      )}
    </div>
  );
};
