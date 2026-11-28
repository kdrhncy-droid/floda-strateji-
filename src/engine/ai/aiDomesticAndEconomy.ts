import {
  getNationModernizedTier,
  getNationUnlockedMilTier,
  getTechTreeForMode,
} from '../../data/world2026Data';
import {
  ActiveWar,
  AiPersonality,
  BuildingType,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
} from '../../types/game';
import { AiAggressivenessLevel } from '../gameSettings';
import { findArmyRouteAStar } from '../pathfindingEngine';
import {
  AI_PERSONALITY_META,
  calculateProvinceSupplyLimit,
  getGameSeason,
} from '../seasonSupplyAndAiProfile';
import {
  calculateProvinceDevelopment,
  getOrCreateRelation,
  isAtWar,
} from '../simulationEngine';
import { isTerritoryCoastal } from '../worldBuilder';
import {
  AiTurnResult,
  STRATEGIC_STRAIT_SHORE_SET,
  scaleUnitComp,
} from './aiSharedUtils';

/**
 * Step 1: Personality-specialized AI technology progression and national army modernization.
 */
export function evaluateAiTechAndModernization(params: {
  actorId: string;
  actorNation: Nation;
  nations: Record<string, Nation>;
  wars: ActiveWar[];
  gameMode: GameModeId;
  aiAggressiveness: AiAggressivenessLevel;
  actorPersonality: AiPersonality;
}): {
  actorNation: Nation;
  updatedNations?: Record<string, Nation>;
} {
  const {
    actorId,
    nations,
    wars,
    gameMode,
    aiAggressiveness,
    actorPersonality,
  } = params;

  let actorNation = params.actorNation;
  let updatedNations: Record<string, Nation> | undefined;
  const personalityMeta = AI_PERSONALITY_META[actorPersonality];
  const isMasterAiDifficulty =
    aiAggressiveness === 'AGGRESSIVE' || aiAggressiveness === 'CHAOS';

  if (
    isMasterAiDifficulty &&
    !wars.some(
      (w) => w.attackers.includes(actorId) || w.defenders.includes(actorId)
    )
  ) {
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

  return { actorNation, updatedNations };
}

/**
 * Step 2: Internal governance — assimilate unruly provinces, construct peacetime buildings,
 * or levy border garrisons when threatened.
 */
export function evaluateAiDomesticGovernanceAndBuild(params: {
  actorId: string;
  actorNation: Nation;
  ownedProvinces: Territory[];
  nations: Record<string, Nation>;
  updatedNations?: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  nextTick: number;
  stepIndex: number;
  gameMode: GameModeId;
  aiAggressiveness: AiAggressivenessLevel;
  actorPersonality: AiPersonality;
  actorInAnyWar: boolean;
}): {
  actorNation: Nation;
  updatedNations?: Record<string, Nation>;
  updatedTerritories?: Record<string, Territory>;
} {
  const {
    actorId,
    ownedProvinces,
    nations,
    territories,
    relations,
    wars,
    nextTick,
    stepIndex,
    gameMode,
    aiAggressiveness,
    actorPersonality,
    actorInAnyWar,
  } = params;

  let actorNation = params.actorNation;
  let updatedNations = params.updatedNations;
  let updatedTerritories: Record<string, Territory> | undefined;
  const isMasterAiDifficulty =
    aiAggressiveness === 'AGGRESSIVE' || aiAggressiveness === 'CHAOS';

  const highUnrestProv = ownedProvinces
    .filter((p) => p.unrest >= 55 || p.coreOwnerId !== actorId)
    .sort((a, b) => b.unrest - a.unrest)[0];

  if (
    highUnrestProv &&
    highUnrestProv.unrest >= 55 &&
    actorNation.treasury >= 550
  ) {
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
    return { actorNation, updatedNations, updatedTerritories };
  }

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
  const preferEconByPersonality = isMasterAiDifficulty
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
    const straitShoreSet = STRATEGIC_STRAIT_SHORE_SET;
    const currentSeason = getGameSeason(nextTick, gameMode);
    const overSupplyProv = ownedProvinces.find(
      (p) =>
        p.garrison >=
          calculateProvinceSupplyLimit(p, actorNation, currentSeason) * 0.9 &&
        (p.buildings.supplyDepot || 0) < 4
    );
    const lowManpower = actorNation.manpower < 18000;
    const behindInTech =
      actorNation.unlockedTechs.length < (isMasterAiDifficulty ? 6 : 3);
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
              ? [
                  'shipyard',
                  'tradeHub',
                  'mint',
                  'factory',
                  'highSchool',
                  'school',
                  'university',
                  'granary',
                ]
              : [
                  'tradeHub',
                  'factory',
                  'mint',
                  'highSchool',
                  'school',
                  'university',
                  'granary',
                  'supplyDepot',
                ]
            : actorPersonality === 'CONQUEROR' ||
              actorPersonality === 'REVANCHIST'
            ? [
                'factory',
                'barracks',
                'school',
                'highSchool',
                'university',
                'supplyDepot',
                'fortress',
                'granary',
                'shipyard',
                'mint',
              ]
            : actorPersonality === 'DEFENDER'
            ? [
                'fortress',
                'factory',
                'school',
                'highSchool',
                'granary',
                'supplyDepot',
                'mint',
                'university',
                'shipyard',
              ]
            : isStraitProv
            ? [
                'shipyard',
                'tradeHub',
                'fortress',
                'factory',
                'mint',
                'highSchool',
                'university',
              ]
            : behindInTech
            ? [
                'school',
                'highSchool',
                'university',
                'factory',
                'mint',
                'tradeHub',
                'granary',
                'barracks',
              ]
            : [
                'factory',
                'tradeHub',
                'school',
                'highSchool',
                'university',
                'mint',
                'granary',
                'barracks',
                'fortress',
              ];
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
    return { actorNation, updatedNations, updatedTerritories };
  }

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
    actorNation.treasury >= 480 &&
    actorNation.manpower >= 3200
  ) {
    const targetProv = [weakestBorder, ...ownedProvinces].find(
      (p) => p && !p.siege
    );
    if (targetProv) {
      const empireScale = Math.min(
        5500,
        Math.max(0, ownedProvinces.length - 1) * 850
      );
      const addTroops = Math.min(
        actorNation.manpower,
        (aiAggressiveness === 'CHAOS' ? 9000 : 6000) + empireScale
      );
      const levyCost = Math.min(
        actorNation.treasury,
        Math.max(380, Math.round(addTroops * 0.065))
      );
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

  return { actorNation, updatedNations, updatedTerritories };
}

/**
 * Steps 3 & 4: Tactical border war offensives and multi-province A* reserve
 * redeployment / pre-war border staging.
 */
export function evaluateAiBorderOffensiveOrBuildup(params: {
  actorId: string;
  actorNation: Nation;
  playerNationId: string;
  ownedProvinces: Territory[];
  activeTerrs: Record<string, Territory>;
  nations: Record<string, Nation>;
  updatedNations?: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  nextTick: number;
  actorPersonality: AiPersonality;
  actorInAnyWar: boolean;
}): AiTurnResult | null {
  const {
    actorId,
    actorNation,
    playerNationId,
    ownedProvinces,
    activeTerrs,
    nations,
    updatedNations,
    relations,
    wars,
    nextTick,
    actorPersonality,
    actorInAnyWar,
  } = params;
  const personalityMeta = AI_PERSONALITY_META[actorPersonality];

  // 3. Tactical War Offensives — Only attack when dispatched army can realistically win
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
        const aScore =
          (a.isCapital ? -2500 : 0) +
          a.garrison +
          (a.buildings.fortress || 0) * 1400;
        const bScore =
          (b.isCapital ? -2500 : 0) +
          b.garrison +
          (b.buildings.fortress || 0) * 1400;
        return aScore - bScore;
      });

    const viableTarget = enemyCandidates.find((enemyTerr) => {
      const dispatchable = Math.round(currentProv.garrison * 0.62);
      const terrainPenalty =
        enemyTerr.terrain === 'DAGLIK' || (enemyTerr.buildings.fortress || 0) >= 2
          ? 1.12
          : 0.88;
      return (
        dispatchable >= Math.max(2500, enemyTerr.garrison * terrainPenalty)
      );
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

  // 4. Multi-Province A* Reserve Redeployment & Pre-War Border Buildup
  if (ownedProvinces.length > 1) {
    const minInteriorThreshold =
      actorPersonality === 'CONQUEROR' || actorPersonality === 'REVANCHIST'
        ? 14000
        : 19000;
    const scoreBorderUrgency = (p: Territory): number => {
      let urgency = -p.garrison;
      for (const nId of p.neighbors) {
        const nb = activeTerrs[nId];
        if (!nb || nb.ownerId === actorId) continue;
        const nbRel = getOrCreateRelation(relations, actorId, nb.ownerId);
        if (actorInAnyWar && isAtWar(wars, actorId, nb.ownerId)) urgency += 22000;
        if (nb.coreOwnerId === actorId) urgency += 14000;
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

    const destFront = frontlineTargets[0];
    const interiorRichProv =
      ownedProvinces.find(
        (p) =>
          (activeTerrs[p.id]?.garrison || 0) >= minInteriorThreshold &&
          p.neighbors.every((nId) => activeTerrs[nId]?.ownerId === actorId)
      ) ||
      (destFront && destFront.garrison < 4500
        ? ownedProvinces.find(
            (p) =>
              p.id !== destFront.id &&
              (activeTerrs[p.id]?.garrison || 0) >= 12000
          )
        : undefined);

    if (interiorRichProv && destFront && interiorRichProv.id !== destFront.id) {
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
        const moveTroops = Math.round(srcCurr.garrison * 0.42);
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

  return null;
}
