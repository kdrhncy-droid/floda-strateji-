import { scaleUnits } from './core/unitHelpers';
import {
  createTickContext,
  finalizeTickOutput,
  findAlliedLiberationBeneficiary,
  GameTickInput,
  GameTickOutput,
  pickEligibleCrisisEvent,
  TickSoundCue,
} from './tick/tickContext';
import { runMovementTickPhase } from './tick/movementTickPhase';
import { runCombatAndSiegeTickPhase } from './tick/combatAndSiegeTickPhase';
import { runDailyEconomyAndDiplomacyPhase } from './tick/dailyEconomyAndDiplomacyPhase';

export {
  scaleUnits,
  findAlliedLiberationBeneficiary,
  pickEligibleCrisisEvent,
};
export type { TickSoundCue, GameTickInput, GameTickOutput };

/**
 * Pure, single-pass atomic tick engine supporting both hourly steps (1..6 hours) and full-day ticks (24 hours).
 * - Preserves reference equality for `nations` and `territories` on hourly ticks when no territory/nation mutates,
 *   preventing unnecessary React re-renders and canvas polygon rebuilds (eliminating FPS drops during AI army movements).
 * - Simulates all battles directly on the World Map in real time (Age of History 3 style) without freezing gameplay.
 *
 * Orchestrates three focused phase modules under `./tick/`:
 * 1. `movementTickPhase` — army/naval marching, mid-march field & sea interceptions, strait blockades, arrivals.
 * 2. `combatAndSiegeTickPhase` — real-time on-map battles, city siege progression, wartime tactical AI & AI Commander.
 * 3. `dailyEconomyAndDiplomacyPhase` — daily economy, research, queues, weekly AI/rebellions/attrition, envoys, coalitions & crises.
 */
export function computeGameTick(input: GameTickInput): GameTickOutput {
  const ctx = createTickContext(input);
  runMovementTickPhase(ctx);
  runCombatAndSiegeTickPhase(ctx);
  if (ctx.dayWrapped) {
    runDailyEconomyAndDiplomacyPhase(ctx);
  }
  return finalizeTickOutput(ctx);
}
