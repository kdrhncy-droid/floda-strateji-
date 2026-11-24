import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
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
  toastMessage?: string | null;
  isDrawerOpen?: boolean;
  onDismissToast?: () => void;
  onOpenNewsFeed: () => void;
}

interface ActiveLiveToast {
  event: WorldNewsEvent;
  shownAtMs: number;
}

const AUTO_DISMISS_MS = 3200;

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
        border: 'border-[#caa15a]/50',
        badgeBg: 'bg-amber-500/20 text-amber-300',
        label: 'Haber',
        icon: <ScrollText className="w-3 h-3 text-amber-300 shrink-0" />,
      };
  }
}

/**
 * Unified Age of History 3 Horizontal Compact Notification Ribbon (Right Side Only).
 * Eliminates duplicate left/right war notifications and displays all alerts in a
 * sleek, compact horizontal AoH3 dark-parchment & gold bar on the right.
 */
export const WorldEventToastStack: React.FC<WorldEventToastStackProps> = ({
  newsEvents,
  toastMessage,
  isDrawerOpen = false,
  onDismissToast,
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
        .slice(0, 1)
        .map((event) => ({ event, shownAtMs: now }));
      return [...incoming, ...prev].slice(0, 1);
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

  // When a direct toastMessage is active, suppress redundant simultaneous liveToast so only ONE compact notification renders on the right
  const visibleNewsToasts = toastMessage ? [] : liveToasts;

  return (
    <div
      aria-live="polite"
      className={`hud-world-toast-stack absolute z-[55] pointer-events-none flex flex-col items-end gap-1 w-[min(220px,calc(100vw-1rem))] sm:w-[255px] right-2 ${
        isDrawerOpen
          ? 'top-1.5 sm:top-[3.15rem]'
          : 'top-[3.05rem] sm:top-[3.15rem]'
      }`}
    >
      {/* Unified AoH3 Horizontal Action / War Toast Ribbon */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        onClick={() => onDismissToast?.()}
        className={
          toastMessage
            ? 'hud-toast-banner pointer-events-auto w-full rounded-lg bg-[#14110e]/95 border border-[#caa15a]/65 shadow-xl px-2.5 py-1.5 text-[10px] font-semibold text-[#f5ecd9] flex items-center gap-1.5 cursor-pointer backdrop-blur-sm'
            : 'sr-only'
        }
      >
        <Bell className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="flex-1 min-w-0 leading-tight line-clamp-2 break-words">
          {toastMessage ?? ''}
        </span>
        {toastMessage && onDismissToast && (
          <button
            type="button"
            aria-label="Bildirimi kapat"
            onClick={(e) => {
              e.stopPropagation();
              onDismissToast();
            }}
            className="w-4 h-4 rounded text-[#c5b79e] hover:text-white hover:bg-black/50 flex items-center justify-center shrink-0"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Compact AoH3 Horizontal World Event Ribbon */}
      {visibleNewsToasts.map(({ event }) => {
        const accent = getEventAccent(event.type);
        return (
          <div
            key={event.id}
            data-full-text={`${event.title} — ${event.description} (${event.dateStr})`}
            className={`hud-world-toast-item pointer-events-auto w-full rounded-lg bg-[#14110e]/95 border ${accent.border} shadow-lg px-2 py-1 text-[#f5ecd9] transition-all backdrop-blur-sm`}
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
                className="flex-1 min-w-0 text-left flex items-center gap-1.5"
              >
                <span
                  className={`text-[8px] font-bold ${accent.badgeBg} px-1 py-0.2 rounded shrink-0`}
                >
                  {accent.label}
                </span>
                <span className="text-[10px] font-bold text-amber-100 leading-tight truncate flex-1">
                  {event.title}
                </span>
              </button>
              <button
                type="button"
                aria-label="Bildirimi kapat"
                onClick={() =>
                  setLiveToasts((prev) =>
                    prev.filter((x) => x.event.id !== event.id)
                  )
                }
                className="w-4 h-4 rounded text-[#c5b79e] hover:text-white hover:bg-black/50 flex items-center justify-center shrink-0"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

