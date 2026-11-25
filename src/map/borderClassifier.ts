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


/** Shortest distance from a point to any edge of the projected feature. */
function distanceToFeatureBoundary(
  px: number,
  py: number,
  pf: ProjectedFeatureRings,
  maxDistance: number
): number {
  let best = maxDistance;
  for (const ring of pf.rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      if (Math.abs(ax - px) > best && Math.abs(bx - px) > best) continue;
      if (Math.abs(ay - py) > best && Math.abs(by - py) > best) continue;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
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
  if (projectedList.length === 0) return borderMap;

  const featureIndexById = new Map<string, number>();
  projectedList.forEach((pf, idx) => featureIndexById.set(pf.id, idx));

  // ── Shared-vertex index ───────────────────────────────────────────────────
  // Adjacent provinces come from a single Voronoi tessellation, so their shared
  // border is made of *the same* vertices. Indexing vertices lets us decide a
  // segment's neighbour with two hash lookups; the old approach probed every
  // nearby province per segment, which cost ~800ms once the 1:50m coastline
  // multiplied the segment count by five.
  const vertexQuantum = 1e-4; // ≈10 m: absorbs float drift between two cells
  // Numeric keys: string concat for every vertex lookup cost more than the
  // whole classification did with numeric double keys.
  const KEY_STRIDE = 1e7;
  const vertexKey = (x: number, y: number) =>
    Math.round(x / vertexQuantum) * KEY_STRIDE + Math.round(y / vertexQuantum);
  const vertexOwners = new Map<number, number[]>();
  projectedList.forEach((pf, fi) => {
    for (const ring of pf.rings) {
      for (const pt of ring) {
        const key = vertexKey(pt[0], pt[1]);
        const owners = vertexOwners.get(key);
        if (!owners) vertexOwners.set(key, [fi]);
        else if (owners[owners.length - 1] !== fi) owners.push(fi);
      }
    }
  });

  const sharedFeatureFor = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    selfIdx: number
  ): number => {
    const ownersA = vertexOwners.get(vertexKey(ax, ay));
    if (!ownersA) return -1;
    const ownersB = vertexOwners.get(vertexKey(bx, by));
    if (!ownersB) return -1;
    const candidates = ownersA.length <= ownersB.length ? ownersA : ownersB;
    const other = ownersA.length <= ownersB.length ? ownersB : ownersA;
    for (const fi of candidates) {
      if (fi === selfIdx) continue;
      if (other.includes(fi)) return fi;
    }
    return -1;
  };

  for (const pf of projectedList) {
    const terr = territories[pf.id];
    if (!terr) continue;
    const fi = featureIndexById.get(pf.id) ?? -1;
    const ownerId = terr.ownerId;
    const isPlayerOwned = ownerId === playerNationId;

    let internal: Path2D | undefined;
    let international: Path2D | undefined;
    let coastline: Path2D | undefined;
    let playerFrontier: Path2D | undefined;

    let internalEnd: [number, number] | null = null;
    let intlEnd: [number, number] | null = null;
    let coastEnd: [number, number] | null = null;
    let frontierEnd: [number, number] | null = null;

    const samePoint = (a: [number, number] | null, b: [number, number]) =>
      Boolean(a) && Math.abs(a![0] - b[0]) < 1e-6 && Math.abs(a![1] - b[1]) < 1e-6;

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
      internalEnd = null;
      intlEnd = null;
      coastEnd = null;
      frontierEnd = null;

      const len = ring.length;
      for (let i = 0; i < len; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % len];
        const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
        // 1:50m vertices sit ~0.01 projected units apart; the old 0.02 cut threw
        // most of the real coastline away and left dashed borders.
        if (segLen < 1e-4 || segLen > 600) continue;

        const mx = (a[0] + b[0]) * 0.5;
        const my = (a[1] + b[1]) * 0.5;

        let otherOwnerId: string | null = null;
        const sharedIdx = sharedFeatureFor(a[0], a[1], b[0], b[1], fi);
        if (sharedIdx >= 0) {
          otherOwnerId = territories[projectedList[sharedIdx].id]?.ownerId ?? null;
        }

        if (otherOwnerId === ownerId) {
          appendInternal(a, b);
        } else if (otherOwnerId !== null) {
          appendInternational(a, b);
        } else {
          appendCoastline(a, b);
        }
      }
    }

    borderMap.set(pf.id, { internal, international, coastline, playerFrontier });
  }

  return borderMap;
}
