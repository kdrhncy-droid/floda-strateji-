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
  ratio: number
): UnitComposition {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const inf = units?.infantry ?? totalGarrison;
  const arm = units?.armor ?? 0;
  const air = units?.airDrone ?? 0;
  return {
    infantry: Math.max(0, Math.round(inf * safeRatio)),
    armor: Math.max(0, Math.round(arm * safeRatio)),
    airDrone: Math.max(0, Math.round(air * safeRatio)),
  };
}

function subtractUnitComposition(
  totalUnits: UnitComposition | undefined,
  totalGarrison: number,
  sentUnits: UnitComposition
): UnitComposition {
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
 *   and NEVER overrides provinces that already have an active outgoing player movement.
 * - Priority 1: Relieve owned besieged provinces, struggling active battles & threatened capitals.
 * - Priority 2: Reinforce outnumbered war borders & reclaim lost core territories.
 * - Priority 3: Launch calculated offensives on winnable enemy provinces + Multi-Province Pincer
 *   Coordination (Kıskaç Harekatı) when a last enemy citadel/capital is stronger than any single border province.
 * - Priority 4: Advance idle rear/newly-recruited interior reserves toward the active frontline,
 *   or directly via multi-hop A* onto remaining enemy provinces during mop-up.
 * - Priority 5: Amphibious Coastal Landings & Anchored SeaArmy Disembarkation onto overseas/island enemy pockets.
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

  // Identify all active war enemies of the player (strictly wartime-only!)
  const enemyIds = new Set<string>();
  for (const w of wars) {
    const onAtt =
      w.attackerId === playerNationId || w.attackers.includes(playerNationId);
    const onDef =
      w.defenderId === playerNationId || w.defenders.includes(playerNationId);
    if (onAtt) {
      w.defenders.forEach((id) => {
        if (id !== playerNationId) enemyIds.add(id);
      });
    } else if (onDef) {
      w.attackers.forEach((id) => {
        if (id !== playerNationId) enemyIds.add(id);
      });
    }
  }

  if (enemyIds.size === 0) {
    return null;
  }

  const allTerritoriesList = Object.values(territories).filter((t): t is Territory => Boolean(t));
  const playerTerrIds = allTerritoriesList
    .filter((t) => t.ownerId === playerNationId)
    .map((t) => t.id);

  if (playerTerrIds.length === 0) return null;

  // Count how many provinces each enemy still holds to detect "Mop-Up / Final Pockets" mode
  const enemyRemainingProvinces = allTerritoriesList.filter((t) =>
    enemyIds.has(t.ownerId)
  );
  const enemyProvCountByNation: Record<string, number> = {};
  let totalEnemyGarrison = 0;
  for (const et of enemyRemainingProvinces) {
    enemyProvCountByNation[et.ownerId] =
      (enemyProvCountByNation[et.ownerId] || 0) + 1;
    totalEnemyGarrison += et.garrison || 0;
  }
  const totalPlayerGarrison = playerTerrIds.reduce(
    (sum, id) => sum + (territories[id]?.garrison || 0),
    0
  );
  // Mop-Up Mode activates when stance is not DEFENSIVE, the enemy has <= 4 provinces left, AND player outnumbers remaining enemy troops >= 1.65x
  const isMopUpPhase =
    stance !== 'DEFENSIVE' &&
    enemyRemainingProvinces.length <= 4 &&
    totalPlayerGarrison >= Math.max(3500, totalEnemyGarrison * 1.65);

  const stanceProfile =
    stance === 'AGGRESSIVE'
      ? {
          capitalReserve: isMopUpPhase ? 1000 : 2000,
          borderReserve: isMopUpPhase ? 600 : 1000,
          maxTotalMoves: 7,
          maxReliefDispatches: 2,
          attackRatioThreshold: isMopUpPhase ? 0.85 : 0.98,
          overkillCap: isMopUpPhase ? 2.6 : 1.85,
          minSendable: 900,
          rearThreshold: isMopUpPhase ? 1500 : 2200,
        }
      : stance === 'DEFENSIVE'
      ? {
          capitalReserve: 4500,
          borderReserve: 2800,
          maxTotalMoves: 5,
          maxReliefDispatches: 4,
          attackRatioThreshold: 1.45,
          overkillCap: 1.35,
          minSendable: 1200,
          rearThreshold: 3800,
        }
      : {
          capitalReserve: isMopUpPhase ? 1200 : 3500,
          borderReserve: isMopUpPhase ? 750 : 2000,
          maxTotalMoves: 6,
          maxReliefDispatches: 2,
          attackRatioThreshold: isMopUpPhase ? 0.92 : 1.15,
          overkillCap: isMopUpPhase ? 2.4 : 1.55,
          minSendable: isMopUpPhase ? 950 : 1200,
          rearThreshold: isMopUpPhase ? 1700 : 2800,
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

  const getReserveForProvince = (terr: Territory): number => {
    const enemyNeighbors = terr.neighbors
      .map((nId) => workingTerritories[nId])
      .filter(
        (nb): nb is Territory =>
          Boolean(nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId))
      );
    const bordersWarEnemy = enemyNeighbors.length > 0;
    if (!bordersWarEnemy) return 500;

    const baseReserve = terr.isCapital
      ? stanceProfile.capitalReserve
      : stanceProfile.borderReserve;

    if (stance === 'DEFENSIVE' || !isMopUpPhase) {
      return baseReserve;
    }

    // In Mop-Up mode, if all adjacent enemies are weak or outnumbered, scale down the border reserve!
    const maxAdjEnemyGarrison = enemyNeighbors.reduce(
      (maxG, nb) => Math.max(maxG, nb.garrison || 0),
      0
    );
    return Math.min(
      baseReserve,
      Math.max(600, Math.round(maxAdjEnemyGarrison * 0.42))
    );
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
    if (!src || troops < 900 || hops.length === 0) return;

    const sendTroops = Math.min(troops, Math.max(0, src.garrison - 500));
    if (sendTroops < 900) return;

    const ratio = sendTroops / Math.max(1, src.garrison);
    const sentUnits = scaleUnitComposition(src.units, src.garrison, ratio);
    const remUnits = subtractUnitComposition(src.units, src.garrison, sentUnits);

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
        Boolean(firstHopTerr && firstHopTerr.ownerId !== playerNationId && enemyIds.has(firstHopTerr.ownerId)),
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
      const needed = Math.max(2500, Math.round(t.siege.attackerTroops * 1.25) - t.garrison - incoming);
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
        Math.round(activeBattle.attackerTroops * 1.25) - activeBattle.defenderTroops - incoming
      );
      if (needed >= 800) {
        urgentTasks.push({
          targetId: tId,
          urgency: (t.isCapital ? 4800 : 2200) + needed * 0.2,
          neededTroops: needed,
        });
      }
      continue;
    }

    // Capital or high-value frontier facing much stronger adjacent war enemy
    // (Skip defensive shuffling if our provinces surrounding that enemy already outnumber it for a Priority 3B pincer assault!)
    let maxEnemyNeighbor = 0;
    for (const nId of t.neighbors) {
      const nb = workingTerritories[nId];
      if (nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId)) {
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
      if (deficit >= 1000) {
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
    )
      break;
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

      const sendAmount = Math.max(
        1000,
        Math.min(d.surplus, Math.max(task.neededTroops, Math.round(d.surplus * 0.75)))
      );
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

    const reserve = getReserveForProvince(src);
    const sendable = Math.floor(src.garrison - reserve);
    if (sendable < stanceProfile.minSendable) continue;

    for (const nbId of src.neighbors) {
      const enemyTerr = workingTerritories[nbId];
      if (!enemyTerr || enemyTerr.ownerId === playerNationId) continue;
      if (!enemyIds.has(enemyTerr.ownerId)) continue;
      if (!isAtWar(wars, playerNationId, enemyTerr.ownerId)) continue;

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
        Math.max(800, enemyTerr.garrison) * computeTerrainDefenseMultiplier(enemyTerr);
      const effectiveOffense = (sendable + alreadyIncoming * 0.85) * playerTierMod;

      // Require realistic advantage per stance
      if (effectiveOffense < effectiveDefense * stanceProfile.attackRatioThreshold) continue;

      // Skip target if already besieged cleanly by player with no enemy garrison remaining
      if (
        enemyTerr.siege &&
        enemyTerr.siege.attackerId === playerNationId &&
        enemyTerr.garrison <= 350 &&
        enemyTerr.siege.attackerTroops >= 1500
      ) {
        continue;
      }

      // Skip target if we already have sufficient effectiveDefense marching on it
      if (alreadyIncoming >= effectiveDefense * stanceProfile.overkillCap) continue;

      const isLostCore = enemyTerr.coreOwnerId === playerNationId;
      const isLastPocket = (enemyProvCountByNation[enemyTerr.ownerId] || 99) <= 3;
      const strategicScore =
        (isLastPocket ? 5500 : 0) +
        (isLostCore ? 4500 : 0) +
        (enemyTerr.isCapital ? 4000 : 0) +
        (straitSet.has(enemyTerr.id) ? 2200 : 0) +
        (enemyTerr.baseGdp || 30) * 12 +
        (effectiveOffense - effectiveDefense) * 0.25 -
        enemyTerr.garrison * 0.2;

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
    const effDef = Math.max(800, dst.garrison) * computeTerrainDefenseMultiplier(dst);
    if (
      (incomingPlayerTroopsByTarget[cand.toId] || 0) >=
      Math.max(2500, effDef * stanceProfile.overkillCap)
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
  // When an enemy province (especially the last 1-3 enemy holdouts/capitals) is too strong for any single
  // neighboring province alone, pool all adjacent player provinces together and launch a joint assault!
  // =========================================================================
  if (newMovements.length < stanceProfile.maxTotalMoves) {
    const borderEnemyTargets = enemyRemainingProvinces
      .filter((et) =>
        et.neighbors.some((nId) => workingTerritories[nId]?.ownerId === playerNationId)
      )
      .sort((a, b) => {
        const aLeft = enemyProvCountByNation[a.ownerId] || 99;
        const bLeft = enemyProvCountByNation[b.ownerId] || 99;
        return aLeft - bLeft || Number(b.isCapital) - Number(a.isCapital) || a.garrison - b.garrison;
      });

    for (const enemyTarget of borderEnemyTargets) {
      if (newMovements.length >= stanceProfile.maxTotalMoves) break;
      const alreadyIncoming = incomingPlayerTroopsByTarget[enemyTarget.id] || 0;
      const effectiveDefense =
        Math.max(800, enemyTarget.garrison) * computeTerrainDefenseMultiplier(enemyTarget);
      if (alreadyIncoming >= effectiveDefense * stanceProfile.overkillCap) continue;

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
          const sendable = Math.floor(t.garrison - 600);
          return sendable >= 900;
        })
        .map((t) => ({
          terr: t,
          sendable: Math.floor(t.garrison - (isMopUpPhase ? 600 : Math.min(1200, getReserveForProvince(t)))),
        }))
        .filter((d) => d.sendable >= 900)
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
            Math.max(3000, effectiveDefense * stanceProfile.overkillCap)
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
  // PRIORITY 4: March Idle Interior Reserves & Fresh Recruits to the Active Frontline
  // (Or directly onto remaining enemy provinces via multi-hop A* if in Mop-Up Phase!)
  // =========================================================================
  if (newMovements.length < stanceProfile.maxTotalMoves) {
    const activeFrontTargets = playerTerrIds
      .map((id) => workingTerritories[id])
      .filter((t): t is Territory => {
        if (!t) return false;
        return t.neighbors.some((nId) => {
          const nb = workingTerritories[nId];
          return Boolean(nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId));
        });
      })
      .sort((a, b) => a.garrison - b.garrison);

    const idleInteriorReserves = playerTerrIds
      .map((id) => workingTerritories[id])
      .filter((t): t is Territory => {
        if (!t || busyOriginIds.has(t.id) || t.siege || battleMap.has(t.id)) {
          return false;
        }
        const touchesEnemy = t.neighbors.some((nId) => {
          const nb = workingTerritories[nId];
          return Boolean(nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId));
        });
        return !touchesEnemy && t.garrison >= stanceProfile.rearThreshold;
      })
      .sort((a, b) => b.garrison - a.garrison);

    for (const rear of idleInteriorReserves.slice(0, stance === 'AGGRESSIVE' ? 4 : 3)) {
      if (newMovements.length >= stanceProfile.maxTotalMoves) break;

      // First try: during Mop-Up or when rear army is strong, route directly to the nearest remaining enemy province via A*!
      let dispatchedDirect = false;
      if (isMopUpPhase || rear.garrison >= 4500) {
        const sortedEnemyTargets = [...enemyRemainingProvinces].sort(
          (a, b) =>
            sphericalDegDist(rear.centroid, a.centroid) -
            sphericalDegDist(rear.centroid, b.centroid)
        );
        for (const enemyTarget of sortedEnemyTargets.slice(0, 3)) {
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
            const moveTroops = Math.floor(rear.garrison - 500);
            if (moveTroops >= 1000) {
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
      }
      if (dispatchedDirect) continue;

      // Second try: route to the nearest frontline player province bordering the enemy
      if (activeFrontTargets.length > 0) {
        const bestFront = [...activeFrontTargets].sort((a, b) => {
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

        const moveTroops = Math.floor(rear.garrison - 500);
        if (moveTroops < 1000) continue;

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
  // When remaining enemy provinces are across the sea or on islands (unreachable by land or isolated),
  // disembark anchored player SeaArmies or launch amphibious naval invasions from coastal cities!
  // =========================================================================
  if (newMovements.length < stanceProfile.maxTotalMoves) {
    const enemyCoastalTargets = enemyRemainingProvinces
      .filter((t) => isTerritoryCoastal(t) && Boolean(t.centroid))
      .sort((a, b) => a.garrison - b.garrison);

    if (enemyCoastalTargets.length > 0) {
      // 5A. Disembark any idle anchored player SeaArmy onto the best reachable enemy coastal target
      for (let sIdx = workingSeaArmies.length - 1; sIdx >= 0; sIdx--) {
        if (newMovements.length >= stanceProfile.maxTotalMoves) break;
        const fleet = workingSeaArmies[sIdx];
        if (!fleet || fleet.ownerId !== playerNationId || fleet.troops < 1200) continue;

        const targetCoast = enemyCoastalTargets.find((et) => {
          const dist = Math.hypot(
            fleet.coords[0] - et.centroid[0],
            fleet.coords[1] - et.centroid[1]
          );
          const alreadyInc = incomingPlayerTroopsByTarget[et.id] || 0;
          return dist <= 32 && fleet.troops + alreadyInc >= Math.max(1500, et.garrison * 0.9);
        });

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

      // 5B. Launch Amphibious Coastal Invasion from strong player coastal cities
      const playerCoastalDonors = playerTerrIds
        .map((id) => workingTerritories[id])
        .filter(
          (t): t is Territory =>
            Boolean(
              t &&
                !busyOriginIds.has(t.id) &&
                !t.siege &&
                !battleMap.has(t.id) &&
                isTerritoryCoastal(t) &&
                t.garrison >= (isMopUpPhase ? 2400 : 4500)
            )
        )
        .sort((a, b) => b.garrison - a.garrison);

      for (const coastSrc of playerCoastalDonors.slice(0, 2)) {
        if (newMovements.length >= stanceProfile.maxTotalMoves) break;
        const sendable = Math.floor(coastSrc.garrison - (isMopUpPhase ? 700 : 1500));
        if (sendable < 1500) continue;

        const targetCoast = enemyCoastalTargets.find((et) => {
          const alreadyInc = incomingPlayerTroopsByTarget[et.id] || 0;
          if (alreadyInc >= Math.max(2500, et.garrison * stanceProfile.overkillCap)) {
            return false;
          }
          const dist = Math.hypot(
            coastSrc.centroid[0] - et.centroid[0],
            coastSrc.centroid[1] - et.centroid[1]
          );
          return dist <= 32 && sendable + alreadyInc >= Math.max(1500, et.garrison * 0.9);
        });

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

