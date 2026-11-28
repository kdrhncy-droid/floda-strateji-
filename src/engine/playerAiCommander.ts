import {
  ActiveBattle,
  ActiveWar,
  AiCommanderStance,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  SeaArmy,
  Territory,
  UnitComposition,
} from '../types/game';
import { getNationModernizedTier } from '../data/world2026Data';
import { isAtWar } from './simulationEngine';
import { findArmyRouteAStar, sphericalDegDist } from './pathfindingEngine';
import { checkStraitMilitaryBlockade, STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import { isTerritoryCoastal } from './worldBuilder';

export const MIN_AI_MARCH_TROOPS = 300;

export interface PlayerAiCommanderInput {
  tick: number;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles?: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies?: SeaArmy[];
  stance?: AiCommanderStance;
}

export interface PlayerAiCommanderOutput {
  updatedTerritories: Record<string, Territory>;
  updatedSeaArmies?: SeaArmy[];
  newMovements: ArmyMovement[];
  actionCount: number;
  summaryToast?: string;
}

function scaleUnitComposition(
  units: UnitComposition | undefined,
  totalGarrison: number,
  sentTroops: number
): UnitComposition {
  if (sentTroops >= totalGarrison) {
    const inf = units?.infantry ?? totalGarrison;
    const arm = units?.armor ?? 0;
    const air = units?.airDrone ?? 0;
    const sum = inf + arm + air;
    if (sum === totalGarrison && sum > 0) {
      return { infantry: inf, armor: arm, airDrone: air };
    }
    return {
      infantry: Math.max(0, totalGarrison - arm - air),
      armor: arm,
      airDrone: air,
    };
  }
  const safeRatio = Math.max(0, Math.min(1, sentTroops / Math.max(1, totalGarrison)));
  const arm = units?.armor ?? 0;
  const air = units?.airDrone ?? 0;
  const sArm = Math.max(0, Math.round(arm * safeRatio));
  const sAir = Math.max(0, Math.round(air * safeRatio));
  const sInf = Math.max(0, sentTroops - sArm - sAir);
  return {
    infantry: sInf,
    armor: sArm,
    airDrone: sAir,
  };
}

function subtractUnitComposition(
  totalUnits: UnitComposition | undefined,
  totalGarrison: number,
  sentTroops: number,
  sentUnits: UnitComposition
): UnitComposition {
  if (sentTroops >= totalGarrison) {
    return { infantry: 0, armor: 0, airDrone: 0 };
  }
  const inf = totalUnits?.infantry ?? totalGarrison;
  const arm = totalUnits?.armor ?? 0;
  const air = totalUnits?.airDrone ?? 0;
  return {
    infantry: Math.max(0, inf - sentUnits.infantry),
    armor: Math.max(0, arm - sentUnits.armor),
    airDrone: Math.max(0, air - sentUnits.airDrone),
  };
}

function computeTerrainDefenseMultiplier(terr: Territory): number {
  let mult = 1.0;
  if (terr.terrain === 'DAGLIK') mult += 0.28;
  else if (terr.terrain === 'ORMAN' || terr.terrain === 'COL') mult += 0.14;
  const fortLvl = terr.buildings?.fortress || 0;
  const wallFactor = (terr.castleWallHp ?? 100) / 100;
  mult += fortLvl * 0.12 * wallFactor;
  return mult;
}

/**
 * Smart 5-Tier Player AI War Commander ("Yapay Zekâya Devret"):
 * - Strict Guardrails: NEVER declares wars, NEVER signs peace, NEVER disbands troops,
 *   NEVER leaves phantom 500-soldier garrisons behind in cities, NEVER chases distant
 *   undefended territories of secondary war allies, and NEVER overrides provinces that
 *   already have an active outgoing player movement.
 * - Priority 1: Relieve owned besieged provinces, struggling active battles & threatened capitals.
 * - Priority 2: Reinforce outnumbered war borders & reclaim lost core territories.
 * - Priority 3: Launch calculated offensives on winnable primary enemy provinces + Multi-Province Pincer
 *   Coordination (Kıskaç Harekatı).
 * - Priority 4: Advance 100% of idle rear/newly-recruited interior reserves toward the active frontline.
 * - Priority 5: Amphibious Coastal Landings & Anchored SeaArmy Disembarkation onto overseas/island primary enemy pockets.
 */
export function evaluatePlayerAiCommander(
  input: PlayerAiCommanderInput
): PlayerAiCommanderOutput | null {
  const {
    tick,
    playerNationId,
    nations,
    territories,
    relations,
    wars,
    battles = [],
    movements,
    seaArmies = [],
    stance = 'BALANCED',
  } = input;

  const playerNation = nations[playerNationId];
  if (!playerNation || playerNation.isEliminated) return null;

  // Distinguish primary war targets (war leaders) from secondary co-belligerent allies!
  const enemyIds = new Set<string>();
  const primaryEnemyIds = new Set<string>();
  for (const w of wars) {
    const onAtt =
      w.attackerId === playerNationId || w.attackers.includes(playerNationId);
    const onDef =
      w.defenderId === playerNationId || w.defenders.includes(playerNationId);
    if (onAtt) {
      if (w.defenderId && w.defenderId !== playerNationId) {
        primaryEnemyIds.add(w.defenderId);
      }
      w.defenders.forEach((id) => {
        if (id !== playerNationId) enemyIds.add(id);
      });
    } else if (onDef) {
      if (w.attackerId && w.attackerId !== playerNationId) {
        primaryEnemyIds.add(w.attackerId);
      }
      w.attackers.forEach((id) => {
        if (id !== playerNationId) enemyIds.add(id);
      });
    }
  }

  if (enemyIds.size === 0) {
    return null;
  }

  // Fallback: if primaryEnemyIds is somehow empty, treat enemyIds as primary
  if (primaryEnemyIds.size === 0) {
    enemyIds.forEach((id) => primaryEnemyIds.add(id));
  }

  const allTerritoriesList = Object.values(territories).filter((t): t is Territory =>
    Boolean(t)
  );
  const playerTerrIds = allTerritoriesList
    .filter((t) => t.ownerId === playerNationId)
    .map((t) => t.id);

  if (playerTerrIds.length === 0) return null;

  const primaryEnemyRemainingProvinces = allTerritoriesList.filter((t) =>
    primaryEnemyIds.has(t.ownerId)
  );
  const allEnemyRemainingProvinces = allTerritoriesList.filter((t) =>
    enemyIds.has(t.ownerId)
  );
  // Focus offensive campaigns strictly on primary war targets while they hold any province
  const strategicEnemyProvinces =
    primaryEnemyRemainingProvinces.length > 0
      ? primaryEnemyRemainingProvinces
      : allEnemyRemainingProvinces;

  const enemyProvCountByNation: Record<string, number> = {};
  let totalStrategicEnemyGarrison = 0;
  for (const et of allEnemyRemainingProvinces) {
    enemyProvCountByNation[et.ownerId] =
      (enemyProvCountByNation[et.ownerId] || 0) + 1;
  }
  for (const et of strategicEnemyProvinces) {
    totalStrategicEnemyGarrison += et.garrison || 0;
  }

  const totalPlayerGarrison = playerTerrIds.reduce(
    (sum, id) => sum + (territories[id]?.garrison || 0),
    0
  );

  // Mop-Up Mode activates against the primary war target when <= 4 provinces remain and player outnumbers them >= 1.5x
  const isMopUpPhase =
    stance !== 'DEFENSIVE' &&
    strategicEnemyProvinces.length > 0 &&
    strategicEnemyProvinces.length <= 4 &&
    totalPlayerGarrison >= Math.max(2000, totalStrategicEnemyGarrison * 1.5);

  const stanceProfile =
    stance === 'AGGRESSIVE'
      ? {
          capitalReserve: isMopUpPhase ? 0 : 1200,
          borderReserve: isMopUpPhase ? 0 : 800,
          maxTotalMoves: 8,
          maxReliefDispatches: 2,
          attackRatioThreshold: isMopUpPhase ? 0.85 : 0.98,
          overkillCap: isMopUpPhase ? 2.6 : 1.85,
          minSendable: MIN_AI_MARCH_TROOPS,
          rearThreshold: MIN_AI_MARCH_TROOPS,
        }
      : stance === 'DEFENSIVE'
      ? {
          capitalReserve: 4500,
          borderReserve: 2800,
          maxTotalMoves: 5,
          maxReliefDispatches: 4,
          attackRatioThreshold: 1.45,
          overkillCap: 1.35,
          minSendable: 900,
          rearThreshold: 800,
        }
      : {
          capitalReserve: isMopUpPhase ? 0 : 2800,
          borderReserve: isMopUpPhase ? 0 : 1600,
          maxTotalMoves: 7,
          maxReliefDispatches: 2,
          attackRatioThreshold: isMopUpPhase ? 0.9 : 1.12,
          overkillCap: isMopUpPhase ? 2.4 : 1.6,
          minSendable: MIN_AI_MARCH_TROOPS,
          rearThreshold: MIN_AI_MARCH_TROOPS,
        };

  const straitSet = new Set(STRATEGIC_STRAITS.flatMap((s) => s.shoreIds));
  const battleMap = new Map<string, ActiveBattle>();
  for (const b of battles) {
    battleMap.set(b.territoryId, b);
  }

  // Respect any province where player (or prior pass) already has an active outgoing army
  const busyOriginIds = new Set<string>();
  const incomingPlayerTroopsByTarget: Record<string, number> = {};
  for (const mv of movements) {
    if (mv.ownerId !== playerNationId) continue;
    busyOriginIds.add(mv.fromTerritoryId);
    const destId = mv.finalDestinationId || mv.toTerritoryId;
    incomingPlayerTroopsByTarget[destId] =
      (incomingPlayerTroopsByTarget[destId] || 0) + mv.troops;
  }

  const workingTerritories: Record<string, Territory> = { ...territories };
  const workingSeaArmies: SeaArmy[] = [...seaArmies];
  let seaArmiesModified = false;
  const newMovements: ArmyMovement[] = [];
  const summaryLabels: string[] = [];

  /**
   * Computes how many soldiers must remain in `terr` when dispatching toward `targetToExcludeId`.
   * - Interior provinces (or borders where no OTHER armed enemy province exists): 0 reserve! Uses 100% of the army.
   * - DEFENSIVE stance facing armed enemies: preserves defensive frontier reserve.
   * - BALANCED/AGGRESSIVE facing a SECOND armed enemy flank (`otherEnemyNeighbors` with garrison > 0): keeps a proportional flank guard.
   */
  const getReserveForProvince = (
    terr: Territory,
    targetToExcludeId?: string
  ): number => {
    const allEnemyNeighbors = terr.neighbors
      .map((nId) => workingTerritories[nId])
      .filter(
        (nb): nb is Territory =>
          Boolean(nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId))
      );

    if (allEnemyNeighbors.length === 0) {
      return 0;
    }

    if (stance === 'DEFENSIVE') {
      const maxAdjEnemyGarrison = allEnemyNeighbors.reduce(
        (maxG, nb) => Math.max(maxG, nb.garrison || 0),
        0
      );
      if (maxAdjEnemyGarrison <= 0) return 0;
      return terr.isCapital
        ? stanceProfile.capitalReserve
        : stanceProfile.borderReserve;
    }

    const otherEnemyNeighbors = targetToExcludeId
      ? allEnemyNeighbors.filter((nb) => nb.id !== targetToExcludeId)
      : allEnemyNeighbors;

    if (otherEnemyNeighbors.length === 0) {
      return 0;
    }

    const maxOtherEnemyGarrison = otherEnemyNeighbors.reduce(
      (maxG, nb) => Math.max(maxG, nb.garrison || 0),
      0
    );

    // Never leave phantom soldiers behind against empty (0-garrison) enemy provinces!
    if (maxOtherEnemyGarrison <= 0) {
      return 0;
    }

    const baseReserve = terr.isCapital
      ? stanceProfile.capitalReserve
      : stanceProfile.borderReserve;

    if (baseReserve <= 0) return 0;

    const flankFactor = stance === 'AGGRESSIVE' ? 0.25 : 0.45;
    return Math.min(baseReserve, Math.round(maxOtherEnemyGarrison * flankFactor));
  };

  const canProvideReinforcement = (terr: Territory): boolean => {
    if (terr.ownerId !== playerNationId) return false;
    if (busyOriginIds.has(terr.id)) return false;
    if (terr.siege || battleMap.has(terr.id)) return false;
    const reserve = getReserveForProvince(terr);
    return terr.garrison - reserve >= stanceProfile.minSendable;
  };

  const dispatchMovement = (params: {
    fromId: string;
    toId: string;
    troops: number;
    hops: string[];
    isAttack: boolean;
    isNaval?: boolean;
    fromCoords?: [number, number];
  }) => {
    const { fromId, toId, troops, hops, isAttack, isNaval, fromCoords } = params;
    const src = workingTerritories[fromId];
    if (!src || troops < MIN_AI_MARCH_TROOPS || hops.length === 0) return;

    const sendTroops = Math.min(
      Math.floor(troops),
      Math.max(0, Math.floor(src.garrison))
    );
    if (sendTroops < MIN_AI_MARCH_TROOPS) return;

    const sentUnits = scaleUnitComposition(src.units, src.garrison, sendTroops);
    const remUnits = subtractUnitComposition(
      src.units,
      src.garrison,
      sendTroops,
      sentUnits
    );

    workingTerritories[fromId] = {
      ...src,
      garrison: Math.max(0, src.garrison - sendTroops),
      units: remUnits,
    };
    busyOriginIds.add(fromId);
    incomingPlayerTroopsByTarget[toId] =
      (incomingPlayerTroopsByTarget[toId] || 0) + sendTroops;

    const firstHop = hops[0];
    const firstHopTerr = workingTerritories[firstHop];
    newMovements.push({
      id: `mv_ai_cmd_${tick}_${fromId}_${toId}_${newMovements.length}`,
      ownerId: playerNationId,
      fromTerritoryId: fromId,
      toTerritoryId: firstHop,
      routeQueue: hops.slice(1),
      finalDestinationId: toId,
      ...(fromCoords ? { fromCoords } : {}),
      ...(isNaval ? { isNaval: true } : {}),
      troops: sendTroops,
      units: sentUnits,
      progress: 14,
      isAttack:
        isAttack ||
        Boolean(
          firstHopTerr &&
            firstHopTerr.ownerId !== playerNationId &&
            enemyIds.has(firstHopTerr.ownerId)
        ),
    });
  };

  // =========================================================================
  // PRIORITY 1: Relieve Besieged Cities, Struggling Battles & Threatened Capitals
  // =========================================================================
  interface UrgentDefenseTask {
    targetId: string;
    urgency: number;
    neededTroops: number;
  }
  const urgentTasks: UrgentDefenseTask[] = [];

  for (const tId of playerTerrIds) {
    const t = workingTerritories[tId];
    if (!t) continue;
    const activeBattle = battleMap.get(tId);
    const incoming = incomingPlayerTroopsByTarget[tId] || 0;

    if (t.siege) {
      const needed = Math.max(
        1500,
        Math.round(t.siege.attackerTroops * 1.25) - t.garrison - incoming
      );
      if (needed > 0) {
        urgentTasks.push({
          targetId: tId,
          urgency: (t.isCapital ? 5000 : 2500) + t.siege.progress * 25,
          neededTroops: needed,
        });
      }
      continue;
    }

    if (activeBattle && activeBattle.defenderId === playerNationId) {
      const needed = Math.max(
        0,
        Math.round(activeBattle.attackerTroops * 1.25) -
          activeBattle.defenderTroops -
          incoming
      );
      if (needed >= 600) {
        urgentTasks.push({
          targetId: tId,
          urgency: (t.isCapital ? 4800 : 2200) + needed * 0.2,
          neededTroops: needed,
        });
      }
      continue;
    }

    // Capital or frontier facing a stronger ARMED adjacent war enemy
    let maxEnemyNeighbor = 0;
    for (const nId of t.neighbors) {
      const nb = workingTerritories[nId];
      if (nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId) && nb.garrison > 0) {
        const pooledFriendlyAroundEnemy = nb.neighbors.reduce((sum, fnId) => {
          const fn = workingTerritories[fnId];
          return fn && fn.ownerId === playerNationId ? sum + fn.garrison : sum;
        }, 0);
        const canPincerThisEnemy =
          stance !== 'DEFENSIVE' &&
          pooledFriendlyAroundEnemy >= nb.garrison * 1.15;
        if (!canPincerThisEnemy) {
          maxEnemyNeighbor = Math.max(maxEnemyNeighbor, nb.garrison);
        }
      }
    }
    if (maxEnemyNeighbor > 0 && t.garrison + incoming < maxEnemyNeighbor * 0.85) {
      const deficit = Math.round(maxEnemyNeighbor * 1.05 - (t.garrison + incoming));
      if (deficit >= 900) {
        urgentTasks.push({
          targetId: tId,
          urgency: (t.isCapital ? 4200 : 1200) + deficit * 0.15,
          neededTroops: deficit,
        });
      }
    }
  }

  urgentTasks.sort((a, b) => b.urgency - a.urgency);

  let reliefDispatches = 0;
  for (const task of urgentTasks) {
    if (
      reliefDispatches >= stanceProfile.maxReliefDispatches ||
      newMovements.length >= stanceProfile.maxTotalMoves
    ) {
      break;
    }
    const destTerr = workingTerritories[task.targetId];
    if (!destTerr) continue;

    const donors = playerTerrIds
      .filter((id) => id !== task.targetId)
      .map((id) => workingTerritories[id])
      .filter((t): t is Territory => Boolean(t && canProvideReinforcement(t)))
      .map((t) => ({
        terr: t,
        surplus: Math.floor(t.garrison - getReserveForProvince(t)),
        dist: sphericalDegDist(t.centroid, destTerr.centroid),
      }))
      .sort((a, b) => a.dist - b.dist || b.surplus - a.surplus);

    for (const d of donors.slice(0, 4)) {
      const route = findArmyRouteAStar({
        fromId: d.terr.id,
        toId: task.targetId,
        moverNationId: playerNationId,
        territories: workingTerritories,
        nations,
        relations,
        wars,
        allowTargetWarDeclaration: false,
      });
      if (!route.reachable || route.hops.length === 0) continue;

      // Send full surplus unless surplus is vastly larger than needed AND remaining stack is meaningful
      const isInteriorDonor = getReserveForProvince(d.terr) === 0;
      const sendAmount =
        isInteriorDonor || d.surplus <= Math.max(task.neededTroops * 1.6, 2500)
          ? d.surplus
          : Math.min(d.surplus, Math.max(task.neededTroops, Math.round(d.surplus * 0.8)));

      dispatchMovement({
        fromId: d.terr.id,
        toId: task.targetId,
        troops: sendAmount,
        hops: route.hops,
        isAttack: Boolean(destTerr.siege || battleMap.has(task.targetId)),
      });
      reliefDispatches++;
      summaryLabels.push(`${destTerr.name} savunma/yardım`);
      break;
    }
  }

  // =========================================================================
  // PRIORITY 2 & 3: Reclaim Lost Cores, Single-Province Offensives & Multi-Province Pincer Attacks (Kıskaç Harekatı)
  // =========================================================================
  const playerTierMod = 1 + getNationModernizedTier(playerNation) * 0.1;
  const offensiveCandidates: {
    fromId: string;
    toId: string;
    sendTroops: number;
    score: number;
  }[] = [];

  for (const srcId of playerTerrIds) {
    const src = workingTerritories[srcId];
    if (!src || busyOriginIds.has(srcId) || src.siege || battleMap.has(srcId)) continue;

    for (const nbId of src.neighbors) {
      const enemyTerr = workingTerritories[nbId];
      if (!enemyTerr || enemyTerr.ownerId === playerNationId) continue;
      if (!enemyIds.has(enemyTerr.ownerId)) continue;
      if (!isAtWar(wars, playerNationId, enemyTerr.ownerId)) continue;

      const isPrimaryEnemy = primaryEnemyIds.has(enemyTerr.ownerId);
      const isLostCore = enemyTerr.coreOwnerId === playerNationId;

      // Do NOT divert armies into undefended (0-garrison) provinces of a secondary war ally
      // while the primary war enemy still holds territories (ally lands cannot be annexed in peace!)
      if (
        !isPrimaryEnemy &&
        !isLostCore &&
        primaryEnemyRemainingProvinces.length > 0 &&
        enemyTerr.garrison <= 0
      ) {
        continue;
      }

      const reserve = getReserveForProvince(src, nbId);
      const sendable = Math.floor(src.garrison - reserve);
      if (sendable < stanceProfile.minSendable) continue;

      const straitCheck = checkStraitMilitaryBlockade({
        fromId: srcId,
        toId: nbId,
        moverNationId: playerNationId,
        territories: workingTerritories,
        wars,
      });
      if (straitCheck.blocked) continue;

      const alreadyIncoming = incomingPlayerTroopsByTarget[nbId] || 0;
      const effectiveDefense =
        Math.max(400, enemyTerr.garrison) * computeTerrainDefenseMultiplier(enemyTerr);
      const effectiveOffense = (sendable + alreadyIncoming * 0.85) * playerTierMod;

      // Require realistic advantage per stance
      if (effectiveOffense < effectiveDefense * stanceProfile.attackRatioThreshold) continue;

      // Skip target if already besieged cleanly by player with no enemy garrison remaining
      if (
        enemyTerr.siege &&
        enemyTerr.siege.attackerId === playerNationId &&
        enemyTerr.garrison <= 350 &&
        enemyTerr.siege.attackerTroops >= 800
      ) {
        continue;
      }

      // Skip target if we already have sufficient effectiveDefense marching on it
      if (
        alreadyIncoming >=
        Math.max(1800, effectiveDefense * stanceProfile.overkillCap)
      ) {
        continue;
      }

      const isLastPocket =
        isPrimaryEnemy && (enemyProvCountByNation[enemyTerr.ownerId] || 99) <= 3;
      const distPenalty = sphericalDegDist(src.centroid, enemyTerr.centroid) * 280;
      const strategicScore =
        (isPrimaryEnemy ? 8500 : -3500) +
        (isLastPocket ? 5500 : 0) +
        (isLostCore ? 5000 : 0) +
        (enemyTerr.isCapital ? 4200 : 0) +
        (straitSet.has(enemyTerr.id) ? 2000 : 0) +
        (enemyTerr.baseGdp || 30) * 12 +
        (effectiveOffense - effectiveDefense) * 0.18 -
        enemyTerr.garrison * 0.15 -
        distPenalty;

      offensiveCandidates.push({
        fromId: srcId,
        toId: nbId,
        sendTroops: sendable,
        score: strategicScore,
      });
    }
  }

  offensiveCandidates.sort((a, b) => b.score - a.score);
  for (const cand of offensiveCandidates) {
    if (newMovements.length >= stanceProfile.maxTotalMoves) break;
    if (busyOriginIds.has(cand.fromId)) continue;
    const dst = workingTerritories[cand.toId];
    if (!dst) continue;
    const effDef = Math.max(400, dst.garrison) * computeTerrainDefenseMultiplier(dst);
    if (
      (incomingPlayerTroopsByTarget[cand.toId] || 0) >=
      Math.max(2200, effDef * stanceProfile.overkillCap)
    ) {
      continue;
    }

    dispatchMovement({
      fromId: cand.fromId,
      toId: cand.toId,
      troops: cand.sendTroops,
      hops: [cand.toId],
      isAttack: true,
    });
    summaryLabels.push(`${dst.name} taarruzu`);
  }

  // =========================================================================
  // PRIORITY 3B: Multi-Province Coordinated Pincer Assault ("Kıskaç Harekatı")
  // =========================================================================
  if (newMovements.length < stanceProfile.maxTotalMoves) {
    const borderEnemyTargets = strategicEnemyProvinces
      .filter((et) =>
        et.neighbors.some((nId) => workingTerritories[nId]?.ownerId === playerNationId)
      )
      .sort((a, b) => {
        const aPrimary = primaryEnemyIds.has(a.ownerId) ? 0 : 1;
        const bPrimary = primaryEnemyIds.has(b.ownerId) ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        const aLeft = enemyProvCountByNation[a.ownerId] || 99;
        const bLeft = enemyProvCountByNation[b.ownerId] || 99;
        return aLeft - bLeft || Number(b.isCapital) - Number(a.isCapital) || a.garrison - b.garrison;
      });

    for (const enemyTarget of borderEnemyTargets) {
      if (newMovements.length >= stanceProfile.maxTotalMoves) break;
      const alreadyIncoming = incomingPlayerTroopsByTarget[enemyTarget.id] || 0;
      const effectiveDefense =
        Math.max(400, enemyTarget.garrison) * computeTerrainDefenseMultiplier(enemyTarget);
      if (alreadyIncoming >= Math.max(2200, effectiveDefense * stanceProfile.overkillCap)) {
        continue;
      }

      const availableNeighborDonors = enemyTarget.neighbors
        .map((nId) => workingTerritories[nId])
        .filter((t): t is Territory => {
          if (!t || t.ownerId !== playerNationId) return false;
          if (busyOriginIds.has(t.id) || t.siege || battleMap.has(t.id)) return false;
          const straitCheck = checkStraitMilitaryBlockade({
            fromId: t.id,
            toId: enemyTarget.id,
            moverNationId: playerNationId,
            territories: workingTerritories,
            wars,
          });
          if (straitCheck.blocked) return false;
          const reserve = getReserveForProvince(t, enemyTarget.id);
          return Math.floor(t.garrison - reserve) >= MIN_AI_MARCH_TROOPS;
        })
        .map((t) => ({
          terr: t,
          sendable: Math.floor(t.garrison - getReserveForProvince(t, enemyTarget.id)),
        }))
        .filter((d) => d.sendable >= MIN_AI_MARCH_TROOPS)
        .sort((a, b) => b.sendable - a.sendable);

      if (availableNeighborDonors.length === 0) continue;

      const combinedSendable = availableNeighborDonors.reduce((s, d) => s + d.sendable, 0);
      const combinedOffense = (combinedSendable + alreadyIncoming) * playerTierMod;
      const requiredThreshold = isMopUpPhase
        ? effectiveDefense * 0.9
        : effectiveDefense * stanceProfile.attackRatioThreshold;

      if (combinedOffense >= requiredThreshold) {
        let dispatchedForPincer = 0;
        for (const donor of availableNeighborDonors) {
          if (newMovements.length >= stanceProfile.maxTotalMoves) break;
          if (
            (incomingPlayerTroopsByTarget[enemyTarget.id] || 0) >=
            Math.max(2500, effectiveDefense * stanceProfile.overkillCap)
          ) {
            break;
          }
          dispatchMovement({
            fromId: donor.terr.id,
            toId: enemyTarget.id,
            troops: donor.sendable,
            hops: [enemyTarget.id],
            isAttack: true,
          });
          dispatchedForPincer++;
        }
        if (dispatchedForPincer > 0) {
          summaryLabels.push(`${enemyTarget.name} kıskaç taarruzu`);
        }
      }
    }
  }

  // =========================================================================
  // PRIORITY 4: March 100% of Idle Interior Reserves & Fresh Recruits to the Active Frontline
  // (Never leaves 500 soldiers behind in interior cities, and strictly targets the primary war front!)
  // =========================================================================
  const primaryFrontTargets = playerTerrIds
    .map((id) => workingTerritories[id])
    .filter((t): t is Territory => {
      if (!t) return false;
      return t.neighbors.some((nId) => {
        const nb = workingTerritories[nId];
        return Boolean(nb && nb.ownerId !== playerNationId && primaryEnemyIds.has(nb.ownerId));
      });
    })
    .sort((a, b) => a.garrison - b.garrison);

  const fallbackFrontTargets =
    primaryFrontTargets.length > 0
      ? primaryFrontTargets
      : playerTerrIds
          .map((id) => workingTerritories[id])
          .filter((t): t is Territory => {
            if (!t) return false;
            return t.neighbors.some((nId) => {
              const nb = workingTerritories[nId];
              return Boolean(
                nb &&
                  nb.ownerId !== playerNationId &&
                  enemyIds.has(nb.ownerId) &&
                  nb.garrison > 0
              );
            });
          })
          .sort((a, b) => a.garrison - b.garrison);

  if (newMovements.length < stanceProfile.maxTotalMoves) {
    const idleInteriorReserves = playerTerrIds
      .map((id) => workingTerritories[id])
      .filter((t): t is Territory => {
        if (!t || busyOriginIds.has(t.id) || t.siege || battleMap.has(t.id)) {
          return false;
        }
        const touchesRelevantEnemy = t.neighbors.some((nId) => {
          const nb = workingTerritories[nId];
          if (!nb || nb.ownerId === playerNationId || !enemyIds.has(nb.ownerId)) {
            return false;
          }
          if (primaryEnemyIds.has(nb.ownerId)) return true;
          return nb.garrison > 0 || primaryEnemyRemainingProvinces.length === 0;
        });
        return !touchesRelevantEnemy && t.garrison >= stanceProfile.rearThreshold;
      })
      .sort((a, b) => b.garrison - a.garrison);

    for (const rear of idleInteriorReserves.slice(0, stance === 'AGGRESSIVE' ? 5 : 4)) {
      if (newMovements.length >= stanceProfile.maxTotalMoves) break;
      const moveTroops = Math.floor(rear.garrison);
      if (moveTroops < MIN_AI_MARCH_TROOPS) continue;

      // First try: during Mop-Up or when rear army is strong, route directly onto the nearest PRIMARY enemy province via A*!
      let dispatchedDirect = false;
      if (
        primaryEnemyRemainingProvinces.length > 0 &&
        (isMopUpPhase || rear.garrison >= 3500)
      ) {
        const sortedPrimaryTargets = [...primaryEnemyRemainingProvinces].sort(
          (a, b) =>
            sphericalDegDist(rear.centroid, a.centroid) -
            sphericalDegDist(rear.centroid, b.centroid)
        );
        for (const enemyTarget of sortedPrimaryTargets.slice(0, 3)) {
          if (
            rear.garrison <
            Math.max(MIN_AI_MARCH_TROOPS, enemyTarget.garrison * 0.85)
          ) {
            continue;
          }
          const routeToEnemy = findArmyRouteAStar({
            fromId: rear.id,
            toId: enemyTarget.id,
            moverNationId: playerNationId,
            territories: workingTerritories,
            nations,
            relations,
            wars,
            allowTargetWarDeclaration: false,
          });
          if (routeToEnemy.reachable && routeToEnemy.hops.length > 0) {
            dispatchMovement({
              fromId: rear.id,
              toId: enemyTarget.id,
              troops: moveTroops,
              hops: routeToEnemy.hops,
              isAttack: true,
            });
            summaryLabels.push(`${enemyTarget.name} cephe yürüyüşü`);
            dispatchedDirect = true;
            break;
          }
        }
      }
      if (dispatchedDirect) continue;

      // Second try: route 100% of rear reserve to the nearest active frontline province!
      if (fallbackFrontTargets.length > 0) {
        const bestFront = [...fallbackFrontTargets].sort((a, b) => {
          const distA = sphericalDegDist(rear.centroid, a.centroid);
          const distB = sphericalDegDist(rear.centroid, b.centroid);
          return distA - distB + (a.garrison - b.garrison) * 0.0002;
        })[0];
        if (!bestFront || bestFront.id === rear.id) continue;

        const route = findArmyRouteAStar({
          fromId: rear.id,
          toId: bestFront.id,
          moverNationId: playerNationId,
          territories: workingTerritories,
          nations,
          relations,
          wars,
          allowTargetWarDeclaration: false,
        });
        if (!route.reachable || route.hops.length === 0) continue;

        dispatchMovement({
          fromId: rear.id,
          toId: bestFront.id,
          troops: moveTroops,
          hops: route.hops,
          isAttack: false,
        });
        summaryLabels.push(`${bestFront.name} cephe ikmali`);
      }
    }
  }

  // =========================================================================
  // PRIORITY 5: Amphibious Coastal Landings & Anchored SeaArmy Disembarkation
  // Strictly targets PRIMARY war enemies (never sails off to distant empty ally coasts!)
  // =========================================================================
  if (
    newMovements.length < stanceProfile.maxTotalMoves &&
    primaryEnemyRemainingProvinces.length > 0
  ) {
    const primaryCoastalTargets = primaryEnemyRemainingProvinces.filter(
      (t) => isTerritoryCoastal(t) && Boolean(t.centroid)
    );
    const hasActivePrimaryLandFront = primaryFrontTargets.length > 0;

    if (primaryCoastalTargets.length > 0) {
      // 5A. Disembark any idle anchored player SeaArmy onto the nearest reachable primary enemy coastal target
      for (let sIdx = workingSeaArmies.length - 1; sIdx >= 0; sIdx--) {
        if (newMovements.length >= stanceProfile.maxTotalMoves) break;
        const fleet = workingSeaArmies[sIdx];
        if (!fleet || fleet.ownerId !== playerNationId || fleet.troops < 1000) continue;

        const targetCoast = [...primaryCoastalTargets]
          .map((et) => ({
            et,
            dist: Math.hypot(
              fleet.coords[0] - et.centroid[0],
              fleet.coords[1] - et.centroid[1]
            ),
          }))
          .filter(({ et, dist }) => {
            const alreadyInc = incomingPlayerTroopsByTarget[et.id] || 0;
            return (
              dist <= 28 &&
              fleet.troops + alreadyInc >= Math.max(1000, et.garrison * 0.9)
            );
          })
          .sort(
            (a, b) =>
              a.dist - b.dist ||
              Number(b.et.isCapital) - Number(a.et.isCapital)
          )[0]?.et;

        if (targetCoast) {
          workingSeaArmies.splice(sIdx, 1);
          seaArmiesModified = true;
          incomingPlayerTroopsByTarget[targetCoast.id] =
            (incomingPlayerTroopsByTarget[targetCoast.id] || 0) + fleet.troops;
          newMovements.push({
            id: `mv_ai_sea_land_${tick}_${fleet.id}_${targetCoast.id}`,
            ownerId: playerNationId,
            fromTerritoryId:
              fleet.anchorCoastId || playerNation.capitalTerritoryId,
            toTerritoryId: targetCoast.id,
            finalDestinationId: targetCoast.id,
            fromCoords: fleet.coords,
            isNaval: true,
            troops: fleet.troops,
            units: fleet.units,
            progress: 18,
            isAttack: true,
          });
          summaryLabels.push(`${targetCoast.name} donanma çıkarması`);
        }
      }

      // 5B. Launch Amphibious Coastal Invasion from player coastal cities ONLY when:
      // - There is NO land border with the primary enemy (overseas/island enemy), OR
      // - It is a short tactical sea crossing (<= 6.5 deg) onto a primary enemy coastal province!
      const maxAmphibDist = hasActivePrimaryLandFront ? 6.5 : 26;
      const playerCoastalDonors = playerTerrIds
        .map((id) => workingTerritories[id])
        .filter((t): t is Territory => {
          if (
            !t ||
            busyOriginIds.has(t.id) ||
            t.siege ||
            battleMap.has(t.id) ||
            !isTerritoryCoastal(t)
          ) {
            return false;
          }
          // If this province already borders a primary enemy by land, fight by land rather than embarking!
          const bordersPrimaryByLand = t.neighbors.some((nId) => {
            const nb = workingTerritories[nId];
            return Boolean(nb && primaryEnemyIds.has(nb.ownerId));
          });
          if (bordersPrimaryByLand) return false;
          return t.garrison >= (isMopUpPhase ? 1200 : 2800);
        })
        .sort((a, b) => b.garrison - a.garrison);

      for (const coastSrc of playerCoastalDonors.slice(0, 2)) {
        if (newMovements.length >= stanceProfile.maxTotalMoves) break;
        const reserve = getReserveForProvince(coastSrc);
        const sendable = Math.floor(coastSrc.garrison - reserve);
        if (sendable < 1200) continue;

        const targetCoast = [...primaryCoastalTargets]
          .map((et) => ({
            et,
            dist: Math.hypot(
              coastSrc.centroid[0] - et.centroid[0],
              coastSrc.centroid[1] - et.centroid[1]
            ),
          }))
          .filter(({ et, dist }) => {
            if (dist > maxAmphibDist) return false;
            const alreadyInc = incomingPlayerTroopsByTarget[et.id] || 0;
            if (
              alreadyInc >=
              Math.max(2200, et.garrison * stanceProfile.overkillCap)
            ) {
              return false;
            }
            return sendable + alreadyInc >= Math.max(1200, et.garrison * 0.9);
          })
          .sort(
            (a, b) =>
              a.dist - b.dist ||
              Number(b.et.isCapital) - Number(a.et.isCapital)
          )[0]?.et;

        if (targetCoast) {
          dispatchMovement({
            fromId: coastSrc.id,
            toId: targetCoast.id,
            troops: sendable,
            hops: [targetCoast.id],
            isAttack: true,
            isNaval: true,
            fromCoords: coastSrc.centroid,
          });
          summaryLabels.push(`${targetCoast.name} amfibi çıkarma`);
        }
      }
    }
  }

  if (newMovements.length === 0) {
    return null;
  }

  return {
    updatedTerritories: workingTerritories,
    ...(seaArmiesModified ? { updatedSeaArmies: workingSeaArmies } : {}),
    newMovements,
    actionCount: newMovements.length,
    summaryToast: `🤖 YZ Komutanı ${newMovements.length} birlik sevk etti (${summaryLabels.slice(0, 2).join(', ')})`,
  };
}
