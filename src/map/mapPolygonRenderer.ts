import { GeoProjection } from 'd3-geo';
import { IDEOLOGIES, RESOURCE_INFO } from '../data/world2026Data';
import {
  CULTURES,
  RELIGIONS,
  resolveTerritoryCulture,
  resolveTerritoryReligion,
} from '../data/religionAndCultureData';
import { TERRAIN_INFO } from '../engine/pashaAndFiefEngine';
import {
  calculateProvinceDevelopment,
  isAtWar,
} from '../engine/simulationEngine';
import {
  evaluateActiveStraits,
  TRADE_CORRIDORS,
} from '../engine/straitsAndTradeEngine';
import {
  GeoCountryFeature,
  isTerritoryCoastal,
  relationKey,
} from '../engine/worldBuilder';
import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  MapMode,
  Nation,
  SeaArmy,
  Territory,
} from '../types/game';
import { ClassifiedBorderMap } from './borderClassifier';
import { MapGeometryCache } from './spatialIndex';
import { drawNationFlagOnCanvas } from './nationFlagRenderer';

/** Deterministic 0..1 hash so each province keeps its shade between frames. */
function hashStringToUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 999;
}

function shadeHexColor(hex: string, factor: number): string {
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return hex;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 255) * factor);
  const g = clamp(((num >> 8) & 255) * factor);
  const b = clamp((num & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * AoH3 paints every province with a slightly different brush stroke of the same
 * country colour. A deterministic ±5% brightness keeps a realm readable while
 * making internal borders visible on their own.
 */
function provinceTint(ownerColor: string, territoryId: string): string {
  return shadeHexColor(ownerColor, 0.98 + hashStringToUnit(territoryId) * 0.04);
}

export function resolveTerritoryFillColor(params: {
  territory: Territory;
  mapMode: MapMode;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  playerNationId: string;
  selectedTerritoryId: string | null;
}): string {
  const {
    territory: t,
    mapMode,
    nations,
    territories,
    relations,
    wars,
    playerNationId,
    selectedTerritoryId,
  } = params;

  const owner = nations[t.ownerId];
  if (!owner) return '#334155';

  if (mapMode === 'POLITICAL') return provinceTint(owner.color, t.id);
  if (mapMode === 'TERRAIN') {
    return TERRAIN_INFO[t.terrain || 'OVA']?.color || '#4ADE80';
  }

  if (mapMode === 'DIPLOMATIC') {
    const refId = selectedTerritoryId
      ? territories[selectedTerritoryId]?.ownerId || playerNationId
      : playerNationId;

    if (t.ownerId === refId) return '#2563EB';
    if (isAtWar(wars, refId, t.ownerId)) return '#DC2626';
    const rel = relations[relationKey(refId, t.ownerId)];
    if (rel?.allianceType === 'OFFENSIVE') return '#10B981';
    if (rel?.allianceType === 'DEFENSIVE') return '#0284C7';
    if (rel?.isAllied) return '#10B981';
    if (rel?.hasTradeAgreement || (rel?.score ?? 0) >= 35) return '#34D399';
    if (rel?.hasEmbargo || (rel?.score ?? 0) <= -35) return '#F97316';
    return '#475569';
  }

  if (mapMode === 'ECONOMIC') {
    // Progressive darkening emerald gradient: more developed cities have visibly darker/richer green tones
    const dev = calculateProvinceDevelopment(t, owner);
    const score = dev.developmentScore;
    if (score >= 88 || dev.effectiveDailyGdp >= 340) return '#042F2E'; // En Koyu Zümrüt (İmparatorluk Metropolü)
    if (score >= 70 || dev.effectiveDailyGdp >= 245) return '#064E3B'; // Çok Koyu Yeşil (Kalkınmış Sanayi Şehri)
    if (score >= 54 || dev.effectiveDailyGdp >= 175) return '#047857'; // Koyu Zümrüt (Gelişen Ticaret Sancağı)
    if (score >= 40 || dev.effectiveDailyGdp >= 120) return '#059669'; // Orta Zümrüt (Orta Ölçekli Eyalet)
    if (score >= 28 || dev.effectiveDailyGdp >= 80) return '#10B981';  // Canlı Yeşil
    if (score >= 20) return '#6EE7B7';                                 // Açık Nane Yeşili (Az Gelişmiş)
    return '#94A3B8';                                                  // Kırsal / Yatırımsız Taşra
  }

  if (mapMode === 'RESOURCES') {
    return RESOURCE_INFO[t.resource]?.color || '#10B981';
  }

  if (mapMode === 'IDEOLOGY') {
    return IDEOLOGIES[owner.ideology]?.color || '#64748B';
  }

  if (mapMode === 'MILITARY') {
    if (t.garrison >= 80000) return '#991B1B';
    if (t.garrison >= 45000) return '#DC2626';
    if (t.garrison >= 25000) return '#F97316';
    if (t.garrison >= 12000) return '#F59E0B';
    return '#475569';
  }

  if (mapMode === 'RELIGION') {
    const relId = resolveTerritoryReligion(t, owner);
    return RELIGIONS[relId]?.color || '#059669';
  }

  if (mapMode === 'CULTURE') {
    const culId = resolveTerritoryCulture(t, owner);
    return CULTURES[culId]?.color || '#DC2626';
  }

  if (mapMode === 'ASSIMILATION') {
    const isCore = t.coreOwnerId === t.ownerId || (t.assimilation ?? 100) >= 100;
    if (isCore) return '#10B981'; // 100% Core & Entegre
    if (t.isAssimilating) return '#F59E0B'; // Asimilasyon devam ediyor
    return '#EF4444'; // Gayri-Milli / İsyan Riski
  }

  return owner.color;
}

export function renderOceanAndPolygons(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  transform: { k: number; x: number; y: number };
  cache: MapGeometryCache;
  visibleFeatures: GeoCountryFeature[];
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  projection: GeoProjection;
  mapMode: MapMode;
  playerNationId: string;
  selectedTerritoryId: string | null;
  multiSelectedTerritoryIds?: string[];
  armyOrderSourceId: string | null;
  fogOfWarEnabled: boolean;
  visibleTerritoryIds: Set<string>;
  classifiedBorders?: ClassifiedBorderMap | null;
  borderThicknessMultiplier?: number;
}): void {
  const {
    ctx,
    width,
    height,
    transform,
    cache,
    visibleFeatures,
    territories,
    nations,
    relations,
    wars,
    movements,
    projection,
    mapMode,
    playerNationId,
    selectedTerritoryId,
    multiSelectedTerritoryIds = [],
    armyOrderSourceId,
    fogOfWarEnabled,
    visibleTerritoryIds,
    classifiedBorders,
    borderThicknessMultiplier = 1.0,
  } = params;

  // 1. Sapphire & Deep Azure Ocean Background (Screen Space)
  const oceanGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    30,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.85
  );
  oceanGrad.addColorStop(0, '#14497D');
  oceanGrad.addColorStop(0.55, '#0D335B');
  oceanGrad.addColorStop(1, '#071B34');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Enter World Space
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // 1B. Projected Globe Basin & Graticule Grid
  if (cache.spherePath) {
    const globeWaterGrad = ctx.createLinearGradient(0, 0, 0, height);
    globeWaterGrad.addColorStop(0, '#0E3966');
    globeWaterGrad.addColorStop(0.5, '#154D85');
    globeWaterGrad.addColorStop(1, '#0C3159');
    ctx.fillStyle = globeWaterGrad;
    ctx.fill(cache.spherePath);

    ctx.lineWidth = 1.4 / transform.k;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.stroke(cache.spherePath);
  }

  if (cache.graticulePath) {
    ctx.lineWidth = 0.55 / transform.k;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.08)';
    ctx.stroke(cache.graticulePath);
  }

  const _unusedOrderId = armyOrderSourceId;
  void _unusedOrderId;

  const zoomBorderScale =
    Math.min(1.85, 1.0 + Math.log2(Math.max(1, transform.k)) * 0.3) *
    borderThicknessMultiplier;

  // Precompute active war enemies once per render instead of O(W) scan per province
  const warEnemySet = new Set<string>();
  for (const w of wars) {
    if (w.attackers.includes(playerNationId)) {
      for (const id of w.defenders) warEnemySet.add(id);
    } else if (w.defenders.includes(playerNationId)) {
      for (const id of w.attackers) warEnemySet.add(id);
    }
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const seamLineW = 1 / transform.k;

  // 2. Render RBush-culled visible province polygons (Streamlined single-pass border for 60 FPS)
  for (const feat of visibleFeatures) {
    const t = territories[feat.id];
    const path2d = cache.paths[feat.id];
    if (!t || !path2d) continue;

    const isSelected = selectedTerritoryId === t.id;
    const isPlayerOwned = t.ownerId === playerNationId;
    const hasIntel = !fogOfWarEnabled || visibleTerritoryIds.has(t.id);
    const isEnemyTerritory =
      t.ownerId !== playerNationId && warEnemySet.has(t.ownerId);

    const fillColor = resolveTerritoryFillColor({
      territory: t,
      mapMode,
      nations,
      territories,
      relations,
      wars,
      playerNationId,
      selectedTerritoryId,
    });
    ctx.fillStyle = fillColor;
    // AoH3 land is opaque: letting the ocean tint through turned every country
    // muddy and made the hairline cracks between subdivided provinces obvious.
    ctx.globalAlpha = hasIntel ? 1 : 0.55;
    ctx.fill(path2d);

    // Seal the sub-pixel seams between adjacent provinces by dilating each fill
    // by half a screen pixel in its own colour before any border is drawn.
    if (hasIntel) {
      ctx.lineWidth = seamLineW;
      ctx.strokeStyle = fillColor;
      ctx.stroke(path2d);
    }

    // AoH3 Diagonal Occupation Stripes across occupied territories
    if (t.isOccupied && t.occupiedById && t.occupiedById !== t.ownerId) {
      const occupant = nations[t.occupiedById];
      const occColor = occupant?.color || '#DC2626';
      ctx.save();
      ctx.clip(path2d);
      ctx.strokeStyle = occColor;
      const pt = projection(t.centroid);
      const cx = pt ? pt[0] : 0;
      const cy = pt ? pt[1] : 0;
      const span = 140;
      const step = 13 / transform.k;
      ctx.beginPath();
      for (let x = cx - span * 1.5; x < cx + span * 1.5; x += step) {
        ctx.moveTo(x, cy - span);
        ctx.lineTo(x + span, cy + span);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (isSelected) {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
      ctx.fill(path2d);
    } else if (isEnemyTerritory) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.18)';
      ctx.fill(path2d);
    }

    ctx.globalAlpha = 1;

    if (classifiedBorders) {
      // Only accent active enemy-war highlight polygons here;
      // actual sovereign/internal/coastal borders render in clean dedicated passes below.
      if (isEnemyTerritory) {
        ctx.lineWidth = (1.35 * zoomBorderScale) / transform.k;
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.72)';
        ctx.stroke(path2d);
      }
    } else {
      // Fallback single-pass border when classified edge cache is unavailable
      const hasForeignNeighbor = t.neighbors.some((nId) => {
        const n = territories[nId];
        return n && n.ownerId !== t.ownerId;
      });
      const isExternalBorder = hasForeignNeighbor || isEnemyTerritory;
      ctx.lineWidth =
        ((isEnemyTerritory
          ? 1.45
          : isExternalBorder
          ? 1.25
          : 0.65) *
          zoomBorderScale) /
        transform.k;
      ctx.strokeStyle = isEnemyTerritory
        ? '#F87171'
        : isExternalBorder
        ? isPlayerOwned
          ? 'rgba(254, 243, 199, 0.6)'
          : 'rgba(2, 6, 23, 0.95)'
        : isPlayerOwned
        ? 'rgba(254, 243, 199, 0.25)'
        : 'rgba(15, 23, 42, 0.55)';
      ctx.stroke(path2d);
    }
  }

  // 2A. Cartographic Multi-Layer Borders (RBush Viewport-Culled for instant 60 FPS even at 28x zoom)
  if (classifiedBorders) {
    ctx.save();
    // Connected polylines + round joins: beveled joins used to leave a visible
    // notch at every polygon vertex, which read as a "broken" border.
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Layer 1: Hairline internal province/sancak boundaries (skipped below 1.35x where sub-pixel)
    if (transform.k >= 1.35) {
      ctx.lineWidth = (0.5 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = 'rgba(7, 13, 24, 0.15)';
      for (const feat of visibleFeatures) {
        const b = classifiedBorders.get(feat.id);
        if (b?.internal) ctx.stroke(b.internal);
      }
    }

    // Layer 2: Shoreline — soft halo (when >=1.15x) + crisp dark rim
    if (transform.k >= 1.15) {
      ctx.lineWidth = (3 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = 'rgba(6, 22, 42, 0.22)';
      for (const feat of visibleFeatures) {
        const b = classifiedBorders.get(feat.id);
        if (b?.coastline) ctx.stroke(b.coastline);
      }
    }

    ctx.lineWidth = (1.15 * zoomBorderScale) / transform.k;
    ctx.strokeStyle = 'rgba(4, 15, 31, 0.9)';
    for (const feat of visibleFeatures) {
      const b = classifiedBorders.get(feat.id);
      if (b?.coastline) ctx.stroke(b.coastline);
    }

    // Layer 3: Sovereign frontiers — soft dark halo, crisp core, faint inner light.
    if (transform.k >= 1.15) {
      ctx.lineWidth = (4.2 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = 'rgba(3, 7, 16, 0.13)';
      for (const feat of visibleFeatures) {
        const b = classifiedBorders.get(feat.id);
        if (b?.international) ctx.stroke(b.international);
      }
    }

    ctx.lineWidth = (2.15 * zoomBorderScale) / transform.k;
    ctx.strokeStyle = 'rgba(3, 7, 16, 0.86)';
    for (const feat of visibleFeatures) {
      const b = classifiedBorders.get(feat.id);
      if (b?.international) ctx.stroke(b.international);
    }

    if (transform.k >= 1.45) {
      ctx.lineWidth = (0.6 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = 'rgba(250, 240, 216, 0.08)';
      for (const feat of visibleFeatures) {
        const b = classifiedBorders.get(feat.id);
        if (b?.international) ctx.stroke(b.international);
      }
    }

    // Layer 4: Royal golden frontier accent around the player's empire
    ctx.lineWidth = (1.2 * zoomBorderScale) / transform.k;
    ctx.strokeStyle = 'rgba(246, 200, 100, 0.5)';
    for (const feat of visibleFeatures) {
      const b = classifiedBorders.get(feat.id);
      if (b?.playerFrontier) ctx.stroke(b.playerFrontier);
    }

    ctx.restore();
  }

  // 2b. Dedicated Top-Pass for Selected Province & Batch Multi-Selected Provinces
  if (multiSelectedTerritoryIds.length > 0) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const mId of multiSelectedTerritoryIds) {
      const mPath = cache.paths[mId];
      if (!mPath) continue;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.fill(mPath);
      ctx.lineWidth = (2.8 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.stroke(mPath);
      ctx.lineWidth = (1.75 * zoomBorderScale) / transform.k;
      ctx.strokeStyle = '#38BDF8';
      ctx.stroke(mPath);
    }
    ctx.restore();
  }

  if (selectedTerritoryId && cache.paths[selectedTerritoryId]) {
    const selPath = cache.paths[selectedTerritoryId];
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = (3.2 * zoomBorderScale) / transform.k;
    ctx.strokeStyle = 'rgba(4, 10, 22, 0.96)';
    ctx.stroke(selPath);
    ctx.lineWidth = (2.15 * zoomBorderScale) / transform.k;
    ctx.strokeStyle = '#FBBF24';
    ctx.stroke(selPath);
    ctx.restore();
  }

  // 2c. Strategic Straits (⚓) & Silk Road / Maritime Trade Corridors
  if (mapMode === 'ECONOMIC' || transform.k >= 2.15) {
    const activeStraits = evaluateActiveStraits(territories, wars);

    if (mapMode === 'ECONOMIC') {
      const caravanPhase = (Date.now() / 3400) % 1;
      TRADE_CORRIDORS.forEach((corr, cIdx) => {
        const pts: [number, number][] = [];
        for (const hId of corr.hubIds) {
          const hTerr = territories[hId];
          if (!hTerr) continue;
          const pt = projection(hTerr.centroid);
          if (pt) pts.push(pt);
        }
        if (pts.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([5 / transform.k, 4 / transform.k]);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          if (Math.abs(pts[i][0] - pts[i - 1][0]) > width * 0.45) {
            ctx.moveTo(pts[i][0], pts[i][1]);
          } else {
            ctx.lineTo(pts[i][0], pts[i][1]);
          }
        }
        ctx.lineWidth = 2.1 / transform.k;
        ctx.strokeStyle = corr.color;
        ctx.globalAlpha = 0.78;
        ctx.stroke();
        ctx.setLineDash([]);

        for (let i = 0; i < pts.length - 1; i++) {
          if (Math.abs(pts[i + 1][0] - pts[i][0]) > width * 0.45) continue;
          const segPhase = (caravanPhase + i * 0.27 + cIdx * 0.13) % 1;
          const cx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * segPhase;
          const cy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * segPhase;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.1 / transform.k, 0, Math.PI * 2);
          ctx.fillStyle = '#FEF08A';
          ctx.fill();
          ctx.lineWidth = 1.0 / transform.k;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // Draw Anchor Medallions on Active Straits
    activeStraits.forEach((st) => {
      const anchorPt = projection(st.def.anchorCoord);
      if (!anchorPt) return;

      const playerControls = (st.ownerTollShares[playerNationId] || 0) > 0;
      const radius = (mapMode === 'ECONOMIC' ? 8.5 : 6.8) / transform.k;

      ctx.save();
      ctx.beginPath();
      ctx.arc(anchorPt[0], anchorPt[1], radius, 0, Math.PI * 2);
      ctx.fillStyle = st.isContestedByWar
        ? 'rgba(127, 29, 29, 0.92)'
        : playerControls
        ? 'rgba(6, 78, 59, 0.92)'
        : 'rgba(15, 23, 42, 0.88)';
      ctx.fill();
      ctx.lineWidth = 1.4 / transform.k;
      ctx.strokeStyle = st.isContestedByWar
        ? '#F87171'
        : playerControls
        ? '#FBBF24'
        : '#38BDF8';
      ctx.stroke();

      ctx.font = `700 ${(mapMode === 'ECONOMIC' ? 9.5 : 8.0) / transform.k}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = playerControls ? '#FDE68A' : '#E0F2FE';
      ctx.fillText('⚓', anchorPt[0], anchorPt[1]);
      ctx.restore();
    });
  }

  // Exit World Space back to crisp Screen Space
  ctx.restore();
}

/**
 * Lightweight Dynamic Layer for Active Army Movements.
 * Runs in <0.2ms on top of the cached base polygon canvas so AI & Player army movements run at locked 60 FPS!
 */
export function renderArmyMovementsLayer(params: {
  ctx: CanvasRenderingContext2D;
  transform: { k: number; x: number; y: number };
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations?: Record<string, DiplomaticRelation>;
  movements: ArmyMovement[];
  projection: GeoProjection;
  playerNationId: string;
  fogOfWarEnabled: boolean;
  visibleTerritoryIds: Set<string>;
  interpolatedProgress?: Record<string, number>;
  animPhaseOverride?: number;
}): void {
  const {
    ctx,
    transform,
    territories,
    nations,
    relations = {},
    movements,
    projection,
    playerNationId,
    fogOfWarEnabled,
    visibleTerritoryIds,
    interpolatedProgress,
  } = params;

  if (movements.length === 0) return;

  const isPlayerOrAlly = (nationId: string | undefined): boolean => {
    if (!nationId) return false;
    if (nationId === playerNationId) return true;
    const rel = relations[relationKey(playerNationId, nationId)];
    if (rel?.isAllied || Boolean(rel?.allianceType)) return true;
    const nat = nations[nationId];
    const playerNat = nations[playerNationId];
    return Boolean(
      nat?.vassalOf === playerNationId || playerNat?.vassalOf === nationId
    );
  };

  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  movements.forEach((mv) => {
    const fromT = territories[mv.fromTerritoryId];
    const toT = territories[mv.toTerritoryId];
    if (!mv.fromCoords && !fromT) return;
    if (!mv.toCoords && !toT) return;

    // Hide distant war movements between non-allied foreign nations
    const involvesPlayerOrAlly =
      isPlayerOrAlly(mv.ownerId) ||
      isPlayerOrAlly(fromT?.ownerId) ||
      isPlayerOrAlly(toT?.ownerId);

    if (!involvesPlayerOrAlly) {
      return;
    }

    if (
      fogOfWarEnabled &&
      mv.ownerId !== playerNationId &&
      !mv.isNaval &&
      !visibleTerritoryIds.has(mv.fromTerritoryId) &&
      !visibleTerritoryIds.has(mv.toTerritoryId)
    ) {
      return;
    }

    const p1 = mv.fromCoords
      ? projection(mv.fromCoords)
      : fromT
      ? projection(fromT.centroid)
      : null;
    const p2 = mv.toCoords
      ? projection(mv.toCoords)
      : toT
      ? projection(toT.centroid)
      : null;
    if (!p1 || !p2) return;

    const displayProgress = Math.max(
      0,
      Math.min(100, interpolatedProgress?.[mv.id] ?? mv.progress)
    );
    const curX = p1[0] + (p2[0] - p1[0]) * (displayProgress / 100);
    const curY = p1[1] + (p2[1] - p1[1]) * (displayProgress / 100);
    const isPlayerArmy = mv.ownerId === playerNationId;
    const mvOwner = nations[mv.ownerId];

    // Draw remaining multi-hop A* routeQueue trajectory ahead of current leg!
    if (mv.routeQueue && mv.routeQueue.length > 0) {
      ctx.save();
      ctx.setLineDash([4 / transform.k, 3 / transform.k]);
      ctx.beginPath();
      ctx.moveTo(p2[0], p2[1]);
      let prevPt: [number, number] | null = p2;
      for (const hopId of mv.routeQueue) {
        const hopT = territories[hopId];
        const hopPt = hopT ? projection(hopT.centroid) : null;
        if (hopPt && prevPt) {
          ctx.lineTo(hopPt[0], hopPt[1]);
          prevPt = hopPt;
        }
      }
      ctx.lineWidth = 2.0 / transform.k;
      ctx.strokeStyle = mv.isAttack
        ? 'rgba(248, 113, 113, 0.9)'
        : isPlayerArmy
        ? 'rgba(52, 211, 153, 0.9)'
        : 'rgba(56, 189, 248, 0.85)';
      ctx.stroke();
      ctx.restore();
    }

    // Main marching vector line
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineWidth = 2.8 / transform.k;
    ctx.strokeStyle = mv.isAttack
      ? '#EF4444'
      : isPlayerArmy
      ? '#10B981'
      : '#38BDF8';
    ctx.stroke();

    // Directional Arrowhead at target end of current leg
    const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const headLen = 7.5 / transform.k;
    const midX = p1[0] + (p2[0] - p1[0]) * 0.72;
    const midY = p1[1] + (p2[1] - p1[1]) * 0.72;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(
      midX - headLen * Math.cos(angle - Math.PI / 6),
      midY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      midX - headLen * Math.cos(angle + Math.PI / 6),
      midY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = mv.isAttack
      ? '#F87171'
      : isPlayerArmy
      ? '#34D399'
      : '#38BDF8';
    ctx.fill();

    // Clean AoH3-Style Floating Marching Counter Plate at (curX, curY)
    ctx.save();
    ctx.translate(curX, curY);
    ctx.scale(1 / transform.k, 1 / transform.k);

    const troopLabel = `${(mv.troops / 1000).toFixed(1)}B`;
    const flagStr = (mvOwner?.flagCode || 'ORD').slice(0, 3);
    const pillW = 62;
    const pillH = 19;

    // Pill background (crisp dark body, no outer glow halo or gold frame)
    ctx.fillStyle = mv.isAttack
      ? 'rgba(80, 18, 24, 0.96)'
      : isPlayerArmy
      ? 'rgba(15, 34, 28, 0.96)'
      : 'rgba(18, 22, 30, 0.95)';
    ctx.strokeStyle = mv.isAttack
      ? '#F87171'
      : isPlayerArmy
      ? 'rgba(110, 231, 183, 0.72)'
      : '#38BDF8';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 3.5);
    ctx.fill();
    ctx.stroke();

    // Graphical National Flag on Left of Marching Pill
    drawNationFlagOnCanvas(
      ctx,
      -pillW / 2 + 1.5,
      -pillH / 2 + 1.5,
      22,
      pillH - 3,
      mv.ownerId,
      flagStr,
      mvOwner?.color || '#183222'
    );

    // Troop count on right
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(troopLabel, 10, -1);

    // 5. Live Progress bar at bottom of moving army pill
    const progW = Math.max(
      2,
      ((pillW - 26) * Math.min(100, displayProgress)) / 100
    );
    ctx.fillStyle = mv.isAttack
      ? '#FB7185'
      : mv.isNaval
      ? '#38BDF8'
      : '#34D399';
    ctx.fillRect(-pillW / 2 + 24, pillH / 2 - 3, progW, 2);

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Renders armies stationed on open sea (SeaArmies / Naval Fleets) with a crisp ship silhouette,
 * nation flag, and troop count badge directly on the ocean canvas.
 */
export function renderSeaArmiesLayer(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  transform: { k: number; x: number; y: number };
  seaArmies: SeaArmy[];
  territories?: Record<string, Territory>;
  nations: Record<string, Nation>;
  wars: ActiveWar[];
  projection: GeoProjection;
  playerNationId: string;
  selectedSeaArmyId: string | null;
}): void {
  const {
    ctx,
    width,
    height,
    transform,
    seaArmies,
    territories,
    nations,
    wars,
    projection,
    playerNationId,
    selectedSeaArmyId,
  } = params;

  if (!seaArmies || seaArmies.length === 0) return;

  const allTerritories = territories ? Object.values(territories) : [];

  for (const fleet of seaArmies) {
    const pt = projection(fleet.coords);
    if (!pt) continue;
    const sx = pt[0] * transform.k + transform.x;
    const sy = pt[1] * transform.k + transform.y;
    if (sx < -60 || sx > width + 60 || sy < -60 || sy > height + 60) continue;

    const owner = nations[fleet.ownerId];
    const isPlayer = fleet.ownerId === playerNationId;
    const isSelected = fleet.id === selectedSeaArmyId;
    const isEnemy =
      !isPlayer &&
      Boolean(isAtWar(wars, playerNationId, fleet.ownerId));

    // Check active coastal naval blockades (fleet >= 2,000 troops within 4.5° of hostile coastal city)
    const blockadedPorts: Array<{ tx: number; ty: number }> = [];
    if (fleet.troops >= 2000 && allTerritories.length > 0 && wars.length > 0) {
      for (const t of allTerritories) {
        if (t.ownerId === fleet.ownerId) continue;
        if (!(t.isCoastal || isTerritoryCoastal(t))) continue;
        if (!isAtWar(wars, fleet.ownerId, t.ownerId)) continue;
        const dxDeg = t.centroid[0] - fleet.coords[0];
        const dyDeg = t.centroid[1] - fleet.coords[1];
        if (dxDeg * dxDeg + dyDeg * dyDeg <= 4.5 * 4.5) {
          const tPt = projection(t.centroid);
          if (tPt) {
            blockadedPorts.push({
              tx: tPt[0] * transform.k + transform.x,
              ty: tPt[1] * transform.k + transform.y,
            });
          }
        }
      }
    }

    const isBlockading = blockadedPorts.length > 0;

    if (isBlockading) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isPlayer
        ? 'rgba(251, 191, 36, 0.78)'
        : 'rgba(248, 113, 113, 0.82)';
      for (const port of blockadedPorts) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(port.tx, port.ty);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(port.tx, port.ty, 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.88)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([5, 4]);
      }
      ctx.restore();
    }

    const troopStr =
      fleet.troops >= 1000
        ? `${(fleet.troops / 1000).toFixed(1)}B`
        : `${Math.round(fleet.troops)}`;
    const badgeW = 72;
    const badgeH = 22;
    const bx = sx - badgeW / 2;
    const by = sy - badgeH / 2;

    ctx.save();

    // Subtle ocean ripple ring around anchored fleet
    ctx.beginPath();
    ctx.ellipse(sx, sy + 11, 22, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected
      ? 'rgba(251, 191, 36, 0.7)'
      : 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = isSelected ? 1.5 : 1.0;
    ctx.stroke();

    // Ship silhouette crest above plate
    ctx.fillStyle = isSelected
      ? '#FDE68A'
      : isPlayer
      ? '#7DD3FC'
      : isEnemy
      ? '#FCA5A5'
      : '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(sx - 9, by - 2);
    ctx.lineTo(sx + 9, by - 2);
    ctx.lineTo(sx + 6, by + 1);
    ctx.lineTo(sx - 6, by + 1);
    ctx.closePath();
    ctx.fill();
    // Sail triangle
    ctx.beginPath();
    ctx.moveTo(sx, by - 10);
    ctx.lineTo(sx + 6, by - 3);
    ctx.lineTo(sx - 4, by - 3);
    ctx.closePath();
    ctx.fill();

    // Main naval counter plate
    ctx.fillStyle = isPlayer
      ? 'rgba(8, 30, 52, 0.96)'
      : isEnemy
      ? 'rgba(76, 18, 28, 0.96)'
      : 'rgba(15, 25, 42, 0.94)';
    ctx.strokeStyle = isSelected
      ? '#FBBF24'
      : isPlayer
      ? '#38BDF8'
      : isEnemy
      ? '#F87171'
      : 'rgba(148, 163, 184, 0.65)';
    ctx.lineWidth = isSelected ? 1.8 : 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, 4.5);
    ctx.fill();
    ctx.stroke();

    // Flag on left
    drawNationFlagOnCanvas(
      ctx,
      bx + 2,
      by + 2,
      22,
      badgeH - 4,
      fleet.ownerId,
      (owner?.flagCode || 'DNZ').slice(0, 3),
      owner?.color || '#0284C7'
    );

    // Divider
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + 2);
    ctx.lineTo(bx + 26, by + badgeH - 2);
    ctx.stroke();

    // Troop count
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isSelected ? '#FEF08A' : '#F0F9FF';
    ctx.fillText(troopStr, bx + 26 + (badgeW - 26) / 2, sy);

    // Compact ABLUKA tag below plate when blockading hostile coastal ports
    if (isBlockading) {
      const tagW = 48;
      const tagH = 12;
      const tx = sx - tagW / 2;
      const ty = by + badgeH + 2;
      ctx.fillStyle = 'rgba(127, 29, 29, 0.94)';
      ctx.strokeStyle = '#F87171';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tagW, tagH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 7.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#FECACA';
      ctx.fillText('ABLUKA', sx, ty + tagH / 2 + 0.5);
    }

    ctx.restore();
  }
}

