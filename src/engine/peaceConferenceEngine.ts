import {
  ActiveWar,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  WorldNewsEvent,
} from '../types/game';
import { formatGameDate } from './simulationEngine';
import { relationKey } from './worldBuilder';
import { sound } from '../utils/soundEngine';

export interface PeaceConferenceProvinceItem {
  id: string;
  name: string;
  baseGdp: number;
  garrison: number;
  isCapital: boolean;
  isOccupiedByPlayer: boolean;
  starCost: number;
  resource: string;
}

export interface CustomPeaceDealProposal {
  warId: string;
  demandedTerritoryIds: string[];
  demandVassal: boolean;
  demandReparations: boolean;
  demandDisarm: boolean;
  isWhitePeace?: boolean;
}

export interface PeaceConferenceBudget {
  playerWarScore: number;
  totalStars: number;
  spentStars: number;
  remainingStars: number;
  acceptanceChance: number;
  isFullyOccupied: boolean;
  occupiedCount: number;
  totalEnemyProvinces: number;
}

export const TREATY_STAR_COSTS = {
  REPARATIONS: 15,
  VASSALIZE: 55,
  DISARM: 20,
} as const;

/**
 * Calculates the Star Cost of an enemy province in AoH3 peace negotiations.
 * Strategic capitals, rich trade hubs, and high-GDP provinces cost more stars.
 * Provinces physically occupied on the map get a -35% war effort discount!
 */
export function calculateProvinceStarCost(
  t: Territory,
  isOccupiedByPlayer: boolean
): number {
  let base = 12 + Math.round((t.baseGdp || 100) * 0.08);
  if (t.isCapital) base += 22;
  if (t.resource === 'TICARET_BOGAZI' || t.resource === 'PETROL') base += 10;
  if (t.buildings?.fortress && t.buildings.fortress > 0) base += t.buildings.fortress * 4;

  if (isOccupiedByPlayer) {
    // 35% discount for already captured and garrisoned territory
    return Math.max(6, Math.round(base * 0.65));
  }

  return Math.max(10, Math.round(base));
}

/**
 * Evaluates the full Peace Conference budget and AI acceptance chance.
 */
export function evaluatePeaceConferenceBudget(params: {
  war: ActiveWar;
  playerNationId: string;
  enemyNationId: string;
  territories: Record<string, Territory>;
  proposal: CustomPeaceDealProposal;
}): PeaceConferenceBudget {
  const { war, playerNationId, enemyNationId, territories, proposal } = params;

  const isPlayerAttackerSide = war.attackers.includes(playerNationId);
  const warScoreVal =
    typeof war.attackerWarScore === 'number'
      ? war.attackerWarScore
      : ((war as unknown as { warScore?: number }).warScore ?? 0);
  const rawScore = isPlayerAttackerSide ? warScoreVal : -warScoreVal;

  const enemyTerrs = Object.values(territories).filter(
    (t) => t && t.ownerId === enemyNationId
  );
  const occupiedTerrs = Object.values(territories).filter(
    (t) =>
      t &&
      t.ownerId === playerNationId &&
      t.isOccupied &&
      t.occupiedById === playerNationId &&
      (t.coreOwnerId === enemyNationId || enemyTerrs.some((et) => et.id === t.id))
  );

  const totalEnemyProvinces = enemyTerrs.length + occupiedTerrs.length;
  const occupiedCount = occupiedTerrs.length;
  const isFullyOccupied = totalEnemyProvinces > 0 && occupiedCount >= totalEnemyProvinces;

  // Base stars from war score (0 to 100)
  let totalStars = Math.max(0, Math.round(rawScore));
  if (isFullyOccupied) {
    // 100% Total Conquest grants max stars
    totalStars = Math.max(100, totalStars + 25);
  } else if (occupiedCount > 0) {
    totalStars += Math.min(30, occupiedCount * 6);
  }

  // Calculate spent stars based on selected proposal
  let spentStars = 0;
  proposal.demandedTerritoryIds.forEach((tId) => {
    const t = territories[tId];
    if (t) {
      const isOcc = Boolean(
        t.ownerId === playerNationId && t.isOccupied && t.occupiedById === playerNationId
      );
      spentStars += calculateProvinceStarCost(t, isOcc);
    }
  });

  if (proposal.demandReparations) spentStars += TREATY_STAR_COSTS.REPARATIONS;
  if (proposal.demandVassal) spentStars += TREATY_STAR_COSTS.VASSALIZE;
  if (proposal.demandDisarm) spentStars += TREATY_STAR_COSTS.DISARM;

  const remainingStars = totalStars - spentStars;

  // Acceptance chance
  let acceptanceChance = 100;
  if (proposal.isWhitePeace) {
    acceptanceChance = rawScore >= -25 ? 100 : Math.max(10, 100 + rawScore * 2);
  } else if (isFullyOccupied) {
    acceptanceChance = 100;
  } else if (remainingStars >= 0) {
    acceptanceChance = 100;
  } else {
    // Deficit: each star over budget reduces acceptance by 6%
    const deficit = Math.abs(remainingStars);
    acceptanceChance = Math.max(0, Math.round(100 - deficit * 6.5));
  }

  return {
    playerWarScore: rawScore,
    totalStars,
    spentStars,
    remainingStars,
    acceptanceChance,
    isFullyOccupied,
    occupiedCount,
    totalEnemyProvinces,
  };
}

export function executeCustomPeaceConferenceDomain(params: {
  proposal: CustomPeaceDealProposal;
  playerNationId: string;
  tick: number;
  gameMode: GameModeId;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  newsEvents: WorldNewsEvent[];
}): {
  nations?: Record<string, Nation>;
  territories?: Record<string, Territory>;
  relations?: Record<string, DiplomaticRelation>;
  wars?: ActiveWar[];
  newsEvents?: WorldNewsEvent[];
  toastMessage?: string;
} {
  const {
    proposal,
    playerNationId,
    tick,
    gameMode,
    nations,
    territories,
    relations,
    wars,
    newsEvents,
  } = params;

  const war = wars.find((w) => w.id === proposal.warId);
  const playerNation = nations[playerNationId];
  if (!war || !playerNation) return {};

  const isPlayerAttackerSide = war.attackers.includes(playerNationId);
  const enemyId = isPlayerAttackerSide ? war.defenderId : war.attackerId;
  const enemy = nations[enemyId];
  if (!enemy) return {};

  const budget = evaluatePeaceConferenceBudget({
    war,
    playerNationId,
    enemyNationId: enemyId,
    territories,
    proposal,
  });

  if (budget.acceptanceChance < 50 && !budget.isFullyOccupied) {
    sound.playClick();
    return {
      toastMessage: `🛑 ${enemy.name} bu antlaşma şartlarını reddetti! (Kabul Şansı: %${budget.acceptanceChance} · Bütçe Aşımı: ${Math.abs(budget.remainingStars)} ⭐)`,
    };
  }

  sound.playTreaty();

  const nextNations: Record<string, Nation> = { ...nations };
  const nextTerritories: Record<string, Territory> = { ...territories };
  const nextRelations: Record<string, DiplomaticRelation> = { ...relations };

  const demandedNames: string[] = [];
  let reparationsGold = 0;

  // 1. Process Territory Transfers
  proposal.demandedTerritoryIds.forEach((tId) => {
    const t = nextTerritories[tId];
    if (t) {
      demandedNames.push(t.name);
      nextTerritories[tId] = {
        ...t,
        ownerId: playerNationId,
        isCapital: false,
        isOccupied: false,
        occupiedById: undefined,
        assimilation: t.coreOwnerId === playerNationId ? 100 : 25,
        unrest: Math.min(75, (t.unrest || 0) + 18),
      };
    }
  });

  // Clear occupation flags on all other territories involved in this war
  Object.values(nextTerritories).forEach((t) => {
    if (
      t.isOccupied &&
      (t.occupiedById === playerNationId || t.occupiedById === enemyId)
    ) {
      if (!proposal.demandedTerritoryIds.includes(t.id)) {
        // Return to original owner if not demanded
        nextTerritories[t.id] = {
          ...t,
          isOccupied: false,
          occupiedById: undefined,
        };
      }
    }
  });

  // 2. Check remaining enemy territories
  const stillOwnedEnemy = Object.values(nextTerritories).filter(
    (t) => t.ownerId === enemyId
  );

  let enemyNationUpdated = { ...enemy };

  if (stillOwnedEnemy.length === 0) {
    // Total Annexation: Enemy eliminated
    enemyNationUpdated = {
      ...enemyNationUpdated,
      isEliminated: true,
      treasury: 0,
      manpower: 0,
    };
  } else if (
    nextTerritories[enemy.capitalTerritoryId]?.ownerId !== enemyId
  ) {
    // Capital was ceded: reassign capital to first remaining province
    const newCap = stillOwnedEnemy[0];
    enemyNationUpdated = {
      ...enemyNationUpdated,
      capitalTerritoryId: newCap.id,
    };
    nextTerritories[newCap.id] = {
      ...newCap,
      isCapital: true,
    };
  }

  // 3. Treaty Options
  let playerNationUpdated = { ...playerNation };

  if (proposal.demandReparations) {
    reparationsGold = Math.max(150, Math.round(enemy.treasury * 0.45));
    enemyNationUpdated.treasury = Math.max(
      0,
      enemyNationUpdated.treasury - reparationsGold
    );
    playerNationUpdated.treasury += reparationsGold;
  }

  if (proposal.demandVassal && !enemyNationUpdated.isEliminated) {
    enemyNationUpdated.vassalOf = playerNationId;
    enemyNationUpdated.stability = Math.max(20, enemyNationUpdated.stability - 25);
  }

  if (proposal.demandDisarm && !enemyNationUpdated.isEliminated) {
    // Disarm: cut standing garrisons by 50%
    stillOwnedEnemy.forEach((t) => {
      const halved = Math.max(500, Math.round(t.garrison * 0.5));
      nextTerritories[t.id] = {
        ...t,
        garrison: halved,
        units: {
          infantry: Math.round((t.units?.infantry || halved) * 0.5),
          armor: Math.round((t.units?.armor || 0) * 0.5),
          airDrone: Math.round((t.units?.airDrone || 0) * 0.5),
        },
      };
    });
  }

  // Aggressive expansion impact based on annexed land
  const aeGained = Math.min(
    35,
    proposal.demandedTerritoryIds.length * 6 + (proposal.demandVassal ? 12 : 0)
  );
  playerNationUpdated.aggressiveExpansion = Math.min(
    100,
    Number((playerNationUpdated.aggressiveExpansion + aeGained).toFixed(2))
  );

  nextNations[enemyId] = enemyNationUpdated;
  nextNations[playerNationId] = playerNationUpdated;

  // 4. Conclude War & Set 120-Day Truce
  const remainingWars = wars.filter((w) => w.id !== proposal.warId);

  const k = relationKey(playerNationId, enemyId);
  const existingRel = relations[k];
  if (existingRel) {
    nextRelations[k] = {
      ...existingRel,
      score: proposal.isWhitePeace
        ? Math.max(-20, existingRel.score + 15)
        : Math.min(-40, existingRel.score - 10),
      truceUntilTick: tick + 120, // 120-day inviolable truce
    };
  }

  // 5. Publish World News Event
  let treatySummary = `${enemy.name} ile Barış Antlaşması imzalandı.`;
  if (proposal.isWhitePeace) {
    treatySummary = `Taraflar mevcut sınırları koruyarak Beyaz Barış (Statüko) üzerinde uzlaştı.`;
  } else {
    const parts: string[] = [];
    if (demandedNames.length > 0) {
      parts.push(`${demandedNames.length} Eyalet (${demandedNames.slice(0, 3).join(', ')}${demandedNames.length > 3 ? '...' : ''}) ilhak edildi`);
    }
    if (proposal.demandVassal) parts.push('Vasal Statüsü kabul ettirildi');
    if (reparationsGold > 0) parts.push(`+${reparationsGold} Altın Harp Tazminatı alındı`);
    if (proposal.demandDisarm) parts.push('Askerden Arındırma uygulandı');
    treatySummary = parts.join(', ');
  }

  const newsItem: WorldNewsEvent = {
    id: `news_${Date.now()}_peace`,
    tick,
    dateStr: formatGameDate(tick, gameMode),
    title: `🕊️ TARİHİ BARIŞ: ${playerNation.name} - ${enemy.name} Antlaşması`,
    description: `${war.name} sona erdi. Kararlar: ${treatySummary}. 120 Günlük Ateşkes ilan edildi.`,
    type: 'PEACE',
  };

  return {
    nations: nextNations,
    territories: nextTerritories,
    relations: nextRelations,
    wars: remainingWars,
    newsEvents: [newsItem, ...newsEvents.slice(0, 39)],
    toastMessage: `🕊️ Barış Antlaşması İmzalandı: ${treatySummary}`,
  };
}
