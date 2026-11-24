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
  isAtWar,
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
  playerNationId: string;
  selectedTerritoryId: string | null;
  armyOrderSourceId?: string | null;
  fogOfWarEnabled: boolean;
  visibleTerritoryIds: Set<string>;
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

export function getMapLabelThresholds(
  density: MapLabelDensityOption,
  isMobileViewport: boolean
): { capitalNameMinZoom: number; provinceNameMinZoom: number } {
  if (density === 'COMPACT') {
    return isMobileViewport
      ? { capitalNameMinZoom: 2.0, provinceNameMinZoom: 2.65 }
      : { capitalNameMinZoom: 1.8, provinceNameMinZoom: 2.45 };
  }
  if (density === 'DETAILED') {
    return isMobileViewport
      ? { capitalNameMinZoom: 1.45, provinceNameMinZoom: 1.9 }
      : { capitalNameMinZoom: 1.3, provinceNameMinZoom: 1.7 };
  }
  return isMobileViewport
    ? { capitalNameMinZoom: 1.75, provinceNameMinZoom: 2.25 }
    : { capitalNameMinZoom: 1.55, provinceNameMinZoom: 2.05 };
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

  // Sort priority: Selected -> Player Owned -> At War Enemy -> Capitals -> Largest Garrison
  const sortedForLabels = [...visibleTerritories].sort((a, b) => {
    if (a.id === selectedTerritoryId) return -1;
    if (b.id === selectedTerritoryId) return 1;
    const aPlayer = a.ownerId === playerNationId;
    const bPlayer = b.ownerId === playerNationId;
    if (aPlayer && !bPlayer) return -1;
    if (!aPlayer && bPlayer) return 1;
    const aEnemy = Boolean(isAtWar(wars, playerNationId, a.ownerId));
    const bEnemy = Boolean(isAtWar(wars, playerNationId, b.ownerId));
    if (aEnemy && !bEnemy) return -1;
    if (!aEnemy && bEnemy) return 1;
    if (a.isCapital && !b.isCapital) return -1;
    if (!a.isCapital && b.isCapital) return 1;
    return (b.garrison || 0) - (a.garrison || 0);
  });

  // 0. AoH3 Grand Strategy Country Realm Names (Rendered at overview / normal zoom < 2.15)
  if (transform.k < 2.15) {
    const nationClusters: Record<
      string,
      { pts: [number, number][]; count: number }
    > = {};
    for (const t of visibleTerritories) {
      if (!t.ownerId) continue;
      const pt = projection(t.centroid);
      if (!pt) continue;
      const sx = pt[0] * transform.k + transform.x;
      const sy = pt[1] * transform.k + transform.y;
      if (sx < -80 || sx > width + 80 || sy < -80 || sy > height + 80)
        continue;
      if (!nationClusters[t.ownerId]) {
        nationClusters[t.ownerId] = { pts: [], count: 0 };
      }
      nationClusters[t.ownerId].pts.push([sx, sy]);
      nationClusters[t.ownerId].count += 1;
    }

    const sortedNationClusters = Object.entries(nationClusters).sort(
      ([idA, a], [idB, b]) => {
        if (idA === playerNationId) return -1;
        if (idB === playerNationId) return 1;
        return b.count - a.count;
      }
    );

    for (const [nationId, cluster] of sortedNationClusters) {
      const nat = nations[nationId];
      if (!nat || cluster.pts.length === 0) continue;

      // Use capital or median center to filter out far-flung outlier provinces
      let sumX = 0;
      let sumY = 0;
      for (const [x, y] of cluster.pts) {
        sumX += x;
        sumY += y;
      }
      const avgX = sumX / cluster.pts.length;
      const avgY = sumY / cluster.pts.length;
      const maxClusterRadius = Math.max(95, 165 * transform.k);
      const corePts = cluster.pts.filter(
        ([x, y]) => Math.hypot(x - avgX, y - avgY) <= maxClusterRadius
      );
      const activePts = corePts.length > 0 ? corePts : cluster.pts;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let cSumX = 0;
      let cSumY = 0;
      for (const [x, y] of activePts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        cSumX += x;
        cSumY += y;
      }
      const cx = cSumX / activePts.length;
      const cy = cSumY / activePts.length;

      // Estimated screen-space width of this nation's territory cluster
      const singleProvRadius = (isMobileViewport ? 22 : 28) * transform.k;
      const spanW = Math.max(
        singleProvRadius * 1.6,
        maxX - minX + singleProvRadius * 1.4
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
      const isAtWarWithPlayer = Boolean(
        isAtWar(wars, playerNationId, nationId)
      );

      // Proportional font size that scales DOWN smoothly when zoomed out
      const maxFontCap = isMobileViewport ? 12.5 : 14.5;
      const zoomFactor = Math.max(0.45, Math.min(1.35, transform.k * 0.78));
      let fontSize = Math.min(
        maxFontCap,
        (6.4 + Math.sqrt(activePts.length) * 1.45) * zoomFactor
      );

      let displayLabel =
        transform.k < 0.95 || spanW < 95
          ? shortName.toLocaleUpperCase('tr-TR')
          : rawName.toLocaleUpperCase('tr-TR');

      ctx.save();
      ctx.font = `700 ${fontSize.toFixed(1)}px "Cinzel", "Georgia", serif`;
      let measuredW = ctx.measureText(displayLabel).width;

      // If full name is wider than the country's on-screen span, switch to short name first
      const maxAllowedW = Math.max(isPlayer ? 56 : 44, spanW * 1.22);
      if (measuredW > maxAllowedW && displayLabel !== shortName.toLocaleUpperCase('tr-TR')) {
        displayLabel = shortName.toLocaleUpperCase('tr-TR');
        measuredW = ctx.measureText(displayLabel).width;
      }

      // Shrink font size proportionally so the label fits inside the nation's screen footprint
      if (measuredW > maxAllowedW && measuredW > 0) {
        fontSize = Math.max(5.8, fontSize * (maxAllowedW / measuredW));
        ctx.font = `700 ${fontSize.toFixed(1)}px "Cinzel", "Georgia", serif`;
        measuredW = ctx.measureText(displayLabel).width;
      }

      // Skip tiny unreadable labels when deeply zoomed out
      if (fontSize < (isPlayer ? 6.0 : 6.4)) {
        ctx.restore();
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
        ctx.restore();
        continue;
      }
      placedBoxes.push(nationBox);

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
        : 'rgba(245, 238, 220, 0.88)';
      ctx.fillText(displayLabel, cx, cy);
      ctx.restore();
    }
  }

  for (const t of sortedForLabels) {
    const pt = projection(t.centroid);
    if (!pt) continue;
    const sx = pt[0] * transform.k + transform.x;
    const sy = pt[1] * transform.k + transform.y;

    if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) {
      continue;
    }

    const isSelected = t.id === selectedTerritoryId;
    const isPlayerTerritory = t.ownerId === playerNationId;
    const isEnemy =
      !isPlayerTerritory && Boolean(isAtWar(wars, playerNationId, t.ownerId));
    const rel = !isPlayerTerritory
      ? getOrCreateRelation(relations, playerNationId, t.ownerId)
      : null;
    const owner = nations[t.ownerId];
    const isAlliedOrVassal =
      !isPlayerTerritory &&
      (Boolean(rel?.isAllied) ||
        Boolean(rel?.allianceType) ||
        owner?.vassalOf === playerNationId ||
        nations[playerNationId]?.vassalOf === t.ownerId);

    const isCapital = Boolean(t.isCapital || t.id === t.ownerId);
    const hasIntel = !fogOfWarEnabled || visibleTerritoryIds.has(t.id);

    // 1. Province / City Name Label (Only pure city names, no old dynasty/country prefixes)
    const wantsName =
      isSelected ||
      (isCapital && transform.k >= labelThresholds.capitalNameMinZoom) ||
      transform.k >= labelThresholds.provinceNameMinZoom;

    let namePlaced = false;
    if (wantsName && !battleTerritorySet.has(t.id)) {
      const { lines } = formatProvinceMapLabel(
        t.name,
        isCapital,
        isSelected,
        transform.k,
        isMobileViewport
      );

      const mobileScale = isMobileViewport ? 0.87 : 1.0;
      const fontSize =
        (isSelected
          ? 10.2
          : isCapital
          ? Math.min(10.4, Math.max(7.8, 7.4 + Math.min(12, transform.k) * 0.22))
          : Math.min(9.2, Math.max(7.1, 6.7 + Math.min(12, transform.k) * 0.19))) *
        mobileScale;
      ctx.font = `${isCapital || isSelected ? '700' : '600'} ${fontSize.toFixed(1)}px "Plus Jakarta Sans", system-ui, sans-serif`;

      const lineHeight = fontSize + 1.8;
      const widestLine = lines.reduce((maxW, ln) => {
        const mW = ctx.measureText(ln).width;
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

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = isSelected ? 2.7 : 2.25;
        ctx.strokeStyle = 'rgba(2, 6, 20, 0.94)';
        ctx.fillStyle = isSelected
          ? '#FDE68A'
          : isPlayerTerritory
          ? '#E2FBE8'
          : isEnemy
          ? '#FECDD3'
          : isCapital
          ? '#FEF3C7'
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

    // 1B. AoH3 Real-Time Siege Widget on Map (ONLY shown if player or player's allies/vassals are involved!)
    const canSeeSiege =
      Boolean(t.siege) &&
      (isPlayerTerritory ||
        isAlliedOrVassal ||
        isNationPlayerOrAlly(t.siege?.attackerId, playerNationId, nations, relations) ||
        isNationPlayerOrAlly(t.siege?.defenderId, playerNationId, nations, relations));

    if (t.siege && canSeeSiege && !battleTerritorySet.has(t.id)) {
      const siege = t.siege;
      const siegeAttacker = nations[siege.attackerId];
      const siegeBadgeY = namePlaced ? sy + 8 : sy;
      const siegeW = 86;
      const siegeH = 21;
      const sBox: PlacedBox = {
        x1: sx - siegeW / 2 - 2,
        y1: siegeBadgeY - siegeH / 2 - 2,
        x2: sx + siegeW / 2 + 2,
        y2: siegeBadgeY + siegeH / 2 + 2,
      };

      if (isSelected || !collides(sBox)) {
        placedBoxes.push(sBox);
        const bx = sx - siegeW / 2;
        const by = siegeBadgeY - siegeH / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, siegeW, siegeH, 4);
        ctx.fill();
        ctx.stroke();

        drawNationFlagOnCanvas(
          ctx,
          bx + 1.5,
          by + 1.5,
          22,
          siegeH - 3,
          siege.attackerId,
          (siegeAttacker?.flagCode || 'ORD').slice(0, 3),
          siegeAttacker?.color || '#DC2626'
        );

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(
          `%${Math.round(siege.progress)}`,
          bx + 23 + (siegeW - 23) / 2,
          siegeBadgeY - 1
        );

        const progW = ((siegeW - 25) * Math.min(100, siege.progress)) / 100;
        ctx.fillStyle = '#F87171';
        ctx.fillRect(bx + 23, by + siegeH - 3, progW, 2);
      }
    }

    // 1C. Compact Resource Icon & Investment Value Badge (in RESOURCES or ECONOMIC MapMode)
    const isResourceOrEcoLens =
      mapMode === 'RESOURCES' || mapMode === 'ECONOMIC';
    if (isResourceOrEcoLens && !battleTerritorySet.has(t.id) && !canSeeSiege) {
      const resMeta = RESOURCE_INFO[t.resource] || RESOURCE_INFO.TAHIL;
      const dev = calculateProvinceDevelopment(t, owner);
      const showResourceBadge =
        isSelected ||
        isPlayerTerritory ||
        isCapital ||
        transform.k >= (isMobileViewport ? 1.15 : 1.05);

      if (showResourceBadge) {
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

        ctx.save();
        const fontPx = isSelected ? 10 : transform.k >= 1.8 ? 9.2 : 8.4;
        ctx.font = `700 ${fontPx}px "JetBrains Mono", "Plus Jakarta Sans", sans-serif`;
        const textW = ctx.measureText(pillText).width;
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
        }
        ctx.restore();
      }
    }

    // 2. Clean AoH3-Style Army Counter Plate (Graphical National Flag + Pure Troop Number, NO tiny soldier icons)
    const garrison = t.garrison || 0;
    const wantsArmyShield =
      !isResourceOrEcoLens &&
      !battleTerritorySet.has(t.id) &&
      !canSeeSiege &&
      (isSelected ||
        (hasIntel &&
          garrison >= 500 &&
          (mapMode === 'MILITARY' ||
            (isPlayerTerritory && transform.k >= 1.0) ||
            (isEnemy && transform.k >= 1.0) ||
            (isAlliedOrVassal &&
              (isCapital || garrison >= 5000) &&
              transform.k >= 1.15) ||
            (isCapital && transform.k >= 1.35) ||
            (garrison >= 6000 && transform.k >= 1.55) ||
            transform.k >= (isMobileViewport ? 2.0 : 1.8))));

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
