import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  SeaArmy,
  Territory,
} from '../../types/game';
import { AiAggressivenessLevel } from '../gameSettings';
import { findArmyRouteAStar, sphericalDegDist } from '../pathfindingEngine';
import { resolveNationAiPersonality } from '../seasonSupplyAndAiProfile';
import { isTerritoryCoastal } from '../worldBuilder';
import {
  STRATEGIC_STRAIT_SHORE_SET,
  WartimeAiBatchResult,
  scaleUnitComp,
} from './aiSharedUtils';

/**
 * Evaluates active wartime operations for AI nations currently in a war.
 * Runs daily (and on war declaration / mid-day) so enemy countries actively mobilize reserves,
 * reinforce frontline provinces, launch counter-attacks, and execute naval interceptions / landings.
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

  // Build O(1) enemy lookup sets and distinguish primary war leaders from secondary co-belligerent allies
  const warAiSet = new Set<string>();
  const enemyIdsByNation = new Map<string, Set<string>>();
  const primaryEnemyIdsByNation = new Map<string, Set<string>>();
  const addEnemyEdge = (a: string, b: string, isPrimary = false) => {
    if (!a || !b || a === b) return;
    let set = enemyIdsByNation.get(a);
    if (!set) {
      set = new Set<string>();
      enemyIdsByNation.set(a, set);
    }
    set.add(b);
    if (isPrimary) {
      let pSet = primaryEnemyIdsByNation.get(a);
      if (!pSet) {
        pSet = new Set<string>();
        primaryEnemyIdsByNation.set(a, pSet);
      }
      pSet.add(b);
    }
  };

  for (const w of wars) {
    const attSide = w.attackers.length > 0 ? w.attackers : [w.attackerId];
    const defSide = w.defenders.length > 0 ? w.defenders : [w.defenderId];
    for (const a of attSide) {
      if (a && a !== playerNationId && nations[a] && !nations[a].isEliminated) {
        warAiSet.add(a);
      }
      if (w.defenderId) {
        addEnemyEdge(a, w.defenderId, true);
      }
      for (const d of defSide) {
        addEnemyEdge(a, d, d === w.defenderId && a === w.attackerId);
        addEnemyEdge(d, a, a === w.attackerId && d === w.defenderId);
      }
    }
    for (const d of defSide) {
      if (d && d !== playerNationId && nations[d] && !nations[d].isEliminated) {
        warAiSet.add(d);
      }
      if (w.attackerId) {
        addEnemyEdge(d, w.attackerId, true);
      }
    }
    if (w.attackerId && w.defenderId) {
      addEnemyEdge(w.attackerId, w.defenderId, true);
      addEnemyEdge(w.defenderId, w.attackerId, true);
      if (
        w.attackerId !== playerNationId &&
        nations[w.attackerId] &&
        !nations[w.attackerId].isEliminated
      ) {
        warAiSet.add(w.attackerId);
      }
      if (
        w.defenderId !== playerNationId &&
        nations[w.defenderId] &&
        !nations[w.defenderId].isEliminated
      ) {
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
    return (
      ((nextTick + a.charCodeAt(0)) % 7) - ((nextTick + b.charCodeAt(0)) % 7)
    );
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
  const incomingAttackByTerr = new Map<
    string,
    { total: number; byOwner: Map<string, number> }
  >();

  for (const m of movements) {
    activeMoveCountByOwner.set(
      m.ownerId,
      (activeMoveCountByOwner.get(m.ownerId) || 0) + 1
    );
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
    activeMoveCountByOwner.set(
      mv.ownerId,
      (activeMoveCountByOwner.get(mv.ownerId) || 0) + 1
    );
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
        return Boolean(
          nb && nb.ownerId !== actorId && actorEnemies.has(nb.ownerId)
        );
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
        unbesiegedThreatened[0] &&
        getProvinceThreatScore(unbesiegedThreatened[0]) > 3000
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
        const reserveFloor = liveTarget.isCapital ? 0 : 1800;
        const availableMp = Math.max(0, actorNation.manpower - reserveFloor);
        const levyTroops = Math.min(
          availableMp,
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
    const actorPrimaryEnemies =
      primaryEnemyIdsByNation.get(actorId) || actorEnemies;
    const actorHomelandCenter =
      nextTerritories[actorNation.capitalTerritoryId]?.centroid ||
      refreshedOwned[0]?.centroid;

    const allEnemyWarProvs: Territory[] = [];
    const primaryEnemyWarProvs: Territory[] = [];
    for (const enemyId of actorEnemies) {
      const eList = provsByOwner.get(enemyId);
      if (!eList) continue;
      for (const ep of eList) {
        const liveEp = nextTerritories[ep.id];
        if (!liveEp) continue;
        allEnemyWarProvs.push(liveEp);
        if (actorPrimaryEnemies.has(enemyId)) {
          primaryEnemyWarProvs.push(liveEp);
        }
      }
    }
    const strategicEnemyWarProvs =
      primaryEnemyWarProvs.length > 0 ? primaryEnemyWarProvs : allEnemyWarProvs;

    const scoreEnemyTarget = (
      enemyTerr: Territory,
      refCoords?: [number, number]
    ): number => {
      const isPrimary = actorPrimaryEnemies.has(enemyTerr.ownerId);
      // Dampen raw garrison weight so distant 0-garrison provinces never outweigh close primary targets!
      let priority = -Math.min(12000, enemyTerr.garrison) * 0.45;
      priority += isPrimary ? 9000 : -5500;
      if (enemyTerr.coreOwnerId === actorId) priority += 6500; // Reclaim occupied homeland first
      if (
        enemyTerr.isCapital ||
        enemyTerr.id === nextNations[enemyTerr.ownerId]?.capitalTerritoryId
      ) {
        priority += isPrimary ? 5200 : 1200;
      }
      if (straitShoreSet.has(enemyTerr.id)) priority += 2400;
      if (enemyTerr.ownerId === playerNationId && isPrimary) priority += 2200;
      if (enemyTerr.terrain === 'DAGLIK') priority -= 2200;
      priority -= (enemyTerr.buildings?.fortress || 0) * 1600;
      const origin = refCoords || actorHomelandCenter;
      if (origin && enemyTerr.centroid) {
        priority -= sphericalDegDist(origin, enemyTerr.centroid) * 520;
      }
      return priority;
    };

    const actorTotalGarrison = refreshedOwned.reduce(
      (sum, p) => sum + (p?.garrison || 0),
      0
    );
    const enemyTotalGarrison = strategicEnemyWarProvs.reduce(
      (sum, p) => sum + (p?.garrison || 0),
      0
    );
    const isEnemyMopUp =
      strategicEnemyWarProvs.length > 0 &&
      strategicEnemyWarProvs.length <= 3 &&
      refreshedOwned.length > strategicEnemyWarProvs.length &&
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
        .filter((nTerr): nTerr is Territory => {
          if (
            !nTerr ||
            nTerr.ownerId === actorId ||
            !actorEnemies.has(nTerr.ownerId)
          ) {
            return false;
          }
          // Do NOT waste armies capturing empty (0-garrison) provinces of a secondary war ally while primary enemies still stand
          if (
            !actorPrimaryEnemies.has(nTerr.ownerId) &&
            nTerr.coreOwnerId !== actorId &&
            primaryEnemyWarProvs.length > 0 &&
            nTerr.garrison <= 0
          ) {
            return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            scoreEnemyTarget(b, srcProv.centroid) -
            scoreEnemyTarget(a, srcProv.centroid)
        );

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
        const alreadyTargetedByUs = targetedKeys.has(
          `${actorId}|${enemyTerr.id}`
        );
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
          (enemyTerr.terrain === 'DAGLIK'
            ? 0.18
            : enemyTerr.terrain === 'METROPOL'
            ? 0.1
            : 0) +
          (enemyTerr.buildings?.fortress || 0) * 0.08;
        const requiredTroops = Math.max(
          isEnemyMopUp ? 800 : 2600,
          enemyTerr.garrison *
            (isEnemyMopUp ? baseMinRatio * 0.85 : baseMinRatio) *
            terrainFortFactor
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
    if (!launchedSortie && isEnemyMopUp && strategicEnemyWarProvs.length > 0) {
      const sortedHoldouts = [...strategicEnemyWarProvs].sort(
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
            return Boolean(
              nb && nb.ownerId !== actorId && actorEnemies.has(nb.ownerId)
            );
          })
      )
      .sort((a, b) => b.garrison - a.garrison);

    if (rearStrongProvs.length > 0) {
      const srcRear = rearStrongProvs[0];
      const primaryFrontlineProvs = frontlineProvs.filter((p) =>
        p.neighbors.some((nbId) => {
          const nb = nextTerritories[nbId];
          return Boolean(nb && actorPrimaryEnemies.has(nb.ownerId));
        })
      );
      const preferredFrontline =
        primaryFrontlineProvs.length > 0 ? primaryFrontlineProvs : frontlineProvs;
      const enemyTerritories = [...strategicEnemyWarProvs].sort(
        (a, b) =>
          scoreEnemyTarget(b, srcRear.centroid) -
          scoreEnemyTarget(a, srcRear.centroid)
      );
      const targetDest =
        threatenedProvs[0] ||
        (isEnemyMopUp && enemyTerritories[0] ? enemyTerritories[0] : null) ||
        [...preferredFrontline].sort((a, b) => a.garrison - b.garrison)[0] ||
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
          allowTargetWarDeclaration: false,
        });

        if (route.reachable && route.hops.length > 0) {
          const firstHopId = route.hops[0];
          const firstHopTerr = nextTerritories[firstHopId];
          const moveRatio = isEnemyMopUp ? 0.74 : 0.65;
          const moveTroops = Math.round(srcRear.garrison * moveRatio);

          writeTerritory(srcRear.id, {
            ...srcRear,
            garrison: Math.max(
              isEnemyMopUp ? 700 : 1200,
              srcRear.garrison - moveTroops
            ),
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

    // 4B. Amphibious Assault: cross open water to invade a vulnerable PRIMARY enemy coastal province
    // Never sail across the world to attack distant undefended provinces of a secondary war ally!
    const hasPrimaryLandFront = frontlineProvs.some((p) =>
      p.neighbors.some((nbId) => {
        const nb = nextTerritories[nbId];
        return Boolean(nb && actorPrimaryEnemies.has(nb.ownerId));
      })
    );
    const maxAmphibRange = hasPrimaryLandFront ? 7.5 : 26;
    const coastalEnemyPool =
      primaryEnemyWarProvs.length > 0 ? actorPrimaryEnemies : actorEnemies;
    const enemyCoastalTargets: Territory[] = [];
    for (const enemyId of coastalEnemyPool) {
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
        if (
          dist <= maxAmphibRange &&
          navalTroops >= Math.max(3000, t.garrison * 1.05)
        ) {
          enemyCoastalTargets.push(t);
        }
      }
    }
    enemyCoastalTargets.sort(
      (a, b) =>
        scoreEnemyTarget(b, srcCoast.centroid) -
        scoreEnemyTarget(a, srcCoast.centroid)
    );

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
