import React, { useEffect, useRef, useState } from 'react';
import {
  Handshake,
  Scale,
  ScrollText,
  ShieldAlert,
  Swords,
  X,
} from 'lucide-react';
import { WorldNewsEvent } from '../../types/game';

interface WorldEventToastStackProps {
  newsEvents: WorldNewsEvent[];
  onOpenNewsFeed: () => void;
}

interface ActiveLiveToast {
  event: WorldNewsEvent;
  shownAtMs: number;
}

const AUTO_DISMISS_MS = 5600;

function getEventAccent(type: WorldNewsEvent['type']): {
  border: string;
  badgeBg: string;
  label: string;
  icon: React.ReactNode;
} {
  switch (type) {
    case 'WAR':
      return {
        border: 'border-rose-500/60',
        badgeBg: 'bg-rose-500/20 text-rose-300',
        label: 'Savaş',
        icon: <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
      };
    case 'PEACE':
      return {
        border: 'border-emerald-500/55',
        badgeBg: 'bg-emerald-500/20 text-emerald-300',
        label: 'Barış',
        icon: <Handshake className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
      };
    case 'COALITION':
      return {
        border: 'border-sky-500/55',
        badgeBg: 'bg-sky-500/20 text-sky-300',
        label: 'Diplomasi',
        icon: <Scale className="w-3.5 h-3.5 text-sky-300 shrink-0" />,
      };
    case 'REFORM':
      return {
        border: 'border-amber-500/60',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        label: 'Reform',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      };
    default:
      return {
        border: 'border-amber-500/50',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        label: 'Ekonomi',
        icon: <ScrollText className="w-3.5 h-3.5 text-amber-300 shrink-0" />,
      };
  }
}

/**
 * Live world diplomacy/war/peace notification banners.
 * Automatically adapts to desktop, iOS/Android portrait, and mobile landscape
 * without blocking HUD controls, and auto-dismisses after ~5.6 seconds.
 */
export const WorldEventToastStack: React.FC<WorldEventToastStackProps> = ({
  newsEvents,
  onOpenNewsFeed,
}) => {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [liveToasts, setLiveToasts] = useState<ActiveLiveToast[]>([]);

  // Seed initial events without spamming on campaign load
  useEffect(() => {
    if (!initializedRef.current) {
      newsEvents.forEach((ev) => seenIdsRef.current.add(ev.id));
      initializedRef.current = true;
      return;
    }

    const fresh: WorldNewsEvent[] = [];
    for (const ev of newsEvents) {
      if (seenIdsRef.current.has(ev.id)) break;
      seenIdsRef.current.add(ev.id);
      if (
        ev.type === 'WAR' ||
        ev.type === 'PEACE' ||
        ev.type === 'COALITION' ||
        ev.type === 'REFORM'
      ) {
        fresh.push(ev);
      }
    }

    if (fresh.length === 0) return;

    const now = Date.now();
    setLiveToasts((prev) => {
      const incoming = fresh
        .slice(0, 2)
        .map((event) => ({ event, shownAtMs: now }));
      return [...incoming, ...prev].slice(0, 2);
    });
  }, [newsEvents]);

  // Auto-dismiss expired notifications
  useEffect(() => {
    if (liveToasts.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setLiveToasts((prev) =>
        prev.filter((item) => now - item.shownAtMs < AUTO_DISMISS_MS)
      );
    }, 350);
    return () => window.clearInterval(timer);
  }, [liveToasts.length]);

  if (liveToasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="hud-world-toast-stack fixed z-30 pointer-events-none flex flex-col gap-1.5 w-[min(320px,calc(100vw-1.25rem))] top-[7.1rem] sm:top-[6.4rem] right-2 sm:right-3"
    >
      {liveToasts.map(({ event }, index) => {
        const accent = getEventAccent(event.type);
        return (
          <div
            key={event.id}
            data-full-text={`${event.title} — ${event.description} (${event.dateStr})`}
            className={`hud-world-toast-item pointer-events-auto rounded-xl bg-slate-950/92 border ${accent.border} shadow-xl px-2.5 py-2 text-slate-100 transition-all ${
              index > 0 ? 'hud-landscape-hide' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{accent.icon}</div>
              <button
                type="button"
                onClick={() => {
                  setLiveToasts((prev) =>
                    prev.filter((x) => x.event.id !== event.id)
                  );
                  onOpenNewsFeed();
                }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 leading-tight mb-0.5">
                  <span className={`font-bold ${accent.badgeBg} px-1 py-0.2 rounded`}>
                    {accent.label}
                  </span>
                  <span className="font-mono-num">{event.dateStr}</span>
                </div>
                <div className="text-[11px] font-bold text-amber-100 leading-snug line-clamp-1">
                  {event.title}
                </div>
                <div className="text-[10px] text-slate-300 leading-snug line-clamp-2 mt-0.5">
                  {event.description}
                </div>
              </button>
              <button
                type="button"
                aria-label="Bildirimi kapat"
                onClick={() =>
                  setLiveToasts((prev) =>
                    prev.filter((x) => x.event.id !== event.id)
                  )
                }
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center justify-center shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
