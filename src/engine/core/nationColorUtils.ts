import { Nation, Territory } from '../../types/game';

function parseHexRgb(hex: string): [number, number, number] {
  const clean = (hex || '#64748B').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0');
  const num = parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(num)) return [100, 116, 139];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbColorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = parseHexRgb(hexA);
  const [r2, g2, b2] = parseHexRgb(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

const DECONFLICT_PALETTE = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2',
  '#EA580C', '#059669', '#DB2777', '#4F46E5', '#CA8A04', '#0D9488',
  '#9333EA', '#E11D48', '#65A30D', '#0284C7', '#B45309', '#4338CA',
  '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6',
];

/**
 * Ensures neighboring countries maintain clear perceptual contrast (RGB distance >= 58)
 * so borders like Mamluk vs Nejd / Funj / Tunis never visually blend together.
 */
export function deconflictNeighborColors(
  nations: Record<string, Nation>,
  territories: Record<string, Territory>,
  minDistance = 58
): void {
  const neighborOwnersMap = new Map<string, Set<string>>();
  for (const t of Object.values(territories)) {
    if (!t || !t.ownerId) continue;
    let set = neighborOwnersMap.get(t.ownerId);
    if (!set) {
      set = new Set<string>();
      neighborOwnersMap.set(t.ownerId, set);
    }
    for (const nbId of t.neighbors) {
      const nb = territories[nbId];
      if (nb && nb.ownerId && nb.ownerId !== t.ownerId) {
        set.add(nb.ownerId);
      }
    }
  }

  // Keep player/key iconic empires stable by processing smaller / higher-ID countries later
  const sortedNationIds = Object.keys(nations).sort((a, b) => {
    if (a === '792') return -1;
    if (b === '792') return 1;
    if (a === '818') return -1;
    if (b === '818') return 1;
    return a.localeCompare(b);
  });

  for (const nid of sortedNationIds) {
    const nation = nations[nid];
    if (!nation) continue;
    const nbOwners = neighborOwnersMap.get(nid);
    if (!nbOwners || nbOwners.size === 0) continue;

    const neighborColors: string[] = [];
    let hasClash = false;
    for (const nbOwnerId of nbOwners) {
      const nbColor = nations[nbOwnerId]?.color;
      if (!nbColor) continue;
      neighborColors.push(nbColor);
      if (
        rgbColorDistance(nation.color, nbColor) < minDistance &&
        (nbOwnerId === '792' ||
          nbOwnerId === '818' ||
          (nid !== '792' && nid !== '818' && nbOwnerId < nid))
      ) {
        hasClash = true;
      }
    }

    if (hasClash) {
      let bestColor: string | null = null;
      let bestMinDist = -1;
      for (const candidate of DECONFLICT_PALETTE) {
        let minD = Infinity;
        for (const nc of neighborColors) {
          const d = rgbColorDistance(candidate, nc);
          if (d < minD) minD = d;
        }
        if (minD >= minDistance && minD > bestMinDist) {
          bestMinDist = minD;
          bestColor = candidate;
        }
      }
      if (!bestColor) {
        for (const candidate of DECONFLICT_PALETTE) {
          let minD = Infinity;
          for (const nc of neighborColors) {
            const d = rgbColorDistance(candidate, nc);
            if (d < minD) minD = d;
          }
          if (minD > bestMinDist) {
            bestMinDist = minD;
            bestColor = candidate;
          }
        }
      }
      if (bestColor) {
        nation.color = bestColor;
      }
    }
  }
}
