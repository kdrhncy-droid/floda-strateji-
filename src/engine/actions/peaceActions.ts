import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  PeaceDealType,
  Territory,
  UnitComposition,
  WorldNewsEvent,
} from '../../types/game';
import {
  applyConquestDiplomaticPenalty,
  calculateProjectedPeaceAE,
  evaluateWorldCoalitionAt100AE,
  getOrCreateRelation,
  relationKey,
} from '../core/diplomacyHelpers';
import {
  calculateProvinceDevelopment,
} from '../simulationEngine';
import { sound } from '../../utils/soundEngine';
import {
  DomainActionPatch,
  prependNews,
} from './diplomacyActionHelpers';

function mergeUnitsSafe(
  a: UnitComposition | undefined,
  aFallbackInf: number,
  b: UnitComposition | undefined,
  bFallbackInf: number
): UnitComposition {
  const ua = a || { infantry: aFallbackInf, armor: 0, airDrone: 0 };
  const ub = b || { infantry: bFallbackInf, armor: 0, airDrone: 0 };
  return {
    infantry: Math.max(0, ua.infantry + ub.infantry),
    armor: Math.max(0, ua.armor + ub.armor),
    airDrone: Math.max(0, ua.airDrone + ub.airDrone),
  };
}

/**
 * Safely returns an occupied province to its rightful pre-occupation owner while
 * evacuating any occupying garrison/units back to a friendly territory (or capital)
 * of the occupier so armies neither vanish nor get gifted to the restored nation.
 */
function restoreOccupiedTerritoryToOwner(
  nextTerritories: Record<string, Territory>,
  nextNations: Record<string, Nation>,
  terr: Territory,
  rightfulOwnerId: string
): void {
  const occupierId = terr.ownerId;
  if (occupierId && occupierId !== rightfulOwnerId && terr.garrison > 0) {
    const occupierCapId = nextNations[occupierId]?.capitalTerritoryId;
    const adjHome = terr.neighbors
      .map((nId) => nextTerritories[nId])
      .find((nt) => nt && nt.id !== terr.id && nt.ownerId === occupierId);
    const capHome =
      occupierCapId &&
      occupierCapId !== terr.id &&
      nextTerritories[occupierCapId]?.ownerId === occupierId
        ? nextTerritories[occupierCapId]
        : undefined;
    const anyHome =
      adjHome ||
      capHome ||
      Object.values(nextTerritories).find(
        (nt) => nt && nt.id !== terr.id && nt.ownerId === occupierId
      );

    if (anyHome) {
      nextTerritories[anyHome.id] = {
        ...anyHome,
        garrison: anyHome.garrison + terr.garrison,
        units: mergeUnitsSafe(
          anyHome.units,
          anyHome.garrison,
          terr.units,
          terr.garrison
        ),
      };
    }
  }

  const restoredGarrison =
    occupierId === rightfulOwnerId ? terr.garrison : 800;
  const restoredUnits: UnitComposition =
    occupierId === rightfulOwnerId && terr.units
      ? terr.units
      : { infantry: restoredGarrison, armor: 0, airDrone: 0 };

  nextTerritories[terr.id] = {
    ...terr,
    ownerId: rightfulOwnerId,
    isOccupied: false,
    occupiedById: undefined,
    occupiedFromId: undefined,
    siege: null,
    garrison: restoredGarrison,
    units: restoredUnits,
  };

  const rightfulNation = nextNations[rightfulOwnerId];
  if (rightfulNation) {
    const capOwned =
      nextTerritories[rightfulNation.capitalTerritoryId]?.ownerId ===
      rightfulOwnerId;
    if (rightfulNation.isEliminated || !capOwned) {
      const nextCapId = capOwned ? rightfulNation.capitalTerritoryId : terr.id;
      nextNations[rightfulOwnerId] = {
        ...rightfulNation,
        isEliminated: false,
        capitalTerritoryId: nextCapId,
      };
      if (nextTerritories[nextCapId]) {
        nextTerritories[nextCapId] = {
          ...nextTerritories[nextCapId],
          isCapital: true,
        };
      }
    }
  }
}

/**
 * Restores all non-annexed occupied territories (especially secondary war allies' territories,
 * which must NEVER be annexed in peace!) and clears active sieges between the two war sides.
 */
function settleRemainingWarOccupationsAndSieges(
  nextTerritories: Record<string, Territory>,
  nextNations: Record<string, Nation>,
  sideAIds: string[],
  sideBIds: string[],
  annexedIdsSet: Set<string>
): void {
  const setA = new Set(sideAIds);
  const setB = new Set(sideBIds);
  const allWarIds = new Set([...sideAIds, ...sideBIds]);

  for (const t of Object.values(nextTerritories)) {
    if (!t || annexedIdsSet.has(t.id)) continue;
    const rightfulOwner = t.occupiedFromId ?? t.coreOwnerId;

    if (t.isOccupied && rightfulOwner) {
      const aOccupiedB = setA.has(t.ownerId) && setB.has(rightfulOwner);
      const bOccupiedA = setB.has(t.ownerId) && setA.has(rightfulOwner);
      if (aOccupiedB || bOccupiedA) {
        // First evacuate any active siege troops on this tile before restoring
        if (t.siege && t.siege.attackerTroops > 0) {
          const sAttId = t.siege.attackerId;
          const sHome = Object.values(nextTerritories).find(
            (nt) => nt && nt.id !== t.id && nt.ownerId === sAttId
          );
          if (sHome) {
            nextTerritories[sHome.id] = {
              ...sHome,
              garrison: sHome.garrison + t.siege.attackerTroops,
              units: mergeUnitsSafe(
                sHome.units,
                sHome.garrison,
                t.siege.attackerUnits,
                t.siege.attackerTroops
              ),
            };
          }
        }
        restoreOccupiedTerritoryToOwner(
          nextTerritories,
          nextNations,
          nextTerritories[t.id],
          rightfulOwner
        );
        continue;
      }
    }

    if (
      t.siege &&
      allWarIds.has(t.ownerId) &&
      allWarIds.has(t.siege.attackerId) &&
      ((setA.has(t.ownerId) && setB.has(t.siege.attackerId)) ||
        (setB.has(t.ownerId) && setA.has(t.siege.attackerId)))
    ) {
      const sAttId = t.siege.attackerId;
      const sHome = Object.values(nextTerritories).find(
        (nt) => nt && nt.id !== t.id && nt.ownerId === sAttId
      );
      if (sHome && t.siege.attackerTroops > 0) {
        nextTerritories[sHome.id] = {
          ...sHome,
          garrison: sHome.garrison + t.siege.attackerTroops,
          units: mergeUnitsSafe(
            sHome.units,
            sHome.garrison,
            t.siege.attackerUnits,
            t.siege.attackerTroops
          ),
        };
      }
      nextTerritories[t.id] = {
        ...nextTerritories[t.id],
        siege: null,
      };
    }
  }
}

function applyCoalitionTruces(
  workingRelations: Record<string, DiplomaticRelation>,
  sideAIds: string[],
  sideBIds: string[],
  truceUntilTick: number
): void {
  for (const aId of sideAIds) {
    for (const bId of sideBIds) {
      if (!aId || !bId || aId === bId) continue;
      const k = relationKey(aId, bId);
      const rel = getOrCreateRelation(workingRelations, aId, bId);
      workingRelations[k] = {
        ...rel,
        truceUntilTick: Math.max(rel.truceUntilTick || 0, truceUntilTick),
      };
    }
  }
}

function cancelPostPeaceHostileOperations(
  nextTerritories: Record<string, Territory>,
  sideAIds: string[],
  sideBIds: string[],
  remainingWars: ActiveWar[],
  movements?: ArmyMovement[],
  battles?: ActiveBattle[]
): { nextMovements?: ArmyMovement[]; nextBattles?: ActiveBattle[] } {
  const setA = new Set(sideAIds);
  const setB = new Set(sideBIds);
  const areStillAtWar = (x: string, y: string) =>
    remainingWars.some(
      (w) =>
        (w.attackers.includes(x) && w.defenders.includes(y)) ||
        (w.defenders.includes(x) && w.attackers.includes(y))
    );
  const isPeacePair = (x: string, y: string) =>
    ((setA.has(x) && setB.has(y)) || (setB.has(x) && setA.has(y))) &&
    !areStillAtWar(x, y);

  let nextMovements: ArmyMovement[] | undefined;
  if (movements && movements.length > 0) {
    let changed = false;
    const kept: ArmyMovement[] = [];
    for (const mv of movements) {
      const destOwner =
        nextTerritories[mv.finalDestinationId || mv.toTerritoryId]?.ownerId ||
        nextTerritories[mv.toTerritoryId]?.ownerId;
      const hopOwner = nextTerritories[mv.toTerritoryId]?.ownerId;
      if (
        (destOwner && isPeacePair(mv.ownerId, destOwner)) ||
        (hopOwner && isPeacePair(mv.ownerId, hopOwner))
      ) {
        changed = true;
        const origin =
          nextTerritories[mv.fromTerritoryId]?.ownerId === mv.ownerId
            ? nextTerritories[mv.fromTerritoryId]
            : Object.values(nextTerritories).find(
                (nt) => nt && nt.ownerId === mv.ownerId
              );
        if (origin && mv.troops > 0) {
          nextTerritories[origin.id] = {
            ...origin,
            garrison: origin.garrison + mv.troops,
            units: mergeUnitsSafe(
              origin.units,
              origin.garrison,
              mv.units,
              mv.troops
            ),
          };
        }
      } else {
        kept.push(mv);
      }
    }
    if (changed) nextMovements = kept;
  }

  let nextBattles: ActiveBattle[] | undefined;
  if (battles && battles.length > 0) {
    let changed = false;
    const kept: ActiveBattle[] = [];
    for (const btl of battles) {
      if (isPeacePair(btl.attackerId, btl.defenderId)) {
        changed = true;
        const defTerr = nextTerritories[btl.territoryId];
        if (defTerr && defTerr.ownerId === btl.defenderId) {
          nextTerritories[defTerr.id] = {
            ...defTerr,
            garrison: Math.max(defTerr.garrison, btl.defenderTroops),
          };
        }
        const attOrigin =
          (btl.fromTerritoryId &&
          nextTerritories[btl.fromTerritoryId]?.ownerId === btl.attackerId
            ? nextTerritories[btl.fromTerritoryId]
            : undefined) ||
          Object.values(nextTerritories).find(
            (nt) => nt && nt.ownerId === btl.attackerId
          );
        if (attOrigin && btl.attackerTroops > 0) {
          nextTerritories[attOrigin.id] = {
            ...attOrigin,
            garrison: attOrigin.garrison + btl.attackerTroops,
            units: mergeUnitsSafe(
              attOrigin.units,
              attOrigin.garrison,
              btl.attackerUnits,
              btl.attackerTroops
            ),
          };
        }
      } else {
        kept.push(btl);
      }
    }
    if (changed) nextBattles = kept;
  }

  return { nextMovements, nextBattles };
}

export function resolvePeaceDealDomain(params: {
  warId: string;
  dealType: PeaceDealType;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  movements?: ArmyMovement[];
  battles?: ActiveBattle[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    warId,
    dealType,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    movements,
    battles,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === warId);
  const playerNation = nations[playerNationId];
  if (!war || !playerNation) return {};

  const isPlayerAttackerSide =
    war.attackerId === playerNationId || war.attackers.includes(playerNationId);
  const enemyId = isPlayerAttackerSide ? war.defenderId : war.attackerId;
  const enemy = nations[enemyId];
  const playerSideIds = Array.from(
    new Set([
      playerNationId,
      ...(isPlayerAttackerSide ? war.attackers : war.defenders),
    ])
  );
  const enemySideIds = Array.from(
    new Set([
      enemyId,
      ...(isPlayerAttackerSide ? war.defenders : war.attackers),
    ])
  );

  // Effective war score from the player's perspective (-100 to +100)
  const playerWarScore = isPlayerAttackerSide
    ? war.attackerWarScore
    : -war.attackerWarScore;

  // Count ONLY primary enemy territories currently occupied by the player's side (never secondary allies!)
  const occupiedPrimaryEnemyProvs = Object.values(territories).filter(
    (t) =>
      t &&
      playerSideIds.includes(t.ownerId) &&
      t.isOccupied &&
      (t.occupiedFromId ?? t.coreOwnerId) === enemyId
  );

  // Effective war score including occupied primary enemy provinces (+25 required for peace deals!)
  const effectiveDealScore = Math.max(
    playerWarScore,
    Math.round(Math.max(0, playerWarScore) + occupiedPrimaryEnemyProvs.length * 14)
  );

  // Enforce realistic AoH3 +25 War Score threshold before accepting peace demands or white peace!
  if (dealType === 'ANNEX_OCCUPIED') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} barış masasına oturmuyor! Barış anlaşması için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectiveDealScore}).`,
      };
    }
  } else if (dealType === 'VASSALIZE') {
    if (playerWarScore < 50 && !enemy?.isEliminated) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} bağımsızlığından vazgeçmiyor! Vasallaştırmak için Savaş Skorunun en az +%50 olması gerekir (Mevcut: %${playerWarScore}).`,
      };
    }
  } else if (dealType === 'REPARATIONS') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 ${enemy?.name || 'Düşman'} savaş tazminatı ödemeyi reddediyor! En az +25 Savaş Skoru gerekli (Mevcut: %${effectiveDealScore}).`,
      };
    }
  } else if (dealType === 'WHITE_PEACE') {
    if (effectiveDealScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 Savaş ilan edildikten hemen sonra barış yapılamaz! Barış imzalamak için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${effectiveDealScore}).`,
      };
    }
  }

  sound.playTreaty();

  const nextNations = { ...nations };
  const nextTerritories = { ...territories };
  let workingRelations = { ...relations };
  let nextNews = newsEvents;
  let toast = `${enemy?.name} ile Beyaz Barış imzalandı.`;
  const annexedSet = new Set<string>();

  if (dealType === 'ANNEX_OCCUPIED') {
    const extraProvincesAllowed =
      playerWarScore >= 75 ? 2 : playerWarScore >= 45 ? 1 : 0;
    let annexedCount = 0;
    const annexedIds: string[] = [];

    // ONLY annex occupied provinces belonging to the primary war target (`enemyId`), NEVER secondary allies!
    Object.values(nextTerritories).forEach((t) => {
      if (
        t &&
        t.ownerId === playerNationId &&
        t.isOccupied &&
        (t.occupiedFromId ?? t.coreOwnerId) === enemyId
      ) {
        const isCore = t.coreOwnerId === playerNationId;
        annexedCount++;
        annexedIds.push(t.id);
        annexedSet.add(t.id);
        nextTerritories[t.id] = {
          ...t,
          isOccupied: false,
          occupiedById: undefined,
          occupiedFromId: undefined,
          siege: null,
          assimilation: isCore ? 100 : Math.min(t.assimilation ?? 25, 85),
          isAssimilating: false,
        };
      }
    });

    const remainingEnemyTerrs = Object.values(nextTerritories).filter(
      (t) => t && t.ownerId === enemyId
    );
    remainingEnemyTerrs.slice(0, extraProvincesAllowed).forEach((t) => {
      const isCore = t.coreOwnerId === playerNationId;
      annexedCount++;
      annexedIds.push(t.id);
      annexedSet.add(t.id);
      nextTerritories[t.id] = {
        ...t,
        ownerId: playerNationId,
        isCapital: false,
        isOccupied: false,
        occupiedById: undefined,
        occupiedFromId: undefined,
        siege: null,
        assimilation: isCore ? 100 : 25,
        isAssimilating: false,
        unrest: isCore ? Math.max(0, t.unrest - 10) : Math.min(75, t.unrest + 20),
      };
    });

    // Restore any occupied secondary-ally territories (and any occupied player-side territories)
    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      annexedSet
    );

    const stillOwned = Object.values(nextTerritories).filter(
      (t) => t && t.ownerId === enemyId
    );
    const fullAnnex = stillOwned.length === 0;
    if (fullAnnex && nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        isEliminated: true,
      };
    } else if (
      stillOwned.length > 0 &&
      nextNations[enemyId] &&
      nextTerritories[nextNations[enemyId].capitalTerritoryId]?.ownerId !== enemyId
    ) {
      const newCap = stillOwned[0];
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        capitalTerritoryId: newCap.id,
      };
      nextTerritories[newCap.id] = {
        ...newCap,
        isCapital: true,
      };
    }

    const aeCalc = calculateProjectedPeaceAE({
      territories: nextTerritories,
      demandedTerritoryIds: annexedIds,
      isFullAnnex: fullAnnex,
      demandVassal: false,
      conquerorNation: nextNations[playerNationId],
    });
    if (aeCalc.adjustedGain > 0 && nextNations[playerNationId]) {
      nextNations[playerNationId] = {
        ...nextNations[playerNationId],
        aggressiveExpansion: aeCalc.projectedTotal,
      };
    }

    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyId,
      provincesTakenCount: Math.max(1, annexedCount),
      isFullAnnexation: fullAnnex,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;

    const diploSuffix =
      penaltyRes.affectedNames.length > 0
        ? ` (Dost/Müttefik tepkisi: ${penaltyRes.affectedNames.slice(0, 3).join(', ')})`
        : '';

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${war.name} Sona Erdi`,
      `${playerNation.name} ve ${enemy?.name} arasında imzalanan barış antlaşmasıyla ${Math.max(1, annexedCount)} eyalet resmen ilhak edildi (+${aeCalc.adjustedGain} Agresiflik).${diploSuffix}`,
      'PEACE'
    );
    toast = `📜 ${enemy?.name} ile Barış: ${Math.max(1, annexedCount)} eyalet ilhak edildi (+${aeCalc.adjustedGain} Agresiflik).${diploSuffix}`;
  } else if (dealType === 'VASSALIZE') {
    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      annexedSet
    );
    if (nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        isEliminated: false,
        vassalOf: playerNationId,
      };
    }
    const aeCalc = calculateProjectedPeaceAE({
      territories: nextTerritories,
      demandedTerritoryIds: [],
      isFullAnnex: false,
      demandVassal: true,
      conquerorNation: nextNations[playerNationId],
    });
    if (aeCalc.adjustedGain > 0 && nextNations[playerNationId]) {
      nextNations[playerNationId] = {
        ...nextNations[playerNationId],
        aggressiveExpansion: aeCalc.projectedTotal,
      };
    }
    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyId,
      provincesTakenCount: 2,
      isFullAnnexation: false,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${enemy?.name} Vasallaştırıldı`,
      `${enemy?.name}, barış antlaşması şartları gereği ${playerNation.name} himayesine girdi.`,
      'PEACE'
    );
    toast = `👑 ${enemy?.name} barış antlaşmasıyla Vasal Devlet statüsüne alındı!`;
  } else if (dealType === 'REPARATIONS') {
    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      annexedSet
    );
    const indemnity = Math.min(
      1100,
      Math.max(400, Math.round((enemy?.treasury || 700) * 0.45))
    );
    nextNations[playerNationId] = {
      ...nextNations[playerNationId],
      treasury: nextNations[playerNationId].treasury + indemnity,
    };
    if (nextNations[enemyId]) {
      nextNations[enemyId] = {
        ...nextNations[enemyId],
        treasury: Math.max(0, nextNations[enemyId].treasury - indemnity),
      };
    }
    toast = `🪙 ${enemy?.name} devletinden +${indemnity} Altın savaş tazminatı tahsil edildi!`;
  } else if (dealType === 'WHITE_PEACE') {
    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      annexedSet
    );
    if (playerWarScore < -35) {
      nextNations[playerNationId] = {
        ...nextNations[playerNationId],
        treasury: Math.max(0, nextNations[playerNationId].treasury - 350),
      };
      toast = `${enemy?.name} ile 350 Altın tazminat ödenerek ateşkes imzalandı.`;
    }
  }

  applyCoalitionTruces(workingRelations, playerSideIds, enemySideIds, tick + 90);

  const remainingWars = wars.filter((w) => w.id !== warId);
  const { nextMovements, nextBattles } = cancelPostPeaceHostileOperations(
    nextTerritories,
    playerSideIds,
    enemySideIds,
    remainingWars,
    movements,
    battles
  );

  const coalitionRes = evaluateWorldCoalitionAt100AE({
    targetNationId: playerNationId,
    nations: nextNations,
    territories: nextTerritories,
    relations: workingRelations,
    wars: remainingWars,
    tick,
    gameMode,
    newsEvents: nextNews,
    playerNationId,
  });

  return {
    nations: nextNations,
    territories: nextTerritories,
    relations: coalitionRes.relations,
    wars: coalitionRes.wars,
    ...(nextMovements ? { movements: nextMovements } : {}),
    ...(nextBattles ? { battles: nextBattles } : {}),
    newsEvents: coalitionRes.newsEvents,
    ...(coalitionRes.warAnnouncement
      ? { warAnnouncement: coalitionRes.warAnnouncement }
      : {}),
    toast:
      coalitionRes.triggered && coalitionRes.toast
        ? `${toast} ${coalitionRes.toast}`
        : toast,
  };
}

export type PeaceConferenceMode = 'PEACE_DEMANDS' | 'WHITE_PEACE' | 'SURRENDER';

export interface PeaceConferenceRequest {
  warId: string;
  mode: PeaceConferenceMode;
  demandedTerritoryIds?: string[];
  fullAnnexation?: boolean;
  demandVassal?: boolean;
  vassalizeEnemy?: boolean;
  demandTribute?: boolean;
  demandReparations?: boolean;
}

export function calculateProvincePeaceScoreCost(
  territory: Territory,
  ownerNation: Nation | undefined,
  isOccupiedByUs: boolean
): number {
  const dev = calculateProvinceDevelopment(territory, ownerNation);
  const baseDevCost = Math.round(
    Math.max(8, Math.min(34, 8 + dev.developmentScore * 0.24))
  );
  const capitalBonus = territory.isCapital ? 8 : 0;
  const rawCost = baseDevCost + capitalBonus;
  // Occupied provinces cost 35% fewer peace points than unoccupied enemy territory
  const discounted = isOccupiedByUs ? Math.round(rawCost * 0.65) : rawCost;
  return Math.max(6, Math.min(42, discounted));
}

export interface WarPeaceBudgetInfo {
  signedWarScore: number;
  /** Symmetric, non-double-counted war balance percentage (-100 to +100) for HUD & War Overview UI */
  warBalanceScore: number;
  occupiedEnemyProvinces: Territory[];
  claimableEnemyProvinces: Territory[];
  occupiedPlayerProvinces: Territory[];
  availableBudget: number;
  enemyNationId: string;
  isPlayerAttackerSide: boolean;
}

export function calculateWarPeaceBudget(
  war: ActiveWar,
  playerNationId: string,
  territories: Record<string, Territory>,
  explicitEnemyId?: string
): WarPeaceBudgetInfo {
  const isPlayerAttackerSide =
    war.attackerId === playerNationId || war.attackers.includes(playerNationId);
  const enemyNationId =
    explicitEnemyId || (isPlayerAttackerSide ? war.defenderId : war.attackerId);
  const playerSideIds = Array.from(
    new Set([
      playerNationId,
      ...(isPlayerAttackerSide ? war.attackers : war.defenders),
    ])
  );
  const enemySideIds = Array.from(
    new Set([
      enemyNationId,
      ...(isPlayerAttackerSide ? war.defenders : war.attackers),
    ])
  );

  const signedWarScore = isPlayerAttackerSide
    ? war.attackerWarScore
    : -war.attackerWarScore;

  // Claimable enemy provinces: STRICTLY provinces belonging to the primary war opponent (`enemyNationId`).
  // Secondary allies who joined alongside `enemyNationId` cannot have their territories annexed in peace!
  const claimableEnemyProvinces = Object.values(territories).filter((t) => {
    if (!t) return false;
    if (t.ownerId === enemyNationId) return true;
    const preOccOwner = t.occupiedFromId ?? t.coreOwnerId;
    if (
      playerSideIds.includes(t.ownerId) &&
      t.isOccupied &&
      preOccOwner === enemyNationId
    ) {
      return true;
    }
    return false;
  });

  const occupiedEnemyProvinces = claimableEnemyProvinces.filter(
    (t) => playerSideIds.includes(t.ownerId) && Boolean(t.isOccupied)
  );

  // Player's own homeland provinces (owned or currently occupied by enemy coalition) for symmetric war balance
  const playerOriginalProvinces = Object.values(territories).filter((t) => {
    if (!t) return false;
    if (t.ownerId === playerNationId && !t.isOccupied) return true;
    const preOccOwner = t.occupiedFromId ?? t.coreOwnerId;
    if (
      enemySideIds.includes(t.ownerId) &&
      t.isOccupied &&
      preOccOwner === playerNationId
    ) {
      return true;
    }
    return false;
  });

  const occupiedPlayerProvinces = playerOriginalProvinces.filter(
    (t) => enemySideIds.includes(t.ownerId) && Boolean(t.isOccupied)
  );

  const occupationBonus = occupiedEnemyProvinces.length * 14;
  const totalEnemyOriginalCount = Math.max(1, claimableEnemyProvinces.length);
  const allEnemyOccupied =
    claimableEnemyProvinces.length > 0 &&
    occupiedEnemyProvinces.length >= claimableEnemyProvinces.length;
  const allPlayerOccupied =
    playerOriginalProvinces.length > 0 &&
    occupiedPlayerProvinces.length >= playerOriginalProvinces.length;
  const allOccupiedBonus = allEnemyOccupied ? 100 : 0;

  const availableBudget = Math.max(
    0,
    Math.min(
      100,
      Math.max(
        allOccupiedBonus,
        Math.round(Math.max(0, signedWarScore) + occupationBonus)
      )
    )
  );

  // Compute symmetric, non-double-counted war status percentage (-100..+100):
  // - 0% at war start when no battles or occupations have occurred
  // - Scales proportionally to share of primary enemy vs player provinces occupied + battle/siege score
  // - Reaches +100% / -100% ONLY when 100% of primary enemy or player provinces are occupied (or signedWarScore === ±100)
  let warBalanceScore = 0;
  if (allEnemyOccupied || signedWarScore >= 100) {
    warBalanceScore = 100;
  } else if (allPlayerOccupied || signedWarScore <= -100) {
    warBalanceScore = -100;
  } else {
    const enemyOccRatio =
      claimableEnemyProvinces.length > 0
        ? occupiedEnemyProvinces.length / totalEnemyOriginalCount
        : 0;
    const playerOccRatio =
      playerOriginalProvinces.length > 0
        ? occupiedPlayerProvinces.length / Math.max(1, playerOriginalProvinces.length)
        : 0;
    const netOccScore = Math.round((enemyOccRatio - playerOccRatio) * 85);

    if (netOccScore === 0) {
      warBalanceScore = Math.max(-99, Math.min(99, Math.round(signedWarScore)));
    } else if (
      signedWarScore === 0 ||
      Math.sign(signedWarScore) === Math.sign(netOccScore)
    ) {
      const sign = Math.sign(netOccScore);
      const blendedMag = Math.max(
        Math.abs(netOccScore),
        Math.round(Math.abs(signedWarScore) * 0.65 + Math.abs(netOccScore) * 0.45)
      );
      warBalanceScore = sign * Math.min(99, blendedMag);
    } else {
      warBalanceScore = Math.max(
        -99,
        Math.min(99, Math.round(signedWarScore * 0.6 + netOccScore * 0.6))
      );
    }
  }

  return {
    signedWarScore,
    warBalanceScore,
    occupiedEnemyProvinces,
    claimableEnemyProvinces,
    occupiedPlayerProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  };
}

export function resolvePeaceConferenceDomain(params: {
  request: PeaceConferenceRequest;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles?: ActiveBattle[];
  movements?: ArmyMovement[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    request,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    battles,
    movements,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === request.warId);
  const playerNation = nations[playerNationId];
  if (!war || !playerNation) return {};

  const budgetInfo = calculateWarPeaceBudget(war, playerNationId, territories);
  const {
    warBalanceScore,
    claimableEnemyProvinces,
    availableBudget,
    enemyNationId,
    isPlayerAttackerSide,
  } = budgetInfo;

  const enemy = nations[enemyNationId];
  if (!enemy) return {};

  const playerSideIds = Array.from(
    new Set([
      playerNationId,
      ...(isPlayerAttackerSide ? war.attackers : war.defenders),
    ])
  );
  const enemySideIds = Array.from(
    new Set([
      enemyNationId,
      ...(isPlayerAttackerSide ? war.defenders : war.attackers),
    ])
  );

  const nextNations = { ...nations };
  const nextTerritories = { ...territories };
  let workingRelations = { ...relations };
  let nextNews = newsEvents;

  const effectivePeaceScore = warBalanceScore;

  // 1. WHITE PEACE (Galipsiz Barış) — requires +25 effective war score
  if (request.mode === 'WHITE_PEACE') {
    if (effectivePeaceScore < 25) {
      sound.playClick();
      return {
        toast: `🛑 Savaş ilan edildikten hemen sonra barış yapılamaz! Barış anlaşması için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${warBalanceScore}).`,
      };
    }

    sound.playTreaty();

    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      new Set<string>()
    );
    applyCoalitionTruces(workingRelations, playerSideIds, enemySideIds, tick + 90);

    const remainingWars = wars.filter((w) => w.id !== war.id);
    const { nextMovements, nextBattles } = cancelPostPeaceHostileOperations(
      nextTerritories,
      playerSideIds,
      enemySideIds,
      remainingWars,
      movements,
      battles
    );

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${war.name} — Galipsiz Barış`,
      `${playerNation.name} ile ${enemy.name} arasında sınırların korunması şartıyla Galipsiz Barış (Beyaz Barış) imzalandı.`,
      'PEACE'
    );

    return {
      nations: nextNations,
      territories: nextTerritories,
      relations: workingRelations,
      wars: remainingWars,
      ...(nextMovements ? { movements: nextMovements } : {}),
      ...(nextBattles ? { battles: nextBattles } : {}),
      newsEvents: nextNews,
      toast: `🕊️ ${enemy.name} ile Galipsiz Barış imzalandı (90 gün ateşkes).`,
    };
  }

  // 2. SURRENDER (Teslim Ol)
  if (request.mode === 'SURRENDER') {
    sound.playDefeat();

    // Primary enemy (`enemyNationId`) keeps any player provinces occupied; secondary allies do NOT annex land,
    // and player returns all occupied enemy & secondary-ally provinces safely.
    let lostCount = 0;
    const surrenderedKeptIds = new Set<string>();
    Object.values(nextTerritories).forEach((t) => {
      if (!t || !t.isOccupied) return;
      const preOccOwner = t.occupiedFromId ?? t.coreOwnerId;
      if (t.ownerId === enemyNationId && preOccOwner === playerNationId) {
        lostCount++;
        surrenderedKeptIds.add(t.id);
        nextTerritories[t.id] = {
          ...t,
          isOccupied: false,
          occupiedById: undefined,
          occupiedFromId: undefined,
          siege: null,
          assimilation: t.coreOwnerId === enemyNationId ? 100 : 25,
        };
      }
    });

    settleRemainingWarOccupationsAndSieges(
      nextTerritories,
      nextNations,
      playerSideIds,
      enemySideIds,
      surrenderedKeptIds
    );

    const indemnity = Math.round(Math.max(150, playerNation.treasury * 0.3));
    nextNations[playerNationId] = {
      ...nextNations[playerNationId],
      treasury: Math.max(0, nextNations[playerNationId].treasury - indemnity),
      stability: Math.max(15, nextNations[playerNationId].stability - 10),
    };
    nextNations[enemyNationId] = {
      ...nextNations[enemyNationId],
      treasury: nextNations[enemyNationId].treasury + indemnity,
    };

    applyCoalitionTruces(workingRelations, playerSideIds, enemySideIds, tick + 120);

    const remainingWars = wars.filter((w) => w.id !== war.id);
    const { nextMovements, nextBattles } = cancelPostPeaceHostileOperations(
      nextTerritories,
      playerSideIds,
      enemySideIds,
      remainingWars,
      movements,
      battles
    );

    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `${playerNation.name} Ateşkes Şartlarını Kabul Etti`,
      `${playerNation.name}, ${enemy.name} karşısında teslim şartlarını kabul etti (${indemnity} Altın tazminat${lostCount > 0 ? `, ${lostCount} eyalet kaybı` : ''}).`,
      'PEACE'
    );

    return {
      nations: nextNations,
      territories: nextTerritories,
      relations: workingRelations,
      wars: remainingWars,
      ...(nextMovements ? { movements: nextMovements } : {}),
      ...(nextBattles ? { battles: nextBattles } : {}),
      newsEvents: nextNews,
      toast: `🏳️ ${enemy.name} ile teslim antlaşması imzalandı (-${indemnity} Altın).`,
    };
  }

  // 3. PEACE_DEMANDS (Savaş Puanı Bütçeli Barış Konferansı — requires +25 effective war score)
  if (effectivePeaceScore < 25) {
    sound.playClick();
    return {
      toast: `🛑 Barış antlaşması imzalamak için Savaş Skorunda en az +25 önde olmalısınız (Mevcut: %${warBalanceScore}).`,
    };
  }
  const claimableMap = new Map<string, Territory>();
  for (const t of claimableEnemyProvinces) {
    claimableMap.set(t.id, t);
  }

  const demandedIds = request.fullAnnexation
    ? claimableEnemyProvinces.map((t) => t.id)
    : (request.demandedTerritoryIds || []).filter((id) => claimableMap.has(id));

  const isFullAnnex =
    claimableEnemyProvinces.length > 0 &&
    demandedIds.length === claimableEnemyProvinces.length;

  let territoryPointCost = 0;
  for (const id of demandedIds) {
    const terr = claimableMap.get(id)!;
    const isOccupiedByUs =
      playerSideIds.includes(terr.ownerId) && Boolean(terr.isOccupied);
    territoryPointCost += calculateProvincePeaceScoreCost(
      terr,
      enemy,
      isOccupiedByUs
    );
  }
  if (isFullAnnex && territoryPointCost > 100) {
    territoryPointCost = 100;
  }

  const remainingEnemyCount = Math.max(
    0,
    claimableEnemyProvinces.length - demandedIds.length
  );
  const wantVassal =
    Boolean(request.demandVassal || request.vassalizeEnemy) && !isFullAnnex;
  const vassalCost =
    wantVassal && remainingEnemyCount > 0
      ? remainingEnemyCount <= 3
        ? 35
        : 45
      : 0;
  const tributeCost = request.demandTribute ? 20 : 0;
  const reparationsCost = request.demandReparations ? 15 : 0;

  const totalCost =
    territoryPointCost + vassalCost + tributeCost + reparationsCost;

  if (totalCost <= 0) {
    sound.playClick();
    return {
      toast: '🛑 Lütfen barış konferansında en az bir şehir veya antlaşma şartı seçin.',
    };
  }

  if (totalCost > availableBudget) {
    sound.playClick();
    return {
      toast: `🛑 Barış Puanı Bütçesi Aşıldı! Seçilen talepler ${totalCost} Puan tutuyor ancak mevcut bütçeniz ${availableBudget} Puan.`,
    };
  }

  sound.playTreaty();

  const demandedSet = new Set(demandedIds);

  // Transfer demanded provinces (strictly belonging to primary enemy `enemyNationId`) to player
  for (const id of demandedIds) {
    const t = nextTerritories[id];
    if (!t) continue;
    const isCore = t.coreOwnerId === playerNationId;
    nextTerritories[id] = {
      ...t,
      ownerId: playerNationId,
      isCapital: false,
      isOccupied: false,
      occupiedById: undefined,
      occupiedFromId: undefined,
      siege: null,
      assimilation: isCore ? 100 : 25,
      isAssimilating: false,
      unrest: isCore ? Math.max(0, t.unrest - 10) : Math.min(75, t.unrest + 18),
    };
  }

  // Restore ALL un-demanded primary enemy provinces AND ALL secondary-ally provinces (plus any enemy-occupied player provinces),
  // evacuating occupying troops safely back to their home nation!
  settleRemainingWarOccupationsAndSieges(
    nextTerritories,
    nextNations,
    playerSideIds,
    enemySideIds,
    demandedSet
  );

  const stillOwnedByEnemy = Object.values(nextTerritories).filter(
    (t) => t && t.ownerId === enemyNationId
  );
  const fullAnnexationAchieved = stillOwnedByEnemy.length === 0;

  if (fullAnnexationAchieved) {
    nextNations[enemyNationId] = {
      ...nextNations[enemyNationId],
      isEliminated: true,
    };
  } else if (
    nextTerritories[enemy.capitalTerritoryId]?.ownerId !== enemyNationId
  ) {
    const newCap = stillOwnedByEnemy[0];
    if (newCap) {
      nextNations[enemyNationId] = {
        ...nextNations[enemyNationId],
        isEliminated: false,
        capitalTerritoryId: newCap.id,
      };
      nextTerritories[newCap.id] = {
        ...newCap,
        isCapital: true,
      };
    }
  }

  let updatedPlayer = { ...nextNations[playerNationId] };
  let updatedEnemy = { ...nextNations[enemyNationId] };
  const clauseLabels: string[] = [];

  if (demandedIds.length > 0) {
    clauseLabels.push(
      fullAnnexationAchieved
        ? `Komple İlhak (${demandedIds.length} Şehir)`
        : `${demandedIds.length} Şehir İlhakı`
    );
  }

  if (wantVassal && !fullAnnexationAchieved) {
    updatedEnemy = {
      ...updatedEnemy,
      vassalOf: playerNationId,
    };
    clauseLabels.push('Vasallaştırma');
  }

  if (request.demandTribute) {
    const tributeGold = Math.min(
      650,
      Math.max(250, Math.round((updatedEnemy.treasury || 500) * 0.3))
    );
    updatedPlayer = {
      ...updatedPlayer,
      treasury: updatedPlayer.treasury + tributeGold,
    };
    updatedEnemy = {
      ...updatedEnemy,
      treasury: Math.max(0, updatedEnemy.treasury - tributeGold),
      vassalOf:
        !fullAnnexationAchieved && !updatedEnemy.vassalOf
          ? playerNationId
          : updatedEnemy.vassalOf,
    };
    clauseLabels.push(`Haraç (+${tributeGold} Altın)`);
  }

  if (request.demandReparations) {
    const repGold = Math.min(
      1100,
      Math.max(350, Math.round((updatedEnemy.treasury || 650) * 0.45))
    );
    updatedPlayer = {
      ...updatedPlayer,
      treasury: updatedPlayer.treasury + repGold,
    };
    updatedEnemy = {
      ...updatedEnemy,
      treasury: Math.max(0, updatedEnemy.treasury - repGold),
    };
    clauseLabels.push(`Tazminat (+${repGold} Altın)`);
  }

  const aeCalc = calculateProjectedPeaceAE({
    territories: nextTerritories,
    demandedTerritoryIds: demandedIds,
    isFullAnnex: fullAnnexationAchieved,
    demandVassal: wantVassal,
    conquerorNation: updatedPlayer,
  });
  if (aeCalc.adjustedGain > 0) {
    updatedPlayer = {
      ...updatedPlayer,
      aggressiveExpansion: aeCalc.projectedTotal,
    };
  }

  nextNations[playerNationId] = updatedPlayer;
  nextNations[enemyNationId] = updatedEnemy;

  if (demandedIds.length > 0 || wantVassal) {
    const penaltyRes = applyConquestDiplomaticPenalty({
      conquerorId: playerNationId,
      victimId: enemyNationId,
      provincesTakenCount: Math.max(1, demandedIds.length),
      isFullAnnexation: fullAnnexationAchieved,
      nations: nextNations,
      relations: workingRelations,
    });
    workingRelations = penaltyRes.updatedRelations;
  }

  applyCoalitionTruces(workingRelations, playerSideIds, enemySideIds, tick + 120);

  const summaryStr = clauseLabels.join(', ');
  nextNews = prependNews(
    newsEvents,
    tick,
    gameMode,
    `📜 ${war.name} Barış Konferansı`,
    `${playerNation.name} ile ${enemy.name} arasında barış antlaşması imzalandı: ${summaryStr}${aeCalc.adjustedGain > 0 ? ` (+${aeCalc.adjustedGain} Agresiflik)` : ''}.`,
    'PEACE'
  );

  const remainingWars = wars.filter((w) => w.id !== war.id);
  const { nextMovements, nextBattles } = cancelPostPeaceHostileOperations(
    nextTerritories,
    playerSideIds,
    enemySideIds,
    remainingWars,
    movements,
    battles
  );

  const coalitionRes = evaluateWorldCoalitionAt100AE({
    targetNationId: playerNationId,
    nations: nextNations,
    territories: nextTerritories,
    relations: workingRelations,
    wars: remainingWars,
    tick,
    gameMode,
    newsEvents: nextNews,
    playerNationId,
  });

  const baseToast = `📜 ${enemy.name} ile Barış İmzalandı: ${summaryStr}${aeCalc.adjustedGain > 0 ? ` (+${aeCalc.adjustedGain} Agresiflik)` : ''}`;

  return {
    nations: nextNations,
    territories: nextTerritories,
    relations: coalitionRes.relations,
    wars: coalitionRes.wars,
    ...(nextMovements ? { movements: nextMovements } : {}),
    ...(nextBattles ? { battles: nextBattles } : {}),
    newsEvents: coalitionRes.newsEvents,
    ...(coalitionRes.warAnnouncement
      ? { warAnnouncement: coalitionRes.warAnnouncement }
      : {}),
    toast:
      coalitionRes.triggered && coalitionRes.toast
        ? `${baseToast} · ${coalitionRes.toast}`
        : baseToast,
  };
}
