import React from 'react';
import { Coins, Handshake, Landmark, ScrollText, Swords, X } from 'lucide-react';
import { WorldNewsEvent } from '../../types/game';
import { sound } from '../../utils/soundEngine';

/**
 * AoH3 bottom-right "chronicle" strip: the latest world events stacked above
 * the minimap plate, each row = brass glyph + date + headline.
 * Tapping anywhere opens the full news drawer.
 */

const TYPE_META: Record<
  WorldNewsEvent['type'],
  { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }
> = {
  WAR: { icon: Swords, tone: 'text-[#d98a6a]', label: 'Harp' },
  PEACE: { icon: Handshake, tone: 'text-[#8fc0a0]', label: 'Sulh' },
  COALITION: { icon: ScrollText, tone: 'text-[#e0b86e]', label: 'İttifak' },
  ECONOMY: { icon: Coins, tone: 'text-[#d9c07a]', label: 'İktisat' },
  REFORM: { icon: Landmark, tone: 'text-[#a8bcd6]', label: 'Nizam' },
};

interface AoH3ChronicleLogProps {
  newsEvents: WorldNewsEvent[];
  onOpenNewsFeed: () => void;
  onClose?: () => void;
  hidden?: boolean;
}

export const AoH3ChronicleLog: React.FC<AoH3ChronicleLogProps> = ({
  newsEvents,
  onOpenNewsFeed,
  onClose,
  hidden = false,
}) => {
  if (hidden) return null;
  const latest = newsEvents.slice(0, 3);
  if (latest.length === 0) return null;

  return (
    <div className="pointer-events-auto hidden xl:block w-[248px]">
      <div className="aoh3-panel aoh3-chamfer rounded-lg overflow-hidden">
        <div className="aoh3-panel-title flex w-full items-center">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onOpenNewsFeed();
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
            title="Tüm dünya haberlerini aç"
          >
            <span className="aoh3-panel-title-text">Dünya Gazetesi</span>
            <span className="aoh3-panel-title-rule" />
            <span className="font-mono-num text-[9px] font-bold text-[#e0b86e] shrink-0">
              {newsEvents.length}
            </span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              aria-label="Dünya Gazetesi panelini kapat"
              title="Gazeteyi kapat"
              className="ml-1 grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-[2px] text-[#c8543c] transition-colors hover:bg-[#3a1d18] hover:text-[#f0603c]"
            >
              <X className="h-3 w-3" strokeWidth={3} />
            </button>
          )}
        </div>

        <ul className="divide-y divide-[#caa15a]/12">
          {latest.map((evt) => {
            const meta = TYPE_META[evt.type] ?? TYPE_META.REFORM;
            const Icon = meta.icon;
            return (
              <li key={evt.id}>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onOpenNewsFeed();
                  }}
                  className="w-full flex items-start gap-1.5 px-2 py-1.5 text-left hover:bg-[#caa15a]/10 transition-colors"
                  title={`${evt.title}\n${evt.description}`}
                >
                  <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${meta.tone}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10.5px] font-semibold text-[#f3ead7] truncate">
                      {evt.title}
                    </span>
                    <span className="block font-mono-num text-[9px] text-[#b2a58f] truncate">
                      {evt.dateStr} · {meta.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
