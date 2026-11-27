import { PRESET_COUNTRIES_2026 } from '../data/world2026Data';
import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
} from '../types/game';
import { AiAggressivenessLevel } from './gameSettings';
import { resolveNationAiPersonality } from './seasonSupplyAndAiProfile';
import {
  AiTurnResult,
  AllianceCompatibilityResult,
  RebellionCheckResult,
  WartimeAiBatchResult,
  seededHash,
  seededShuffle,
} from './ai/aiSharedUtils';
import { evaluateWartimeAiOperations } from './ai/aiWartimeOperations';
import {
  evaluateAiBorderOffensiveOrBuildup,
  evaluateAiDomesticGovernanceAndBuild,
  evaluateAiTechAndModernization,
} from './ai/aiDomesticAndEconomy';
import {
  computeAllianceCompatibilityScore,
  evaluateAiDiplomacyAndOffers,
  evaluateAiOffensiveWarDeclaration,
} from './ai/aiPeaceAndDiplomacy';
import { evaluateAiVsAiPeaceSettlement } from './ai/aiPeaceSettlements';
import { evaluateWeeklyUnrestAndRebellions } from './ai/rebellionEngine';

export {
  seededHash,
  seededShuffle,
  computeAllianceCompatibilityScore,
  evaluateWartimeAiOperations,
  evaluateWeeklyUnrestAndRebellions,
};

export type {
  AllianceCompatibilityResult,
  AiTurnResult,
  WartimeAiBatchResult,
  RebellionCheckResult,
};

/**
 * Orchestrates a single strategic AI turn for one selected nation:
 * 0) AI-vs-AI peace settlements
 * 1) Tech & national army modernization
 * 2) Domestic governance, assimilation, building investment, or border levy
 * 3-4) Border war offensives & multi-province A* reserve redeployment
 * 4B) Proactive diplomacy, embargoes, and AI-to-player live offers
 * 5) Coalition-aware offensive war declaration
 */
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

  // 0. AI-vs-AI Peace Settlements
  const peaceResult = evaluateAiVsAiPeaceSettlement({
    actorId,
    playerNationId,
    nextTick,
    nations,
    territories,
    relations,
    wars,
  });
  if (peaceResult) return peaceResult;

  // Resolve dynamic AI Personality Profile (CONQUEROR / MERCHANT / DEFENDER / REVANCHIST)
  const actorPersonality = resolveNationAiPersonality(actorNation, territories);
  const actorInAnyWar = wars.some(
    (w) => w.attackers.includes(actorId) || w.defenders.includes(actorId)
  );

  // 1. Tech Progression & Army Modernization
  const techStep = evaluateAiTechAndModernization({
    actorId,
    actorNation,
    nations,
    wars,
    gameMode,
    aiAggressiveness,
    actorPersonality,
  });
  actorNation = techStep.actorNation;
  let updatedNations = techStep.updatedNations;

  // 2. Domestic Governance, Peacetime Economy & Border Levies
  const domesticStep = evaluateAiDomesticGovernanceAndBuild({
    actorId,
    actorNation,
    ownedProvinces,
    nations,
    updatedNations,
    territories,
    relations,
    wars,
    nextTick,
    stepIndex,
    gameMode,
    aiAggressiveness,
    actorPersonality,
    actorInAnyWar,
  });
  actorNation = domesticStep.actorNation;
  updatedNations = domesticStep.updatedNations;
  const updatedTerritories = domesticStep.updatedTerritories;
  const activeTerrs = updatedTerritories || territories;

  // 3 & 4. Border Offensives & Multi-Province Reserve Redeployment
  const maneuverResult = evaluateAiBorderOffensiveOrBuildup({
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
  });
  if (maneuverResult) return maneuverResult;

  // 4B. Proactive AI-to-AI Diplomacy & Live AI-to-Player Offers
  const diploStep = actorInAnyWar
    ? {}
    : evaluateAiDiplomacyAndOffers({
        actorId,
        actorNation,
        playerNationId,
        ownedProvinces,
        activeTerrs,
        nations,
        relations,
        wars,
        movements,
        nextTick,
        stepIndex,
        gameMode,
        actorPersonality,
        hasActiveIncomingOffer,
        worldSeed,
      });

  // 5. Strategic Coalition-Aware War Declaration
  const warDeclResult = evaluateAiOffensiveWarDeclaration({
    actorId,
    actorNation,
    playerNationId,
    ownedProvinces,
    activeTerrs,
    nations,
    updatedNations,
    updatedTerritories,
    relations,
    updatedRelations: diploStep.updatedRelations,
    wars,
    movements,
    nextTick,
    aiAggressiveness,
    actorPersonality,
    actorInAnyWar,
    worldSeed,
  });
  if (warDeclResult) return warDeclResult;

  if (
    updatedNations ||
    updatedTerritories ||
    diploStep.updatedRelations ||
    diploStep.incomingOffer
  ) {
    return {
      updatedNations,
      updatedTerritories,
      updatedRelations: diploStep.updatedRelations,
      incomingOffer: diploStep.incomingOffer,
      newsItem: diploStep.diploNewsItem,
    };
  }

  return null;
}
