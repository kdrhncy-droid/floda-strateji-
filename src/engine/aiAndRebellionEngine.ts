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
  Nation,
  Territory,
  UnitComposition,
  WorldNewsEvent,
} from '../types/game';
import { AiAggressivenessLevel } from './gameSettings';
import { findArmyRouteAStar } from './pathfindingEngine';
import { STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import {
  getOrCreateRelation,
  isAtWar,
  resolveWarParticipants,
} from './simulationEngine';
import { relationKey } from './worldBuilder';
import { adjustOccupiedUnrestDrift } from './technologyEffects';

function scaleUnitComp(units: UnitComposition, ratio: number): UnitComposition {
  return {
    infantry: Math.max(0, Math.round(units.infantry * ratio)),
    armor: Math.max(0, Math.round(units.armor * ratio)),
    airDrone: Math.max(0, Math.round(units.airDrone * ratio)),
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
  aiAggressiveness: AiAggressivenessLevel;
  maxActionsPerPass?: number;
}): WartimeAiBatchResult | null {
  const {
    nextTick,
    playerNationId,
    nations,
    territories,
    relations,
    wars,
    movements,
    aiAggressiveness,
    maxActionsPerPass = 3,
  } = params;

  if (wars.length === 0) return null;

  // Collect all non-eliminated AI nations currently involved in at least one active war
  const warAiSet = new Set<string>();
  for (const w of wars) {
    for (const id of [...w.attackers, ...w.defenders, w.attackerId, w.defenderId]) {
      if (id && id !== playerNationId && nations[id] && !nations[id].isEliminated) {
        warAiSet.add(id);
      }
    }
  }
  if (warAiSet.size === 0) return null;

  // Prioritize AI nations that are at war with the player so player wars feel immediately responsive
  const warAiIds = Array.from(warAiSet).sort((a, b) => {
    const aVsPlayer = isAtWar(wars, a, playerNationId) ? 0 : 1;
    const bVsPlayer = isAtWar(wars, b, playerNationId) ? 0 : 1;
    if (aVsPlayer !== bVsPlayer) return aVsPlayer - bVsPlayer;
    return ((nextTick + a.charCodeAt(0)) % 7) - ((nextTick + b.charCodeAt(0)) % 7);
  });

  let nextNations: Record<string, Nation> = { ...nations };
  let nextTerritories: Record<string, Territory> = { ...territories };
  const newMovements: ArmyMovement[] = [];
  const newsItems: WartimeAiBatchResult['newsItems'] = [];
  const playerAlerts: string[] = [];
  let actionsCount = 0;

  for (const actorId of warAiIds) {
    if (actionsCount >= maxActionsPerPass) break;

    let actorNation = nextNations[actorId];
    if (!actorNation || actorNation.isEliminated) continue;

    // Avoid spamming if this AI already has 2+ armies marching simultaneously
    const existingAiMoves =
      movements.filter((m) => m.ownerId === actorId).length +
      newMovements.filter((m) => m.ownerId === actorId).length;
    if (existingAiMoves >= 2) continue;

    const ownedProvs = Object.values(nextTerritories).filter(
      (t) => t && t.ownerId === actorId
    );
    if (ownedProvs.length === 0) continue;

    // Identify frontline provinces (directly bordering a war enemy) and threatened homeland/sieged provinces
    const frontlineProvs = ownedProvs.filter((p) =>
      p.neighbors.some((nbId) => {
        const nb = nextTerritories[nbId];
        return Boolean(nb && nb.ownerId !== actorId && isAtWar(wars, actorId, nb.ownerId));
      })
    );

    const straitShoreSet = new Set(STRATEGIC_STRAITS.flatMap((s) => s.shoreIds));

    // Identify highest-threat friendly province (under siege, capital bordering stronger enemy, or outnumbered border)
    const getProvinceThreatScore = (p: Territory): number => {
      let adjacentEnemyTroops = 0;
      for (const nbId of p.neighbors) {
        const nb = nextTerritories[nbId];
        if (nb && nb.ownerId !== actorId && isAtWar(wars, actorId, nb.ownerId)) {
          adjacentEnemyTroops += nb.garrison || 0;
        }
      }
      const incomingEnemyTroops = movements
        .filter((m) => m.toTerritoryId === p.id && m.isAttack && m.ownerId !== actorId)
        .reduce((s, m) => s + m.troops, 0);
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

    // Step 1: Smart Emergency Wartime Mobilization on most threatened frontline/capital or strongest staging point
    if (
      frontlineProvs.length > 0 &&
      actorNation.treasury >= 200 &&
      actorNation.manpower >= 2200
    ) {
      const mostThreatened = threatenedProvs[0];
      const bolsterTarget =
        mostThreatened && getProvinceThreatScore(mostThreatened) > 3500
          ? mostThreatened
          : [...frontlineProvs].sort((a, b) => b.garrison - a.garrison)[0];

      if (bolsterTarget && bolsterTarget.garrison < 34000) {
        const levyTroops = Math.min(
          actorNation.manpower,
          aiAggressiveness === 'CHAOS' || aiAggressiveness === 'AGGRESSIVE'
            ? 7500
            : 5500
        );
        if (levyTroops >= 1500) {
          actorNation = {
            ...actorNation,
            treasury: Math.max(0, actorNation.treasury - 190),
            manpower: Math.max(0, actorNation.manpower - levyTroops),
          };
          nextNations[actorId] = actorNation;
          const updatedTarget: Territory = {
            ...bolsterTarget,
            garrison: bolsterTarget.garrison + levyTroops,
            units: {
              infantry:
                (bolsterTarget.units?.infantry || bolsterTarget.garrison) +
                Math.round(levyTroops * 0.64),
              armor:
                (bolsterTarget.units?.armor || 0) +
                Math.round(levyTroops * 0.24),
              airDrone:
                (bolsterTarget.units?.airDrone || 0) +
                Math.round(levyTroops * 0.12),
            },
          };
          nextTerritories[bolsterTarget.id] = updatedTarget;
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
            !movements.some(
              (m) => m.ownerId === actorId && m.fromTerritoryId === p.id
            ) &&
            !newMovements.some(
              (m) => m.ownerId === actorId && m.fromTerritoryId === p.id
            )
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
          nextTerritories[reliefDonor.id] = {
            ...reliefDonor,
            garrison: Math.max(1500, reliefDonor.garrison - reliefTroops),
            units: scaleUnitComp(reliefDonor.units, 1 - reliefRatio),
          };
          newMovements.push({
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

    let launchedSortie = false;
    const sortieCandidates = refreshedOwned
      .filter((p) => p && p.garrison >= 6500 && !p.siege)
      .sort((a, b) => b.garrison - a.garrison);

    for (const srcProv of sortieCandidates) {
      const alreadyMarchingFromHere =
        movements.some(
          (m) => m.ownerId === actorId && m.fromTerritoryId === srcProv.id
        ) ||
        newMovements.some(
          (m) => m.ownerId === actorId && m.fromTerritoryId === srcProv.id
        );
      if (alreadyMarchingFromHere) continue;

      const enemyNeighbors = srcProv.neighbors
        .map((nId) => nextTerritories[nId])
        .filter(
          (nTerr): nTerr is Territory =>
            Boolean(nTerr) &&
            nTerr.ownerId !== actorId &&
            Boolean(isAtWar(wars, actorId, nTerr.ownerId))
        )
        .sort((a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a));

      if (enemyNeighbors.length === 0) continue;

      // Never strip our capital bare if multiple strong enemies border it
      const isSrcCapital =
        srcProv.isCapital || srcProv.id === actorNation.capitalTerritoryId;
      const sendRatio = isSrcCapital
        ? 0.52
        : srcProv.garrison >= 18000
        ? 0.64
        : 0.56;
      const dispatchable = Math.round(srcProv.garrison * sendRatio);
      if (dispatchable < 3500) continue;

      const viableTarget = enemyNeighbors.find((enemyTerr) => {
        const alreadyTargetedByUs =
          movements.some(
            (m) => m.ownerId === actorId && m.toTerritoryId === enemyTerr.id
          ) ||
          newMovements.some(
            (m) => m.ownerId === actorId && m.toTerritoryId === enemyTerr.id
          );
        if (alreadyTargetedByUs) return false;

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
          2600,
          enemyTerr.garrison * baseMinRatio * terrainFortFactor
        );

        return (
          dispatchable >= requiredTroops ||
          (dispatchable >= 18000 && dispatchable >= enemyTerr.garrison * 0.95)
        );
      });

      if (viableTarget) {
        const sendUnits = scaleUnitComp(srcProv.units, sendRatio);
        const remainingGarrison = Math.max(
          srcProv.garrison >= 5000 ? 2500 : 1200,
          srcProv.garrison - dispatchable
        );
        nextTerritories[srcProv.id] = {
          ...srcProv,
          garrison: remainingGarrison,
          units: scaleUnitComp(
            srcProv.units,
            remainingGarrison / Math.max(1, srcProv.garrison)
          ),
        };

        newMovements.push({
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

    if (launchedSortie) continue;

    // Step 3: Multi-Hop Frontline Concentration (send rear reserves to threatened borders OR staging frontline so AI concentrates force before attacking)
    const rearStrongProvs = refreshedOwned
      .filter(
        (p) =>
          p.garrison >= 7500 &&
          !p.neighbors.some((nbId) => {
            const nb = nextTerritories[nbId];
            return Boolean(nb && nb.ownerId !== actorId && isAtWar(wars, actorId, nb.ownerId));
          })
      )
      .sort((a, b) => b.garrison - a.garrison);

    if (rearStrongProvs.length > 0) {
      const srcRear = rearStrongProvs[0];
      const enemyTerritories = Object.values(nextTerritories)
        .filter((t) => t && t.ownerId !== actorId && isAtWar(wars, actorId, t.ownerId))
        .sort((a, b) => scoreEnemyTarget(b) - scoreEnemyTarget(a));
      const targetDest =
        threatenedProvs[0] ||
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
          const moveRatio = 0.65;
          const moveTroops = Math.round(srcRear.garrison * moveRatio);

          nextTerritories[srcRear.id] = {
            ...srcRear,
            garrison: Math.max(1200, srcRear.garrison - moveTroops),
            units: scaleUnitComp(srcRear.units, 1 - moveRatio),
          };

          const isFirstHopAttack = Boolean(
            firstHopTerr &&
              firstHopTerr.ownerId !== actorId &&
              isAtWar(wars, actorId, firstHopTerr.ownerId)
          );

          newMovements.push({
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
        }
      }
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
  aiAggressiveness: AiAggressivenessLevel;
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
    aiAggressiveness,
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

  const stepIndex = Math.max(0, Math.floor(nextTick / 3));
  const actorId = majorAiIds[stepIndex % majorAiIds.length];
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

        // On decisive victory (>= 55 score), transfer 1 occupied border province if loser has > 1 province
        let peaceTerritories: Record<string, Territory> | undefined;
        let annexedProvName: string | null = null;
        if (absScore >= 55) {
          const loserProvs = Object.values(territories).filter(
            (t) => t.ownerId === loser.id
          );
          if (loserProvs.length > 1) {
            const occupiedFrontier =
              loserProvs.find(
                (t) =>
                  !t.isCapital &&
                  t.isOccupied &&
                  t.occupiedById === winner.id
              ) ||
              loserProvs.find(
                (t) =>
                  !t.isCapital &&
                  t.neighbors.some((nId) => territories[nId]?.ownerId === winner.id)
              );
            if (occupiedFrontier) {
              annexedProvName = occupiedFrontier.name;
              peaceTerritories = {
                ...territories,
                [occupiedFrontier.id]: {
                  ...occupiedFrontier,
                  ownerId: winner.id,
                  isOccupied: false,
                  occupiedById: undefined,
                  siege: undefined,
                  unrest: Math.min(60, (occupiedFrontier.unrest || 15) + 22),
                  garrison: Math.max(3500, occupiedFrontier.garrison),
                },
              };
            }
          }
        }

        const nextNats: Record<string, Nation> = {
          ...(updatedNations || nations),
          [winner.id]: {
            ...winner,
            treasury: winner.treasury + indemnity,
            stability: Math.min(100, winner.stability + 4),
            aggressiveExpansion: Math.min(
              100,
              winner.aggressiveExpansion + (annexedProvName ? 6 : 0)
            ),
          },
          [loser.id]: {
            ...loser,
            treasury: Math.max(0, loser.treasury - indemnity),
            aggressiveExpansion: Math.max(0, loser.aggressiveExpansion - 8),
          },
        };

        return {
          updatedNations: nextNats,
          updatedTerritories: peaceTerritories,
          updatedWars: nextWars,
          updatedRelations: nextRelations,
          newsItem: {
            title: `📜 Barış Antlaşması: ${winner.name} Zaferi`,
            description: annexedProvName
              ? `${winner.name} ile ${loser.name} arasındaki savaş sona erdi; ${winner.name} ${annexedProvName} eyaletini ve ${indemnity} Altın tazminat alarak ateşkes imzaladı.`
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

  // 1. Era-Accurate AI Technology Progression & National Army Modernization
  const activeTechTree = getTechTreeForMode(gameMode);
  const availableTechs = activeTechTree.filter(
    (tech) =>
      !actorNation.unlockedTechs.includes(tech.id) &&
      (!tech.prerequisite ||
        actorNation.unlockedTechs.includes(tech.prerequisite)) &&
      actorNation.researchPoints >= tech.cost
  );

  // Prioritize military & economic techs when affordable
  const nextAiTech = availableTechs.sort((a, b) => {
    const prio = (branch: string) =>
      branch === 'MILITARY' ? 0 : branch === 'ECONOMY' ? 1 : 2;
    return prio(a.branch) - prio(b.branch) || a.cost - b.cost;
  })[0];

  if (nextAiTech) {
    actorNation = {
      ...actorNation,
      researchPoints: Math.max(0, actorNation.researchPoints - nextAiTech.cost),
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

    // Balance army buildup vs. peacetime economy: invest in buildings on alternating turns when border is reasonably safe
    const preferEconTurn =
      !actorInAnyWar &&
      actorNation.treasury >= 800 &&
      (!weakestBorder ||
        weakestBorder.garrison >= 9000 ||
        actorNation.manpower < 14000) &&
      (stepIndex % 2 === 0 || !hasThreatenedBorder);

    if (preferEconTurn) {
      // Deficit-Driven Economic, Fortification, Manpower & Scientific Infrastructure Upgrade!
      const straitShoreSet = new Set(
        STRATEGIC_STRAITS.flatMap((s) => s.shoreIds)
      );
      const lowManpower = actorNation.manpower < 18000;
      const behindInTech = actorNation.unlockedTechs.length < 3;

      let chosenBuilding: BuildingType | undefined;
      let econTarget: Territory | undefined;

      if (hasThreatenedBorder && weakestBorder && (weakestBorder.buildings.fortress || 0) < 4) {
        econTarget = weakestBorder;
        chosenBuilding = 'fortress';
      } else if (lowManpower) {
        econTarget =
          ownedProvinces.find((p) => (p.buildings.barracks || 0) < 4) ||
          ownedProvinces[0];
        chosenBuilding = 'barracks';
      } else {
        econTarget =
          ownedProvinces.find(
            (p) =>
              straitShoreSet.has(p.id) &&
              ((p.buildings.tradeHub || 0) < 4 || (p.buildings.fortress || 0) < 3)
          ) ||
          ownedProvinces.find((p) => p.isCapital) ||
          [...ownedProvinces].sort((a, b) => b.baseGdp - a.baseGdp)[0];

        if (econTarget) {
          const isStraitProv = straitShoreSet.has(econTarget.id);
          const candidateBuildings: BuildingType[] = isStraitProv
            ? ['tradeHub', 'fortress', 'factory', 'university', 'barracks']
            : behindInTech
            ? ['university', 'factory', 'tradeHub', 'barracks', 'fortress']
            : ['factory', 'tradeHub', 'university', 'barracks', 'fortress'];
          chosenBuilding = candidateBuildings.find(
            (bKey) => (econTarget!.buildings[bKey] || 0) < 5
          );
        }
      }

      if (econTarget && chosenBuilding) {
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
                chosenBuilding === 'factory' || chosenBuilding === 'tradeHub'
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
      const needsGarrison =
        actorInAnyWar ||
        hasThreatenedBorder ||
        !weakestBorder ||
        weakestBorder.garrison < 24000;

      if (
        needsGarrison &&
        actorNation.treasury >= 850 &&
        actorNation.manpower >= 5500
      ) {
        const targetProv = weakestBorder || ownedProvinces[0];
        if (targetProv) {
          const addTroops = aiAggressiveness === 'CHAOS' ? 9000 : 6000;
          actorNation = {
            ...actorNation,
            treasury: actorNation.treasury - 450,
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
                  Math.round(addTroops * 0.68),
                armor:
                  (targetProv.units?.armor || 0) + Math.round(addTroops * 0.22),
                airDrone:
                  (targetProv.units?.airDrone || 0) + Math.round(addTroops * 0.1),
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

  // 4. Multi-Province A* Reserve Redeployment from safe interior provinces to frontline borders
  if (ownedProvinces.length > 1) {
    const interiorRichProv = ownedProvinces.find(
      (p) =>
        (activeTerrs[p.id]?.garrison || 0) >= 20000 &&
        p.neighbors.every((nId) => activeTerrs[nId]?.ownerId === actorId)
    );
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
      .sort((a, b) => a.garrison - b.garrison);

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
            id: `ai_redeploy_${nextTick}_${srcCurr.id}`,
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
        };
      }
    }
  }

  // 4B. Proactive AI-to-AI Diplomacy (Trade Agreements, Defensive Pacts vs. Stronger/High-AE Rivals, Non-Aggression)
  let updatedRelations: Record<string, DiplomaticRelation> | undefined;
  let diploNewsItem: AiTurnResult['newsItem'] | undefined;

  if (!actorInAnyWar) {
    const neighborIds = new Set<string>();
    for (const p of ownedProvinces) {
      for (const nId of p.neighbors) {
        const nbOwner = activeTerrs[nId]?.ownerId;
        if (nbOwner && nbOwner !== actorId) {
          neighborIds.add(nbOwner);
        }
      }
    }

    const actorTotalTroops = computeRealmTotalTroops(actorId, activeTerrs, movements);
    const hasStrongerOrHighAeNeighbor = Array.from(neighborIds).some((nId) => {
      const nbNat = nations[nId];
      if (!nbNat || nbNat.isEliminated) return false;
      const nbTroops = computeRealmTotalTroops(nId, activeTerrs, movements);
      const nbRel = getOrCreateRelation(relations, actorId, nId);
      return (
        !nbRel.isAllied &&
        (nbNat.aggressiveExpansion >= 30 || nbTroops >= actorTotalTroops * 1.25)
      );
    });

    const countExistingAlliances = (nId: string) =>
      Object.values(relations).filter(
        (r) => (r.nationA === nId || r.nationB === nId) && (r.isAllied || Boolean(r.allianceType))
      ).length;

    const actorAllianceCount = countExistingAlliances(actorId);

    // Evaluate non-player neighbors first, then regional non-player peers
    const aiPeers = Array.from(neighborIds).filter(
      (id) => id !== playerNationId && nations[id] && !nations[id].isEliminated
    );

    for (const peerId of aiPeers) {
      const peer = nations[peerId];
      if (!peer || isAtWar(wars, actorId, peerId)) continue;

      const rel = getOrCreateRelation(relations, actorId, peerId);
      const rKey = relationKey(actorId, peerId);

      // 1) Form Defensive Pact when threatened by a stronger / high-AE neighbor (cap 2 alliances per AI to avoid hugbox)
      if (
        hasStrongerOrHighAeNeighbor &&
        !rel.isAllied &&
        !rel.allianceType &&
        rel.score >= 18 &&
        actorAllianceCount < 2 &&
        countExistingAlliances(peerId) < 2
      ) {
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
          title: `🛡️ Savunma Paktı: ${actorNation.name} & ${peer.name}`,
          description: `${actorNation.name} ve ${peer.name}, bölgesel güç dengesini korumak amacıyla ortak savunma paktı imzaladı.`,
          type: 'COALITION',
        };
        break;
      }

      // 2) Sign Trade Agreement between peaceful non-hostile neighbors
      if (!rel.hasTradeAgreement && !rel.hasEmbargo && rel.score >= 0) {
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
      if (!rel.hasNonAggression && !rel.isAllied && rel.score >= 10) {
        const peerTroops = computeRealmTotalTroops(peerId, activeTerrs, movements);
        if (peerTroops >= actorTotalTroops * 0.7 && peerTroops <= actorTotalTroops * 1.45) {
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
    }
  }

  // 5. Strategic Coalition-Aware War Evaluation (Never declare suicidal or unstable wars!)
  const maxAllowedGlobalWars =
    aiAggressiveness === 'PASSIVE'
      ? 1
      : aiAggressiveness === 'NORMAL'
      ? 3
      : aiAggressiveness === 'AGGRESSIVE'
      ? 5
      : 8;

  const localRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.9
      : aiAggressiveness === 'NORMAL'
      ? 1.35
      : aiAggressiveness === 'AGGRESSIVE'
      ? 1.15
      : 1.0;

  const coalitionRatioThreshold =
    aiAggressiveness === 'PASSIVE'
      ? 1.55
      : aiAggressiveness === 'NORMAL'
      ? 1.12
      : aiAggressiveness === 'AGGRESSIVE'
      ? 0.92
      : 0.78;

  const actorReadyForOffensiveWar =
    !actorInAnyWar &&
    actorNation.stability >= 45 &&
    actorNation.manpower >= 5000 &&
    wars.length < maxAllowedGlobalWars;

  if (actorReadyForOffensiveWar) {
    for (const prov of ownedProvinces) {
      const currProv = activeTerrs[prov.id];
      if (!currProv || currProv.garrison < 22000) continue;

      const candidateTargetId = currProv.neighbors.find((nId) => {
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

        const isHighAeCoalition =
          targetOwner.aggressiveExpansion >= 55 &&
          attackerCoalitionTroops >= defenderCoalitionTroops * 0.75;
        const hasEmpireAdvantage =
          attackerCoalitionTroops >=
          defenderCoalitionTroops * coalitionRatioThreshold * distractionDiscount;
        const hasBorderAdvantage =
          currProv.garrison >= nTerr.garrison * localRatioThreshold;

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

  if (updatedNations || updatedTerritories || updatedRelations) {
    return {
      updatedNations,
      updatedTerritories,
      updatedRelations,
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
    const welfareRelief = Math.max(0, (owner.budget.welfare - 20) * 0.08);
    const depotRelief = t.buildings.supplyDepot * 1.2;
    const taxPressure = Math.max(0, (owner.taxRate - 30) * 0.15);

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
