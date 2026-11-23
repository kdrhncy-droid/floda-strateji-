import {
  COMMANDERS,
  IDEOLOGIES,
  RESOURCE_INFO,
  getArmyGenerationInfo,
  getNationModernizedTier,
} from '../data/world2026Data';
import {
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  ResourceType,
  UnitComposition,
} from '../types/game';
import { relationKey } from './worldBuilder';
import { TERRAIN_INFO } from './pashaAndFiefEngine';
import {
  calculateNationTradeAndStraits,
  NationTradeAndStraitsSummary,
} from './straitsAndTradeEngine';

type NationTechState = Pick<Nation, 'unlockedTechs'> | null | undefined;

/** ADM_1 reduces only positive unrest drift in non-core provinces by 30%. */
export function adjustOccupiedUnrestDrift(
  nation: NationTechState,
  baseDrift: number
): number {
  if (baseDrift <= 0 || !nation?.unlockedTechs?.includes('adm_1')) {
    return baseDrift;
  }
  return Number((baseDrift * 0.7).toFixed(2));
}

/** ADM_2 reduces positive aggressive-expansion gains by 25%; losses are unchanged. */
export function adjustAggressiveExpansionGain(
  nation: NationTechState,
  baseGain: number
): number {
  if (baseGain <= 0 || !nation?.unlockedTechs?.includes('adm_2')) {
    return baseGain;
  }
  return Number((baseGain * 0.75).toFixed(2));
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

export interface NationEconomyBreakdown {
  territoryCount: number;
  totalPopulation: number;
  totalGarrison: number;
  totalUnits: UnitComposition;
  taxIncome: number;
  productionIncome: number;
  tradeIncome: number;
  straitTollIncome: number;
  caravanTradeIncome: number;
  seizedBlockadeIncome: number;
  blockadePenaltyLoss: number;
  tradeDetails: NationTradeAndStraitsSummary;
  vassalIncome: number;
  vassalTributeOut: number;
  militaryUpkeep: number;
  inflationPenalty: number;
  inflationRelief: number;
  netDailyGold: number;
  dailyResearch: number;
  dailyManpower: number;
}

type ResourceEconomicEffect = {
  taxPct?: number;
  productionPct?: number;
  tradePct?: number;
  researchFlat?: number;
  manpowerPct?: number;
  militaryUpkeepReductionPct?: number;
};

// AOH3-style resource identity: owning a source of a resource gives
// one national specialization bonus. Local resource value scales strongly with province buildings & tech investment.
const RESOURCE_ECONOMIC_EFFECTS: Partial<
  Record<ResourceType, ResourceEconomicEffect>
> = {
  KERESTE: { productionPct: 5, militaryUpkeepReductionPct: 3 },
  SIGIR: { manpowerPct: 7, productionPct: 3 },
  PAMUK: { productionPct: 6, tradePct: 6 },
  TAHIL: { manpowerPct: 8 },
  DEMIR_CELIK: { militaryUpkeepReductionPct: 5 },
  ALTIN: { taxPct: 10, productionPct: 5 },
  PETROL: { productionPct: 8 },
  DOGALGAZ: { productionPct: 6, tradePct: 4 },
  YARI_ILETKEN: { researchFlat: 2.5 },
  TICARET_BOGAZI: { tradePct: 12 },
  NADIR_TOPRAK: { productionPct: 4, researchFlat: 1.5 },
  FINANS_MERKEZI: { taxPct: 12 },
};

export interface ProvinceDevelopmentBreakdown {
  developmentScore: number;
  tierLabel:
    | 'İmparatorluk Metropolü'
    | 'Kalkınmış Sanayi Şehri'
    | 'Gelişen Ticaret Sancağı'
    | 'Orta Ölçekli Eyalet'
    | 'Kırsal Bölge';
  baseResourceValue: number;
  buildingInvestmentMult: number;
  techInvestmentMult: number;
  totalInvestmentMult: number;
  effectiveResourceValue: number;
  effectiveDailyGdp: number;
  totalBuildingLevels: number;
}

/**
 * Calculates a province's Development Score (Gelişim Puanı) and Investment-Driven Resource Output.
 * Crucially, where a player invests (buildings + Economy/Science technologies) scales local resource
 * value up to 3.5x+, allowing a heavily invested Cotton, Timber, or Livestock province to outproduce
 * an uninvested Gold or Oil province.
 */
export function calculateProvinceDevelopment(
  territory: Territory,
  ownerNation?: Pick<Nation, 'unlockedTechs' | 'enactedReforms' | 'budget'> | null
): ProvinceDevelopmentBreakdown {
  const resMeta = RESOURCE_INFO[territory.resource] || RESOURCE_INFO.TAHIL;
  const baseResourceValue = resMeta?.baseValue ?? 21;
  const resGdpMult = resMeta?.gdpMultiplier ?? 1.12;

  const bld = territory.buildings || {
    factory: 0,
    barracks: 0,
    fortress: 0,
    university: 0,
    tradeHub: 0,
    supplyDepot: 0,
  };
  const totalBuildingLevels =
    (bld.factory || 0) +
    (bld.tradeHub || 0) +
    (bld.university || 0) +
    (bld.supplyDepot || 0) +
    (bld.barracks || 0) +
    (bld.fortress || 0);

  // Local building investment multiplier (Sanayi, Liman, İkmal, Üniversite)
  const buildingInvestmentMult = Number(
    (
      1 +
      (bld.factory || 0) * 0.36 +
      (bld.tradeHub || 0) * 0.22 +
      (bld.supplyDepot || 0) * 0.14 +
      (bld.university || 0) * 0.12
    ).toFixed(2)
  );

  // National technology & reform investment multiplier
  const unlockedTechs = ownerNation?.unlockedTechs || [];
  const enactedReforms = ownerNation?.enactedReforms || [];
  let techMult = 1.0;
  if (unlockedTechs.includes('eco_1')) techMult += 0.12;
  if (unlockedTechs.includes('eco_2')) techMult += 0.22;
  if (unlockedTechs.includes('eco_3')) techMult += 0.15;
  if (unlockedTechs.includes('eco_4')) techMult += 0.18;
  if (unlockedTechs.includes('sci_1')) techMult += 0.08;
  if (unlockedTechs.includes('sci_2')) techMult += 0.15;
  if (unlockedTechs.includes('sci_4')) techMult += 0.25;
  if (enactedReforms.includes('ref_free_trade_zones')) techMult += 0.12;
  const techInvestmentMult = Number(techMult.toFixed(2));

  const totalInvestmentMult = Number(
    (buildingInvestmentMult * techInvestmentMult).toFixed(2)
  );
  const unrestPenalty = Math.max(0.35, 1 - (territory.unrest || 0) * 0.006);

  const effectiveResourceValue = Math.max(
    5,
    Math.round(baseResourceValue * totalInvestmentMult * unrestPenalty)
  );

  const baseGdp = territory.baseGdp || 40;
  const effectiveDailyGdp = Math.max(
    15,
    Math.round(
      (baseGdp * resGdpMult * (1 + (bld.factory || 0) * 0.25) +
        (effectiveResourceValue - baseResourceValue) * 0.9) *
        unrestPenalty
    )
  );

  // Development score (Gelişim Puanı): combines base urbanization, buildings, tech investment, and stability
  const popTerm = Math.min(
    18,
    Math.round(Math.sqrt(Math.max(10_000, territory.population || 200_000) / 120_000) * 3.2)
  );
  const gdpTerm = Math.min(34, Math.round(baseGdp * 0.19));
  const buildingTerm =
    (bld.factory || 0) * 9 +
    (bld.tradeHub || 0) * 7 +
    (bld.university || 0) * 6 +
    (bld.supplyDepot || 0) * 5 +
    (bld.barracks || 0) * 3 +
    (bld.fortress || 0) * 3;
  const techTerm = Math.round((techInvestmentMult - 1) * 28);
  const capitalBonus = territory.isCapital ? 8 : 0;
  const coreBonus =
    territory.coreOwnerId === territory.ownerId || (territory.assimilation ?? 100) >= 100
      ? 4
      : 0;
  const unrestMod =
    (territory.unrest || 0) <= 10
      ? 3
      : (territory.unrest || 0) >= 35
      ? -6
      : 0;

  const developmentScore = Math.max(
    10,
    popTerm + gdpTerm + buildingTerm + techTerm + capitalBonus + coreBonus + unrestMod
  );

  const tierLabel: ProvinceDevelopmentBreakdown['tierLabel'] =
    developmentScore >= 90
      ? 'İmparatorluk Metropolü'
      : developmentScore >= 68
      ? 'Kalkınmış Sanayi Şehri'
      : developmentScore >= 50
      ? 'Gelişen Ticaret Sancağı'
      : developmentScore >= 34
      ? 'Orta Ölçekli Eyalet'
      : 'Kırsal Bölge';

  return {
    developmentScore,
    tierLabel,
    baseResourceValue,
    buildingInvestmentMult,
    techInvestmentMult,
    totalInvestmentMult,
    effectiveResourceValue,
    effectiveDailyGdp,
    totalBuildingLevels,
  };
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

export interface WarParticipantsResolution {
  attackers: string[];
  defenders: string[];
  offensiveAlliesCalled: string[];
  defensiveAlliesCalled: string[];
}

/**
 * Resolves war coalition participants based on Defensive and Offensive Pacts:
 * - Attacker side: ONLY nations with an OFFENSIVE pact ('OFFENSIVE') join the attack.
 *   Defensive pact allies DO NOT participate in offensive wars.
 * - Defender side: Defender is attacked, so BOTH 'DEFENSIVE' and 'OFFENSIVE' pacts
 *   trigger to defend their ally against foreign aggression!
 */
export function resolveWarParticipants(
  attackerId: string,
  defenderId: string,
  relations: Record<string, DiplomaticRelation>,
  nations: Record<string, Nation>
): WarParticipantsResolution {
  const attackers = new Set<string>([attackerId]);
  const defenders = new Set<string>([defenderId]);
  const offensiveAlliesCalled: string[] = [];
  const defensiveAlliesCalled: string[] = [];

  // Attacker side: ONLY Offensive Pact allies join the attack
  Object.values(relations).forEach((rel) => {
    const isAttackerPartner =
      rel.nationA === attackerId || rel.nationB === attackerId;
    if (!isAttackerPartner) return;

    const partnerId = rel.nationA === attackerId ? rel.nationB : rel.nationA;
    if (partnerId === defenderId) return;
    const partnerNation = nations[partnerId];
    if (!partnerNation || partnerNation.isEliminated) return;

    if (rel.allianceType === 'OFFENSIVE') {
      attackers.add(partnerId);
      offensiveAlliesCalled.push(partnerId);
    }
  });

  // Defender side: Target is attacked -> Both Defensive Pacts and Offensive Pacts trigger to defend!
  Object.values(relations).forEach((rel) => {
    const isDefenderPartner =
      rel.nationA === defenderId || rel.nationB === defenderId;
    if (!isDefenderPartner) return;

    const partnerId = rel.nationA === defenderId ? rel.nationB : rel.nationA;
    if (attackers.has(partnerId)) return;
    const partnerNation = nations[partnerId];
    if (!partnerNation || partnerNation.isEliminated) return;

    if (
      rel.allianceType === 'DEFENSIVE' ||
      rel.allianceType === 'OFFENSIVE' ||
      (rel.isAllied && !rel.allianceType)
    ) {
      defenders.add(partnerId);
      defensiveAlliesCalled.push(partnerId);
    }
  });

  // Vassals of defender automatically defend
  Object.values(nations).forEach((n) => {
    if (n.vassalOf === defenderId && !n.isEliminated && !attackers.has(n.id)) {
      defenders.add(n.id);
      defensiveAlliesCalled.push(n.id);
    }
  });

  return {
    attackers: Array.from(attackers),
    defenders: Array.from(defenders),
    offensiveAlliesCalled,
    defensiveAlliesCalled,
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

export function getWarScoreForNation(
  war: ActiveWar,
  nationId: string
): number | null {
  if (war.attackers?.includes(nationId) || war.attackerId === nationId) {
    return war.attackerWarScore;
  }
  if (war.defenders?.includes(nationId) || war.defenderId === nationId) {
    return -war.attackerWarScore;
  }
  return null;
}

export function calculateNationEconomy(
  nation: Nation,
  territories: Record<string, Territory>,
  nations: Record<string, Nation>,
  relations: Record<string, DiplomaticRelation>,
  activeMovements: ArmyMovement[],
  wars: ActiveWar[] = [],
  gameMode: GameModeId = 'EMPIRES_1440'
): NationEconomyBreakdown {
  const ownedTerritories = Object.values(territories).filter(
    (t) => t && t.ownerId === nation.id
  );

  const ideology = IDEOLOGIES[nation.ideology] || IDEOLOGIES.MONARCHY;
  let totalPopulation = 0;
  let totalGarrison = 0;
  const totalUnits: UnitComposition = { infantry: 0, armor: 0, airDrone: 0 };
  let baseProduction = 0;
  let universityOutput = 0;
  let barracksManpower = 0;
  let tradeHubBonus = 0;
  let tradeHubLevels = 0;
  const resourceEffects = {
    taxPct: 0,
    productionPct: 0,
    tradePct: 0,
    researchFlat: 0,
    manpowerPct: 0,
    militaryUpkeepReductionPct: 0,
  };
  const claimedResourceBonuses = new Set<ResourceType>();

  ownedTerritories.forEach((t) => {
    totalPopulation += t.population || 0;
    totalGarrison += t.garrison || 0;
    if (t.units) {
      totalUnits.infantry += t.units.infantry || 0;
      totalUnits.armor += t.units.armor || 0;
      totalUnits.airDrone += t.units.airDrone || 0;
    }

    const dev = calculateProvinceDevelopment(t, nation);
    const bld = t.buildings || {
      factory: 0,
      barracks: 0,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    };

    baseProduction += dev.effectiveDailyGdp;
    universityOutput += (bld.university || 0) * 4.5;
    barracksManpower += (bld.barracks || 0) * 350;
    tradeHubBonus += (bld.tradeHub || 0) * 0.2;
    tradeHubLevels += bld.tradeHub || 0;

    const resourceEffect = RESOURCE_ECONOMIC_EFFECTS[t.resource];
    if (resourceEffect && !claimedResourceBonuses.has(t.resource)) {
      claimedResourceBonuses.add(t.resource);
      resourceEffects.taxPct += resourceEffect.taxPct || 0;
      resourceEffects.productionPct += resourceEffect.productionPct || 0;
      resourceEffects.tradePct += resourceEffect.tradePct || 0;
      resourceEffects.researchFlat += resourceEffect.researchFlat || 0;
      resourceEffects.manpowerPct += resourceEffect.manpowerPct || 0;
      resourceEffects.militaryUpkeepReductionPct +=
        resourceEffect.militaryUpkeepReductionPct || 0;
    }
  });

  // Progressive empire scale: 1-3 province countries retain 100%, large 10-20 province empires scale smoothly so economy stays strategic
  const empireScale =
    ownedTerritories.length <= 3
      ? 1.0
      : Math.max(0.24, 1.95 / Math.pow(ownedTerritories.length, 0.64));
  baseProduction = baseProduction * empireScale;

  const movingTroops = activeMovements
    .filter((m) => m && m.ownerId === nation.id)
    .reduce((sum, m) => sum + (m.troops || 0), 0);

  const totalTroops = totalGarrison + movingTroops;

  const unlockedTechs = nation.unlockedTechs || [];
  const enactedReforms = nation.enactedReforms || [];
  const budget = nation.budget || {
    military: 35,
    economy: 30,
    research: 15,
    welfare: 20,
  };

  const taxRateFactor = (nation.taxRate || 25) / 25;
  let taxTechMult = 1 + ideology.taxBonus / 100;
  taxTechMult += resourceEffects.taxPct / 100;
  if (unlockedTechs.includes('eco_1')) taxTechMult += 0.15;
  if (unlockedTechs.includes('eco_4')) taxTechMult += 0.2;
  if (enactedReforms.includes('ref_free_trade_zones')) taxTechMult += 0.2;

  const taxIncome = Math.round(
    baseProduction * 0.55 * taxRateFactor * taxTechMult
  );

  let prodMult = 1 + ((budget.economy || 25) - 25) * 0.008;
  prodMult += resourceEffects.productionPct / 100;
  if (unlockedTechs.includes('eco_2')) prodMult += 0.25;
  if (unlockedTechs.includes('sci_2')) prodMult += 0.15;
  if (unlockedTechs.includes('sci_4')) prodMult += 0.35;

  const productionIncome = Math.round(baseProduction * 0.48 * prodMult);

  let tradeAgreementCount = 0;
  let embargoCount = 0;
  Object.values(relations).forEach((rel) => {
    if (!rel) return;
    if (rel.nationA === nation.id || rel.nationB === nation.id) {
      if (rel.hasTradeAgreement) tradeAgreementCount++;
      if (isNationEmbargoed(rel, nation.id)) embargoCount++;
    }
  });

  let tradeMult =
    1 + tradeHubBonus + tradeAgreementCount * 0.14 + resourceEffects.tradePct / 100;
  if (unlockedTechs.includes('eco_3')) tradeMult += 0.3;
  if (enactedReforms.includes('ref_free_trade_zones')) tradeMult += 0.2;

  const embargoResistance = unlockedTechs.includes('sci_2') ? 0.5 : 1.0;
  const embargoFactor = Math.max(
    0.35,
    1 - embargoCount * 0.18 * embargoResistance
  );

  const baseDomesticTrade = Math.round(
    baseProduction * 0.2 * tradeMult * embargoFactor
  );
  const tradeDetails = calculateNationTradeAndStraits({
    nationId: nation.id,
    gameMode,
    territories,
    nations,
    relations,
    wars,
  });
  const straitTollIncome = Math.round(
    tradeDetails.straitTollIncome * (ownedTerritories.length > 6 ? 0.65 : 1)
  );
  const caravanTradeIncome = Math.round(
    tradeDetails.caravanTradeIncome * (ownedTerritories.length > 6 ? 0.65 : 1)
  );
  const seizedBlockadeIncome = tradeDetails.seizedBlockadeIncome;
  const blockadePenaltyLoss = tradeDetails.blockadePenaltyLoss;

  const tradeIncome =
    baseDomesticTrade +
    straitTollIncome +
    caravanTradeIncome +
    seizedBlockadeIncome;

  let vassalIncome = 0;
  Object.values(nations).forEach((other) => {
    if (other && other.vassalOf === nation.id && !other.isEliminated) {
      vassalIncome += 55;
    }
  });
  if (unlockedTechs.includes('adm_4')) {
    vassalIncome = Math.round(vassalIncome * 1.5);
  }

  const vassalTributeOut = nation.vassalOf ? Math.round(taxIncome * 0.25) : 0;

  let upkeepPerThousand = 2.25 * (0.75 + (budget.military || 35) / 100);
  upkeepPerThousand *=
    1 - Math.min(0.3, resourceEffects.militaryUpkeepReductionPct / 100);
  if (enactedReforms.includes('ref_professional_army')) {
    upkeepPerThousand *= 0.9;
  }
  if (nation.ideology === 'MILITARY_JUNTA') {
    upkeepPerThousand *= 0.82;
  }
  const militaryUpkeep = Math.round((totalTroops / 1000) * upkeepPerThousand);

  const grossIncome = taxIncome + productionIncome + tradeIncome + vassalIncome;
  const incomeAfterTribute = grossIncome - vassalTributeOut;
  const inflationPenalty = Math.round(
    incomeAfterTribute * Math.min(0.65, (nation.inflation || 0) / 120)
  );

  const netDailyGold = incomeAfterTribute - militaryUpkeep - inflationPenalty;

  let researchBase =
    2.5 +
    Math.min(7.5, ownedTerritories.length * 0.55) +
    universityOutput +
    (budget.research || 15) * 0.11 +
    resourceEffects.researchFlat;
  if (enactedReforms.includes('ref_welfare_state')) researchBase += 5;
  let researchMult = 1 + ideology.researchBonus / 100;
  if (unlockedTechs.includes('sci_1')) researchMult += 0.2;
  if (unlockedTechs.includes('sci_3')) researchMult += 0.25;
  const dailyResearch = Number((researchBase * researchMult).toFixed(1));

  const manpowerBase =
    140 + Math.round(totalPopulation * 0.0006 * empireScale) + barracksManpower;
  let manpowerMult =
    1 + ideology.manpowerGrowthBonus / 100 + resourceEffects.manpowerPct / 100;
  if (unlockedTechs.includes('adm_3')) manpowerMult += 0.35;
  const dailyManpower = Math.round(manpowerBase * manpowerMult);

  return {
    territoryCount: ownedTerritories.length,
    totalPopulation,
    totalGarrison: totalTroops,
    totalUnits,
    taxIncome,
    productionIncome,
    tradeIncome,
    straitTollIncome,
    caravanTradeIncome,
    seizedBlockadeIncome,
    blockadePenaltyLoss,
    tradeDetails,
    vassalIncome,
    vassalTributeOut,
    militaryUpkeep,
    inflationPenalty,
    inflationRelief: Math.min(0.2, tradeHubLevels * 0.02),
    netDailyGold,
    dailyResearch,
    dailyManpower,
  };
}

export function computeNationManpowerCap(
  nation: Nation,
  territories: Record<string, Territory>
): number {
  let ownedCount = 0;
  let totalBarracks = 0;
  let totalPop = 0;
  for (const t of Object.values(territories)) {
    if (t && t.ownerId === nation.id) {
      ownedCount++;
      totalBarracks += t.buildings?.barracks || 0;
      totalPop += t.population || 0;
    }
  }
  const techBonus = nation.unlockedTechs?.includes('adm_3') ? 1.25 : 1.0;
  const rawCap =
    ownedCount * 9_000 +
    totalBarracks * 12_000 +
    Math.min(200_000, Math.round(totalPop * 0.0025));
  return Math.max(45_000, Math.round(rawCap * techBonus));
}

export function computeCombatStrength(
  nation: Nation,
  territory: Territory,
  isDefender: boolean,
  unitComp?: UnitComposition
): number {
  const ideology = IDEOLOGIES[nation?.ideology] || IDEOLOGIES.MONARCHY;
  let mult = 1 + ideology.militaryAttackBonus / 100;

  // Budget effect
  mult += ((nation?.budget?.military ?? 25) - 25) * 0.006;

  // Tech bonuses
  const unlockedTechs = nation?.unlockedTechs || [];
  const enactedReforms = nation?.enactedReforms || [];
  if (unlockedTechs.includes('mil_1')) mult += 0.12;
  if (unlockedTechs.includes('mil_2')) mult += 0.18;
  if (unlockedTechs.includes('mil_3')) mult += 0.25;
  if (enactedReforms.includes('ref_professional_army')) mult += 0.15;

  // National Army Modernization Generation Bonus (applied once standing armies are modernized to unlocked tech!)
  const modernizedTier = getNationModernizedTier(nation);
  if (modernizedTier > 0) {
    mult += getArmyGenerationInfo(undefined, modernizedTier).combatBonusPct / 100;
  }

  // Active Commander (General) bonus
  if (nation?.activeGeneralId) {
    const cmd = COMMANDERS.find((c) => c.id === nation.activeGeneralId);
    if (cmd) {
      mult += (isDefender ? cmd.defenseBonus : cmd.attackBonus) / 100;
    }
  }

  // Bannerlord Summoned Lords (Sancak Ordusu) Attack Bonus
  if (!isDefender && nation?.bannerCalledLordIds?.length) {
    mult += nation.bannerCalledLordIds.length * 0.12;
  }

  const terrainMeta =
    TERRAIN_INFO[territory?.terrain || 'OVA'] || TERRAIN_INFO.OVA;

  // Unit composition bonuses (Armor & Air/Drone + Terrain Armor synergy)
  const comp = unitComp || territory?.units;
  if (comp) {
    const total = Math.max(
      1,
      (comp.infantry || 0) + (comp.armor || 0) + (comp.airDrone || 0)
    );
    const armorShare = (comp.armor || 0) / total;
    const airShare = (comp.airDrone || 0) / total;
    const terrainArmorMod = !isDefender
      ? terrainMeta.armorAttackBonusPct / 100
      : 0;
    mult +=
      armorShare * (0.4 + terrainArmorMod) + airShare * 0.35;
  }

  if (isDefender) {
    // Terrain defense bonus (e.g. Dağlık +30%, Metropol +22%, Orman +16%)
    mult += terrainMeta.defenseBonusPct / 100;

    // Castle Wall HP scales fortress effectiveness during sieges
    const wallIntegrity = (territory?.castleWallHp ?? 100) / 100;
    mult += (territory?.buildings?.fortress || 0) * 0.24 * wallIntegrity;

    // Fief Lord (Tımar Beyi / Paşa) personal defense bonus
    if (territory?.fiefLordId) {
      mult += 0.15;
    }

    if (unlockedTechs.includes('mil_4')) mult += 0.3;
  }

  return Math.max(0.5, mult);
}

export function formatGameDate(
  tick: number,
  modeId?: string,
  hour?: number
): string {
  const startYear = modeId === 'EMPIRES_1440' ? 1440 : 2026;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const start = new Date(Date.UTC(startYear, 0, 1));
  start.setUTCDate(start.getUTCDate() + safeTick);
  const months = [
    'Oca',
    'Şub',
    'Mar',
    'Nis',
    'May',
    'Haz',
    'Tem',
    'Ağu',
    'Eyl',
    'Eki',
    'Kas',
    'Ara',
  ];
  const baseDate = `${start.getUTCDate()} ${months[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  if (typeof hour === 'number' && Number.isFinite(hour)) {
    const clampedHour = ((Math.floor(hour) % 24) + 24) % 24;
    const hh = String(clampedHour).padStart(2, '0');
    return `${baseDate} · ${hh}:00`;
  }
  return baseDate;
}
