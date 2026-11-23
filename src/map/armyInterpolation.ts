import { ArmyMovement, SpeedLevel } from '../types/game';
import { getClockSpeedProfile } from '../engine/gameSettings';

export interface MovementTweenState {
  fromProgress: number;
  toProgress: number;
  updatedAtMs: number;
  durationMs: number;
  fromTerritoryId: string;
  toTerritoryId: string;
}

export type MovementTweenMap = Map<string, MovementTweenState>;

/**
 * Reconciles the latest simulation `movements` snapshot against the cached tween map,
 * enabling smooth 60 FPS sub-tick interpolation between discrete simulation progress jumps.
 */
export function syncMovementTweens(
  tweenMap: MovementTweenMap,
  movements: ArmyMovement[],
  speed: SpeedLevel,
  nowMs: number
): void {
  const activeIds = new Set<string>();
  const profile = getClockSpeedProfile(speed);
  const durationMs =
    profile.intervalMs > 0 ? Math.max(120, profile.intervalMs) : 280;

  for (const mv of movements) {
    activeIds.add(mv.id);
    const existing = tweenMap.get(mv.id);

    if (
      !existing ||
      existing.fromTerritoryId !== mv.fromTerritoryId ||
      existing.toTerritoryId !== mv.toTerritoryId
    ) {
      // Newly spawned movement or transitioned to next multi-hop leg
      const startProg = mv.progress <= 16 ? 0 : Math.max(0, mv.progress - 6);
      tweenMap.set(mv.id, {
        fromProgress: startProg,
        toProgress: mv.progress,
        updatedAtMs: nowMs,
        durationMs,
        fromTerritoryId: mv.fromTerritoryId,
        toTerritoryId: mv.toTerritoryId,
      });
    } else if (existing.toProgress !== mv.progress) {
      // Sample current interpolated progress as the seamless start of the next segment
      const currentDisplay = sampleMovementProgress(existing, nowMs, speed);
      tweenMap.set(mv.id, {
        fromProgress: currentDisplay,
        toProgress: mv.progress,
        updatedAtMs: nowMs,
        durationMs,
        fromTerritoryId: mv.fromTerritoryId,
        toTerritoryId: mv.toTerritoryId,
      });
    }
  }

  for (const key of Array.from(tweenMap.keys())) {
    if (!activeIds.has(key)) {
      tweenMap.delete(key);
    }
  }
}

/**
 * Samples a single tween state at `nowMs` (clamped 0..100).
 * When paused (`speed === 0`), freezes smoothly at the latest progress without jumping.
 */
export function sampleMovementProgress(
  tween: MovementTweenState,
  nowMs: number,
  speed: SpeedLevel
): number {
  if (speed === 0) {
    return Math.max(0, Math.min(100, tween.toProgress));
  }
  const elapsed = Math.max(0, nowMs - tween.updatedAtMs);
  const t = Math.min(1, elapsed / Math.max(1, tween.durationMs));
  // Gentle linear-blend curve keeps constant marching cadence with zero step stutter
  const value = tween.fromProgress + (tween.toProgress - tween.fromProgress) * t;
  return Math.max(0, Math.min(100, value));
}

/**
 * Builds a map of movementId -> smooth display progress (0..100) for the current frame.
 */
export function computeInterpolatedProgressMap(
  tweenMap: MovementTweenMap,
  movements: ArmyMovement[],
  speed: SpeedLevel,
  nowMs: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const mv of movements) {
    const tween = tweenMap.get(mv.id);
    result[mv.id] = tween
      ? sampleMovementProgress(tween, nowMs, speed)
      : mv.progress;
  }
  return result;
}

/**
 * Computes a smooth continuous 0..1 stride animation phase for marching soldier sprites.
 */
export function computeMarchAnimPhase(
  nowMs: number,
  speed: SpeedLevel,
  fallbackProgress: number
): number {
  if (speed === 0) {
    return (fallbackProgress % 20) / 20;
  }
  const cycleMs = speed === 1 ? 520 : speed === 2 ? 420 : speed === 4 ? 340 : 280;
  return (nowMs % cycleMs) / cycleMs;
}
