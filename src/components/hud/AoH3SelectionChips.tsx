import React from 'react';
import { X } from 'lucide-react';
import { Nation, Territory } from '../../types/game';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { sound } from '../../utils/soundEngine';

/**
 * AoH3 "selected provinces" ribbon: small flag chips with a red ✕ dismiss
 * button, shown right under the map tools whenever a macro selection is active.
 */

interface AoH3SelectionChipsProps {
  territoryIds: string[];
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  label: string;
  onRemove: (territoryId: string) => void;
  onClear: () => void;
}

const MAX_VISIBLE = 8;

export const AoH3SelectionChips: React.FC<AoH3SelectionChipsProps> = ({
  territoryIds,
  territories,
  nations,
  playerNationId,
  label,
  onRemove,
  onClear,
}) => {
  if (territoryIds.length === 0) return null;
  const visible = territoryIds.slice(0, MAX_VISIBLE);
  const overflow = territoryIds.length - visible.length;

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full"
      aria-label={label}
    >
      <span className="aoh3-chip-label shrink-0">{label}</span>
      {visible.map((id) => {
        const territory = territories[id];
        if (!territory) return null;
        const ownerId = territory.ownerId || playerNationId;
        const nation = nations[ownerId];
        return (
          <span
            key={id}
            className="aoh3-flagchip shrink-0"
            title={`${territory.name} — ${nation?.name ?? ownerId}`}
          >
            <NationFlagCanvasBadge
              nationId={ownerId}
              flagCode={nation?.flagCode ?? ownerId}
              color={nation?.color ?? '#8b7a5a'}
              width={16}
              height={11}
            />
            <span className="max-w-[86px] truncate">
              {territory.name.replace(/^★\s*/, '')}
            </span>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onRemove(id);
              }}
              aria-label={`${territory.name} seçimini kaldır`}
              title="Seçimi kaldır"
              className="aoh3-flagchip-x"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="aoh3-chip-label shrink-0">+{overflow}</span>
      )}
      <button
        type="button"
        onClick={() => {
          sound.playClick();
          onClear();
        }}
        className="aoh3-chip-clear shrink-0"
        title="Tüm seçimi temizle"
      >
        Temizle
      </button>
    </div>
  );
};
