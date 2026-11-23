import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  Territory,
  UnitComposition,
} from '../types/game';
import { getNationModernizedTier } from '../data/world2026Data';
import { isAtWar } from './simulationEngine';
import { findArmyRouteAStar, sphericalDegDist } from './pathfindingEngine';
import { checkStraitMilitaryBlockade, STRATEGIC_STRAITS } from './straitsAndTradeEngine';

export interface PlayerAiCommanderInput {
  tick: number;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
}

export interface PlayerAiCommanderOutput {
  updatedTerritories: Record<string, Territory>;
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
 * Smart 4-Tier Player AI War Commander ("Yapay Zekâya Devret"):
 * - Strict Guardrails: NEVER declares wars, NEVER signs peace, NEVER disbands troops,
 *   and NEVER overrides provinces that already have an active outgoing player movement.
 * - Priority 1: Relieve owned besieged provinces, struggling active battles & threatened capitals.
 * - Priority 2: Reinforce outnumbered war borders & reclaim lost core territories.
 * - Priority 3: Launch calculated >= 1.15x strength-ratio offensives on winnable enemy provinces.
 * - Priority 4: Advance idle rear/newly-recruited interior reserves toward the active frontline.
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
    battles,
    movements,
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

  const playerTerrIds = Object.values(territories)
    .filter((t) => t && t.ownerId === playerNationId)
    .map((t) => t.id);

  if (playerTerrIds.length === 0) return null;

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
  const newMovements: ArmyMovement[] = [];
  const summaryLabels: string[] = [];

  const getReserveForProvince = (terr: Territory): number => {
    const bordersWarEnemy = terr.neighbors.some((nId) => {
      const nb = workingTerritories[nId];
      return Boolean(nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId));
    });
    if (terr.isCapital && bordersWarEnemy) return 3500;
    if (bordersWarEnemy) return 2000;
    return 500;
  };

  const canProvideReinforcement = (terr: Territory): boolean => {
    if (terr.ownerId !== playerNationId) return false;
    if (busyOriginIds.has(terr.id)) return false;
    if (terr.siege || battleMap.has(terr.id)) return false;
    const reserve = getReserveForProvince(terr);
    return terr.garrison - reserve >= 1200;
  };

  const dispatchMovement = (params: {
    fromId: string;
    toId: string;
    troops: number;
    hops: string[];
    isAttack: boolean;
  }) => {
    const { fromId, toId, troops, hops, isAttack } = params;
    const src = workingTerritories[fromId];
    if (!src || troops < 1000 || hops.length === 0) return;

    const sendTroops = Math.min(troops, Math.max(0, src.garrison - 500));
    if (sendTroops < 1000) return;

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
    let maxEnemyNeighbor = 0;
    for (const nId of t.neighbors) {
      const nb = workingTerritories[nId];
      if (nb && nb.ownerId !== playerNationId && enemyIds.has(nb.ownerId)) {
        maxEnemyNeighbor = Math.max(maxEnemyNeighbor, nb.garrison);
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
    if (reliefDispatches >= 2 || newMovements.length >= 4) break;
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
  // PRIORITY 2 & 3: Reclaim Lost Cores & Calculated Winnable Offensives (>=1.15x)
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
    if (sendable < 1200) continue;

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
      const effectiveOffense = (sendable + alreadyIncoming * 0.5) * playerTierMod;

      // Require realistic 1.15x advantage (or if already incoming + our push decisively breaks it)
      if (effectiveOffense < effectiveDefense * 1.15) continue;

      // Skip target if we already have >= 1.5x effectiveDefense marching on it
      if (alreadyIncoming >= effectiveDefense * 1.4) continue;

      const isLostCore = enemyTerr.coreOwnerId === playerNationId;
      const strategicScore =
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
    if (newMovements.length >= 4) break;
    if (busyOriginIds.has(cand.fromId)) continue;
    const dst = workingTerritories[cand.toId];
    if (!dst) continue;
    // Avoid piling two separate attacks into the exact same enemy province in one tick if it's already covered
    if ((incomingPlayerTroopsByTarget[cand.toId] || 0) >= Math.max(2500, dst.garrison * 1.4)) {
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
  // PRIORITY 4: March Idle Interior Reserves & Fresh Recruits to the Active Frontline
  // =========================================================================
  if (newMovements.length < 4) {
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

    if (activeFrontTargets.length > 0) {
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
          return !touchesEnemy && t.garrison >= 4000;
        })
        .sort((a, b) => b.garrison - a.garrison);

      for (const rear of idleInteriorReserves.slice(0, 2)) {
        if (newMovements.length >= 4) break;
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
        if (moveTroops < 1500) continue;

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

  if (newMovements.length === 0) {
    return null;
  }

  return {
    updatedTerritories: workingTerritories,
    newMovements,
    actionCount: newMovements.length,
    summaryToast: `🤖 YZ Komutanı ${newMovements.length} birlik sevk etti (${summaryLabels.slice(0, 2).join(', ')})`,
  };
}
