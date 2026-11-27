import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, GeoProjection } from 'd3-geo';
import { Crosshair } from 'lucide-react';
import { computeVisibleTerritoryIds } from '../engine/fogOfWarEngine';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { renderMapLabelsAndBattles } from '../map/mapLabelsAndUnitsRenderer';
import {
  renderArmyMovementsLayer,
  renderOceanAndPolygons,
  renderSeaArmiesLayer,
} from '../map/mapPolygonRenderer';
import {
  buildMapGeometryCache,
  getBaseProjectionScale,
  getPrewarmedMapGeometryCache,
  hitTestTerritoryAtPoint,
  MapGeometryCache,
  queryVisibleFeatures,
} from '../map/spatialIndex';
import { useMapGestures } from '../map/useMapGestures';
import { AoH3Minimap } from './hud/AoH3Minimap';
import { performanceTelemetry } from '../utils/performanceTelemetry';
import {
  BorderThicknessOption,
  getBorderThicknessMultiplier,
  getGraphicsMaxDpr,
  getMapLabelScaleMultiplier,
  GraphicsQualityOption,
  MapLabelDensityOption,
  MapLabelScaleOption,
} from '../engine/gameSettings';
import {
  buildClassifiedBorderPaths,
  ClassifiedBorderMap,
} from '../map/borderClassifier';
import {
  computeInterpolatedProgressMap,
  computeMarchAnimPhase,
  MovementTweenMap,
  syncMovementTweens,
} from '../map/armyInterpolation';
import { getCalendarMonthForTick } from '../engine/seasonalWeatherEngine';
import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  MapMode,
  Nation,
  SeaArmy,
  SpeedLevel,
  Territory,
} from '../types/game';

interface WorldMapCanvasProps {
  features: GeoCountryFeature[];
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies?: SeaArmy[];
  playerNationId: string;
  selectedTerritoryId: string | null;
  selectedSeaArmyId?: string | null;
  multiSelectedTerritoryIds?: string[];
  armyOrderSourceId: string | null;
  seaArmyOrderSourceId?: string | null;
  mapMode: MapMode;
  mapLabelDensity?: MapLabelDensityOption;
  mapLabelScale?: MapLabelScaleOption;
  borderThickness?: BorderThicknessOption;
  graphicsQuality?: GraphicsQualityOption;
  smoothArmyAnimations?: boolean;
  fogOfWarEnabled?: boolean;
  speed?: SpeedLevel;
  tick?: number;
  gameMode?: GameModeId;
  focusCapitalSignal?: number;
  focusCoordsSignal?: { coords: [number, number]; seq: number } | null;
  /** Imperative zoom from the AoH3 top-bar `-` / `+` plaque. */
  zoomCommand?: { factor: number; seq: number } | null;
  /** Bottom-right AoH3 world plate (visible on all viewports with minimize button). */
  showMinimap?: boolean;
  /** Optional HUD stack (notifications / chronicle) pinned directly above the bottom-right minimap. */
  minimapTopSlot?: React.ReactNode;
  timelapseMode?: boolean;
  onSetMapMode?: (mode: MapMode) => void;
  onSelectTerritory: (territoryId: string | null) => void;
  onSelectSeaArmy?: (seaArmyId: string | null) => void;
  onExecuteArmyMove: (fromId: string, toId: string) => void;
  onEmbarkToSea?: (
    coords: [number, number],
    targetSeaArmyId?: string | null
  ) => void;
  onDisembarkFromSea?: (
    sourceSeaArmyId: string,
    toTerritoryId: string
  ) => void;
  onCancelArmyOrder: () => void;
}

export const WorldMapCanvas: React.FC<WorldMapCanvasProps> = ({
  features,
  territories,
  nations,
  relations,
  wars,
  battles,
  movements,
  seaArmies = [],
  playerNationId,
  selectedTerritoryId,
  selectedSeaArmyId = null,
  multiSelectedTerritoryIds,
  armyOrderSourceId,
  seaArmyOrderSourceId = null,
  mapMode,
  mapLabelDensity = 'BALANCED',
  mapLabelScale = 'NORMAL',
  borderThickness = 'NORMAL',
  graphicsQuality = 'HIGH',
  smoothArmyAnimations = true,
  fogOfWarEnabled = true,
  speed = 1,
  tick = 0,
  gameMode,
  focusCapitalSignal = 0,
  focusCoordsSignal = null,
  zoomCommand = null,
  showMinimap = true,
  minimapTopSlot,
  timelapseMode = false,
  onSetMapMode,
  onSelectTerritory,
  onSelectSeaArmy,
  onExecuteArmyMove,
  onEmbarkToSea,
  onDisembarkFromSea,
  onCancelArmyOrder,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const geometryCacheRef = useRef<MapGeometryCache | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const movementTweensRef = useRef<MovementTweenMap>(new Map());
  const borderCacheRef = useRef<{
    dimsKey: string;
    /** Owner-only signature: borders do not change while a tick mutates units. */
    signature: string;
    territories: Record<string, Territory>;
    playerNationId: string;
    paths: ClassifiedBorderMap;
  } | null>(null);
  const baseCacheDepsRef = useRef<{
    dimsKey: string;
    k: number;
    x: number;
    y: number;
    territories: Record<string, Territory>;
    nations: Record<string, Nation>;
    relations: Record<string, DiplomaticRelation>;
    wars: ActiveWar[];
    mapMode: MapMode;
    playerNationId: string;
    selectedTerritoryId: string | null;
    multiSelectedTerritoryIds?: string[];
    armyOrderSourceId: string | null;
    fogOfWarEnabled: boolean;
    borderThickness: BorderThicknessOption;
    weatherMonth: number;
  } | null>(null);
  const lastCenteredKeyRef = useRef<string>('');
  const lastFocusCapitalSignalRef = useRef<number>(focusCapitalSignal);
  const lastFocusCoordsSeqRef = useRef<number>(focusCoordsSignal?.seq || 0);
  const projectionCacheRef = useRef<{
    dimsKey: string;
    projection: GeoProjection;
  } | null>(null);
  const centroidCacheRef = useRef<{
    dimsKey: string;
    centroids: Record<string, [number, number]>;
  } | null>(null);
  const [viewportRevision, setViewportRevision] = useState(0);

  const visibleTerritoryIds = useMemo(
    () =>
      computeVisibleTerritoryIds(
        territories,
        nations,
        relations,
        movements,
        battles,
        playerNationId
      ),
    [territories, nations, relations, movements, battles, playerNationId]
  );

  useEffect(() => {
    performanceTelemetry.start();
    return () => performanceTelemetry.stop();
  }, []);

  // Latest click context ref so gesture callback never goes stale across renders
  const clickContextRef = useRef({
    features,
    territories,
    seaArmies,
    playerNationId,
    armyOrderSourceId,
    seaArmyOrderSourceId,
    timelapseMode,
    onExecuteArmyMove,
    onSelectTerritory,
    onSelectSeaArmy,
    onEmbarkToSea,
    onDisembarkFromSea,
    transform: { k: 1.85, x: 0, y: 0 },
  });

  const handleCanvasTap = useCallback((clientX: number, clientY: number) => {
    if (clickContextRef.current.timelapseMode) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const cache = geometryCacheRef.current;
    if (!canvas || !container || !cache) return;

    const ctxState = clickContextRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const width = container.clientWidth || 1024;
    const height = container.clientHeight || 640;
    const { k, x, y } = ctxState.transform;

    const mapX = (clickX - x) / k;
    const mapY = (clickY - y) / k;

    const baseScale = getBaseProjectionScale(width, height);
    const projection = geoNaturalEarth1()
      .scale(baseScale)
      .translate([width / 2, height / 2]);

    const coords = projection.invert?.([mapX, mapY]) as [number, number] | null;
    if (!coords) return;

    // 1. Hit-test anchored SeaArmies (fleets) in screen space before land polygons
    let hitFleet: SeaArmy | null = null;
    let bestFleetDistSq = 30 * 30;
    for (const fleet of ctxState.seaArmies) {
      const pt = projection(fleet.coords);
      if (!pt) continue;
      const sx = pt[0] * k + x;
      const sy = pt[1] * k + y;
      const dx = clickX - sx;
      const dy = clickY - sy;
      const dSq = dx * dx + dy * dy;
      if (dSq <= bestFleetDistSq) {
        bestFleetDistSq = dSq;
        hitFleet = fleet;
      }
    }

    if (hitFleet) {
      if (
        (ctxState.armyOrderSourceId || ctxState.seaArmyOrderSourceId) &&
        ctxState.onEmbarkToSea &&
        ctxState.seaArmyOrderSourceId !== hitFleet.id
      ) {
        ctxState.onEmbarkToSea(
          hitFleet.coords,
          hitFleet.ownerId === ctxState.playerNationId ? hitFleet.id : null
        );
        return;
      }
      ctxState.onSelectSeaArmy?.(hitFleet.id);
      return;
    }

    // 2. O(log N) RBush hit-test for province polygon — instant AoH3 response!
    const hitId = hitTestTerritoryAtPoint({
      cache,
      features: ctxState.features,
      territories: ctxState.territories,
      projection,
      mapX,
      mapY,
      coords,
      zoomK: k,
    });

    if (hitId) {
      if (ctxState.seaArmyOrderSourceId && ctxState.onDisembarkFromSea) {
        ctxState.onDisembarkFromSea(ctxState.seaArmyOrderSourceId, hitId);
        return;
      }
      if (ctxState.armyOrderSourceId && ctxState.armyOrderSourceId !== hitId) {
        ctxState.onExecuteArmyMove(ctxState.armyOrderSourceId, hitId);
        return;
      }
      ctxState.onSelectTerritory(hitId);
    } else {
      // 3. Open ocean tap: embark coastal army or reposition sea army onto open sea
      if (
        (ctxState.armyOrderSourceId || ctxState.seaArmyOrderSourceId) &&
        ctxState.onEmbarkToSea
      ) {
        ctxState.onEmbarkToSea(coords, null);
        return;
      }
      ctxState.onSelectTerritory(null);
    }
  }, []);

  const {
    transform,
    centerOnTerritory,
    centerOnCoords,
    reprojectOnResize,
    zoomBy,
    handlers,
  } = useMapGestures({
    canvasRef,
    containerRef,
    territories,
    onTapClientPoint: handleCanvasTap,
  });
  const lastPerfTransformRef = useRef(transform);

  // AoH3 top-bar zoom plaque -> imperative zoom around the viewport centre.
  const lastZoomSeqRef = useRef(0);
  useEffect(() => {
    if (!zoomCommand || zoomCommand.seq === lastZoomSeqRef.current) return;
    lastZoomSeqRef.current = zoomCommand.seq;
    zoomBy(zoomCommand.factor);
  }, [zoomCommand, zoomBy]);

  clickContextRef.current = {
    features,
    territories,
    seaArmies,
    playerNationId,
    armyOrderSourceId,
    seaArmyOrderSourceId,
    timelapseMode,
    onExecuteArmyMove,
    onSelectTerritory,
    onSelectSeaArmy,
    onEmbarkToSea,
    onDisembarkFromSea,
    transform,
  };

  // Preserve exact geographic center when user rotates phone between Portrait and Landscape!
  const prevSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    prevSizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      const { w: pw, h: ph } = prevSizeRef.current;
      if (pw > 0 && ph > 0 && (pw !== nw || ph !== nh)) {
        reprojectOnResize(pw, ph, nw, nh);
      }
      prevSizeRef.current = { w: nw, h: nh };
      setViewportRevision((v) => v + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [reprojectOnResize]);

  // Center on capital ONCE when campaign starts or nation changes (never re-snaps on war ticks or capital relocation)
  useEffect(() => {
    const capId =
      nations[playerNationId]?.capitalTerritoryId || playerNationId;
    const key = `${playerNationId}_${features.length}`;
    if (
      playerNationId &&
      territories[capId] &&
      lastCenteredKeyRef.current !== key
    ) {
      lastCenteredKeyRef.current = key;
      centerOnTerritory(capId, 2.2);
    }
  }, [playerNationId, nations, features.length, territories, centerOnTerritory]);

  // Re-center on player's capital ONLY when focusCapitalSignal explicitly increments from TopHudBar
  useEffect(() => {
    if (
      focusCapitalSignal <= 0 ||
      focusCapitalSignal === lastFocusCapitalSignalRef.current
    ) {
      return;
    }
    lastFocusCapitalSignalRef.current = focusCapitalSignal;
    const capId =
      nations[playerNationId]?.capitalTerritoryId || playerNationId;
    if (capId && territories[capId]) {
      centerOnTerritory(capId, 2.4);
    } else if (playerNationId && territories[playerNationId]) {
      centerOnTerritory(playerNationId, 2.4);
    }
  }, [focusCapitalSignal, nations, playerNationId, territories, centerOnTerritory]);

  // Smoothly focus camera on open-sea coordinates ONLY when focusCoordsSignal.seq increments
  useEffect(() => {
    const seq = focusCoordsSignal?.seq || 0;
    if (!focusCoordsSignal || seq <= 0 || seq === lastFocusCoordsSeqRef.current) {
      return;
    }
    lastFocusCoordsSeqRef.current = seq;
    centerOnCoords(focusCoordsSignal.coords, 2.5);
  }, [focusCoordsSignal, centerOnCoords]);

  // Main 2D Canvas Render Pass (with measured frame timings for map interactions)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 1024;
    const height = container.clientHeight || 640;
    if (transform.k !== lastPerfTransformRef.current.k) {
      performanceTelemetry.setInteraction('zoom');
    } else if (
      transform.x !== lastPerfTransformRef.current.x ||
      transform.y !== lastPerfTransformRef.current.y
    ) {
      performanceTelemetry.setInteraction('pan');
    }
    lastPerfTransformRef.current = transform;
    const maxDpr = getGraphicsMaxDpr(graphicsQuality);
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const pixelW = Math.round(width * dpr);
    const pixelH = Math.round(height * dpr);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sizeKey = `${width}x${height}`;
    let projection: GeoProjection;
    if (projectionCacheRef.current?.dimsKey === sizeKey) {
      projection = projectionCacheRef.current.projection;
    } else {
      const baseScale = getBaseProjectionScale(width, height);
      projection = geoNaturalEarth1()
        .scale(baseScale)
        .translate([width / 2, height / 2]);
      projectionCacheRef.current = { dimsKey: sizeKey, projection };
    }

    const dimsKey = `${sizeKey}_${features.length}`;
    if (
      !geometryCacheRef.current ||
      geometryCacheRef.current.dimsKey !== dimsKey
    ) {
      geometryCacheRef.current =
        getPrewarmedMapGeometryCache(dimsKey) ||
        buildMapGeometryCache(dimsKey, features, projection);
      centroidCacheRef.current = null;
    }

    if (
      !centroidCacheRef.current ||
      centroidCacheRef.current.dimsKey !== dimsKey
    ) {
      const centroids: Record<string, [number, number]> = {};
      for (const id in territories) {
        const pt = projection(territories[id].centroid);
        if (pt) centroids[id] = pt;
      }
      centroidCacheRef.current = { dimsKey, centroids };
    }
    const projectedCentroids = centroidCacheRef.current.centroids;

    const cache = geometryCacheRef.current;
    const visibleFeatures = queryVisibleFeatures(
      cache,
      width,
      height,
      transform
    );

    if (!baseCanvasRef.current) {
      baseCanvasRef.current = document.createElement('canvas');
    }
    const baseCanvas = baseCanvasRef.current;
    if (baseCanvas.width !== pixelW || baseCanvas.height !== pixelH) {
      baseCanvas.width = pixelW;
      baseCanvas.height = pixelH;
      baseCacheDepsRef.current = null;
    }

    const weatherMonth = getCalendarMonthForTick(tick, gameMode);

    const prevDeps = baseCacheDepsRef.current;
    const canReuseBaseCanvas =
      prevDeps !== null &&
      mapMode !== 'ECONOMIC' &&
      prevDeps.dimsKey === dimsKey &&
      prevDeps.k === transform.k &&
      prevDeps.x === transform.x &&
      prevDeps.y === transform.y &&
      prevDeps.territories === territories &&
      prevDeps.nations === nations &&
      prevDeps.relations === relations &&
      prevDeps.wars === wars &&
      prevDeps.mapMode === mapMode &&
      prevDeps.playerNationId === playerNationId &&
      prevDeps.selectedTerritoryId === selectedTerritoryId &&
      prevDeps.multiSelectedTerritoryIds === multiSelectedTerritoryIds &&
      prevDeps.armyOrderSourceId === armyOrderSourceId &&
      prevDeps.fogOfWarEnabled === fogOfWarEnabled &&
      prevDeps.borderThickness === borderThickness &&
      prevDeps.weatherMonth === weatherMonth;

    // Sync smooth 60 FPS sub-tick movement tweens whenever movement state updates
    const nowMs = performance.now();
    syncMovementTweens(movementTweensRef.current, movements, speed, nowMs);

    // Cache classified sovereign/internal/coastal border paths. The classifier only
    // reads ownerId, so the cache survives simulation ticks (which replace the
    // territories object every tick) and is rebuilt only when a province changes
    // hands or the projection resizes.
    let classifiedBorders: ClassifiedBorderMap | null = null;
    const borderCache = borderCacheRef.current;
    let ownershipSignature = borderCache?.signature ?? '';
    if (!borderCache || borderCache.territories !== territories) {
      const parts: string[] = [];
      for (const id in territories) {
        parts.push(`${id}:${territories[id].ownerId}`);
      }
      ownershipSignature = parts.join(';');
    }
    if (
      borderCache &&
      borderCache.dimsKey === dimsKey &&
      borderCache.signature === ownershipSignature &&
      borderCache.playerNationId === playerNationId
    ) {
      classifiedBorders = borderCache.paths;
      // Ownership is unchanged, so keep the fresh territories reference to skip
      // rebuilding the signature string on every following frame.
      borderCache.territories = territories;
    } else if (features.length > 0) {
      classifiedBorders = buildClassifiedBorderPaths({
        features,
        territories,
        projection,
        playerNationId,
      });
      borderCacheRef.current = {
        dimsKey,
        signature: ownershipSignature,
        territories,
        playerNationId,
        paths: classifiedBorders,
      };
    }

    if (!canReuseBaseCanvas) {
      const baseCtx = baseCanvas.getContext('2d');
      if (baseCtx) {
        baseCtx.save();
        baseCtx.setTransform(1, 0, 0, 1, 0, 0);
        baseCtx.clearRect(0, 0, pixelW, pixelH);
        baseCtx.scale(dpr, dpr);

        renderOceanAndPolygons({
          ctx: baseCtx,
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
          multiSelectedTerritoryIds,
          armyOrderSourceId,
          fogOfWarEnabled,
          visibleTerritoryIds,
          classifiedBorders,
          borderThicknessMultiplier: getBorderThicknessMultiplier(borderThickness),
          tick,
          gameMode,
        });

        baseCtx.restore();
        baseCacheDepsRef.current = {
          dimsKey,
          k: transform.k,
          x: transform.x,
          y: transform.y,
          territories,
          nations,
          relations,
          wars,
          mapMode,
          playerNationId,
          selectedTerritoryId,
          multiSelectedTerritoryIds,
          armyOrderSourceId,
          fogOfWarEnabled,
          borderThickness,
          weatherMonth,
        };
      }
    }

    const drawOverlayFrame = (frameNowMs: number) => {
      // 1. Blit cached base polygon & border layer in <0.1ms
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(baseCanvas, 0, 0);
      ctx.scale(dpr, dpr);

      // 2. Draw smooth 60 FPS interpolated marching armies layer
      const interpolatedProgress = computeInterpolatedProgressMap(
        movementTweensRef.current,
        movements,
        speed,
        frameNowMs
      );
      const animPhaseOverride = computeMarchAnimPhase(frameNowMs, speed, 0);

      renderArmyMovementsLayer({
        ctx,
        transform,
        territories,
        nations,
        relations,
        movements,
        projection,
        playerNationId,
        fogOfWarEnabled,
        visibleTerritoryIds,
        interpolatedProgress,
        animPhaseOverride,
      });

      // 2b. Draw fleets/armies anchored on open sea (plus active coastal blockades)
      renderSeaArmiesLayer({
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
      });

      // 3. Draw dynamic province labels, army shields, and live battle widgets
      renderMapLabelsAndBattles({
        ctx,
        width,
        height,
        transform,
        visibleFeatures,
        territories,
        nations,
        relations,
        wars,
        battles,
        projection,
        mapMode,
        mapLabelDensity,
        mapLabelScaleMultiplier: getMapLabelScaleMultiplier(mapLabelScale),
        playerNationId,
        selectedTerritoryId,
        armyOrderSourceId,
        fogOfWarEnabled,
        visibleTerritoryIds,
        projectedCentroids,
        timelapseMode,
      });

      ctx.restore();
    };

    drawOverlayFrame(nowMs);

    // Run lightweight 60 FPS overlay interpolation strictly while armies are actively marching, smooth mode is on & clock is running
    if (smoothArmyAnimations && movements.length > 0 && speed > 0) {
      let rafId = 0;
      const step = (ts: number) => {
        drawOverlayFrame(ts);
        rafId = window.requestAnimationFrame(step);
      };
      rafId = window.requestAnimationFrame(step);
      return () => {
        if (rafId) window.cancelAnimationFrame(rafId);
      };
    }
  }, [
    armyOrderSourceId,
    battles,
    borderThickness,
    features,
    fogOfWarEnabled,
    graphicsQuality,
    mapLabelDensity,
    mapLabelScale,
    mapMode,
    movements,
    nations,
    playerNationId,
    relations,
    seaArmies,
    selectedSeaArmyId,
    selectedTerritoryId,
    multiSelectedTerritoryIds,
    smoothArmyAnimations,
    speed,
    territories,
    tick,
    timelapseMode,
    gameMode,
    transform,
    viewportRevision,
    visibleTerritoryIds,
    wars,
  ]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#071B34]">
      <canvas
        ref={canvasRef}
        {...handlers}
        className="w-full h-full cursor-grab active:cursor-grabbing block touch-none"
      />

      {armyOrderSourceId && territories[armyOrderSourceId] && !selectedTerritoryId && (
        <div className="aoh3-hint absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-1.5rem)]">
          <Crosshair className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
          <span className="text-xs font-medium truncate">
            <strong>{territories[armyOrderSourceId].name}</strong> ordusu için{' '}
            {territories[armyOrderSourceId].isCoastal
              ? 'hedef şehir veya açık deniz noktası seçin'
              : 'haritadan hedef şehir seçin'}
          </span>
          <button
            onClick={onCancelArmyOrder}
            className="px-2 py-0.5 text-[10.5px] font-bold bg-[#2a1512] hover:bg-[#3a1d18] text-[#f6e6c6] rounded-[2px] border border-[#caa15a]/45 whitespace-nowrap shrink-0"
          >
            İptal
          </button>
        </div>
      )}

      {seaArmyOrderSourceId &&
        !selectedSeaArmyId &&
        seaArmies.some((s) => s.id === seaArmyOrderSourceId) && (
          <div className="aoh3-hint absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-1.5rem)]">
            <Crosshair className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
            <span className="text-xs font-medium truncate">
              <strong>
                {seaArmies.find((s) => s.id === seaArmyOrderSourceId)?.name ||
                  'Deniz Filosu'}
              </strong>{' '}
              için haritadan kıyı şehri veya yeni deniz noktası seçin
            </span>
            <button
              onClick={onCancelArmyOrder}
              className="px-2 py-0.5 text-[10.5px] font-bold bg-[#2a1512] hover:bg-[#3a1d18] text-[#f6e6c6] rounded-[2px] border border-[#caa15a]/45 whitespace-nowrap shrink-0 cursor-pointer"
            >
              İptal
            </button>
          </div>
        )}

      {showMinimap && (
        <div
          data-testid="minimap-hud-dock"
          className="hud-minimap-dock absolute bottom-2 right-2 z-[22] flex flex-col items-end gap-1.5 pointer-events-none"
        >
          {minimapTopSlot}
          <AoH3Minimap
            features={features}
            territories={territories}
            nations={nations}
            playerNationId={playerNationId}
            mapMode={mapMode}
            transform={transform}
            viewportWidth={containerRef.current?.clientWidth || 1024}
            viewportHeight={containerRef.current?.clientHeight || 640}
            onSetMapMode={onSetMapMode}
            onJumpToCoords={(coords) =>
              centerOnCoords(coords, Math.max(2.1, Math.min(6, transform.k)))
            }
            onZoom={(factor) => zoomBy(factor)}
            onFocusCapital={() =>
              centerOnCoords(
                territories[
                  nations[playerNationId]?.capitalTerritoryId || playerNationId
                ]?.centroid || [28.97, 41.01],
                2.6
              )
            }
          />
        </div>
      )}

    </div>
  );
};
