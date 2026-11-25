import { GeoProjection } from 'd3-geo';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { Territory } from '../types/game';

export interface ProvinceBorderPaths {
  internal?: Path2D;
  international?: Path2D;
  coastline?: Path2D;
  playerFrontier?: Path2D;
}

export type ClassifiedBorderMap = Map<string, ProvinceBorderPaths>;

/**
 * Fast point-in-ring raycasting in projected 2D map space.
 */
function pointInProjectedRing(
  px: number,
  py: number,
  ring: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface ProjectedFeatureRings {
  id: string;
  rings: [number, number][][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function projectFeatureRings(
  features: GeoCountryFeature[],
  projection: GeoProjection
): Map<string, ProjectedFeatureRings> {
  const out = new Map<string, ProjectedFeatureRings>();

  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const rawPolys: number[][][][] =
      geom.type === 'Polygon'
        ? [geom.coordinates as number[][][]]
        : geom.type === 'MultiPolygon'
        ? (geom.coordinates as number[][][][])
        : [];

    const rings: [number, number][][] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const poly of rawPolys) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const projRing: [number, number][] = [];
      let lastX = NaN;
      let lastY = NaN;
      for (const coord of outer) {
        const pt = projection([coord[0], coord[1]]);
        if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
        // Drop only true sub-pixel duplicates. The old 0.35 threshold simplified
        // adjacent rings differently, which made shared borders drift apart and
        // produced broken/gapped frontier lines.
        if (
          Number.isFinite(lastX) &&
          Math.hypot(pt[0] - lastX, pt[1] - lastY) < 0.1
        ) {
          continue;
        }
        projRing.push([pt[0], pt[1]]);
        lastX = pt[0];
        lastY = pt[1];
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
      if (projRing.length >= 3) {
        rings.push(projRing);
      }
    }

    if (rings.length > 0) {
      out.set(feat.id, { id: feat.id, rings, minX, minY, maxX, maxY });
    }
  }

  return out;
}

function pointInProjectedFeature(
  px: number,
  py: number,
  pf: ProjectedFeatureRings
): boolean {
  if (px < pf.minX || px > pf.maxX || py < pf.minY || py > pf.maxY) {
    return false;
  }
  for (const ring of pf.rings) {
    if (pointInProjectedRing(px, py, ring)) return true;
  }
  return false;
}

/**
 * Classifies each province's edge segments into per-province Path2D buckets so the renderer
 * can leverage RBush viewport culling and draw ONLY on-screen borders at 60 FPS even at 28x zoom!
 */
export function buildClassifiedBorderPaths(params: {
  features: GeoCountryFeature[];
  territories: Record<string, Territory>;
  projection: GeoProjection;
  playerNationId: string;
}): ClassifiedBorderMap {
  const { features, territories, projection, playerNationId } = params;
  const borderMap: ClassifiedBorderMap = new Map();
  const projectedMap = projectFeatureRings(features, projection);
  const projectedList = Array.from(projectedMap.values());

  // Probes are evaluated in projected (pre-zoom) units. Keeping them tiny means
  // a coastal segment is never mistaken for a land frontier just because a
  // far-away neighbour happens to sit within a generous sampling radius.
  const probeDistances = [0.32, 0.85];
  const bboxPad = 1.5;

  // Pre-compute candidate neighbour lists once (bbox pre-filter, O(n^2) but only
  // during cache builds) so the per-segment loop stays lean.
  const candidateCache = new Map<string, ProjectedFeatureRings[]>();

  const getCandidates = (pf: ProjectedFeatureRings): ProjectedFeatureRings[] => {
    const cached = candidateCache.get(pf.id);
    if (cached) return cached;
    const out: ProjectedFeatureRings[] = [];
    for (const other of projectedList) {
      if (other.id === pf.id) continue;
      if (
        other.maxX < pf.minX - bboxPad ||
        other.minX > pf.maxX + bboxPad ||
        other.maxY < pf.minY - bboxPad ||
        other.minY > pf.maxY + bboxPad
      ) {
        continue;
      }
      out.push(other);
    }
    candidateCache.set(pf.id, out);
    return out;
  };

  for (const pf of projectedList) {
    const id = pf.id;
    const terr = territories[id];
    if (!terr) continue;

    const candidates = getCandidates(pf);
    const ownerId = terr.ownerId;
    const isPlayerOwned = ownerId === playerNationId;

    let internal: Path2D | undefined;
    let international: Path2D | undefined;
    let coastline: Path2D | undefined;
    let playerFrontier: Path2D | undefined;

    /** Last point written per bucket, so consecutive segments form one smooth polyline. */
    let internalEnd: [number, number] | null = null;
    let intlEnd: [number, number] | null = null;
    let coastEnd: [number, number] | null = null;
    let frontierEnd: [number, number] | null = null;

    const samePoint = (
      a: [number, number] | null,
      b: [number, number]
    ) => Boolean(a) && Math.abs(a![0] - b[0]) < 1e-6 && Math.abs(a![1] - b[1]) < 1e-6;

    const appendInternal = (a: [number, number], b: [number, number]) => {
      if (!internal) internal = new Path2D();
      if (!samePoint(internalEnd, a)) internal.moveTo(a[0], a[1]);
      internal.lineTo(b[0], b[1]);
      internalEnd = b;
    };
    const appendInternational = (a: [number, number], b: [number, number]) => {
      if (!international) international = new Path2D();
      if (!samePoint(intlEnd, a)) international.moveTo(a[0], a[1]);
      international.lineTo(b[0], b[1]);
      intlEnd = b;
      if (isPlayerOwned) {
        if (!playerFrontier) playerFrontier = new Path2D();
        if (!samePoint(frontierEnd, a)) playerFrontier.moveTo(a[0], a[1]);
        playerFrontier.lineTo(b[0], b[1]);
        frontierEnd = b;
      }
    };
    const appendCoastline = (a: [number, number], b: [number, number]) => {
      if (!coastline) coastline = new Path2D();
      if (!samePoint(coastEnd, a)) coastline.moveTo(a[0], a[1]);
      coastline.lineTo(b[0], b[1]);
      coastEnd = b;
    };

    for (const ring of pf.rings) {
      // Rings are separate subpaths — never join the last point of one ring to the next.
      internalEnd = null;
      intlEnd = null;
      coastEnd = null;
      frontierEnd = null;

      const len = ring.length;
      for (let i = 0; i < len; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % len];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const segLen = Math.hypot(dx, dy);
        if (segLen < 0.02 || segLen > 600) continue;

        const mx = (a[0] + b[0]) * 0.5;
        const my = (a[1] + b[1]) * 0.5;
        const ux = -dy / segLen;
        const uy = dx / segLen;

        // Determine the outward normal with a tight inner probe (0.2 units keeps
        // the test inside very narrow slivers as well).
        const plusInside = pointInProjectedFeature(
          mx + ux * 0.2,
          my + uy * 0.2,
          pf
        );
        const outUx = plusInside ? -ux : ux;
        const outUy = plusInside ? -uy : uy;

        let otherOwnerId: string | null = null;
        for (const dist of probeDistances) {
          const px = mx + outUx * dist;
          const py = my + outUy * dist;
          for (const cand of candidates) {
            if (pointInProjectedFeature(px, py, cand)) {
              otherOwnerId = territories[cand.id]?.ownerId ?? null;
              break;
            }
          }
          if (otherOwnerId !== null) break;
        }

        // Fallback: polygons that barely overlap at the midpoint.
        if (otherOwnerId === null) {
          for (const cand of candidates) {
            if (pointInProjectedFeature(mx, my, cand)) {
              otherOwnerId = territories[cand.id]?.ownerId ?? null;
              break;
            }
          }
        }

        if (otherOwnerId === ownerId) {
          // Internal district/sancak edge. Both sides draw it (identical style),
          // which keeps the polyline continuous instead of alternating segments.
          appendInternal(a, b);
        } else if (otherOwnerId !== null) {
          appendInternational(a, b);
        } else {
          appendCoastline(a, b);
        }
      }
    }

    borderMap.set(id, {
      internal,
      international,
      coastline,
      playerFrontier,
    });
  }

  return borderMap;
}
