import {
  ClimateZoneId,
  GameModeId,
  SeasonId,
  TerrainType,
  Territory,
  WeatherConditionId,
} from '../types/game';

export interface ProvinceWeatherEffect {
  condition: WeatherConditionId;
  seasonId: SeasonId;
  climateZone: ClimateZoneId;
  label: string;
  shortLabel: string;
  summary: string;
  severity: 'NONE' | 'MODERATE' | 'SEVERE';
  /** Combined terrain + seasonal weather multiplier on army march progress (0.35..1.10). */
  movementSpeedMultiplier: number;
  /** Pure weather movement modifier before base terrain factor (0.55..1.00). */
  weatherMovementFactor: number;
  /** Base terrain movement speed factor (0.70..1.05). */
  terrainMovementFactor: number;
  /** Multiplier applied to weekly supply/siege attrition (1.00..1.90). */
  attritionMultiplier: number;
  /** Extra base weekly attrition rate inflicted on exposed/besieging troops in harsh weather (0..0.024). */
  extraWeeklyAttritionRate: number;
  /** Extra per-day march attrition rate during severe winter or monsoon transit (0..0.014). */
  marchAttritionRate: number;
  /** Multiplier applied to local province supply limit (0.68..1.06). */
  supplyMultiplier: number;
  /** Overall troop efficiency multiplier in this weather (0.76..1.00). */
  troopEfficiencyMultiplier: number;
  /** Attacker combat efficiency multiplier (bears full winter/monsoon burden). */
  attackerEfficiencyMultiplier: number;
  /** Entrenched defender efficiency multiplier (partially acclimated on home ground). */
  defenderEfficiencyMultiplier: number;
  /** Backline artillery & air/drone efficiency multiplier (dampened by monsoon storms & blizzards). */
  artilleryAirEfficiencyMultiplier: number;
  /** Siege progress multiplier (mud & frost slow siege trenches/bombardment). */
  siegeProgressMultiplier: number;
  /** Cartographic fill color for WEATHER map mode. */
  mapColor: string;
  /** Accent text color for HUD badges. */
  accentHex: string;
}

const TERRAIN_BASE_MOVEMENT: Record<TerrainType, number> = {
  METROPOL: 1.05,
  OVA: 1.0,
  ORMAN: 0.86,
  COL: 0.8,
  DAGLIK: 0.7,
};

/**
 * Resolves calendar month (0 = Jan .. 11 = Dec) for a given tick and scenario start year.
 */
export function getCalendarMonthForTick(
  tick: number,
  gameMode?: GameModeId
): number {
  const startYear = gameMode === 'EMPIRES_1440' ? 1440 : 2026;
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const d = new Date(Date.UTC(startYear, 0, 1));
  d.setUTCDate(d.getUTCDate() + safeTick);
  return d.getUTCMonth();
}

/**
 * Resolves hemisphere-aware local season for a province latitude and calendar month.
 * Southern Hemisphere (lat < -15) flips winter and summer relative to Northern Hemisphere.
 */
export function getLocalSeasonForLatitude(
  month: number,
  lat: number
): SeasonId {
  const isSouthern = lat < -15;
  const m = isSouthern ? (month + 6) % 12 : month;
  if (m === 11 || m <= 1) return 'WINTER';
  if (m >= 2 && m <= 4) return 'SPRING';
  if (m >= 5 && m <= 7) return 'SUMMER';
  return 'AUTUMN';
}

/**
 * Classifies a province into a macro-climate zone from its real geographic centroid and terrain.
 */
export function classifyProvinceClimateZone(
  territory: Pick<Territory, 'centroid' | 'terrain'> | undefined
): ClimateZoneId {
  const lon = territory?.centroid?.[0] ?? 30;
  const lat = territory?.centroid?.[1] ?? 40;
  const terrain = territory?.terrain || 'OVA';
  const absLat = Math.abs(lat);

  if (absLat >= 55) {
    return 'SUBARCTIC';
  }

  // Major real-world monsoon & tropical wet belts:
  // 1) South / Southeast / Southern East Asia (India, Indochina, Indonesia, South China, Philippines)
  // 2) Tropical West & Central Africa
  // 3) Amazon Basin & Central America
  const isAsianMonsoon =
    lon >= 66 && lon <= 136 && lat >= -12 && lat <= 31 && terrain !== 'COL';
  const isAfricanMonsoon =
    lon >= -18 && lon <= 38 && lat >= -12 && lat <= 14 && terrain !== 'COL';
  const isAmericasMonsoon =
    lon >= -96 && lon <= -34 && lat >= -18 && lat <= 22 && terrain !== 'COL';

  if (isAsianMonsoon || isAfricanMonsoon || isAmericasMonsoon) {
    return 'MONSOON';
  }

  if (terrain === 'COL') {
    return 'ARID';
  }

  if (terrain === 'DAGLIK' && absLat >= 28) {
    return 'ALPINE';
  }

  return 'TEMPERATE';
}

/**
 * Resolves the exact seasonal weather condition active in a province on the given tick.
 */
export function resolveProvinceWeatherCondition(
  territory: Pick<Territory, 'centroid' | 'terrain'> | undefined,
  tick: number,
  gameMode?: GameModeId
): {
  condition: WeatherConditionId;
  seasonId: SeasonId;
  climateZone: ClimateZoneId;
  month: number;
} {
  const month = getCalendarMonthForTick(tick, gameMode);
  const lat = territory?.centroid?.[1] ?? 40;
  const absLat = Math.abs(lat);
  const terrain = territory?.terrain || 'OVA';
  const seasonId = getLocalSeasonForLatitude(month, lat);
  const climateZone = classifyProvinceClimateZone(territory);

  // 1. Subarctic / high-latitude blizzards (Nov-Mar locally) + spring mud thaw (Apr-May)
  if (climateZone === 'SUBARCTIC') {
    const localM = lat < -15 ? (month + 6) % 12 : month;
    if (localM >= 10 || localM <= 2) {
      return { condition: 'SEVERE_WINTER', seasonId, climateZone, month };
    }
    if (localM === 3 || localM === 4) {
      return { condition: 'MUD_THAW', seasonId, climateZone, month };
    }
    return { condition: 'CLEAR', seasonId, climateZone, month };
  }

  // 2. Monsoon / tropical rain belts: wet season brings heavy monsoon floods & mud
  if (climateZone === 'MONSOON') {
    // Northern tropics monsoon: June - September (months 5..8)
    // Southern tropics monsoon: December - March (months 11, 0, 1, 2)
    const isWetMonsoon =
      lat >= 0
        ? month >= 5 && month <= 8
        : month === 11 || month <= 2;
    if (isWetMonsoon) {
      return { condition: 'MONSOON', seasonId, climateZone, month };
    }
    return { condition: 'CLEAR', seasonId, climateZone, month };
  }

  // 3. Arid desert belts: scorching summer heatwave
  if (climateZone === 'ARID') {
    if (seasonId === 'SUMMER') {
      return { condition: 'HEATWAVE', seasonId, climateZone, month };
    }
    return { condition: 'CLEAR', seasonId, climateZone, month };
  }

  // 4. Alpine mountains: harsh snowbound winter, spring thaw
  if (climateZone === 'ALPINE') {
    if (seasonId === 'WINTER') {
      return { condition: 'SEVERE_WINTER', seasonId, climateZone, month };
    }
    if (seasonId === 'SPRING' && absLat >= 40) {
      return { condition: 'MUD_THAW', seasonId, climateZone, month };
    }
    return { condition: 'CLEAR', seasonId, climateZone, month };
  }

  // 5. Temperate zone: winter frost (severe above 45° or in deep forests/mountains), spring mud in north
  if (seasonId === 'WINTER') {
    if (absLat >= 46 || (absLat >= 40 && terrain === 'ORMAN')) {
      return { condition: 'SEVERE_WINTER', seasonId, climateZone, month };
    }
    if (absLat >= 28) {
      return { condition: 'MILD_WINTER', seasonId, climateZone, month };
    }
    return { condition: 'CLEAR', seasonId, climateZone, month };
  }

  if (
    seasonId === 'SPRING' &&
    absLat >= 46 &&
    (terrain === 'OVA' || terrain === 'ORMAN')
  ) {
    const localM = lat < -15 ? (month + 6) % 12 : month;
    if (localM === 2 || localM === 3) {
      return { condition: 'MUD_THAW', seasonId, climateZone, month };
    }
  }

  return { condition: 'CLEAR', seasonId, climateZone, month };
}

/**
 * Computes full gameplay impact of seasonal weather combined with province terrain:
 * movement speed, attrition rate, supply capacity, troop combat efficiency, and siege speed.
 */
export function getProvinceWeather(
  territory: Pick<Territory, 'centroid' | 'terrain'> | undefined,
  tick: number,
  gameMode?: GameModeId
): ProvinceWeatherEffect {
  const terrain: TerrainType = territory?.terrain || 'OVA';
  const terrainMovementFactor = TERRAIN_BASE_MOVEMENT[terrain] ?? 1.0;
  const { condition, seasonId, climateZone } = resolveProvinceWeatherCondition(
    territory,
    tick,
    gameMode
  );

  let weatherMovementFactor = 1.0;
  let attritionMultiplier = 1.0;
  let extraWeeklyAttritionRate = 0;
  let marchAttritionRate = 0;
  let supplyMultiplier = 1.0;
  let troopEfficiencyMultiplier = 1.0;
  let artilleryAirEfficiencyMultiplier = 1.0;
  let siegeProgressMultiplier = 1.0;
  let severity: 'NONE' | 'MODERATE' | 'SEVERE' = 'NONE';
  let label = 'Açık Hava';
  let shortLabel = 'Açık';
  let summary = 'Elverişli sefer koşulları; standart hareket hızı ve birlik verimi.';
  let mapColor = '#5b7258';
  let accentHex = '#9ec49d';

  switch (condition) {
    case 'SEVERE_WINTER': {
      weatherMovementFactor =
        terrain === 'DAGLIK' ? 0.56 : terrain === 'ORMAN' ? 0.62 : 0.66;
      attritionMultiplier = terrain === 'DAGLIK' ? 1.95 : 1.78;
      extraWeeklyAttritionRate = terrain === 'DAGLIK' ? 0.024 : 0.018;
      marchAttritionRate = terrain === 'DAGLIK' ? 0.013 : 0.009;
      supplyMultiplier = terrain === 'DAGLIK' ? 0.65 : 0.72;
      troopEfficiencyMultiplier = terrain === 'DAGLIK' ? 0.76 : 0.8;
      artilleryAirEfficiencyMultiplier = 0.78;
      siegeProgressMultiplier = 0.74;
      severity = 'SEVERE';
      label = 'Şiddetli Kış';
      shortLabel = 'Tipi';
      summary =
        'Yoğun kar ve don yürüyüşü sertçe yavaşlatır, kış yıpranmasını artırır ve taarruz verimini düşürür.';
      mapColor = '#cbdcf0';
      accentHex = '#93c5fd';
      break;
    }
    case 'MILD_WINTER': {
      weatherMovementFactor = terrain === 'DAGLIK' ? 0.78 : 0.85;
      attritionMultiplier = 1.35;
      extraWeeklyAttritionRate = 0.008;
      marchAttritionRate = 0.003;
      supplyMultiplier = 0.85;
      troopEfficiencyMultiplier = 0.91;
      artilleryAirEfficiencyMultiplier = 0.92;
      siegeProgressMultiplier = 0.88;
      severity = 'MODERATE';
      label = 'Hafif Kış';
      shortLabel = 'Kış';
      summary =
        'Soğuk ve don ikmali daraltır, birlik hareketini ve muharebe verimini hafifçe düşürür.';
      mapColor = '#7d9db8';
      accentHex = '#bae6fd';
      break;
    }
    case 'MONSOON': {
      weatherMovementFactor =
        terrain === 'ORMAN' ? 0.58 : terrain === 'DAGLIK' ? 0.6 : 0.65;
      attritionMultiplier = terrain === 'ORMAN' ? 1.82 : 1.65;
      extraWeeklyAttritionRate = terrain === 'ORMAN' ? 0.022 : 0.016;
      marchAttritionRate = terrain === 'ORMAN' ? 0.012 : 0.008;
      supplyMultiplier = 0.76;
      troopEfficiencyMultiplier = 0.82;
      artilleryAirEfficiencyMultiplier = 0.72;
      siegeProgressMultiplier = 0.78;
      severity = 'SEVERE';
      label = 'Muson Yağmuru';
      shortLabel = 'Muson';
      summary =
        'Şiddetli muson yağışı ve çamur yürüyüşü yavaşlatır, salgın/ikmal yıpranmasını yükseltir ve topçu-hava verimini düşürür.';
      mapColor = '#2f6d7d';
      accentHex = '#5eead4';
      break;
    }
    case 'MUD_THAW': {
      weatherMovementFactor =
        terrain === 'OVA' || terrain === 'ORMAN' ? 0.74 : 0.82;
      attritionMultiplier = 1.22;
      extraWeeklyAttritionRate = 0.005;
      marchAttritionRate = 0.004;
      supplyMultiplier = 0.9;
      troopEfficiencyMultiplier = 0.92;
      artilleryAirEfficiencyMultiplier = 0.88;
      siegeProgressMultiplier = 0.88;
      severity = 'MODERATE';
      label = 'Bahar Çamuru';
      shortLabel = 'Çamur';
      summary =
        'Eriyen karların oluşturduğu bataklık yollar zırhlı ve lojistik yürüyüşlerini yavaşlatır.';
      mapColor = '#7c6b4e';
      accentHex = '#d6b67c';
      break;
    }
    case 'HEATWAVE': {
      weatherMovementFactor = 0.82;
      attritionMultiplier = 1.52;
      extraWeeklyAttritionRate = 0.014;
      marchAttritionRate = 0.007;
      supplyMultiplier = 0.78;
      troopEfficiencyMultiplier = 0.86;
      artilleryAirEfficiencyMultiplier = 0.94;
      siegeProgressMultiplier = 0.86;
      severity = 'MODERATE';
      label = 'Çöl Sıcağı';
      shortLabel = 'Sıcak';
      summary =
        'Aşırı çöl sıcağı su/ikmal limitini düşürür ve seferdeki ordularda sıcak yıpranmasına yol açar.';
      mapColor = '#b9823d';
      accentHex = '#fbbf24';
      break;
    }
    case 'CLEAR':
    default: {
      if (seasonId === 'SUMMER') {
        supplyMultiplier = 1.05;
      }
      break;
    }
  }

  const movementSpeedMultiplier = Number(
    Math.max(0.35, Math.min(1.1, terrainMovementFactor * weatherMovementFactor)).toFixed(3)
  );
  const attackerEfficiencyMultiplier = Number(
    troopEfficiencyMultiplier.toFixed(3)
  );
  // Entrenched defenders mitigate ~38% of severe weather combat penalties on local terrain
  const defenderEfficiencyMultiplier = Number(
    (1 - (1 - troopEfficiencyMultiplier) * 0.62).toFixed(3)
  );

  return {
    condition,
    seasonId,
    climateZone,
    label,
    shortLabel,
    summary,
    severity,
    movementSpeedMultiplier,
    weatherMovementFactor,
    terrainMovementFactor,
    attritionMultiplier,
    extraWeeklyAttritionRate,
    marchAttritionRate,
    supplyMultiplier,
    troopEfficiencyMultiplier,
    attackerEfficiencyMultiplier,
    defenderEfficiencyMultiplier,
    artilleryAirEfficiencyMultiplier,
    siegeProgressMultiplier,
    mapColor,
    accentHex,
  };
}

/**
 * Helper to summarize global seasonal weather climate status for the HUD banner.
 */
export function getGlobalSeasonalWeatherHeadline(
  tick: number,
  gameMode?: GameModeId
): {
  seasonId: SeasonId;
  seasonName: string;
  activePhenomenon: string;
  tooltip: string;
} {
  const month = getCalendarMonthForTick(tick, gameMode);
  if (month === 11 || month <= 1) {
    return {
      seasonId: 'WINTER',
      seasonName: 'Kış',
      activePhenomenon: 'Kuzey Kışı · Güney Musonu',
      tooltip:
        'Kış mevsimi: Kuzey ve dağlık eyaletlerde şiddetli kış/tipi (hız, ikmal ve verim düşüşü), güney tropiklerde muson yağmuru etkilidir.',
    };
  }
  if (month >= 2 && month <= 4) {
    return {
      seasonId: 'SPRING',
      seasonName: 'İlkbahar',
      activePhenomenon: 'Bahar Çamuru · Açık Sefer',
      tooltip:
        'İlkbahar: Ilıman bölgelerde sefer koşulları açılır; kuzey ovalarında kar erimesiyle bahar çamuru yürüyüşü yavaşlatır.',
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      seasonId: 'SUMMER',
      seasonName: 'Yaz',
      activePhenomenon: 'Asya Musonu · Çöl Sıcağı',
      tooltip:
        'Yaz mevsimi: Güney/Güneydoğu Asya ve tropik kuşakta şiddetli muson yağmurları, çöllerde sıcak yıpranması ve güney yarımkürede kış etkilidir.',
    };
  }
  return {
    seasonId: 'AUTUMN',
    seasonName: 'Sonbahar',
    activePhenomenon: 'Geç Muson · Hasat Dengesi',
    tooltip:
      'Sonbahar: Ilıman kuşakta dengeli sefer koşulları; Eylül ayında Asya musonunun son yağışları ve yakında başlayacak kış öncesi lojistik dönemi.',
  };
}
