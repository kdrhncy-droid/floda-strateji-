import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyProvinceClimateZone,
  getCalendarMonthForTick,
  getGlobalSeasonalWeatherHeadline,
  getLocalSeasonForLatitude,
  getProvinceWeather,
  resolveProvinceWeatherCondition,
} from './seasonalWeatherEngine';
import {
  calculateProvinceSupplyLimit,
  evaluateWeeklySupplyAndSeasonAttrition,
  getGameSeason,
} from './seasonSupplyAndAiProfile';
import { computeCombatStrength } from './simulationEngine';
import { computeGameTick } from './tickEngine';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';
import { resolveTerritoryFillColor } from '../map/mapPolygonRenderer';
import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  Nation,
  Territory,
} from '../types/game';

function makeTerritory(overrides: Partial<Territory>): Territory {
  return {
    id: 'TEST_PROV',
    name: 'Test Province',
    ownerId: 'NATION_A',
    coreOwnerId: 'NATION_A',
    isCapital: false,
    terrain: 'OVA',
    population: 500,
    baseGdp: 120,
    resource: 'TAHIL',
    buildings: {
      factory: 0,
      barracks: 0,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    },
    garrison: 10000,
    units: { infantry: 8000, armor: 1500, airDrone: 500 },
    unrest: 5,
    isOccupied: false,
    centroid: [30, 40],
    neighbors: [],
    ...overrides,
  };
}

function makeNation(id: string, overrides: Partial<Nation> = {}): Nation {
  return {
    id,
    name: id,
    flagCode: 'TR',
    color: '#aa3333',
    capitalTerritoryId: 'P1',
    ideology: 'MONARCHY',
    treasury: 5000,
    diplomacyPoints: 10,
    manpower: 100000,
    stability: 85,
    inflation: 2,
    researchPoints: 0,
    taxRate: 22,
    budget: { military: 30, economy: 30, research: 20, welfare: 20 },
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    isEliminated: false,
    ...overrides,
  };
}

describe('seasonalWeatherEngine - climate zones & hemisphere seasons', () => {
  it('resolves calendar months accurately for ticks', () => {
    assert.equal(getCalendarMonthForTick(0, 'EMPIRES_1440'), 0); // Jan
    assert.equal(getCalendarMonthForTick(190, 'EMPIRES_1440'), 6); // Jul
    assert.equal(getCalendarMonthForTick(95, 'EMPIRES_1440'), 3); // Apr
    assert.equal(getCalendarMonthForTick(280, 'EMPIRES_1440'), 9); // Oct
  });

  it('flips winter and summer across hemispheres', () => {
    // January (month 0): Northern = WINTER, Southern (lat -34) = SUMMER
    assert.equal(getLocalSeasonForLatitude(0, 52), 'WINTER');
    assert.equal(getLocalSeasonForLatitude(0, -34), 'SUMMER');
    // July (month 6): Northern = SUMMER, Southern (lat -34) = WINTER
    assert.equal(getLocalSeasonForLatitude(6, 52), 'SUMMER');
    assert.equal(getLocalSeasonForLatitude(6, -34), 'WINTER');
  });

  it('classifies subarctic, monsoon, arid, alpine, and temperate provinces accurately', () => {
    assert.equal(
      classifyProvinceClimateZone({ centroid: [37, 56], terrain: 'ORMAN' }),
      'SUBARCTIC'
    );
    assert.equal(
      classifyProvinceClimateZone({ centroid: [78, 22], terrain: 'ORMAN' }),
      'MONSOON'
    );
    assert.equal(
      classifyProvinceClimateZone({ centroid: [15, 24], terrain: 'COL' }),
      'ARID'
    );
    assert.equal(
      classifyProvinceClimateZone({ centroid: [41, 39], terrain: 'DAGLIK' }),
      'ALPINE'
    );
    assert.equal(
      classifyProvinceClimateZone({ centroid: [2, 48], terrain: 'OVA' }),
      'TEMPERATE'
    );
  });

  it('activates SEVERE_WINTER in January in Moscow/Alps, MONSOON in July in India, and HEATWAVE in July in Sahara', () => {
    const moscow = { centroid: [37, 56] as [number, number], terrain: 'ORMAN' as const };
    const india = { centroid: [78, 22] as [number, number], terrain: 'ORMAN' as const };
    const sahara = { centroid: [12, 24] as [number, number], terrain: 'COL' as const };
    const patagonia = { centroid: [-68, -48] as [number, number], terrain: 'DAGLIK' as const };

    // Jan (tick 10)
    assert.equal(resolveProvinceWeatherCondition(moscow, 10, 'EMPIRES_1440').condition, 'SEVERE_WINTER');
    assert.equal(resolveProvinceWeatherCondition(india, 10, 'EMPIRES_1440').condition, 'CLEAR');
    assert.equal(resolveProvinceWeatherCondition(patagonia, 10, 'EMPIRES_1440').condition, 'CLEAR');

    // Jul (tick 195)
    assert.equal(resolveProvinceWeatherCondition(moscow, 195, 'EMPIRES_1440').condition, 'CLEAR');
    assert.equal(resolveProvinceWeatherCondition(india, 195, 'EMPIRES_1440').condition, 'MONSOON');
    assert.equal(resolveProvinceWeatherCondition(sahara, 195, 'EMPIRES_1440').condition, 'HEATWAVE');
    assert.equal(resolveProvinceWeatherCondition(patagonia, 195, 'EMPIRES_1440').condition, 'SEVERE_WINTER');
  });

  it('combines terrain and winter/monsoon weather to penalize movement speed, attrition, and troop efficiency', () => {
    const alpineMountain = { centroid: [41, 39] as [number, number], terrain: 'DAGLIK' as const };
    const monsoonJungle = { centroid: [101, 15] as [number, number], terrain: 'ORMAN' as const };
    const temperatePlain = { centroid: [10, 48] as [number, number], terrain: 'OVA' as const };

    const clearPlain = getProvinceWeather(temperatePlain, 195, 'EMPIRES_1440');
    const winterMountain = getProvinceWeather(alpineMountain, 10, 'EMPIRES_1440');
    const monsoonForest = getProvinceWeather(monsoonJungle, 195, 'EMPIRES_1440');

    assert.equal(clearPlain.condition, 'CLEAR');
    assert.equal(clearPlain.movementSpeedMultiplier, 1);
    assert.equal(clearPlain.troopEfficiencyMultiplier, 1);

    // Mountain + Severe Winter should be heavily slowed, high attrition, reduced troop efficiency
    assert.equal(winterMountain.condition, 'SEVERE_WINTER');
    assert.ok(winterMountain.movementSpeedMultiplier <= 0.45, `Expected <=0.45 got ${winterMountain.movementSpeedMultiplier}`);
    assert.ok(winterMountain.movementSpeedMultiplier >= 0.35);
    assert.ok(winterMountain.attritionMultiplier > 1.8);
    assert.ok(winterMountain.marchAttritionRate > 0.01);
    assert.ok(winterMountain.attackerEfficiencyMultiplier < 0.8);
    assert.ok(winterMountain.defenderEfficiencyMultiplier > winterMountain.attackerEfficiencyMultiplier);

    // Jungle + Monsoon should severely slow marches, raise attrition, and dampen artillery/air efficiency
    assert.equal(monsoonForest.condition, 'MONSOON');
    assert.ok(monsoonForest.movementSpeedMultiplier <= 0.55, `Expected <=0.55 got ${monsoonForest.movementSpeedMultiplier}`);
    assert.ok(monsoonForest.attritionMultiplier > 1.7);
    assert.ok(monsoonForest.artilleryAirEfficiencyMultiplier < 0.75);
    assert.ok(monsoonForest.attackerEfficiencyMultiplier < 0.85);
  });

  it('produces global seasonal headlines for all 4 seasons', () => {
    assert.equal(getGlobalSeasonalWeatherHeadline(10, 'EMPIRES_1440').seasonId, 'WINTER');
    assert.equal(getGlobalSeasonalWeatherHeadline(95, 'EMPIRES_1440').seasonId, 'SPRING');
    assert.equal(getGlobalSeasonalWeatherHeadline(195, 'EMPIRES_1440').seasonId, 'SUMMER');
    assert.equal(getGlobalSeasonalWeatherHeadline(285, 'EMPIRES_1440').seasonId, 'AUTUMN');
  });
});

describe('seasonalWeatherEngine - engine integration (movement, attrition, combat, map)', () => {
  it('slows army transit and applies march attrition in SEVERE_WINTER & MONSOON vs CLEAR', () => {
    const nationA = makeNation('NATION_A');
    const runMoveTick = (targetCentroid: [number, number], terrain: Territory['terrain'], tick: number) => {
      const fromProv = makeTerritory({
        id: 'P1',
        ownerId: 'NATION_A',
        coreOwnerId: 'NATION_A',
        isCapital: true,
        centroid: targetCentroid,
        terrain,
        neighbors: ['P2'],
      });
      const toProv = makeTerritory({
        id: 'P2',
        ownerId: 'NATION_A',
        coreOwnerId: 'NATION_A',
        centroid: targetCentroid,
        terrain,
        neighbors: ['P1'],
      });
      const move: ArmyMovement = {
        id: 'M1',
        ownerId: 'NATION_A',
        fromTerritoryId: 'P1',
        toTerritoryId: 'P2',
        troops: 20000,
        units: { infantry: 16000, armor: 3000, airDrone: 1000 },
        progress: 0,
        isAttack: false,
      };
      return computeGameTick({
        tick,
        speed: 1,
        gameMode: 'EMPIRES_1440',
        playerNationId: 'NATION_A',
        territories: { P1: fromProv, P2: toProv },
        nations: { NATION_A: nationA },
        relations: {},
        wars: [],
        battles: [],
        movements: [move],
        newsEvents: [],
        settings: DEFAULT_GAME_SETTINGS,
      });
    };

    // Subarctic forest in Jan (SEVERE_WINTER) vs Jul (CLEAR)
    const winterTick = runMoveTick([37, 56], 'ORMAN', 10);
    const clearTick = runMoveTick([37, 56], 'ORMAN', 195);

    const winterMove = winterTick.movements[0];
    const clearMove = clearTick.movements[0];
    assert.ok(winterMove && clearMove, 'Both marches should remain in transit after 1 day');
    assert.ok(
      winterMove.progress < clearMove.progress,
      `Winter progress (${winterMove.progress}) should be slower than clear (${clearMove.progress})`
    );
    assert.ok(
      winterMove.troops < clearMove.troops,
      `Winter march troops (${winterMove.troops}) should suffer march attrition vs clear (${clearMove.troops})`
    );

    // Monsoon jungle in Jul (MONSOON) vs Jan (CLEAR)
    const monsoonTick = runMoveTick([78, 22], 'ORMAN', 195);
    const dryIndiaTick = runMoveTick([78, 22], 'ORMAN', 10);
    assert.ok(monsoonTick.movements[0].progress < dryIndiaTick.movements[0].progress);
    assert.ok(monsoonTick.movements[0].troops < dryIndiaTick.movements[0].troops);
  });

  it('reduces supply limit and increases weekly garrison/siege attrition during winter and monsoon', () => {
    const nationA = makeNation('NATION_A', { capitalTerritoryId: 'BENGAL' });
    const nationB = makeNation('NATION_B', { capitalTerritoryId: 'DELHI' });
    const monsoonProv = makeTerritory({
      id: 'BENGAL',
      ownerId: 'NATION_A',
      coreOwnerId: 'NATION_A',
      isCapital: true,
      centroid: [88, 23],
      terrain: 'ORMAN',
      garrison: 26000,
      units: { infantry: 20000, armor: 4000, airDrone: 2000 },
      siege: {
        territoryId: 'BENGAL',
        attackerId: 'NATION_B',
        defenderId: 'NATION_A',
        attackerTroops: 20000,
        attackerUnits: { infantry: 18000, armor: 2000, airDrone: 0 },
        progress: 15,
        wallIntegrity: 85,
        startedTick: 180,
      },
    });
    const nations = { NATION_A: nationA, NATION_B: nationB };

    const drySeason = getGameSeason(10, 'EMPIRES_1440');
    const monsoonSeason = getGameSeason(195, 'EMPIRES_1440');

    const drySupply = calculateProvinceSupplyLimit(monsoonProv, nationA, drySeason, 10, 'EMPIRES_1440');
    const monsoonSupply = calculateProvinceSupplyLimit(monsoonProv, nationA, monsoonSeason, 195, 'EMPIRES_1440');
    assert.ok(
      monsoonSupply < drySupply,
      `Monsoon supply (${monsoonSupply}) should be lower than dry season (${drySupply})`
    );

    const dryRes = evaluateWeeklySupplyAndSeasonAttrition({
      territories: { BENGAL: { ...monsoonProv, units: { ...monsoonProv.units } } },
      nations,
      season: drySeason,
      playerNationId: 'NATION_A',
      tick: 10,
      gameMode: 'EMPIRES_1440',
    });
    const monsoonRes = evaluateWeeklySupplyAndSeasonAttrition({
      territories: { BENGAL: { ...monsoonProv, units: { ...monsoonProv.units } } },
      nations,
      season: monsoonSeason,
      playerNationId: 'NATION_A',
      tick: 195,
      gameMode: 'EMPIRES_1440',
    });

    assert.ok(
      monsoonRes.playerTotalLoss > dryRes.playerTotalLoss,
      `Monsoon weekly loss (${monsoonRes.playerTotalLoss}) should exceed dry season (${dryRes.playerTotalLoss})`
    );
    assert.equal(monsoonRes.worstPlayerWeatherLabel, 'Muson Yağmuru');
    assert.ok(
      (monsoonRes.updatedTerritories.BENGAL.siege?.attackerTroops ?? 20000) <
        (dryRes.updatedTerritories.BENGAL.siege?.attackerTroops ?? 20000),
      'Besieging army should also suffer heavier monsoon attrition than in dry season'
    );
  });

  it('reduces combat troop efficiency in severe winter and monsoon vs clear weather', () => {
    const nationA = makeNation('NATION_A', { capitalTerritoryId: 'HOME_A' });
    const nationB = makeNation('NATION_B', { capitalTerritoryId: 'ALPS' });
    const alpineProv = makeTerritory({
      id: 'ALPS',
      ownerId: 'NATION_B',
      coreOwnerId: 'NATION_B',
      isCapital: true,
      centroid: [10, 46],
      terrain: 'DAGLIK',
      garrison: 15000,
      units: { infantry: 12000, armor: 2000, airDrone: 1000 },
    });

    const clearAttackPower = computeCombatStrength(nationA, alpineProv, false, alpineProv.units, 195, 'EMPIRES_1440');
    const winterAttackPower = computeCombatStrength(nationA, alpineProv, false, alpineProv.units, 10, 'EMPIRES_1440');
    assert.ok(
      winterAttackPower < clearAttackPower * 0.82,
      `Winter attack strength (${winterAttackPower}) should be significantly reduced vs clear (${clearAttackPower})`
    );

    // Also verify on-map battle resolution scales attacker/defender casualties by weather efficiency
    const war: ActiveWar = {
      id: 'W1',
      name: 'Alpine War',
      attackerId: 'NATION_A',
      defenderId: 'NATION_B',
      attackers: ['NATION_A'],
      defenders: ['NATION_B'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    };

    const runBattle = (tick: number) => {
      const battle: ActiveBattle = {
        id: 'B1',
        territoryId: 'ALPS',
        fromTerritoryId: 'HOME_A',
        attackerId: 'NATION_A',
        defenderId: 'NATION_B',
        attackerTroops: 15000,
        attackerInitialTroops: 15000,
        attackerUnits: { infantry: 11000, armor: 2500, airDrone: 1500 },
        defenderTroops: 15000,
        defenderInitialTroops: 15000,
        defenderUnits: { infantry: 11000, armor: 2500, airDrone: 1500 },
        round: 1,
        attackerMorale: 100,
        defenderMorale: 100,
      };
      const homeA = makeTerritory({
        id: 'HOME_A',
        ownerId: 'NATION_A',
        coreOwnerId: 'NATION_A',
        isCapital: true,
        centroid: [9, 45],
        neighbors: ['ALPS'],
      });
      return computeGameTick({
        tick,
        hour: 0,
        hoursStep: 2,
        speed: 1,
        gameMode: 'EMPIRES_1440',
        playerNationId: 'NATION_A',
        territories: {
          HOME_A: homeA,
          ALPS: { ...alpineProv, neighbors: ['HOME_A'], units: { ...alpineProv.units } },
        },
        nations: {
          NATION_A: { ...nationA },
          NATION_B: { ...nationB },
        },
        relations: {},
        wars: [{ ...war }],
        battles: [battle],
        movements: [],
        newsEvents: [],
        settings: DEFAULT_GAME_SETTINGS,
      });
    };

    const winterBattle = runBattle(10).battles[0];
    const summerBattle = runBattle(195).battles[0];
    assert.ok(winterBattle && summerBattle, 'Both battles should remain active after 1 tick');
    // In severe winter, attacker loses efficiency more sharply than entrenched defender, so defender retains more troops
    assert.ok(
      winterBattle.defenderTroops > summerBattle.defenderTroops,
      `Defender in severe winter (${winterBattle.defenderTroops}) should retain more troops than in summer (${summerBattle.defenderTroops})`
    );
  });

  it('colors WEATHER map mode distinctly for winter, monsoon, heatwave, and clear regions', () => {
    const nationA = makeNation('NATION_A');
    const nations = { NATION_A: nationA };
    const moscow = makeTerritory({ id: 'MOS', centroid: [37, 56], terrain: 'ORMAN' });
    const india = makeTerritory({ id: 'IND', centroid: [78, 22], terrain: 'ORMAN' });
    const sahara = makeTerritory({ id: 'SAH', centroid: [12, 24], terrain: 'COL' });
    const paris = makeTerritory({ id: 'PAR', centroid: [2, 48], terrain: 'OVA' });
    const territories = { MOS: moscow, IND: india, SAH: sahara, PAR: paris };

    const colorMoscowJan = resolveTerritoryFillColor({
      territory: moscow,
      mapMode: 'WEATHER',
      nations,
      territories,
      relations: {},
      wars: [],
      playerNationId: 'NATION_A',
      selectedTerritoryId: null,
      tick: 10,
      gameMode: 'EMPIRES_1440',
    });
    const colorIndiaJul = resolveTerritoryFillColor({
      territory: india,
      mapMode: 'WEATHER',
      nations,
      territories,
      relations: {},
      wars: [],
      playerNationId: 'NATION_A',
      selectedTerritoryId: null,
      tick: 195,
      gameMode: 'EMPIRES_1440',
    });
    const colorSaharaJul = resolveTerritoryFillColor({
      territory: sahara,
      mapMode: 'WEATHER',
      nations,
      territories,
      relations: {},
      wars: [],
      playerNationId: 'NATION_A',
      selectedTerritoryId: null,
      tick: 195,
      gameMode: 'EMPIRES_1440',
    });
    const colorParisJul = resolveTerritoryFillColor({
      territory: paris,
      mapMode: 'WEATHER',
      nations,
      territories,
      relations: {},
      wars: [],
      playerNationId: 'NATION_A',
      selectedTerritoryId: null,
      tick: 195,
      gameMode: 'EMPIRES_1440',
    });

    const distinct = new Set([colorMoscowJan, colorIndiaJul, colorSaharaJul, colorParisJul]);
    assert.equal(distinct.size, 4, 'Severe winter, monsoon, heatwave, and clear should have 4 distinct map colors');
  });
});
