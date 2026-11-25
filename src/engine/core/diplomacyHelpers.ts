import {
  ActiveWar,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  WarAnnouncement,
  WorldNewsEvent,
} from '../../types/game';

export const WAR_DECLARATION_BASE_AE = 8;

function getTechAeFactor(nation?: Pick<Nation, 'unlockedTechs'> | null): number {
  const techs = nation?.unlockedTechs || [];
  let factor = 1.0;
  if (techs.includes('adm_2')) factor *= 0.75;
  if (techs.includes('adm_2b')) factor *= 0.9;
  if (techs.includes('adm_6b')) factor *= 0.85;
  if (techs.includes('adm_8')) factor *= 0.85;
  return factor;
}

export interface ProjectedPeaceAEResult {
  rawGain: number;
  adjustedGain: number;
  currentAE: number;
  projectedTotal: number;
  triggersCoalition: boolean;
}

/**
 * Computes aggressive expansion gained from peace treaty demands based on province count,
 * economic value (baseGdp), full annexation, and vassalization.
 * Calibrated so annexing a small 1-3 province minor stays well below 100 AE, while
 * full-annexing a major power (e.g. Ottoman full-annexing Mamluks' 33 provinces) hits 100 AE.
 */
export function calculateProjectedPeaceAE(params: {
  territories: Record<string, Territory>;
  demandedTerritoryIds: string[];
  isFullAnnex: boolean;
  demandVassal?: boolean;
  conquerorNation?: Pick<Nation, 'aggressiveExpansion' | 'unlockedTechs'> | null;
}): ProjectedPeaceAEResult {
  const {
    territories,
    demandedTerritoryIds,
    isFullAnnex,
    demandVassal = false,
    conquerorNation,
  } = params;

  let totalGdp = 0;
  for (const id of demandedTerritoryIds) {
    const t = territories[id];
    if (t) {
      totalGdp += Math.max(15, t.baseGdp || 40);
    }
  }
  const count = demandedTerritoryIds.length;
  const fullAnnexBonus =
    isFullAnnex && count > 0 ? Math.min(18, 4 + count * 0.45) : 0;
  const vassalBonus = demandVassal && !isFullAnnex ? 14 : 0;
  const rawGain = Number(
    (count * 2.1 + totalGdp / 55 + fullAnnexBonus + vassalBonus).toFixed(1)
  );
  const adjustedGain = Number(
    (rawGain * getTechAeFactor(conquerorNation)).toFixed(1)
  );
  const currentAE = Number((conquerorNation?.aggressiveExpansion || 0).toFixed(1));
  const projectedTotal = Math.min(100, Number((currentAE + adjustedGain).toFixed(1)));

  return {
    rawGain,
    adjustedGain,
    currentAE,
    projectedTotal,
    triggersCoalition: projectedTotal >= 100,
  };
}

export interface WorldCoalitionCheckResult {
  triggered: boolean;
  wars: ActiveWar[];
  relations: Record<string, DiplomaticRelation>;
  newsEvents: WorldNewsEvent[];
  coalitionMembers: string[];
  warAnnouncement?: WarAnnouncement;
  toast?: string;
}

/**
 * When any nation (player or AI) reaches 100 Aggressive Expansion (Agresiflik),
 * all independent living nations across the world unite in a World Coalition War against them.
 */
export function evaluateWorldCoalitionAt100AE(params: {
  targetNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  tick: number;
  gameMode: GameModeId;
  newsEvents: WorldNewsEvent[];
  playerNationId: string;
}): WorldCoalitionCheckResult {
  const {
    targetNationId,
    nations,
    territories,
    relations,
    wars,
    tick,
    gameMode,
    newsEvents,
    playerNationId,
  } = params;

  const target = nations[targetNationId];
  if (!target || target.isEliminated || (target.aggressiveExpansion || 0) < 100) {
    return {
      triggered: false,
      wars,
      relations,
      newsEvents,
      coalitionMembers: [],
    };
  }

  const ownedCountByNation = new Map<string, number>();
  for (const t of Object.values(territories)) {
    if (t?.ownerId) {
      ownedCountByNation.set(t.ownerId, (ownedCountByNation.get(t.ownerId) || 0) + 1);
    }
  }
  if ((ownedCountByNation.get(targetNationId) || 0) === 0) {
    return {
      triggered: false,
      wars,
      relations,
      newsEvents,
      coalitionMembers: [],
    };
  }

  const targetDefenders = new Set<string>([targetNationId]);
  const eligibleCoalition: string[] = [];

  for (const n of Object.values(nations)) {
    if (!n || n.isEliminated || n.id === targetNationId) continue;
    if ((ownedCountByNation.get(n.id) || 0) === 0) continue;

    if (n.vassalOf === targetNationId) {
      targetDefenders.add(n.id);
      continue;
    }

    const rel = getOrCreateRelation(relations, targetNationId, n.id);
    if (rel.isAllied || rel.allianceType) {
      targetDefenders.add(n.id);
      continue;
    }

    eligibleCoalition.push(n.id);
  }

  if (eligibleCoalition.length === 0) {
    return {
      triggered: false,
      wars,
      relations,
      newsEvents,
      coalitionMembers: [],
    };
  }

  // Sort coalition leaders by province count descending so the strongest world power leads the coalition
  eligibleCoalition.sort(
    (a, b) => (ownedCountByNation.get(b) || 0) - (ownedCountByNation.get(a) || 0)
  );

  const existingCoalitionWarIdx = wars.findIndex(
    (w) =>
      w.isCoalitionWar &&
      (w.defenderId === targetNationId || w.defenders.includes(targetNationId))
  );

  let nextWars = [...wars];
  let newlyJoined: string[] = [];
  let activeCoalitionWar: ActiveWar;

  if (existingCoalitionWarIdx >= 0) {
    const existing = wars[existingCoalitionWarIdx];
    const existingAttSet = new Set(existing.attackers);
    newlyJoined = eligibleCoalition.filter((id) => !existingAttSet.has(id));
    if (newlyJoined.length === 0) {
      return {
        triggered: false,
        wars,
        relations,
        newsEvents,
        coalitionMembers: existing.attackers,
      };
    }
    activeCoalitionWar = {
      ...existing,
      attackers: Array.from(new Set([...existing.attackers, ...newlyJoined])),
      defenders: Array.from(new Set([...existing.defenders, ...targetDefenders])),
    };
    nextWars[existingCoalitionWarIdx] = activeCoalitionWar;
  } else {
    newlyJoined = eligibleCoalition;
    const leaderId = eligibleCoalition[0];
    activeCoalitionWar = {
      id: `war_coalition_${targetNationId}_${tick}`,
      name: `Dünya Koalisyonu — ${target.name} Seferi`,
      attackerId: leaderId,
      defenderId: targetNationId,
      attackers: eligibleCoalition,
      defenders: Array.from(targetDefenders),
      startedTick: tick,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
      isCoalitionWar: true,
    };
    nextWars.push(activeCoalitionWar);
  }

  const nextRelations: Record<string, DiplomaticRelation> = { ...relations };
  for (const memberId of newlyJoined) {
    const k = relationKey(memberId, targetNationId);
    const cur = getOrCreateRelation(nextRelations, memberId, targetNationId);
    nextRelations[k] = {
      ...cur,
      score: -100,
      isAllied: false,
      allianceType: null,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    };
  }

  const leader = nations[activeCoalitionWar.attackerId];
  const startYear = gameMode === 'EMPIRES_1440' ? 1440 : 2026;
  const dateObj = new Date(Date.UTC(startYear, 0, 1));
  dateObj.setUTCDate(dateObj.getUTCDate() + Math.max(0, Math.floor(tick)));
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const dateStr = `${dateObj.getUTCDate()} ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCFullYear()}`;

  const coalitionNews: WorldNewsEvent = {
    id: `news_coalition_${targetNationId}_${tick}_${Math.random().toString(36).slice(2, 6)}`,
    tick,
    dateStr,
    title: `🔥 DÜNYA KOALİSYONU SAVAŞI: ${target.name} Hedef Alındı!`,
    description: `${target.name} agresifliği 100 seviyesine ulaştı! ${leader?.name || 'Büyük Güçler'} öncülüğündeki ${activeCoalitionWar.attackers.length} devlet, dünya düzenini korumak için topluca savaş ilan etti!`,
    type: 'WAR',
  };

  const nextNews = [coalitionNews, ...newsEvents.slice(0, 39)];
  const involvesPlayer =
    targetNationId === playerNationId ||
    activeCoalitionWar.attackers.includes(playerNationId) ||
    activeCoalitionWar.defenders.includes(playerNationId);

  const warAnnouncement: WarAnnouncement | undefined = involvesPlayer
    ? {
        id: activeCoalitionWar.id,
        warId: activeCoalitionWar.id,
        warName: activeCoalitionWar.name,
        attackerId: activeCoalitionWar.attackerId,
        attackerName: `Dünya Koalisyonu (${activeCoalitionWar.attackers.length} Devlet)`,
        attackerFlagCode: leader?.flagCode || 'UN',
        attackerColor: '#DC2626',
        defenderId: targetNationId,
        defenderName: target.name,
        defenderFlagCode: target.flagCode,
        defenderColor: target.color,
        isPlayerAttacker: activeCoalitionWar.attackers.includes(playerNationId),
        isPlayerDefender:
          targetNationId === playerNationId ||
          activeCoalitionWar.defenders.includes(playerNationId),
        alliesJoinedNames: activeCoalitionWar.attackers
          .slice(0, 6)
          .map((id) => nations[id]?.name || '')
          .filter(Boolean),
        createdAtMs: Date.now(),
      }
    : undefined;

  const toast =
    targetNationId === playerNationId
      ? `🔥 AGRESİFLİK 100! ${activeCoalitionWar.attackers.length} devletten oluşan Dünya Koalisyonu size savaş ilan etti!`
      : `🔥 ${target.name} agresifliği 100'e ulaştı — ${activeCoalitionWar.attackers.length} devletlik Dünya Koalisyonu savaş açtı!`;

  return {
    triggered: true,
    wars: nextWars,
    relations: nextRelations,
    newsEvents: nextNews,
    coalitionMembers: activeCoalitionWar.attackers,
    warAnnouncement,
    toast,
  };
}

export function relationKey(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

type EmbargoRelation = Pick<
  DiplomaticRelation,
  'nationA' | 'nationB' | 'hasEmbargo' | 'embargoingNationIds'
>;

export function getEmbargoingNationIds(
  relation: EmbargoRelation
): string[] {
  if (Array.isArray(relation.embargoingNationIds)) {
    return Array.from(
      new Set(
        relation.embargoingNationIds.filter(
          (nationId) =>
            nationId === relation.nationA || nationId === relation.nationB
        )
      )
    );
  }
  return relation.hasEmbargo ? [relation.nationA] : [];
}

export function isNationEmbargoing(
  relation: EmbargoRelation,
  nationId: string
): boolean {
  return getEmbargoingNationIds(relation).includes(nationId);
}

export function isNationEmbargoed(
  relation: EmbargoRelation,
  targetNationId: string
): boolean {
  const embargoingNationId =
    targetNationId === relation.nationA
      ? relation.nationB
      : targetNationId === relation.nationB
        ? relation.nationA
        : null;

  return embargoingNationId
    ? isNationEmbargoing(relation, embargoingNationId)
    : false;
}

export function getOrCreateRelation(
  relations: Record<string, DiplomaticRelation>,
  a: string,
  b: string
): DiplomaticRelation {
  const key = relationKey(a, b);
  if (relations[key]) {
    return relations[key];
  }
  return {
    nationA: a < b ? a : b,
    nationB: a < b ? b : a,
    score: 0,
    isAllied: false,
    allianceType: null,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: false,
    embargoingNationIds: [],
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  };
}

export function isAtWar(
  wars: ActiveWar[],
  nationA: string,
  nationB: string
): ActiveWar | undefined {
  return wars.find(
    (w) =>
      (w.attackers.includes(nationA) && w.defenders.includes(nationB)) ||
      (w.attackers.includes(nationB) && w.defenders.includes(nationA))
  );
}

export function applyConquestDiplomaticPenalty(params: {
  conquerorId: string;
  victimId: string;
  provincesTakenCount: number;
  isFullAnnexation: boolean;
  nations: Record<string, Nation>;
  relations: Record<string, DiplomaticRelation>;
}): {
  updatedRelations: Record<string, DiplomaticRelation>;
  affectedNames: string[];
} {
  const {
    conquerorId,
    victimId,
    provincesTakenCount,
    isFullAnnexation,
    nations,
    relations,
  } = params;
  const victim = nations[victimId];
  if (!victim) return { updatedRelations: relations, affectedNames: [] };

  const updatedRelations: Record<string, DiplomaticRelation> = { ...relations };
  const affectedNames: string[] = [];
  const scale = isFullAnnexation
    ? 1.25
    : Math.min(1.3, 0.75 + Math.max(1, provincesTakenCount) * 0.15);

  for (const third of Object.values(nations)) {
    if (
      !third ||
      third.isEliminated ||
      third.id === conquerorId ||
      third.id === victimId
    ) {
      continue;
    }

    const relWithVictim = getOrCreateRelation(updatedRelations, third.id, victimId);
    const isAllyOfVictim = Boolean(
      relWithVictim.isAllied || relWithVictim.allianceType
    );
    const isFriendOrPartner =
      relWithVictim.hasTradeAgreement ||
      relWithVictim.hasNonAggression ||
      relWithVictim.score >= 25;
    const isSameCultureOrReligion =
      Boolean(
        victim.stateReligion && third.stateReligion === victim.stateReligion
      ) ||
      Boolean(
        victim.primaryCulture && third.primaryCulture === victim.primaryCulture
      );

    let penalty = 0;
    if (isAllyOfVictim) {
      penalty = Math.round(35 * scale);
    } else if (isFriendOrPartner) {
      penalty = Math.round(20 * scale);
    } else if (isSameCultureOrReligion) {
      penalty = Math.round(12 * scale);
    }

    if (penalty <= 0) continue;

    const key = relationKey(conquerorId, third.id);
    const curRel = getOrCreateRelation(updatedRelations, conquerorId, third.id);
    updatedRelations[key] = {
      ...curRel,
      score: Math.max(-100, curRel.score - penalty),
    };
    if (isAllyOfVictim || isFriendOrPartner) {
      affectedNames.push(`${third.name} (-${penalty})`);
    }
  }

  return { updatedRelations, affectedNames };
}
