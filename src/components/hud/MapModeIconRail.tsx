import React from 'react';
import { MapMode } from '../../types/game';
import { AoH3GlyphName, AoH3GlyphSvg } from '../illustrations/AoH3Illustrations';
import { sound } from '../../utils/soundEngine';

/**
 * AoH3-style map lens rail. The ten lenses used to hide behind a "Siyasi"
 * dropdown pill in the top bar; they now sit as a compact icon row docked
 * straight onto the top edge of the bottom-right minimap plate, so switching
 * a lens never costs a two-click detour through the HUD.
 */
export const MAP_MODES: ReadonlyArray<{
  id: MapMode;
  label: string;
  glyph: AoH3GlyphName;
  tone: string;
}> = [
  { id: 'POLITICAL', label: 'Siyasi', glyph: 'crown', tone: 'text-[#e0b86e]' },
  { id: 'ECONOMIC', label: 'Ekonomi', glyph: 'gold', tone: 'text-[#e0b86e]' },
  { id: 'RESOURCES', label: 'Kaynaklar', glyph: 'hammer', tone: 'text-[#e0b86e]' },
  { id: 'DIPLOMATIC', label: 'Diplomasi', glyph: 'scale', tone: 'text-[#e0b86e]' },
  { id: 'MILITARY', label: 'Askeri', glyph: 'sword', tone: 'text-rose-300' },
  { id: 'RELIGION', label: 'Din', glyph: 'fleur', tone: 'text-[#e0b86e]' },
  { id: 'CULTURE', label: 'Kültür', glyph: 'flag', tone: 'text-[#e0b86e]' },
  { id: 'ASSIMILATION', label: 'Asimilasyon', glyph: 'globe', tone: 'text-[#e0b86e]' },
  { id: 'TERRAIN', label: 'Arazi', glyph: 'compass', tone: 'text-[#e0b86e]' },
  { id: 'IDEOLOGY', label: 'İdeoloji', glyph: 'star', tone: 'text-[#e0b86e]' },
];

interface MapModeIconRailProps {
  mapMode: MapMode;
  onSetMapMode?: (mode: MapMode) => void;
}

export const MapModeIconRail: React.FC<MapModeIconRailProps> = ({
  mapMode,
  onSetMapMode,
}) => {
  if (!onSetMapMode) return null;

  return (
    <div className="mb-1 flex justify-end pointer-events-auto">
      <div className="aoh3-panel aoh3-chamfer flex items-center gap-0.5 rounded-md px-1 py-0.5 shadow-lg">
        {MAP_MODES.map((mode) => {
          const active = mapMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                sound.playClick();
                onSetMapMode(mode.id);
              }}
              title={mode.label}
              aria-label={`Harita modu: ${mode.label}`}
              aria-pressed={active}
              className={`grid h-[19px] w-[19px] place-items-center rounded-[3px] border transition-colors cursor-pointer ${
                active
                  ? 'border-[#f3ead7] bg-[#caa15a] text-[#14100c] shadow-sm'
                  : 'border-transparent text-[#d8cbb5] hover:border-[#caa15a]/45 hover:bg-[#241c13]'
              }`}
            >
              <AoH3GlyphSvg
                name={mode.glyph}
                className={`h-3 w-3 shrink-0 ${active ? 'text-[#14100c]' : mode.tone}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
