import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
} from '../types/game';
import { getNationRulerName } from './pashaAndFiefEngine';
import { getLiveNationRulerName } from './dynastyAndSuccessionEngine';
import {
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
  isNationEmbargoed,
  isNationEmbargoing,
} from './simulationEngine';

export interface DiplomacyPeerEntry {
  nation: Nation;
  relationScore: number;
  provinceCount: number;
  totalArmy: number;
  warId?: string;
  warScore?: number;
  truceDaysRemaining?: number;
  embargoDirection?: 'OUTGOING' | 'INCOMING' | 'MUTUAL';
}

export interface ConqueredNationEntry {
  nation: Nation;
  capturedProvinceCount: number;
  isEliminated: boolean;
}

export interface NationDiplomacySummary {
  nation: Nation;
  rulerName: string;
  provinceCount: number;
  totalGarrison: number;
  marchingTroops: number;
  totalArmy: number;
  overlord: Nation | null;
  vassals: DiplomacyPeerEntry[];
  conqueredNations: ConqueredNationEntry[];
  activeWars: DiplomacyPeerEntry[];
  offensiveAllies: DiplomacyPeerEntry[];
  defensivePacts: DiplomacyPeerEntry[];
  tradePartners: DiplomacyPeerEntry[];
  nonAggressionPacts: DiplomacyPeerEntry[];
  activeTruces: DiplomacyPeerEntry[];
  militaryAccess: DiplomacyPeerEntry[];
  embargoes: DiplomacyPeerEntry[];
  friendlyNations: DiplomacyPeerEntry[];
  hostileNations: DiplomacyPeerEntry[];
}

/**
 * Pure AoH2/AoH3-style diplomatic web builder for ANY nation (player or AI).
 * Groups every active diplomatic treaty, war, truce, vassalage, embargo, conquered nation,
 * and standing so players can inspect their own or any foreign country's complete diplomatic network.
 */
export function buildNationDiplomacySummary(params: {
  targetNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  tick: number;
  gameMode: GameModeId;
}): NationDiplomacySummary | null {
  const {
    targetNationId,
    nations,
    territories,
    relations,
    wars,
    movements,
    tick,
    gameMode,
  } = params;

  const targetNation = nations[targetNationId];
  if (!targetNation) return null;

  // Precompute province counts, total military strength, and conquered foreign core provinces in a single O(T + M) pass
  const provCountByNation: Record<string, number> = {};
  const garrisonByNation: Record<string, number> = {};
  const capturedFromByOrigin: Record<string, number> = {};

  for (const t of Object.values(territories)) {
    if (!t?.ownerId) continue;
    provCountByNation[t.ownerId] = (provCountByNation[t.ownerId] || 0) + 1;
    garrisonByNation[t.ownerId] =
      (garrisonByNation[t.ownerId] || 0) + (t.garrison || 0);

    if (
      t.ownerId === targetNationId &&
      t.coreOwnerId &&
      t.coreOwnerId !== targetNationId &&
      nations[t.coreOwnerId]
    ) {
      capturedFromByOrigin[t.coreOwnerId] =
        (capturedFromByOrigin[t.coreOwnerId] || 0) + 1;
    }
  }

  // Also include eliminated nations whose capital territory is now owned by targetNationId (even if fully assimilated to core)
  for (const n of Object.values(nations)) {
    if (!n || n.id === targetNationId) continue;
    const remProvs = provCountByNation[n.id] || 0;
    if ((n.isEliminated || remProvs === 0) && !capturedFromByOrigin[n.id]) {
      const capTerr = territories[n.capitalTerritoryId] || territories[n.id];
      if (capTerr && capTerr.ownerId === targetNationId) {
        capturedFromByOrigin[n.id] = 1;
      }
    }
  }

  const conqueredNations: ConqueredNationEntry[] = Object.entries(
    capturedFromByOrigin
  )
    .map(([originId, count]) => {
      const originNat = nations[originId];
      if (!originNat) return null;
      const remProvs = provCountByNation[originId] || 0;
      return {
        nation: originNat,
        capturedProvinceCount: count,
        isEliminated: Boolean(originNat.isEliminated || remProvs === 0),
      };
    })
    .filter((entry): entry is ConqueredNationEntry => entry !== null)
    .sort(
      (a, b) =>
        Number(b.isEliminated) - Number(a.isEliminated) ||
        b.capturedProvinceCount - a.capturedProvinceCount
    );

  const marchingByNation: Record<string, number> = {};
  for (const mv of movements) {
    if (!mv?.ownerId) continue;
    marchingByNation[mv.ownerId] =
      (marchingByNation[mv.ownerId] || 0) + (mv.troops || 0);
  }

  const makeBaseEntry = (other: Nation, score: number): DiplomacyPeerEntry => ({
    nation: other,
    relationScore: score,
    provinceCount: provCountByNation[other.id] || 0,
    totalArmy:
      (garrisonByNation[other.id] || 0) + (marchingByNation[other.id] || 0),
  });

  const overlord =
    targetNation.vassalOf &&
    nations[targetNation.vassalOf] &&
    !nations[targetNation.vassalOf].isEliminated
      ? nations[targetNation.vassalOf]
      : null;

  const vassals: DiplomacyPeerEntry[] = [];
  const activeWars: DiplomacyPeerEntry[] = [];
  const offensiveAllies: DiplomacyPeerEntry[] = [];
  const defensivePacts: DiplomacyPeerEntry[] = [];
  const tradePartners: DiplomacyPeerEntry[] = [];
  const nonAggressionPacts: DiplomacyPeerEntry[] = [];
  const activeTruces: DiplomacyPeerEntry[] = [];
  const militaryAccess: DiplomacyPeerEntry[] = [];
  const embargoes: DiplomacyPeerEntry[] = [];
  const friendlyNations: DiplomacyPeerEntry[] = [];
  const hostileNations: DiplomacyPeerEntry[] = [];

  for (const other of Object.values(nations)) {
    if (!other || other.id === targetNationId || other.isEliminated) continue;
    if ((provCountByNation[other.id] || 0) === 0) continue;

    const rel = getOrCreateRelation(relations, targetNationId, other.id);
    const war = isAtWar(wars, targetNationId, other.id);

    if (other.vassalOf === targetNationId) {
      vassals.push(makeBaseEntry(other, rel.score));
    }

    if (war) {
      const warScore = getWarScoreForNation(war, targetNationId) ?? 0;
      activeWars.push({
        ...makeBaseEntry(other, rel.score),
        warId: war.id,
        warScore,
      });
    }

    if (rel.allianceType === 'OFFENSIVE' || (rel.isAllied && !rel.allianceType)) {
      offensiveAllies.push(makeBaseEntry(other, rel.score));
    } else if (rel.allianceType === 'DEFENSIVE') {
      defensivePacts.push(makeBaseEntry(other, rel.score));
    }

    if (rel.hasTradeAgreement) {
      tradePartners.push(makeBaseEntry(other, rel.score));
    }

    if (rel.hasNonAggression) {
      nonAggressionPacts.push(makeBaseEntry(other, rel.score));
    }

    if (rel.truceUntilTick > tick) {
      activeTruces.push({
        ...makeBaseEntry(other, rel.score),
        truceDaysRemaining: Math.max(1, rel.truceUntilTick - tick),
      });
    }

    if (rel.hasMilitaryAccess) {
      militaryAccess.push(makeBaseEntry(other, rel.score));
    }

    const outgoingEmbargo = isNationEmbargoing(rel, targetNationId);
    const incomingEmbargo = isNationEmbargoed(rel, targetNationId);
    if (outgoingEmbargo || incomingEmbargo) {
      embargoes.push({
        ...makeBaseEntry(other, rel.score),
        embargoDirection:
          outgoingEmbargo && incomingEmbargo
            ? 'MUTUAL'
            : outgoingEmbargo
            ? 'OUTGOING'
            : 'INCOMING',
      });
    }

    if (!war && rel.score >= 25) {
      friendlyNations.push(makeBaseEntry(other, rel.score));
    } else if (!war && rel.score <= -25) {
      hostileNations.push(makeBaseEntry(other, rel.score));
    }
  }

  const sortByScoreDesc = (a: DiplomacyPeerEntry, b: DiplomacyPeerEntry) =>
    b.relationScore - a.relationScore || b.totalArmy - a.totalArmy;
  const sortByScoreAsc = (a: DiplomacyPeerEntry, b: DiplomacyPeerEntry) =>
    a.relationScore - b.relationScore || b.totalArmy - a.totalArmy;
  const sortByArmyDesc = (a: DiplomacyPeerEntry, b: DiplomacyPeerEntry) =>
    b.totalArmy - a.totalArmy;

  vassals.sort(sortByArmyDesc);
  activeWars.sort(sortByArmyDesc);
  offensiveAllies.sort(sortByScoreDesc);
  defensivePacts.sort(sortByScoreDesc);
  tradePartners.sort(sortByScoreDesc);
  nonAggressionPacts.sort(sortByScoreDesc);
  activeTruces.sort(
    (a, b) => (b.truceDaysRemaining || 0) - (a.truceDaysRemaining || 0)
  );
  militaryAccess.sort(sortByScoreDesc);
  embargoes.sort(sortByScoreAsc);
  friendlyNations.sort(sortByScoreDesc);
  hostileNations.sort(sortByScoreAsc);

  const totalGarrison = garrisonByNation[targetNationId] || 0;
  const marchingTroops = marchingByNation[targetNationId] || 0;

  return {
    nation: targetNation,
    rulerName: getLiveNationRulerName(
      targetNation,
      getNationRulerName(targetNationId, gameMode)
    ),
    provinceCount: provCountByNation[targetNationId] || 0,
    totalGarrison,
    marchingTroops,
    totalArmy: totalGarrison + marchingTroops,
    overlord,
    vassals,
    conqueredNations,
    activeWars,
    offensiveAllies,
    defensivePacts,
    tradePartners,
    nonAggressionPacts,
    activeTruces,
    militaryAccess,
    embargoes,
    friendlyNations,
    hostileNations,
  };
}
