import { UnitComposition } from '../../types/game';

/** Scales a unit composition safely by a 0..1 ratio. */
export function scaleUnits(
  units: UnitComposition,
  ratio: number
): UnitComposition {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  return {
    infantry: Math.max(0, Math.round((units?.infantry || 0) * safeRatio)),
    armor: Math.max(0, Math.round((units?.armor || 0) * safeRatio)),
    airDrone: Math.max(0, Math.round((units?.airDrone || 0) * safeRatio)),
  };
}
