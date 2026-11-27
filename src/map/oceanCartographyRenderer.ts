import { GeoProjection } from 'd3-geo';
import { getCalendarMonthForTick } from '../engine/seasonalWeatherEngine';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { GameModeId, MapMode } from '../types/game';
import { ClassifiedBorderMap } from './borderClassifier';
import { MapGeometryCache } from './spatialIndex';

export interface SeaLabelDef {
  id: string;
  name: string;
  coords: [number, number]; // [lon, lat]
  tier: 'OCEAN' | 'SEA';
  angleDeg?: number;
  letterSpacing?: number;
  sizeScale?: number;
}

export interface CompassRoseDef {
  id: string;
  coords: [number, number];
  radiusPx: number;
  withRhumbLines?: boolean;
}

export interface MaritimeLaneDef {
  id: string;
  name: string;
  waypoints: [number, number][];
}

/**
 * Curated open-water labels positioned strictly in water basins so they never
 * clash with dense land cities. Tier 'OCEAN' appears at world view; 'SEA' reveals on zoom.
 */
export const OCEAN_AND_SEA_LABELS: SeaLabelDef[] = [
  // Major Oceans (Tier 1)
  {
    id: 'ocean_atlantic_n',
    name: 'KUZEY ATLAS OKYANUSU',
    coords: [-40, 31],
    tier: 'OCEAN',
    angleDeg: -10,
    letterSpacing: 3.2,
  },
  {
    id: 'ocean_atlantic_s',
    name: 'GÜNEY ATLAS OKYANUSU',
    coords: [-11, -27],
    tier: 'OCEAN',
    angleDeg: 8,
    letterSpacing: 2.6,
    sizeScale: 0.88,
  },
  {
    id: 'ocean_indian',
    name: 'HİNT OKYANUSU',
    coords: [76, -15],
    tier: 'OCEAN',
    angleDeg: -4,
    letterSpacing: 3.4,
  },
  {
    id: 'ocean_pacific_w',
    name: 'PASİFİK OKYANUSU',
    coords: [158, 16],
    tier: 'OCEAN',
    angleDeg: -6,
    letterSpacing: 3.4,
  },
  {
    id: 'ocean_pacific_e',
    name: 'BÜYÜK OKYANUS',
    coords: [-136, -12],
    tier: 'OCEAN',
    angleDeg: 5,
    letterSpacing: 3.2,
  },
  {
    id: 'ocean_arctic',
    name: 'KUZEY BUZ DENİZİ',
    coords: [72, 80.5],
    tier: 'OCEAN',
    angleDeg: 0,
    letterSpacing: 2.4,
    sizeScale: 0.86,
  },

  // Regional Historic & Strategic Seas (Tier 2)
  {
    id: 'sea_mediterranean',
    name: 'AKDENİZ',
    coords: [17.8, 34.3],
    tier: 'SEA',
    angleDeg: -5,
    letterSpacing: 2.2,
    sizeScale: 1.0,
  },
  {
    id: 'sea_black',
    name: 'KARADENİZ',
    coords: [34.1, 43.2],
    tier: 'SEA',
    angleDeg: -2,
    letterSpacing: 1.4,
    sizeScale: 0.86,
  },
  {
    id: 'sea_aegean',
    name: 'EGE',
    coords: [25.1, 38.0],
    tier: 'SEA',
    angleDeg: -10,
    letterSpacing: 0.9,
    sizeScale: 0.64,
  },
  {
    id: 'sea_adriatic',
    name: 'ADRİYATİK',
    coords: [15.8, 42.5],
    tier: 'SEA',
    angleDeg: 35,
    letterSpacing: 0.7,
    sizeScale: 0.62,
  },
  {
    id: 'sea_red',
    name: 'KIZILDENİZ',
    coords: [38.3, 20.6],
    tier: 'SEA',
    angleDeg: 58,
    letterSpacing: 0.8,
    sizeScale: 0.64,
  },
  {
    id: 'sea_persian',
    name: 'BASRA',
    coords: [51.3, 26.8],
    tier: 'SEA',
    angleDeg: 28,
    letterSpacing: 0.8,
    sizeScale: 0.62,
  },
  {
    id: 'sea_caspian',
    name: 'HAZAR',
    coords: [51.0, 41.5],
    tier: 'SEA',
    angleDeg: -74,
    letterSpacing: 0.9,
    sizeScale: 0.68,
  },
  {
    id: 'sea_baltic',
    name: 'BALTIK',
    coords: [19.5, 57.3],
    tier: 'SEA',
    angleDeg: -24,
    letterSpacing: 1.0,
    sizeScale: 0.68,
  },
  {
    id: 'sea_north',
    name: 'KUZEY DENİZİ',
    coords: [3.2, 56.6],
    tier: 'SEA',
    angleDeg: -8,
    letterSpacing: 1.1,
    sizeScale: 0.76,
  },
  {
    id: 'sea_biscay',
    name: 'BİSKAY',
    coords: [-5.4, 45.4],
    tier: 'SEA',
    angleDeg: -8,
    letterSpacing: 0.9,
    sizeScale: 0.7,
  },
  {
    id: 'sea_arabian',
    name: 'ARAP DENİZİ',
    coords: [64.0, 14.5],
    tier: 'SEA',
    angleDeg: -6,
    letterSpacing: 1.9,
    sizeScale: 0.95,
  },
  {
    id: 'sea_bengal',
    name: 'BENGAL KÖRFEZİ',
    coords: [88.5, 13.5],
    tier: 'SEA',
    angleDeg: 0,
    letterSpacing: 1.6,
    sizeScale: 0.9,
  },
  {
    id: 'sea_south_china',
    name: 'GÜNEY ÇİN DENİZİ',
    coords: [114.2, 12.6],
    tier: 'SEA',
    angleDeg: -22,
    letterSpacing: 1.6,
    sizeScale: 0.88,
  },
  {
    id: 'sea_japan',
    name: 'DOĞU DENİZİ',
    coords: [134.8, 39.2],
    tier: 'SEA',
    angleDeg: -34,
    letterSpacing: 1.2,
    sizeScale: 0.78,
  },
  {
    id: 'sea_caribbean',
    name: 'KARAYİP DENİZİ',
    coords: [-75.5, 15.2],
    tier: 'SEA',
    angleDeg: -6,
    letterSpacing: 1.6,
    sizeScale: 0.88,
  },
  {
    id: 'sea_mexico',
    name: 'MEKSİKA KÖRFEZİ',
    coords: [-90.2, 25.1],
    tier: 'SEA',
    angleDeg: 0,
    letterSpacing: 1.3,
    sizeScale: 0.82,
  },
];

/**
 * Three open-ocean cartographic compass roses tucked well away from land masses.
 */
export const COMPASS_ROSES: CompassRoseDef[] = [
  { id: 'rose_atlantic', coords: [-37, 23], radiusPx: 26, withRhumbLines: true },
  { id: 'rose_indian', coords: [75, -24], radiusPx: 22, withRhumbLines: true },
  { id: 'rose_pacific', coords: [-140, 10], radiusPx: 23, withRhumbLines: false },
];

/**
 * Pure open-water maritime lanes connecting major historic & modern straits.
 * Drawn beneath land polygons so they naturally hug coasts without crossing inland.
 */
export const MARITIME_SEA_LANES: MaritimeLaneDef[] = [
  {
    id: 'lane_med_black',
    name: 'Akdeniz – Boğazlar Hattı',
    waypoints: [
      [-6.5, 36.0],
      [2.0, 37.8],
      [12.0, 37.2],
      [21.0, 35.6],
      [25.6, 38.6],
      [29.1, 41.2],
      [33.8, 43.8],
    ],
  },
  {
    id: 'lane_levant_suez',
    name: 'Doğu Akdeniz – İskenderiye Hattı',
    waypoints: [
      [21.0, 35.6],
      [29.8, 33.2],
      [33.4, 34.4],
    ],
  },
  {
    id: 'lane_spice_indian',
    name: 'Kızıldeniz – Hint – Malakka Baharat Yolu',
    waypoints: [
      [34.5, 26.8],
      [42.8, 13.0],
      [54.5, 13.8],
      [68.0, 14.2],
      [77.5, 6.2],
      [92.0, 6.0],
      [101.0, 2.5],
      [109.5, 8.5],
      [118.0, 20.5],
      [128.0, 32.5],
    ],
  },
  {
    id: 'lane_hormuz_arabian',
    name: 'Hürmüz – Arap Denizi Hattı',
    waypoints: [
      [51.2, 26.8],
      [56.4, 26.4],
      [62.0, 21.5],
      [68.0, 14.2],
    ],
  },
  {
    id: 'lane_north_baltic',
    name: 'Manş – Kuzey Denizi – Baltık Hansa Hattı',
    waypoints: [
      [-5.5, 49.0],
      [1.4, 51.0],
      [5.5, 55.2],
      [11.2, 57.6],
      [13.4, 55.3],
      [19.6, 57.4],
      [23.5, 59.8],
    ],
  },
  {
    id: 'lane_atlantic_cape',
    name: 'Atlantik – Ümit Burnu Rotası',
    waypoints: [
      [-9.8, 38.5],
      [-17.2, 27.5],
      [-20.5, 12.0],
      [-8.0, -5.0],
      [8.0, -24.0],
      [19.5, -36.5],
      [44.0, -28.0],
      [62.0, -10.0],
      [77.5, 6.2],
    ],
  },
  {
    id: 'lane_transatlantic',
    name: 'Transatlantik Hat',
    waypoints: [
      [-9.8, 38.5],
      [-28.0, 37.5],
      [-52.0, 28.0],
      [-71.0, 21.0],
      [-83.0, 23.8],
    ],
  },
];

/**
 * Returns 0..1 seasonal Arctic sea-ice opacity for the given calendar month (1..12).
 * Peak winter (Dec-Feb) yields distinct translucent Arctic pack-ice shelves; summer melts completely.
 */
export function getArcticSeaIceIntensity(month: number): number {
  if (month === 12 || month === 1 || month === 2) return 0.24;
  if (month === 11 || month === 3) return 0.13;
  if (month === 4 || month === 10) return 0.05;
  return 0;
}

/**
 * Renders wide-tracked uppercase/italic cartographic text cleanly across all browsers
 * without relying on non-standard canvas letterSpacing support.
 */
function drawSpacedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacingWorld: number
): void {
  if (spacingWorld <= 0.05 || text.length <= 1) {
    ctx.fillText(text, 0, 0);
    return;
  }
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((sum, w) => sum + w, 0) + spacingWorld * (chars.length - 1);
  let cursor = -totalWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    const chW = widths[i];
    ctx.fillText(chars[i], cursor + chW / 2, 0);
    cursor += chW + spacingWorld;
  }
}

function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  invK: number,
  withRhumbLines: boolean,
  alpha: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;

  // Ultra-faint 16-ray portolan rhumb lines extending softly into the ocean basin
  if (withRhumbLines) {
    ctx.strokeStyle = 'rgba(216, 188, 128, 0.16)';
    ctx.lineWidth = 0.55 * invK;
    const rhumbLen = radius * 5.2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i * Math.PI) / 8;
      ctx.moveTo(Math.cos(ang) * radius * 0.85, Math.sin(ang) * radius * 0.85);
      ctx.lineTo(Math.cos(ang) * rhumbLen, Math.sin(ang) * rhumbLen);
    }
    ctx.stroke();
  }

  // Concentric antique atlas rings
  ctx.strokeStyle = 'rgba(222, 194, 134, 0.42)';
  ctx.lineWidth = 0.9 * invK;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(147, 197, 253, 0.24)';
  ctx.lineWidth = 0.6 * invK;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // 4 minor diagonal points
  const minorLen = radius * 0.68;
  const minorBase = radius * 0.14;
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -minorLen);
    ctx.lineTo(minorBase, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(186, 214, 240, 0.34)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -minorLen);
    ctx.lineTo(-minorBase, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 38, 66, 0.45)';
    ctx.fill();
    ctx.restore();
  }

  // 4 cardinal points (two-tone gilded / shadowed needle halves)
  const majorLen = radius * 1.12;
  const majorBase = radius * 0.2;
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -majorLen);
    ctx.lineTo(majorBase, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle =
      i === 0 ? 'rgba(235, 202, 132, 0.68)' : 'rgba(214, 184, 122, 0.50)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -majorLen);
    ctx.lineTo(-majorBase, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12, 31, 56, 0.56)';
    ctx.fill();
    ctx.restore();
  }

  // Center jewel dot
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(235, 202, 132, 0.72)';
  ctx.fill();

  // North indicator "K" (Kuzey)
  ctx.font = `700 ${Math.max(5, radius * 0.36)}px "Cinzel", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(235, 202, 132, 0.72)';
  ctx.fillText('K', 0, -majorLen - 2.5 * invK);

  ctx.restore();
}

function drawReferenceLatitudeLine(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  lat: number,
  color: string,
  lineWidth: number,
  dashed: boolean,
  invK: number
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) {
    ctx.setLineDash([4 * invK, 5 * invK]);
  }
  ctx.beginPath();
  let started = false;
  for (let lon = -180; lon <= 180; lon += 6) {
    const pt = projection([lon, lat]);
    if (!pt) continue;
    if (!started) {
      ctx.moveTo(pt[0], pt[1]);
      started = true;
    } else {
      ctx.lineTo(pt[0], pt[1]);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Renders the upgraded Deep-Atlas Ocean backdrop, cartographic parallels, seasonal Arctic sea ice,
 * portolan compass roses, open-water maritime sea lanes, sea/ocean serif labels, and two-pass
 * coastal bathymetry shelf halos BEFORE land polygons are painted on top.
 *
 * Called inside `baseCanvas` redraws only — zero per-frame animation overhead (60 FPS locked).
 */
export function renderCartographicOceanLayer(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  transform: { k: number; x: number; y: number };
  cache: MapGeometryCache;
  visibleFeatures: GeoCountryFeature[];
  classifiedBorders?: ClassifiedBorderMap | null;
  projection: GeoProjection;
  mapMode: MapMode;
  tick: number;
  gameMode?: GameModeId;
}): void {
  const {
    ctx,
    width,
    height,
    transform,
    cache,
    visibleFeatures,
    classifiedBorders,
    projection,
    mapMode,
    tick,
    gameMode,
  } = params;

  const invK = 1 / Math.max(0.5, transform.k);

  // 1. Deep Atlas Outer Abyss Background (Screen Space)
  const abyssGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    24,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.88
  );
  abyssGrad.addColorStop(0, '#10375E');
  abyssGrad.addColorStop(0.58, '#092442');
  abyssGrad.addColorStop(1, '#041225');
  ctx.fillStyle = abyssGrad;
  ctx.fillRect(0, 0, width, height);

  // Enter World Space for all cartographic ocean layers
  ctx.save();
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // 2. Projected Globe Water Basin + Atlas Rim
  if (cache.spherePath) {
    const globeWaterGrad = ctx.createLinearGradient(0, 0, 0, height);
    globeWaterGrad.addColorStop(0, '#0C3156');
    globeWaterGrad.addColorStop(0.24, '#134474');
    globeWaterGrad.addColorStop(0.5, '#174E83');
    globeWaterGrad.addColorStop(0.76, '#12416E');
    globeWaterGrad.addColorStop(1, '#0A294B');
    ctx.fillStyle = globeWaterGrad;
    ctx.fill(cache.spherePath);

    // Clip decorative sea features cleanly inside the globe sphere
    ctx.save();
    ctx.clip(cache.spherePath);

    // 2B. Seasonal Arctic Sea Ice Shelf (linked to calendar month)
    const month = getCalendarMonthForTick(tick, gameMode);
    const iceAlpha = getArcticSeaIceIntensity(month);
    if (iceAlpha > 0) {
      const arcticPt = projection([0, 74]);
      const topPt = projection([0, 89]);
      if (arcticPt && topPt) {
        const iceGrad = ctx.createLinearGradient(0, topPt[1], 0, arcticPt[1] + 24);
        iceGrad.addColorStop(0, `rgba(219, 238, 252, ${iceAlpha})`);
        iceGrad.addColorStop(0.55, `rgba(186, 224, 248, ${iceAlpha * 0.55})`);
        iceGrad.addColorStop(1, 'rgba(186, 224, 248, 0)');
        ctx.fillStyle = iceGrad;
        ctx.fillRect(-width, topPt[1] - 40, width * 3, arcticPt[1] - topPt[1] + 70);
      }
    }

    // 2C. Fine Cartographic Graticule Grid
    if (cache.graticulePath) {
      ctx.lineWidth = 0.55 * invK;
      ctx.strokeStyle = 'rgba(147, 206, 248, 0.085)';
      ctx.stroke(cache.graticulePath);
    }

    // 2D. Equator & Tropics Cartographic Reference Parallels
    drawReferenceLatitudeLine(
      ctx,
      projection,
      0,
      'rgba(218, 192, 134, 0.17)',
      0.8 * invK,
      false,
      invK
    );
    drawReferenceLatitudeLine(
      ctx,
      projection,
      23.5,
      'rgba(218, 192, 134, 0.12)',
      0.65 * invK,
      true,
      invK
    );
    drawReferenceLatitudeLine(
      ctx,
      projection,
      -23.5,
      'rgba(218, 192, 134, 0.12)',
      0.65 * invK,
      true,
      invK
    );

    // 3. Ambient Open-Water Maritime Trade Lanes (drawn before land so they tuck neatly under coasts)
    const laneOpacity =
      mapMode === 'ECONOMIC' || mapMode === 'RESOURCES' ? 0.42 : 0.26;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([4.5 * invK, 5.2 * invK]);
    ctx.lineWidth =
      (mapMode === 'ECONOMIC' || mapMode === 'RESOURCES' ? 1.45 : 1.05) * invK;
    ctx.strokeStyle = `rgba(228, 204, 148, ${laneOpacity})`;

    for (const lane of MARITIME_SEA_LANES) {
      const pts = lane.waypoints
        .map((c) => projection(c))
        .filter((p): p is [number, number] => Boolean(p));
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        if (Math.abs(pts[i][0] - pts[i - 1][0]) > width * 0.45) {
          ctx.moveTo(pts[i][0], pts[i][1]);
        } else {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Classic Portolan Compass Roses in Open Ocean Basins
    const roseAlpha = Math.max(0, Math.min(0.84, 1.15 - transform.k * 0.14));
    if (roseAlpha > 0.06) {
      for (const rose of COMPASS_ROSES) {
        const pt = projection(rose.coords);
        if (!pt) continue;
        const worldRadius =
          rose.radiusPx * Math.pow(Math.max(0.75, transform.k), -0.68);
        drawCompassRose(
          ctx,
          pt[0],
          pt[1],
          worldRadius,
          invK,
          Boolean(rose.withRhumbLines),
          roseAlpha
        );
      }
    }

    // 5. Cartographic Ocean & Regional Sea Serif Labels
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lbl of OCEAN_AND_SEA_LABELS) {
      const isOcean = lbl.tier === 'OCEAN';
      if (!isOcean && transform.k < 1.35) continue;
      if (isOcean && transform.k > 4.2) continue;

      const pt = projection(lbl.coords);
      if (!pt) continue;

      const scale = lbl.sizeScale ?? 1.0;
      const baseFontPx = isOcean
        ? Math.max(6.5, Math.min(13.5, 11.5 * invK * Math.sqrt(transform.k)))
        : Math.max(4.0, Math.min(9.0, 8.2 * invK * Math.pow(transform.k, 0.3)));
      const fontPx = baseFontPx * scale;

      const alpha = isOcean
        ? Math.max(0.15, Math.min(0.44, 0.49 - transform.k * 0.06))
        : Math.max(0.18, Math.min(0.44, (transform.k - 1.25) * 0.28));

      ctx.save();
      ctx.translate(pt[0], pt[1]);
      if (lbl.angleDeg) {
        ctx.rotate((lbl.angleDeg * Math.PI) / 180);
      }
      ctx.font = `italic 600 ${fontPx}px "Cinzel", Georgia, "Times New Roman", serif`;
      ctx.fillStyle = isOcean
        ? `rgba(196, 224, 248, ${alpha})`
        : `rgba(186, 224, 246, ${alpha})`;
      drawSpacedCenteredText(
        ctx,
        lbl.name,
        (lbl.letterSpacing || 1.3) * invK * (isOcean ? 1.08 : 0.68)
      );
      ctx.restore();
    }
    ctx.restore();

    ctx.restore(); // end spherePath clip

    // Double-line gilded atlas globe rim
    ctx.lineWidth = 1.6 * invK;
    ctx.strokeStyle = 'rgba(202, 161, 90, 0.36)';
    ctx.stroke(cache.spherePath);
    ctx.lineWidth = 0.7 * invK;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.stroke(cache.spherePath);
  }

  // 6. Fast Coastline-Only Two-Pass Bathymetry Shelf Halo (Zero inland border bleed!)
  // Uses strictly the pre-classified water-facing `coastline` Path2D segments so inland
  // province seams are NEVER stroked and zoom-out stays locked at 60 FPS.
  if (classifiedBorders && visibleFeatures.length > 0) {
    const outerShelfW = Math.min(
      11.5,
      Math.max(3.6, 8.2 / Math.pow(transform.k, 0.76))
    );
    const innerShelfW = Math.min(
      4.6,
      Math.max(1.5, 3.4 / Math.pow(transform.k, 0.76))
    );

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(54, 154, 200, 0.18)';
    ctx.lineWidth = outerShelfW;
    for (const feat of visibleFeatures) {
      const coastPath = classifiedBorders.get(feat.id)?.coastline;
      if (coastPath) ctx.stroke(coastPath);
    }

    ctx.strokeStyle = 'rgba(116, 212, 238, 0.28)';
    ctx.lineWidth = innerShelfW;
    for (const feat of visibleFeatures) {
      const coastPath = classifiedBorders.get(feat.id)?.coastline;
      if (coastPath) ctx.stroke(coastPath);
    }

    ctx.restore();
  }

  ctx.restore();
}
