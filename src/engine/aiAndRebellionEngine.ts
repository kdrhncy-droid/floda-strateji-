import {
  PRESET_COUNTRIES_2026,
  getNationModernizedTier,
  getNationUnlockedMilTier,
  getTechTreeForMode,
} from '../data/world2026Data';
import {
  ActiveWar,
  ArmyMovement,
  BuildingType,
  DiplomaticRelation,
  GameModeId,
  IncomingDiplomaticOffer,
  Nation,
  SeaArmy,
  Territory,
  UnitComposition,
  WorldNewsEvent,
} from '../types/game';
import { AiAggressivenessLevel } from './gameSettings';
import { findArmyRouteAStar } from './pathfindingEngine';
import { STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import {
  adjustOccupiedUnrestDrift,
  calculateProvinceDevelopment,
  getEmbargoingNationIds,
  getOrCreateRelation,
  isAtWar,
  resolveWarParticipants,
} from './simulationEngine';
import {
  AI_PERSONALITY_META,
  calculateProvinceSupplyLimit,
  getGameSeason,
  resolveNationAiPersonality,
} from './seasonSupplyAndAiProfile';
import {
  applyConquestDiplomaticPenalty,
  calculateProjectedPeaceAE,
} from './core/diplomacyHelpers';
import { isTerritoryCoastal, relationKey } from './worldBuilder';

const STRATEGIC_STRAIT_SHORE_SET: ReadonlySet<string> = new Set(
  STRATEGIC_STRAITS.flatMap((s) => s.shoreIds)
);

function scaleUnitComp(units: UnitComposition, ratio: number): UnitComposition {
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

export interface AllianceCompatibilityResult {
  blocked: boolean;
  score: number;
  sharesCommonWarEnemy: boolean;
  sharesCommonThreat: boolean;
}

/**
 * Scores geopolitical alliance compatibility between two nations and enforces
 * hard diplomatic guardrails (no allying with war enemies, embargoers,
 * vassals, or allies of our active war enemies).
 */
export function computeAllianceCompatibilityScore(params: {
  actor: Nation;
  peer: Nation;
  rel: DiplomaticRelation;
  wars: ActiveWar[];
  relations: Record<string, DiplomaticRelation>;
  nations: Record<string, Nation>;
  gameMode: GameModeId;
  threatNeighborIds: string[];
  actorPersonality?: string;
  isDirectNeighbor?: boolean;
  peerOwnsActorCore?: boolean;
}): AllianceCompatibilityResult {
  const {
    actor,
    peer,
    rel,
    wars,
    relations,
    nations,
    gameMode,
    threatNeighborIds,
    actorPersonality,
    isDirectNeighbor = false,
    peerOwnsActorCore = false,
  } = params;

  const zeroBlocked: AllianceCompatibilityResult = {
    blocked: true,
    score: -100,
    sharesCommonWarEnemy: false,
    sharesCommonThreat: false,
  };

  if (
    !actor ||
    !peer ||
    actor.id === peer.id ||
    actor.isEliminated ||
    peer.isEliminated
  ) {
    return zeroBlocked;
  }

  // Hard guardrails: active war, embargo, vassalage, or deep hatred
  if (isAtWar(wars, actor.id, peer.id)) return zeroBlocked;
  if (rel.hasEmbargo || getEmbargoingNationIds(rel).length > 0) return zeroBlocked;
  if (actor.vassalOf || peer.vassalOf) return zeroBlocked;
  if (rel.score <= -25) return zeroBlocked;

  // Never ally with a nation that is allied to one of our active war enemies (or vice versa)
  const actorEnemies = new Set<string>();
  const peerEnemies = new Set<string>();
  for (const w of wars) {
    if (w.attackers.includes(actor.id)) {
      w.defenders.forEach((id) => actorEnemies.add(id));
    } else if (w.defenders.includes(actor.id)) {
      w.attackers.forEach((id) => actorEnemies.add(id));
    }
    if (w.attackers.includes(peer.id)) {
      w.defenders.forEach((id) => peerEnemies.add(id));
    } else if (w.defenders.includes(peer.id)) {
      w.attackers.forEach((id) => peerEnemies.add(id));
    }
  }

  for (const enemyId of actorEnemies) {
    const peerRelToEnemy = getOrCreateRelation(relations, peer.id, enemyId);
    if (peerRelToEnemy.isAllied || Boolean(peerRelToEnemy.allianceType)) {
      return zeroBlocked;
    }
  }
  for (const enemyId of peerEnemies) {
    const actorRelToEnemy = getOrCreateRelation(relations, actor.id, enemyId);
    if (actorRelToEnemy.isAllied || Boolean(actorRelToEnemy.allianceType)) {
      return zeroBlocked;
    }
  }

  let sharesCommonWarEnemy = false;
  for (const enemyId of actorEnemies) {
    if (peerEnemies.has(enemyId)) {
      sharesCommonWarEnemy = true;
      break;
    }
  }

  const sharesCommonThreat = threatNeighborIds.some((threatId) => {
    if (threatId === peer.id) return false;
    const peerRelToThreat = getOrCreateRelation(relations, peer.id, threatId);
    return (
      peerRelToThreat.score <= -15 ||
      (nations[threatId]?.aggressiveExpansion ?? 0) >= 35
    );
  });

  let score = rel.score * 0.75;
  if (sharesCommonWarEnemy) score += 32;
  if (sharesCommonThreat) score += 20;

  // Shared faith (stronger in 1440 historical era)
  if (actor.stateReligion && peer.stateReligion) {
    if (actor.stateReligion === peer.stateReligion) {
      score += gameMode === 'EMPIRES_1440' ? 12 : 4;
    } else if (gameMode === 'EMPIRES_1440') {
      score -= 6;
    }
  }

  // Ideology alignment (stronger in 2026 modern era)
  if (actor.ideology === peer.ideology) {
    score += gameMode !== 'EMPIRES_1440' ? 10 : 5;
  } else if (
    (actor.ideology === 'DEMOCRACY' &&
      (peer.ideology === 'AUTHORITARIAN' || peer.ideology === 'MILITARY_JUNTA')) ||
    ((actor.ideology === 'AUTHORITARIAN' || actor.ideology === 'MILITARY_JUNTA') &&
      peer.ideology === 'DEMOCRACY')
  ) {
    score -= 8;
  }

  // Existing diplomatic warmth & trust
  if (rel.hasTradeAgreement) score += 8;
  if (rel.hasNonAggression) score += 8;
  if (rel.hasMilitaryAccess) score += 4;

  // Aggressive expansion deterrence
  if ((peer.aggressiveExpansion || 0) >= 45) score -= 28;
  else if ((peer.aggressiveExpansion || 0) >= 30) score -= 14;

  // Border ambition / revanchist friction
  if (peerOwnsActorCore) score -= 24;
  if (
    isDirectNeighbor &&
    (actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST') &&
    !sharesCommonThreat
  ) {
    score -= 8;
  }

  return {
    blocked: false,
    score: Math.round(score),
    sharesCommonWarEnemy,
    sharesCommonThreat,
  };
}

function computeRealmTotalTroops(
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

/**
 * Evaluates active wartime operations for AI nations currently in a war.
 * Runs daily (and on war declaration / mid-day) so enemy countries actively mobilize reserves,
 * reinforce frontline provinces, and launch counter-attacks against the player and AI foes.
 */
export function evaluateWartimeAiOperations(params: {
  nextTick: number;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  seaArmies?: SeaArmy[];
  aiAggressiveness: AiAggressivenessLevel;
  maxActionsPerPass?: number;
  maxActorsScanned?: number;
}): WartimeAiBatchResult | null {
  const {
    nextTick,
    playerNationId,
    nations,
    territories,
    relations,
    wars,
    movements,
    seaArmies = [],
    aiAggressiveness,
    maxActionsPerPass = 3,
    maxActorsScanned,
  } = params;

  if (wars.length === 0) return null;

  // Build O(1) enemy lookup sets and collect all non-eliminated AI nations currently in an active war
  const warAiSet = new Set<string>();
  const enemyIdsByNation = new Map<string, Set<string>>();
  const addEnemyEdge = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    let set = enemyIdsByNation.get(a);
    if (!set) {
      set = new Set<string>();
      enemyIdsByNation.set(a, set);
    }
    set.add(b);
  };

  for (const w of wars) {
    const attSide = w.attackers.length > 0 ? w.attackers : [w.attackerId];
    const defSide = w.defenders.length > 0 ? w.defenders : [w.defenderId];
    for (const a of attSide) {
      if (a && a !== playerNationId && nations[a] && !nations[a].isEliminated) {
        warAiSet.add(a);
      }
      for (const d of defSide) {
        addEnemyEdge(a, d);
        addEnemyEdge(d, a);
      }
    }
    for (const d of defSide) {
      if (d && d !== playerNationId && nations[d] && !nations[d].isEliminated) {
        warAiSet.add(d);
      }
    }
    if (w.attackerId && w.defenderId) {
      addEnemyEdge(w.attackerId, w.defenderId);
      addEnemyEdge(w.defenderId, w.attackerId);
      if (w.attackerId !== playerNationId && nations[w.attackerId] && !nations[w.attackerId].isEliminated) {
        warAiSet.add(w.attackerId);
      }
      if (w.defenderId !== playerNationId && nations[w.defenderId] && !nations[w.defenderId].isEliminated) {
        warAiSet.add(w.defenderId);
      }
    }
  }
  if (warAiSet.size === 0) return null;

  const playerEnemies = enemyIdsByNation.get(playerNationId);

  // Prioritize AI nations directly at war with the player; rotate remaining AI-vs-AI combatants deterministically
  const warAiIds = Array.from(warAiSet).sort((a, b) => {
    const aVsPlayer = playerEnemies?.has(a) ? 0 : 1;
    const bVsPlayer = playerEnemies?.has(b) ? 0 : 1;
    if (aVsPlayer !== bVsPlayer) return aVsPlayer - bVsPlayer;
    return ((nextTick + a.charCodeAt(0)) % 7) - ((nextTick + b.charCodeAt(0)) % 7);
  });

  // Single O(N) pass over territories to index owned provinces, coastal provinces, and lost cores
  const provsByOwner = new Map<string, Territory[]>();
  const coastalProvsByOwner = new Map<string, Territory[]>();
  const lostCoreOwnerIds = new Set<string>();
  for (const t of Object.values(territories)) {
    if (!t || !t.ownerId) continue;
    let list = provsByOwner.get(t.ownerId);
    if (!list) {
      list = [];
      provsByOwner.set(t.ownerId, list);
    }
    list.push(t);
    if (t.centroid && isTerritoryCoastal(t)) {
      let cList = coastalProvsByOwner.get(t.ownerId);
      if (!cList) {
        cList = [];
        coastalProvsByOwner.set(t.ownerId, cList);
      }
      cList.push(t);
    }
    if (t.coreOwnerId && t.coreOwnerId !== t.ownerId) {
      lostCoreOwnerIds.add(t.coreOwnerId);
    }
  }

  // Single O(M) pass over movements to pre-index active counts, origins, targets, naval flags, and incoming attacks
  const activeMoveCountByOwner = new Map<string, number>();
  const marchingFromKeys = new Set<string>();
  const targetedKeys = new Set<string>();
  const navalMoveOwners = new Set<string>();
  const incomingAttackByTerr = new Map<string, { total: number; byOwner: Map<string, number> }>();

  for (const m of movements) {
    activeMoveCountByOwner.set(m.ownerId, (activeMoveCountByOwner.get(m.ownerId) || 0) + 1);
    marchingFromKeys.add(`${m.ownerId}|${m.fromTerritoryId}`);
    if (m.toTerritoryId) {
      targetedKeys.add(`${m.ownerId}|${m.toTerritoryId}`);
    }
    if (m.isNaval) {
      navalMoveOwners.add(m.ownerId);
    }
    if (m.isAttack && m.toTerritoryId) {
      let entry = incomingAttackByTerr.get(m.toTerritoryId);
      if (!entry) {
        entry = { total: 0, byOwner: new Map<string, number>() };
        incomingAttackByTerr.set(m.toTerritoryId, entry);
      }
      entry.total += m.troops;
      entry.byOwner.set(m.ownerId, (entry.byOwner.get(m.ownerId) || 0) + m.troops);
    }
  }

  // Lazy copy-on-write maps so no-op passes do zero 900-entry object clones
  let nationsCloned = false;
  let territoriesCloned = false;
  let nextNations: Record<string, Nation> = nations;
  let nextTerritories: Record<string, Territory> = territories;
  const writeNation = (id: string, nat: Nation) => {
    if (!nationsCloned) {
      nextNations = { ...nations };
      nationsCloned = true;
    }
    nextNations[id] = nat;
  };
  const writeTerritory = (id: string, terr: Territory) => {
    if (!territoriesCloned) {
      nextTerritories = { ...territories };
      territoriesCloned = true;
    }
    nextTerritories[id] = terr;
  };

  const newMovements: ArmyMovement[] = [];
  const newsItems: WartimeAiBatchResult['newsItems'] = [];
  const playerAlerts: string[] = [];
  let actionsCount = 0;
  let actorsScanned = 0;

  const recordNewMovement = (mv: ArmyMovement) => {
    newMovements.push(mv);
    activeMoveCountByOwner.set(mv.ownerId, (activeMoveCountByOwner.get(mv.ownerId) || 0) + 1);
    marchingFromKeys.add(`${mv.ownerId}|${mv.fromTerritoryId}`);
    if (mv.toTerritoryId) {
      targetedKeys.add(`${mv.ownerId}|${mv.toTerritoryId}`);
    }
    if (mv.isNaval) {
      navalMoveOwners.add(mv.ownerId);
    }
  };

  for (const actorId of warAiIds) {
    if (actionsCount >= maxActionsPerPass) break;
    if (
      maxActorsScanned !== undefined &&
      actorsScanned >= maxActorsScanned &&
      !playerEnemies?.has(actorId)
    ) {
      break;
    }
    actorsScanned++;

    let actorNation = nextNations[actorId];
    if (!actorNation || actorNation.isEliminated) continue;

    // Avoid spamming if this AI already has 2+ armies marching simultaneously
    const existingAiMoves = activeMoveCountByOwner.get(actorId) || 0;
    if (existingAiMoves >= 2) continue;

    const baseOwnedProvs = provsByOwner.get(actorId);
    if (!baseOwnedProvs || baseOwnedProvs.length === 0) continue;
    const ownedProvs = baseOwnedProvs.map((p) => nextTerritories[p.id]);
    const actorEnemies = enemyIdsByNation.get(actorId);
    if (!actorEnemies || actorEnemies.size === 0) continue;

    // Identify frontline provinces (directly bordering a war enemy) and threatened homeland/sieged provinces
    const frontlineProvs = ownedProvs.filter((p) =>
      p.neighbors.some((nbId) => {
        const nb = nextTerritories[nbId];
        return Boolean(nb && nb.ownerId !== actorId && actorEnemies.has(nb.ownerId));
      })
    );

    const straitShoreSet = STRATEGIC_STRAIT_SHORE_SET;

    // Identify highest-threat friendly province (under siege, capital bordering stronger enemy, or outnumbered border)
    const getProvinceThreatScore = (p: Territory): number => {
      let adjacentEnemyTroops = 0;
      for (const nbId of p.neighbors) {
        const nb = nextTerritories[nbId];
        if (nb && nb.ownerId !== actorId && actorEnemies.has(nb.ownerId)) {
          adjacentEnemyTroops += nb.garrison || 0;
        }
      }
      const inc = incomingAttackByTerr.get(p.id);
      const incomingEnemyTroops = inc
        ? inc.total - (inc.byOwner.get(actorId) || 0)
        : 0;
      const totalThreat = adjacentEnemyTroops * 0.55 + incomingEnemyTroops;
      const deficit = totalThreat - p.garrison;
      let score = deficit;
      if (p.siege) score += 18000;
      if (p.isCapital || p.id === actorNation.capitalTerritoryId) score += 12000;
      if (straitShoreSet.has(p.id)) score += 4500;
      return score;
    };

    const threatenedProvs = [...frontlineProvs].sort(
      (a, b) => getProvinceThreatScore(b) - getProvinceThreatScore(a)
    );

    // Step 1: Proportional Multi-Front Wartime Mobilization scaled by empire size, treasury & AI personality
    if (
      frontlineProvs.length > 0 &&
      actorNation.treasury >= 200 &&
      actorNation.manpower >= 2200
    ) {
      const personality = resolveNationAiPersonality(
        actorNation,
        nextTerritories,
        lostCoreOwnerIds
      );
      const scaleBonus = Math.min(8500, Math.max(0, ownedProvs.length - 1) * 1250);
      const personalityLevyMult =
        personality === 'CONQUEROR' || personality === 'REVANCHIST'
          ? 1.18
          : personality === 'DEFENDER'
          ? 1.05
          : 0.92;
      const baseLevyCap = Math.round(
        ((aiAggressiveness === 'CHAOS' || aiAggressiveness === 'AGGRESSIVE'
          ? 7000
          : 5200) +
          scaleBonus) *
          personalityLevyMult
      );

      // Large wealthy empires can reinforce up to 2 distinct frontlines per wartime pass
      const maxLevyFronts =
        ownedProvs.length >= 4 &&
        actorNation.treasury >= 950 &&
        actorNation.manpower >= 12000
          ? 2
          : 1;

      const unbesiegedThreatened = threatenedProvs.filter((p) => !p.siege);
      const unbesiegedFrontline = frontlineProvs.filter((p) => !p.siege);
      const levyTargets: Territory[] = [];
      const primaryTarget =
        unbesiegedThreatened[0] && getProvinceThreatScore(unbesiegedThreatened[0]) > 3000
          ? unbesiegedThreatened[0]
          : [...unbesiegedFrontline].sort((a, b) => b.garrison - a.garrison)[0];
      if (primaryTarget) levyTargets.push(primaryTarget);
      if (maxLevyFronts > 1) {
        const secondaryTarget = unbesiegedThreatened.find(
          (p) => p.id !== primaryTarget?.id && p.garrison < 38000
        );
        if (secondaryTarget) levyTargets.push(secondaryTarget);
      }

      for (const bolsterTarget of levyTargets) {
        const liveTarget = nextTerritories[bolsterTarget.id] || bolsterTarget;
        const maxGarrisonCap = Math.min(54000, 32000 + ownedProvs.length * 2200);
        if (
          liveTarget.siege ||
          liveTarget.garrison >= maxGarrisonCap ||
          actorNation.treasury < 200 ||
          actorNation.manpower < 2200
        ) {
          continue;
        }
        const levyTroops = Math.min(
          actorNation.manpower,
          Math.max(2000, Math.round(baseLevyCap / levyTargets.length))
        );
        const goldCost = Math.min(
          actorNation.treasury,
          Math.max(160, Math.round(levyTroops * 0.036))
        );
        if (levyTroops >= 1500 && actorNation.treasury >= goldCost) {
          actorNation = {
            ...actorNation,
            treasury: Math.max(0, actorNation.treasury - goldCost),
            manpower: Math.max(0, actorNation.manpower - levyTroops),
          };
          writeNation(actorId, actorNation);
          const updatedTarget: Territory = {
            ...liveTarget,
            garrison: liveTarget.garrison + levyTroops,
            units: {
              infantry:
                (liveTarget.units?.infantry || liveTarget.garrison) +
                Math.round(levyTroops * 0.62),
              armor:
                (liveTarget.units?.armor || 0) +
                Math.round(levyTroops * 0.25),
              airDrone:
                (liveTarget.units?.airDrone || 0) +
                Math.round(levyTroops * 0.13),
            },
          };
          writeTerritory(liveTarget.id, updatedTarget);
        }
      }
    }

    // Refresh ownedProvs after potential levy
    const refreshedOwned = ownedProvs.map((p) => nextTerritories[p.id]);

    // Step 1B: Capital & Siege Emergency Relief March before launching distant offensives
    const criticalDefenseProv = refreshedOwned
      .filter(
        (p) =>
          p &&
          (Boolean(p.siege) ||
            ((p.isCapital || p.id === actorNation.capitalTerritoryId) &&
              getProvinceThreatScore(p) > 7500))
      )
      .sort((a, b) => getProvinceThreatScore(b) - getProvinceThreatScore(a))[0];

    if (criticalDefenseProv) {
      const reliefDonor = refreshedOwned
        .filter(
          (p) =>
            p &&
            p.id !== criticalDefenseProv.id &&
            p.garrison >= 8500 &&
            !p.siege &&
            !marchingFromKeys.has(`${actorId}|${p.id}`)
        )
        .sort((a, b) => b.garrison - a.garrison)[0];

      if (reliefDonor) {
        const reliefRoute = findArmyRouteAStar({
          fromId: reliefDonor.id,
          toId: criticalDefenseProv.id,
          moverNationId: actorId,
          territories: nextTerritories,
          nations: nextNations,
          relations,
          wars,
        });
        if (reliefRoute.reachable && reliefRoute.hops.length > 0) {
          const reliefRatio = 0.65;
          const reliefTroops = Math.round(reliefDonor.garrison * reliefRatio);
          writeTerritory(reliefDonor.id, {
            ...reliefDonor,
            garrison: Math.max(1500, reliefDonor.garrison - reliefTroops),
            units: scaleUnitComp(reliefDonor.units, 1 - reliefRatio),
          });
          recordNewMovement({
            id: `ai_relief_${nextTick}_${reliefDonor.id}`,
            ownerId: actorId,
            fromTerritoryId: reliefDonor.id,
            toTerritoryId: reliefRoute.hops[0],
            finalDestinationId: criticalDefenseProv.id,
            routeQueue: reliefRoute.hops.slice(1),
            troops: reliefTroops,
            units: scaleUnitComp(reliefDonor.units, reliefRatio),
            progress: 22,
            isAttack: false,
          });
          actionsCount++;
          continue;
        }
      }
    }

    // Step 2: Strategic Border Counter-Attack / Offensive Sortie
    // Smartly scores enemy targets (reclaiming own cores, enemy capitals, straits, avoiding costly mountain/fort traps)
    const scoreEnemyTarget = (enemyTerr: Territory): number => {
      let priority = -enemyTerr.garrison;
      if (enemyTerr.coreOwnerId === actorId) priority += 5500; // Reclaim occupied homeland first
      if (enemyTerr.isCapital || enemyTerr.id === nextNations[enemyTerr.ownerId]?.capitalTerritoryId) {
        priority += 5000;
      }
      if (straitShoreSet.has(enemyTerr.id)) priority += 2800;
      if (enemyTerr.ownerId === playerNationId) priority += 2200;
      if (enemyTerr.terrain === 'DAGLIK') priority -= 2600;
      priority -= (enemyTerr.buildings?.fortress || 0) * 1800;
      return priority;
    };

    const allEnemyWarProvs: Territory[] = [];
    for (const enemyId of actorEnemies) {
      const eList = provsByOwner.get(enemyId);
      if (!eList) continue;
      for (const ep of eList) {
        allEnemyWarProvs.push(nextTerritories[ep.id]);
      }
    }
    const actorTotalGarrison = refreshedOwned.reduce(
      (sum, p) => sum + (p?.garrison || 0),
      0
    );
    const enemyTotalGarrison = allEnemyWarProvs.reduce(
      (sum, p) => sum + (p?.garrison || 0),
      0
    );
    const isEnemyMopUp =
      allEnemyWarProvs.length > 0 &&
      allEnemyWarProvs.length <= 3 &&
      refreshedOwned.length > allEnemyWarProvs.length &&
      actorTotalGarrison >= Math.max(6000, enemyTotalGarrison * 2.2);

    let launchedSortie = false;
    const minCandidateGarrison = isEnemyMopUp ? 1800 : 6500;
    const sortieCandidates = refreshedOwned
      .filter((p) => p && p.garrison >= minCandidateGarrison && !p.siege)
      .sort((a, b) => b.garrison - a.garrison);

    for (const srcProv of sortieCandidates) {
      if (marchingFromKeys.has(`${actorId}|${srcProv.id}`)) continue;

      const enemyNeighbors = srcProv.neighbors
        .map((nId) => nextTerritories[nId])
        .filter(
          (nTerr): nTerr is Territory =>
            Boolean(nTerr) &&
            nTerr.ownerId !== actorId &&
            actorEnemies.has(nTerr.ownerId)
        )
        .sort((a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a));

      if (enemyNeighbors.length === 0) continue;

      // Never strip our capital bare if multiple strong enemies border it
      const isSrcCapital =
        srcProv.isCapital || srcProv.id === actorNation.capitalTerritoryId;
      const sendRatio = isEnemyMopUp
        ? isSrcCapital
          ? 0.65
          : 0.76
        : isSrcCapital
        ? 0.52
        : srcProv.garrison >= 18000
        ? 0.64
        : 0.56;
      const dispatchable = Math.round(srcProv.garrison * sendRatio);
      const minDispatchFloor = isEnemyMopUp ? 900 : 3500;
      if (dispatchable < minDispatchFloor) continue;

      const viableTarget = enemyNeighbors.find((enemyTerr) => {
        const alreadyTargetedByUs = targetedKeys.has(`${actorId}|${enemyTerr.id}`);
        if (alreadyTargetedByUs && !isEnemyMopUp) return false;

        const baseMinRatio =
          aiAggressiveness === 'PASSIVE'
            ? 1.2
            : aiAggressiveness === 'NORMAL'
            ? 0.96
            : aiAggressiveness === 'AGGRESSIVE'
            ? 0.82
            : 0.68;

        const terrainFortFactor =
          1 +
          (enemyTerr.terrain === 'DAGLIK' ? 0.18 : enemyTerr.terrain === 'METROPOL' ? 0.1 : 0) +
          (enemyTerr.buildings?.fortress || 0) * 0.08;
        const requiredTroops = Math.max(
          isEnemyMopUp ? 800 : 2600,
          enemyTerr.garrison * (isEnemyMopUp ? baseMinRatio * 0.85 : baseMinRatio) * terrainFortFactor
        );

        return (
          dispatchable >= requiredTroops ||
          (dispatchable >= 18000 && dispatchable >= enemyTerr.garrison * 0.95)
        );
      });

      if (viableTarget) {
        const sendUnits = scaleUnitComp(srcProv.units, sendRatio);
        const remainingGarrison = Math.max(
          isEnemyMopUp ? 600 : srcProv.garrison >= 5000 ? 2500 : 1200,
          srcProv.garrison - dispatchable
        );
        writeTerritory(srcProv.id, {
          ...srcProv,
          garrison: remainingGarrison,
          units: scaleUnitComp(
            srcProv.units,
            remainingGarrison / Math.max(1, srcProv.garrison)
          ),
        });

        recordNewMovement({
          id: `ai_war_mv_${nextTick}_${srcProv.id}_${viableTarget.id}`,
          ownerId: actorId,
          fromTerritoryId: srcProv.id,
          toTerritoryId: viableTarget.id,
          finalDestinationId: viableTarget.id,
          troops: dispatchable,
          units: sendUnits,
          progress: 16,
          isAttack: true,
        });

        if (viableTarget.ownerId === playerNationId) {
          playerAlerts.push(
            `⚔️ DÜŞMAN TAARRUZU: ${actorNation.name} ordusu (${dispatchable.toLocaleString('tr-TR')} asker) ${srcProv.name} üzerinden ${viableTarget.name} eyaletimize saldırıya geçti!`
          );
          newsItems.push({
            title: `⚔️ ${actorNation.name} Karşı Taarruzu: ${viableTarget.name}`,
            description: `${actorNation.name} komutanlığı ${srcProv.name} cephesinden ${viableTarget.name} eyaletimize ${dispatchable.toLocaleString('tr-TR')} kişilik orduyla taarruz başlattı!`,
            type: 'WAR',
          });
        }

        actionsCount++;
        launchedSortie = true;
        break;
      }
    }

    // Step 2B: Multi-Province Coordinated Pincer on Remaining Enemy Holdouts
    if (!launchedSortie && isEnemyMopUp && allEnemyWarProvs.length > 0) {
      const sortedHoldouts = [...allEnemyWarProvs].sort(
        (a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a)
      );
      for (const enemyHoldout of sortedHoldouts) {
        const adjDonors = enemyHoldout.neighbors
          .map((nId) => nextTerritories[nId])
          .filter(
            (p): p is Territory =>
              Boolean(p) &&
              p.ownerId === actorId &&
              !p.siege &&
              p.garrison >= 1600 &&
              !marchingFromKeys.has(`${actorId}|${p.id}`)
          );
        if (adjDonors.length < 2) continue;
        const pooledSendable = adjDonors.reduce(
          (sum, d) => sum + Math.max(0, d.garrison - 750),
          0
        );
        if (pooledSendable >= Math.max(1800, enemyHoldout.garrison * 1.05)) {
          for (const donor of adjDonors.slice(0, 3)) {
            const sendAmt = Math.max(0, donor.garrison - 750);
            if (sendAmt < 600) continue;
            const ratio = sendAmt / Math.max(1, donor.garrison);
            writeTerritory(donor.id, {
              ...donor,
              garrison: 750,
              units: scaleUnitComp(donor.units, 1 - ratio),
            });
            recordNewMovement({
              id: `ai_pincer_mv_${nextTick}_${donor.id}_${enemyHoldout.id}`,
              ownerId: actorId,
              fromTerritoryId: donor.id,
              toTerritoryId: enemyHoldout.id,
              finalDestinationId: enemyHoldout.id,
              troops: sendAmt,
              units: scaleUnitComp(donor.units, ratio),
              progress: 18,
              isAttack: true,
            });
          }
          actionsCount++;
          launchedSortie = true;
          break;
        }
      }
    }

    if (launchedSortie) continue;

    // Step 3: Multi-Hop Frontline Concentration & Direct Enemy Pocket March
    const rearMinGarrison = isEnemyMopUp ? 2200 : 6000;
    const rearStrongProvs = refreshedOwned
      .filter(
        (p) =>
          p.garrison >= rearMinGarrison &&
          !p.neighbors.some((nbId) => {
            const nb = nextTerritories[nbId];
            return Boolean(nb && nb.ownerId !== actorId && actorEnemies.has(nb.ownerId));
          })
      )
      .sort((a, b) => b.garrison - a.garrison);

    if (rearStrongProvs.length > 0) {
      const srcRear = rearStrongProvs[0];
      const enemyTerritories = [...allEnemyWarProvs].sort(
        (a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a)
      );
      const targetDest =
        threatenedProvs[0] ||
        (isEnemyMopUp && enemyTerritories[0] ? enemyTerritories[0] : null) ||
        frontlineProvs.sort((a, b) => a.garrison - b.garrison)[0] ||
        enemyTerritories[0];

      if (targetDest && targetDest.id !== srcRear.id) {
        const route = findArmyRouteAStar({
          fromId: srcRear.id,
          toId: targetDest.id,
          moverNationId: actorId,
          territories: nextTerritories,
          nations: nextNations,
          relations,
          wars,
          allowTargetWarDeclaration: true,
        });

        if (route.reachable && route.hops.length > 0) {
          const firstHopId = route.hops[0];
          const firstHopTerr = nextTerritories[firstHopId];
          const moveRatio = isEnemyMopUp ? 0.74 : 0.65;
          const moveTroops = Math.round(srcRear.garrison * moveRatio);

          writeTerritory(srcRear.id, {
            ...srcRear,
            garrison: Math.max(isEnemyMopUp ? 700 : 1200, srcRear.garrison - moveTroops),
            units: scaleUnitComp(srcRear.units, 1 - moveRatio),
          });

          const isFinalEnemy = Boolean(
            targetDest.ownerId !== actorId &&
              actorEnemies.has(targetDest.ownerId)
          );
          const isFirstHopAttack = Boolean(
            isFinalEnemy ||
              (firstHopTerr &&
                firstHopTerr.ownerId !== actorId &&
                actorEnemies.has(firstHopTerr.ownerId))
          );

          recordNewMovement({
            id: `ai_war_march_${nextTick}_${srcRear.id}`,
            ownerId: actorId,
            fromTerritoryId: srcRear.id,
            toTerritoryId: firstHopId,
            finalDestinationId: targetDest.id,
            routeQueue: route.hops.slice(1),
            troops: moveTroops,
            units: scaleUnitComp(srcRear.units, moveRatio),
            progress: 18,
            isAttack: isFirstHopAttack,
          });

          if (isFirstHopAttack && firstHopTerr?.ownerId === playerNationId) {
            playerAlerts.push(
              `⚔️ DÜŞMAN TAARRUZU: ${actorNation.name} ordusu (${moveTroops.toLocaleString('tr-TR')} asker) ${firstHopTerr.name} eyaletimize yürüyor!`
            );
          }

          actionsCount++;
          continue;
        }
      }
    }

    // Step 4: Wartime Naval Operations — Counter-Blockade Interception & Amphibious Coastal Landings
    if (navalMoveOwners.has(actorId)) continue;

    const actorCoastalList = coastalProvsByOwner.get(actorId);
    if (!actorCoastalList || actorCoastalList.length === 0) continue;

    const coastalStrongProvs = actorCoastalList
      .map((p) => nextTerritories[p.id])
      .filter((p) => p && p.garrison >= 6500 && !p.siege && Boolean(p.centroid))
      .sort((a, b) => b.garrison - a.garrison);
    if (coastalStrongProvs.length === 0) continue;

    const srcCoast = coastalStrongProvs[0];
    const navalSendRatio = srcCoast.isCapital ? 0.45 : 0.55;
    const navalTroops = Math.round(srcCoast.garrison * navalSendRatio);
    if (navalTroops < 3000) continue;

    // 4A. Counter-Fleet: intercept a hostile SeaArmy blockading our coastline
    const hostileNearFleet = seaArmies
      .filter(
        (f) =>
          f.ownerId !== actorId &&
          actorEnemies.has(f.ownerId) &&
          navalTroops >= f.troops * 0.85 &&
          coastalStrongProvs.some(
            (cp) =>
              Math.hypot(
                f.coords[0] - cp.centroid[0],
                f.coords[1] - cp.centroid[1]
              ) <= 7.5
          )
      )
      .sort((a, b) => a.troops - b.troops)[0];

    if (hostileNearFleet) {
      const remainingGarrison = Math.max(2500, srcCoast.garrison - navalTroops);
      writeTerritory(srcCoast.id, {
        ...srcCoast,
        garrison: remainingGarrison,
        units: scaleUnitComp(
          srcCoast.units,
          remainingGarrison / Math.max(1, srcCoast.garrison)
        ),
      });
      recordNewMovement({
        id: `ai_naval_int_${nextTick}_${srcCoast.id}`,
        ownerId: actorId,
        fromTerritoryId: srcCoast.id,
        toTerritoryId: srcCoast.id,
        fromCoords: srcCoast.centroid,
        toCoords: hostileNearFleet.coords,
        targetSeaName: hostileNearFleet.name,
        isNaval: true,
        troops: navalTroops,
        units: scaleUnitComp(srcCoast.units, navalSendRatio),
        progress: 16,
        isAttack: true,
      });
      if (hostileNearFleet.ownerId === playerNationId) {
        playerAlerts.push(
          `DÜŞMAN DONANMASI: ${actorNation.name} filosu (${(navalTroops / 1000).toFixed(1)}B asker) ${hostileNearFleet.name} birliğimize saldırmak üzere denize açıldı!`
        );
      }
      actionsCount++;
      continue;
    }

    // 4B. Amphibious Assault: cross open water to invade a vulnerable enemy coastal province
    const enemyCoastalTargets: Territory[] = [];
    for (const enemyId of actorEnemies) {
      const eCoast = coastalProvsByOwner.get(enemyId);
      if (!eCoast) continue;
      for (const rawT of eCoast) {
        const t = nextTerritories[rawT.id];
        if (!t || t.ownerId !== enemyId || !t.centroid) continue;
        if (targetedKeys.has(`${actorId}|${t.id}`)) continue;
        const dist = Math.hypot(
          srcCoast.centroid[0] - t.centroid[0],
          srcCoast.centroid[1] - t.centroid[1]
        );
        if (dist <= 28 && navalTroops >= Math.max(3000, t.garrison * 1.05)) {
          enemyCoastalTargets.push(t);
        }
      }
    }
    enemyCoastalTargets.sort((a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a));

    const amphibTarget = enemyCoastalTargets[0];
    if (amphibTarget) {
      const remainingGarrison = Math.max(2500, srcCoast.garrison - navalTroops);
      writeTerritory(srcCoast.id, {
        ...srcCoast,
        garrison: remainingGarrison,
        units: scaleUnitComp(
          srcCoast.units,
          remainingGarrison / Math.max(1, srcCoast.garrison)
        ),
      });
      recordNewMovement({
        id: `ai_amphib_${nextTick}_${srcCoast.id}_${amphibTarget.id}`,
        ownerId: actorId,
        fromTerritoryId: srcCoast.id,
        toTerritoryId: amphibTarget.id,
        finalDestinationId: amphibTarget.id,
        fromCoords: srcCoast.centroid,
        isNaval: true,
        troops: navalTroops,
        units: scaleUnitComp(srcCoast.units, navalSendRatio),
        progress: 14,
        isAttack: true,
      });
      if (amphibTarget.ownerId === playerNationId) {
        playerAlerts.push(
          `AMFİBİ ÇIKARMA UYARISI: ${actorNation.name} donanması (${(navalTroops / 1000).toFixed(1)}B asker) ${amphibTarget.name} kıyımıza çıkarma başlattı!`
        );
        newsItems.push({
          title: `Amfibi Çıkarma: ${amphibTarget.name}`,
          description: `${actorNation.name} donanması ${srcCoast.name} limanından açılarak ${amphibTarget.name} kıyısına çıkarma harekatı başlattı.`,
          type: 'WAR',
        });
      }
      actionsCount++;
    }
  }

  if (
    actionsCount === 0 &&
    newMovements.length === 0 &&
    playerAlerts.length === 0
  ) {
    return null;
  }

  return {
    updatedTerritories: nextTerritories,
    updatedNations: nextNations,
    newMovements,
    newsItems,
    playerAlerts,
  };
}

export function evaluateMultiProvinceAiTurn(params: {
  nextTick: number;
  gameMode?: GameModeId;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements?: ArmyMovement[];
  hasActiveIncomingOffer?: boolean;
  aiAggressiveness: AiAggressivenessLevel;
  worldSeed?: number;
  actorSlotOffset?: number;
}): AiTurnResult | null {
  const {
    nextTick,
    gameMode = 'EMPIRES_1440',
    playerNationId,
    nations,
    territories,
    relations,
    wars,
    movements = [],
    hasActiveIncomingOffer = false,
    aiAggressiveness,
    worldSeed,
    actorSlotOffset = 0,
  } = params;

  // Include all active neighbors of the player, all nations in wars, all multi-province realms, and major presets
  const playerNeighborNationIds = new Set<string>();
  Object.values(territories).forEach((t) => {
    if (t && t.ownerId === playerNationId) {
      t.neighbors.forEach((nbId) => {
        const nbOwner = territories[nbId]?.ownerId;
        if (nbOwner && nbOwner !== playerNationId) {
          playerNeighborNationIds.add(nbOwner);
        }
      });
    }
  });

  const majorAiIds = Object.keys(nations).filter((id) => {
    if (id === playerNationId) return false;
    const nat = nations[id];
    if (!nat || nat.isEliminated) return false;
    if (playerNeighborNationIds.has(id)) return true;
    if (wars.some((w) => w.attackers.includes(id) || w.defenders.includes(id))) {
      return true;
    }
    if (PRESET_COUNTRIES_2026[id]) return true;
    return (nat.treasury || 0) >= 600;
  });
  if (majorAiIds.length === 0) return null;

  const baseStep = Math.max(0, Math.floor(nextTick / 3));
  const stepIndex =
    worldSeed !== undefined ? baseStep * 2 + actorSlotOffset : baseStep;

  let actorId: string;
  if (worldSeed !== undefined) {
    const cycleIndex = Math.floor(stepIndex / majorAiIds.length);
    const shuffledActors = seededShuffle(
      majorAiIds,
      worldSeed,
      `ai_cycle_${cycleIndex}`
    );
    actorId = shuffledActors[stepIndex % shuffledActors.length];
  } else {
    actorId = majorAiIds[stepIndex % majorAiIds.length];
  }

  let actorNation = nations[actorId];
  if (!actorNation) return null;

  const ownedProvinces = Object.values(territories).filter(
    (t) => t.ownerId === actorId
  );
  if (ownedProvinces.length === 0) return null;

  let updatedNations: Record<string, Nation> | undefined;
  let updatedTerritories: Record<string, Territory> | undefined;

  // 0. Evaluate AI-vs-AI Peace Settlements so wars conclude logically instead of freezing forever
  const aiOnlyWar = wars.find((w) => {
    const involvesActor =
      w.attackerId === actorId ||
      w.defenderId === actorId ||
      w.attackers.includes(actorId) ||
      w.defenders.includes(actorId);
    if (!involvesActor) return false;
    const involvesPlayer =
      w.attackerId === playerNationId ||
      w.defenderId === playerNationId ||
      w.attackers.includes(playerNationId) ||
      w.defenders.includes(playerNationId);
    return !involvesPlayer;
  });

  if (aiOnlyWar) {
    const warDuration = nextTick - aiOnlyWar.startedTick;
    const absScore = Math.abs(aiOnlyWar.attackerWarScore);
    const isDecisive =
      (warDuration >= 40 && absScore >= 45) ||
      (warDuration >= 95 && absScore >= 25);
    const isExhaustedStalemate = warDuration >= 130 && absScore < 25;

    if (isDecisive || isExhaustedStalemate) {
      const nextWars = wars.filter((w) => w.id !== aiOnlyWar.id);
      const nextRelations: Record<string, DiplomaticRelation> = { ...relations };
      const truceKey = relationKey(aiOnlyWar.attackerId, aiOnlyWar.defenderId);
      const existingRel = getOrCreateRelation(
        relations,
        aiOnlyWar.attackerId,
        aiOnlyWar.defenderId
      );
      nextRelations[truceKey] = {
        ...existingRel,
        truceUntilTick: nextTick + 140,
      };

      const attNation = nations[aiOnlyWar.attackerId];
      const defNation = nations[aiOnlyWar.defenderId];

      if (isDecisive && attNation && defNation) {
        const winner =
          aiOnlyWar.attackerWarScore >= 0 ? attNation : defNation;
        const loser =
          aiOnlyWar.attackerWarScore >= 0 ? defNation : attNation;
        const indemnity = Math.min(
          Math.max(120, Math.round(loser.treasury * 0.35)),
          650
        );

        // Smart AE-aware peace demands: AI evaluates calculateProjectedPeaceAE so it stays under 95 AE,
        // except rare reckless CONQUEROR AI (~15%) that may push to 100 AE and trigger a World Coalition!
        let peaceTerritories: Record<string, Territory> | undefined;
        const demandedIds: string[] = [];
        const winnerPersonality = resolveNationAiPersonality(winner, territories);
        const recklessOverreach =
          winnerPersonality === 'CONQUEROR' &&
          (nextTick + winner.id.charCodeAt(0)) % 7 === 0;
        const maxDesiredAE = recklessOverreach ? 105 : 94;

        // Gather all loser provinces (including provinces currently occupied by winner)
        const loserOwnedProvs = Object.values(territories).filter(
          (t) => t && t.ownerId === loser.id
        );
        const occupiedByWinner = Object.values(territories).filter(
          (t) =>
            t &&
            t.ownerId === winner.id &&
            t.isOccupied &&
            t.coreOwnerId === loser.id
        );

        const candidatePool: Territory[] = [
          ...occupiedByWinner,
          ...loserOwnedProvs.filter((t) =>
            t.neighbors.some((nId) => territories[nId]?.ownerId === winner.id)
          ),
          ...loserOwnedProvs.filter(
            (t) =>
              !t.neighbors.some((nId) => territories[nId]?.ownerId === winner.id)
          ),
        ];
        const uniqueCandidates: Territory[] = [];
        const seenCand = new Set<string>();
        for (const c of candidatePool) {
          if (!seenCand.has(c.id)) {
            seenCand.add(c.id);
            uniqueCandidates.push(c);
          }
        }

        const maxProvsByScore =
          absScore >= 95
            ? uniqueCandidates.length
            : absScore >= 70
            ? Math.min(4, uniqueCandidates.length)
            : absScore >= 50
            ? Math.min(2, uniqueCandidates.length)
            : 1;

        if (absScore >= 45 && uniqueCandidates.length > 0) {
          for (const cand of uniqueCandidates) {
            if (demandedIds.length >= maxProvsByScore) break;
            const trialIds = [...demandedIds, cand.id];
            const trialFullAnnex = trialIds.length >= uniqueCandidates.length;
            const aeTrial = calculateProjectedPeaceAE({
              territories,
              demandedTerritoryIds: trialIds,
              isFullAnnex: trialFullAnnex,
              conquerorNation: winner,
            });
            if (aeTrial.projectedTotal <= maxDesiredAE || demandedIds.length === 0 && recklessOverreach) {
              demandedIds.push(cand.id);
            } else {
              break;
            }
          }
        }

        const demandedSet = new Set(demandedIds);
        const isFullAnnex =
          uniqueCandidates.length > 0 && demandedIds.length >= uniqueCandidates.length;
        const workingTerrs: Record<string, Territory> = { ...territories };
        let terrsChanged = false;

        // Transfer demanded provinces permanently
        for (const dId of demandedIds) {
          const prov = workingTerrs[dId];
          if (!prov) continue;
          workingTerrs[dId] = {
            ...prov,
            ownerId: winner.id,
            isCapital: false,
            isOccupied: false,
            occupiedById: undefined,
            siege: undefined,
            unrest: Math.min(65, (prov.unrest || 15) + 20),
            garrison: Math.max(3000, prov.garrison),
          };
          terrsChanged = true;
        }

        // Return occupied provinces that winner chose NOT to take (to keep AE safe!)
        for (const occ of occupiedByWinner) {
          if (!demandedSet.has(occ.id)) {
            workingTerrs[occ.id] = {
              ...occ,
              ownerId: loser.id,
              isOccupied: false,
              occupiedById: undefined,
              siege: undefined,
            };
            terrsChanged = true;
          }
        }

        if (terrsChanged) {
          peaceTerritories = workingTerrs;
        }

        const aeResult = calculateProjectedPeaceAE({
          territories: workingTerrs,
          demandedTerritoryIds: demandedIds,
          isFullAnnex,
          conquerorNation: winner,
        });

        const stillOwnedByLoser = Object.values(workingTerrs).filter(
          (t) => t && t.ownerId === loser.id
        );
        const loserEliminated = stillOwnedByLoser.length === 0;
        let loserCapId = loser.capitalTerritoryId;
        if (
          !loserEliminated &&
          workingTerrs[loserCapId]?.ownerId !== loser.id &&
          stillOwnedByLoser[0]
        ) {
          loserCapId = stillOwnedByLoser[0].id;
          workingTerrs[loserCapId] = {
            ...stillOwnedByLoser[0],
            isCapital: true,
          };
          peaceTerritories = workingTerrs;
        }

        const nextNats: Record<string, Nation> = {
          ...(updatedNations || nations),
          [winner.id]: {
            ...winner,
            treasury: winner.treasury + indemnity,
            stability: Math.min(100, winner.stability + 4),
            aggressiveExpansion: aeResult.projectedTotal,
          },
          [loser.id]: {
            ...loser,
            isEliminated: loserEliminated,
            capitalTerritoryId: loserCapId,
            treasury: Math.max(0, loser.treasury - indemnity),
            aggressiveExpansion: Math.max(0, loser.aggressiveExpansion - 8),
          },
        };

        let finalRelations = nextRelations;
        if (demandedIds.length > 0) {
          const penalty = applyConquestDiplomaticPenalty({
            conquerorId: winner.id,
            victimId: loser.id,
            provincesTakenCount: demandedIds.length,
            isFullAnnexation: isFullAnnex,
            nations: nextNats,
            relations: nextRelations,
          });
          finalRelations = penalty.updatedRelations;
        }

        const annexedSummary =
          demandedIds.length > 0
            ? isFullAnnex
              ? `${loser.name} topraklarının tamamını (${demandedIds.length} eyalet)`
              : `${demandedIds.length} eyalet`
            : null;

        return {
          updatedNations: nextNats,
          updatedTerritories: peaceTerritories,
          updatedWars: nextWars,
          updatedRelations: finalRelations,
          newsItem: {
            title: `📜 Barış Antlaşması: ${winner.name} Zaferi`,
            description: annexedSummary
              ? `${winner.name} ile ${loser.name} arasındaki savaş sona erdi; ${winner.name} ${annexedSummary} ve ${indemnity} Altın tazminat alarak ateşkes imzaladı (+${aeResult.adjustedGain} Agresiflik).`
              : `${winner.name} ile ${loser.name} arasındaki savaş sona erdi; ${loser.name} ${indemnity} Altın savaş tazminatı ödeyerek ateşkes imzaladı.`,
            type: 'PEACE',
          },
        };
      }

      if (attNation && defNation) {
        return {
          updatedWars: nextWars,
          updatedRelations: nextRelations,
          newsItem: {
            title: `🕊️ Statüko Barışı: ${attNation.name} - ${defNation.name}`,
            description: `Uzun süren yıpratma harbinin ardından ${attNation.name} ve ${defNation.name} sınırları koruyarak ateşkes imzaladı.`,
            type: 'PEACE',
          },
        };
      }
    }
  }

  // Resolve dynamic AI Personality Profile (CONQUEROR / MERCHANT / DEFENDER / REVANCHIST)
  const actorPersonality = resolveNationAiPersonality(actorNation, territories);
  const personalityMeta = AI_PERSONALITY_META[actorPersonality];

  // 1. Personality-Specialized AI Technology Progression & National Army Modernization
  const isMasterAiDifficulty =
    aiAggressiveness === 'AGGRESSIVE' || aiAggressiveness === 'CHAOS';
  if (isMasterAiDifficulty && !wars.some((w) => w.attackers.includes(actorId) || w.defenders.includes(actorId))) {
    // Master-difficulty AI actively funds research institutes & treasury discipline during peacetime
    actorNation = {
      ...actorNation,
      researchPoints: Number((actorNation.researchPoints + 12).toFixed(1)),
    };
  }
  const activeTechTree = getTechTreeForMode(gameMode);
  const techDiscount = isMasterAiDifficulty ? 0.88 : 1.0;
  const availableTechs = activeTechTree.filter(
    (tech) =>
      !actorNation.unlockedTechs.includes(tech.id) &&
      (!tech.prerequisite ||
        actorNation.unlockedTechs.includes(tech.prerequisite)) &&
      actorNation.researchPoints >= Math.round(tech.cost * techDiscount)
  );

  const nextAiTech = availableTechs.sort((a, b) => {
    const aIdx = personalityMeta.techPriority.indexOf(a.branch);
    const bIdx = personalityMeta.techPriority.indexOf(b.branch);
    const prioA = aIdx === -1 ? 4 : aIdx;
    const prioB = bIdx === -1 ? 4 : bIdx;
    return prioA - prioB || a.cost - b.cost;
  })[0];

  if (nextAiTech) {
    const effectiveCost = Math.round(nextAiTech.cost * techDiscount);
    actorNation = {
      ...actorNation,
      researchPoints: Math.max(0, actorNation.researchPoints - effectiveCost),
      unlockedTechs: [...actorNation.unlockedTechs, nextAiTech.id],
    };
    updatedNations = {
      ...nations,
      [actorId]: actorNation,
    };
  }

  const aiUnlockedMil = getNationUnlockedMilTier(actorNation);
  const aiModernizedMil = getNationModernizedTier(actorNation);
  if (aiUnlockedMil > aiModernizedMil && actorNation.treasury >= 650) {
    actorNation = {
      ...actorNation,
      treasury: actorNation.treasury - 420,
      modernizedArmyTier: aiUnlockedMil,
    };
    updatedNations = {
      ...(updatedNations || nations),
      [actorId]: actorNation,
    };
  }

  // 2. Smart Internal Governance: Assimilate Unruly Provinces, Reinforce Borders, AND Build Peacetime Economy
  const actorInAnyWar = wars.some(
    (w) => w.attackers.includes(actorId) || w.defenders.includes(actorId)
  );
  const highUnrestProv = ownedProvinces
    .filter((p) => p.unrest >= 55 || p.coreOwnerId !== actorId)
    .sort((a, b) => b.unrest - a.unrest)[0];

  if (highUnrestProv && highUnrestProv.unrest >= 55 && actorNation.treasury >= 550) {
    actorNation = {
      ...actorNation,
      treasury: actorNation.treasury - 350,
    };
    updatedNations = {
      ...(updatedNations || nations),
      [actorId]: actorNation,
    };
    updatedTerritories = {
      ...territories,
      [highUnrestProv.id]: {
        ...highUnrestProv,
        coreOwnerId: actorId,
        unrest: Math.max(5, highUnrestProv.unrest - 26),
      },
    };
  } else {
    const borderProvinces = ownedProvinces.filter((p) =>
      p.neighbors.some((nId) => territories[nId]?.ownerId !== actorId)
    );
    const weakestBorder = [...borderProvinces].sort(
      (a, b) => a.garrison - b.garrison
    )[0];

    // Check if an adjacent hostile/stronger neighbor threatens the weakest border
    const hasThreatenedBorder = Boolean(
      weakestBorder &&
        weakestBorder.neighbors.some((nId) => {
          const nb = territories[nId];
          if (!nb || nb.ownerId === actorId) return false;
          const rel = getOrCreateRelation(relations, actorId, nb.ownerId);
          return (
            Boolean(isAtWar(wars, actorId, nb.ownerId)) ||
            rel.score <= -15 ||
            nb.garrison > weakestBorder.garrison * 1.35
          );
        })
    );

    // Personality-calibrated balance between peacetime economy/development and military buildup
    // On high/max difficulty (AGGRESSIVE / CHAOS), AI nations play like grand-strategy veterans:
    // they aggressively develop economy, schools, universities, and capital level during peacetime!
    const preferEconByPersonality =
      isMasterAiDifficulty
        ? stepIndex % 3 !== 2
        : actorPersonality === 'MERCHANT'
        ? stepIndex % 3 !== 2
        : actorPersonality === 'DEFENDER'
        ? stepIndex % 2 === 0
        : stepIndex % 3 === 0;
    const preferEconTurn =
      !actorInAnyWar &&
      actorNation.treasury >= (isMasterAiDifficulty ? 620 : 760) &&
      (!weakestBorder ||
        weakestBorder.garrison >= 8500 ||
        actorNation.manpower < 14000) &&
      (preferEconByPersonality || !hasThreatenedBorder);

    if (preferEconTurn) {
      // Personality & Development-Driven Infrastructure, Supply, Education, Capital & Resource Investment!
      const straitShoreSet = new Set(
        STRATEGIC_STRAITS.flatMap((s) => s.shoreIds)
      );
      const currentSeason = getGameSeason(nextTick, gameMode);
      const overSupplyProv = ownedProvinces.find(
        (p) =>
          p.garrison >=
            calculateProvinceSupplyLimit(p, actorNation, currentSeason) * 0.9 &&
          (p.buildings.supplyDepot || 0) < 4
      );
      const lowManpower = actorNation.manpower < 18000;
      const behindInTech = actorNation.unlockedTechs.length < (isMasterAiDifficulty ? 6 : 3);
      const highInflation = (actorNation.inflation || 0) >= 6;
      const hasSci1 = actorNation.unlockedTechs.includes('sci_1');
      const hasSci2 = actorNation.unlockedTechs.includes('sci_2');
      const hasAdm1 = actorNation.unlockedTechs.includes('adm_1');

      let chosenBuilding: BuildingType | undefined;
      let econTarget: Territory | undefined;

      const capitalProv = ownedProvinces.find(
        (p) => p.isCapital || p.id === actorNation.capitalTerritoryId
      );

      if (overSupplyProv) {
        econTarget = overSupplyProv;
        chosenBuilding =
          (overSupplyProv.buildings.supplyDepot || 0) <=
          (overSupplyProv.buildings.granary || 0)
            ? 'supplyDepot'
            : 'granary';
      } else if (
        capitalProv &&
        hasAdm1 &&
        (capitalProv.buildings.capitalPalace || 0) < 3 &&
        stepIndex % 2 === 0
      ) {
        econTarget = capitalProv;
        chosenBuilding = 'capitalPalace';
      } else if (
        (hasThreatenedBorder || actorPersonality === 'DEFENDER') &&
        weakestBorder &&
        (weakestBorder.buildings.fortress || 0) < 4
      ) {
        econTarget = weakestBorder;
        chosenBuilding = 'fortress';
      } else if (lowManpower) {
        econTarget =
          ownedProvinces.find(
            (p) =>
              (p.buildings.barracks || 0) < 4 || (p.buildings.granary || 0) < 3
          ) || ownedProvinces[0];
        chosenBuilding =
          econTarget &&
          (econTarget.buildings.granary || 0) <
            (econTarget.buildings.barracks || 0)
            ? 'granary'
            : 'barracks';
      } else if (highInflation) {
        econTarget =
          ownedProvinces.find(
            (p) => p.isCapital && (p.buildings.mint || 0) < 4
          ) || [...ownedProvinces].sort((a, b) => b.baseGdp - a.baseGdp)[0];
        chosenBuilding = 'mint';
      } else {
        // Prioritize highest-development or highest-resource-value provinces (and coastal hubs for MERCHANT)
        const rankedByDev = [...ownedProvinces].sort((a, b) => {
          const devA = calculateProvinceDevelopment(a, actorNation);
          const devB = calculateProvinceDevelopment(b, actorNation);
          return (
            devB.effectiveResourceValue +
            devB.developmentScore -
            (devA.effectiveResourceValue + devA.developmentScore)
          );
        });
        econTarget =
          (actorPersonality === 'MERCHANT'
            ? ownedProvinces.find(
                (p) =>
                  isTerritoryCoastal(p) &&
                  ((p.buildings.shipyard || 0) < 4 ||
                    (p.buildings.tradeHub || 0) < 4)
              )
            : undefined) ||
          ownedProvinces.find(
            (p) =>
              straitShoreSet.has(p.id) &&
              ((p.buildings.tradeHub || 0) < 4 ||
                (p.buildings.shipyard || 0) < 3)
          ) ||
          rankedByDev[0];

        if (econTarget) {
          const isStraitProv = straitShoreSet.has(econTarget.id);
          const isCoastalProv = isTerritoryCoastal(econTarget);
          const isCapProv =
            Boolean(econTarget.isCapital) ||
            econTarget.id === actorNation.capitalTerritoryId;
          const candidateBuildings: BuildingType[] =
            actorPersonality === 'MERCHANT'
              ? isCoastalProv
                ? ['shipyard', 'tradeHub', 'mint', 'factory', 'highSchool', 'school', 'university', 'granary']
                : ['tradeHub', 'factory', 'mint', 'highSchool', 'school', 'university', 'granary', 'supplyDepot']
              : actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST'
              ? ['factory', 'barracks', 'school', 'highSchool', 'university', 'supplyDepot', 'fortress', 'granary', 'shipyard', 'mint']
              : actorPersonality === 'DEFENDER'
              ? ['fortress', 'factory', 'school', 'highSchool', 'granary', 'supplyDepot', 'mint', 'university', 'shipyard']
              : isStraitProv
              ? ['shipyard', 'tradeHub', 'fortress', 'factory', 'mint', 'highSchool', 'university']
              : behindInTech
              ? ['school', 'highSchool', 'university', 'factory', 'mint', 'tradeHub', 'granary', 'barracks']
              : ['factory', 'tradeHub', 'school', 'highSchool', 'university', 'mint', 'granary', 'barracks', 'fortress'];
          chosenBuilding = candidateBuildings.find(
            (bKey) =>
              (econTarget!.buildings[bKey] || 0) < 5 &&
              (bKey !== 'shipyard' || isCoastalProv) &&
              (bKey !== 'capitalPalace' || (isCapProv && hasAdm1)) &&
              (bKey !== 'school' || hasSci1) &&
              (bKey !== 'highSchool' || hasSci2)
          );
        }
      }

      if (
        econTarget &&
        chosenBuilding &&
        (chosenBuilding !== 'shipyard' || isTerritoryCoastal(econTarget))
      ) {
        const currentLvl = econTarget.buildings[chosenBuilding] || 0;
        const upgradeCost = 380 + currentLvl * 200;
        if (currentLvl < 5 && actorNation.treasury >= upgradeCost + 220) {
          actorNation = {
            ...actorNation,
            treasury: actorNation.treasury - upgradeCost,
          };
          updatedNations = {
            ...(updatedNations || nations),
            [actorId]: actorNation,
          };
          updatedTerritories = {
            ...territories,
            [econTarget.id]: {
              ...econTarget,
              baseGdp:
                chosenBuilding === 'factory' ||
                chosenBuilding === 'tradeHub' ||
                chosenBuilding === 'shipyard'
                  ? econTarget.baseGdp + 6
                  : econTarget.baseGdp,
              buildings: {
                ...econTarget.buildings,
                [chosenBuilding]: currentLvl + 1,
              },
            },
          };
        }
      }
    } else {
      const targetBorderGarrison =
        actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST'
          ? 28000
          : actorPersonality === 'DEFENDER'
          ? 24000
          : 19000;
      const needsGarrison =
        actorInAnyWar ||
        hasThreatenedBorder ||
        !weakestBorder ||
        weakestBorder.garrison < targetBorderGarrison;

      if (
        needsGarrison &&
        actorNation.treasury >= 780 &&
        actorNation.manpower >= 5500
      ) {
        const targetProv = [weakestBorder, ...ownedProvinces].find(
          (p) => p && !p.siege
        );
        if (targetProv) {
          const empireScale = Math.min(5500, Math.max(0, ownedProvinces.length - 1) * 850);
          const addTroops = Math.min(
            actorNation.manpower,
            (aiAggressiveness === 'CHAOS' ? 9000 : 6000) + empireScale
          );
          const levyCost = Math.min(actorNation.treasury, Math.max(380, Math.round(addTroops * 0.065)));
          actorNation = {
            ...actorNation,
            treasury: Math.max(0, actorNation.treasury - levyCost),
            manpower: Math.max(0, actorNation.manpower - addTroops),
          };
          updatedNations = {
            ...(updatedNations || nations),
            [actorId]: actorNation,
          };
          updatedTerritories = {
            ...territories,
            [targetProv.id]: {
              ...targetProv,
              garrison: targetProv.garrison + addTroops,
              units: {
                infantry:
                  (targetProv.units?.infantry || targetProv.garrison) +
                  Math.round(addTroops * 0.66),
                armor:
                  (targetProv.units?.armor || 0) + Math.round(addTroops * 0.23),
                airDrone:
                  (targetProv.units?.airDrone || 0) + Math.round(addTroops * 0.11),
              },
            },
          };
        }
      }
    }
  }

  const activeTerrs = updatedTerritories || territories;

  // 3. Tactical War Offensives — Only attack when dispatched army can realistically win!
  for (const prov of ownedProvinces) {
    const currentProv = activeTerrs[prov.id];
    if (!currentProv || currentProv.garrison < 12000) continue;

    const enemyCandidates = currentProv.neighbors
      .map((nId) => activeTerrs[nId])
      .filter(
        (nTerr): nTerr is Territory =>
          Boolean(nTerr) &&
          nTerr.ownerId !== actorId &&
          Boolean(isAtWar(wars, actorId, nTerr.ownerId))
      )
      .sort((a, b) => {
        const aScore = (a.isCapital ? -2500 : 0) + a.garrison + (a.buildings.fortress || 0) * 1400;
        const bScore = (b.isCapital ? -2500 : 0) + b.garrison + (b.buildings.fortress || 0) * 1400;
        return aScore - bScore;
      });

    const viableTarget = enemyCandidates.find((enemyTerr) => {
      const dispatchable = Math.round(currentProv.garrison * 0.62);
      const terrainPenalty =
        enemyTerr.terrain === 'DAGLIK' || (enemyTerr.buildings.fortress || 0) >= 2
          ? 1.12
          : 0.88;
      return dispatchable >= Math.max(2500, enemyTerr.garrison * terrainPenalty);
    });

    if (viableTarget) {
      const sendRatio = 0.62;
      const sendTroops = Math.round(currentProv.garrison * sendRatio);
      const sendUnits = scaleUnitComp(currentProv.units, sendRatio);
      return {
        updatedNations,
        updatedTerritories: {
          ...activeTerrs,
          [currentProv.id]: {
            ...currentProv,
            garrison: currentProv.garrison - sendTroops,
            units: scaleUnitComp(currentProv.units, 1 - sendRatio),
          },
        },
        newMovement: {
          id: `ai_mv_${nextTick}_${currentProv.id}`,
          ownerId: actorId,
          fromTerritoryId: currentProv.id,
          toTerritoryId: viableTarget.id,
          troops: sendTroops,
          units: sendUnits,
          progress: 12,
          isAttack: true,
        },
      };
    }
  }

  // 4. Multi-Province A* Reserve Redeployment & Pre-War Border Buildup (Threat Feel!)
  if (ownedProvinces.length > 1) {
    const minInteriorThreshold =
      actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST'
        ? 14000
        : 19000;
    const interiorRichProv = ownedProvinces.find(
      (p) =>
        (activeTerrs[p.id]?.garrison || 0) >= minInteriorThreshold &&
        p.neighbors.every((nId) => activeTerrs[nId]?.ownerId === actorId)
    );

    // Prioritize hostile/rival borders (or player border if hostile/Revanchist/Conqueror) for visible pre-war staging
    const scoreBorderUrgency = (p: Territory): number => {
      let urgency = -p.garrison;
      for (const nId of p.neighbors) {
        const nb = activeTerrs[nId];
        if (!nb || nb.ownerId === actorId) continue;
        const nbRel = getOrCreateRelation(relations, actorId, nb.ownerId);
        if (actorInAnyWar && isAtWar(wars, actorId, nb.ownerId)) urgency += 22000;
        if (nb.coreOwnerId === actorId) urgency += 14000; // Revanchist homeland staging!
        if (nbRel.score <= -20) urgency += 9000;
        if (nations[nb.ownerId]?.aggressiveExpansion >= 45) urgency += 7500;
      }
      return urgency;
    };

    const frontlineTargets = ownedProvinces
      .filter((p) =>
        p.neighbors.some((nId) => {
          const nb = activeTerrs[nId];
          if (!nb || nb.ownerId === actorId) return false;
          return actorInAnyWar
            ? Boolean(isAtWar(wars, actorId, nb.ownerId))
            : true;
        })
      )
      .sort((a, b) => scoreBorderUrgency(b) - scoreBorderUrgency(a));

    if (interiorRichProv && frontlineTargets.length > 0) {
      const destFront = frontlineTargets[0];
      const route = findArmyRouteAStar({
        fromId: interiorRichProv.id,
        toId: destFront.id,
        moverNationId: actorId,
        territories: activeTerrs,
        nations: updatedNations || nations,
        relations,
        wars,
      });

      if (route.reachable && route.hops.length >= 1) {
        const srcCurr = activeTerrs[interiorRichProv.id];
        const moveTroops = Math.round(srcCurr.garrison * 0.48);
        const bordersPlayerHostilely =
          !actorInAnyWar &&
          destFront.neighbors.some((nId) => {
            const nb = activeTerrs[nId];
            if (!nb || nb.ownerId !== playerNationId) return false;
            const relToPlayer = getOrCreateRelation(
              relations,
              actorId,
              playerNationId
            );
            return (
              !relToPlayer.isAllied &&
              !relToPlayer.hasNonAggression &&
              (relToPlayer.score <= -15 ||
                actorPersonality === 'REVANCHIST' ||
                (nations[playerNationId]?.aggressiveExpansion ?? 0) >= 45)
            );
          });

        return {
          updatedNations,
          updatedTerritories: {
            ...activeTerrs,
            [srcCurr.id]: {
              ...srcCurr,
              garrison: srcCurr.garrison - moveTroops,
              units: scaleUnitComp(srcCurr.units, 0.52),
            },
          },
          newMovement: {
            id: `ai_buildup_${nextTick}_${srcCurr.id}`,
            ownerId: actorId,
            fromTerritoryId: interiorRichProv.id,
            toTerritoryId: route.hops[0],
            finalDestinationId: destFront.id,
            routeQueue: route.hops.slice(1),
            troops: moveTroops,
            units: scaleUnitComp(srcCurr.units, 0.48),
            progress: 20,
            isAttack: false,
          },
          ...(bordersPlayerHostilely
            ? {
                playerAlert: `⚠️ SINIR YIĞINAĞI: ${actorNation.name} (${personalityMeta.shortLabel}), ${destFront.name} sınırımıza ${moveTroops.toLocaleString('tr-TR')} asker kaydırıyor!`,
                newsItem: {
                  title: `⚠️ Sınır Yığınağı: ${actorNation.name}`,
                  description: `${actorNation.name} orduları sınırımızdaki ${destFront.name} hattına takviye yığıyor. Diplomasi veya sınır savunması hazırlayın.`,
                  type: 'COALITION' as const,
                },
              }
            : {}),
        };
      }
    }
  }

  // 4B. Proactive AI-to-AI & Regional Enemy-of-My-Enemy Diplomacy + AI-to-Player Live Offers
  let updatedRelations: Record<string, DiplomaticRelation> | undefined;
  let diploNewsItem: AiTurnResult['newsItem'] | undefined;
  let incomingOffer: IncomingDiplomaticOffer | undefined;

  if (!actorInAnyWar) {
    const neighborIds = new Set<string>();
    const regionalIds = new Set<string>();
    for (const p of ownedProvinces) {
      for (const nId of p.neighbors) {
        const nbTerr = activeTerrs[nId];
        const nbOwner = nbTerr?.ownerId;
        if (nbOwner && nbOwner !== actorId) {
          neighborIds.add(nbOwner);
          // 2-hop regional peers (enemy-of-my-enemy coalition building!)
          for (const hop2Id of nbTerr.neighbors) {
            const hop2Owner = activeTerrs[hop2Id]?.ownerId;
            if (hop2Owner && hop2Owner !== actorId && !neighborIds.has(hop2Owner)) {
              regionalIds.add(hop2Owner);
            }
          }
        }
      }
    }

    const actorTotalTroops = computeRealmTotalTroops(actorId, activeTerrs, movements);
    const threatNeighborIds = Array.from(neighborIds).filter((nId) => {
      const nbNat = nations[nId];
      if (!nbNat || nbNat.isEliminated) return false;
      const nbTroops = computeRealmTotalTroops(nId, activeTerrs, movements);
      const nbRel = getOrCreateRelation(relations, actorId, nId);
      return (
        !nbRel.isAllied &&
        (nbNat.aggressiveExpansion >= 30 ||
          nbTroops >= actorTotalTroops * 1.25 ||
          nbRel.score <= -25)
      );
    });
    const hasStrongerOrHighAeNeighbor = threatNeighborIds.length > 0;

    const countExistingAlliances = (nId: string) =>
      Object.values(relations).filter(
        (r) =>
          (r.nationA === nId || r.nationB === nId) &&
          (r.isAllied || Boolean(r.allianceType))
      ).length;

    const actorAllianceCount = countExistingAlliances(actorId);

    // 4B-1: Evaluate Direct Neighbors + Regional Peers (Smart Compatibility, Warming, Pacts & Coalitions)
    const rawAiPeers = Array.from(
      new Set([...Array.from(neighborIds), ...Array.from(regionalIds)])
    ).filter(
      (id) => id !== playerNationId && nations[id] && !nations[id].isEliminated
    );
    const aiPeers =
      worldSeed !== undefined
        ? seededShuffle(rawAiPeers, worldSeed, `peers_${nextTick}_${actorId}`)
        : rawAiPeers;

    // Precompute which peers hold any core province of the actor
    const peersHoldingActorCore = new Set<string>();
    for (const t of Object.values(activeTerrs)) {
      if (t && t.coreOwnerId === actorId && t.ownerId !== actorId) {
        peersHoldingActorCore.add(t.ownerId);
      }
    }

    // Rank peers by alliance compatibility when looking for strategic pacts, while preserving seeded tie-breaking
    for (const peerId of aiPeers) {
      const peer = nations[peerId];
      if (!peer || isAtWar(wars, actorId, peerId)) continue;

      const rel = getOrCreateRelation(relations, actorId, peerId);
      const rKey = relationKey(actorId, peerId);
      const compat = computeAllianceCompatibilityScore({
        actor: actorNation,
        peer,
        rel,
        wars,
        relations,
        nations,
        gameMode,
        threatNeighborIds,
        actorPersonality,
        isDirectNeighbor: neighborIds.has(peerId),
        peerOwnsActorCore: peersHoldingActorCore.has(peerId),
      });

      // 1) Form Defensive Pact when compatible and threatened / sharing common threat (cap 2 alliances per AI)
      const allianceReady =
        !compat.blocked &&
        !rel.isAllied &&
        !rel.allianceType &&
        actorAllianceCount < 2 &&
        countExistingAlliances(peerId) < 2 &&
        ((hasStrongerOrHighAeNeighbor ||
          compat.sharesCommonThreat ||
          compat.sharesCommonWarEnemy) &&
          (compat.score >= 28 ||
            (compat.sharesCommonThreat && rel.score >= 5) ||
            rel.score >= 18));

      if (allianceReady) {
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.min(100, rel.score + 15),
            isAllied: true,
            allianceType: 'DEFENSIVE',
            hasNonAggression: true,
            hasMilitaryAccess: true,
          },
        };
        diploNewsItem = {
          title: `🛡️ Bölgesel Savunma Paktı: ${actorNation.name} & ${peer.name}`,
          description: compat.sharesCommonWarEnemy
            ? `${actorNation.name} ve ${peer.name}, ortak savaş düşmanlarına karşı savunma paktı kurdu.`
            : compat.sharesCommonThreat
            ? `${actorNation.name} ve ${peer.name}, ortak bölgesel tehditlere karşı savunma paktı kurdu.`
            : `${actorNation.name} ve ${peer.name}, bölgesel güç dengesini korumak amacıyla ortak savunma paktı imzaladı.`,
          type: 'COALITION',
        };
        break;
      }

      // 1B) Upgrade strong Defensive Pact to Offensive Coalition when interests align
      if (
        !compat.blocked &&
        rel.allianceType === 'DEFENSIVE' &&
        rel.score >= 42 &&
        (compat.sharesCommonThreat ||
          compat.sharesCommonWarEnemy ||
          actorPersonality === 'CONQUEROR' ||
          actorPersonality === 'REVANCHIST') &&
        (worldSeed === undefined ||
          seededHash(worldSeed, `off_upg_${nextTick}_${actorId}_${peerId}`) < 0.45)
      ) {
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.min(100, rel.score + 8),
            isAllied: true,
            allianceType: 'OFFENSIVE',
            hasMilitaryAccess: true,
          },
        };
        diploNewsItem = {
          title: `⚔️ Saldırı Koalisyonu: ${actorNation.name} & ${peer.name}`,
          description: `${actorNation.name} ile ${peer.name}, mevcut savunma paktını ortak taarruz ittifakına yükseltti.`,
          type: 'COALITION',
        };
        break;
      }

      // 2) Sign Trade Agreement between peaceful non-hostile peers (especially MERCHANT)
      if (
        !compat.blocked &&
        !rel.hasTradeAgreement &&
        !rel.hasEmbargo &&
        rel.score >= (actorPersonality === 'MERCHANT' ? -5 : 2)
      ) {
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.min(100, rel.score + 8),
            hasTradeAgreement: true,
          },
        };
        break;
      }

      // 3) Sign Non-Aggression Pact between peaceful neighbors of comparable strength
      if (
        !compat.blocked &&
        neighborIds.has(peerId) &&
        !rel.hasNonAggression &&
        !rel.isAllied &&
        rel.score >= 10
      ) {
        const peerTroops = computeRealmTotalTroops(peerId, activeTerrs, movements);
        if (
          peerTroops >= actorTotalTroops * 0.7 &&
          peerTroops <= actorTotalTroops * 1.45
        ) {
          updatedRelations = {
            ...relations,
            [rKey]: {
              ...rel,
              score: Math.min(100, rel.score + 6),
              hasNonAggression: true,
            },
          };
          break;
        }
      }

      // 4) Organic Diplomatic Warming: compatible peers gradually warm relations so natural alliances emerge
      if (
        !compat.blocked &&
        !rel.isAllied &&
        rel.score < 32 &&
        (compat.score >= 12 || compat.sharesCommonThreat || compat.sharesCommonWarEnemy) &&
        (worldSeed === undefined ||
          seededHash(worldSeed, `warm_${nextTick}_${actorId}_${peerId}`) < 0.42)
      ) {
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.min(100, rel.score + 12),
          },
        };
        break;
      }
    }

    // 4B-1C: Organic Border Friction (living world rivalries emerge dynamically across campaigns)
    if (
      !updatedRelations &&
      worldSeed !== undefined &&
      nextTick >= 12 &&
      (actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST' || seededHash(worldSeed, `fric_roll_${nextTick}_${actorId}`) < 0.22)
    ) {
      const frictionCandidates = seededShuffle(
        Array.from(neighborIds).filter((nId) => {
          const nb = nations[nId];
          if (!nb || nb.isEliminated || nb.vassalOf === actorId || actorNation.vassalOf === nId) {
            return false;
          }
          const rel = getOrCreateRelation(relations, actorId, nId);
          return (
            !rel.isAllied &&
            !rel.allianceType &&
            !rel.hasNonAggression &&
            rel.truceUntilTick <= nextTick &&
            rel.score > -45 &&
            rel.score < 20
          );
        }),
        worldSeed,
        `fric_${nextTick}_${actorId}`
      );
      const frictionTargetId = frictionCandidates[0];
      if (
        frictionTargetId &&
        seededHash(worldSeed, `fric_exec_${nextTick}_${actorId}_${frictionTargetId}`) < 0.35
      ) {
        const rel = getOrCreateRelation(relations, actorId, frictionTargetId);
        const rKey = relationKey(actorId, frictionTargetId);
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            score: Math.max(-100, rel.score - 12),
          },
        };
      }
    }

    // 4B-2: AI-to-AI / AI-to-Player Embargo against High-AE / Deeply Hostile Rivals (Non-Repetitive!)
    const embargoEligibleTick =
      worldSeed !== undefined
        ? nextTick >= 18 &&
          seededHash(worldSeed, `emb_gate_${nextTick}_${actorId}`) < 0.35
        : stepIndex % 4 === 0;

    if (!updatedRelations && embargoEligibleTick) {
      const candidateThreats =
        worldSeed !== undefined
          ? seededShuffle(threatNeighborIds, worldSeed, `emb_tgt_${nextTick}_${actorId}`)
          : threatNeighborIds;

      const embargoTargetId = candidateThreats.find((nId) => {
        const nbNat = nations[nId];
        if (
          !nbNat ||
          nbNat.isEliminated ||
          nbNat.vassalOf === actorId ||
          actorNation.vassalOf === nId
        ) {
          return false;
        }
        const rel = getOrCreateRelation(relations, actorId, nId);
        const alreadyEmbargoedByActor = getEmbargoingNationIds(rel).includes(actorId);
        return (
          !alreadyEmbargoedByActor &&
          !rel.isAllied &&
          !rel.allianceType &&
          (nbNat.aggressiveExpansion >= 45 || rel.score <= -40)
        );
      });

      if (embargoTargetId) {
        const targetNat = nations[embargoTargetId];
        const rel = getOrCreateRelation(relations, actorId, embargoTargetId);
        const rKey = relationKey(actorId, embargoTargetId);
        const nextEmbargoers = Array.from(
          new Set([...getEmbargoingNationIds(rel), actorId])
        );
        updatedRelations = {
          ...relations,
          [rKey]: {
            ...rel,
            hasEmbargo: true,
            embargoingNationIds: nextEmbargoers,
            hasTradeAgreement: false,
            score: Math.max(-100, rel.score - 12),
          },
        };
        if (embargoTargetId === playerNationId) {
          diploNewsItem = {
            title: `🚫 Ticaret Ambargosu: ${actorNation.name}`,
            description: `${actorNation.name}, yükselen gerilim ve agresif genişleme nedeniyle devletimize ticaret ambargosu başlattı.`,
            type: 'COALITION',
          };
        } else if (targetNat) {
          diploNewsItem = {
            title: `🚫 Ambargo: ${actorNation.name} → ${targetNat.name}`,
            description: `${actorNation.name}, ${targetNat.name} devletine ekonomik yaptırım ve ticaret ambargosu uyguladı.`,
            type: 'ECONOMY',
          };
        }
      }
    }

    // 4B-3: Proactive AI-to-Player Live Diplomatic Offers (Trade, Non-Aggression, Defensive Pact, Tribute Gift)
    if (
      !hasActiveIncomingOffer &&
      nextTick >= 9 &&
      nextTick % 12 === 0 &&
      (neighborIds.has(playerNationId) || regionalIds.has(playerNationId)) &&
      !isAtWar(wars, actorId, playerNationId)
    ) {
      const relWithPlayer = getOrCreateRelation(
        updatedRelations || relations,
        actorId,
        playerNationId
      );
      const playerTotalTroops = computeRealmTotalTroops(
        playerNationId,
        activeTerrs,
        movements
      );

      if (
        !relWithPlayer.isAllied &&
        !relWithPlayer.allianceType &&
        relWithPlayer.score >= 22 &&
        hasStrongerOrHighAeNeighbor &&
        actorAllianceCount < 2
      ) {
        incomingOffer = {
          id: `offer_${nextTick}_${actorId}`,
          fromNationId: actorId,
          kind: 'DEFENSIVE_PACT',
          createdTick: nextTick,
          expiresTick: nextTick + 21,
          message: `${actorNation.name} elçisi, bölgesel tehditlere karşı Karşılıklı Savunma Paktı teklif ediyor.`,
        };
      } else if (
        !relWithPlayer.hasTradeAgreement &&
        !relWithPlayer.hasEmbargo &&
        relWithPlayer.score >= (actorPersonality === 'MERCHANT' ? 0 : 8)
      ) {
        incomingOffer = {
          id: `offer_${nextTick}_${actorId}`,
          fromNationId: actorId,
          kind: 'TRADE',
          createdTick: nextTick,
          expiresTick: nextTick + 21,
          message: `${actorNation.name} (${personalityMeta.shortLabel}), karşılıklı ticaret gelirini artıracak Serbest Ticaret Anlaşması öneriyor.`,
        };
      } else if (
        neighborIds.has(playerNationId) &&
        !relWithPlayer.hasNonAggression &&
        !relWithPlayer.isAllied &&
        relWithPlayer.score >= 6
      ) {
        incomingOffer = {
          id: `offer_${nextTick}_${actorId}`,
          fromNationId: actorId,
          kind: 'NON_AGGRESSION',
          createdTick: nextTick,
          expiresTick: nextTick + 21,
          message: `${actorNation.name}, ortak sınır güvenliği için Saldırmazlık Paktı imzalamak istiyor.`,
        };
      } else if (
        neighborIds.has(playerNationId) &&
        playerTotalTroops >= actorTotalTroops * 2.1 &&
        relWithPlayer.score >= -30 &&
        actorNation.treasury >= 450
      ) {
        const giftGold = Math.min(
          360,
          Math.max(160, Math.round(actorNation.treasury * 0.22))
        );
        incomingOffer = {
          id: `offer_${nextTick}_${actorId}`,
          fromNationId: actorId,
          kind: 'TRIBUTE_GIFT',
          goldGift: giftGold,
          createdTick: nextTick,
          expiresTick: nextTick + 21,
          message: `${actorNation.name}, askeri gücünüze hürmeten barışı korumak için ${giftGold} Altın iyi niyet hediyesi sunuyor.`,
        };
      }
    }
  }

  // 5. Strategic Coalition-Aware War Evaluation (Never declare suicidal or reckless wars!)
  // On high/max difficulty (AGGRESSIVE / CHAOS), AI nations do NOT spam random wars;
  // instead they build up their economy/tech and strike only when stability, treasury,
  // manpower, and coalition power ratios are decisively in their favor.
  const maxAllowedGlobalWars =
    aiAggressiveness === 'PASSIVE'
      ? 1
      : aiAggressiveness === 'NORMAL'
      ? 3
      : aiAggressiveness === 'AGGRESSIVE'
      ? 3
      : 4;

  const localRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.9
      : aiAggressiveness === 'NORMAL'
      ? 1.35
      : aiAggressiveness === 'AGGRESSIVE'
      ? 1.25
      : 1.18;

  const coalitionRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.55
      : aiAggressiveness === 'NORMAL'
      ? 1.15
      : aiAggressiveness === 'AGGRESSIVE'
      ? 1.18
      : 1.12;

  const minWarStability = isMasterAiDifficulty ? 56 : 45;
  const minWarManpower = isMasterAiDifficulty ? 9000 : 5000;
  const minWarTreasury = isMasterAiDifficulty ? 750 : 350;

  const actorReadyForOffensiveWar =
    !actorInAnyWar &&
    actorNation.stability >= minWarStability &&
    actorNation.manpower >= minWarManpower &&
    actorNation.treasury >= minWarTreasury &&
    wars.length < maxAllowedGlobalWars;

  if (actorReadyForOffensiveWar) {
    const candidateProvs =
      worldSeed !== undefined
        ? seededShuffle(ownedProvinces, worldSeed, `war_prov_${nextTick}_${actorId}`)
        : ownedProvinces;

    for (const prov of candidateProvs) {
      const currProv = activeTerrs[prov.id];
      if (!currProv || currProv.garrison < 22000) continue;

      const candidateNeighbors =
        worldSeed !== undefined
          ? seededShuffle(
              currProv.neighbors,
              worldSeed,
              `war_nb_${nextTick}_${currProv.id}`
            )
          : currProv.neighbors;

      const candidateTargetId = candidateNeighbors.find((nId) => {
        const nTerr = activeTerrs[nId];
        if (!nTerr || nTerr.ownerId === actorId) return false;
        const targetOwner = nations[nTerr.ownerId];
        if (
          !targetOwner ||
          targetOwner.isEliminated ||
          targetOwner.vassalOf === actorId ||
          actorNation.vassalOf === targetOwner.id
        ) {
          return false;
        }
        if (isAtWar(wars, actorId, targetOwner.id)) return false;

        const rel = getOrCreateRelation(
          updatedRelations || relations,
          actorId,
          targetOwner.id
        );
        if (
          rel.isAllied ||
          rel.hasNonAggression ||
          rel.truceUntilTick > nextTick ||
          rel.score > 25
        ) {
          return false;
        }

        // Compare full coalition military strength so small minors don't suicide into superpowers!
        const simParticipants = resolveWarParticipants(
          actorId,
          targetOwner.id,
          updatedRelations || relations,
          nations
        );
        const attackerCoalitionTroops = simParticipants.attackers.reduce(
          (sum, id) => sum + computeRealmTotalTroops(id, activeTerrs, movements),
          0
        );
        const defenderCoalitionTroops = simParticipants.defenders.reduce(
          (sum, id) => sum + computeRealmTotalTroops(id, activeTerrs, movements),
          0
        );

        const targetDistractedWars = wars.filter(
          (w) =>
            w.attackers.includes(targetOwner.id) ||
            w.defenders.includes(targetOwner.id)
        ).length;
        const distractionDiscount = Math.max(
          0.65,
          1 - targetDistractedWars * 0.16
        );

        const isRevanchistCoreClaim =
          actorPersonality === 'REVANCHIST' && nTerr.coreOwnerId === actorId;
        const baseWarMod = isRevanchistCoreClaim
          ? 0.75
          : personalityMeta.warReadinessMod;
        const seedJitter =
          worldSeed !== undefined
            ? 0.9 +
              seededHash(worldSeed, `war_mod_${nextTick}_${actorId}_${targetOwner.id}`) *
                0.22
            : 1;
        const pWarMod = baseWarMod * seedJitter;

        const isHighAeCoalition =
          targetOwner.aggressiveExpansion >= 55 &&
          attackerCoalitionTroops >= defenderCoalitionTroops * 0.75;
        const hasEmpireAdvantage =
          attackerCoalitionTroops >=
          defenderCoalitionTroops *
            coalitionRatioThreshold *
            distractionDiscount *
            pWarMod;
        const hasBorderAdvantage =
          currProv.garrison >= nTerr.garrison * localRatioThreshold * pWarMod;

        return isHighAeCoalition || (hasEmpireAdvantage && hasBorderAdvantage);
      });

      if (candidateTargetId) {
        const targetTerr = activeTerrs[candidateTargetId];
        const targetOwner = nations[targetTerr.ownerId];
        if (targetOwner) {
          const isCoalition = targetOwner.aggressiveExpansion >= 55;
          const resolution = resolveWarParticipants(
            actorId,
            targetOwner.id,
            updatedRelations || relations,
            nations
          );

          const defAllyNames = resolution.defensiveAlliesCalled
            .map((id) => nations[id]?.name)
            .filter(Boolean);
          const attAllyNames = resolution.offensiveAlliesCalled
            .map((id) => nations[id]?.name)
            .filter(Boolean);

          let allyDesc = '';
          if (defAllyNames.length > 0) {
            allyDesc += ` Savunma paktı uyarınca (${defAllyNames.join(', ')}) savunmaya katıldı.`;
          }
          if (attAllyNames.length > 0) {
            allyDesc += ` Saldırı paktı müttefikleri (${attAllyNames.join(', ')}) taarruza katıldı.`;
          }

          const newWar: ActiveWar = {
            id: `ai_war_${nextTick}_${actorId}`,
            name: isCoalition
              ? `${actorNation.name} Koalisyon Müdahalesi (${targetOwner.name})`
              : `${actorNation.name} - ${targetOwner.name} Savaşı`,
            attackerId: actorId,
            defenderId: targetOwner.id,
            attackers: resolution.attackers,
            defenders: resolution.defenders,
            startedTick: nextTick,
            attackerWarScore: 0,
            casualtiesAttacker: 0,
            casualtiesDefender: 0,
          };

          let alertMessage: string | undefined;
          if (targetOwner.id === playerNationId) {
            alertMessage = `DİKKAT: ${actorNation.name} devletimize savaş ilan etti!`;
          } else if (resolution.defenders.includes(playerNationId)) {
            alertMessage = `🛡️ SAVUNMA PAKTI TETİKLENDİ: Müttefikiniz ${targetOwner.name} saldırıya uğradı! Pakt gereği ${actorNation.name} ile savunma savaşına dahil edildiniz.`;
          } else if (resolution.attackers.includes(playerNationId)) {
            alertMessage = `⚔️ SALDIRI PAKTI DEVREDE: Saldırı paktı ortağınız ${actorNation.name}, ${targetOwner.name} hedefine taarruz başlattı.`;
          }

          return {
            updatedNations,
            updatedTerritories,
            updatedRelations,
            newWar,
            newsItem: {
              title: newWar.name,
              description:
                (isCoalition
                  ? `${actorNation.name}, aşırı genişleyen ${targetOwner.name} devletine karşı Koalisyon Savaşı başlattı!`
                  : `${actorNation.name}, sınır komşusu ${targetOwner.name} devletine (${targetTerr.name} cephesinden) savaş ilan etti.`) +
                allyDesc,
              type: isCoalition ? 'COALITION' : 'WAR',
            },
            playerAlert: alertMessage,
          };
        }
      }
    }
  }

  if (updatedNations || updatedTerritories || updatedRelations || incomingOffer) {
    return {
      updatedNations,
      updatedTerritories,
      updatedRelations,
      incomingOffer,
      newsItem: diploNewsItem,
    };
  }

  return null;
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

// Evaluates weekly unrest drift and triggers authentic rebellions in unassimilated territories with unrest >= 85%
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
      nextUnrest = Math.max(5, Math.min(100, Math.round(t.unrest + adjustedDrift)));
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
