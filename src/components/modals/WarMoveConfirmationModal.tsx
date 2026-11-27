import React from 'react';
import { Compass, ShieldAlert, Swords, X } from 'lucide-react';
import {
  DiplomaticActionType,
  Nation,
  PendingWarMoveRequest,
  SeaArmy,
  Territory,
} from '../../types/game';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName, cleanProvinceName } from '../../utils/formatters';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';

interface WarMoveConfirmationModalProps {
  pendingWarMove: PendingWarMoveRequest | null;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  seaArmies: SeaArmy[];
  hidden?: boolean;
  onConfirmWarMove: () => void;
  onRequestMilitaryAccess: (targetNationId: string, action: DiplomaticActionType) => void;
  onDismiss: () => void;
}

export const WarMoveConfirmationModal: React.FC<WarMoveConfirmationModalProps> = ({
  pendingWarMove,
  nations,
  territories,
  seaArmies,
  hidden = false,
  onConfirmWarMove,
  onRequestMilitaryAccess,
  onDismiss,
}) => {
  const pendingTargetNation = pendingWarMove ? nations[pendingWarMove.targetNationId] : null;
  const pendingFromTerritory = pendingWarMove ? territories[pendingWarMove.fromId] : null;
  const pendingSourceSeaArmy = pendingWarMove?.sourceSeaArmyId
    ? seaArmies.find((s) => s.id === pendingWarMove.sourceSeaArmyId) || null
    : null;
  const pendingToTerritory = pendingWarMove ? territories[pendingWarMove.toId] : null;

  const isOpen = Boolean(
    !hidden &&
      pendingWarMove &&
      pendingTargetNation &&
      (pendingFromTerritory || pendingSourceSeaArmy) &&
      pendingToTerritory
  );

  const dialogRef = useAccessibleDialog(isOpen, onDismiss);

  if (!isOpen || !pendingWarMove || !pendingTargetNation || !pendingToTerritory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="war-confirmation-title"
        aria-describedby="war-confirmation-description"
        tabIndex={-1}
        className="w-full max-w-md bg-[#14100c] border border-rose-500/60 rounded-2xl shadow-2xl overflow-hidden text-[#f3ead7]"
      >
        <div className="px-4 py-3 bg-gradient-to-r from-[#281214] via-[#1b1510] to-[#14100c] border-b border-rose-500/35 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-900/70 border border-rose-500/50 flex items-center justify-center shadow">
              <ShieldAlert className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <h3 id="war-confirmation-title" className="font-display font-bold text-sm sm:text-base text-[#f3ead7]">
                Sınır İhlali & Savaş İlanı Onayı
              </h3>
              <p className="text-[11px] text-rose-300">
                Diplomatik Kural: Tarafsız Ülke Toprağı
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Savaş ilanı onayını kapat"
            className="w-7 h-7 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/25 flex items-center justify-center text-[#9d8f76] hover:text-[#f3ead7] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f0c09] border border-[#caa15a]/25">
            <div className="flex items-center gap-2.5">
              <NationFlagCanvasBadge
                nationId={pendingTargetNation.id}
                flagCode={pendingTargetNation.flagCode}
                color={pendingTargetNation.color}
                width={38}
                height={26}
              />
              <div>
                <div className="font-bold text-[#f3ead7] text-sm">
                  {cleanNationName(pendingTargetNation.name)}
                </div>
                <div className="text-[11px] text-[#9d8f76]">
                  Hedef Eyalet:{' '}
                  <strong className="text-[#e0b86e]">{cleanProvinceName(pendingToTerritory.name)}</strong> (
                  {(pendingToTerritory.garrison / 1000).toFixed(1)}B Garnizon)
                </div>
              </div>
            </div>
          </div>

          <p id="war-confirmation-description" className="text-[#d4c8b4] leading-relaxed">
            {pendingSourceSeaArmy ? (
              <>
                <strong>{pendingSourceSeaArmy.name}</strong> donanmanızdaki{' '}
                {(pendingSourceSeaArmy.troops / 1000).toFixed(1)}B askeri amfibi çıkarma ile{' '}
              </>
            ) : pendingWarMove.sourceTerritoryIds && pendingWarMove.sourceTerritoryIds.length > 1 ? (
              <>
                <strong>{pendingWarMove.sourceTerritoryIds.length} eyaletinizdeki</strong> (
                {pendingWarMove.sourceTerritoryIds
                  .slice(0, 3)
                  .map((id) => cleanProvinceName(territories[id]?.name || id))
                  .join(', ')}
                {pendingWarMove.sourceTerritoryIds.length > 3
                  ? ` +${pendingWarMove.sourceTerritoryIds.length - 3}`
                  : ''}
                ) ordularınızı{' '}
              </>
            ) : (
              <>
                <strong>{cleanProvinceName(pendingFromTerritory?.name || '')}</strong> eyaletindeki ordunuzu{' '}
              </>
            )}
            <strong>{cleanNationName(pendingTargetNation.name)}</strong> egemenliğindeki{' '}
            <strong>{cleanProvinceName(pendingToTerritory.name)}</strong> toprağına yürütmek üzeresiniz. Aranızda
            resmi bir savaş veya askeri geçiş antlaşması bulunmuyor.
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={onConfirmWarMove}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-900/70 hover:bg-rose-800/80 border border-rose-500/50 text-rose-100 font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Resmen Savaş İlan Et ve Taarruza Geç</span>
            </button>

            <button
              onClick={() => {
                onRequestMilitaryAccess(pendingWarMove.targetNationId, 'MILITARY_ACCESS');
                onDismiss();
              }}
              className="w-full py-2 px-4 rounded-xl bg-[#caa15a]/15 hover:bg-[#caa15a]/25 border border-[#caa15a]/40 text-[#e0b86e] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#e0b86e]" />
              <span>Savaşmadan Askeri Geçiş İzni İste (120 Altın)</span>
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-2 px-4 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/20 text-[#9d8f76] hover:text-[#f3ead7] font-semibold text-xs cursor-pointer"
            >
              Hareket Emrini İptal Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
