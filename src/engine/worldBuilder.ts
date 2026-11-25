import { geoArea, geoCentroid } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import worldData from 'world-atlas/countries-110m.json';
import {
  buildSeedForFeature,
  GAME_MODES,
} from '../data/world2026Data';
import {
  DiplomaticRelation,
  GameModeId,
  Nation,
  ResourceType,
  TerrainType,
  Territory,
} from '../types/game';
import {
  COUNTRY_PROVINCE_SEEDS,
  sanitizeGeoGeometry,
  subdivideCountryGeometry,
} from './polygonSubdivider';
import { determineProvinceTerrain } from './pashaAndFiefEngine';
import { transformBundleTo1440Scenario } from './scenario1440Builder';
import { STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import type { GeoCountryFeature, InitialWorldBundle } from './core/worldTypes';
import { relationKey } from './core/diplomacyHelpers';

export type { GeoCountryFeature, InitialWorldBundle };
export { relationKey };

const STRAIT_SHORE_ID_SET = new Set<string>(
  STRATEGIC_STRAITS.flatMap((s) => s.shoreIds)
);

/** Backward-compatible coastal check that also handles legacy saves lacking Territory.isCoastal. */
export function isTerritoryCoastal(
  territory: Pick<Territory, 'id' | 'isCoastal' | 'resource'> | null | undefined
): boolean {
  if (!territory) return false;
  if (typeof territory.isCoastal === 'boolean') {
    return territory.isCoastal;
  }
  return STRAIT_SHORE_ID_SET.has(territory.id) || territory.resource === 'TICARET_BOGAZI';
}

function diversifyProvinceResource(
  provId: string,
  baseResource: ResourceType,
  terrain: TerrainType,
  isCapital: boolean,
  lon: number,
  lat: number,
  isCuratedSubSeed: boolean
): ResourceType {
  // Keep explicitly curated sub-province resources for Türkiye/Balkans or special hubs
  if (
    isCuratedSubSeed &&
    (baseResource === 'KERESTE' ||
      baseResource === 'SIGIR' ||
      baseResource === 'PAMUK' ||
      baseResource === 'ALTIN' ||
      baseResource === 'TICARET_BOGAZI' ||
      baseResource === 'FINANS_MERKEZI' ||
      baseResource === 'YARI_ILETKEN' ||
      baseResource === 'PETROL')
  ) {
    return baseResource;
  }

  let hash = 0;
  for (let i = 0; i < provId.length; i++) {
    hash = (hash * 31 + provId.charCodeAt(i)) >>> 0;
  }

  if (terrain === 'ORMAN') {
    const forestPool: ResourceType[] = ['KERESTE', 'KERESTE', 'SIGIR', 'PAMUK'];
    return forestPool[hash % forestPool.length];
  }
  if (terrain === 'DAGLIK') {
    const mountainPool: ResourceType[] = [
      'DEMIR_CELIK',
      'ALTIN',
      'SIGIR',
      'DEMIR_CELIK',
      'NADIR_TOPRAK',
    ];
    return mountainPool[hash % mountainPool.length];
  }
  if (terrain === 'COL') {
    const desertPool: ResourceType[] = [
      'PETROL',
      'PETROL',
      'DOGALGAZ',
      'ALTIN',
      'PAMUK',
    ];
    return desertPool[hash % desertPool.length];
  }
  if (terrain === 'METROPOL' || isCapital) {
    if (
      baseResource === 'FINANS_MERKEZI' ||
      baseResource === 'TICARET_BOGAZI' ||
      baseResource === 'YARI_ILETKEN' ||
      baseResource === 'PETROL'
    ) {
      return baseResource;
    }
  }

  // OVA (Plains): mix of Grain, Cotton (warmer latitudes), Livestock, and Timber
  const isWarmBelt = Math.abs(lat) < 40 || (lon > 25 && lon < 95 && lat < 44);
  const plainsPool: ResourceType[] = isWarmBelt
    ? ['PAMUK', 'TAHIL', 'SIGIR', 'PAMUK', 'KERESTE', 'ALTIN']
    : ['TAHIL', 'SIGIR', 'KERESTE', 'TAHIL', 'DEMIR_CELIK', 'SIGIR'];
  return plainsPool[hash % plainsPool.length];
}

interface RingBBox {
  ring: [number, number][];
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

function extractOuterRingBBoxes(geometry: Geometry | null | undefined): RingBBox[] {
  if (!geometry) return [];
  const rawOuterRings: number[][][] =
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
        ? [geometry.coordinates[0]]
        : []
      : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.map((p) => p[0]).filter((r): r is number[][] => Boolean(r))
      : [];

  const out: RingBBox[] = [];
  for (const raw of rawOuterRings) {
    if (raw.length < 3) continue;
    const ring: [number, number][] = [];
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    const limit =
      raw.length > 3 &&
      raw[0][0] === raw[raw.length - 1][0] &&
      raw[0][1] === raw[raw.length - 1][1]
        ? raw.length - 1
        : raw.length;
    for (let i = 0; i < limit; i++) {
      const lon = raw[i][0];
      const lat = raw[i][1];
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      ring.push([lon, lat]);
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    if (ring.length >= 3) {
      out.push({ ring, minLon, maxLon, minLat, maxLat });
    }
  }
  return out;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) > 30) return Infinity;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) {
    const ex = px - ax;
    const ey = py - ay;
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ddx = px - projX;
  const ddy = py - projY;
  return ddx * ddx + ddy * ddy;
}

function ringsTouchAtBoundary(
  boxA: RingBBox,
  boxB: RingBBox,
  thresholdDegSq: number
): boolean {
  const ringA = boxA.ring;
  const ringB = boxB.ring;
  const lenA = ringA.length;
  const lenB = ringB.length;

  for (let i = 0; i < lenA; i++) {
    const p = ringA[i];
    if (
      p[0] < boxB.minLon - 0.1 ||
      p[0] > boxB.maxLon + 0.1 ||
      p[1] < boxB.minLat - 0.1 ||
      p[1] > boxB.maxLat + 0.1
    ) {
      continue;
    }
    for (let j = 0; j < lenB; j++) {
      const a = ringB[j];
      const b = ringB[(j + 1) % lenB];
      if (pointToSegmentDistSq(p[0], p[1], a[0], a[1], b[0], b[1]) <= thresholdDegSq) {
        return true;
      }
    }
  }

  for (let i = 0; i < lenB; i++) {
    const p = ringB[i];
    if (
      p[0] < boxA.minLon - 0.1 ||
      p[0] > boxA.maxLon + 0.1 ||
      p[1] < boxA.minLat - 0.1 ||
      p[1] > boxA.maxLat + 0.1
    ) {
      continue;
    }
    for (let j = 0; j < lenA; j++) {
      const a = ringA[j];
      const b = ringA[(j + 1) % lenA];
      if (pointToSegmentDistSq(p[0], p[1], a[0], a[1], b[0], b[1]) <= thresholdDegSq) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Links every pair of province polygons whose boundaries physically touch or share an edge
 * (tolerance 0.055° ≈ 6 km), preventing artificial centroid-slice detours across newly added cities.
 */
export function buildPolygonAdjacencyNeighbors(
  features: GeoCountryFeature[],
  territories: Record<string, Territory>,
  linkFn: (idA: string, idB: string) => void
): Set<string> {
  const thresholdDeg = 0.055;
  const thresholdSq = thresholdDeg * thresholdDeg;
  const pad = 0.08;

  const entries: {
    id: string;
    boxes: RingBBox[];
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  }[] = [];

  for (const feat of features) {
    if (!territories[feat.id]) continue;
    const boxes = extractOuterRingBBoxes(feat.geometry);
    if (boxes.length === 0) continue;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const b of boxes) {
      if (b.minLon < minLon) minLon = b.minLon;
      if (b.maxLon > maxLon) maxLon = b.maxLon;
      if (b.minLat < minLat) minLat = b.minLat;
      if (b.maxLat > maxLat) maxLat = b.maxLat;
    }
    entries.push({ id: feat.id, boxes, minLon, maxLon, minLat, maxLat });
  }

  const linkedCountryPairs = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const eA = entries[i];
    for (let j = i + 1; j < entries.length; j++) {
      const eB = entries[j];
      if (
        eB.maxLon < eA.minLon - pad ||
        eB.minLon > eA.maxLon + pad ||
        eB.maxLat < eA.minLat - pad ||
        eB.minLat > eA.maxLat + pad
      ) {
        continue;
      }

      let touches = false;
      for (const bA of eA.boxes) {
        for (const bB of eB.boxes) {
          if (
            bB.maxLon < bA.minLon - pad ||
            bB.minLon > bA.maxLon + pad ||
            bB.maxLat < bA.minLat - pad ||
            bB.minLat > bA.maxLat + pad
          ) {
            continue;
          }
          if (ringsTouchAtBoundary(bA, bB, thresholdSq)) {
            touches = true;
            break;
          }
        }
        if (touches) break;
      }

      if (touches) {
        linkFn(eA.id, eB.id);
        const cA = eA.id.split('_')[0];
        const cB = eB.id.split('_')[0];
        if (cA !== cB) {
          linkedCountryPairs.add(relationKey(cA, cB));
        }
      }
    }
  }

  return linkedCountryPairs;
}

/**
 * Classifies provinces touching open sea/coastline (edges not shared with any adjacent land polygon)
 * so only true coastal cities can build coastal harbors & shipyards.
 */
const INLAND_VORONOI_OVERRIDES = new Set<string>([
  '792',     // Ankara
  '792_KNY', // Konya
  '792_ERZ', // Erzurum
  '643',     // Moskova
  '643_SMO', // Smolensk
  '643_GOJ', // Nijni Novgorod
  '643_KZN', // Kazan
  '643_KUF', // Samara
  '643_SVX', // Yekaterinburg
  '643_OMS', // Omsk
  '643_OVB', // Novosibirsk
  '643_KJA', // Krasnoyarsk
  '643_IKT', // İrkutsk
  '840_DET', // Detroit
  '840_MSP', // Minneapolis
  '840_DAL', // Dallas
  '840_DEN', // Denver
  '840_PHX', // Phoenix
  '156_WUH', // Vuhan
  '156_CKG', // Çongçing
  '156_HRB', // Harbin
  '156_KMG', // Kunming
  '156_LHW', // Lanzhou
  '356_JAI', // Jaipur
  '356_LKO', // Luknov
  '124_YWG', // Winnipeg
  '124_YYC', // Calgary
  '250',     // Paris
  '276',     // Berlin
  '724',     // Madrid / Toledo
  '724_ZAZ', // Zaragoza
  '724_VLL', // Valladolid
  '380_MIL', // Milano
  '616_POZ', // Poznań
  '804_HRK', // Harkiv
]);

export function computeCoastalTerritoryIds(
  features: GeoCountryFeature[],
  territories: Record<string, Territory>
): Set<string> {
  const entries: {
    id: string;
    boxes: RingBBox[];
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  }[] = [];

  for (const feat of features) {
    if (!territories[feat.id]) continue;
    const boxes = extractOuterRingBBoxes(feat.geometry);
    if (boxes.length === 0) continue;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const b of boxes) {
      if (b.minLon < minLon) minLon = b.minLon;
      if (b.maxLon > maxLon) maxLon = b.maxLon;
      if (b.minLat < minLat) minLat = b.minLat;
      if (b.maxLat > maxLat) maxLat = b.maxLat;
    }
    entries.push({ id: feat.id, boxes, minLon, maxLon, minLat, maxLat });
  }

  const coastalIds = new Set<string>();
  const seaGapThresholdDeg = 0.24;
  const seaGapSq = seaGapThresholdDeg * seaGapThresholdDeg;
  const bboxPad = 0.3;

  for (let i = 0; i < entries.length; i++) {
    const eA = entries[i];
    if (INLAND_VORONOI_OVERRIDES.has(eA.id)) {
      continue;
    }
    if (STRAIT_SHORE_ID_SET.has(eA.id) || territories[eA.id]?.resource === 'TICARET_BOGAZI') {
      coastalIds.add(eA.id);
      continue;
    }

    const nearbyNeighbors = entries.filter(
      (eB, idx) =>
        idx !== i &&
        !(
          eB.maxLon < eA.minLon - bboxPad ||
          eB.minLon > eA.maxLon + bboxPad ||
          eB.maxLat < eA.minLat - bboxPad ||
          eB.minLat > eA.maxLat + bboxPad
        )
    );

    if (nearbyNeighbors.length === 0) {
      // Pure island province
      coastalIds.add(eA.id);
      continue;
    }

    let exposedCoastScore = 0;
    for (const bA of eA.boxes) {
      const ringA = bA.ring;
      const lenA = ringA.length;
      for (let k = 0; k < lenA; k++) {
        const p1 = ringA[k];
        const p2 = ringA[(k + 1) % lenA];
        const segDx = p2[0] - p1[0];
        const segDy = p2[1] - p1[1];
        if (Math.abs(segDx) > 30) continue;
        const segLenSq = segDx * segDx + segDy * segDy;
        if (segLenSq < 0.0025) continue; // skip tiny <0.05° vertex jitters

        const mx = (p1[0] + p2[0]) * 0.5;
        const my = (p1[1] + p2[1]) * 0.5;

        let touchesAnyLand = false;
        for (const nb of nearbyNeighbors) {
          for (const bB of nb.boxes) {
            if (
              mx < bB.minLon - bboxPad ||
              mx > bB.maxLon + bboxPad ||
              my < bB.minLat - bboxPad ||
              my > bB.maxLat + bboxPad
            ) {
              continue;
            }
            const ringB = bB.ring;
            const lenB = ringB.length;
            for (let m = 0; m < lenB; m++) {
              const a = ringB[m];
              const b = ringB[(m + 1) % lenB];
              if (pointToSegmentDistSq(mx, my, a[0], a[1], b[0], b[1]) <= seaGapSq) {
                touchesAnyLand = true;
                break;
              }
            }
            if (touchesAnyLand) break;
          }
          if (touchesAnyLand) break;
        }

        if (!touchesAnyLand) {
          exposedCoastScore += Math.sqrt(segLenSq);
          if (exposedCoastScore >= 0.25) {
            coastalIds.add(eA.id);
            break;
          }
        }
      }
      if (coastalIds.has(eA.id)) break;
    }
  }

  return coastalIds;
}

export function initializeWorld2026(modeId: GameModeId): InitialWorldBundle {
  const mode = GAME_MODES.find((m) => m.id === modeId) || GAME_MODES[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topology = worldData as any;
  const geoCollection = feature(
    topology,
    topology.objects.countries
  ) as unknown as FeatureCollection<Geometry, { name: string }>;

  const rawGeometries = topology.objects.countries.geometries || [];
  const topoNeighbors: number[][] = neighbors(rawGeometries);

  const countryFeatures: GeoCountryFeature[] = [];
  const indexMap: number[] = [];

  geoCollection.features.forEach((feat, rawIdx) => {
    const rawName = feat.properties?.name || '';
    if (rawName === 'Antarctica' || String(feat.id) === '010') {
      return;
    }
    const idStr = String(feat.id || `90${rawIdx}`).padStart(3, '0');
    countryFeatures.push({
      type: 'Feature',
      id: idStr,
      properties: { name: rawName },
      geometry: sanitizeGeoGeometry(feat.geometry),
    });
    indexMap.push(rawIdx);
  });

  const rawIdxToCountryId: Record<number, string> = {};
  countryFeatures.forEach((cf, idx) => {
    rawIdxToCountryId[indexMap[idx]] = cf.id;
  });

  const nations: Record<string, Nation> = {};
  const territories: Record<string, Territory> = {};
  const provinceFeatures: GeoCountryFeature[] = [];
  const countryToProvinces: Record<string, string[]> = {};

  countryFeatures.forEach((cf, idx) => {
    const seed = buildSeedForFeature(cf.id, cf.properties.name, idx);
    const isMajorPower = seed.baseGdp >= 180;
    const totalCountryGarrison = Math.round(
      seed.garrison * (modeId === 'SANDBOX_EMPIRE' ? 1.5 : 1)
    );

    nations[cf.id] = {
      id: cf.id,
      name: seed.name,
      flagCode: seed.flagCode,
      color: seed.color,
      capitalTerritoryId: cf.id,
      ideology: seed.ideology,
      treasury: Math.round(seed.treasury * mode.startingGoldMultiplier),
      manpower: Math.round(
        seed.manpower * (modeId === 'SANDBOX_EMPIRE' ? 2.5 : 1)
      ),
      stability: 78,
      inflation: 4.2,
      researchPoints:
        modeId === 'SANDBOX_EMPIRE' ? 500 : isMajorPower ? 65 : 30,
      researchProgressByTech: {},
      taxRate: 25,
      budget: {
        military: 30,
        economy: 30,
        research: 20,
        welfare: 20,
      },
      aggressiveExpansion: mode.startingTension,
      unlockedTechs: isMajorPower ? ['eco_1'] : [],
      modernizedArmyTier: 0,
      enactedReforms: [],
      recruitedGeneralIds:
        cf.id === '792'
          ? ['cmd_mete', 'cmd_selim']
          : [],
      activeGeneralId: cf.id === '792' ? 'cmd_mete' : null,
      clanInfluence: modeId === 'SANDBOX_EMPIRE' ? 350 : isMajorPower ? 140 : 90,
      bannerCalledLordIds: [],
      formedEmpireId: null,
      vassalOf: null,
      isEliminated: false,
    };

    const subSeeds = COUNTRY_PROVINCE_SEEDS[cf.id];
    if (subSeeds && subSeeds.length > 1) {
      const pieces = subdivideCountryGeometry(cf.geometry, subSeeds);
      countryToProvinces[cf.id] = [];

      pieces.forEach((piece) => {
        const provId = piece.seed.isCapital
          ? cf.id
          : `${cf.id}_${piece.seed.suffixId}`;
        countryToProvinces[cf.id].push(provId);

        const provFeature: GeoCountryFeature = {
          type: 'Feature',
          id: provId,
          properties: { name: piece.seed.name },
          geometry: piece.geometry,
        };
        provinceFeatures.push(provFeature);

        const share = piece.seed.gdpShare || 1 / pieces.length;
        const provGarrison = Math.max(
          3000,
          Math.round(totalCountryGarrison * share)
        );
        const armorCount = Math.round(
          provGarrison * (isMajorPower ? 0.22 : 0.15)
        );
        const airDroneCount = Math.round(
          provGarrison * (isMajorPower ? 0.1 : 0.05)
        );
        const infantryCount = Math.max(
          1000,
          provGarrison - armorCount - airDroneCount
        );

        let computedCentroid = geoCentroid(provFeature) as [number, number];
        if (provFeature.geometry.type === 'MultiPolygon' && provFeature.geometry.coordinates.length > 1) {
          let bestNearArea = -1;
          let bestNearCentroid: [number, number] | null = null;
          let bestArea = -1;
          let bestPolyCentroid: [number, number] | null = null;
          for (const polyCoords of provFeature.geometry.coordinates) {
            const subFeat: GeoCountryFeature = {
              type: 'Feature',
              id: provFeature.id,
              properties: provFeature.properties,
              geometry: { type: 'Polygon', coordinates: polyCoords },
            };
            const area = geoArea(subFeat);
            const subC = geoCentroid(subFeat) as [number, number];
            if (Number.isFinite(subC[0]) && Number.isFinite(subC[1])) {
              const distToSeed = Math.hypot(
                subC[0] - piece.seed.lon,
                subC[1] - piece.seed.lat
              );
              if (distToSeed <= 25 && area > bestNearArea) {
                bestNearArea = area;
                bestNearCentroid = subC;
              }
              if (area > bestArea) {
                bestArea = area;
                bestPolyCentroid = subC;
              }
            }
          }
          if (bestNearCentroid) {
            computedCentroid = bestNearCentroid;
          } else if (bestPolyCentroid) {
            computedCentroid = bestPolyCentroid;
          }
        }
        const validCentroid: [number, number] =
          Number.isFinite(computedCentroid[0]) &&
          Number.isFinite(computedCentroid[1])
            ? computedCentroid
            : [piece.seed.lon, piece.seed.lat];

        const provGdp = Math.max(25, Math.round(seed.baseGdp * share * 1.15));
        const terrain = determineProvinceTerrain(
          provId,
          piece.seed.name,
          validCentroid[0],
          validCentroid[1],
          piece.seed.isCapital,
          provGdp
        );

        const resolvedResource = diversifyProvinceResource(
          provId,
          piece.seed.resource || seed.resource,
          terrain,
          Boolean(piece.seed.isCapital),
          validCentroid[0],
          validCentroid[1],
          piece.seed.resource !== undefined
        );

        territories[provId] = {
          id: provId,
          name: piece.seed.name,
          ownerId: cf.id,
          coreOwnerId: cf.id,
          isCapital: Boolean(piece.seed.isCapital),
          terrain,
          fiefLordId: null,
          castleWallHp: 100,
          population: Math.round(seed.population * share),
          baseGdp: provGdp,
          resource: resolvedResource,
          buildings: {
            factory: piece.seed.isCapital && isMajorPower ? 2 : 1,
            barracks: piece.seed.isCapital ? 2 : 1,
            fortress: 1,
            university: piece.seed.isCapital && isMajorPower ? 1 : 0,
            tradeHub: piece.seed.isCapital ? 1 : 0,
            supplyDepot: 1,
            shipyard: 0,
            mint: 0,
            granary: 0,
          },
          garrison: infantryCount + armorCount + airDroneCount,
          units: {
            infantry: infantryCount,
            armor: armorCount,
            airDrone: airDroneCount,
          },
          unrest: 3,
          isOccupied: false,
          centroid: validCentroid,
          neighbors: [],
        };
      });
    } else {
      // Single-province country
      countryToProvinces[cf.id] = [cf.id];
      provinceFeatures.push(cf);

      const centroid = geoCentroid(cf) as [number, number];
      const validCentroid: [number, number] = Number.isFinite(centroid[0])
        ? centroid
        : [0, 0];
      const armorCount = Math.round(
        totalCountryGarrison * (isMajorPower ? 0.22 : 0.15)
      );
      const airDroneCount = Math.round(
        totalCountryGarrison * (isMajorPower ? 0.1 : 0.05)
      );
      const infantryCount = Math.max(
        1000,
        totalCountryGarrison - armorCount - airDroneCount
      );

      const terrain = determineProvinceTerrain(
        cf.id,
        seed.name,
        validCentroid[0],
        validCentroid[1],
        true,
        seed.baseGdp
      );

      const resolvedResource = diversifyProvinceResource(
        cf.id,
        seed.resource,
        terrain,
        true,
        validCentroid[0],
        validCentroid[1],
        false
      );

      territories[cf.id] = {
        id: cf.id,
        name: seed.name,
        ownerId: cf.id,
        coreOwnerId: cf.id,
        isCapital: true,
        terrain,
        fiefLordId: null,
        castleWallHp: 100,
        population: seed.population,
        baseGdp: seed.baseGdp,
        resource: resolvedResource,
        buildings: {
          factory: isMajorPower ? 2 : 1,
          barracks: isMajorPower ? 2 : 1,
          fortress: 1,
          university: isMajorPower ? 1 : 0,
          tradeHub: isMajorPower ? 1 : 0,
          supplyDepot: 1,
          shipyard: 0,
          mint: 0,
          granary: 0,
        },
        garrison: infantryCount + armorCount + airDroneCount,
        units: {
          infantry: infantryCount,
          armor: armorCount,
          airDrone: airDroneCount,
        },
        unrest: 4,
        isOccupied: false,
        centroid: validCentroid,
        neighbors: [],
      };
    }
  });

  const linkProvinces = (idA: string, idB: string) => {
    if (!idA || !idB || idA === idB) return;
    if (!territories[idA] || !territories[idB]) return;
    if (!territories[idA].neighbors.includes(idB)) {
      territories[idA].neighbors.push(idB);
    }
    if (!territories[idB].neighbors.includes(idA)) {
      territories[idB].neighbors.push(idA);
    }
  };

  // 1. Link ALL physically touching sister & cross-border province polygons
  const linkedCountryPairs = buildPolygonAdjacencyNeighbors(
    provinceFeatures,
    territories,
    linkProvinces
  );

  // 1B. Mark geometric open-sea coastlines so only coastal provinces can construct harbors/shipyards
  const coastalTerritoryIds = computeCoastalTerritoryIds(
    provinceFeatures,
    territories
  );
  Object.keys(territories).forEach((tId) => {
    territories[tId].isCoastal = coastalTerritoryIds.has(tId);
  });

  // 2. Ensure internal sister-province connectivity if a country has island/detached sub-provinces
  Object.values(countryToProvinces).forEach((provList) => {
    if (provList.length <= 1) return;
    const provSet = new Set(provList);
    const visited = new Set<string>([provList[0]]);
    const queue = [provList[0]];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of territories[cur]?.neighbors || []) {
        if (provSet.has(nb) && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    while (visited.size < provList.length) {
      let bestA = '';
      let bestB = '';
      let bestDistSq = Infinity;
      for (const pA of provList) {
        if (visited.has(pA)) continue;
        const cA = territories[pA].centroid;
        for (const pB of visited) {
          const cB = territories[pB].centroid;
          const distSq = (cA[0] - cB[0]) ** 2 + (cA[1] - cB[1]) ** 2;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestA = pA;
            bestB = pB;
          }
        }
      }
      if (!bestA || !bestB) break;
      linkProvinces(bestA, bestB);
      visited.add(bestA);
      const q2 = [bestA];
      while (q2.length > 0) {
        const cur = q2.shift()!;
        for (const nb of territories[cur]?.neighbors || []) {
          if (provSet.has(nb) && !visited.has(nb)) {
            visited.add(nb);
            q2.push(nb);
          }
        }
      }
    }
  });

  // 3. Fallback for any TopoJSON country pair whose boundaries lacked shared points at 110m scale
  countryFeatures.forEach((cf, idx) => {
    const rawIdx = indexMap[idx];
    const neighborCountryIds = (topoNeighbors[rawIdx] || [])
      .map((nRaw) => rawIdxToCountryId[nRaw])
      .filter((id): id is string => Boolean(id && id !== cf.id));

    const provsA = countryToProvinces[cf.id] || [cf.id];
    neighborCountryIds.forEach((otherCountryId) => {
      if (linkedCountryPairs.has(relationKey(cf.id, otherCountryId))) return;
      const provsB = countryToProvinces[otherCountryId] || [otherCountryId];
      let bestPair: { a: string; b: string; distSq: number } | null = null;
      for (const pA of provsA) {
        const cA = territories[pA].centroid;
        for (const pB of provsB) {
          const cB = territories[pB].centroid;
          const distSq = (cA[0] - cB[0]) ** 2 + (cA[1] - cB[1]) ** 2;
          if (!bestPair || distSq < bestPair.distSq) {
            bestPair = { a: pA, b: pB, distSq };
          }
        }
      }
      if (bestPair) {
        linkProvinces(bestPair.a, bestPair.b);
      }
    });
  });

  // 4. Explicit Strategic World Straits + Maritime fallback so every island province has >=2 neighbors
  STRATEGIC_STRAITS.forEach((st) => {
    st.crossingEdges.forEach(([a, b]) => linkProvinces(a, b));
  });

  const allProvIds = Object.keys(territories);
  allProvIds.forEach((pId) => {
    if (territories[pId].neighbors.length < 2) {
      const cA = territories[pId].centroid;
      allProvIds
        .filter((otherId) => otherId !== pId)
        .map((otherId) => {
          const cB = territories[otherId].centroid;
          return {
            otherId,
            distSq: (cA[0] - cB[0]) ** 2 + (cA[1] - cB[1]) ** 2,
          };
        })
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, 3)
        .forEach((item) => linkProvinces(pId, item.otherId));
    }
  });


  // Initialize key diplomatic relations
  const relations: Record<string, DiplomaticRelation> = {};
  const setPresetRelation = (
    a: string,
    b: string,
    partial: Partial<DiplomaticRelation>
  ) => {
    if (!nations[a] || !nations[b]) return;
    const key = relationKey(a, b);
    const nationA = a < b ? a : b;
    const nationB = a < b ? b : a;
    const embargoingNationIds =
      partial.embargoingNationIds ??
      (partial.hasEmbargo ? [nationA] : []);
    relations[key] = {
      nationA,
      nationB,
      score: partial.score ?? 0,
      isAllied: partial.isAllied ?? false,
      allianceType:
        partial.allianceType ?? (partial.isAllied ? 'DEFENSIVE' : null),
      hasNonAggression: partial.hasNonAggression ?? false,
      hasTradeAgreement: partial.hasTradeAgreement ?? false,
      hasEmbargo: embargoingNationIds.length > 0,
      embargoingNationIds,
      hasMilitaryAccess: partial.hasMilitaryAccess ?? false,
      truceUntilTick: 0,
    };
  };

  setPresetRelation('792', '031', {
    score: 90,
    isAllied: true,
    allianceType: 'OFFENSIVE',
    hasTradeAgreement: true,
    hasMilitaryAccess: true,
  });
  setPresetRelation('840', '826', {
    score: 85,
    isAllied: true,
    allianceType: 'DEFENSIVE',
    hasTradeAgreement: true,
  });
  setPresetRelation('276', '250', {
    score: 80,
    isAllied: true,
    allianceType: 'DEFENSIVE',
    hasTradeAgreement: true,
  });
  setPresetRelation('643', '156', {
    score: 70,
    hasNonAggression: true,
    hasTradeAgreement: true,
  });

  // Ensure no two neighboring countries ever share the exact same map color
  const DECONFLICT_PALETTE = [
    '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2',
    '#EA580C', '#059669', '#DB2777', '#4F46E5', '#CA8A04', '#0D9488',
    '#9333EA', '#E11D48', '#65A30D', '#0284C7', '#B45309', '#4338CA',
  ];
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
  const sortedNationIds = Object.keys(nations).sort();
  for (const nid of sortedNationIds) {
    const nation = nations[nid];
    if (!nation) continue;
    const nbOwners = neighborOwnersMap.get(nid);
    if (!nbOwners || nbOwners.size === 0) continue;
    const usedByNeighbors = new Set<string>();
    let hasClash = false;
    for (const nbOwnerId of nbOwners) {
      const nbColor = nations[nbOwnerId]?.color?.toLowerCase();
      if (!nbColor) continue;
      usedByNeighbors.add(nbColor);
      if (nbColor === nation.color.toLowerCase() && nbOwnerId < nid) {
        hasClash = true;
      }
    }
    if (hasClash) {
      const replacement = DECONFLICT_PALETTE.find(
        (c) => !usedByNeighbors.has(c.toLowerCase())
      );
      if (replacement) {
        nation.color = replacement;
      }
    }
  }

  const baseBundle: InitialWorldBundle = {
    features: provinceFeatures,
    nations,
    territories,
    relations,
  };

  if (modeId === 'EMPIRES_1440') {
    return transformBundleTo1440Scenario(baseBundle);
  }

  return baseBundle;
}
