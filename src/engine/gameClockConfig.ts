import { SpeedLevel } from '../types/game';

export interface ClockSpeedProfile {
  speed: SpeedLevel;
  /** Real-time milliseconds between simulation steps */
  intervalMs: number;
  /** In-game hours advanced per simulation step */
  hoursStep: number;
  /** Short Turkish rate label for HUD */
  rateLabel: string;
}

/**
 * Realistic grand-strategy clock pacing:
 * Even at 5x, 1 in-game day takes ~1.62s (~49s/month, ~9.8 min/year),
 * ensuring wars, diplomacy pacts, and world events stay trackable and immersive
 * instead of blurring through entire years in 10-15 seconds.
 */
export const CLOCK_SPEED_PROFILES: Record<SpeedLevel, ClockSpeedProfile> = {
  0: {
    speed: 0,
    intervalMs: 0,
    hoursStep: 0,
    rateLabel: 'DURAKLATILDI',
  },
  1: {
    speed: 1,
    intervalMs: 720,
    hoursStep: 1,
    rateLabel: 'HIZ: 1x (+1 Saat)',
  },
  2: {
    speed: 2,
    intervalMs: 520,
    hoursStep: 2,
    rateLabel: 'HIZ: 2x (+2 Saat)',
  },
  4: {
    speed: 4,
    intervalMs: 380,
    hoursStep: 3,
    rateLabel: 'HIZ: 4x (+3 Saat)',
  },
  5: {
    speed: 5,
    intervalMs: 270,
    hoursStep: 4,
    rateLabel: 'HIZ: 5x (+4 Saat)',
  },
};

export function getClockSpeedProfile(speed: SpeedLevel): ClockSpeedProfile {
  return CLOCK_SPEED_PROFILES[speed] || CLOCK_SPEED_PROFILES[1];
}

/**
 * Computes approximate real seconds per in-game year at a given speed.
 * Used by tests and pacing telemetry to guarantee realistic game speed bounds.
 */
export function getRealSecondsPerGameYear(speed: SpeedLevel): number {
  const profile = getClockSpeedProfile(speed);
  if (profile.intervalMs <= 0 || profile.hoursStep <= 0) return Infinity;
  const ticksPerDay = 24 / profile.hoursStep;
  const secondsPerDay = (ticksPerDay * profile.intervalMs) / 1000;
  return secondsPerDay * 365;
}
