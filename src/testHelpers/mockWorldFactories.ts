import { Nation, Territory } from '../types/game';

export function mkFaz3Nation(id: string, overrides: Partial<Nation> = {}): Nation {
  return {
    id,
    name: id,
    flagCode: id,
    color: '#B91C1C',
    capitalTerritoryId: `${id}_0`,
    ideology: 'MONARCHY',
    treasury: 1000,
    manpower: 10000,
    stability: 80,
    inflation: 2,
    researchPoints: 50,
    taxRate: 25,
    budget: { military: 30, economy: 30, research: 20, welfare: 20 },
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    isEliminated: false,
    ...overrides,
  };
}

export function mkFaz3Territory(id: string, overrides: Partial<Territory> = {}): Territory {
  return {
    id,
    name: id,
    ownerId: 'TUR',
    coreOwnerId: overrides.ownerId || 'TUR',
    population: 100,
    baseGdp: 30,
    resource: 'TAHIL',
    buildings: {
      factory: 1,
      barracks: 1,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    },
    garrison: 3000,
    units: {
      infantry: overrides.garrison ?? 3000,
      armor: 0,
      airDrone: 0,
    },
    unrest: 0,
    isOccupied: false,
    centroid: [30, 39],
    neighbors: [],
    ...overrides,
  };
}

export function pointInOuterRingForTest(
  lon: number,
  lat: number,
  ring: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function geometryContainsPointForTest(
  geometry: { type: string; coordinates: unknown },
  lon: number,
  lat: number
): boolean {
  if (geometry.type === 'Polygon') {
    const ring = (geometry.coordinates as number[][][])[0];
    return ring ? pointInOuterRingForTest(lon, lat, ring) : false;
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).some(
      (poly) => poly[0] && pointInOuterRingForTest(lon, lat, poly[0])
    );
  }
  return false;
}

export function createStubCanvasContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const base: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    canvas: { width: 800, height: 600 },
  };
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
