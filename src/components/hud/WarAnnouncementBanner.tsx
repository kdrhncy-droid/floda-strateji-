import React, { useEffect } from 'react';
import { Swords, X } from 'lucide-react';
import { Nation, WarAnnouncement } from '../../types/game';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';

interface WarAnnouncementBannerProps {
  announcement: WarAnnouncement | null;
  playerNationId: string;
  nations: Record<string, Nation>;
  onDismiss: () => void;
}

export const WarAnnouncementBanner: React.FC<WarAnnouncementBannerProps> = ({
  announcement,
  playerNationId,
  nations,
  onDismiss,
}) => {
  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [announcement?.id, onDismiss]);

  if (!announcement) return null;

  const attacker = nations[announcement.attackerId];
  const defender = nations[announcement.defenderId];
  const attackerName = attacker
    ? cleanNationName(attacker.name)
    : announcement.attackerName;
  const defenderName = defender
    ? cleanNationName(defender.name)
    : announcement.defenderName;
  const playerAttacked = announcement.defenderId === playerNationId;

  return (
    <div
      data-testid="war-announcement-banner"
      className="pointer-events-none fixed top-[5.8rem] sm:top-[5.35rem] left-1/2 -translate-x-1/2 z-[45] px-3 w-full max-w-xl flex justify-center landscape:top-[5.5rem]"
    >
      <div
        role="status"
        aria-live="assertive"
        onClick={onDismiss}
        className="pointer-events-auto cursor-pointer relative px-5 sm:px-7 py-2.5 sm:py-3 landscape:py-1.5 landscape:px-4 rounded-2xl border border-[#e0b86e]/70 bg-gradient-to-b from-[#2b1012]/95 via-[#180d0e]/95 to-[#120b09]/95 shadow-[0_14px_40px_rgba(0,0,0,0.75)] flex flex-col items-center text-center gap-1"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Savaş duyurusunu kapat"
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/40 hover:bg-black/70 text-[#b8a990] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2.5">
          {attacker && (
            <NationFlagCanvasBadge
              nationId={attacker.id}
              flagCode={attacker.flagCode}
              color={attacker.color}
              width={28}
              height={19}
            />
          )}
          <div className="flex items-center gap-1.5 text-rose-300 font-display font-extrabold text-sm sm:text-lg tracking-[0.14em] uppercase drop-shadow">
            <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e]" />
            <span>{playerAttacked ? 'ÜLKENİZE SAVAŞ AÇILDI!' : 'SAVAŞ İLAN EDİLDİ!'}</span>
            <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-[#e0b86e]" />
          </div>
          {defender && (
            <NationFlagCanvasBadge
              nationId={defender.id}
              flagCode={defender.flagCode}
              color={defender.color}
              width={28}
              height={19}
            />
          )}
        </div>

        <div className="text-[11.5px] sm:text-xs font-semibold text-[#f3ead7] leading-snug">
          <strong className="text-[#e0b86e]">{attackerName}</strong> ile{' '}
          <strong className="text-rose-200">{defenderName}</strong> arasında resmi savaş başladı!
        </div>
      </div>
    </div>
  );
};
