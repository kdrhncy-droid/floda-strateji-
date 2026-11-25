import { GeoProjection } from 'd3-geo';
import { RESOURCE_INFO } from '../data/world2026Data';
import {
  ActiveBattle,
  ActiveWar,
  DiplomaticRelation,
  MapMode,
  Nation,
  Territory,
} from '../types/game';
import {
  calculateProvinceDevelopment,
  getOrCreateRelation,
} from '../engine/simulationEngine';
import type { MapLabelDensityOption } from '../engine/gameSettings';
import { TERRAIN_INFO } from '../engine/pashaAndFiefEngine';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { drawNationFlagOnCanvas } from './nationFlagRenderer';

export interface PlacedBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RenderLabelsParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  transform: { x: number; y: number; k: number };
  visibleFeatures: GeoCountryFeature[];
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations?: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  projection: GeoProjection;
  mapMode: MapMode;
  mapLabelDensity?: MapLabelDensityOption;
  mapLabelScaleMultiplier?: number;
  playerNationId: string;
  selectedTerritoryId: string | null;
  armyOrderSourceId?: string | null;
  fogOfWarEnabled: boolean;
  visibleTerritoryIds: Set<string>;
  projectedCentroids?: Record<string, [number, number]>;
}

function formatTroopBadgeNumber(garrison: number, zoomK: number): string {
  if (garrison >= 1000) {
    const inThousands = garrison / 1000;
    if (zoomK >= 2.2 || inThousands < 10) {
      return `${inThousands.toFixed(1)}B`;
    }
    return `${Math.round(inThousands)}B`;
  }
  return `${Math.max(0, Math.round(garrison))}`;
}

export interface MapLabelThresholds {
  /** Below this zoom only nation realm names are drawn (overview). */
  nationNameMaxZoom: number;
  /** Capitals (★) appear from here on. */
  capitalNameMinZoom: number;
  /** Major cities (Tier 2, legacy 448-map cities) appear from here on. */
  provinceNameMinZoom: number;
  /** District / sancak names (Tier 3) appear last, only when zoomed in. */
  districtNameMinZoom: number;
}

/**
 * Three-stage label LOD:
 *   1. overview  → nation realm names (and capitals as soon as they fit)
 *   2. regional  → capitals + major cities
 *   3. front/district (≥2.4x desktop, ≥2.8x mobile on BALANCED) → districts
 * Density setting still shifts every stage, COMPACT hiding more and
 * DETAILED revealing earlier.
 */
export function getMapLabelThresholds(
  density: MapLabelDensityOption,
  isMobileViewport: boolean
): MapLabelThresholds {
  if (density === 'COMPACT') {
    const capitalNameMinZoom = isMobileViewport ? 2.65 : 2.45;
    return {
      nationNameMaxZoom: capitalNameMinZoom,
      capitalNameMinZoom,
      provinceNameMinZoom: isMobileViewport ? 3.2 : 2.95,
      districtNameMinZoom: isMobileViewport ? 3.9 : 3.55,
    };
  }
  if (density === 'DETAILED') {
    const capitalNameMinZoom = isMobileViewport ? 2.0 : 1.85;
    return {
      nationNameMaxZoom: capitalNameMinZoom,
      capitalNameMinZoom,
      provinceNameMinZoom: isMobileViewport ? 2.4 : 2.25,
      districtNameMinZoom: isMobileViewport ? 3.05 : 2.8,
    };
  }
  const capitalNameMinZoom = isMobileViewport ? 2.3 : 2.15;
  return {
    nationNameMaxZoom: capitalNameMinZoom,
    capitalNameMinZoom,
    provinceNameMinZoom: isMobileViewport ? 2.8 : 2.6,
    districtNameMinZoom: isMobileViewport ? 3.5 : 3.2,
  };
}

const DYNASTY_PREFIX_TO_CITY_MAP: Record<string, string> = {
  'Candaroğulları Sancağı': 'Kastamonu',
  'Candaroğulları': 'Kastamonu',
  'Ramazanoğulları Sancağı': 'Adana',
  'Ramazanoğulları': 'Adana',
  'Dulkadiroğulları Sancağı': 'Maraş',
  'Dulkadiroğulları': 'Maraş',
  'Germiyan Sancağı': 'Kütahya',
  'Karaman Beylerbeyliği': 'Konya',
  'Eflak Voyvodalığı': 'Bükreş',
  'Boğdan Voyvodalığı': 'Yaş',
  'Bohemya Krallığı': 'Prag',
  'Bavyera Dükalığı': 'Münih',
  'Saksonya & Brandenburg': 'Berlin',
  'Avusturya Arşidüklüğü': 'Viyana',
  'Hicaz & Mekke-i Mükerreme': 'Mekke',
  'Kudüs & Filistin': 'Kudüs',
};

function sanitizeCityLabelName(raw: string): string {
  const withoutStar = raw.replace(/^★\s*/, '').trim();
  const withoutParens = withoutStar.replace(/\s*\([^)]*\)/g, '').trim();
  if (DYNASTY_PREFIX_TO_CITY_MAP[withoutParens]) {
    return DYNASTY_PREFIX_TO_CITY_MAP[withoutParens];
  }
  const stripped =
    withoutParens
      .replace(
        /\s+(Sancağı|Beylerbeyliği|Eyaleti|Dükalığı|Arşidüklüğü|Voyvodalığı|Krallığı|İmamlığı|Kalesi|Boğazı|Serhaddi|Prensliği|Hanlığı|Beyliği|Sultanlığı)$/i,
        ''
      )
      .trim() || withoutParens;
  return DYNASTY_PREFIX_TO_CITY_MAP[stripped] || stripped;
}

/**
 * Formats a city/province map label so that only pure city names are shown
 * (no legacy dynasty/country names), and zooming in (>= 3.0) or selecting a province
 * shows its full name without truncation.
 */
export function formatProvinceMapLabel(
  rawName: string,
  isCapital: boolean,
  isSelected: boolean,
  zoomK: number,
  isMobileViewport: boolean
): { lines: string[]; isFull: boolean } {
  const cleanName = sanitizeCityLabelName(rawName);
  const showFull = isSelected || zoomK >= 3.0;

  if (showFull) {
    const fullText = isCapital ? `★ ${cleanName}` : cleanName;
    const singleLineLimit = zoomK >= 5.5 ? 28 : isMobileViewport ? 18 : 22;

    if (fullText.length <= singleLineLimit) {
      return { lines: [fullText], isFull: true };
    }

    // Wrap cleanly across 2 balanced lines at word / '&' boundaries without dropping any character
    const words = fullText.split(/\s+/);
    if (words.length >= 2) {
      let bestSplit = 1;
      let bestDiff = Infinity;
      for (let i = 1; i < words.length; i++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i).join(' ');
        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = i;
        }
      }
      return {
        lines: [
          words.slice(0, bestSplit).join(' '),
          words.slice(bestSplit).join(' '),
        ],
        isFull: true,
      };
    }

    return { lines: [fullText], isFull: true };
  }

  // Overview zoom (< 3.0): pure city label
  const rawLabel = isCapital ? `★ ${cleanName}` : cleanName;
  const maxChars = isMobileViewport ? 20 : 24;
  const labelText =
    rawLabel.length > maxChars
      ? `${rawLabel.slice(0, maxChars - 1)}…`
      : rawLabel;

  return { lines: [labelText], isFull: !labelText.endsWith('…') };
}

export type ProvinceLabelTier = 'capital' | 'city' | 'district';

/**
 * Pure LOD decision for a province label. Used by the canvas renderer and
 * covered directly by tests:
 *   - selected province is always labelled (touch/selection override)
 *   - capitals from capitalNameMinZoom
 *   - major cities from provinceNameMinZoom
 *   - districts/sancaks only from districtNameMinZoom
 */
export function shouldRenderProvinceLabel(
  tier: ProvinceLabelTier,
  zoomK: number,
  thresholds: MapLabelThresholds,
  isSelected: boolean
): boolean {
  if (isSelected) return true;
  if (tier === 'capital') return zoomK >= thresholds.capitalNameMinZoom;
  if (tier === 'district') return zoomK >= thresholds.districtNameMinZoom;
  return zoomK >= thresholds.provinceNameMinZoom;
}

export function isNationPlayerOrAlly(
  nationId: string | undefined,
  playerNationId: string,
  nations: Record<string, Nation>,
  relations: Record<string, DiplomaticRelation>
): boolean {
  if (!nationId) return false;
  if (nationId === playerNationId) return true;
  const rel = getOrCreateRelation(relations, playerNationId, nationId);
  if (rel.isAllied || Boolean(rel.allianceType)) return true;
  const nat = nations[nationId];
  const playerNat = nations[playerNationId];
  if (nat?.vassalOf === playerNationId || playerNat?.vassalOf === nationId) {
    return true;
  }
  return false;
}

const textWidthCache = new Map<string, number>();

function measureCachedTextWidth(
  ctx: CanvasRenderingContext2D,
  font: string,
  text: string
): number {
  const key = `${font}|${text}`;
  const cached = textWidthCache.get(key);
  if (cached !== undefined) return cached;
  ctx.font = font;
  const w = ctx.measureText(text).width;
  if (textWidthCache.size > 2500) {
    textWidthCache.clear();
  }
  textWidthCache.set(key, w);
  return w;
}

export function renderMapLabelsAndBattles(params: RenderLabelsParams): void {
  const {
    ctx,
    width,
    height,
    transform,
    visibleFeatures,
    territories,
    nations,
    relations = {},
    wars,
    battles,
    projection,
    mapMode,
    playerNationId,
    selectedTerritoryId,
    fogOfWarEnabled,
    visibleTerritoryIds,
    mapLabelDensity = 'BALANCED',
    mapLabelScaleMultiplier = 1.0,
    projectedCentroids,
  } = params;

  const isMobileViewport = width < 768 || height < 540;
  const labelThresholds = getMapLabelThresholds(
    mapLabelDensity,
    isMobileViewport
  );
  const placedBoxes: PlacedBox[] = [];
  const collides = (box: PlacedBox) =>
    placedBoxes.some(
      (b) =>
        box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1
    );

  // Precompute active war enemies of the player once per frame (O(W) instead of O(N*W))
  const warEnemySet = new Set<string>();
  for (const w of wars) {
    if (w.attackers.includes(playerNationId)) {
      for (const id of w.defenders) warEnemySet.add(id);
    } else if (w.defenders.includes(playerNationId)) {
      for (const id of w.attackers) warEnemySet.add(id);
    }
  }

  const getProjPt = (t: Territory): [number, number] | null =>
    projectedCentroids?.[t.id] ?? projection(t.centroid);

  // Only show battles where the player or a player ally/vassal is involved
  const visibleBattles = battles.filter(
    (b) =>
      isNationPlayerOrAlly(b.attackerId, playerNationId, nations, relations) ||
      isNationPlayerOrAlly(b.defenderId, playerNationId, nations, relations) ||
      territories[b.territoryId]?.ownerId === playerNationId
  );

  // Track provinces with visible active battles so stationary shield doesn't overlap the live battle widget
  const battleTerritorySet = new Set(visibleBattles.map((b) => b.territoryId));

  const visibleTerritories: Territory[] = [];
  for (const feat of visibleFeatures) {
    const t = territories[feat.id];
    if (t) visibleTerritories.push(t);
  }

  // 0. AoH3 Grand Strategy Country Realm Names (overview LOD only, centered over each country's core contiguous landmass)
  if (transform.k < labelThresholds.nationNameMaxZoom) {
    const ownedTerrsByNation: Record<string, Territory[]> = {};
    for (const t of Object.values(territories)) {
      if (!t || !t.ownerId) continue;
      if (!ownedTerrsByNation[t.ownerId]) {
        ownedTerrsByNation[t.ownerId] = [];
      }
      ownedTerrsByNation[t.ownerId].push(t);
    }

    const nationCorePlacements: {
      nationId: string;
      pts: [number, number][];
      totalOwnedCount: number;
    }[] = [];

    for (const [nationId, owned] of Object.entries(ownedTerrsByNation)) {
      if (owned.length === 0) continue;
      const visited = new Set<string>();
      const components: Territory[][] = [];
      const capitalId = nations[nationId]?.capitalTerritoryId;

      for (const startT of owned) {
        if (visited.has(startT.id)) continue;
        const comp: Territory[] = [];
        const queue: Territory[] = [startT];
        visited.add(startT.id);
        while (queue.length > 0) {
          const cur = queue.pop()!;
          comp.push(cur);
          for (const nbId of cur.neighbors) {
            if (visited.has(nbId)) continue;
            const nb = territories[nbId];
            if (nb && nb.ownerId === nationId) {
              visited.add(nbId);
              queue.push(nb);
            }
          }
        }
        components.push(comp);
      }

      if (components.length === 0) continue;
      components.sort((a, b) => b.length - a.length);
      const largestCount = components[0].length;
      const capitalComp = capitalId
        ? components.find((c) => c.some((t) => t.id === capitalId))
        : undefined;
      const coreComp =
        capitalComp && capitalComp.length >= Math.max(2, largestCount * 0.55)
          ? capitalComp
          : components[0];

      const pts: [number, number][] = [];
      let anyInViewport = false;
      for (const t of coreComp) {
        const pt = getProjPt(t);
        if (!pt) continue;
        const sx = pt[0] * transform.k + transform.x;
        const sy = pt[1] * transform.k + transform.y;
        pts.push([sx, sy]);
        if (sx >= -80 && sx <= width + 80 && sy >= -80 && sy <= height + 80) {
          anyInViewport = true;
        }
      }
      if (!anyInViewport || pts.length === 0) continue;

      nationCorePlacements.push({
        nationId,
        pts,
        totalOwnedCount: owned.length,
      });
    }

    nationCorePlacements.sort((a, b) => {
      if (a.nationId === playerNationId) return -1;
      if (b.nationId === playerNationId) return 1;
      return b.pts.length - a.pts.length;
    });

    for (const { nationId, pts } of nationCorePlacements) {
      const nat = nations[nationId];
      if (!nat || pts.length === 0) continue;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let cSumX = 0;
      let cSumY = 0;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        cSumX += x;
        cSumY += y;
      }

      // Blend centroid average and bounding-box center for stable centering over wide empires
      const avgX = cSumX / pts.length;
      const avgY = cSumY / pts.length;
      const bboxCx = (minX + maxX) * 0.5;
      const bboxCy = (minY + maxY) * 0.5;
      const cx = avgX * 0.65 + bboxCx * 0.35;
      const cy = avgY * 0.65 + bboxCy * 0.35;

      if (cx < -100 || cx > width + 100 || cy < -60 || cy > height + 60) {
        continue;
      }

      // Estimated screen-space width of this nation's core contiguous landmass
      const singleProvRadius = (isMobileViewport ? 22 : 28) * transform.k;
      const spanW = Math.max(
        singleProvRadius * 1.65,
        maxX - minX + singleProvRadius * 1.45
      );

      const rawName = nat.name
        .replace(/\s*\(1440\)\s*$/, '')
        .replace(/\s*\(2026\)\s*$/, '')
        .trim();
      const shortName =
        rawName
          .replace(
            /\s+(Cihan Devleti|İmparatorluğu|Krallığı|Sultanlığı|Cumhuriyeti|Federasyonu|Konfederasyonu|Despotluğu|Prensliği|Hanlığı|Beyliği|Devleti)$/i,
            ''
          )
          .trim() || rawName;

      const isPlayer = nationId === playerNationId;
      const isAtWarWithPlayer = warEnemySet.has(nationId);
      const isMajorRealm = pts.length >= 4;

      // Proportional font size that scales smoothly with cluster footprint & zoom
      const maxFontCap = isMobileViewport ? 13.5 : 16.0;
      const zoomFactor = Math.max(0.5, Math.min(1.35, transform.k * 0.82));
      let fontSize = Math.min(
        maxFontCap,
        (6.6 + Math.sqrt(pts.length) * 1.6) * zoomFactor
      );

      let displayLabel =
        transform.k < 0.95 || spanW < 95
          ? shortName.toLocaleUpperCase('tr-TR')
          : rawName.toLocaleUpperCase('tr-TR');

      let nationFont = `700 ${fontSize.toFixed(1)}px "Cinzel", "Georgia", serif`;
      let measuredW = measureCachedTextWidth(ctx, nationFont, displayLabel);

      // If full name is wider than the country's on-screen span, switch to short name first
      const maxAllowedW = Math.max(
        isPlayer ? 62 : isMajorRealm ? 54 : 44,
        spanW * 1.24
      );
      if (measuredW > maxAllowedW && displayLabel !== shortName.toLocaleUpperCase('tr-TR')) {
        displayLabel = shortName.toLocaleUpperCase('tr-TR');
        measuredW = measureCachedTextWidth(ctx, nationFont, displayLabel);
      }

      // Shrink font size proportionally so the label fits inside the nation's screen footprint
      if (measuredW > maxAllowedW && measuredW > 0) {
        fontSize = Math.max(5.5, fontSize * (maxAllowedW / measuredW));
        nationFont = `700 ${fontSize.toFixed(1)}px "Cinzel", "Georgia", serif`;
        measuredW = measureCachedTextWidth(ctx, nationFont, displayLabel);
      }

      // Keep major empires legible even when zoomed out globally
      const minReadableFont = isPlayer ? 5.6 : isMajorRealm ? 5.6 : 6.4;
      if (fontSize < minReadableFont) {
        continue;
      }

      const boxPadX = 4;
      const boxPadY = 2;
      const nationBox: PlacedBox = {
        x1: cx - measuredW / 2 - boxPadX,
        y1: cy - fontSize / 2 - boxPadY,
        x2: cx + measuredW / 2 + boxPadX,
        y2: cy + fontSize / 2 + boxPadY,
      };

      if (!isPlayer && collides(nationBox)) {
        continue;
      }
      placedBoxes.push(nationBox);

      ctx.save();
      ctx.font = nationFont;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.8, fontSize * 0.22);
      ctx.strokeStyle = 'rgba(8, 10, 16, 0.92)';
      ctx.strokeText(displayLabel, cx, cy);

      ctx.fillStyle = isPlayer
        ? 'rgba(253, 230, 138, 0.96)'
        : isAtWarWithPlayer
        ? 'rgba(254, 202, 202, 0.94)'
        : 'rgba(245, 238, 220, 0.90)';
      ctx.fillText(displayLabel, cx, cy);
      ctx.restore();
    }
  }

  // Pre-filter on-screen territories that actually need a label, siege, resource badge, or army shield
  // so zoomed-out frames never sort or inspect hundreds of off-screen / hidden provinces.
  const isResourceOrEcoLens =
    mapMode === 'RESOURCES' || mapMode === 'ECONOMIC';
  const alliedCache = new Map<string, boolean>();
  const isAlliedNation = (ownerId: string): boolean => {
    if (!ownerId || ownerId === playerNationId) return false;
    const cached = alliedCache.get(ownerId);
    if (cached !== undefined) return cached;
    const rel = getOrCreateRelation(relations, playerNationId, ownerId);
    const owner = nations[ownerId];
    const val =
      Boolean(rel?.isAllied) ||
      Boolean(rel?.allianceType) ||
      owner?.vassalOf === playerNationId ||
      nations[playerNationId]?.vassalOf === ownerId;
    alliedCache.set(ownerId, val);
    return val;
  };

  interface PreparedLabelItem {
    t: Territory;
    sx: number;
    sy: number;
    isSelected: boolean;
    isPlayerTerritory: boolean;
    isEnemy: boolean;
    isAlliedOrVassal: boolean;
    isCapital: boolean;
    isDistrictTier: boolean;
    hasIntel: boolean;
    wantsName: boolean;
    canSeeSiege: boolean;
    wantsResourceBadge: boolean;
    wantsArmyShield: boolean;
    rank: number;
  }

  const labelCandidates: PreparedLabelItem[] = [];
  for (const t of visibleTerritories) {
    const pt = getProjPt(t);
    if (!pt) continue;
    const sx = pt[0] * transform.k + transform.x;
    const sy = pt[1] * transform.k + transform.y;
    if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) {
      continue;
    }

    const isSelected = t.id === selectedTerritoryId;
    const isPlayerTerritory = t.ownerId === playerNationId;
    const isEnemy = !isPlayerTerritory && warEnemySet.has(t.ownerId);
    const isAlliedOrVassal = !isPlayerTerritory && isAlliedNation(t.ownerId);
    const ownerNation = nations[t.ownerId];
    const isCapital = Boolean(
      t.isCapital ||
        (ownerNation ? ownerNation.capitalTerritoryId === t.id : t.id === t.ownerId)
    );
    const isDistrictTier = Boolean(t.isDistrict) && !isCapital;
    const hasIntel = !fogOfWarEnabled || visibleTerritoryIds.has(t.id);
    const inBattle = battleTerritorySet.has(t.id);

    const labelTier: ProvinceLabelTier = isCapital
      ? 'capital'
      : isDistrictTier
      ? 'district'
      : 'city';
    const wantsName =
      !inBattle &&
      shouldRenderProvinceLabel(
        labelTier,
        transform.k,
        labelThresholds,
        isSelected
      );

    const canSeeSiege =
      Boolean(t.siege) &&
      !inBattle &&
      (hasIntel ||
        isPlayerTerritory ||
        isAlliedOrVassal ||
        isNationPlayerOrAlly(t.siege?.attackerId, playerNationId, nations, relations) ||
        isNationPlayerOrAlly(t.siege?.defenderId, playerNationId, nations, relations));

    const wantsResourceBadge =
      isResourceOrEcoLens &&
      !inBattle &&
      !canSeeSiege &&
      (isSelected ||
        isPlayerTerritory ||
        isCapital ||
        transform.k >= (isMobileViewport ? 1.35 : 1.2));

    const garrison = t.garrison || 0;
    const wantsArmyShield =
      !isResourceOrEcoLens &&
      !inBattle &&
      !canSeeSiege &&
      (garrison > 0 || isSelected) &&
      (isSelected ||
        (hasIntel &&
          garrison >= 500 &&
          (mapMode === 'MILITARY' ||
            (isPlayerTerritory && transform.k >= 1.0) ||
            (isEnemy && transform.k >= 1.0) ||
            (isAlliedOrVassal &&
              (isCapital || garrison >= 5000) &&
              transform.k >= 1.25) ||
            (isCapital && transform.k >= 1.85) ||
            (garrison >= 6000 && transform.k >= 2.0) ||
            transform.k >= (isMobileViewport ? 2.35 : 2.15))));

    if (!wantsName && !canSeeSiege && !wantsResourceBadge && !wantsArmyShield) {
      continue;
    }

    const rank = isSelected
      ? 0
      : canSeeSiege
      ? 0.5
      : isCapital
      ? isPlayerTerritory
        ? 1
        : 2
      : isDistrictTier
      ? isPlayerTerritory
        ? 6
        : 7
      : isPlayerTerritory
      ? 3
      : isEnemy
      ? 4
      : 5;

    labelCandidates.push({
      t,
      sx,
      sy,
      isSelected,
      isPlayerTerritory,
      isEnemy,
      isAlliedOrVassal,
      isCapital,
      isDistrictTier,
      hasIntel,
      wantsName,
      canSeeSiege,
      wantsResourceBadge,
      wantsArmyShield,
      rank,
    });
  }

  labelCandidates.sort((a, b) => {
    const rankDiff = a.rank - b.rank;
    if (rankDiff !== 0) return rankDiff;
    return (b.t.garrison || 0) - (a.t.garrison || 0);
  });

  const maxCityLabelsOnScreen = isMobileViewport ? 36 : 64;
  let placedCityLabelCount = 0;

  for (const item of labelCandidates) {
    const {
      t,
      sx,
      sy,
      isSelected,
      isPlayerTerritory,
      isEnemy,
      isAlliedOrVassal,
      isCapital,
      isDistrictTier,
      hasIntel,
      wantsName,
      canSeeSiege,
      wantsResourceBadge,
      wantsArmyShield,
    } = item;
    const owner = nations[t.ownerId];

    // 1. Province / City Name Label (Only pure city names, hidden when zoomed out)
    let namePlaced = false;
    if (wantsName && (isSelected || placedCityLabelCount < maxCityLabelsOnScreen)) {
      const { lines } = formatProvinceMapLabel(
        t.name,
        isCapital,
        isSelected,
        transform.k,
        isMobileViewport
      );

      const mobileScale = (isMobileViewport ? 0.87 : 1.0) * mapLabelScaleMultiplier;
      const baseFontSize = isSelected
        ? 10.2
        : isCapital
        ? Math.min(10.4, Math.max(7.8, 7.4 + Math.min(12, transform.k) * 0.22))
        : isDistrictTier
        ? Math.min(8.2, Math.max(6.4, 6.0 + Math.min(12, transform.k) * 0.17))
        : Math.min(9.2, Math.max(7.1, 6.7 + Math.min(12, transform.k) * 0.19));
      const fontSize = baseFontSize * mobileScale;
      const labelWeight: '500' | '600' | '700' =
        isCapital || isSelected ? '700' : isDistrictTier ? '500' : '600';
      const labelFont = `${labelWeight} ${fontSize.toFixed(1)}px "Plus Jakarta Sans", system-ui, sans-serif`;

      const lineHeight = fontSize + 1.8;
      const widestLine = lines.reduce((maxW, ln) => {
        const mW = measureCachedTextWidth(ctx, labelFont, ln);
        return Math.max(maxW, mW, ln.length * (fontSize * 0.52));
      }, 0);
      const estW = widestLine + 8;
      const estH = lines.length * lineHeight + 3;
      const baseCenterY = lines.length > 1 ? sy - 14 : sy - 10;

      // Try primary position + gentle vertical/horizontal nudges so dense city clusters never overlap
      const candidateOffsets: [number, number][] = isSelected
        ? [[0, 0]]
        : [
            [0, 0],
            [0, -11],
            [0, 14],
            [-14, -6],
            [14, -6],
          ];

      let chosenX = sx;
      let chosenY = baseCenterY;
      let chosenBox: PlacedBox | null = null;

      for (const [ox, oy] of candidateOffsets) {
        const cx = sx + ox;
        const cy = baseCenterY + oy;
        const box: PlacedBox = {
          x1: cx - estW / 2,
          y1: cy - estH / 2,
          x2: cx + estW / 2,
          y2: cy + estH / 2,
        };
        if (isSelected || !collides(box)) {
          chosenX = cx;
          chosenY = cy;
          chosenBox = box;
          break;
        }
      }

      if (chosenBox) {
        placedBoxes.push(chosenBox);
        namePlaced = true;
        placedCityLabelCount += 1;

        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = isSelected ? 2.7 : isDistrictTier ? 1.9 : 2.25;
        ctx.strokeStyle = 'rgba(2, 6, 20, 0.94)';
        ctx.fillStyle = isSelected
          ? '#FDE68A'
          : isPlayerTerritory
          ? '#E2FBE8'
          : isEnemy
          ? '#FECDD3'
          : isCapital
          ? '#FEF3C7'
          : isDistrictTier
          ? '#CBD5E1'
          : '#F1F5F9';

        const startY =
          chosenY - ((lines.length - 1) * lineHeight) / 2;
        for (let idx = 0; idx < lines.length; idx++) {
          const ly = startY + idx * lineHeight;
          ctx.strokeText(lines[idx], chosenX, ly);
          ctx.fillText(lines[idx], chosenX, ly);
        }
      }
    }

    // 1B. Clean Under-Army Siege Bar (normal besieging army plate + slim progress bar directly underneath)
    if (canSeeSiege && t.siege) {
      const siege = t.siege;
      const siegeAttacker = nations[siege.attackerId];
      const isPlayerBesieging = siege.attackerId === playerNationId;
      const siegePct = Math.max(0, Math.min(100, Math.round(siege.progress)));
      const siegeBadgeY = namePlaced ? sy + 11 : sy;
      const plateW = 68;
      const plateH = 18;
      const barH = 4;
      const barGap = 2.5;
      const totalH = plateH + barGap + barH;
      const sBox: PlacedBox = {
        x1: sx - plateW / 2 - 2,
        y1: siegeBadgeY - totalH / 2 - 2,
        x2: sx + plateW / 2 + 2,
        y2: siegeBadgeY + totalH / 2 + 2,
      };

      if (isSelected || canSeeSiege || !collides(sBox)) {
        placedBoxes.push(sBox);
        const bx = sx - plateW / 2;
        const by = siegeBadgeY - totalH / 2;

        // Besieging army plate (attacker flag + troop count, matching normal map army badges)
        ctx.fillStyle = 'rgba(13, 18, 28, 0.94)';
        ctx.strokeStyle = isPlayerBesieging
          ? 'rgba(245, 158, 11, 0.9)'
          : 'rgba(244, 63, 94, 0.85)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.roundRect(bx, by, plateW, plateH, 4);
        ctx.fill();
        ctx.stroke();

        drawNationFlagOnCanvas(
          ctx,
          bx + 2,
          by + 2,
          18,
          plateH - 4,
          siege.attackerId,
          (siegeAttacker?.flagCode || 'ORD').slice(0, 3),
          siegeAttacker?.color || '#DC2626'
        );

        const troopText =
          siege.attackerTroops >= 1000
            ? `${(siege.attackerTroops / 1000).toFixed(1)}B`
            : `${Math.round(siege.attackerTroops)}`;
        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(troopText, bx + 22 + (plateW - 24) / 2, by + plateH / 2 + 0.5);

        // Simple slim siege progress bar directly underneath the besieging army plate
        const barX = bx;
        const barY = by + plateH + barGap;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(barX, barY, plateW, barH, 2);
        ctx.fill();
        ctx.stroke();

        const fillW = Math.max(
          siegePct > 0 ? 3 : 0,
          (plateW * siegePct) / 100
        );
        if (fillW > 0) {
          const grad = ctx.createLinearGradient(barX, 0, barX + plateW, 0);
          if (isPlayerBesieging) {
            grad.addColorStop(0, '#D97706');
            grad.addColorStop(1, '#FACC15');
          } else {
            grad.addColorStop(0, '#BE123C');
            grad.addColorStop(1, '#FB7185');
          }
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(barX, barY, fillW, barH, 2);
          ctx.fill();
        }
      }
    }

    // 1C. Compact Resource Icon & Investment Value Badge (in RESOURCES or ECONOMIC MapMode)
    if (wantsResourceBadge) {
      const resMeta = RESOURCE_INFO[t.resource] || RESOURCE_INFO.TAHIL;
      const dev = calculateProvinceDevelopment(t, owner);
      const resY = namePlaced ? sy + 8 : sy;
      const showDetailText = isSelected || transform.k >= 2.25;
      const pillText =
        mapMode === 'RESOURCES'
          ? showDetailText
            ? `${resMeta.icon} ${resMeta.shortName} ${dev.effectiveResourceValue}A`
            : `${resMeta.icon} ${dev.effectiveResourceValue}A`
          : showDetailText
          ? `★${dev.developmentScore}P · ${resMeta.icon}${dev.effectiveResourceValue}A`
          : `★${dev.developmentScore}P`;

      const fontPx = isSelected ? 10 : transform.k >= 1.8 ? 9.2 : 8.4;
      const pillFont = `700 ${fontPx}px "JetBrains Mono", "Plus Jakarta Sans", sans-serif`;
      const textW = measureCachedTextWidth(ctx, pillFont, pillText);
      const pillW = Math.max(34, textW + 10);
      const pillH = isSelected ? 17 : 15;
      const rBox: PlacedBox = {
        x1: sx - pillW / 2 - 1,
        y1: resY - pillH / 2 - 1,
        x2: sx + pillW / 2 + 1,
        y2: resY + pillH / 2 + 1,
      };

      if (isSelected || !collides(rBox)) {
        placedBoxes.push(rBox);
        const rx = sx - pillW / 2;
        const ry = resY - pillH / 2;

        ctx.save();
        ctx.font = pillFont;
        ctx.fillStyle = 'rgba(7, 12, 24, 0.92)';
        ctx.strokeStyle =
          mapMode === 'RESOURCES'
            ? resMeta.color
            : dev.developmentScore >= 68
            ? '#34D399'
            : '#F59E0B';
        ctx.lineWidth = isSelected ? 1.6 : 1.15;
        ctx.beginPath();
        ctx.roundRect(rx, ry, pillW, pillH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#FEF08A' : '#F8FAFC';
        ctx.fillText(pillText, sx, resY + 0.5);
        ctx.restore();
      }
    }

    // 2. Clean AoH3-Style Army Counter Plate (Graphical National Flag + Pure Troop Number, NO tiny soldier icons)
    const garrison = t.garrison || 0;
    if (wantsArmyShield && (garrison > 0 || isSelected)) {
      const badgeY = namePlaced ? sy + 9 : sy + 2;
      const troopStr = hasIntel
        ? formatTroopBadgeNumber(garrison, transform.k)
        : '?';
      const flagCode = (owner?.flagCode || '??').slice(0, 3);

      const mainText = troopStr;
      const isCompactZoom = transform.k < 1.55 && !isSelected;
      const badgeH = isCompactZoom ? 16 : 18;
      const flagBoxW = isCompactZoom ? 21 : 24;
      const numBoxW = Math.max(
        isCompactZoom ? 28 : 34,
        mainText.length * (isCompactZoom ? 5.6 : 6.2) + 8
      );
      const badgeW = flagBoxW + numBoxW;

      const badgeBox: PlacedBox = {
        x1: sx - badgeW / 2 - 2,
        y1: badgeY - badgeH / 2 - 2,
        x2: sx + badgeW / 2 + 2,
        y2: badgeY + badgeH / 2 + 2,
      };

      const allowForcePlace = isSelected;

      if (allowForcePlace || !collides(badgeBox)) {
        placedBoxes.push(badgeBox);

        const bx = sx - badgeW / 2;
        const by = badgeY - badgeH / 2;

        // Clean AoH3 Counter Plate Body (crisp, non-glowing)
        ctx.fillStyle = isPlayerTerritory
          ? 'rgba(15, 34, 28, 0.95)'
          : isEnemy
          ? 'rgba(80, 18, 24, 0.95)'
          : isAlliedOrVassal
          ? 'rgba(14, 46, 72, 0.95)'
          : 'rgba(18, 22, 30, 0.94)';

        ctx.strokeStyle = isSelected
          ? '#F8FAFC'
          : isPlayerTerritory
          ? 'rgba(110, 231, 183, 0.55)'
          : isEnemy
          ? '#F87171'
          : isAlliedOrVassal
          ? '#38BDF8'
          : 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = isSelected ? 1.45 : 1.0;

        ctx.beginPath();
        ctx.roundRect(bx, by, badgeW, badgeH, 3.5);
        ctx.fill();
        ctx.stroke();

        // 2c. Left Graphical Nation Flag inside Counter
        drawNationFlagOnCanvas(
          ctx,
          bx + 1.5,
          by + 1.5,
          flagBoxW - 2,
          badgeH - 3,
          t.ownerId,
          flagCode,
          owner?.color || '#475569'
        );

        // Subtle slate vertical divider between flag and troop count
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + flagBoxW, by + 1.5);
        ctx.lineTo(bx + flagBoxW, by + badgeH - 1.5);
        ctx.stroke();

        // 2d. Right Pure Troop Count Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${isCompactZoom ? '9px' : '10px'} "JetBrains Mono", monospace`;
        ctx.fillStyle = !hasIntel
          ? '#94A3B8'
          : isEnemy
          ? '#FFE4E6'
          : '#F8FAFC';
        ctx.fillText(
          mainText,
          bx + flagBoxW + numBoxW / 2,
          badgeY - (hasIntel ? 1.0 : 0)
        );

        // 2e. Bottom 2px Unit Composition Bar
        if (hasIntel && t.units && garrison > 0) {
          const totalU = Math.max(
            1,
            (t.units.infantry || 0) +
              (t.units.armor || 0) +
              (t.units.airDrone || 0)
          );
          const infW = ((t.units.infantry || 0) / totalU) * (numBoxW - 4);
          const armW = ((t.units.armor || 0) / totalU) * (numBoxW - 4);
          const airW = Math.max(0, numBoxW - 4 - infW - armW);
          const barX = bx + flagBoxW + 2;
          const barY = by + badgeH - 3.0;

          ctx.fillStyle = '#34D399';
          ctx.fillRect(barX, barY, infW, 1.8);
          ctx.fillStyle = '#FBBF24';
          ctx.fillRect(barX + infW, barY, armW, 1.8);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(barX + infW + armW, barY, airW, 1.8);
        }

        // Terrain / Fief Lord Micro-Indicator only in TERRAIN mode or when selected/fief-assigned
        if (
          (mapMode === 'TERRAIN' || isSelected || Boolean(t.fiefLordId)) &&
          transform.k >= 2.2
        ) {
          const tMeta = TERRAIN_INFO[t.terrain || 'OVA'] || TERRAIN_INFO.OVA;
          const wallHp = t.castleWallHp ?? 100;
          const subTag = `${tMeta.name}${wallHp < 100 ? ` ♜%${wallHp}` : ''}${t.fiefLordId ? ' ⚜' : ''}`;
          ctx.font = '600 8px Inter, sans-serif';
          ctx.fillStyle = t.fiefLordId ? '#E9D5FF' : '#CBD5E1';
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
          ctx.lineWidth = 2.2;
          ctx.strokeText(subTag, sx, badgeY + badgeH / 2 + 7);
          ctx.fillText(subTag, sx, badgeY + badgeH / 2 + 7);
        }
      }
    }
  }

  // 3. AoH3 Live On-Map Battle Widget (Clean Graphical Flags + Tug-of-War Bar, filtered to player & allied wars)
  for (const btl of visibleBattles) {
    const t = territories[btl.territoryId];
    if (!t) continue;
    const pt = projection(t.centroid);
    if (!pt) continue;
    const sx = pt[0] * transform.k + transform.x;
    const sy = pt[1] * transform.k + transform.y;

    const attNation = nations[btl.attackerId];
    const defNation = nations[btl.defenderId];
    const attFlag = (attNation?.flagCode || 'SLD').slice(0, 3);
    const defFlag = (defNation?.flagCode || 'SVN').slice(0, 3);
    const attStr = formatTroopBadgeNumber(btl.attackerTroops, 2.5);
    const defStr = formatTroopBadgeNumber(btl.defenderTroops, 2.5);

    const totalTroops = Math.max(1, btl.attackerTroops + btl.defenderTroops);
    const attRatio = Math.max(
      0.12,
      Math.min(0.88, btl.attackerTroops / totalTroops)
    );

    const pillW = 120;
    const pillH = 22;
    const bx = sx - pillW / 2;
    const by = sy - 8 - pillH / 2;

    // Main dark battle frame (clean crisp border, no yellow glow)
    ctx.fillStyle = 'rgba(14, 16, 22, 0.96)';
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(bx, by, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();

    // 3c. Left Attacker Graphical Flag & Right Defender Graphical Flag
    drawNationFlagOnCanvas(
      ctx,
      bx + 1.5,
      by + 1.5,
      20,
      pillH - 6.5,
      btl.attackerId,
      attFlag,
      attNation?.color || '#DC2626'
    );
    drawNationFlagOnCanvas(
      ctx,
      bx + pillW - 21.5,
      by + 1.5,
      20,
      pillH - 6.5,
      btl.defenderId,
      defFlag,
      defNation?.color || '#2563EB'
    );

    // 3d. Attacker Troops vs Defender Troops
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle =
      btl.attackerId === playerNationId ? '#A7F3D0' : '#FECDD3';
    ctx.fillText(attStr, bx + 38, by + 9);

    ctx.font = '700 9px Inter, sans-serif';
    ctx.fillStyle = '#F87171';
    ctx.fillText('⚔', sx, by + 9);

    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle =
      btl.defenderId === playerNationId ? '#A7F3D0' : '#E2E8F0';
    ctx.fillText(defStr, bx + pillW - 38, by + 9);

    // 3e. Bottom Tug-of-War Balance Bar
    const barY = by + pillH - 4;
    const barW = pillW - 4;
    const attBarW = Math.round(barW * attRatio);

    ctx.fillStyle =
      btl.attackerId === playerNationId ? '#10B981' : '#EF4444';
    ctx.fillRect(bx + 2, barY, attBarW, 2.5);

    ctx.fillStyle =
      btl.defenderId === playerNationId ? '#10B981' : '#3B82F6';
    ctx.fillRect(bx + 2 + attBarW, barY, barW - attBarW, 2.5);
  }
}
