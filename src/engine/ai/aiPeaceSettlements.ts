import {
  ActiveWar,
  DiplomaticRelation,
  Nation,
  Territory,
} from '../../types/game';
import {
  applyConquestDiplomaticPenalty,
  calculateProjectedPeaceAE,
} from '../core/diplomacyHelpers';
import { resolveNationAiPersonality } from '../seasonSupplyAndAiProfile';
import { getOrCreateRelation } from '../simulationEngine';
import { relationKey } from '../worldBuilder';
import { AiTurnResult } from './aiSharedUtils';

/**
 * Step 0: Evaluates AI-vs-AI peace settlements (decisive AE-aware annexations
 * and exhausted White Peace restoration) so AI wars conclude logically instead of freezing forever.
 */
export function evaluateAiVsAiPeaceSettlement(params: {
  actorId: string;
  playerNationId: string;
  nextTick: number;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
}): AiTurnResult | null {
  const {
    actorId,
    playerNationId,
    nextTick,
    nations,
    territories,
    relations,
    wars,
  } = params;

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

  if (!aiOnlyWar) return null;

  const warDuration = nextTick - aiOnlyWar.startedTick;
  const absScore = Math.abs(aiOnlyWar.attackerWarScore);
  const isDecisive =
    (warDuration >= 40 && absScore >= 45) ||
    (warDuration >= 95 && absScore >= 25);
  const isExhaustedStalemate = warDuration >= 130 && absScore < 25;

  if (!isDecisive && !isExhaustedStalemate) return null;

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
    const winner = aiOnlyWar.attackerWarScore >= 0 ? attNation : defNation;
    const loser = aiOnlyWar.attackerWarScore >= 0 ? defNation : attNation;
    const indemnity = Math.min(
      Math.max(120, Math.round(loser.treasury * 0.35)),
      650
    );

    // Smart AE-aware peace demands: stays under 95 AE except rare reckless CONQUEROR AI (~15%)
    let peaceTerritories: Record<string, Territory> | undefined;
    const demandedIds: string[] = [];
    const winnerPersonality = resolveNationAiPersonality(winner, territories);
    const recklessOverreach =
      winnerPersonality === 'CONQUEROR' &&
      (nextTick + winner.id.charCodeAt(0)) % 7 === 0;
    const maxDesiredAE = recklessOverreach ? 105 : 94;

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
        if (
          aeTrial.projectedTotal <= maxDesiredAE ||
          (demandedIds.length === 0 && recklessOverreach)
        ) {
          demandedIds.push(cand.id);
        } else {
          break;
        }
      }
    }

    const demandedSet = new Set(demandedIds);
    const isFullAnnex =
      uniqueCandidates.length > 0 &&
      demandedIds.length >= uniqueCandidates.length;
    const workingTerrs: Record<string, Territory> = { ...territories };
    let terrsChanged = false;

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

    const attSideIds = new Set<string>([
      aiOnlyWar.attackerId,
      ...aiOnlyWar.attackers,
    ]);
    const defSideIds = new Set<string>([
      aiOnlyWar.defenderId,
      ...aiOnlyWar.defenders,
    ]);
    const allWarSideIds = new Set<string>([...attSideIds, ...defSideIds]);
    for (const [tId, prov] of Object.entries(workingTerrs)) {
      if (!prov || demandedSet.has(tId)) continue;
      const isOccupiedBetweenSides =
        prov.isOccupied &&
        prov.coreOwnerId &&
        allWarSideIds.has(prov.ownerId) &&
        allWarSideIds.has(prov.coreOwnerId);
      const hasWarSiege =
        prov.siege &&
        allWarSideIds.has(prov.ownerId) &&
        allWarSideIds.has(prov.siege.attackerId);
      if (isOccupiedBetweenSides) {
        workingTerrs[tId] = {
          ...prov,
          ownerId: prov.coreOwnerId,
          isOccupied: false,
          occupiedById: undefined,
          siege: undefined,
        };
        terrsChanged = true;
      } else if (hasWarSiege) {
        workingTerrs[tId] = {
          ...prov,
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
      ...nations,
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
    // White Peace (Statüko Barışı): restore all occupied territories and clear active sieges between war sides
    const attSideIds = new Set<string>([
      aiOnlyWar.attackerId,
      ...aiOnlyWar.attackers,
    ]);
    const defSideIds = new Set<string>([
      aiOnlyWar.defenderId,
      ...aiOnlyWar.defenders,
    ]);
    const allWarSideIds = new Set<string>([...attSideIds, ...defSideIds]);
    let whitePeaceTerrs: Record<string, Territory> | undefined;
    for (const [tId, prov] of Object.entries(territories)) {
      if (!prov) continue;
      const occupiedByWarSide =
        prov.isOccupied &&
        prov.coreOwnerId &&
        allWarSideIds.has(prov.ownerId) &&
        allWarSideIds.has(prov.coreOwnerId);
      const siegeByWarSide =
        prov.siege &&
        allWarSideIds.has(prov.ownerId) &&
        allWarSideIds.has(prov.siege.attackerId);
      if (occupiedByWarSide || siegeByWarSide) {
        if (!whitePeaceTerrs) whitePeaceTerrs = { ...territories };
        whitePeaceTerrs[tId] = {
          ...prov,
          ownerId: occupiedByWarSide ? prov.coreOwnerId : prov.ownerId,
          isOccupied: false,
          occupiedById: undefined,
          siege: undefined,
        };
      }
    }
    return {
      updatedTerritories: whitePeaceTerrs,
      updatedWars: nextWars,
      updatedRelations: nextRelations,
      newsItem: {
        title: `🕊️ Statüko Barışı: ${attNation.name} - ${defNation.name}`,
        description: `Uzun süren yıpratma harbinin ardından ${attNation.name} ve ${defNation.name} sınırları koruyarak ateşkes imzaladı.`,
        type: 'PEACE',
      },
    };
  }

  return null;
}
