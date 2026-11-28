import {
  ActiveWar,
  AiPersonality,
  DiplomaticRelation,
  GameModeId,
  Nation,
  SeasonId,
  Territory,
  UnitComposition,
  WorldNewsEvent,
} from '../types/game';
import {
  applyConquestDiplomaticPenalty,
  getOrCreateRelation,
  isAtWar,
  relationKey,
} from './core/diplomacyHelpers';
import { isTerritoryCoastal } from './worldBuilder';
import { getProvinceWeather } from './seasonalWeatherEngine';

export interface GameSeasonInfo {
  id: SeasonId;
  name: string;
  shortName: string;
  supplyMultiplier: number;
  attritionMultiplier: number;
  summary: string;
}

export interface AiPersonalityMeta {
  id: AiPersonality;
  name: string;
  shortLabel: string;
  description: string;
  techPriority: ('MILITARY' | 'ECONOMY' | 'ADMINISTRATION' | 'SCIENCE')[];
  warReadinessMod: number; // < 1 means more willing to declare war
  ultimatumResistance: number; // multiplier on required army ratio
  landSaleWillingness: number; // bonus/penalty to selling non-core border land
  econTurnBias: number; // 0..1 chance to prioritize peacetime economy vs levy
}

export const AI_PERSONALITY_META: Record<AiPersonality, AiPersonalityMeta> = {
  CONQUEROR: {
    id: 'CONQUEROR',
    name: 'Fetihçi',
    shortLabel: 'Fetihçi',
    description: 'Sınır genişlemesine, büyük ordulara ve askeri teknolojiye odaklanır.',
    techPriority: ['MILITARY', 'ECONOMY', 'ADMINISTRATION', 'SCIENCE'],
    warReadinessMod: 0.86,
    ultimatumResistance: 1.18,
    landSaleWillingness: -25,
    econTurnBias: 0.35,
  },
  MERCHANT: {
    id: 'MERCHANT',
    name: 'Ticaret İmparatorluğu',
    shortLabel: 'Tüccar',
    description: 'Liman, ticaret merkezi, darphane ve ekonomik üstünlüğe yatırım yapar.',
    techPriority: ['ECONOMY', 'SCIENCE', 'ADMINISTRATION', 'MILITARY'],
    warReadinessMod: 1.22,
    ultimatumResistance: 0.88,
    landSaleWillingness: 22,
    econTurnBias: 0.72,
  },
  DEFENDER: {
    id: 'DEFENDER',
    name: 'Savunmacı',
    shortLabel: 'Savunmacı',
    description: 'Kale, ikmal hattı, tahıl ambarı ve savunma paktlarıyla sınırlarını korur.',
    techPriority: ['ADMINISTRATION', 'MILITARY', 'ECONOMY', 'SCIENCE'],
    warReadinessMod: 1.28,
    ultimatumResistance: 0.96,
    landSaleWillingness: -5,
    econTurnBias: 0.58,
  },
  REVANCHIST: {
    id: 'REVANCHIST',
    name: 'Rövanşist',
    shortLabel: 'Rövanşist',
    description: 'Kaybettiği öz vatan eyaletlerini geri almak için sınırda güç toplar.',
    techPriority: ['MILITARY', 'ADMINISTRATION', 'ECONOMY', 'SCIENCE'],
    warReadinessMod: 0.8,
    ultimatumResistance: 1.28,
    landSaleWillingness: -40,
    econTurnBias: 0.25,
  },
};

const HISTORICAL_PERSONALITY_PRESETS: Record<string, AiPersonality> = {
  '792': 'CONQUEROR', // Osmanlı / Türkiye
  '250': 'CONQUEROR', // Fransa
  '643': 'CONQUEROR', // Rusya / Moskova
  '156': 'CONQUEROR', // Ming / Çin
  '364': 'CONQUEROR', // Timur / İran
  '840': 'CONQUEROR', // ABD
  '276': 'CONQUEROR', // Almanya / Kutsal Roma
  '724': 'CONQUEROR', // İspanya / Kastilya
  '380': 'MERCHANT', // Venedik / İtalya
  '826': 'MERCHANT', // İngiltere / Birleşik Krallık
  '528': 'MERCHANT', // Hollanda
  '620': 'MERCHANT', // Portekiz
  '392': 'MERCHANT', // Japonya
  '616': 'DEFENDER', // Polonya
  '040': 'DEFENDER', // Avusturya
  '300': 'DEFENDER', // Bizans / Yunanistan
  '818': 'DEFENDER', // Memlük / Mısır
  '756': 'DEFENDER', // İsviçre
  '348': 'DEFENDER', // Macaristan
  '642': 'DEFENDER', // Eflak / Romanya
  '688': 'DEFENDER', // Sırbistan
};

/**
 * Resolves a nation's live AI personality profile.
 * If the nation has lost any core territory to another state, it dynamically shifts to REVANCHIST.
 */
export function resolveNationAiPersonality(
  nation: Nation | undefined,
  territories: Record<string, Territory>,
  lostCoreOwnerIds?: ReadonlySet<string>
): AiPersonality {
  if (!nation) return 'DEFENDER';

  // Dynamic Revanchism: losing homeland cores triggers strong drive to reclaim them
  let hasLostCore = false;
  if (lostCoreOwnerIds) {
    hasLostCore = lostCoreOwnerIds.has(nation.id);
  } else {
    for (const t of Object.values(territories)) {
      if (t && t.coreOwnerId === nation.id && t.ownerId !== nation.id) {
        hasLostCore = true;
        break;
      }
    }
  }
  if (hasLostCore) return 'REVANCHIST';

  if (nation.aiPersonality) return nation.aiPersonality;
  if (HISTORICAL_PERSONALITY_PRESETS[nation.id]) {
    return HISTORICAL_PERSONALITY_PRESETS[nation.id];
  }

  if (
    nation.ideology === 'MILITARY_JUNTA' ||
    nation.ideology === 'AUTHORITARIAN'
  ) {
    return 'CONQUEROR';
  }
  if (
    nation.ideology === 'TECHNO_CORPORATISM' ||
    nation.ideology === 'DEMOCRACY'
  ) {
    return 'MERCHANT';
  }

  // Deterministic spread for minor nations
  let hash = 0;
  for (let i = 0; i < nation.id.length; i++) {
    hash = (hash * 31 + nation.id.charCodeAt(i)) % 997;
  }
  const bucket = hash % 3;
  return bucket === 0 ? 'CONQUEROR' : bucket === 1 ? 'MERCHANT' : 'DEFENDER';
}

export function getGameSeason(
  tick: number,
  gameMode?: GameModeId
): GameSeasonInfo {
  const startYear = gameMode === 'EMPIRES_1440' ? 1440 : 2026;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const d = new Date(Date.UTC(startYear, 0, 1));
  d.setUTCDate(d.getUTCDate() + safeTick);
  const month = d.getUTCMonth(); // 0..11

  if (month === 11 || month <= 1) {
    return {
      id: 'WINTER',
      name: 'Kış',
      shortName: 'Kış',
      supplyMultiplier: 0.78,
      attritionMultiplier: 1.55,
      summary: 'Kış soğuğu ikmal limitini -%22 düşürür, dağlık/kuşatma yıpranmasını artırır.',
    };
  }
  if (month >= 2 && month <= 4) {
    return {
      id: 'SPRING',
      name: 'İlkbahar',
      shortName: 'Bahar',
      supplyMultiplier: 1.0,
      attritionMultiplier: 1.0,
      summary: 'Sefer mevsimi; ikmal hatları dengeli çalışır.',
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      id: 'SUMMER',
      name: 'Yaz',
      shortName: 'Yaz',
      supplyMultiplier: 1.06,
      attritionMultiplier: 1.12,
      summary: 'Hasat mevsimi ikmali destekler; ancak çöl arazisinde sıcak yıpranması artar.',
    };
  }
  return {
    id: 'AUTUMN',
    name: 'Sonbahar',
    shortName: 'Güz',
    supplyMultiplier: 0.96,
    attritionMultiplier: 1.05,
    summary: 'Hasat sonrası dengeli ikmal; yaklaşan kış için lojistik hazırlığı önerilir.',
  };
}

export function calculateProvinceSupplyLimit(
  territory: Territory,
  ownerNation: Nation | undefined,
  season: GameSeasonInfo,
  tick?: number,
  gameMode?: GameModeId
): number {
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

  const popFactor = Math.min(
    14_000,
    Math.round(Math.sqrt(Math.max(10_000, territory.population || 150_000) / 100_000) * 3_500)
  );
  const buildingSupply =
    (bld.supplyDepot || 0) * 14_000 +
    (bld.granary || 0) * 9_000 +
    (bld.fortress || 0) * 2_500 +
    (isTerritoryCoastal(territory) ? (bld.shipyard || 0) * 4_500 : 0);

  const terrain = territory.terrain || 'OVA';
  let terrainFactor =
    terrain === 'METROPOL'
      ? 1.25
      : terrain === 'OVA'
      ? 1.15
      : terrain === 'ORMAN'
      ? 0.92
      : terrain === 'DAGLIK'
      ? 0.72
      : 0.68; // COL

  // Legacy global seasonal extremes by terrain (only when regional tick is unavailable)
  if (typeof tick !== 'number') {
    if (season.id === 'WINTER' && terrain === 'DAGLIK') {
      terrainFactor *= 0.85;
    } else if (season.id === 'SUMMER' && terrain === 'COL') {
      terrainFactor *= 0.82;
    }
  }

  let techMult = 1.0;
  if (ownerNation?.unlockedTechs?.includes('adm_4')) techMult += 0.2;
  if (ownerNation?.unlockedTechs?.includes('mil_5')) techMult += 0.15;
  if (ownerNation?.unlockedTechs?.includes('mil_4b')) techMult += 0.25;
  if (ownerNation?.unlockedTechs?.includes('mil_6b')) techMult += 0.2;
  if (ownerNation?.unlockedTechs?.includes('eco_4b')) techMult += 0.15;

  const weatherSupplyMult =
    typeof tick === 'number'
      ? getProvinceWeather(territory, tick, gameMode).supplyMultiplier
      : season.supplyMultiplier;

  const capitalLogisticsBonus =
    territory.isCapital && (bld.supplyDepot || 0) > 0 ? 18_000 : 0;
  const raw =
    (18_000 + capitalLogisticsBonus + popFactor + buildingSupply) *
    terrainFactor *
    weatherSupplyMult *
    techMult;

  return Math.max(10_000, Math.round(raw / 500) * 500);
}

function scaleUnitComposition(
  units: UnitComposition | undefined,
  ratio: number,
  fallbackTroops: number
): UnitComposition {
  if (!units) {
    return { infantry: fallbackTroops, armor: 0, airDrone: 0 };
  }
  return {
    infantry: Math.max(0, Math.round(units.infantry * ratio)),
    armor: Math.max(0, Math.round(units.armor * ratio)),
    airDrone: Math.max(0, Math.round(units.airDrone * ratio)),
  };
}

export interface SupplyAttritionResult {
  updatedTerritories: Record<string, Territory>;
  changed: boolean;
  playerAffectedCount: number;
  playerTotalLoss: number;
  worstPlayerProvinceName: string | null;
  worstPlayerWeatherLabel?: string | null;
  encircledProvinceIds?: Set<string>;
}

/**
 * Computes the set of province IDs that are completely cut off (encircled) from their owner's
 * capital and coastal ports. A nation with only 1 province is never considered encircled from itself.
 */
export function computeEncircledProvinceIds(
  territories: Record<string, Territory>,
  nations: Record<string, Nation>,
  onlyOwnerIds?: ReadonlySet<string>
): Set<string> {
  const byOwner = new Map<string, Territory[]>();
  for (const t of Object.values(territories)) {
    if (!t || !t.ownerId) continue;
    if (onlyOwnerIds && !onlyOwnerIds.has(t.ownerId)) continue;
    const list = byOwner.get(t.ownerId);
    if (list) list.push(t);
    else byOwner.set(t.ownerId, [t]);
  }

  const encircled = new Set<string>();

  for (const [ownerId, provs] of byOwner.entries()) {
    if (provs.length <= 1) continue;
    const nation = nations[ownerId];
    const ownedSet = new Set(provs.map((p) => p.id));

    // Supply roots: nation's capital (if owned) + any owned coastal port
    const supplyRoots: string[] = [];
    for (const p of provs) {
      const isCap =
        p.isCapital || (nation?.capitalTerritoryId && p.id === nation.capitalTerritoryId);
      if (isCap || isTerritoryCoastal(p)) {
        supplyRoots.push(p.id);
      }
    }

    // Fallback if capital was lost and all remaining provinces are inland: largest province acts as emergency HQ
    if (supplyRoots.length === 0) {
      let fallbackRoot = provs[0];
      for (let i = 1; i < provs.length; i++) {
        if (provs[i].garrison > fallbackRoot.garrison) fallbackRoot = provs[i];
      }
      if (fallbackRoot) supplyRoots.push(fallbackRoot.id);
    }

    const supplied = new Set<string>(supplyRoots);
    const queue = [...supplyRoots];
    let head = 0;
    while (head < queue.length) {
      const curId = queue[head++];
      const curTerr = territories[curId];
      if (!curTerr) continue;
      for (const nbId of curTerr.neighbors) {
        if (ownedSet.has(nbId) && !supplied.has(nbId)) {
          supplied.add(nbId);
          queue.push(nbId);
        }
      }
    }

    for (const p of provs) {
      if (!supplied.has(p.id)) {
        encircled.add(p.id);
      }
    }
  }

  return encircled;
}

export function isTerritoryEncircled(
  territoryId: string,
  territories: Record<string, Territory>,
  nations: Record<string, Nation>
): boolean {
  const target = territories[territoryId];
  if (!target || !target.ownerId) return false;

  const ownerId = target.ownerId;
  const provs: Territory[] = [];
  for (const t of Object.values(territories)) {
    if (t && t.ownerId === ownerId) {
      provs.push(t);
    }
  }
  if (provs.length <= 1) return false;

  const nation = nations[ownerId];
  const ownedSet = new Set(provs.map((p) => p.id));
  const supplyRoots: string[] = [];

  for (const p of provs) {
    const isCap =
      p.isCapital || (nation?.capitalTerritoryId && p.id === nation.capitalTerritoryId);
    if (isCap || isTerritoryCoastal(p)) {
      if (p.id === territoryId) return false;
      supplyRoots.push(p.id);
    }
  }

  if (supplyRoots.length === 0) {
    const fallbackRoot = [...provs].sort((a, b) => b.garrison - a.garrison)[0];
    if (fallbackRoot) {
      if (fallbackRoot.id === territoryId) return false;
      supplyRoots.push(fallbackRoot.id);
    }
  }

  const supplied = new Set<string>(supplyRoots);
  const queue = [...supplyRoots];
  let head = 0;
  while (head < queue.length) {
    const curId = queue[head++];
    const curTerr = territories[curId];
    if (!curTerr) continue;
    for (const nbId of curTerr.neighbors) {
      if (ownedSet.has(nbId) && !supplied.has(nbId)) {
        if (nbId === territoryId) return false;
        supplied.add(nbId);
        queue.push(nbId);
      }
    }
  }

  return true;
}

/**
 * Evaluates weekly supply-limit, harsh-season/terrain attrition, and wartime encirclement attrition.
 */
export function evaluateWeeklySupplyAndSeasonAttrition(params: {
  territories: Record<string, Territory>;
  nations: Record<string, Nation>;
  season: GameSeasonInfo;
  playerNationId: string;
  wars?: ActiveWar[];
  tick?: number;
  gameMode?: GameModeId;
}): SupplyAttritionResult {
  const {
    territories,
    nations,
    season,
    playerNationId,
    wars = [],
    tick,
    gameMode,
  } = params;
  let nextTerrs = territories;
  let cloned = false;
  let playerAffectedCount = 0;
  let playerTotalLoss = 0;
  let worstLoss = 0;
  let worstPlayerProvinceName: string | null = null;
  let worstPlayerWeatherLabel: string | null = null;
  const encircledIds = computeEncircledProvinceIds(territories, nations);
  const warNationIds = new Set<string>();
  for (const w of wars) {
    warNationIds.add(w.attackerId);
    warNationIds.add(w.defenderId);
    for (const id of w.attackers) warNationIds.add(id);
    for (const id of w.defenders) warNationIds.add(id);
  }

  const writeTerr = (id: string, terr: Territory) => {
    if (!cloned) {
      nextTerrs = { ...territories };
      cloned = true;
    }
    nextTerrs[id] = terr;
  };

  for (const t of Object.values(territories)) {
    if (!t) continue;
    const owner = nations[t.ownerId];
    const isEncircled = encircledIds.has(t.id);
    const ownerAtWar = warNationIds.has(t.ownerId);
    const weather =
      typeof tick === 'number' ? getProvinceWeather(t, tick, gameMode) : null;
    const effAttritionMult = weather
      ? weather.attritionMultiplier
      : season.attritionMultiplier;
    const weatherExtraRate = weather ? weather.extraWeeklyAttritionRate : 0;

    // Encircled provinces have 35% lower effective supply limit
    const supplyLimit = Math.round(
      calculateProvinceSupplyLimit(t, owner, season, tick, gameMode) *
        (isEncircled ? 0.65 : 1.0)
    );

    let nextGarrison = t.garrison;
    let nextUnits = t.units;
    let nextSiege = t.siege;
    let modified = false;

    const severeExposedGarrison =
      weather !== null &&
      weather.severity === 'SEVERE' &&
      ownerAtWar &&
      t.garrison > Math.max(2500, Math.round(supplyLimit * 0.65));

    // 1. Oversized garrison exceeding local supply limit, encircled wartime pocket, or severe-weather wartime exposure
    if (
      (t.garrison > supplyLimit && t.garrison > 1500) ||
      (isEncircled && ownerAtWar && t.garrison > 1000) ||
      severeExposedGarrison
    ) {
      const excessRatio = Math.max(
        0,
        (t.garrison - supplyLimit) / Math.max(1, supplyLimit)
      );
      const terrainHarshness =
        t.terrain === 'DAGLIK' || t.terrain === 'COL' ? 1.25 : 1.0;
      const encirclementBonusRate = isEncircled && ownerAtWar ? 0.038 : 0;
      const rate = Math.min(
        0.095,
        (0.012 + excessRatio * 0.032 + encirclementBonusRate + weatherExtraRate) *
          effAttritionMult *
          terrainHarshness
      );
      const rawLoss = Math.max(120, Math.round(t.garrison * rate));
      const floor =
        isEncircled && ownerAtWar
          ? 800
          : severeExposedGarrison && t.garrison <= supplyLimit
          ? Math.max(1500, Math.round(supplyLimit * 0.6))
          : Math.max(1500, Math.round(supplyLimit * 0.92));
      const clampedNext = Math.max(floor, t.garrison - rawLoss);
      const actualLoss = t.garrison - clampedNext;
      if (actualLoss > 0) {
        nextGarrison = clampedNext;
        nextUnits = scaleUnitComposition(
          t.units,
          clampedNext / Math.max(1, t.garrison),
          clampedNext
        );
        modified = true;

        if (t.ownerId === playerNationId) {
          playerAffectedCount += 1;
          playerTotalLoss += actualLoss;
          if (actualLoss > worstLoss) {
            worstLoss = actualLoss;
            worstPlayerProvinceName = t.name;
            worstPlayerWeatherLabel = weather ? weather.label : season.name;
          }
        }
      }
    }

    // 2. Besieging army in harsh winter, monsoon, heatwave, mountains, desert, or above supply limit suffers attrition
    if (t.siege && t.siege.attackerTroops > 1000) {
      const harshWeatherSiege =
        weather !== null &&
        (weather.condition === 'SEVERE_WINTER' ||
          weather.condition === 'MONSOON' ||
          weather.condition === 'HEATWAVE' ||
          weather.condition === 'MILD_WINTER');
      const harshSiege =
        season.id === 'WINTER' ||
        harshWeatherSiege ||
        t.terrain === 'DAGLIK' ||
        t.terrain === 'COL' ||
        t.siege.attackerTroops > supplyLimit * 0.95;
      if (harshSiege) {
        const siegeRate = Math.min(
          0.068,
          (0.018 + weatherExtraRate * 0.85) *
            effAttritionMult *
            (t.terrain === 'DAGLIK' || t.terrain === 'COL' ? 1.2 : 1.0)
        );
        const siegeLoss = Math.max(120, Math.round(t.siege.attackerTroops * siegeRate));
        const nextAttTroops = Math.max(900, t.siege.attackerTroops - siegeLoss);
        if (nextAttTroops < t.siege.attackerTroops) {
          nextSiege = {
            ...t.siege,
            attackerTroops: nextAttTroops,
            attackerUnits: scaleUnitComposition(
              t.siege.attackerUnits,
              nextAttTroops / Math.max(1, t.siege.attackerTroops),
              nextAttTroops
            ),
          };
          modified = true;
          if (t.siege.attackerId === playerNationId) {
            const actualSiegeLoss = t.siege.attackerTroops - nextAttTroops;
            playerAffectedCount += 1;
            playerTotalLoss += actualSiegeLoss;
            if (actualSiegeLoss > worstLoss) {
              worstLoss = actualSiegeLoss;
              worstPlayerProvinceName = t.name;
              worstPlayerWeatherLabel = weather ? weather.label : season.name;
            }
          }
        }
      }
    }

    if (modified) {
      writeTerr(t.id, {
        ...t,
        garrison: nextGarrison,
        units: nextUnits,
        siege: nextSiege,
      });
    }
  }

  return {
    updatedTerritories: nextTerrs,
    changed: cloned,
    playerAffectedCount,
    playerTotalLoss,
    worstPlayerProvinceName,
    worstPlayerWeatherLabel,
    encircledProvinceIds: encircledIds,
  };
}

export interface CapitulationCheckResult {
  updatedNations: Record<string, Nation>;
  updatedTerritories: Record<string, Territory>;
  updatedRelations: Record<string, DiplomaticRelation>;
  updatedWars: ActiveWar[];
  newsItems: {
    title: string;
    description: string;
    type: WorldNewsEvent['type'];
  }[];
  playerToasts: string[];
  capitulatedCount: number;
}

/**
 * Evaluates AoH2 DE-style Automatic Capitulation when a belligerent has >= 75% of its homeland
 * occupied and trails by >= 50 war score (or has 100% occupied). Prevents endless late-game wars.
 */
export function evaluateAutomaticCapitulations(params: {
  nextTick: number;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  thresholdPct?: number;
}): CapitulationCheckResult {
  const {
    nextTick,
    playerNationId,
    nations,
    territories,
    relations,
    wars,
    thresholdPct = 75,
  } = params;

  if (wars.length === 0) {
    return {
      updatedNations: nations,
      updatedTerritories: territories,
      updatedRelations: relations,
      updatedWars: wars,
      newsItems: [],
      playerToasts: [],
      capitulatedCount: 0,
    };
  }

  let nextNations = nations;
  let nextTerritories = territories;
  let nextRelations = relations;
  const remainingWars: ActiveWar[] = [];
  const newsItems: CapitulationCheckResult['newsItems'] = [];
  const playerToasts: string[] = [];
  let capitulatedCount = 0;

  const ensureCloned = () => {
    if (nextNations === nations) nextNations = { ...nations };
    if (nextTerritories === territories) nextTerritories = { ...territories };
    if (nextRelations === relations) nextRelations = { ...relations };
  };

  for (const war of wars) {
    const duration = nextTick - war.startedTick;
    if (duration < 10) {
      remainingWars.push(war);
      continue;
    }

    const checkSideCapitulation = (
      loserId: string,
      winnerId: string,
      winnerSideIds: string[],
      winnerScore: number
    ): boolean => {
      // Never auto-capitulate the human player — let the player choose surrender or fight on!
      if (loserId === playerNationId) return false;

      const loserNation = nextNations[loserId];
      const winnerNation = nextNations[winnerId];
      if (!loserNation || !winnerNation || loserNation.isEliminated) return false;

      const ownedByLoser = Object.values(nextTerritories).filter(
        (t) => t && t.ownerId === loserId
      );
      const occupiedFromLoser = Object.values(nextTerritories).filter(
        (t) =>
          t &&
          winnerSideIds.includes(t.ownerId) &&
          t.isOccupied &&
          t.coreOwnerId === loserId
      );

      const originalCount = ownedByLoser.length + occupiedFromLoser.length;
      if (originalCount === 0 || occupiedFromLoser.length === 0) return false;

      const occupiedPct = (occupiedFromLoser.length / originalCount) * 100;
      const meetsCapitulation =
        occupiedPct >= 100 ||
        (occupiedPct >= thresholdPct && winnerScore >= 50);

      if (!meetsCapitulation) return false;

      ensureCloned();

      // Finalize annexation of all occupied provinces held by winner's coalition
      let finalizedCount = 0;
      for (const occ of occupiedFromLoser) {
        const isCoreForHolder = occ.coreOwnerId === occ.ownerId;
        nextTerritories[occ.id] = {
          ...occ,
          isOccupied: false,
          occupiedById: undefined,
          siege: null,
          assimilation: isCoreForHolder ? 100 : Math.min(occ.assimilation ?? 25, 35),
          isAssimilating: false,
          unrest: isCoreForHolder ? Math.max(0, occ.unrest - 8) : Math.min(72, occ.unrest + 14),
        };
        finalizedCount += 1;
      }

      // If loser is left with 0 provinces, mark eliminated; else pay indemnity & sign truce
      const remainingLoserProvs = Object.values(nextTerritories).filter(
        (t) => t && t.ownerId === loserId
      );
      const isFullCollapse = remainingLoserProvs.length === 0;
      const indemnity = Math.min(
        900,
        Math.max(180, Math.round(loserNation.treasury * 0.35))
      );

      nextNations[winnerId] = {
        ...winnerNation,
        treasury: winnerNation.treasury + indemnity,
        stability: Math.min(100, winnerNation.stability + 5),
        aggressiveExpansion: Math.min(
          100,
          winnerNation.aggressiveExpansion + Math.min(16, finalizedCount * 4)
        ),
      };
      nextNations[loserId] = {
        ...loserNation,
        treasury: Math.max(0, loserNation.treasury - indemnity),
        isEliminated: isFullCollapse,
      };

      const penalty = applyConquestDiplomaticPenalty({
        conquerorId: winnerId,
        victimId: loserId,
        provincesTakenCount: Math.max(1, finalizedCount),
        isFullAnnexation: isFullCollapse,
        nations: nextNations,
        relations: nextRelations,
      });
      nextRelations = penalty.updatedRelations;

      const rKey = relationKey(winnerId, loserId);
      const curRel = getOrCreateRelation(nextRelations, winnerId, loserId);
      nextRelations[rKey] = {
        ...curRel,
        truceUntilTick: nextTick + 120,
      };

      newsItems.push({
        title: `🏳️ Otomatik Kapitülasyon: ${loserNation.name} Teslim Oldu`,
        description: `Topraklarının %${Math.round(occupiedPct)}'i işgal edilen ${loserNation.name}, ${winnerNation.name} karşısında teslim oldu (${finalizedCount} eyalet ilhak, +${indemnity} Altın tazminat).`,
        type: 'PEACE',
      });

      if (winnerId === playerNationId || winnerSideIds.includes(playerNationId)) {
        playerToasts.push(
          `🏳️ ${loserNation.name} kapitüle oldu! ${finalizedCount} işgal eyaleti kesinleşti (+${indemnity} Altın).`
        );
      }
      capitulatedCount += 1;
      return true;
    };

    const defenderCapitulated = checkSideCapitulation(
      war.defenderId,
      war.attackerId,
      war.attackers,
      war.attackerWarScore
    );
    if (defenderCapitulated) continue;

    const attackerCapitulated = checkSideCapitulation(
      war.attackerId,
      war.defenderId,
      war.defenders,
      -war.attackerWarScore
    );
    if (attackerCapitulated) continue;

    remainingWars.push(war);
  }

  return {
    updatedNations: nextNations,
    updatedTerritories: nextTerritories,
    updatedRelations: nextRelations,
    updatedWars: remainingWars,
    newsItems,
    playerToasts,
    capitulatedCount,
  };
}

/**
 * Periodically prunes dead/broken alliances (eliminated states, zero-province ghosts,
 * warring pairs, or collapsed hostile relations) every 14 game days (AoH2 DE standard).
 */
export function pruneDeadAlliances(params: {
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
}): { updatedRelations: Record<string, DiplomaticRelation>; prunedCount: number } {
  const { nations, territories, relations, wars } = params;

  const aliveWithLand = new Set<string>();
  for (const t of Object.values(territories)) {
    if (t?.ownerId && nations[t.ownerId] && !nations[t.ownerId].isEliminated) {
      aliveWithLand.add(t.ownerId);
    }
  }

  let nextRelations = relations;
  let cloned = false;
  let prunedCount = 0;

  for (const [key, rel] of Object.entries(relations)) {
    if (!rel) continue;
    const hasPact = Boolean(
      rel.isAllied ||
        rel.allianceType ||
        rel.hasNonAggression ||
        rel.hasTradeAgreement ||
        rel.hasMilitaryAccess
    );
    if (!hasPact) continue;

    const aAlive = aliveWithLand.has(rel.nationA);
    const bAlive = aliveWithLand.has(rel.nationB);
    const fighting = Boolean(isAtWar(wars, rel.nationA, rel.nationB));
    const hostileAllianceDecay =
      (rel.isAllied || Boolean(rel.allianceType)) && rel.score <= -30;

    if (!aAlive || !bAlive || fighting || hostileAllianceDecay) {
      if (!cloned) {
        nextRelations = { ...relations };
        cloned = true;
      }
      nextRelations[key] = {
        ...rel,
        isAllied: false,
        allianceType: null,
        hasNonAggression: fighting || !aAlive || !bAlive ? false : rel.hasNonAggression,
        hasTradeAgreement: fighting || !aAlive || !bAlive ? false : rel.hasTradeAgreement,
        hasMilitaryAccess: fighting || !aAlive || !bAlive ? false : rel.hasMilitaryAccess,
      };
      prunedCount += 1;
    }
  }

  return { updatedRelations: nextRelations, prunedCount };
}

/**
 * Evaluates Anti-Hegemon Coalition Pacts: when an expansionist superpower accumulates
 * high Aggressive Expansion (>= 68) and holds >= 4 provinces, threatened neighbors
 * automatically form mutual Defensive Coalition Pacts to preserve late-game balance.
 */
export function evaluateAntiHegemonCoalitions(params: {
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  playerNationId: string;
}): {
  updatedRelations: Record<string, DiplomaticRelation>;
  formedCoalitions: { hegemonName: string; memberNames: string[]; isAgainstPlayer: boolean }[];
} {
  const { nations, territories, relations, wars, playerNationId } = params;
  const provCountByNation: Record<string, number> = {};
  const neighborsByNation = new Map<string, Set<string>>();

  for (const t of Object.values(territories)) {
    if (!t || !t.ownerId) continue;
    provCountByNation[t.ownerId] = (provCountByNation[t.ownerId] || 0) + 1;
    let nbSet = neighborsByNation.get(t.ownerId);
    if (!nbSet) {
      nbSet = new Set<string>();
      neighborsByNation.set(t.ownerId, nbSet);
    }
    for (const nbId of t.neighbors) {
      const nbOwner = territories[nbId]?.ownerId;
      if (nbOwner && nbOwner !== t.ownerId) {
        nbSet.add(nbOwner);
      }
    }
  }

  let nextRelations = relations;
  let cloned = false;
  const formedCoalitions: {
    hegemonName: string;
    memberNames: string[];
    isAgainstPlayer: boolean;
  }[] = [];

  const hegemons = Object.values(nations).filter(
    (n) =>
      n &&
      !n.isEliminated &&
      (n.aggressiveExpansion || 0) >= 68 &&
      (provCountByNation[n.id] || 0) >= 3
  );

  for (const hegemon of hegemons) {
    const neighborIds = Array.from(neighborsByNation.get(hegemon.id) || []);
    const threatened = neighborIds
      .map((id) => nations[id])
      .filter((n): n is Nation => {
        if (!n || n.isEliminated || n.id === playerNationId) return false;
        if ((provCountByNation[n.id] || 0) === 0) return false;
        if (n.vassalOf === hegemon.id) return false;
        const relWithHeg = getOrCreateRelation(nextRelations, n.id, hegemon.id);
        if (relWithHeg.isAllied || relWithHeg.allianceType) return false;
        return relWithHeg.score <= -18 || Boolean(isAtWar(wars, n.id, hegemon.id));
      })
      .slice(0, 4);

    if (threatened.length < 2) continue;

    let newLinks = 0;
    const memberNamesSet = new Set<string>();

    for (let i = 0; i < threatened.length; i++) {
      for (let j = i + 1; j < threatened.length; j++) {
        const a = threatened[i];
        const b = threatened[j];
        if (isAtWar(wars, a.id, b.id)) continue;
        const rKey = relationKey(a.id, b.id);
        const curRel = getOrCreateRelation(nextRelations, a.id, b.id);
        if (curRel.isAllied || curRel.allianceType || curRel.score < -35) continue;

        if (!cloned) {
          nextRelations = { ...relations };
          cloned = true;
        }
        nextRelations[rKey] = {
          ...curRel,
          isAllied: true,
          allianceType: 'DEFENSIVE',
          hasNonAggression: true,
          score: Math.min(100, Math.max(35, curRel.score + 30)),
        };
        newLinks++;
        memberNamesSet.add(a.name);
        memberNamesSet.add(b.name);
      }
    }

    if (newLinks > 0) {
      formedCoalitions.push({
        hegemonName: hegemon.name,
        memberNames: Array.from(memberNamesSet),
        isAgainstPlayer: hegemon.id === playerNationId,
      });
    }
  }

  return { updatedRelations: nextRelations, formedCoalitions };
}

