import {
  ActiveWar,
  DiplomaticRelation,
  Nation,
} from '../../types/game';

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
