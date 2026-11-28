import { WorldNewsEvent } from '../types/game';

/**
 * Counts how many news events arrived since the player last opened the
 * Chronicle / News drawer (`lastSeenNewsId`). `newsEvents` is ordered newest-first.
 */
export function countUnreadNewsEvents(
  newsEvents: readonly WorldNewsEvent[],
  lastSeenNewsId: string | null | undefined
): number {
  if (!newsEvents || newsEvents.length === 0) return 0;
  if (!lastSeenNewsId) return newsEvents.length;
  const idx = newsEvents.findIndex((ev) => ev.id === lastSeenNewsId);
  return idx === -1 ? newsEvents.length : idx;
}
