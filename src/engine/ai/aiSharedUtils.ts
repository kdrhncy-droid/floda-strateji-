import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  IncomingDiplomaticOffer,
  Nation,
  Territory,
  UnitComposition,
  WorldNewsEvent,
} from '../../types/game';
import { STRATEGIC_STRAITS } from '../straitsAndTradeEngine';

export const STRATEGIC_STRAIT_SHORE_SET: ReadonlySet<string> = new Set(
  STRATEGIC_STRAITS.flatMap((s) => s.shoreIds)
);

export function scaleUnitComp(
  units: UnitComposition,
  ratio: number
): UnitComposition {
  return {
    infantry: Math.max(0, Math.round(units.infantry * ratio)),
    armor: Math.max(0, Math.round(units.armor * ratio)),
    airDrone: Math.max(0, Math.round(units.airDrone * ratio)),
  };
}

/**
 * Deterministic unsigned hash returning a float in [0, 1) from (seed, salt).
 * Ensures every campaign with a different worldSeed unfolds uniquely while
 * remaining reproducible for a given save.
 */
export function seededHash(seed: number, salt: string | number): number {
  let h = (Math.imul(seed | 0, 2654435761) ^ 0x811c9dc5) >>> 0;
  const str = String(salt);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Returns a new Fisher-Yates shuffled array derived from (seed, salt).
 */
export function seededShuffle<T>(
  items: readonly T[],
  seed: number,
  salt: string
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const r = seededHash(seed, `${salt}_${i}`);
    const j = Math.floor(r * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function computeRealmTotalTroops(
  nationId: string,
  territories: Record<string, Territory>,
  movements: ArmyMovement[]
): number {
  let total = 0;
  for (const t of Object.values(territories)) {
    if (t.ownerId === nationId) {
      total += t.garrison || 0;
    }
  }
  for (const mv of movements) {
    if (mv.ownerId === nationId) {
      total += mv.troops || 0;
    }
  }
  return total;
}

export interface AllianceCompatibilityResult {
  blocked: boolean;
  score: number;
  sharesCommonWarEnemy: boolean;
  sharesCommonThreat: boolean;
}

export interface AiTurnResult {
  updatedTerritories?: Record<string, Territory>;
  updatedNations?: Record<string, Nation>;
  updatedWars?: ActiveWar[];
  updatedRelations?: Record<string, DiplomaticRelation>;
  newMovement?: ArmyMovement;
  newWar?: ActiveWar;
  incomingOffer?: IncomingDiplomaticOffer;
  newsItem?: {
    title: string;
    description: string;
    type: WorldNewsEvent['type'];
  };
  playerAlert?: string;
}

export interface WartimeAiBatchResult {
  updatedTerritories: Record<string, Territory>;
  updatedNations: Record<string, Nation>;
  newMovements: ArmyMovement[];
  newsItems: {
    title: string;
    description: string;
    type: WorldNewsEvent['type'];
  }[];
  playerAlerts: string[];
}

export interface RebellionCheckResult {
  updatedTerritories: Record<string, Territory>;
  rebellionEvents: {
    territoryName: string;
    ownerId: string;
    restoredOwnerId: string;
    crushed: boolean;
  }[];
}
