import { Nation, Territory } from '../../types/game';
import { adjustOccupiedUnrestDrift } from '../simulationEngine';
import { RebellionCheckResult, scaleUnitComp } from './aiSharedUtils';

/**
 * Evaluates weekly unrest drift and triggers authentic rebellions in
 * unassimilated territories with unrest >= 85%.
 */
export function evaluateWeeklyUnrestAndRebellions(
  territories: Record<string, Territory>,
  nations: Record<string, Nation>
): RebellionCheckResult {
  const nextTerrs: Record<string, Territory> = { ...territories };
  const rebellionEvents: RebellionCheckResult['rebellionEvents'] = [];

  Object.values(nextTerrs).forEach((t) => {
    const owner = nations[t.ownerId];
    if (!owner) return;

    const isCore = t.coreOwnerId === t.ownerId;
    const welfareRelief = Math.max(0, ((owner.budget?.welfare ?? 15) - 20) * 0.08);
    const depotRelief = (t.buildings?.supplyDepot ?? 0) * 1.2;
    const taxPressure = Math.max(0, ((owner.taxRate ?? 30) - 30) * 0.15);

    let nextUnrest = t.unrest;
    if (!isCore) {
      const nonCoreDrift = 4.2 + taxPressure - depotRelief - welfareRelief;
      const adjustedDrift = adjustOccupiedUnrestDrift(owner, nonCoreDrift);
      nextUnrest = Math.max(
        5,
        Math.min(100, Math.round(t.unrest + adjustedDrift))
      );
    } else {
      const coreDrift = taxPressure - depotRelief - welfareRelief - 2.0;
      nextUnrest = Math.max(0, Math.min(100, Math.round(t.unrest + coreDrift)));
    }

    if (!isCore && nextUnrest >= 85) {
      if (t.garrison >= 15000) {
        const loss = 2500;
        const survivingRatio = Math.max(0.5, (t.garrison - loss) / t.garrison);
        nextTerrs[t.id] = {
          ...t,
          garrison: Math.max(2000, t.garrison - loss),
          units: scaleUnitComp(t.units, survivingRatio),
          unrest: 48,
        };
        rebellionEvents.push({
          territoryName: t.name,
          ownerId: t.ownerId,
          restoredOwnerId: t.coreOwnerId,
          crushed: true,
        });
      } else {
        const restoredId = nations[t.coreOwnerId] ? t.coreOwnerId : t.ownerId;
        nextTerrs[t.id] = {
          ...t,
          ownerId: restoredId,
          isOccupied: false,
          occupiedById: undefined,
          garrison: 12000,
          units: { infantry: 9500, armor: 2000, airDrone: 500 },
          unrest: 12,
        };
        rebellionEvents.push({
          territoryName: t.name,
          ownerId: t.ownerId,
          restoredOwnerId: restoredId,
          crushed: false,
        });
      }
    } else if (nextUnrest !== t.unrest) {
      nextTerrs[t.id] = {
        ...t,
        unrest: nextUnrest,
      };
    }
  });

  return {
    updatedTerritories: nextTerrs,
    rebellionEvents,
  };
}
