import {
  ActiveWar,
  ArmyMovement,
  CultureId,
  GameModeId,
  Nation,
  NationRuler,
  PastRulerRecord,
  RulerDeathCause,
  RulerHeir,
  RulerTraitId,
  SuccessionChoiceOption,
  SuccessionEvent,
  Territory,
} from '../types/game';
import {
  CULTURAL_RULER_POOLS,
  DEATH_CAUSE_LABELS,
  HISTORICAL_DYNASTIES_1440,
  HistoricalRulerTemplate,
  MODERN_2026_FIRST_NAMES,
  RULER_TRAITS,
} from '../data/historicalDynasties';

const ALL_TRAIT_IDS: RulerTraitId[] = Object.keys(
  RULER_TRAITS
) as RulerTraitId[];

const ROMAN_NUMERALS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

/** Deterministic fast hash returning [0, 1) */
function hash01(seed: number, salt: string): number {
  let h = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

export function getGameYearFromTick(
  tick: number,
  gameMode: GameModeId | string = 'EMPIRES_1440'
): number {
  const startYear = gameMode === 'EMPIRES_1440' ? 1440 : 2026;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const dt = new Date(Date.UTC(startYear, 0, 1));
  dt.setUTCDate(dt.getUTCDate() + safeTick);
  return dt.getUTCFullYear();
}

export function getRulerAge(
  ruler: Pick<NationRuler, 'birthYear'> | Pick<RulerHeir, 'birthYear'>,
  currentYear: number
): number {
  return Math.max(15, Math.min(95, currentYear - ruler.birthYear));
}

export function isElectiveRegime(
  nation: Pick<Nation, 'ideology'>,
  gameMode: GameModeId
): boolean {
  if (gameMode === 'EMPIRES_1440') return false;
  return (
    nation.ideology === 'DEMOCRACY' ||
    nation.ideology === 'SOCIALIST' ||
    nation.ideology === 'TECHNO_CORPORATISM'
  );
}

/**
 * Formats a ruler's display title cleanly without duplicating title prefixes
 * (e.g. "Fatih Sultan Mehmed" stays "Fatih Sultan Mehmed", while "II. Murad" with title "Sultan" becomes "Sultan II. Murad").
 */
export function formatRulerFullTitle(
  ruler: Pick<NationRuler, 'name' | 'title'> | Pick<RulerHeir, 'name' | 'title'>
): string {
  const title = (ruler.title || '').trim();
  const name = (ruler.name || '').trim();
  if (!title) return name || 'Hükümdar';
  const lowerName = name.toLocaleLowerCase('tr-TR');
  const lowerTitle = title.toLocaleLowerCase('tr-TR');
  if (
    lowerName.includes(lowerTitle) ||
    lowerName.includes('sultan ') ||
    lowerName.startsWith('şah ') ||
    lowerName.startsWith('kral ') ||
    lowerName.startsWith('kraliçe ') ||
    lowerName.startsWith('imparator ') ||
    lowerName.startsWith('çar ') ||
    lowerName.startsWith('şehzade ') ||
    lowerName.startsWith('han ')
  ) {
    return name;
  }
  return `${title} ${name}`;
}

export function getLiveNationRulerName(
  nation: Nation | undefined | null,
  fallbackName = 'Hükümdar'
): string {
  if (nation?.ruler) {
    return formatRulerFullTitle(nation.ruler);
  }
  return fallbackName;
}

const NATION_ID_CULTURE_FALLBACK: Record<string, CultureId> = {
  '792': 'TURKIC_OGHUZ',
  '031': 'TURKIC_OGHUZ',
  '398': 'TURKIC_OGHUZ',
  '860': 'TURKIC_OGHUZ',
  '300': 'GREEK_BYZANTINE',
  '818': 'ARABIC_LEVANT',
  '682': 'ARABIC_LEVANT',
  '012': 'ARABIC_LEVANT',
  '504': 'ARABIC_LEVANT',
  '788': 'ARABIC_LEVANT',
  '887': 'ARABIC_LEVANT',
  '368': 'ARABIC_LEVANT',
  '760': 'ARABIC_LEVANT',
  '400': 'ARABIC_LEVANT',
  '364': 'PERSIAN_IRANIC',
  '356': 'PERSIAN_IRANIC',
  '050': 'PERSIAN_IRANIC',
  '586': 'PERSIAN_IRANIC',
  '004': 'PERSIAN_IRANIC',
  '643': 'SLAVIC_EAST_SOUTH',
  '804': 'SLAVIC_EAST_SOUTH',
  '616': 'SLAVIC_EAST_SOUTH',
  '440': 'SLAVIC_EAST_SOUTH',
  '348': 'SLAVIC_EAST_SOUTH',
  '642': 'SLAVIC_EAST_SOUTH',
  '688': 'SLAVIC_EAST_SOUTH',
  '100': 'SLAVIC_EAST_SOUTH',
  '276': 'GERMANIC_CENTRAL',
  '040': 'GERMANIC_CENTRAL',
  '756': 'GERMANIC_CENTRAL',
  '528': 'GERMANIC_CENTRAL',
  '826': 'GERMANIC_CENTRAL',
  '840': 'GERMANIC_CENTRAL',
  '124': 'GERMANIC_CENTRAL',
  '036': 'GERMANIC_CENTRAL',
  '752': 'GERMANIC_CENTRAL',
  '578': 'GERMANIC_CENTRAL',
  '208': 'GERMANIC_CENTRAL',
  '905': 'GERMANIC_CENTRAL',
  '250': 'ROMANCE_LATIN',
  '380': 'ROMANCE_LATIN',
  '724': 'ROMANCE_LATIN',
  '620': 'ROMANCE_LATIN',
  '156': 'SINIC_HAN',
  '410': 'SINIC_HAN',
  '158': 'SINIC_HAN',
  '392': 'JAPANESE_YAMATO',
  '076': 'AMERINDIAN',
  '484': 'AMERINDIAN',
  '032': 'AMERINDIAN',
  '170': 'AMERINDIAN',
  '604': 'AMERINDIAN',
  '804_KHAN': 'MONGOL_STEPPE',
  '902': 'MONGOL_STEPPE',
  '903': 'MONGOL_STEPPE',
  '496': 'MONGOL_STEPPE',
};

function resolveCulturePool(nation: Pick<Nation, 'primaryCulture' | 'id'>) {
  const culture: CultureId =
    nation.primaryCulture ||
    NATION_ID_CULTURE_FALLBACK[nation.id] ||
    'ROMANCE_LATIN';
  return CULTURAL_RULER_POOLS[culture] || CULTURAL_RULER_POOLS.ROMANCE_LATIN;
}

function makeProceduralRulerCandidate(params: {
  nation: Pick<Nation, 'id' | 'name' | 'ideology' | 'primaryCulture'>;
  gameMode: GameModeId;
  currentYear: number;
  generationIndex: number;
  seed: number;
  isHeir: boolean;
  existingDynastyName?: string;
}): RulerHeir {
  const {
    nation,
    gameMode,
    currentYear,
    generationIndex,
    seed,
    isHeir,
    existingDynastyName,
  } = params;
  const pool = resolveCulturePool(nation);
  const elective = isElectiveRegime(nation, gameMode);
  const saltBase = `ruler_${nation.id}_${generationIndex}_${isHeir ? 'h' : 'r'}`;

  const givenIdx = Math.floor(
    hash01(seed, `${saltBase}_g`) * pool.givenNames.length
  );
  const surnameIdx = Math.floor(
    hash01(seed, `${saltBase}_s`) * pool.modernSurnames.length
  );
  const given = pool.givenNames[givenIdx] || 'Ahmed';
  const surname = pool.modernSurnames[surnameIdx] || 'Karahan';

  const dynastyName = elective
    ? 'Ulusal Yönetim'
    : existingDynastyName || pool.dynastyFallback;

  let name: string;
  let title: string;
  if (elective || gameMode !== 'EMPIRES_1440') {
    const modernPreset =
      generationIndex === 0 && !isHeir
        ? MODERN_2026_FIRST_NAMES[nation.id]
        : undefined;
    if (modernPreset) {
      name = modernPreset.name;
      title = elective ? modernPreset.title : pool.republicTitle;
    } else {
      name = `${given} ${surname}`;
      title =
        nation.ideology === 'MONARCHY' ? pool.monarchyTitle : pool.republicTitle;
    }
  } else {
    const numeralIdx = Math.min(
      ROMAN_NUMERALS.length - 1,
      Math.floor(hash01(seed, `${saltBase}_num`) * 5) +
        Math.min(5, Math.floor(generationIndex / 2))
    );
    const roman = ROMAN_NUMERALS[numeralIdx] || 'III';
    name = `${roman}. ${given}`;
    title = isHeir
      ? nation.primaryCulture === 'TURKIC_OGHUZ'
        ? 'Şehzade'
        : 'Veliaht'
      : pool.monarchyTitle;
  }

  // Balanced 2..5 stats (occasional 6 or 1 for drama)
  const rollSkill = (k: string) => {
    const r = hash01(seed, `${saltBase}_${k}`);
    if (r < 0.08) return 1;
    if (r < 0.25) return 2;
    if (r < 0.52) return 3;
    if (r < 0.78) return 4;
    if (r < 0.94) return 5;
    return 6;
  };

  const traitIdx = Math.floor(
    hash01(seed, `${saltBase}_tr`) * ALL_TRAIT_IDS.length
  );
  const traitId = ALL_TRAIT_IDS[traitIdx] || 'CAUTIOUS';

  const ageTarget = elective
    ? 44 + Math.floor(hash01(seed, `${saltBase}_age`) * 18)
    : isHeir
    ? 17 + Math.floor(hash01(seed, `${saltBase}_age`) * 14)
    : 26 + Math.floor(hash01(seed, `${saltBase}_age`) * 22);

  return {
    name,
    title,
    dynastyName,
    birthYear: currentYear - ageTarget,
    admin: rollSkill('adm'),
    diplomacy: rollSkill('dip'),
    military: rollSkill('mil'),
    traitId,
    isHistorical: false,
  };
}

function templateToRuler(
  tpl: HistoricalRulerTemplate,
  nationId: string,
  currentYear: number,
  currentTick: number,
  queueIdx: number
): NationRuler {
  return {
    id: `ruler_${nationId}_${queueIdx}_${currentTick}`,
    name: tpl.name,
    title: tpl.title,
    dynastyName: tpl.dynastyName,
    birthYear: currentYear - tpl.startAge,
    reignStartYear: currentYear,
    reignStartTick: currentTick,
    admin: tpl.admin,
    diplomacy: tpl.diplomacy,
    military: tpl.military,
    traitId: tpl.traitId,
    isElected: false,
  };
}

function templateToHeir(
  tpl: HistoricalRulerTemplate,
  currentYear: number,
  _nationCulture?: CultureId
): RulerHeir {
  const heirAge = Math.max(15, Math.min(34, tpl.startAge - 6));
  return {
    name: tpl.name,
    title: '',
    dynastyName: tpl.dynastyName,
    birthYear: currentYear - heirAge,
    admin: tpl.admin,
    diplomacy: tpl.diplomacy,
    military: tpl.military,
    traitId: tpl.traitId,
    isHistorical: true,
  };
}

function buildNextHeirForNation(params: {
  nation: Pick<Nation, 'id' | 'name' | 'ideology' | 'primaryCulture'>;
  gameMode: GameModeId;
  nextQueueIndex: number;
  currentYear: number;
  seed: number;
  existingDynastyName?: string;
}): RulerHeir {
  const {
    nation,
    gameMode,
    nextQueueIndex,
    currentYear,
    seed,
    existingDynastyName,
  } = params;
  if (gameMode === 'EMPIRES_1440') {
    const queue = HISTORICAL_DYNASTIES_1440[nation.id];
    if (queue && nextQueueIndex < queue.length) {
      return templateToHeir(
        queue[nextQueueIndex],
        currentYear,
        nation.primaryCulture
      );
    }
  }
  return makeProceduralRulerCandidate({
    nation,
    gameMode,
    currentYear,
    generationIndex: nextQueueIndex,
    seed,
    isHeir: true,
    existingDynastyName,
  });
}

/**
 * Ensures any nation (newly created or loaded from an older save) has a complete
 * `ruler`, `heir`, `dynastyHistory`, and `dynastyQueueIndex`.
 */
export function ensureNationRulerState(
  nation: Nation,
  gameMode: GameModeId,
  tick: number,
  worldSeed = 1440
): Nation {
  if (nation.ruler && nation.heir !== undefined && nation.dynastyHistory) {
    return nation;
  }

  const currentYear = getGameYearFromTick(tick, gameMode);
  const elective = isElectiveRegime(nation, gameMode);
  const queueIndex = nation.dynastyQueueIndex ?? 0;

  let ruler = nation.ruler;
  if (!ruler) {
    if (gameMode === 'EMPIRES_1440') {
      const queue = HISTORICAL_DYNASTIES_1440[nation.id];
      if (queue && queue[queueIndex]) {
        ruler = templateToRuler(
          queue[queueIndex],
          nation.id,
          currentYear,
          tick,
          queueIndex
        );
      }
    }

    if (!ruler) {
      const generated = makeProceduralRulerCandidate({
        nation,
        gameMode,
        currentYear,
        generationIndex: queueIndex,
        seed: worldSeed,
        isHeir: false,
      });
      const modernPreset =
        gameMode !== 'EMPIRES_1440'
          ? MODERN_2026_FIRST_NAMES[nation.id]
          : undefined;
      ruler = {
        id: `ruler_${nation.id}_${queueIndex}_${tick}`,
        name: generated.name,
        title: generated.title,
        dynastyName: generated.dynastyName,
        birthYear: modernPreset
          ? currentYear - modernPreset.age
          : generated.birthYear,
        reignStartYear: currentYear,
        reignStartTick: tick,
        admin: generated.admin,
        diplomacy: generated.diplomacy,
        military: generated.military,
        traitId: generated.traitId,
        isElected: elective,
        termLimitYears: elective
          ? nation.ideology === 'DEMOCRACY'
            ? 4
            : 5
          : undefined,
      };
    }
  }

  const heir =
    nation.heir !== undefined
      ? nation.heir
      : buildNextHeirForNation({
          nation,
          gameMode,
          nextQueueIndex: queueIndex + 1,
          currentYear,
          seed: worldSeed,
          existingDynastyName: ruler.dynastyName,
        });

  return {
    ...nation,
    ruler,
    heir,
    dynastyHistory: nation.dynastyHistory ?? [],
    dynastyQueueIndex: queueIndex,
  };
}

export function ensureAllNationsHaveRulers(
  nations: Record<string, Nation>,
  gameMode: GameModeId,
  tick: number,
  worldSeed = 1440
): Record<string, Nation> {
  let changed = false;
  const out: Record<string, Nation> = {};
  for (const [id, nat] of Object.entries(nations)) {
    const nextNat = ensureNationRulerState(nat, gameMode, tick, worldSeed);
    if (nextNat !== nat) changed = true;
    out[id] = nextNat;
  }
  return changed ? out : nations;
}

export interface RulerGameplayModifiers {
  taxMultDelta: number; // e.g. +0.08 means +8% tax
  tradeMultDelta: number;
  researchMultDelta: number;
  manpowerMultDelta: number;
  combatAttackDelta: number;
  combatDefenseDelta: number;
  siegeSpeedBonus: number;
  aeDecayBonus: number;
  stabilityRecoveryBonus: number;
  extraDiplomacyPoint: boolean;
  coupResistance: number;
}

/**
 * Computes balanced, realistic national bonuses/penalties from the reigning ruler's
 * Admin/Diplomacy/Military skills (1..6, neutral at 3) and personality trait.
 * Effects are kept realistic (~-4% to +14%) so great monarchs clearly shine without breaking balance.
 */
export function getRulerModifiers(
  nation: Pick<Nation, 'ruler'> | null | undefined
): RulerGameplayModifiers {
  const ruler = nation?.ruler;
  if (!ruler) {
    return {
      taxMultDelta: 0,
      tradeMultDelta: 0,
      researchMultDelta: 0,
      manpowerMultDelta: 0,
      combatAttackDelta: 0,
      combatDefenseDelta: 0,
      siegeSpeedBonus: 0,
      aeDecayBonus: 0,
      stabilityRecoveryBonus: 0,
      extraDiplomacyPoint: false,
      coupResistance: 0,
    };
  }

  const trait = RULER_TRAITS[ruler.traitId] || RULER_TRAITS.CAUTIOUS;
  const admOffset = Math.max(-2, Math.min(3, ruler.admin - 3));
  const dipOffset = Math.max(-2, Math.min(3, ruler.diplomacy - 3));
  const milOffset = Math.max(-2, Math.min(3, ruler.military - 3));

  return {
    taxMultDelta: Number(
      (admOffset * 0.025 + (trait.taxBonusPct || 0) / 100).toFixed(4)
    ),
    tradeMultDelta: Number(((trait.tradeBonusPct || 0) / 100).toFixed(4)),
    researchMultDelta: Number(((trait.researchBonusPct || 0) / 100).toFixed(4)),
    manpowerMultDelta: Number(
      (milOffset * 0.02 + (trait.manpowerBonusPct || 0) / 100).toFixed(4)
    ),
    combatAttackDelta: Number(
      (milOffset * 0.022 + (trait.attackBonusPct || 0) / 100).toFixed(4)
    ),
    combatDefenseDelta: Number(
      (milOffset * 0.018 + (trait.defenseBonusPct || 0) / 100).toFixed(4)
    ),
    siegeSpeedBonus: Number(
      (
        Math.max(0, milOffset) * 0.03 +
        (trait.siegeSpeedPct || 0) / 100
      ).toFixed(4)
    ),
    aeDecayBonus: Number(
      (
        Math.max(-0.02, dipOffset * 0.015) +
        (trait.aeDecayBonus || 0)
      ).toFixed(4)
    ),
    stabilityRecoveryBonus: Number(
      (
        Math.max(0, admOffset) * 0.02 +
        (trait.stabilityBonus || 0)
      ).toFixed(4)
    ),
    extraDiplomacyPoint: ruler.diplomacy >= 5,
    coupResistance: trait.coupResistance || 0,
  };
}

export interface MortalityRiskContext {
  age: number;
  reignDays: number;
  isAtWar: boolean;
  hasActiveCampaign: boolean;
  isCapitalUnderSiege: boolean;
  isWinter: boolean;
  stability: number;
  minLordLoyalty: number;
  scienceTechCount: number;
  coupResistance: number;
}

export interface MortalityRiskBreakdown {
  totalMonthlyProb: number;
  naturalWeight: number;
  illnessWeight: number;
  campaignWeight: number;
  coupWeight: number;
  accidentWeight: number;
}

/**
 * Pure actuarial + gameplay-sensitive monthly mortality calculator.
 * No fixed historical death dates — longevity emerges organically from age, war, stability, winter, and science.
 */
export function computeMonthlyDeathProbability(
  ctx: MortalityRiskContext
): MortalityRiskBreakdown {
  const {
    age,
    reignDays,
    isAtWar,
    hasActiveCampaign,
    isCapitalUnderSiege,
    isWinter,
    stability,
    minLordLoyalty,
    scienceTechCount,
    coupResistance,
  } = ctx;

  // Science & medicine technologies reduce natural and illness risk up to -32%
  const medicineFactor = Math.max(0.68, 1 - scienceTechCount * 0.04);

  // Base age-driven natural hazard per month (12 checks/year)
  let baseNatural = 0.0005;
  if (age < 35) {
    baseNatural = 0.0006;
  } else if (age < 50) {
    baseNatural = 0.0014 + (age - 35) * 0.00016;
  } else if (age < 63) {
    baseNatural = 0.004 + (age - 50) * 0.00048;
  } else if (age < 75) {
    baseNatural = 0.0105 + (age - 63) * 0.00145;
  } else {
    baseNatural = 0.029 + (age - 75) * 0.0038;
  }

  const naturalWeight = baseNatural * medicineFactor;
  const illnessWeight =
    (0.0007 + (isWinter ? 0.0014 : 0) + (isCapitalUnderSiege ? 0.0042 : 0)) *
    medicineFactor;
  const campaignWeight =
    isAtWar && hasActiveCampaign
      ? 0.0032
      : isAtWar
      ? 0.0012
      : 0;

  let rawCoup = 0;
  if (stability < 45) {
    rawCoup += ((45 - stability) / 45) * 0.0052;
  }
  if (minLordLoyalty < 38) {
    rawCoup += ((38 - minLordLoyalty) / 38) * 0.0038;
  }
  const coupWeight = rawCoup * Math.max(0.25, 1 - coupResistance);

  const accidentWeight = 0.00045;

  // First 12 months grace period avoids jarring immediate back-to-back successions unless coup/siege occurs
  const graceScale = reignDays < 360 ? 0.15 : 1.0;

  const rawTotal =
    (naturalWeight + illnessWeight + campaignWeight + accidentWeight) *
      graceScale +
    coupWeight;

  return {
    totalMonthlyProb: Math.min(0.14, Math.max(0, rawTotal)),
    naturalWeight: naturalWeight * graceScale,
    illnessWeight: illnessWeight * graceScale,
    campaignWeight: campaignWeight * graceScale,
    coupWeight,
    accidentWeight: accidentWeight * graceScale,
  };
}

export function pickRealisticDeathCause(
  breakdown: MortalityRiskBreakdown,
  roll01: number
): RulerDeathCause {
  const sum =
    breakdown.naturalWeight +
    breakdown.illnessWeight +
    breakdown.campaignWeight +
    breakdown.coupWeight +
    breakdown.accidentWeight;
  if (sum <= 0) return 'NATURAL_AGE';

  let cursor = Math.max(0, Math.min(0.9999, roll01)) * sum;
  if (cursor < breakdown.coupWeight) return 'PALACE_COUP';
  cursor -= breakdown.coupWeight;
  if (cursor < breakdown.campaignWeight) return 'CAMPAIGN_WOUNDS';
  cursor -= breakdown.campaignWeight;
  if (cursor < breakdown.illnessWeight) return 'ILLNESS';
  cursor -= breakdown.illnessWeight;
  if (cursor < breakdown.accidentWeight) return 'HUNTING_ACCIDENT';
  return 'NATURAL_AGE';
}

function buildSuccessionEventForPlayer(params: {
  nation: Nation;
  previousRuler: PastRulerRecord;
  incomingRuler: NationRuler;
  nextHeir: RulerHeir;
  isElection: boolean;
  eventYear: number;
  nextTick: number;
  gameMode: GameModeId;
}): SuccessionEvent {
  const {
    nation,
    previousRuler,
    incomingRuler,
    nextHeir,
    isElection,
    eventYear,
    nextTick,
    gameMode,
  } = params;

  const prevDisplay = formatRulerFullTitle(previousRuler);
  const incDisplay = formatRulerFullTitle(incomingRuler);
  const causeMeta = DEATH_CAUSE_LABELS[previousRuler.cause];
  const reignYears = Math.max(
    1,
    previousRuler.reignEndYear - previousRuler.reignStartYear
  );

  if (isElection) {
    const campaignCost = Math.max(
      150,
      Math.min(1800, Math.round(nation.treasury * 0.1))
    );
    const canReelect = previousRuler.ageAtEnd < 74;
    const options: SuccessionChoiceOption[] = [
      {
        id: 'NEW_MANDATE',
        label: `Görevi Devret: ${incDisplay}`,
        subtitle: 'Demokratik geçiş ve yeni dönem programı',
        effectSummary: `Yeni lider göreve başlar · +3 İstikrar · +10 Prestij`,
        goldCost: 0,
        stabilityDelta: 3,
        prestigeDelta: 10,
      },
    ];
    if (canReelect) {
      options.push({
        id: 'REELECT_INCUMBENT',
        label: `Yeniden Seçil: ${prevDisplay}`,
        subtitle: 'Seçim kampanyasıyla mevcut lider bir dönem daha sürsün',
        effectSummary: `-${campaignCost.toLocaleString('tr-TR')} Altın · Mevcut lider devam eder · +2 İstikrar`,
        goldCost: campaignCost,
        stabilityDelta: 2,
        prestigeDelta: 6,
      });
    }

    return {
      id: `succ_${nation.id}_${nextTick}`,
      nationId: nation.id,
      nationName: nation.name,
      isElection: true,
      eventYear,
      previousRuler,
      incomingRuler,
      nextHeir,
      headline: `${eventYear} Genel Seçimleri — ${nation.name}`,
      description: `${prevDisplay}, ${reignYears} yıllık görev süresini tamamladı. Sandıktan çıkan yeni aday ${incDisplay} yönetimi devralmaya hazır.`,
      options,
    };
  }

  const isOttoman = nation.id === '792' && gameMode === 'EMPIRES_1440';
  const donativeCost = Math.max(
    160,
    Math.min(2400, Math.round(nation.treasury * 0.14))
  );

  const options: SuccessionChoiceOption[] = [
    {
      id: 'CORONATION_DONATIVE',
      label: isOttoman
        ? 'Cülus Bahşişi Dağıt & Görkemli Biat'
        : 'Görkemli Taç Giyme Töreni Düzenle',
      subtitle: isOttoman
        ? 'Kapıkulu ve devlet erkânına cülus dağıtıp tahtı pekiştir'
        : 'Soylulara ve orduya cömert ikramlarla sadakati güvenceye al',
      effectSummary: `-${donativeCost.toLocaleString('tr-TR')} Altın · +4 İstikrar · +18 Prestij`,
      goldCost: donativeCost,
      stabilityDelta: 4,
      prestigeDelta: 18,
    },
    {
      id: 'FRUGAL_TRANSITION',
      label: 'Hazineyi Koru · Sade Tahta Çıkış',
      subtitle: 'Harcama yapma; saray ve ordudaki geçici hoşnutsuzluğu göze al',
      effectSummary: `0 Altın · -6 İstikrar · -5 Prestij`,
      goldCost: 0,
      stabilityDelta: -6,
      prestigeDelta: -5,
    },
  ];

  return {
    id: `succ_${nation.id}_${nextTick}`,
    nationId: nation.id,
    nationName: nation.name,
    isElection: false,
    eventYear,
    previousRuler,
    incomingRuler,
    nextHeir,
    headline: isOttoman
      ? `Taht Değişimi: ${incDisplay} Tahta Çıktı`
      : `Hükümdar Vefatı & Yeni Taç: ${incDisplay}`,
    description: `${prevDisplay} (${previousRuler.ageAtEnd} yaşında, ${reignYears} yıllık saltanatının ardından) ${causeMeta.chroniclePhrase}. ${incomingRuler.dynastyName} hanedanından ${incDisplay} tahtı devraldı.`,
    options,
  };
}

export interface MonthlySuccessionResult {
  updatedNations: Record<string, Nation> | null;
  playerSuccessionEvent: SuccessionEvent | null;
  newsItems: {
    title: string;
    description: string;
    type: 'REFORM';
  }[];
  playerAlerts: string[];
}

/**
 * Evaluates monthly ruler mortality (1440 & autocracies/monarchies) and periodic election cycles (2026 elective states).
 * Runs once per 30 days so CPU/FPS cost is virtually zero.
 */
export function evaluateMonthlyDynastySuccession(params: {
  nextTick: number;
  gameMode: GameModeId;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  wars: ActiveWar[];
  movements: ArmyMovement[];
  isWinter: boolean;
  worldSeed?: number;
  suppressPlayerModal?: boolean;
}): MonthlySuccessionResult {
  const {
    nextTick,
    gameMode,
    playerNationId,
    nations,
    territories,
    wars,
    movements,
    isWinter,
    worldSeed = 1440,
    suppressPlayerModal = false,
  } = params;

  const currentYear = getGameYearFromTick(nextTick, gameMode);

  // Precompute province counts, capital sieges, and player neighbor set in O(T)
  const provCountByNation: Record<string, number> = {};
  const playerNeighborNationIds = new Set<string>();
  const capitalSiegedNationIds = new Set<string>();

  for (const t of Object.values(territories)) {
    if (!t?.ownerId) continue;
    provCountByNation[t.ownerId] = (provCountByNation[t.ownerId] || 0) + 1;
    if (t.isCapital && t.siege) {
      capitalSiegedNationIds.add(t.ownerId);
    }
    if (t.ownerId === playerNationId) {
      for (const nId of t.neighbors || []) {
        const nb = territories[nId];
        if (nb?.ownerId && nb.ownerId !== playerNationId) {
          playerNeighborNationIds.add(nb.ownerId);
        }
      }
    }
  }

  const marchingNations = new Set<string>();
  for (const m of movements) {
    if (m?.ownerId) marchingNations.add(m.ownerId);
  }

  const warringNations = new Set<string>();
  for (const w of wars) {
    if (!w) continue;
    warringNations.add(w.attackerId);
    warringNations.add(w.defenderId);
    w.attackers?.forEach((id) => warringNations.add(id));
    w.defenders?.forEach((id) => warringNations.add(id));
  }

  let nextNations: Record<string, Nation> | null = null;
  let playerSuccessionEvent: SuccessionEvent | null = null;
  const newsItems: { title: string; description: string; type: 'REFORM' }[] =
    [];
  const playerAlerts: string[] = [];

  const writeNation = (id: string, updated: Nation) => {
    if (!nextNations) {
      nextNations = { ...nations };
    }
    nextNations[id] = updated;
  };

  for (const rawNat of Object.values(nations)) {
    if (!rawNat || rawNat.isEliminated) continue;
    const provCount = provCountByNation[rawNat.id] || 0;
    if (provCount === 0) continue;

    const nat = ensureNationRulerState(rawNat, gameMode, nextTick, worldSeed);
    if (nat !== rawNat) {
      writeNation(nat.id, nat);
    }

    const ruler = nat.ruler!;
    const age = getRulerAge(ruler, currentYear);
    const reignDays = Math.max(0, nextTick - (ruler.reignStartTick || 0));
    const elective = isElectiveRegime(nat, gameMode);

    let triggeredCause: RulerDeathCause | null = null;
    let isElectionTransition = false;

    if (elective) {
      const termYears = ruler.termLimitYears || 4;
      if (reignDays >= termYears * 365) {
        isElectionTransition = true;
        triggeredCause = 'TERM_ENDED';
      }
    }

    if (!triggeredCause) {
      const loyalties = Object.values(nat.lordLoyalties || {});
      const minLordLoyalty =
        loyalties.length > 0 ? Math.min(...loyalties) : 70;
      const scienceTechCount = (nat.unlockedTechs || []).filter((id) =>
        id.startsWith('sci_')
      ).length;
      const mods = getRulerModifiers(nat);

      const risk = computeMonthlyDeathProbability({
        age,
        reignDays,
        isAtWar: warringNations.has(nat.id),
        hasActiveCampaign: marchingNations.has(nat.id),
        isCapitalUnderSiege: capitalSiegedNationIds.has(nat.id),
        isWinter,
        stability: nat.stability ?? 75,
        minLordLoyalty,
        scienceTechCount,
        coupResistance: mods.coupResistance,
      });

      const mortalityRoll = hash01(
        worldSeed + nextTick * 31,
        `mort_${nat.id}_${nextTick}_${ruler.id}`
      );
      if (mortalityRoll < risk.totalMonthlyProb) {
        const causeRoll = hash01(
          worldSeed + nextTick * 17,
          `cause_${nat.id}_${nextTick}_${ruler.id}`
        );
        triggeredCause = pickRealisticDeathCause(risk, causeRoll);
      }
    }

    if (!triggeredCause) continue;

    const isPlayer = nat.id === playerNationId;
    if (isPlayer && suppressPlayerModal) {
      continue;
    }

    const nextQueueIdx = (nat.dynastyQueueIndex ?? 0) + 1;
    const promotedHeir =
      nat.heir ||
      buildNextHeirForNation({
        nation: nat,
        gameMode,
        nextQueueIndex: nextQueueIdx,
        currentYear,
        seed: worldSeed,
        existingDynastyName: ruler.dynastyName,
      });

    // When promoting a historical heir, restore the full sovereign title from the template
    const histQueue =
      gameMode === 'EMPIRES_1440' ? HISTORICAL_DYNASTIES_1440[nat.id] : undefined;
    const matchedHistTemplate =
      histQueue && nextQueueIdx < histQueue.length
        ? histQueue[nextQueueIdx]
        : undefined;

    const pool = resolveCulturePool(nat);
    const incomingTitle = matchedHistTemplate
      ? matchedHistTemplate.title
      : elective
      ? pool.republicTitle
      : promotedHeir.title === 'Şehzade' || promotedHeir.title === 'Veliaht'
      ? pool.monarchyTitle
      : promotedHeir.title;

    // Ensure realistic ascending age (17..62)
    const rawIncomingAge = currentYear - promotedHeir.birthYear;
    const clampedIncomingAge = Math.max(
      17,
      Math.min(elective ? 62 : 52, rawIncomingAge)
    );

    const incomingRuler: NationRuler = {
      id: `ruler_${nat.id}_${nextQueueIdx}_${nextTick}`,
      name: promotedHeir.name,
      title: incomingTitle,
      dynastyName: promotedHeir.dynastyName,
      birthYear: currentYear - clampedIncomingAge,
      reignStartYear: currentYear,
      reignStartTick: nextTick,
      admin: promotedHeir.admin,
      diplomacy: promotedHeir.diplomacy,
      military: promotedHeir.military,
      traitId: promotedHeir.traitId,
      isElected: elective,
      termLimitYears: elective
        ? nat.ideology === 'DEMOCRACY'
          ? 4
          : 5
        : undefined,
    };

    const nextHeir = buildNextHeirForNation({
      nation: nat,
      gameMode,
      nextQueueIndex: nextQueueIdx + 1,
      currentYear,
      seed: worldSeed + nextTick,
      existingDynastyName: incomingRuler.dynastyName,
    });

    const pastRecord: PastRulerRecord = {
      name: ruler.name,
      title: ruler.title,
      dynastyName: ruler.dynastyName,
      reignStartYear: ruler.reignStartYear,
      reignEndYear: currentYear,
      ageAtEnd: age,
      cause: triggeredCause,
      admin: ruler.admin,
      diplomacy: ruler.diplomacy,
      military: ruler.military,
      traitId: ruler.traitId,
    };

    if (isPlayer) {
      // For player: pause and present realistic Coronation / Election decision modal.
      // For monarchies, immediately crown the incoming ruler so UI reflects it; choice applies treasury/stability.
      // For elections, keep ruler until player chooses New Mandate vs Re-elect.
      const playerEvent = buildSuccessionEventForPlayer({
        nation: nat,
        previousRuler: pastRecord,
        incomingRuler,
        nextHeir,
        isElection: isElectionTransition,
        eventYear: currentYear,
        nextTick,
        gameMode,
      });
      playerSuccessionEvent = playerEvent;

      if (!isElectionTransition) {
        writeNation(nat.id, {
          ...nat,
          ruler: incomingRuler,
          heir: nextHeir,
          dynastyHistory: [pastRecord, ...(nat.dynastyHistory || [])].slice(
            0,
            24
          ),
          dynastyQueueIndex: nextQueueIdx,
        });
      }
      continue;
    }

    // AI nation transition: resolve coronation / election smoothly in background
    const aiCanAffordCoronation = nat.treasury >= 600 && !isElectionTransition;
    const aiCoronationCost = aiCanAffordCoronation
      ? Math.min(1200, Math.round(nat.treasury * 0.1))
      : 0;
    const aiStabilityDelta = isElectionTransition
      ? 2
      : aiCanAffordCoronation
      ? 2
      : -4;

    writeNation(nat.id, {
      ...nat,
      treasury: Math.max(0, nat.treasury - aiCoronationCost),
      stability: Math.max(
        15,
        Math.min(100, (nat.stability ?? 75) + aiStabilityDelta)
      ),
      ruler: incomingRuler,
      heir: nextHeir,
      dynastyHistory: [pastRecord, ...(nat.dynastyHistory || [])].slice(0, 20),
      dynastyQueueIndex: nextQueueIdx,
    });

    const isMajorOrNeighbor =
      playerNeighborNationIds.has(nat.id) || provCount >= 5;
    const prevDisp = formatRulerFullTitle(pastRecord);
    const incDisp = formatRulerFullTitle(incomingRuler);
    const causeMeta = DEATH_CAUSE_LABELS[triggeredCause];

    // Log into World Chronicle (silent for distant minor states to keep 5x speed clean)
    if (isMajorOrNeighbor || newsItems.length < 2) {
      newsItems.push({
        title: isElectionTransition
          ? `Seçim Sonucu: ${nat.name} — ${incDisp}`
          : `Taht Değişimi: ${nat.name} — ${incDisp}`,
        description: `${nat.name} lideri ${prevDisp} (${age} yaşında) ${causeMeta.chroniclePhrase}. Yeni lider: ${incDisp}.`,
        type: 'REFORM',
      });
    }

    // Alert banner only for neighbors or great powers (max 1 alert per month -> zero 5x spam!)
    if (isMajorOrNeighbor && playerAlerts.length === 0) {
      playerAlerts.push(
        isElectionTransition
          ? `🏛️ ${nat.name} seçimlerinde ${incDisp} göreve geldi.`
          : `👑 ${nat.name}: ${prevDisp} vefat etti (${causeMeta.label}) · Yeni hükümdar ${incDisp}.`
      );
    }
  }

  return {
    updatedNations: nextNations,
    playerSuccessionEvent,
    newsItems,
    playerAlerts,
  };
}

/**
 * Pure reducer that applies the player's Coronation / Cülus or Election decision.
 */
export function resolveSuccessionChoiceDomain(params: {
  nations: Record<string, Nation>;
  playerNationId: string;
  activeSuccession: SuccessionEvent | null;
  option: SuccessionChoiceOption;
  tick: number;
  gameMode: GameModeId;
  newsEvents: {
    id: string;
    tick: number;
    dateStr: string;
    title: string;
    description: string;
    type: 'WAR' | 'PEACE' | 'COALITION' | 'ECONOMY' | 'REFORM';
  }[];
  dateStr: string;
}): {
  nations: Record<string, Nation>;
  activeSuccession: null;
  newsEvents: typeof params.newsEvents;
  toastMessage: string;
} {
  const {
    nations,
    playerNationId,
    activeSuccession,
    option,
    tick,
    newsEvents,
    dateStr,
  } = params;

  const pNat = nations[playerNationId];
  if (!activeSuccession || !pNat) {
    return {
      nations,
      activeSuccession: null,
      newsEvents,
      toastMessage: 'Taht devri tamamlandı.',
    };
  }

  const actualGoldCost = Math.min(pNat.treasury, Math.max(0, option.goldCost));
  let updatedNation: Nation = {
    ...pNat,
    treasury: Math.max(0, Math.round(pNat.treasury - actualGoldCost)),
    stability: Math.max(
      5,
      Math.min(100, Math.round((pNat.stability ?? 75) + option.stabilityDelta))
    ),
    prestige: Math.max(
      0,
      Math.round((pNat.prestige ?? 0) + option.prestigeDelta)
    ),
  };

  if (activeSuccession.isElection) {
    if (option.id === 'REELECT_INCUMBENT' && pNat.ruler) {
      updatedNation = {
        ...updatedNation,
        ruler: {
          ...pNat.ruler,
          reignStartTick: tick,
        },
      };
    } else {
      updatedNation = {
        ...updatedNation,
        ruler: activeSuccession.incomingRuler,
        heir: activeSuccession.nextHeir,
        dynastyHistory: [
          activeSuccession.previousRuler,
          ...(pNat.dynastyHistory || []),
        ].slice(0, 24),
        dynastyQueueIndex: (pNat.dynastyQueueIndex ?? 0) + 1,
      };
    }
  }

  const finalRulerDisplay = updatedNation.ruler
    ? formatRulerFullTitle(updatedNation.ruler)
    : formatRulerFullTitle(activeSuccession.incomingRuler);

  const newsTitle = activeSuccession.isElection
    ? `Seçim Kararı: ${finalRulerDisplay}`
    : `Cülus & Taht Değişimi: ${finalRulerDisplay}`;
  const newsDesc = `${activeSuccession.nationName}: ${option.label} — ${option.effectSummary}.`;

  return {
    nations: {
      ...nations,
      [playerNationId]: updatedNation,
    },
    activeSuccession: null,
    newsEvents: [
      {
        id: `succ_news_${tick}_${Math.random().toString(36).slice(2, 7)}`,
        tick,
        dateStr,
        title: newsTitle,
        description: newsDesc,
        type: 'REFORM' as const,
      },
      ...newsEvents.slice(0, 39),
    ],
    toastMessage: activeSuccession.isElection
      ? `🏛️ ${finalRulerDisplay} yeni dönem görevine başladı.`
      : `👑 ${finalRulerDisplay} tahta çıktı (${option.label}).`,
  };
}
