import {
  ActiveWar,
  DiplomaticRelation,
  GameModeId,
  Nation,
  TacticalBattleState,
  Territory,
  WorldNewsEvent,
} from '../../types/game';
import {
  getOrCreateRelation,
  relationKey,
} from '../core/diplomacyHelpers';
import { adjustAggressiveExpansionGain } from '../simulationEngine';
import { autoResolveTacticalBattle } from '../tacticalBattleEngine';
import { withUpdatedLordLoyalty } from '../pashaAndFiefEngine';
import { sound } from '../../utils/soundEngine';
import {
  DomainActionPatch,
  prependNews,
} from './diplomacyActionHelpers';

export function resolveTacticalBattleOutcomeDomain(params: {
  finalBattle: TacticalBattleState;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    finalBattle,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    wars,
    newsEvents,
  } = params;

  let outcome = finalBattle.outcome;
  if (!outcome) {
    const auto = autoResolveTacticalBattle(
      finalBattle,
      finalBattle.attackerNationId === playerNationId,
      nations[finalBattle.attackerNationId],
      nations[finalBattle.defenderNationId]
    );
    outcome = auto.outcome;
  }
  if (!outcome) return {};

  const winnerId = outcome.winnerId;
  const isAttackerWinner = outcome.territoryConquered;

  const nextTerrs = { ...territories };
  const nextNations = { ...nations };
  const cur = nextTerrs[finalBattle.territoryId];

  if (cur) {
    if (isAttackerWinner) {
      const previousOwnerId = cur.ownerId;
      const coreId =
        cur.isOccupied && cur.occupiedFromId
          ? cur.occupiedFromId
          : cur.coreOwnerId;
      const allyBeneficiary =
        coreId &&
        coreId !== finalBattle.attackerNationId &&
        coreId !== previousOwnerId &&
        nextNations[coreId] &&
        (nextNations[coreId].vassalOf === finalBattle.attackerNationId ||
          nextNations[finalBattle.attackerNationId]?.vassalOf === coreId ||
          wars.some(
            (w) =>
              (w.attackers.includes(finalBattle.attackerNationId) &&
                w.attackers.includes(coreId)) ||
              (w.defenders.includes(finalBattle.attackerNationId) &&
                w.defenders.includes(coreId))
          ))
          ? coreId
          : null;

      if (allyBeneficiary) {
        const allyNation = nextNations[allyBeneficiary];
        const allyWasEliminated = Boolean(allyNation?.isEliminated);
        if (allyNation && allyWasEliminated) {
          nextNations[allyBeneficiary] = {
            ...allyNation,
            isEliminated: false,
            capitalTerritoryId: finalBattle.territoryId,
          };
        }
        nextTerrs[finalBattle.territoryId] = {
          ...cur,
          ownerId: allyBeneficiary,
          isCapital: allyWasEliminated || allyNation?.capitalTerritoryId === finalBattle.territoryId,
          garrison: 1200,
          units: { infantry: 1000, armor: 200, airDrone: 0 },
          unrest: Math.max(0, cur.unrest - 15),
          assimilation: 100,
          isAssimilating: false,
          isOccupied: false,
          occupiedById: undefined,
          occupiedFromId: undefined,
          castleWallHp: finalBattle.castleWallHp,
        };
        const surviving = Math.max(1000, outcome.attackerSurvivingTroops);
        const returnNeighborId = cur.neighbors.find(
          (nId) => nextTerrs[nId]?.ownerId === finalBattle.attackerNationId
        );
        const capId = nextNations[finalBattle.attackerNationId]?.capitalTerritoryId;
        const returnDestId =
          returnNeighborId ||
          (capId && nextTerrs[capId]?.ownerId === finalBattle.attackerNationId ? capId : null);
        if (returnDestId && nextTerrs[returnDestId]) {
          const rd = nextTerrs[returnDestId];
          nextTerrs[returnDestId] = {
            ...rd,
            garrison: rd.garrison + surviving,
            units: {
              infantry: (rd.units?.infantry ?? rd.garrison) + Math.round(surviving * 0.7),
              armor: (rd.units?.armor ?? 0) + Math.round(surviving * 0.2),
              airDrone: (rd.units?.airDrone ?? 0) + Math.round(surviving * 0.1),
            },
          };
        }
      } else {
        const preOccOwnerId =
          cur.isOccupied && cur.occupiedFromId
            ? cur.occupiedFromId
            : previousOwnerId;
        const isCoreForConqueror = cur.coreOwnerId === finalBattle.attackerNationId;
        const isRightfulOwner =
          isCoreForConqueror || preOccOwnerId === finalBattle.attackerNationId;
        nextTerrs[finalBattle.territoryId] = {
          ...cur,
          ownerId: finalBattle.attackerNationId,
          isCapital: false,
          garrison: Math.max(1000, outcome.attackerSurvivingTroops),
          units: {
            infantry: Math.round(outcome.attackerSurvivingTroops * 0.7),
            armor: Math.round(outcome.attackerSurvivingTroops * 0.2),
            airDrone: Math.round(outcome.attackerSurvivingTroops * 0.1),
          },
          unrest: isRightfulOwner ? Math.max(0, cur.unrest - 10) : Math.min(80, cur.unrest + 25),
          assimilation: isCoreForConqueror ? 100 : isRightfulOwner ? Math.max(25, cur.assimilation ?? 50) : 25,
          isAssimilating: false,
          isOccupied: !isRightfulOwner,
          occupiedById: isRightfulOwner ? undefined : finalBattle.attackerNationId,
          occupiedFromId: isRightfulOwner ? undefined : preOccOwnerId,
          castleWallHp: finalBattle.castleWallHp,
        };
      }

      // Check if defender lost its capital or its last territory
      const remainingDefProvs = Object.values(nextTerrs).filter(
        (t) => t && t.ownerId === previousOwnerId
      );
      const prevDefNation = nextNations[previousOwnerId];
      if (prevDefNation) {
        if (remainingDefProvs.length === 0) {
          const stillInActiveWar = wars.some(
            (w) =>
              (w.attackers.includes(finalBattle.attackerNationId) &&
                w.defenders.includes(previousOwnerId)) ||
              (w.defenders.includes(finalBattle.attackerNationId) &&
                w.attackers.includes(previousOwnerId))
          );
          if (!stillInActiveWar) {
            nextNations[previousOwnerId] = {
              ...prevDefNation,
              isEliminated: true,
            };
          }
        } else if (prevDefNation.capitalTerritoryId === finalBattle.territoryId) {
          const newCap = remainingDefProvs[0];
          nextNations[previousOwnerId] = {
            ...prevDefNation,
            capitalTerritoryId: newCap.id,
          };
          nextTerrs[newCap.id] = {
            ...newCap,
            isCapital: true,
          };
        }
      }
    } else {
      nextTerrs[finalBattle.territoryId] = {
        ...cur,
        garrison: Math.max(800, outcome.defenderSurvivingTroops),
        castleWallHp: finalBattle.castleWallHp,
      };

      // Return surviving attacker troops to an adjacent friendly territory (or capital) instead of vanishing
      const retreatTroops = Math.max(0, outcome.attackerSurvivingTroops);
      if (retreatTroops >= 500) {
        const friendlyNeighborId = cur.neighbors.find(
          (nbId) => nextTerrs[nbId]?.ownerId === finalBattle.attackerNationId
        );
        const attackerCapId =
          nextNations[finalBattle.attackerNationId]?.capitalTerritoryId;
        const fallbackFriendlyId = Object.values(nextTerrs).find(
          (t) => t && t.ownerId === finalBattle.attackerNationId
        )?.id;
        const retreatTargetId =
          friendlyNeighborId ||
          (attackerCapId &&
          nextTerrs[attackerCapId]?.ownerId === finalBattle.attackerNationId
            ? attackerCapId
            : fallbackFriendlyId);

        if (retreatTargetId && nextTerrs[retreatTargetId]) {
          const rt = nextTerrs[retreatTargetId];
          nextTerrs[retreatTargetId] = {
            ...rt,
            garrison: rt.garrison + retreatTroops,
            units: {
              infantry:
                (rt.units?.infantry || 0) + Math.round(retreatTroops * 0.7),
              armor: (rt.units?.armor || 0) + Math.round(retreatTroops * 0.2),
              airDrone:
                (rt.units?.airDrone || 0) + Math.round(retreatTroops * 0.1),
            },
          };
        }
      }
    }
  }

  const defenderRemainingCount = Object.values(nextTerrs).filter(
    (t) => t && t.ownerId === finalBattle.defenderNationId
  ).length;

  const nextWars = wars.map((w) => {
    const involvesBoth =
      (w.attackers.includes(finalBattle.attackerNationId) &&
        w.defenders.includes(finalBattle.defenderNationId)) ||
      (w.attackers.includes(finalBattle.defenderNationId) &&
        w.defenders.includes(finalBattle.attackerNationId));
    if (!involvesBoth) return w;
    const isAttackerSide = w.attackers.includes(finalBattle.attackerNationId);
    const isPrimaryWarLeaderDefeated =
      isAttackerWinner &&
      defenderRemainingCount === 0 &&
      (finalBattle.defenderNationId === w.defenderId ||
        finalBattle.defenderNationId === w.attackerId);
    const baseDelta = isPrimaryWarLeaderDefeated
      ? 200
      : isAttackerWinner
      ? 28
      : -28;
    const scoreDelta = baseDelta * (isAttackerSide ? 1 : -1);
    const maxClamp = isPrimaryWarLeaderDefeated ? 100 : 99;
    const minClamp = isPrimaryWarLeaderDefeated ? -100 : -99;

    return {
      ...w,
      attackerWarScore: Math.max(
        minClamp,
        Math.min(maxClamp, w.attackerWarScore + scoreDelta)
      ),
      casualtiesAttacker: w.casualtiesAttacker + outcome!.attackerTotalLosses,
      casualtiesDefender: w.casualtiesDefender + outcome!.defenderTotalLosses,
    };
  });

  if (nextNations[winnerId]) {
    let wNat: Nation = {
      ...nextNations[winnerId],
      researchPoints: Number(
        (nextNations[winnerId].researchPoints + outcome.earnedResearch).toFixed(1)
      ),
      clanInfluence: Math.min(
        999,
        (nextNations[winnerId].clanInfluence ?? 120) + outcome.earnedInfluence
      ),
      aggressiveExpansion: isAttackerWinner
        ? Math.min(
            100,
            nextNations[winnerId].aggressiveExpansion +
              adjustAggressiveExpansionGain(nextNations[winnerId], 6)
          )
        : nextNations[winnerId].aggressiveExpansion,
    };
    if (wNat.activeGeneralId) {
      wNat = withUpdatedLordLoyalty(wNat, wNat.activeGeneralId, 6);
    }
    nextNations[winnerId] = wNat;
  }

  const loserId = outcome.loserId;
  if (nextNations[loserId]?.activeGeneralId) {
    nextNations[loserId] = withUpdatedLordLoyalty(
      nextNations[loserId],
      nextNations[loserId].activeGeneralId!,
      -4
    );
  }

  const winnerNation = nextNations[winnerId];
  let nextNews = newsEvents;
  let toast: string;

  if (winnerId === playerNationId) {
    sound.playVictory();
    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `🏆 ${finalBattle.territoryName} Muharebesi Zaferi`,
      `${winnerNation?.name} orduları ${finalBattle.territoryName} mevkiinde zafer kazandı (+${outcome.earnedResearch} 🔬, +${outcome.earnedInfluence} ⚜).`,
      'WAR'
    );
    toast = `🏆 ${finalBattle.territoryName} muharebesi kazanıldı (+${outcome.earnedResearch} 🔬)`;
  } else {
    sound.playDefeat();
    nextNews = prependNews(
      newsEvents,
      tick,
      gameMode,
      `🛑 ${finalBattle.territoryName} Cephesinde Ricat`,
      `${finalBattle.territoryName} muharebesi kaybedildi, birlikler sınır hattına çekildi.`,
      'WAR'
    );
    toast = `🛑 ${finalBattle.territoryName} muharebesi kaybedildi`;
  }

  return {
    territories: nextTerrs,
    wars: nextWars,
    nations: nextNations,
    newsEvents: nextNews,
    toast,
  };
}

export function callAllyToWarDomain(params: {
  warId: string;
  allyNationId: string;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): DomainActionPatch {
  const {
    warId,
    allyNationId,
    playerNationId,
    tick,
    gameMode,
    nations,
    relations,
    wars,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === warId);
  const playerNation = nations[playerNationId];
  const ally = nations[allyNationId];
  if (!war || !playerNation || !ally || ally.isEliminated) return {};

  const isPlayerAttacker =
    war.attackerId === playerNationId || war.attackers.includes(playerNationId);
  const ourSide = isPlayerAttacker ? war.attackers : war.defenders;
  const enemySide = isPlayerAttacker ? war.defenders : war.attackers;

  if (ourSide.includes(allyNationId) || enemySide.includes(allyNationId)) {
    return {
      toast: `${ally.name} zaten bu savaşta yer alıyor.`,
    };
  }

  const rel = getOrCreateRelation(relations, playerNationId, allyNationId);
  const isAlliedOrVassal =
    rel.isAllied ||
    Boolean(rel.allianceType) ||
    ally.vassalOf === playerNationId;
  if (!isAlliedOrVassal) {
    return {
      toast: `🛑 ${ally.name} ile aktif bir ittifak veya paktınız bulunmuyor.`,
    };
  }

  sound.playWarHorn();

  const nextWars = wars.map((w) => {
    if (w.id !== warId) return w;
    return isPlayerAttacker
      ? { ...w, attackers: [...w.attackers, allyNationId] }
      : { ...w, defenders: [...w.defenders, allyNationId] };
  });

  const enemyLeadId = isPlayerAttacker ? war.defenderId : war.attackerId;
  const enemyLead = nations[enemyLeadId];
  const nextRelations = { ...relations };
  for (const enemyId of enemySide) {
    const k = relationKey(allyNationId, enemyId);
    const curRel = getOrCreateRelation(nextRelations, allyNationId, enemyId);
    nextRelations[k] = {
      ...curRel,
      isAllied: false,
      allianceType: null,
      hasNonAggression: false,
      hasTradeAgreement: false,
      score: Math.min(curRel.score, -65),
    };
  }

  const nextNews = prependNews(
    newsEvents,
    tick,
    gameMode,
    `📣 ${ally.name} Savaşa Katıldı`,
    `${ally.name}, müttefiki ${playerNation.name} çağrısına uyarak ${enemyLead?.name || 'karşı koalisyon'} cephesine karşı savaşa girdi.`,
    'WAR'
  );

  return {
    wars: nextWars,
    relations: nextRelations,
    newsEvents: nextNews,
    toast: `📣 Müttefikimiz ${ally.name} savaşa katıldı!`,
  };
}
