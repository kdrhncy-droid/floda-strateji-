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
  SeaArmy,
  Territory,
  ResourceType,
  UnitComposition,
} from '../types/game';
import { isTerritoryCoastal, relationKey } from './worldBuilder';
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

/** ADM_2 (-25%), ADM_2B (-10%), and ADM_6B (-15%) reduce positive aggressive-expansion gains; losses are unchanged. */
export function adjustAggressiveExpansionGain(
  nation: NationTechState,
  baseGain: number
): number {
  if (baseGain <= 0) return baseGain;
  let factor = 1.0;
  if (nation?.unlockedTechs?.includes('adm_2')) factor *= 0.75;
  if (nation?.unlockedTechs?.includes('adm_2b')) factor *= 0.9;
  if (nation?.unlockedTechs?.includes('adm_6b')) factor *= 0.85;
  if (factor === 1.0) return baseGain;
  return Number((baseGain * factor).toFixed(2));
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
    shipyard: 0,
    mint: 0,
    granary: 0,
  };
  const totalBuildingLevels =
    (bld.factory || 0) +
    (bld.tradeHub || 0) +
    (bld.university || 0) +
    (bld.school || 0) +
    (bld.highSchool || 0) +
    (bld.capitalPalace || 0) +
    (bld.supplyDepot || 0) +
    (bld.barracks || 0) +
    (bld.fortress || 0) +
    (bld.shipyard || 0) +
    (bld.mint || 0) +
    (bld.granary || 0);

  // Local building investment multiplier (Sanayi, Liman, Tersane, Darphane, Ambar, İkmal, Okul, Medrese, Üniversite, Saray)
  const buildingInvestmentMult = Number(
    (
      1 +
      (bld.factory || 0) * 0.36 +
      (bld.tradeHub || 0) * 0.22 +
      (bld.shipyard || 0) * 0.24 +
      (bld.mint || 0) * 0.16 +
      (bld.granary || 0) * 0.15 +
      (bld.supplyDepot || 0) * 0.14 +
      (bld.university || 0) * 0.12 +
      (bld.highSchool || 0) * 0.1 +
      (bld.school || 0) * 0.06 +
      (bld.capitalPalace || 0) * 0.18
    ).toFixed(2)
  );

  // National technology & reform investment multiplier
  const unlockedTechs = ownerNation?.unlockedTechs || [];
  const enactedReforms = ownerNation?.enactedReforms || [];
  let techMult = 1.0;
  if (unlockedTechs.includes('eco_1')) techMult += 0.12;
  if (unlockedTechs.includes('eco_2')) techMult += 0.22;
  if (unlockedTechs.includes('eco_2b')) techMult += 0.12;
  if (unlockedTechs.includes('eco_3')) techMult += 0.15;
  if (unlockedTechs.includes('eco_4')) techMult += 0.18;
  if (unlockedTechs.includes('eco_5')) techMult += 0.2;
  if (unlockedTechs.includes('eco_5b')) techMult += 0.18;
  if (unlockedTechs.includes('eco_6')) techMult += 0.22;
  if (unlockedTechs.includes('adm_3b')) techMult += 0.12;
  if (unlockedTechs.includes('sci_1')) techMult += 0.08;
  if (unlockedTechs.includes('sci_2')) techMult += 0.15;
  if (unlockedTechs.includes('sci_4')) techMult += 0.25;
  if (unlockedTechs.includes('sci_4b')) techMult += 0.16;
  if (unlockedTechs.includes('sci_5')) techMult += 0.2;
  if (unlockedTechs.includes('sci_6b')) techMult += 0.2;
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
      (baseGdp * resGdpMult * (1 + (bld.factory || 0) * 0.25 + (bld.highSchool || 0) * 0.1) +
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
    (bld.shipyard || 0) * 7 +
    (bld.university || 0) * 6 +
    (bld.highSchool || 0) * 5 +
    (bld.school || 0) * 4 +
    (bld.capitalPalace || 0) * 8 +
    (bld.mint || 0) * 5 +
    (bld.granary || 0) * 5 +
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
  gameMode: GameModeId = 'EMPIRES_1440',
  seaArmies: SeaArmy[] = []
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
  let granaryManpower = 0;
  let tradeHubBonus = 0;
  let shipyardBonus = 0;
  let tradeHubLevels = 0;
  let mintLevels = 0;
  let mintTaxBoost = 0;
  const resourceEffects = {
    taxPct: 0,
    productionPct: 0,
    tradePct: 0,
    researchFlat: 0,
    manpowerPct: 0,
    militaryUpkeepReductionPct: 0,
  };
  const claimedResourceBonuses = new Set<ResourceType>();

  const navalBlockadedSet = computeNavalBlockadedTerritoryIds(
    territories,
    wars,
    seaArmies
  );

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
      shipyard: 0,
      mint: 0,
      granary: 0,
    };

    const isBlockadedByFleet = navalBlockadedSet.has(t.id);
    const effectiveProd = isBlockadedByFleet
      ? dev.effectiveDailyGdp * 0.75
      : dev.effectiveDailyGdp;
    baseProduction += effectiveProd;
    universityOutput +=
      (bld.university || 0) * 4.5 +
      (bld.highSchool || 0) * 3.2 +
      (bld.school || 0) * 2.0 +
      (bld.capitalPalace || 0) * 1.5;
    barracksManpower += (bld.barracks || 0) * 350;
    granaryManpower += (bld.granary || 0) * 220;
    tradeHubBonus += (bld.tradeHub || 0) * (isBlockadedByFleet ? 0.1 : 0.2);
    shipyardBonus += (bld.shipyard || 0) * (isBlockadedByFleet ? 0.08 : 0.22);
    tradeHubLevels += bld.tradeHub || 0;
    mintLevels += bld.mint || 0;
    mintTaxBoost +=
      effectiveProd *
      ((bld.mint || 0) * 0.14 + (bld.capitalPalace || 0) * 0.12);

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
  const mintTaxBase = mintTaxBoost * empireScale;
  baseProduction = baseProduction * empireScale;

  const movingTroops = activeMovements
    .filter((m) => m && m.ownerId === nation.id)
    .reduce((sum, m) => sum + (m.troops || 0), 0);

  let seaTroops = 0;
  for (const fleet of seaArmies) {
    if (!fleet || fleet.ownerId !== nation.id) continue;
    seaTroops += fleet.troops || 0;
    if (fleet.units) {
      totalUnits.infantry += fleet.units.infantry || 0;
      totalUnits.armor += fleet.units.armor || 0;
      totalUnits.airDrone += fleet.units.airDrone || 0;
    }
  }

  const totalTroops = totalGarrison + movingTroops + seaTroops;

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
  if (unlockedTechs.includes('eco_3b')) taxTechMult += 0.12;
  if (unlockedTechs.includes('eco_4')) taxTechMult += 0.2;
  if (unlockedTechs.includes('eco_5b')) taxTechMult += 0.25;
  if (unlockedTechs.includes('eco_6')) taxTechMult += 0.2;
  if (enactedReforms.includes('ref_free_trade_zones')) taxTechMult += 0.2;

  const taxIncome = Math.round(
    (baseProduction + mintTaxBase) * 0.55 * taxRateFactor * taxTechMult
  );

  let prodMult = 1 + ((budget.economy || 25) - 25) * 0.008;
  prodMult += resourceEffects.productionPct / 100;
  if (unlockedTechs.includes('eco_2')) prodMult += 0.25;
  if (unlockedTechs.includes('eco_2b')) prodMult += 0.15;
  if (unlockedTechs.includes('eco_6')) prodMult += 0.25;
  if (unlockedTechs.includes('sci_2')) prodMult += 0.15;
  if (unlockedTechs.includes('sci_4')) prodMult += 0.35;
  if (unlockedTechs.includes('sci_4b')) prodMult += 0.2;
  if (unlockedTechs.includes('sci_5')) prodMult += 0.2;
  if (unlockedTechs.includes('sci_6b')) prodMult += 0.2;

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
    1 +
    tradeHubBonus +
    shipyardBonus +
    tradeAgreementCount * 0.14 +
    resourceEffects.tradePct / 100;
  if (unlockedTechs.includes('eco_3')) tradeMult += 0.3;
  if (unlockedTechs.includes('eco_4b')) tradeMult += 0.18;
  if (unlockedTechs.includes('eco_6b')) tradeMult += 0.25;
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
  let maritimeTradeTechMult = 1.0;
  if (unlockedTechs.includes('eco_5')) maritimeTradeTechMult += 0.25;
  if (unlockedTechs.includes('eco_6b')) maritimeTradeTechMult += 0.25;
  if (unlockedTechs.includes('mil_3b')) maritimeTradeTechMult += 0.12;
  if (unlockedTechs.includes('sci_3b')) maritimeTradeTechMult += 0.15;
  const straitTollIncome = Math.round(
    tradeDetails.straitTollIncome *
      (ownedTerritories.length > 6 ? 0.65 : 1) *
      maritimeTradeTechMult
  );
  const caravanTradeIncome = Math.round(
    tradeDetails.caravanTradeIncome *
      (ownedTerritories.length > 6 ? 0.65 : 1) *
      maritimeTradeTechMult
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
  let vassalTechMult = 1.0;
  if (unlockedTechs.includes('adm_4')) vassalTechMult += 0.5;
  if (unlockedTechs.includes('adm_5b')) vassalTechMult += 0.3;
  if (unlockedTechs.includes('adm_6b')) vassalTechMult += 0.35;
  if (vassalTechMult > 1.0) {
    vassalIncome = Math.round(vassalIncome * vassalTechMult);
  }

  const vassalTributeOut = nation.vassalOf ? Math.round(taxIncome * 0.25) : 0;

  let upkeepPerThousand = 2.25 * (0.75 + (budget.military || 35) / 100);
  upkeepPerThousand *=
    1 - Math.min(0.3, resourceEffects.militaryUpkeepReductionPct / 100);
  if (unlockedTechs.includes('mil_5')) {
    upkeepPerThousand *= 0.88;
  }
  if (unlockedTechs.includes('mil_5b')) {
    upkeepPerThousand *= 0.9;
  }
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
  if (unlockedTechs.includes('sci_2b')) researchMult += 0.18;
  if (unlockedTechs.includes('sci_3')) researchMult += 0.25;
  if (unlockedTechs.includes('sci_5')) researchMult += 0.3;
  if (unlockedTechs.includes('sci_5b')) researchMult += 0.35;
  if (unlockedTechs.includes('sci_6')) researchMult += 0.35;
  if (unlockedTechs.includes('sci_6b')) researchMult += 0.25;
  const dailyResearch = Number((researchBase * researchMult).toFixed(1));

  // totalPopulation is stored in thousands (e.g. 86,500 = 86.5M). Use a damped power curve so
  // small, mid-sized, and large empires all get realistic, clearly visible daily manpower recovery.
  const popDailyManpower = Math.min(
    2400,
    Math.round(Math.pow(Math.max(0, totalPopulation), 0.72) * 0.24)
  );
  const manpowerBase =
    180 +
    popDailyManpower +
    Math.round((barracksManpower + granaryManpower) * empireScale);
  let manpowerMult =
    1 + ideology.manpowerGrowthBonus / 100 + resourceEffects.manpowerPct / 100;
  if (unlockedTechs.includes('eco_1b')) manpowerMult += 0.1;
  if (unlockedTechs.includes('sci_1b')) manpowerMult += 0.15;
  if (unlockedTechs.includes('adm_3')) manpowerMult += 0.35;
  if (unlockedTechs.includes('adm_6')) manpowerMult += 0.2;
  const dailyManpower = Math.round(manpowerBase * manpowerMult);

  let techInflationRelief = 0;
  if (unlockedTechs.includes('eco_3b')) techInflationRelief += 0.02;
  if (unlockedTechs.includes('eco_5b')) techInflationRelief += 0.025;
  if (unlockedTechs.includes('eco_6b')) techInflationRelief += 0.025;

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
    inflationRelief: Number(
      (
        Math.min(0.2, tradeHubLevels * 0.02) +
        Math.min(0.15, mintLevels * 0.015) +
        techInflationRelief
      ).toFixed(3)
    ),
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
  let totalGranaries = 0;
  let totalPop = 0;
  for (const t of Object.values(territories)) {
    if (t && t.ownerId === nation.id) {
      ownedCount++;
      totalBarracks += t.buildings?.barracks || 0;
      totalGranaries += t.buildings?.granary || 0;
      totalPop += t.population || 0;
    }
  }
  let techBonus = 1.0;
  if (nation.unlockedTechs?.includes('adm_3')) techBonus += 0.25;
  if (nation.unlockedTechs?.includes('adm_4b')) techBonus += 0.2;
  const popCapBonus = Math.min(200_000, Math.round(totalPop * 0.65));
  const rawCap =
    ownedCount * 6_500 +
    totalBarracks * 9_000 +
    totalGranaries * 6_000 +
    popCapBonus;
  return Math.max(50_000, Math.round(rawCap * techBonus));
}

export function resolveSeaRegionName(coords: [number, number]): string {
  const [lon, lat] = coords;
  if (lon >= 27 && lon <= 42 && lat >= 40.5 && lat <= 47.5) return 'Karadeniz Filosu';
  if (lon >= 23 && lon <= 28.5 && lat >= 35.5 && lat <= 41) return 'Ege Filosu';
  if (lon >= -6 && lon <= 36.5 && lat >= 30 && lat <= 46) return 'Akdeniz Donanması';
  if (lon >= 32 && lon <= 44 && lat >= 12 && lat <= 30) return 'Kızıldeniz Filosu';
  if (lon >= 47 && lon <= 57 && lat >= 23 && lat <= 30.5) return 'Basra Körfezi Filosu';
  if (lon >= 9 && lon <= 31 && lat >= 53.5 && lat <= 66) return 'Baltık Donanması';
  if (lon >= -5 && lon <= 10 && lat >= 50 && lat <= 62) return 'Kuzey Denizi Filosu';
  if (lon >= -80 && lon <= 15 && lat >= -55 && lat <= 68) return 'Atlas Okyanusu Filosu';
  if (lon >= 35 && lon <= 118 && lat >= -45 && lat <= 26) return 'Hint Okyanusu Filosu';
  if (lon >= 118 || lon <= -80) return 'Pasifik Donanması';
  return 'Açık Deniz Filosu';
}

/**
 * Returns the set of coastal territory IDs currently under hostile naval blockade
 * by an enemy SeaArmy (>= 2,000 troops) anchored within 4.5 degrees of the port.
 */
export function computeNavalBlockadedTerritoryIds(
  territories: Record<string, Territory>,
  wars: ActiveWar[],
  seaArmies: SeaArmy[] = []
): Set<string> {
  const blockaded = new Set<string>();
  if (!seaArmies || seaArmies.length === 0 || !wars || wars.length === 0) {
    return blockaded;
  }

  for (const fleet of seaArmies) {
    if (!fleet || fleet.troops < 2000 || !fleet.coords) continue;
    for (const terr of Object.values(territories)) {
      if (!terr || terr.ownerId === fleet.ownerId) continue;
      if (!isTerritoryCoastal(terr) || !terr.centroid) continue;
      if (!isAtWar(wars, fleet.ownerId, terr.ownerId)) continue;
      const dist = Math.hypot(
        fleet.coords[0] - terr.centroid[0],
        fleet.coords[1] - terr.centroid[1]
      );
      if (dist <= 4.5) {
        blockaded.add(terr.id);
      }
    }
  }
  return blockaded;
}

/**
 * Shipyard & naval-tech driven naval combat multiplier (+8% per coastal shipyard level capped at +40%,
 * plus mil_1b +15%, mil_3b +20%, sci_3b +15%).
 */
export function computeNationNavalBonus(
  nationId: string,
  territories: Record<string, Territory>,
  nation?: Pick<Nation, 'unlockedTechs'> | null
): number {
  let totalShipyards = 0;
  for (const t of Object.values(territories)) {
    if (t && t.ownerId === nationId && isTerritoryCoastal(t)) {
      totalShipyards += t.buildings?.shipyard || 0;
    }
  }
  let bonus = 1 + Math.min(0.4, totalShipyards * 0.08);
  const unlocked = nation?.unlockedTechs || [];
  if (unlocked.includes('mil_1b')) bonus += 0.15;
  if (unlocked.includes('mil_3b')) bonus += 0.2;
  if (unlocked.includes('mil_6b')) bonus += 0.25;
  if (unlocked.includes('sci_3b')) bonus += 0.15;
  return Number(bonus.toFixed(2));
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
  if (unlockedTechs.includes('mil_5')) mult += 0.2;
  if (unlockedTechs.includes('mil_6')) mult += 0.25;
  if (unlockedTechs.includes('sci_5b')) mult += 0.15;
  if (!isDefender && unlockedTechs.includes('mil_5b')) mult += 0.2;
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

    if (unlockedTechs.includes('mil_2b')) mult += 0.15;
    if (unlockedTechs.includes('mil_4')) mult += 0.3;
    if (unlockedTechs.includes('mil_6')) mult += 0.15;
    if (isTerritoryCoastal(territory)) {
      mult += (territory?.buildings?.shipyard || 0) * 0.08;
    }
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
