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

const AUTO_DISMISS_MS = 3500;

function getEventAccent(type: WorldNewsEvent['type']): {
  border: string;
  badgeBg: string;
  label: string;
  icon: React.ReactNode;
} {
  switch (type) {
    case 'WAR':
      return {
        border: 'border-rose-500/55',
        badgeBg: 'bg-rose-500/20 text-rose-300',
        label: 'Savaş',
        icon: <Swords className="w-3 h-3 text-rose-400 shrink-0" />,
      };
    case 'PEACE':
      return {
        border: 'border-emerald-500/50',
        badgeBg: 'bg-emerald-500/20 text-emerald-300',
        label: 'Barış',
        icon: <Handshake className="w-3 h-3 text-emerald-400 shrink-0" />,
      };
    case 'COALITION':
      return {
        border: 'border-sky-500/50',
        badgeBg: 'bg-sky-500/20 text-sky-300',
        label: 'Diplomasi',
        icon: <Scale className="w-3 h-3 text-sky-300 shrink-0" />,
      };
    case 'REFORM':
      return {
        border: 'border-amber-500/55',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        label: 'Reform',
        icon: <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />,
      };
    default:
      return {
        border: 'border-amber-500/45',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        label: 'Haber',
        icon: <ScrollText className="w-3 h-3 text-amber-300 shrink-0" />,
      };
  }
}

/**
 * Compact AoH3-style live world diplomacy/war/peace notification ribbons.
 * Non-intrusive, renders above drawers/modals (z-[115]), auto-dismisses in 3.5s,
 * and can be closed immediately with a single tap on ✕.
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
    }, 300);
    return () => window.clearInterval(timer);
  }, [liveToasts.length]);

  if (liveToasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="hud-world-toast-stack fixed z-[115] pointer-events-none flex flex-col gap-1 w-[min(265px,calc(100vw-1rem))] top-[4.6rem] sm:top-[4.4rem] right-2 sm:right-3"
    >
      {liveToasts.map(({ event }, index) => {
        const accent = getEventAccent(event.type);
        return (
          <div
            key={event.id}
            data-full-text={`${event.title} — ${event.description} (${event.dateStr})`}
            className={`hud-world-toast-item pointer-events-auto rounded-lg bg-[#0d111a]/95 border ${accent.border} shadow-lg px-2 py-1.5 text-slate-100 transition-all backdrop-blur-sm ${
              index > 0 ? 'hud-landscape-hide' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              {accent.icon}
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
                <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                  <span className={`font-bold ${accent.badgeBg} px-1 py-0.2 rounded`}>
                    {accent.label}
                  </span>
                  <span className="font-mono-num truncate">{event.dateStr}</span>
                </div>
                <div className="text-[10px] font-bold text-amber-100 leading-tight truncate">
                  {event.title}
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
                className="w-5 h-5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center justify-center shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
