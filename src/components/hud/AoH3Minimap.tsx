import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { ChevronDown, ChevronUp, Crosshair, Minus, Plus } from 'lucide-react';
import { GeoCountryFeature } from '../../engine/worldBuilder';
import { getBaseProjectionScale } from '../../map/spatialIndex';
import { MapMode, Nation, Territory } from '../../types/game';
import { sound } from '../../utils/soundEngine';
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
} from '../illustrations/AoH3Illustrations';

/**
 * AoH3-style interactive bottom-right world minimap HUD.
 * Includes a top header bar with minimize/collapse toggle, clickable/draggable
 * political canvas with live gold viewport frame, and an integrated brass
 * map-mode icon strip replacing the former top-left "Siyasi" menu.
 */

const MINI_WIDTH = 200;
const MINI_HEIGHT = 104;
/** Natural Earth 1 spans about ±2.75 scale horizontally and ±1.42 vertically. */
const MINI_X_SPAN = 2.75;
const MINI_Y_SPAN = 1.42;

const MINIMAP_MODE_ICONS: ReadonlyArray<{
  id: MapMode;
  label: string;
  glyph: AoH3GlyphName;
  tone: string;
}> = [
  { id: 'POLITICAL', label: 'Siyasi', glyph: 'crown', tone: 'text-[#e0b86e]' },
  { id: 'ECONOMIC', label: 'Ekonomi', glyph: 'gold', tone: 'text-[#e0b86e]' },
  { id: 'RESOURCES', label: 'Kaynaklar', glyph: 'hammer', tone: 'text-[#e0b86e]' },
  { id: 'DIPLOMATIC', label: 'Diplomasi', glyph: 'scale', tone: 'text-[#e0b86e]' },
  { id: 'MILITARY', label: 'Askeri', glyph: 'sword', tone: 'text-rose-300' },
  { id: 'RELIGION', label: 'Din', glyph: 'fleur', tone: 'text-[#e0b86e]' },
  { id: 'CULTURE', label: 'Kültür', glyph: 'flag', tone: 'text-[#e0b86e]' },
  { id: 'ASSIMILATION', label: 'Asimilasyon', glyph: 'globe', tone: 'text-[#e0b86e]' },
  { id: 'TERRAIN', label: 'Arazi', glyph: 'compass', tone: 'text-[#e0b86e]' },
  { id: 'WEATHER', label: 'Hava', glyph: 'bolt', tone: 'text-sky-300' },
  { id: 'IDEOLOGY', label: 'İdeoloji', glyph: 'star', tone: 'text-[#e0b86e]' },
];

function getMiniScale(width: number, height: number) {
  return Math.min(width / (2 * MINI_X_SPAN), height / (2 * MINI_Y_SPAN));
}

function darkenHexColor(hex: string, amount = 0.18): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return 'rgba(150, 132, 104, 0.55)';
  const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
  return `rgb(${r}, ${g}, ${b})`;
}

interface AoH3MinimapProps {
  features: GeoCountryFeature[];
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  playerNationId: string;
  mapMode: MapMode;
  transform: { k: number; x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  onSetMapMode?: (mode: MapMode) => void;
  onJumpToCoords: (coords: [number, number]) => void;
  onZoom: (factor: number) => void;
  onFocusCapital: () => void;
}

export const AoH3Minimap: React.FC<AoH3MinimapProps> = ({
  features,
  territories,
  nations,
  playerNationId,
  mapMode,
  transform,
  viewportWidth,
  viewportHeight,
  onSetMapMode,
  onJumpToCoords,
  onZoom,
  onFocusCapital,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathsRef = useRef<{ key: string; paths: Record<string, Path2D> }>({
    key: '',
    paths: {},
  });
  const [collapsed, setCollapsed] = useState(false);
  const [baseRevision, setBaseRevision] = useState(0);
  const isDraggingRef = useRef(false);

  const territoriesRef = useRef(territories);
  territoriesRef.current = territories;
  const nationsRef = useRef(nations);
  nationsRef.current = nations;

  const activeModeMeta =
    MINIMAP_MODE_ICONS.find((m) => m.id === mapMode) || MINIMAP_MODE_ICONS[0];

  const miniProjection = useMemo(() => {
    const scale = getMiniScale(MINI_WIDTH, MINI_HEIGHT);
    return geoNaturalEarth1()
      .scale(scale)
      .translate([MINI_WIDTH / 2, MINI_HEIGHT / 2]);
  }, []);

  /** Cheap signature: only recompute when a province actually changes owner. */
  const ownershipKey = useMemo(() => {
    let key = '';
    for (const id of Object.keys(territories)) {
      key += `${id}:${territories[id].ownerId};`;
    }
    return key;
  }, [territories]);

  const nationColorKey = useMemo(
    () =>
      Object.keys(nations)
        .map((id) => `${id}:${nations[id].color}`)
        .join('|'),
    [nations]
  );

  // Re-project every province once per feature-set; the paths never change.
  const ensurePaths = useCallback(() => {
    const key = `${features.length}:${MINI_WIDTH}x${MINI_HEIGHT}`;
    if (pathsRef.current.key === key) return pathsRef.current.paths;
    const pathGen = geoPath(miniProjection);
    const paths: Record<string, Path2D> = {};
    for (const feat of features) {
      const d = pathGen(feat);
      if (d) paths[feat.id] = new Path2D(d);
    }
    pathsRef.current = { key, paths };
    return paths;
  }, [features, miniProjection]);

  // Build (and cache) the political base map.
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(MINI_WIDTH * dpr);
    canvas.height = Math.round(MINI_HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a1826';
    ctx.fillRect(0, 0, MINI_WIDTH, MINI_HEIGHT);

    const paths = ensurePaths();
    const liveTerritories = territoriesRef.current;
    const liveNations = nationsRef.current;
    for (const feat of features) {
      const path = paths[feat.id];
      if (!path) continue;
      const territory = liveTerritories[feat.id];
      const ownerColor = territory
        ? liveNations[territory.ownerId]?.color
        : undefined;
      ctx.fillStyle = ownerColor
        ? darkenHexColor(ownerColor, 0.16)
        : 'rgba(126, 114, 92, 0.45)';
      ctx.fill(path);
    }

    ctx.strokeStyle = 'rgba(6, 6, 6, 0.55)';
    ctx.lineWidth = 0.4;
    for (const feat of features) {
      const path = paths[feat.id];
      if (!path) continue;
      ctx.stroke(path);
    }

    const vignette = ctx.createRadialGradient(
      MINI_WIDTH / 2,
      MINI_HEIGHT / 2,
      MINI_HEIGHT * 0.25,
      MINI_WIDTH / 2,
      MINI_HEIGHT / 2,
      MINI_HEIGHT * 0.95
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, MINI_WIDTH, MINI_HEIGHT);

    setBaseRevision((v) => v + 1);
  }, [features, ensurePaths, ownershipKey, nationColorKey]);

  // Composite base + live viewport rectangle.
  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    const base = baseCanvasRef.current;
    if (!canvas || !base || base.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(MINI_WIDTH * dpr)) {
      canvas.width = Math.round(MINI_WIDTH * dpr);
      canvas.height = Math.round(MINI_HEIGHT * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINI_WIDTH, MINI_HEIGHT);
    ctx.drawImage(base, 0, 0, MINI_WIDTH, MINI_HEIGHT);

    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const baseScale = getBaseProjectionScale(width, height);
    const miniScale = getMiniScale(MINI_WIDTH, MINI_HEIGHT);

    const projectedToMiniX = (p: number) =>
      ((p - width / 2) / baseScale) * miniScale + MINI_WIDTH / 2;
    const projectedToMiniY = (p: number) =>
      ((p - height / 2) / baseScale) * miniScale + MINI_HEIGHT / 2;

    const { k, x, y } = transform;
    const rawLeft = projectedToMiniX((0 - x) / k);
    const rawRight = projectedToMiniX((width - x) / k);
    const rawTop = projectedToMiniY((0 - y) / k);
    const rawBottom = projectedToMiniY((height - y) / k);

    const x0 = Math.max(1.5, Math.min(MINI_WIDTH - 1.5, rawLeft));
    const x1 = Math.max(1.5, Math.min(MINI_WIDTH - 1.5, rawRight));
    const y0 = Math.max(1.5, Math.min(MINI_HEIGHT - 1.5, rawTop));
    const y1 = Math.max(1.5, Math.min(MINI_HEIGHT - 1.5, rawBottom));
    const rectW = Math.max(0, x1 - x0);
    const rectH = Math.max(0, y1 - y0);

    if (rectW > 2 && rectH > 2) {
      ctx.fillStyle = 'rgba(230, 192, 122, 0.14)';
      ctx.fillRect(x0, y0, rectW, rectH);
      ctx.strokeStyle = 'rgba(246, 214, 156, 0.92)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x0 + 0.5,
        y0 + 0.5,
        Math.max(1, rectW - 1),
        Math.max(1, rectH - 1)
      );
      ctx.strokeStyle = 'rgba(246, 214, 156, 0.45)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x0 - 2.5, y0 + 4);
      ctx.lineTo(x0 - 2.5, y0 - 2.5);
      ctx.lineTo(x0 + 4, y0 - 2.5);
      ctx.moveTo(x1 + 2.5, y1 - 4);
      ctx.lineTo(x1 + 2.5, y1 + 2.5);
      ctx.lineTo(x1 - 4, y1 + 2.5);
      ctx.stroke();
    }

    // Player capital diamond
    const capitalId =
      nations[playerNationId]?.capitalTerritoryId || playerNationId;
    const capitalCentroid = territories[capitalId]?.centroid;
    if (capitalCentroid) {
      const pt = miniProjection(capitalCentroid);
      if (pt) {
        ctx.fillStyle = '#f6e6c6';
        ctx.strokeStyle = 'rgba(20, 12, 8, 0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pt[0], pt[1] - 3.2);
        ctx.lineTo(pt[0] + 2.4, pt[1]);
        ctx.lineTo(pt[0], pt[1] + 3.2);
        ctx.lineTo(pt[0] - 2.4, pt[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [
    collapsed,
    transform,
    viewportWidth,
    viewportHeight,
    baseRevision,
    nations,
    territories,
    playerNationId,
    miniProjection,
  ]);

  const jumpToClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const mx = ((clientX - rect.left) / rect.width) * MINI_WIDTH;
      const my = ((clientY - rect.top) / rect.height) * MINI_HEIGHT;
      const coords = miniProjection.invert?.([mx, my]) as
        | [number, number]
        | null;
      if (!coords) return;
      onJumpToCoords(coords);
    },
    [miniProjection, onJumpToCoords]
  );

  return (
    <aside
      data-testid="aoh3-minimap-hud"
      className="pointer-events-auto select-none"
      aria-label="Dünya mini haritası ve harita katmanları"
    >
      <div className="aoh3-minimap w-[176px] sm:w-[202px]">
        {/* Top HUD Bar: Active Map Mode + Utility Actions + Minimize Toggle */}
        <div className="aoh3-minimap-toolbar">
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#e0b86e] tracking-wide truncate pl-0.5">
            <AoH3GlyphSvg
              name={activeModeMeta.glyph}
              className={`w-3 h-3 shrink-0 ${activeModeMeta.tone}`}
            />
            <span className="truncate">{activeModeMeta.label}</span>
          </span>
          <span className="mx-0.5 h-px flex-1 bg-[#caa15a]/25" />

          {!collapsed && (
            <>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  sound.playClick();
                  onFocusCapital();
                }}
                title="Başkente odakla"
                aria-label="Başkente odakla"
                className="aoh3-minimap-btn cursor-pointer"
              >
                <Crosshair className="h-3 w-3" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  sound.playClick();
                  onZoom(1.25);
                }}
                title="Yakınlaştır"
                aria-label="Haritayı yakınlaştır"
                className="aoh3-minimap-btn cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  sound.playClick();
                  onZoom(0.8);
                }}
                title="Uzaklaştır"
                aria-label="Haritayı uzaklaştır"
                className="aoh3-minimap-btn cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
            </>
          )}

          <button
            type="button"
            data-testid="minimap-collapse-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              sound.playClick();
              setCollapsed((v) => !v);
            }}
            title={collapsed ? 'Mini haritayı büyüt' : 'Mini haritayı küçült'}
            aria-label={collapsed ? 'Mini haritayı büyüt' : 'Mini haritayı küçült'}
            aria-expanded={!collapsed}
            className="aoh3-minimap-btn is-active cursor-pointer"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Interactive Click/Drag Minimap Canvas + Map Mode Icon Frame */}
        {!collapsed && (
          <>
            <canvas
              ref={canvasRef}
              data-testid="aoh3-minimap-canvas"
              className="aoh3-minimap-canvas block w-full h-[90px] sm:h-[104px] cursor-crosshair touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                isDraggingRef.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                jumpToClientPoint(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!isDraggingRef.current) return;
                e.stopPropagation();
                jumpToClientPoint(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                isDraggingRef.current = false;
                e.currentTarget.releasePointerCapture?.(e.pointerId);
              }}
              onPointerCancel={() => {
                isDraggingRef.current = false;
              }}
            />

            {/* Integrated Frame Strip: Map-Mode Icon Buttons (replaces top-left Siyasi dropdown) */}
            {onSetMapMode && (
              <div
                data-testid="minimap-mapmode-frame"
                role="toolbar"
                aria-label="Harita katman ikonları"
                className="grid grid-cols-5 gap-1 p-1 border-t border-[#caa15a]/35 bg-[#120e0a]/95"
              >
                {MINIMAP_MODE_ICONS.map((m) => {
                  const isActive = mapMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`minimap-mode-${m.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        sound.playClick();
                        onSetMapMode(m.id);
                      }}
                      title={m.label}
                      aria-label={`${m.label} haritası`}
                      aria-pressed={isActive}
                      className={`h-[24px] sm:h-[26px] rounded flex items-center justify-center border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7] shadow-sm'
                          : 'bg-[#1a140e]/90 border-[#caa15a]/25 text-[#c8a86a] hover:text-[#faf3e3] hover:border-[#caa15a]/65 hover:bg-[#251d14]'
                      }`}
                    >
                      <AoH3GlyphSvg
                        name={m.glyph}
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-[#14100c]' : m.tone
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <canvas ref={baseCanvasRef} className="hidden" aria-hidden="true" />
      </div>
    </aside>
  );
};
