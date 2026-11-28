import React from 'react';
import { Coins, Handshake, Landmark, ScrollText, Swords } from 'lucide-react';
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
  unreadCount?: number;
  onOpenNewsFeed: () => void;
  hidden?: boolean;
}

export const AoH3ChronicleLog: React.FC<AoH3ChronicleLogProps> = ({
  newsEvents,
  unreadCount = 0,
  onOpenNewsFeed,
  hidden = false,
}) => {
  if (hidden) return null;
  const latest = newsEvents.slice(0, 3);
  if (latest.length === 0) return null;

  return (
    <div className="pointer-events-auto hidden xl:block w-[248px]">
      <div className="aoh3-panel aoh3-chamfer rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onOpenNewsFeed();
          }}
          className="aoh3-panel-title w-full cursor-pointer text-left"
          title="Tüm dünya haberlerini aç"
        >
          <span className="aoh3-panel-title-text">Dünya Gazetesi</span>
          <span className="aoh3-panel-title-rule" />
          {unreadCount > 0 ? (
            <span
              data-testid="chronicle-unread-badge"
              className="inline-flex items-center gap-1 font-mono-num text-[9px] font-bold text-[#f3ead7] shrink-0"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#d1746b]"
                aria-hidden="true"
              />
              {unreadCount}
            </span>
          ) : (
            <span className="font-mono-num text-[9px] font-bold text-[#9b8e78] shrink-0">
              {newsEvents.length}
            </span>
          )}
        </button>

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
