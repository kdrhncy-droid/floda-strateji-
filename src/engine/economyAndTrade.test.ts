import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNationEconomy,
  calculateProvinceDevelopment,
  computeCombatStrength,
  computeNationEconomySummary,
  computeNationManpowerCap,
  isNationEmbargoed,
} from './simulationEngine';
import { computeGameTick } from './tickEngine';
import { calculateBlockadedCorridorIncome, calculateNationTradeAndStraits } from './straitsAndTradeEngine';
import { hydrateSavedPayload } from './saveManager';
import type { SaveGamePayload } from './saveManager';
import { buildNationDiplomacySummary } from './nationDiplomacySummary';
import {
  assimilateTerritoryDomain,
  batchAssimilateDomain,
  batchBorderMobilizationDomain,
  batchStabilityFestivalDomain,
  batchUpgradeBuildingDomain,
  cancelResearchDomain,
  getSpecialtyTerritoryEligibility,
  hireMercenaryDomain,
  investSpecialtyProductionDomain,
  SPECIALTY_PRODUCTION_OPTIONS,
  startMissionaryDomain,
  startResearchDomain,
  upgradeBuildingDomain,
} from './empireAndArmyActions';
import { applyConquestDiplomaticPenalty, executeDiplomaticActionDomain } from './diplomacyAndWarActions';
import { TECH_TREE, TECH_TREE_1440 } from '../data/techAndArmyTiers';
import { initializeWorld2026, isTerritoryCoastal } from './worldBuilder';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';
import { RELIGIONS, CULTURES } from '../data/religionAndCultureData';
import { useGameStore } from '../store/useGameStore';
import { resolveTerritoryFillColor } from '../map/mapPolygonRenderer';
import {
  DiplomaticRelation,
  Nation,
  Territory,
} from '../types/game';
import { mkFaz3Nation, mkFaz3Territory } from '../testHelpers/mockWorldFactories';

test('timed technology research, construction queue, and gradual assimilation advance daily under computeGameTick', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı İmparatorluğu',
      flagCode: 'TUR',
      color: '#c22222',
      capitalTerritoryId: '792',
      ideology: 'MONARCHY',
      treasury: 1000,
      manpower: 10000,
      stability: 85,
      inflation: 2.0,
      researchPoints: 20,
      taxRate: 30,
      budget: { military: 40, economy: 30, research: 25, welfare: 5 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      researchProgressByTech: { eco_1: 7.5 },
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    } as Nation,
  };

  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Edirne',
      ownerId: '792',
      coreOwnerId: '792',
      terrain: 'OVA',
      population: 400,
      baseGdp: 20,
      resource: 'TAHIL',
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 1, tradeHub: 0, supplyDepot: 0 },
      garrison: 5000,
      units: { infantry: 5000, armor: 0, airDrone: 0 },
      unrest: 0,
      isOccupied: false,
      centroid: [26.5, 41.6],
      neighbors: [],
    },
    '300': {
      id: '300',
      name: 'Konstantiniyye',
      ownerId: '792',
      coreOwnerId: '300', // Conquered foreign city
      terrain: 'DAGLIK',
      population: 300,
      baseGdp: 35,
      resource: 'TICARET_BOGAZI',
      buildings: { factory: 0, barracks: 0, fortress: 1, university: 0, tradeHub: 1, supplyDepot: 0 },
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      unrest: 25,
      isOccupied: false,
      centroid: [28.9, 41.0],
      neighbors: [],
    },
  };

  // 1. Start timed research for tier-1 military tech
  const patch1 = startResearchDomain({
    techId: 'mil_1',
    nations,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 0,
  });
  assert.ok(patch1.nations?.['792']?.activeResearch);
  assert.equal(patch1.nations['792'].activeResearch?.techId, 'mil_1');
  assert.equal(patch1.nations['792'].activeResearch?.progress, 0);

  // 2. Queue building construction in Edirne
  const patch2 = upgradeBuildingDomain({
    territoryId: '792',
    building: 'barracks',
    territories,
    nations: patch1.nations || nations,
    playerNationId: '792',
  });
  assert.ok(patch2.territories?.['792']?.constructionQueue?.length);
  assert.equal(patch2.territories['792'].constructionQueue![0].building, 'barracks');

  // 3. Start assimilation in Konstantiniyye
  const patch3 = assimilateTerritoryDomain({
    territoryId: '300',
    territories: patch2.territories || territories,
    nations: patch2.nations || patch1.nations || nations,
    playerNationId: '792',
  });
  assert.equal(patch3.territories?.['300']?.isAssimilating, true);

  const mergedNations = { ...nations, ...patch3.nations };
  const mergedTerritories = { ...territories, ...patch3.territories };

  // Set research near completion to test 1-day unlock
  mergedNations['792'].activeResearch!.progress = mergedNations['792'].activeResearch!.totalCost - 1;
  // Set construction queue near completion
  mergedTerritories['792'].constructionQueue![0].progressDays =
    mergedTerritories['792'].constructionQueue![0].totalDays - 1;
  // Set assimilation near completion
  mergedTerritories['300'].assimilation = 99.5;

  // Run computeGameTick for a full 24-hour day
  const tickResult = computeGameTick({
    tick: 1,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: mergedNations,
    territories: mergedTerritories,
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      aiAggressiveness: 'NORMAL',
      autoSaveIntervalDays: 90,
      fogOfWarEnabled: false,
      showZoomControls: true,
      crisisFrequencyDays: 90,
      mapLabelDensity: 'BALANCED',
      uiScale: 'STANDARD',
    },
  });

  const updatedNation = tickResult.nations['792'];
  const updatedEdirne = tickResult.territories['792'];
  const updatedKonstantiniyye = tickResult.territories['300'];

  // Verification 1: Research completed and unlocked!
  assert.equal(updatedNation.activeResearch, null);
  assert.ok(updatedNation.unlockedTechs.includes('mil_1'), 'mil_1 tech should be unlocked');
  assert.equal(updatedNation.researchProgressByTech?.mil_1, undefined);
  assert.equal(updatedNation.researchProgressByTech?.eco_1, 7.5);

  // Verification 2: Barracks construction completed and level incremented!
  assert.equal(updatedEdirne.buildings.barracks, 1);
  assert.equal(updatedEdirne.constructionQueue?.length, 0);

  // Verification 3: Konstantiniyye reached 100% assimilation and became permanent Core!
  assert.equal(updatedKonstantiniyye.assimilation, 100);
  assert.equal(updatedKonstantiniyye.isAssimilating, false);
  assert.equal(updatedKonstantiniyye.coreOwnerId, '792');
});

test('startMissionaryDomain initiates conversion and computeGameTick completes it with unrest reduction and AoH3 map modes return distinct theme colors', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı İmparatorluğu',
      capitalTerritoryId: '792',
      stateReligion: 'ISLAM_SUNNI',
      primaryCulture: 'TURKIC_OGHUZ',
      treasury: 500,
      manpower: 10000,
      stability: 80,
      inflation: 2,
      researchPoints: 50,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
      color: '#059669',
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    '300': {
      id: '300',
      name: 'Konstantiniyye',
      ownerId: '792',
      coreOwnerId: '300',
      religion: 'CHRISTIAN_ORTHODOX',
      culture: 'GREEK_BYZANTINE',
      garrison: 5000,
      unrest: 25,
      population: 120,
      baseGdp: 180,
      resource: 'TICARET_BOGAZI',
      buildings: { factory: 1, barracks: 1, fortress: 2, university: 1, tradeHub: 2, supplyDepot: 1 },
      neighbors: ['792'],
      centroid: [28.9, 41.0],
      assimilation: 60,
    } as unknown as Territory,
  };

  // 1. Verify Map Mode colors before conversion
  const relColorBefore = resolveTerritoryFillColor({
    territory: territories['300'],
    mapMode: 'RELIGION',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: '792',
    selectedTerritoryId: '300',
  });
  assert.equal(relColorBefore, RELIGIONS.CHRISTIAN_ORTHODOX.color);

  const culColor = resolveTerritoryFillColor({
    territory: territories['300'],
    mapMode: 'CULTURE',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: '792',
    selectedTerritoryId: '300',
  });
  assert.equal(culColor, CULTURES.GREEK_BYZANTINE.color);

  const assimColorBefore = resolveTerritoryFillColor({
    territory: territories['300'],
    mapMode: 'ASSIMILATION',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: '792',
    selectedTerritoryId: '300',
  });
  assert.equal(assimColorBefore, '#EF4444'); // Not yet 100% Core or active

  // 2. Start Missionary Domain
  const patch = startMissionaryDomain({
    territoryId: '300',
    targetReligion: 'ISLAM_SUNNI',
    territories,
    nations,
    playerNationId: '792',
  });

  assert.ok(patch.territories?.['300']?.missionary, 'Missionary should be active');
  assert.equal(patch.territories['300'].missionary!.targetReligion, 'ISLAM_SUNNI');
  assert.equal(patch.nations?.['792']?.treasury, 380); // 500 - 120 gold

  const mergedTerritories = { ...territories, ...patch.territories };
  // Set missionary to 1 day before completion
  mergedTerritories['300'].missionary!.progressDays =
    mergedTerritories['300'].missionary!.totalDays - 1;

  // 3. Advance a day via computeGameTick
  const tickResult = computeGameTick({
    tick: 1,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { ...nations, ...patch.nations },
    territories: mergedTerritories,
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      aiAggressiveness: 'NORMAL',
      autoSaveIntervalDays: 90,
      fogOfWarEnabled: false,
      showZoomControls: true,
      crisisFrequencyDays: 90,
      mapLabelDensity: 'BALANCED',
      uiScale: 'STANDARD',
    },
  });

  const convertedTerritory = tickResult.territories['300'];
  assert.equal(convertedTerritory.religion, 'ISLAM_SUNNI');
  assert.equal(convertedTerritory.missionary, null);
  assert.equal(convertedTerritory.unrest, 16.88); // 25 - 8 missionary - 0.12 supply depot
  assert.ok(convertedTerritory.population > 120); // Daily province growth is now simulated

  // 4. Verify Map Mode color now reflects Sunni Islam
  const relColorAfter = resolveTerritoryFillColor({
    territory: convertedTerritory,
    mapMode: 'RELIGION',
    nations,
    territories: tickResult.territories,
    relations: {},
    wars: [],
    playerNationId: '792',
    selectedTerritoryId: '300',
  });
  assert.equal(relColorAfter, RELIGIONS.ISLAM_SUNNI.color);
});

test('resource specializations and trade hub relief affect national economy', () => {
  const nation = {
    id: 'TEST',
    name: 'Test Devleti',
    ideology: 'MONARCHY',
    treasury: 1000,
    manpower: 10000,
    stability: 70,
    inflation: 12,
    researchPoints: 0,
    taxRate: 25,
    budget: { military: 35, economy: 25, research: 15, welfare: 25 },
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    isEliminated: false,
  } as unknown as Nation;
  const baseTerritory = {
    id: 'T1',
    name: 'Test Eyaleti',
    ownerId: 'TEST',
    coreOwnerId: 'TEST',
    population: 1000,
    baseGdp: 100,
    buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
    garrison: 1000,
    units: { infantry: 1000, armor: 0, airDrone: 0 },
    unrest: 0,
    isOccupied: false,
    centroid: [0, 0],
    neighbors: [],
  } as unknown as Territory;

  const baseline = calculateNationEconomy(
    nation,
    { T1: { ...baseTerritory, resource: 'PETROL' } },
    { TEST: nation },
    {},
    [],
    []
  );
  const grain = calculateNationEconomy(
    nation,
    { T1: { ...baseTerritory, resource: 'TAHIL' } },
    { TEST: nation },
    {},
    [],
    []
  );
  const finance = calculateNationEconomy(
    nation,
    { T1: { ...baseTerritory, resource: 'FINANS_MERKEZI', buildings: { ...baseTerritory.buildings, tradeHub: 2 } } },
    { TEST: nation },
    {},
    [],
    []
  );
  const freeTradeNation = {
    ...nation,
    enactedReforms: ['ref_free_trade_zones'],
  } as Nation;
  const freeTrade = calculateNationEconomy(
    freeTradeNation,
    { T1: { ...baseTerritory, resource: 'PETROL' } },
    { TEST: freeTradeNation },
    {},
    [],
    []
  );

  assert.ok(baseline.productionIncome > 0);
  assert.ok(grain.dailyManpower > baseline.dailyManpower);
  assert.ok(finance.taxIncome > baseline.taxIncome);
  assert.ok(finance.inflationRelief > 0);
  assert.ok(freeTrade.taxIncome > baseline.taxIncome);
  assert.ok(freeTrade.tradeIncome > baseline.tradeIncome);
});

test('embargo direction targets only the other nation and maps legacy flags to nationA', () => {
  const relation: DiplomaticRelation = {
    nationA: 'A',
    nationB: 'B',
    score: 0,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: true,
    embargoingNationIds: ['A'],
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  };
  assert.equal(isNationEmbargoed(relation, 'A'), false);
  assert.equal(isNationEmbargoed(relation, 'B'), true);

  const legacyRelation = { ...relation };
  delete legacyRelation.embargoingNationIds;
  assert.equal(isNationEmbargoed(legacyRelation, 'A'), false);
  assert.equal(isNationEmbargoed(legacyRelation, 'B'), true);
});

test('embargo action lets both nations act independently and lift only their own embargo', () => {
  const nations: Record<string, Nation> = {
    A: { id: 'A', name: 'A', diplomacyPoints: 100 } as Nation,
    B: { id: 'B', name: 'B', diplomacyPoints: 100 } as Nation,
  };
  const relations: Record<string, DiplomaticRelation> = {
    A_B: {
      nationA: 'A',
      nationB: 'B',
      score: 0,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      embargoingNationIds: [],
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
  };
  const act = (
    playerNationId: string,
    targetNationId: string,
    currentNations: Record<string, Nation>,
    currentRelations: Record<string, DiplomaticRelation>
  ) =>
    executeDiplomaticActionDomain({
      targetNationId,
      action: 'EMBARGO',
      playerNationId,
      totalPlayerGarrison: 0,
      tick: 1,
      gameMode: 'EMPIRES_1440',
      nations: currentNations,
      territories: {},
      relations: currentRelations,
      wars: [],
      movements: [],
      newsEvents: [],
    });

  const fromA = act('A', 'B', nations, relations);
  assert.deepEqual(fromA.relations?.A_B?.embargoingNationIds, ['A']);
  assert.equal(fromA.nations?.A?.diplomacyPoints, 85);

  const fromB = act(
    'B',
    'A',
    fromA.nations ?? nations,
    fromA.relations ?? relations
  );
  assert.deepEqual(fromB.relations?.A_B?.embargoingNationIds?.slice().sort(), [
    'A',
    'B',
  ]);
  assert.equal(fromB.nations?.B?.diplomacyPoints, 85);

  const removeA = act(
    'A',
    'B',
    fromB.nations ?? nations,
    fromB.relations ?? relations
  );
  assert.deepEqual(removeA.relations?.A_B?.embargoingNationIds, ['B']);
  assert.equal(removeA.relations?.A_B?.hasEmbargo, true);
  assert.equal(removeA.nations?.A?.diplomacyPoints, 85);
});

test('only an embargo target loses trade income; legacy direction stays one-sided', () => {
  const makeNation = (id: string): Nation =>
    ({
      id,
      name: id,
      ideology: 'MONARCHY',
      treasury: 1000,
      manpower: 10000,
      stability: 70,
      inflation: 0,
      researchPoints: 0,
      taxRate: 25,
      budget: { military: 35, economy: 25, research: 15, welfare: 25 },
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    }) as unknown as Nation;
  const nationA = makeNation('A');
  const nationB = makeNation('B');
  const nations = { A: nationA, B: nationB };
  const makeTerritory = (ownerId: string): Territory =>
    ({
      id: `${ownerId}_T`,
      name: `${ownerId} Province`,
      ownerId,
      coreOwnerId: ownerId,
      population: 1000,
      baseGdp: 100,
      resource: 'PETROL',
      buildings: {
        factory: 0,
        barracks: 0,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      garrison: 0,
      units: { infantry: 0, armor: 0, airDrone: 0 },
      unrest: 0,
      isOccupied: false,
      centroid: [0, 0],
      neighbors: [],
    }) as unknown as Territory;
  const territories = {
    A_T: makeTerritory('A'),
    B_T: makeTerritory('B'),
  };
  const directionalRelation: DiplomaticRelation = {
    nationA: 'A',
    nationB: 'B',
    score: 0,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: true,
    embargoingNationIds: ['A'],
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  };
  const economy = (
    nation: Nation,
    relationSet: Record<string, DiplomaticRelation>
  ) =>
    calculateNationEconomy(
      nation,
      territories,
      nations,
      relationSet,
      [],
      []
    );

  const sourceBaseline = economy(nationA, {});
  const sourceEmbargoed = economy(nationA, { A_B: directionalRelation });
  const targetBaseline = economy(nationB, {});
  const targetEmbargoed = economy(nationB, { A_B: directionalRelation });
  assert.equal(sourceEmbargoed.tradeIncome, sourceBaseline.tradeIncome);
  assert.ok(targetEmbargoed.tradeIncome < targetBaseline.tradeIncome);

  const legacyRelation = { ...directionalRelation };
  delete legacyRelation.embargoingNationIds;
  assert.equal(economy(nationA, { A_B: legacyRelation }).tradeIncome, sourceBaseline.tradeIncome);
  assert.ok(economy(nationB, { A_B: legacyRelation }).tradeIncome < targetBaseline.tradeIncome);
});

test('trade agreement clears the relation embargo list consistently with hasEmbargo', () => {
  const nations: Record<string, Nation> = {
    P: { id: 'P', name: 'Oyuncu', diplomacyPoints: 100 } as Nation,
    T: { id: 'T', name: 'Hedef', diplomacyPoints: 100 } as Nation,
  };
  const relation: DiplomaticRelation = {
    nationA: 'P',
    nationB: 'T',
    score: 20,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: true,
    embargoingNationIds: ['P', 'T'],
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  };
  const patch = executeDiplomaticActionDomain({
    targetNationId: 'T',
    action: 'TRADE',
    playerNationId: 'P',
    totalPlayerGarrison: 0,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    nations,
    territories: {},
    relations: { P_T: relation },
    wars: [],
    movements: [],
    newsEvents: [],
  });

  assert.equal(patch.relations?.P_T?.hasTradeAgreement, true);
  assert.equal(patch.relations?.P_T?.hasEmbargo, false);
  assert.deepEqual(patch.relations?.P_T?.embargoingNationIds, []);
});

test('only the embargo target loses an exposed trade-corridor share', () => {
  const territories: Record<string, Territory> = {
    '724_SEV': {
      id: '724_SEV',
      name: 'Seville',
      ownerId: 'A',
      baseGdp: 100,
      buildings: { tradeHub: 0, fortress: 0, supplyDepot: 0 },
    } as unknown as Territory,
    '504': {
      id: '504',
      name: 'Morocco Strait',
      ownerId: 'B',
      baseGdp: 100,
      buildings: { tradeHub: 0, fortress: 0, supplyDepot: 0 },
    } as unknown as Territory,
  };
  const nations = {
    A: { id: 'A', name: 'A' } as Nation,
    B: { id: 'B', name: 'B' } as Nation,
  };
  const relationFrom = (nationId: string): DiplomaticRelation => ({
    nationA: 'A',
    nationB: 'B',
    score: 0,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: true,
    embargoingNationIds: [nationId],
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  });
  const routeFor = (embargoingNationId: string) =>
    calculateNationTradeAndStraits({
      nationId: 'A',
      gameMode: 'STANDARD_2026',
      territories,
      nations,
      relations: { A_B: relationFrom(embargoingNationId) },
      wars: [],
    });
  const embargoByA = routeFor('A');
  const embargoByB = routeFor('B');
  const corridorByA = embargoByA.activeCorridors.find(
    (corridor) => corridor.corridorId === 'corridor_western_med'
  );
  const corridorByB = embargoByB.activeCorridors.find(
    (corridor) => corridor.corridorId === 'corridor_western_med'
  );

  assert.equal(corridorByA?.isBlockadedByEnemy, false);
  assert.equal(corridorByB?.isBlockadedByEnemy, true);
  assert.ok(embargoByB.blockadePenaltyLoss > 0);
});

test('hydrated legacy save keeps a symmetric embargo flag one-sided', () => {
  const makeNation = (id: string): Nation =>
    ({
      id,
      name: id,
      treasury: 1000,
      manpower: 10000,
      stability: 70,
      inflation: 0,
      researchPoints: 0,
      taxRate: 25,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      isEliminated: false,
    }) as unknown as Nation;
  const makeTerritory = (id: string, ownerId: string): Territory =>
    ({
      id,
      name: id,
      ownerId,
      coreOwnerId: ownerId,
      population: 1000,
      baseGdp: 100,
      garrison: 0,
      unrest: 0,
      buildings: {
        factory: 0,
        barracks: 0,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      units: { infantry: 0, armor: 0, airDrone: 0 },
      centroid: [0, 0],
      neighbors: [],
    }) as unknown as Territory;
  const nations = { A: makeNation('A'), B: makeNation('B') };
  const territories = {
    A_T: makeTerritory('A_T', 'A'),
    B_T: makeTerritory('B_T', 'B'),
  };
  const legacyRelation = {
    nationA: 'A',
    nationB: 'B',
    score: 0,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: true,
    hasMilitaryAccess: false,
    truceUntilTick: 0,
  } as DiplomaticRelation;
  const savedPayload: SaveGamePayload = {
    gameMode: 'STANDARD_2026',
    playerNationId: 'A',
    nations,
    territories,
    relations: { A_B: legacyRelation },
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    tick: 0,
  };

  const hydrated = hydrateSavedPayload(savedPayload, nations, territories);
  assert.equal(isNationEmbargoed(hydrated.relations.A_B, 'A'), false);
  assert.equal(isNationEmbargoed(hydrated.relations.A_B, 'B'), true);
});

test('research progress survives switching, pausing, resuming, and legacy save hydration', () => {
  const baseNation = {
    id: '792',
    name: 'Osmanlı',
    flagCode: 'TUR',
    color: '#c22222',
    capitalTerritoryId: '792',
    ideology: 'MONARCHY',
    treasury: 1000,
    manpower: 10000,
    stability: 80,
    inflation: 2,
    researchPoints: 50,
    taxRate: 25,
    budget: { military: 40, economy: 30, research: 15, welfare: 15 },
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    isEliminated: false,
    researchProgressByTech: {},
  } as Nation;
  const initialNations = { '792': baseNation };

  const firstStart = startResearchDomain({
    techId: 'eco_1',
    nations: initialNations,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 1,
  });
  const firstState = { ...initialNations, ...(firstStart.nations ?? {}) };
  const partialState = {
    ...firstState,
    '792': {
      ...firstState['792'],
      activeResearch: {
        ...firstState['792'].activeResearch!,
        progress: 14.5,
      },
    },
  };

  const secondStart = startResearchDomain({
    techId: 'mil_1',
    nations: partialState,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 2,
  });
  const secondState = { ...partialState, ...(secondStart.nations ?? {}) };
  assert.equal(secondState['792'].activeResearch?.techId, 'mil_1');
  assert.equal(secondState['792'].researchProgressByTech?.eco_1, 14.5);

  const returnToFirst = startResearchDomain({
    techId: 'eco_1',
    nations: secondState,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 3,
  });
  const resumedState = { ...secondState, ...(returnToFirst.nations ?? {}) };
  assert.equal(resumedState['792'].activeResearch?.techId, 'eco_1');
  assert.equal(resumedState['792'].activeResearch?.progress, 14.5);

  const pausePatch = cancelResearchDomain({
    nations: resumedState,
    playerNationId: '792',
  });
  const pausedState = { ...resumedState, ...(pausePatch.nations ?? {}) };
  assert.equal(pausedState['792'].activeResearch, null);
  assert.equal(pausedState['792'].researchProgressByTech?.eco_1, 14.5);

  const restartPatch = startResearchDomain({
    techId: 'eco_1',
    nations: pausedState,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 4,
  });
  const restartState = { ...pausedState, ...(restartPatch.nations ?? {}) };
  assert.equal(restartState['792'].activeResearch?.progress, 14.5);

  const legacyNation = { ...restartState['792'] };
  delete legacyNation.researchProgressByTech;
  const legacyBaseline = { ...baseNation };
  delete legacyBaseline.researchProgressByTech;
  const hydrated = hydrateSavedPayload(
    {
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: { '792': legacyNation },
      territories: {},
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      tick: 4,
    },
    { '792': legacyBaseline },
    {}
  );
  assert.equal(hydrated.nations['792'].activeResearch?.progress, 14.5);
  assert.equal(hydrated.nations['792'].researchProgressByTech?.eco_1, 14.5);
});

test('vassal tribute is an explicit expense that reconciles to the displayed net balance', () => {
  const vassal: Nation = {
    id: 'V', name: 'Vasal', vassalOf: 'L', taxRate: 25, inflation: 12,
    budget: { military: 35, economy: 30, research: 15, welfare: 20 },
    unlockedTechs: [], enactedReforms: [],
  } as unknown as Nation;
  const territory = {
    id: 'V1', name: 'Eyalet', ownerId: 'V', coreOwnerId: 'V', population: 1000,
    baseGdp: 100, resource: 'TAHIL',
    buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 1, supplyDepot: 0 },
    garrison: 1000, units: { infantry: 1000, armor: 0, airDrone: 0 },
    unrest: 0, isOccupied: false, centroid: [0, 0], neighbors: [],
  } as unknown as Territory;
  const economy = calculateNationEconomy(
    vassal,
    { V1: territory },
    {
      V: vassal,
      L: { id: 'L', name: 'Üst Devlet', isEliminated: false } as Nation,
      C: { id: 'C', name: 'Alt Vasal', vassalOf: 'V', isEliminated: false } as Nation,
    },
    {},
    [],
    []
  );
  assert.equal(economy.vassalTributeOut, Math.round(economy.taxIncome * 0.25));
  assert.equal(economy.vassalIncome, 55);
  assert.equal(
    economy.netDailyGold,
    economy.taxIncome + economy.productionIncome + economy.tradeIncome +
      economy.vassalIncome - economy.vassalTributeOut -
      economy.militaryUpkeep - economy.inflationPenalty
  );
});

test('blockade loss never exceeds a corridor gross share or creates net income', () => {
  assert.deepEqual(calculateBlockadedCorridorIncome(0, 0.42), {
    dailyIncome: 0, blockadePenaltyLoss: 0,
  });
  assert.deepEqual(calculateBlockadedCorridorIncome(2, 0.42), {
    dailyIncome: 1, blockadePenaltyLoss: 1,
  });
  assert.deepEqual(calculateBlockadedCorridorIncome(2, 2), {
    dailyIncome: 0, blockadePenaltyLoss: 2,
  });
  for (const gross of [0, 1, 2, 3, 4, 10, 100]) {
    const result = calculateBlockadedCorridorIncome(gross, 0.42);
    assert.ok(result.dailyIncome <= gross);
    assert.ok(result.blockadePenaltyLoss <= gross);
    assert.equal(result.dailyIncome + result.blockadePenaltyLoss, gross);
  }
});

test('Faz 3.1 & 3.2: City Development Score darkens ECONOMIC map color and building/tech investments allow Cotton/Timber to outproduce uninvested Gold/Oil', () => {
  const uninvestedNation = mkFaz3Nation('OIL_NAT', {
    unlockedTechs: [],
    enactedReforms: [],
  });
  const investedNation = mkFaz3Nation('COT_NAT', {
    unlockedTechs: ['eco_1', 'eco_2', 'eco_3', 'sci_2', 'sci_4'],
    enactedReforms: ['ref_free_trade_zones'],
  });

  const uninvestedOilCity = mkFaz3Territory('OIL_1', {
    ownerId: 'OIL_NAT',
    coreOwnerId: 'OIL_NAT',
    resource: 'PETROL',
    baseGdp: 55,
    buildings: {
      factory: 0,
      barracks: 0,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    },
  });

  const investedCottonCity = mkFaz3Territory('COT_1', {
    ownerId: 'COT_NAT',
    coreOwnerId: 'COT_NAT',
    resource: 'PAMUK',
    baseGdp: 85,
    isCapital: true,
    buildings: {
      factory: 4,
      barracks: 2,
      fortress: 2,
      university: 3,
      tradeHub: 3,
      supplyDepot: 2,
    },
  });

  const oilDev = calculateProvinceDevelopment(uninvestedOilCity, uninvestedNation);
  const cottonDev = calculateProvinceDevelopment(investedCottonCity, investedNation);

  assert.ok(
    oilDev.baseResourceValue > cottonDev.baseResourceValue,
    'Raw base value of Oil (44A) must exceed raw base value of Cotton (26A)'
  );
  assert.ok(
    cottonDev.effectiveResourceValue > oilDev.effectiveResourceValue * 1.8,
    `Invested Cotton city (${cottonDev.effectiveResourceValue}A) must outproduce uninvested Oil city (${oilDev.effectiveResourceValue}A)`
  );
  assert.ok(
    cottonDev.developmentScore >= 90 && cottonDev.developmentScore > oilDev.developmentScore + 50,
    `Invested city development score (${cottonDev.developmentScore}) must significantly exceed uninvested city (${oilDev.developmentScore})`
  );

  const nations = { OIL_NAT: uninvestedNation, COT_NAT: investedNation };
  const territories = { OIL_1: uninvestedOilCity, COT_1: investedCottonCity };

  const lowEcoColor = resolveTerritoryFillColor({
    territory: uninvestedOilCity,
    mapMode: 'ECONOMIC',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: 'COT_NAT',
    selectedTerritoryId: null,
  });
  const highEcoColor = resolveTerritoryFillColor({
    territory: investedCottonCity,
    mapMode: 'ECONOMIC',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: 'COT_NAT',
    selectedTerritoryId: null,
  });

  assert.notEqual(
    lowEcoColor,
    highEcoColor,
    'ECONOMIC map mode must shade high-development cities darker emerald than low-development cities'
  );
  assert.equal(highEcoColor, '#042F2E');

  const resColor = resolveTerritoryFillColor({
    territory: investedCottonCity,
    mapMode: 'RESOURCES',
    nations,
    territories,
    relations: {},
    wars: [],
    playerNationId: 'COT_NAT',
    selectedTerritoryId: null,
  });
  assert.equal(resColor, '#34D399', 'RESOURCES map mode must color by resource palette');
});

test('Faz 3.25: Specialty production investment, conquest diplomatic penalty, conquered nations ledger, and post-war assimilation work end-to-end', () => {
  const ottoman = mkFaz3Nation('792', {
    name: 'Osmanlı Devleti',
    treasury: 1500,
    manpower: 10000,
    stateReligion: 'ISLAM_SUNNI',
    primaryCulture: 'TURKIC_OGHUZ',
  });
  const byzantium = mkFaz3Nation('300', {
    name: 'Bizans İmparatorluğu',
    treasury: 400,
    isEliminated: true,
    capitalTerritoryId: '300_ist',
    stateReligion: 'CHRISTIAN_ORTHODOX',
    primaryCulture: 'GREEK_BYZANTINE',
  });
  const serbia = mkFaz3Nation('688', {
    name: 'Sırbistan Despotluğu',
    treasury: 500,
    isEliminated: false,
    stateReligion: 'CHRISTIAN_ORTHODOX',
    primaryCulture: 'GREEK_BYZANTINE',
  });
  const venice = mkFaz3Nation('380', {
    name: 'Venedik Cumhuriyeti',
    treasury: 800,
    isEliminated: false,
    stateReligion: 'CHRISTIAN_CATHOLIC',
    primaryCulture: 'ROMANCE_LATIN',
  });

  const edirne = mkFaz3Territory('792_edi', {
    name: 'Edirne',
    ownerId: '792',
    coreOwnerId: '792',
    assimilation: 100,
    resource: 'TAHIL',
    baseGdp: 50,
  });
  const adana = mkFaz3Territory('792_ada', {
    name: 'Adana',
    ownerId: '792',
    coreOwnerId: '792',
    assimilation: 100,
    resource: 'PAMUK',
    baseGdp: 45,
  });
  const istanbul = mkFaz3Territory('300_ist', {
    name: 'Konstantiniyye',
    ownerId: '792',
    coreOwnerId: '300',
    assimilation: 25,
    isAssimilating: false,
    isOccupied: false,
    unrest: 24,
  });

  const nations: Record<string, Nation> = {
    '792': ottoman,
    '300': byzantium,
    '688': serbia,
    '380': venice,
  };
  const territories: Record<string, Territory> = {
    '792_edi': edirne,
    '792_ada': adana,
    '300_ist': istanbul,
  };

  // 1a. Non-existent natural resource in selected cities must be rejected
  const invalidResourceRes = investSpecialtyProductionDomain({
    territoryIds: ['792_edi', '792_ada'],
    specialtyId: 'PETROL_REFINERY',
    territories,
    nations,
    playerNationId: '792',
  });
  assert.equal(invalidResourceRes.territories, undefined, 'Non-existent natural resource must not be investable');

  // 1b. Specific natural resource (PAMUK_FIELD) across mixed selection queues timed build only on Adana (PAMUK)
  const pamukOpt = SPECIALTY_PRODUCTION_OPTIONS.find((o) => o.id === 'PAMUK_FIELD')!;
  const pamukOnlyRes = investSpecialtyProductionDomain({
    territoryIds: ['792_edi', '792_ada'],
    specialtyId: 'PAMUK_FIELD',
    territories,
    nations,
    playerNationId: '792',
  });
  assert.ok(pamukOnlyRes.territories, 'Matching natural resource should queue construction on matching territory');
  assert.equal(pamukOnlyRes.territories!['792_edi'].resource, 'TAHIL');
  assert.equal(pamukOnlyRes.territories!['792_edi'].constructionQueue?.length ?? 0, 0);
  assert.equal(pamukOnlyRes.territories!['792_ada'].resource, 'PAMUK');
  assert.equal(pamukOnlyRes.territories!['792_ada'].baseGdp, adana.baseGdp, 'Timed facility must not apply GDP instantly');
  assert.equal(pamukOnlyRes.territories!['792_ada'].constructionQueue?.length, 1);
  assert.equal(pamukOnlyRes.territories!['792_ada'].constructionQueue![0].totalDays, pamukOpt.buildDays);
  assert.equal(pamukOnlyRes.territories!['792_ada'].constructionQueue![0].gdpBonus, pamukOpt.gdpBonus);

  // 1b-2. Duplicate queued build for the same facility is blocked until completion
  const duplicateQueueRes = investSpecialtyProductionDomain({
    territoryIds: ['792_ada'],
    specialtyId: 'PAMUK_FIELD',
    territories: pamukOnlyRes.territories!,
    nations: pamukOnlyRes.nations!,
    playerNationId: '792',
  });
  assert.equal(duplicateQueueRes.territories, undefined, 'Concurrent duplicate specialty build on same province must be blocked');
  assert.equal(
    getSpecialtyTerritoryEligibility(pamukOnlyRes.territories!['792_ada'], pamukOpt).reason,
    'IN_PROGRESS'
  );

  // 1b-3. Advancing computeGameTick completes the queued build, increments level and adds baseGdp
  const initialBuildingLevel = adana.buildings[pamukOpt.buildingBoost] || 0;
  let timedTick = computeGameTick({
    tick: 1,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: pamukOnlyRes.nations!,
    territories: pamukOnlyRes.territories!,
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: { ...DEFAULT_GAME_SETTINGS, fogOfWarEnabled: false, crisisFrequencyDays: 0 },
  });
  for (let d = 1; d < pamukOpt.buildDays; d++) {
    timedTick = computeGameTick({
      tick: timedTick.nextTick,
      hour: timedTick.nextHour,
      hoursStep: 24,
      speed: 1,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: timedTick.nations,
      territories: timedTick.territories,
      relations: timedTick.relations,
      wars: timedTick.wars,
      battles: [],
      movements: [],
      newsEvents: [],
      settings: { ...DEFAULT_GAME_SETTINGS, fogOfWarEnabled: false, crisisFrequencyDays: 0 },
    });
  }
  assert.equal(timedTick.territories['792_ada'].constructionQueue?.length ?? 0, 0, 'Completed build should leave queue');
  assert.equal(
    timedTick.territories['792_ada'].buildings[pamukOpt.buildingBoost],
    initialBuildingLevel + 1,
    'Building level should increment by 1 on completion'
  );
  assert.ok(timedTick.territories['792_ada'].baseGdp > adana.baseGdp, 'Completed specialty build should boost baseGdp');

  // 1b-4. Max level cap (5/5) blocks further specialty investment
  const maxedAdanaTerritories: Record<string, Territory> = {
    ...territories,
    '792_ada': {
      ...adana,
      buildings: { ...adana.buildings, [pamukOpt.buildingBoost]: 5 },
    },
  };
  assert.equal(
    getSpecialtyTerritoryEligibility(maxedAdanaTerritories['792_ada'], pamukOpt).reason,
    'MAXED'
  );
  const maxedRes = investSpecialtyProductionDomain({
    territoryIds: ['792_ada'],
    specialtyId: 'PAMUK_FIELD',
    territories: maxedAdanaTerritories,
    nations,
    playerNationId: '792',
  });
  assert.equal(maxedRes.territories, undefined, 'Specialty build at maxLevel 5/5 must be rejected');

  // 1c. Multi-city AUTO_NATURAL queues each city's own natural resource facility (TAHIL: 340 + PAMUK: 420 = 760 Gold)
  const investRes = investSpecialtyProductionDomain({
    territoryIds: ['792_edi', '792_ada'],
    specialtyId: 'AUTO_NATURAL',
    territories,
    nations,
    playerNationId: '792',
  });
  assert.ok(investRes.territories, 'AUTO_NATURAL specialty production should queue on all selected territories');
  assert.equal(investRes.territories!['792_edi'].resource, 'TAHIL');
  assert.equal(investRes.territories!['792_ada'].resource, 'PAMUK');
  assert.equal(investRes.nations!['792'].treasury, 1500 - 760);
  assert.equal(investRes.territories!['792_edi'].constructionQueue?.length, 1);

  // 1d. Mercenary hiring consumes gold (0 manpower) and queues timed muster
  const fundedNations = {
    ...investRes.nations!,
    '792': { ...investRes.nations!['792'], treasury: 2500 },
  };
  const mercRes = hireMercenaryDomain({
    territoryId: '792_edi',
    companyId: 'merc_vanguard',
    territories: investRes.territories!,
    nations: fundedNations,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(mercRes.territories, 'Mercenary hiring should succeed');
  assert.equal(mercRes.nations!['792'].manpower, 10000, 'Mercenary hiring must cost 0 manpower');
  assert.ok(
    (mercRes.territories!['792_edi'].recruitmentQueue?.length ?? 0) >= 1,
    'Mercenary company must enter timed muster queue'
  );

  // 2. Post-war assimilation on conquered non-core city (300_ist has coreOwnerId: '300', assimilation: 25)
  const assimRes = assimilateTerritoryDomain({
    territoryId: '300_ist',
    territories: investRes.territories!,
    nations: investRes.nations!,
    playerNationId: '792',
  });
  assert.equal(assimRes.territories?.['300_ist']?.isAssimilating, true);
  assert.equal(assimRes.territories?.['300_ist']?.unrest, 12);

  // 3. Conquered nations ledger in NationDiplomacySummary
  const relations: Record<string, DiplomaticRelation> = {
    '300_380': {
      nationA: '300',
      nationB: '380',
      score: 60,
      isAllied: true,
      hasNonAggression: true,
      hasTradeAgreement: true,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
    '300_688': {
      nationA: '300',
      nationB: '688',
      score: 10,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
  };

  const summary = buildNationDiplomacySummary({
    targetNationId: '792',
    nations,
    territories,
    relations,
    wars: [],
    movements: [],
    tick: 10,
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(summary);
  assert.equal(summary!.conqueredNations.length, 1);
  assert.equal(summary!.conqueredNations[0].nation.id, '300');
  assert.equal(summary!.conqueredNations[0].isEliminated, true);
  assert.equal(summary!.conqueredNations[0].capturedProvinceCount, 1);

  // 4. Diplomatic reaction penalty when conquering/attacking a nation with allies & same-religion neighbors
  const penaltyRes = applyConquestDiplomaticPenalty({
    conquerorId: '792',
    victimId: '300',
    provincesTakenCount: 1,
    isFullAnnexation: true,
    nations,
    relations,
  });
  assert.ok(
    penaltyRes.affectedNames.some((n) => n.includes('Venedik Cumhuriyeti')),
    'Victim ally Venice must react'
  );
  assert.ok(
    (penaltyRes.updatedRelations['380_792']?.score ?? 0) <= -35,
    'Venice relation with conqueror must drop sharply'
  );
  assert.ok(
    (penaltyRes.updatedRelations['688_792']?.score ?? 0) <= -12,
    'Same-religion neighbor Serbia relation with conqueror must drop'
  );
});

test('initializeWorld2026 classifies coastal vs inland provinces and enforces shipyard coastal gating', () => {
  const bundle = initializeWorld2026('EMPIRES_1440');
  assert.equal(bundle.territories['792_IST']?.isCoastal, true);
  assert.equal(bundle.territories['792_IZM']?.isCoastal, true);
  assert.equal(bundle.territories['792_TRB']?.isCoastal, true);
  assert.equal(bundle.territories['300']?.isCoastal, true);
  assert.equal(bundle.territories['792']?.isCoastal, false);
  assert.equal(bundle.territories['792_KNY']?.isCoastal, false);
  assert.equal(bundle.territories['348']?.isCoastal, false);
  assert.equal(bundle.territories['040']?.isCoastal, false);
  assert.equal(bundle.territories['643']?.isCoastal, false);

  const nations = {
    '792': { ...bundle.nations['792'], treasury: 5000 },
  };
  const rejected = upgradeBuildingDomain({
    territoryId: '792',
    building: 'shipyard',
    territories: bundle.territories,
    nations,
    playerNationId: '792',
  });
  assert.match(rejected.toastMessage || '', /kıyısı olan şehirlerde/i);
  assert.equal(rejected.nations, undefined);

  const accepted = upgradeBuildingDomain({
    territoryId: '792_IZM',
    building: 'shipyard',
    territories: bundle.territories,
    nations,
    playerNationId: '792',
  });
  assert.equal(accepted.nations?.['792'].treasury, 5000 - 520);
  assert.equal(accepted.territories?.['792_IZM'].constructionQueue?.[0]?.building, 'shipyard');
  assert.equal(isTerritoryCoastal({ id: 'custom_1', resource: 'TAHIL', isCoastal: false }), false);
  assert.equal(isTerritoryCoastal({ id: '792_IST', resource: 'TICARET_BOGAZI' }), true);
});

test('shipyard, mint, and granary buildings produce measurable economic, demographic, and defense effects', () => {
  const baseNation: Nation = {
    id: '792',
    name: 'Osmanlı',
    flagCode: 'TR_OTTOMAN',
    color: '#1b3b2b',
    ideology: 'MONARCHY',
    treasury: 5000,
    manpower: 20000,
    researchPoints: 50,
    activeResearch: null,
    stability: 80,
    diplomacyPoints: 50,
    taxRate: 25,
    budget: { military: 30, economy: 30, research: 20, welfare: 20 },
    inflation: 4,
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    capitalTerritoryId: 'ist',
    isEliminated: false,
    recruitedGeneralIds: [],
    activeGeneralId: null,
  };

  const baseTerritory: Territory = {
    id: 'ist',
    name: 'İstanbul',
    ownerId: '792',
    coreOwnerId: '792',
    isCapital: true,
    isCoastal: true,
    terrain: 'METROPOL',
    population: 1_000_000,
    baseGdp: 100,
    resource: 'TICARET_BOGAZI',
    buildings: {
      factory: 1,
      barracks: 3,
      fortress: 1,
      university: 1,
      tradeHub: 1,
      supplyDepot: 1,
      shipyard: 0,
      mint: 0,
      granary: 0,
    },
    garrison: 5000,
    units: { infantry: 5000, armor: 0, airDrone: 0 },
    unrest: 0,
    isOccupied: false,
    centroid: [29, 41],
    neighbors: [],
  };

  const econBase = calculateNationEconomy(baseNation, { ist: baseTerritory }, { '792': baseNation }, {}, []);
  const capBase = computeNationManpowerCap(baseNation, { ist: baseTerritory });
  const defBase = computeCombatStrength(baseNation, baseTerritory, true);

  const upgradedTerr: Territory = {
    ...baseTerritory,
    buildings: {
      ...baseTerritory.buildings,
      shipyard: 2,
      mint: 2,
      granary: 2,
    },
  };

  const econUp = calculateNationEconomy(baseNation, { ist: upgradedTerr }, { '792': baseNation }, {}, []);
  const capUp = computeNationManpowerCap(baseNation, { ist: upgradedTerr });
  const defUp = computeCombatStrength(baseNation, upgradedTerr, true);

  assert.ok(econUp.tradeIncome > econBase.tradeIncome, 'Shipyard should raise trade income');
  assert.ok(econUp.taxIncome > econBase.taxIncome, 'Mint should raise tax income');
  assert.ok(econUp.inflationRelief > econBase.inflationRelief, 'Mint should raise inflation relief');
  assert.ok(econUp.dailyManpower > econBase.dailyManpower, 'Granary should raise daily manpower');
  assert.equal(capUp - capBase, 12_000, '2 Granary levels should add 12,000 manpower cap');
  assert.ok(defUp > defBase, 'Coastal shipyard should boost defender combat strength');

  const tickBase = computeGameTick({
    tick: 0,
    hour: 22,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': baseNation },
    territories: { ist: baseTerritory },
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  const tickGranary = computeGameTick({
    tick: 0,
    hour: 22,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': baseNation },
    territories: { ist: upgradedTerr },
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.ok(
    tickGranary.territories.ist.population > tickBase.territories.ist.population,
    'Granary should boost daily population growth'
  );
});

test('Tier 5 technologies exist in both eras and apply combat, trade, assimilation, unrest, and research effects', () => {
  for (const id of ['mil_5', 'eco_5', 'adm_5', 'sci_5']) {
    assert.ok(TECH_TREE.some((t) => t.id === id && t.tier === 5), `TECH_TREE missing ${id}`);
    assert.ok(TECH_TREE_1440.some((t) => t.id === id && t.tier === 5), `TECH_TREE_1440 missing ${id}`);
  }

  const baseNation: Nation = {
    id: '792',
    name: 'Osmanlı',
    flagCode: 'TR_OTTOMAN',
    color: '#1b3b2b',
    ideology: 'MONARCHY',
    treasury: 5000,
    manpower: 20000,
    researchPoints: 50,
    activeResearch: null,
    stability: 80,
    diplomacyPoints: 50,
    taxRate: 25,
    budget: { military: 30, economy: 30, research: 20, welfare: 20 },
    inflation: 2,
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    capitalTerritoryId: '792_IST',
    isEliminated: false,
    recruitedGeneralIds: [],
    activeGeneralId: null,
  };

  const tIst: Territory = {
    id: '792_IST',
    name: 'İstanbul',
    ownerId: '792',
    coreOwnerId: '300',
    isCapital: true,
    isCoastal: true,
    terrain: 'METROPOL',
    population: 600_000,
    baseGdp: 90,
    resource: 'TICARET_BOGAZI',
    buildings: { factory: 1, barracks: 1, fortress: 1, university: 1, tradeHub: 1, supplyDepot: 1 },
    garrison: 10000,
    units: { infantry: 10000, armor: 0, airDrone: 0 },
    unrest: 12,
    assimilation: 40,
    isAssimilating: true,
    isOccupied: false,
    centroid: [29, 41],
    neighbors: [],
  };

  const baseEcon = calculateNationEconomy(baseNation, { '792_IST': tIst }, { '792': baseNation }, {}, []);
  const tier5Nation: Nation = {
    ...baseNation,
    unlockedTechs: ['mil_5', 'eco_5', 'adm_5', 'sci_5'],
  };
  const tier5Econ = calculateNationEconomy(tier5Nation, { '792_IST': tIst }, { '792': tier5Nation }, {}, []);

  assert.ok(computeCombatStrength(tier5Nation, tIst, false) > computeCombatStrength(baseNation, tIst, false));
  assert.ok(tier5Econ.militaryUpkeep < baseEcon.militaryUpkeep, 'mil_5 should cut military upkeep');
  assert.ok(tier5Econ.straitTollIncome > baseEcon.straitTollIncome, 'eco_5 should boost strait tolls');
  assert.ok(tier5Econ.dailyResearch > baseEcon.dailyResearch, 'sci_5 should boost research output');
  assert.ok(tier5Econ.productionIncome > baseEcon.productionIncome, 'sci_5 should boost production');
  assert.ok(
    calculateProvinceDevelopment(tIst, tier5Nation).techInvestmentMult >
      calculateProvinceDevelopment(tIst, baseNation).techInvestmentMult
  );

  const baseDay = computeGameTick({
    tick: 0,
    hour: 22,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': baseNation },
    territories: { '792_IST': tIst },
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  const adm5Day = computeGameTick({
    tick: 0,
    hour: 22,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': tier5Nation },
    territories: { '792_IST': tIst },
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.ok(
    (adm5Day.territories['792_IST'].assimilation || 0) >
      (baseDay.territories['792_IST'].assimilation || 0),
    'adm_5 should accelerate daily assimilation'
  );
  assert.ok(
    adm5Day.territories['792_IST'].unrest < baseDay.territories['792_IST'].unrest,
    'adm_5 should calm unrest faster daily'
  );
});

test('batch empire management domains process assimilation, festivals, coastal-safe batch building, and border mobilization', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 2500,
      manpower: 5000,
      stability: 60,
      enactedReforms: [],
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    coast: {
      id: 'coast',
      name: 'İzmir',
      ownerId: '792',
      coreOwnerId: '300',
      isCoastal: true,
      baseGdp: 70,
      unrest: 22,
      assimilation: 30,
      isAssimilating: false,
      isOccupied: false,
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 1, supplyDepot: 0, shipyard: 0 },
      neighbors: ['enemy'],
    } as unknown as Territory,
    inland: {
      id: 'inland',
      name: 'Ankara',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: false,
      baseGdp: 65,
      unrest: 14,
      assimilation: 100,
      isAssimilating: false,
      isOccupied: false,
      garrison: 3000,
      units: { infantry: 3000, armor: 0, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['coast'],
    } as unknown as Territory,
    enemy: {
      id: 'enemy',
      name: 'Atina',
      ownerId: '300',
      neighbors: ['coast'],
    } as unknown as Territory,
  };

  const assimRes = batchAssimilateDomain({ territories, nations, playerNationId: '792' });
  assert.equal(assimRes.territories?.coast.isAssimilating, true);
  assert.equal(assimRes.nations?.['792'].treasury, 2500 - 180);

  const festRes = batchStabilityFestivalDomain({ territories, nations, playerNationId: '792' });
  assert.equal(festRes.territories?.coast.unrest, 7);
  assert.equal(festRes.territories?.inland.unrest, 0);
  assert.equal(festRes.nations?.['792'].stability, 64);

  const shipRes = batchUpgradeBuildingDomain({
    territories,
    nations,
    playerNationId: '792',
    building: 'shipyard',
  });
  assert.equal(shipRes.territories?.coast.constructionQueue?.[0]?.building, 'shipyard');
  assert.equal(shipRes.territories?.inland.constructionQueue?.length || 0, 0);
  assert.equal(shipRes.nations?.['792'].treasury, 2500 - 520);

  const mobRes = batchBorderMobilizationDomain({ territories, nations, playerNationId: '792' });
  const coastQueued = (mobRes.territories?.coast.recruitmentQueue ?? []).reduce(
    (s, j) => s + (j.troops || 0),
    0
  );
  assert.equal(coastQueued, 1000);
  assert.equal(mobRes.territories?.inland.recruitmentQueue?.length ?? 0, 0);
  assert.equal(mobRes.nations?.['792'].manpower, 4000);
});

test('Gameplay fixes: manpower cap and daily manpower scale properly when population is in thousands', () => {
  const usa: Nation = {
    id: '840',
    name: 'ABD',
    treasury: 10000,
    manpower: 180000,
    stability: 70,
    taxRate: 25,
    budget: { military: 30, research: 25, infrastructure: 25, administration: 20 },
    unlockedTechs: [],
    enactedReforms: [],
    isEliminated: false,
  } as unknown as Nation;

  const usaTerrs: Record<string, Territory> = {
    us1: {
      id: 'us1',
      name: 'Washington',
      ownerId: '840',
      coreOwnerId: '840',
      population: 120000,
      baseGdp: 500,
      garrison: 20000,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 2, barracks: 2, fortress: 1, university: 1, tradeHub: 1, supplyDepot: 1, shipyard: 1, granary: 0 },
      neighbors: [],
    } as unknown as Territory,
    us2: {
      id: 'us2',
      name: 'New York',
      ownerId: '840',
      coreOwnerId: '840',
      population: 219000,
      baseGdp: 500,
      garrison: 15000,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 2, barracks: 2, fortress: 1, university: 1, tradeHub: 1, supplyDepot: 1, shipyard: 1, granary: 0 },
      neighbors: [],
    } as unknown as Territory,
  };

  const cap = computeNationManpowerCap(usa, usaTerrs);
  assert.ok(cap > usa.manpower, `Expected USA cap (${cap}) > starting manpower (${usa.manpower})`);

  const econ = calculateNationEconomy(usa, usaTerrs, { '840': usa }, {}, []);
  assert.ok(econ.dailyManpower >= 1500, `Expected meaningful daily manpower for USA, got ${econ.dailyManpower}`);
});

test('startNewGame auto-starts player research on Day 1 and tickEngine auto-chains next tech when autoResearch is enabled', async () => {
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  useGameStore.getState().startNewGame();
  const s = useGameStore.getState();
  const p = s.nations[s.playerNationId];
  assert.equal(p.autoResearch, true, 'New campaign should enable autoResearch by default');
  assert.ok(
    p.activeResearch && p.activeResearch.techId,
    'New campaign should auto-start a research project immediately on Day 1'
  );
  assert.ok(s.worldSeed > 0, 'New campaign should assign a non-zero worldSeed');

  const firstTechId = p.activeResearch.techId;
  // Push active research nearly to completion and step 1 full day (24 hours)
  const nearCompletePlayer: Nation = {
    ...p,
    activeResearch: {
      ...p.activeResearch,
      progress: Math.max(0, p.activeResearch.totalCost - 0.1),
    },
  };

  const out = computeGameTick({
    tick: 1,
    hour: 23,
    hoursStep: 2,
    speed: 1,
    gameMode: s.gameMode,
    playerNationId: s.playerNationId,
    nations: { ...s.nations, [s.playerNationId]: nearCompletePlayer },
    territories: s.territories,
    relations: s.relations,
    wars: [],
    battles: [],
    movements: [],
    seaArmies: [],
    newsEvents: [],
    settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
    worldSeed: s.worldSeed,
  });

  const updatedPlayer = out.nations[s.playerNationId];
  assert.ok(
    updatedPlayer.unlockedTechs.includes(firstTechId),
    'Completed auto-started tech should be unlocked'
  );
  assert.ok(
    updatedPlayer.activeResearch &&
      updatedPlayer.activeResearch.techId !== firstTechId,
    'With autoResearch enabled, tickEngine should automatically queue and start the next available tech'
  );
});

test('toggleAutoResearchDomain starts next tech when toggled ON while idle and cancelResearchDomain disables autoResearch', async () => {
  const { toggleAutoResearchDomain } = await import('./empireAndArmyActions');
  const player = mkFaz3Nation('792', {
    autoResearch: false,
    activeResearch: null,
    unlockedTechs: [],
  });

  const turnedOn = toggleAutoResearchDomain({
    nations: { '792': player },
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
    tick: 5,
  });
  assert.ok(turnedOn.nations);
  const onPlayer = turnedOn.nations['792'];
  assert.equal(onPlayer.autoResearch, true);
  assert.ok(
    onPlayer.activeResearch && onPlayer.activeResearch.techId,
    'Enabling autoResearch while idle should start the next tech immediately'
  );

  const paused = cancelResearchDomain({
    nations: { '792': onPlayer },
    playerNationId: '792',
  });
  assert.ok(paused.nations);
  assert.equal(paused.nations['792'].activeResearch, null);
  assert.equal(
    paused.nations['792'].autoResearch,
    false,
    'Pausing research should disable autoResearch so it does not immediately restart'
  );
});

test('both 1440 and 2026 tech trees expose 76 illustrated branching technologies across 10 eras (1444 -> 2026 Nuclear Missile) with valid prerequisites', async () => {
  const { TECH_TREE, TECH_TREE_1440 } = await import('../data/techAndArmyTiers');

  for (const [label, tree] of [
    ['1440', TECH_TREE_1440],
    ['2026', TECH_TREE],
  ] as const) {
    assert.equal(tree.length, 76, `${label} tech tree must have 76 technologies`);
    const ids = new Set(tree.map((t) => t.id));
    assert.equal(ids.size, 76, `${label} tech IDs must be unique`);
    assert.ok(ids.has('mil_10'), `${label} tech tree must culminate in mil_10 (Nükleer Füze)`);

    for (const branch of ['MILITARY', 'ECONOMY', 'ADMINISTRATION', 'SCIENCE'] as const) {
      const branchItems = tree.filter((t) => t.branch === branch);
      assert.ok(
        branchItems.length >= 18 && branchItems.length <= 20,
        `${label} ${branch} must have 18-20 techs across 10 eras (got ${branchItems.length})`
      );
      assert.ok(
        branchItems.filter((t) => (t.subRow ?? 0) === 0).length >= 9,
        `${label} ${branch} main track must span 9-10 tiers`
      );
      assert.ok(
        branchItems.filter((t) => t.subRow === 1).length >= 9,
        `${label} ${branch} specialist track must span 9-10 tiers`
      );
    }

    for (const tech of tree) {
      assert.ok(tech.shortTitle && tech.shortTitle.length > 0, `${label} ${tech.id} missing shortTitle`);
      assert.ok(tech.artKey && tech.artKey.length > 0, `${label} ${tech.id} missing artKey`);
      assert.ok(tech.description && tech.description.length > 10, `${label} ${tech.id} missing description`);
      assert.ok(tech.effectLabel && tech.effectLabel.length > 3, `${label} ${tech.id} missing effectLabel`);
      if (tech.prerequisite) {
        assert.ok(
          ids.has(tech.prerequisite),
          `${label} ${tech.id} prerequisite ${tech.prerequisite} must exist in tree`
        );
      }
    }
  }
});

test('new specialist technologies deliver real measurable effects across economy, naval, combat, supply, construction, and daily ticks', async () => {
  const {
    computeNationNavalBonus,
    computeNationManpowerCap,
    computeCombatStrength,
  } = await import('./simulationEngine');
  const { calculateProvinceSupplyLimit, getGameSeason } = await import(
    './seasonSupplyAndAiProfile'
  );
  const { recruitUnitDomain, upgradeBuildingDomain } = await import('./empireAndArmyActions');
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  const baseNation = mkFaz3Nation('792', {
    treasury: 50000,
    manpower: 20000,
    diplomacyPoints: 50,
    inflation: 10,
    unlockedTechs: [],
    activeResearch: null,
    autoResearch: false,
    budget: { military: 30, economy: 25, research: 25, welfare: 20 },
  });
  const vassalNation = mkFaz3Nation('300', {
    treasury: 5000,
    vassalOf: '792',
    unlockedTechs: [],
  });

  const makeBaseTerritories = (): Record<string, Territory> => ({
    '792': {
      id: '792',
      name: 'Kostantiniyye',
      ownerId: '792',
      coreOwnerId: '792',
      population: 120000,
      baseGdp: 200,
      resource: 'TICARET_BOGAZI',
      garrison: 8000,
      units: { infantry: 6000, armor: 1500, airDrone: 500 },
      unrest: 30,
      assimilation: 40,
      isAssimilating: true,
      isOccupied: false,
      isCoastal: true,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 1,
        university: 2,
        tradeHub: 2,
        supplyDepot: 1,
        shipyard: 1,
        mint: 0,
        granary: 0,
      },
      neighbors: ['300'],
      centroid: [28.9, 41.0],
    } as unknown as Territory,
    '300': {
      id: '300',
      name: 'Mora',
      ownerId: '300',
      coreOwnerId: '300',
      population: 45000,
      baseGdp: 120,
      resource: 'LIMAN',
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: true,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 1,
        supplyDepot: 0,
      },
      neighbors: ['792'],
      centroid: [22.4, 37.5],
    } as unknown as Territory,
  });

  const tBase = makeBaseTerritories();
  const nationsBase = { '792': baseNation, '300': vassalNation };

  const econBase = calculateNationEconomy(baseNation, tBase, nationsBase, {}, [], []);
  const specNation: Nation = {
    ...baseNation,
    unlockedTechs: [
      'mil_1b',
      'mil_2b',
      'mil_3b',
      'mil_4b',
      'mil_5b',
      'eco_1b',
      'eco_2b',
      'eco_3b',
      'eco_4b',
      'eco_5b',
      'adm_1b',
      'adm_2b',
      'adm_3b',
      'adm_4b',
      'adm_5b',
      'sci_1b',
      'sci_2b',
      'sci_3b',
      'sci_4b',
      'sci_5b',
    ],
  };
  const nationsSpec = { '792': specNation, '300': vassalNation };
  const econSpec = calculateNationEconomy(specNation, tBase, nationsSpec, {}, [], []);

  assert.ok(econSpec.taxIncome > econBase.taxIncome, 'eco_3b/eco_5b must increase tax income');
  assert.ok(econSpec.productionIncome > econBase.productionIncome, 'eco_2b/sci_4b must increase production income');
  assert.ok(econSpec.tradeIncome > econBase.tradeIncome, 'eco_4b/mil_3b/sci_3b must increase trade income');
  assert.ok(econSpec.vassalIncome > econBase.vassalIncome, 'adm_5b must boost vassal income');
  assert.ok(econSpec.dailyResearch > econBase.dailyResearch * 1.4, 'sci_2b/sci_5b must strongly boost daily research');
  assert.ok(econSpec.dailyManpower > econBase.dailyManpower, 'eco_1b/sci_1b must increase daily manpower');
  assert.ok(econSpec.inflationRelief > econBase.inflationRelief, 'eco_3b/eco_5b must increase inflation relief');
  assert.ok(econSpec.militaryUpkeep < econBase.militaryUpkeep, 'mil_5b must reduce military upkeep');

  // Manpower Cap (adm_4b)
  const capBase = computeNationManpowerCap(baseNation, tBase);
  const capSpec = computeNationManpowerCap(specNation, tBase);
  assert.ok(capSpec > capBase, 'adm_4b must increase national manpower cap');

  // Naval Bonus (mil_1b + mil_3b + sci_3b)
  const navalBase = computeNationNavalBonus('792', tBase, baseNation);
  const navalSpec = computeNationNavalBonus('792', tBase, specNation);
  assert.ok(navalSpec > navalBase + 0.4, 'mil_1b/mil_3b/sci_3b must boost naval combat multiplier');

  // Combat Attack (mil_5b + sci_5b) & Defense (mil_2b + sci_5b)
  const units = { infantry: 5000, armor: 1000, airDrone: 500 };
  const atkBase = computeCombatStrength(baseNation, tBase['792'], false, units);
  const atkSpec = computeCombatStrength(specNation, tBase['792'], false, units);
  const defBase = computeCombatStrength(baseNation, tBase['792'], true, units);
  const defSpec = computeCombatStrength(specNation, tBase['792'], true, units);
  assert.ok(atkSpec >= atkBase + 0.34, 'mil_5b + sci_5b must boost offensive combat strength');
  assert.ok(defSpec >= defBase + 0.29, 'mil_2b + sci_5b must boost defensive combat strength');

  // Supply Limit (mil_4b + eco_4b)
  const springSeason = getGameSeason(100, 'EMPIRES_1440');
  const supplyBase = calculateProvinceSupplyLimit(tBase['792'], baseNation, springSeason);
  const supplySpec = calculateProvinceSupplyLimit(tBase['792'], specNation, springSeason);
  assert.ok(supplySpec > supplyBase * 1.35, 'mil_4b + eco_4b must expand province supply limit');

  // Recruitment cost discount (mil_4b)
  const recBase = recruitUnitDomain({
    territoryId: '792',
    unitType: 'infantry',
    amount: 1000,
    baseGoldCost: 120,
    territories: tBase,
    nations: nationsBase,
    playerNationId: '792',
  });
  const recSpec = recruitUnitDomain({
    territoryId: '792',
    unitType: 'infantry',
    amount: 1000,
    baseGoldCost: 120,
    territories: tBase,
    nations: nationsSpec,
    playerNationId: '792',
  });
  assert.ok(
    (recSpec.nations?.['792']?.treasury ?? 0) > (recBase.nations?.['792']?.treasury ?? 0),
    'mil_4b must lower unit recruitment gold cost'
  );

  // Construction cost discount (eco_2b + adm_1b + sci_4b) and duration discount (adm_3b)
  const buildBase = upgradeBuildingDomain({
    territoryId: '792',
    building: 'factory',
    territories: tBase,
    nations: nationsBase,
    playerNationId: '792',
  });
  const buildSpec = upgradeBuildingDomain({
    territoryId: '792',
    building: 'factory',
    territories: tBase,
    nations: nationsSpec,
    playerNationId: '792',
  });
  assert.ok(
    (buildSpec.nations?.['792']?.treasury ?? 0) > (buildBase.nations?.['792']?.treasury ?? 0),
    'eco_2b/adm_1b/sci_4b must reduce building gold cost'
  );
  const baseDays = buildBase.territories?.['792']?.constructionQueue?.[0]?.totalDays ?? 999;
  const specDays = buildSpec.territories?.['792']?.constructionQueue?.[0]?.totalDays ?? 999;
  assert.ok(specDays < baseDays, 'adm_3b must shorten construction duration');

  // Daily Tick: adm_2b diplomacy points, eco_1b/sci_1b population growth, adm_1b/adm_5b unrest calm, adm_4b assimilation speed
  const runOneDay = (nationsIn: Record<string, Nation>) =>
    computeGameTick({
      tick: 1,
      hour: 23,
      hoursStep: 2,
      speed: 1,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: nationsIn,
      territories: makeBaseTerritories(),
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      seaArmies: [],
      newsEvents: [],
      settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
      worldSeed: 123456,
    });

  const dayBase = runOneDay(nationsBase);
  const daySpec = runOneDay(nationsSpec);

  assert.ok(
    (daySpec.nations['792'].diplomacyPoints ?? 0) > (dayBase.nations['792'].diplomacyPoints ?? 0),
    'adm_2b must grant +1 extra daily diplomacy point'
  );
  assert.ok(
    daySpec.territories['792'].population > dayBase.territories['792'].population,
    'eco_1b + sci_1b must accelerate daily province population growth'
  );
  assert.ok(
    daySpec.territories['792'].unrest < dayBase.territories['792'].unrest,
    'adm_1b + adm_5b must accelerate daily unrest calming'
  );
  assert.ok(
    (daySpec.territories['792'].assimilation ?? 0) > (dayBase.territories['792'].assimilation ?? 0),
    'adm_4b must accelerate daily assimilation progress'
  );
});

test('scenario-based technology level (2026 vs 1440) and tech-gated educational & capital buildings function accurately', async () => {
  const { computeNationTechMetrics } = await import('../data/techAndArmyTiers');
  const { upgradeBuildingDomain } = await import('./empireAndArmyActions');

  const nation = mkFaz3Nation('792', {
    treasury: 10000,
    capitalTerritoryId: '792',
    unlockedTechs: [],
  });
  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Kostantiniyye',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: true,
      population: 120000,
      baseGdp: 200,
      resource: 'TICARET_BOGAZI',
      garrison: 8000,
      units: { infantry: 6000, armor: 1500, airDrone: 500 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: true,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 1,
        university: 1,
        tradeHub: 1,
        supplyDepot: 1,
        school: 0,
        highSchool: 0,
        capitalPalace: 0,
      },
      neighbors: [],
      centroid: [28.9, 41.0],
    } as unknown as Territory,
  };

  const metrics1440 = computeNationTechMetrics(nation, territories, 'EMPIRES_1440', 8);
  const metrics2026 = computeNationTechMetrics(nation, territories, 'MODERN_2026', 8);

  assert.ok(
    metrics2026.techLevel > metrics1440.techLevel + 4.5,
    '2026 scenario technology level must start significantly higher than 1440 historical technology level'
  );
  assert.ok(
    metrics2026.maxTechLevel > metrics1440.maxTechLevel + 4.0,
    '2026 max tech ceiling must exceed 1440 baseline ceiling'
  );

  // Attempting to build 'school' without 'sci_1' must be blocked
  const blockedSchool = upgradeBuildingDomain({
    territoryId: '792',
    building: 'school',
    territories,
    nations: { '792': nation },
    playerNationId: '792',
  });
  assert.equal(
    blockedSchool.territories,
    undefined,
    'school construction must be blocked until sci_1 is unlocked'
  );

  // Unlocking sci_1, sci_2, and adm_1 allows building school, highSchool, and capitalPalace
  const unlockedNation: Nation = {
    ...nation,
    unlockedTechs: ['sci_1', 'sci_2', 'adm_1'],
  };
  const allowedSchool = upgradeBuildingDomain({
    territoryId: '792',
    building: 'school',
    territories,
    nations: { '792': unlockedNation },
    playerNationId: '792',
  });
  assert.ok(
    allowedSchool.territories?.['792']?.constructionQueue?.some((q) => q.building === 'school'),
    'school must queue once sci_1 is unlocked'
  );
});

test('computeNationEconomySummary aggregates current economy and resource/building breakdown without daily ledger dependency', () => {
  const nation = {
    id: 'E1',
    name: 'Ekonomi Testi',
    unlockedTechs: ['eco_1'],
    enactedReforms: [],
    budget: { military: 25, economy: 35, research: 20, welfare: 20 },
  } as unknown as Nation;
  const territories: Record<string, Territory> = {
    P1: {
      id: 'P1',
      name: 'İpek Merkezi',
      ownerId: 'E1',
      resource: 'PAMUK',
      population: 500,
      baseGdp: 30,
      buildings: { factory: 2, tradeHub: 1, mint: 1, university: 0, barracks: 0, fortress: 0, supplyDepot: 0 },
    } as unknown as Territory,
    P2: {
      id: 'P2',
      name: 'Maden Sancağı',
      ownerId: 'E1',
      resource: 'DEMIR_CELIK',
      population: 300,
      baseGdp: 20,
      buildings: { factory: 0, tradeHub: 0, mint: 0, university: 1, barracks: 0, fortress: 0, supplyDepot: 0 },
    } as unknown as Territory,
  };
  const summary = computeNationEconomySummary(nation, territories);
  assert.equal(summary.territoryCount, 2);
  assert.ok(summary.currentEconomyValue > 0);
  assert.equal(summary.resourceBreakdown.length, 2);
  assert.ok(summary.investmentBreakdown.some((line) => line.id === 'factory' && line.totalLevels === 2));
  assert.ok(summary.investmentBreakdown.some((line) => line.id === 'trade' && line.totalLevels === 1));
  assert.ok(summary.investmentBreakdown.some((line) => line.id === 'mint_granary' && line.totalLevels === 1));
});

test('Timed recruitment scales duration with troop count and Asker Ocağı reduces both training time and daily garrison upkeep', async () => {
  const {
    calculateRecruitmentDurationDays,
    recruitUnitDomain,
  } = await import('./empireAndArmyActions');
  const { calculateNationEconomy } = await import('./simulationEngine');
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  const nation = mkFaz3Nation('792', {
    treasury: 10000,
    manpower: 30000,
    warExhaustion: 0,
  });
  const baseProv: Territory = mkFaz3Territory('P1', {
    ownerId: '792',
    coreOwnerId: '792',
    garrison: 10000,
    units: { infantry: 10000, armor: 0, airDrone: 0 },
    buildings: {
      factory: 0,
      barracks: 0,
      armyHearth: 0,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    },
  });
  const hearthProv: Territory = {
    ...baseProv,
    id: 'P2',
    buildings: { ...baseProv.buildings, armyHearth: 3 },
  };

  const days1k = calculateRecruitmentDurationDays(1000, 'infantry', baseProv, nation);
  const days5k = calculateRecruitmentDurationDays(5000, 'infantry', baseProv, nation);
  const days5kHearth = calculateRecruitmentDurationDays(5000, 'infantry', hearthProv, nation);
  assert.ok(days5k > days1k, `5000 troops (${days5k}d) must take longer than 1000 troops (${days1k}d)`);
  assert.ok(
    days5kHearth < days5k,
    `Asker Ocağı Lv.3 (${days5kHearth}d) must shorten training time vs Lv.0 (${days5k}d)`
  );

  // Upkeep discount with Asker Ocağı
  const econNoHearth = calculateNationEconomy(nation, { P1: baseProv }, { '792': nation }, {}, [], []);
  const econWithHearth = calculateNationEconomy(nation, { P2: hearthProv }, { '792': nation }, {}, [], []);
  assert.ok(
    econWithHearth.militaryUpkeep < econNoHearth.militaryUpkeep,
    'Asker Ocağı must reduce daily military upkeep of stationed troops'
  );

  // Enqueue recruitment and advance daily ticks until troops deploy
  const rec = recruitUnitDomain({
    territoryId: 'P1',
    unitType: 'infantry',
    amount: 2000,
    baseGoldCost: 560,
    territories: { P1: baseProv },
    nations: { '792': nation },
    playerNationId: '792',
    tick: 1,
  });
  assert.equal(rec.territories?.P1.garrison, 10000, 'Troops must not spawn instantly on order');
  assert.equal(rec.territories?.P1.recruitmentQueue?.length, 1);
  const totalDays = rec.territories!.P1.recruitmentQueue![0].totalDays;

  let curTerrs = rec.territories!;
  let curNations = rec.nations!;
  for (let d = 0; d < totalDays; d++) {
    const res = computeGameTick({
      tick: 2 + d,
      hour: 8,
      hoursStep: 24,
      speed: 1,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: curNations,
      territories: curTerrs,
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      settings: { ...DEFAULT_GAME_SETTINGS, fogOfWarEnabled: false, crisisFrequencyDays: 0 },
    });
    curTerrs = res.territories;
    curNations = res.nations;
  }
  assert.equal(curTerrs.P1.recruitmentQueue?.length ?? 0, 0, 'Queue must clear after training finishes');
  assert.equal(curTerrs.P1.garrison, 12000, 'Recruited troops must join garrison after training days elapse');
});

test('Province constructionQueue and recruitmentQueue progress strictly sequentially (FIFO): item 1 waits until item 0 completes', async () => {
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  const nations: Record<string, Nation> = {
    '792': mkFaz3Nation('792', {
      name: 'Osmanlı',
      capitalTerritoryId: 'P_CAP',
      treasury: 5000,
      manpower: 30000,
    }),
  };

  let curNations = nations;
  let curTerritories: Record<string, Territory> = {
    P_CAP: mkFaz3Territory('P_CAP', {
      name: 'Edirne',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: true,
      garrison: 1000,
      units: { infantry: 1000, armor: 0, airDrone: 0 },
      buildings: {
        factory: 0,
        barracks: 0,
        armyHearth: 0,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      constructionQueue: [
        {
          id: 'c_first',
          building: 'factory',
          targetLevel: 1,
          progressDays: 0,
          totalDays: 2,
          goldCost: 450,
        },
        {
          id: 'c_second',
          building: 'barracks',
          targetLevel: 1,
          progressDays: 0,
          totalDays: 2,
          goldCost: 400,
        },
      ],
      recruitmentQueue: [
        {
          id: 'r_first',
          unitMode: 'infantry',
          troops: 1000,
          units: { infantry: 1000, armor: 0, airDrone: 0 },
          label: 'Piyade Tümeni',
          startedTick: 1,
          progressDays: 0,
          totalDays: 2,
        },
        {
          id: 'r_second',
          unitMode: 'armor',
          troops: 500,
          units: { infantry: 0, armor: 500, airDrone: 0 },
          label: 'Zırhlı Tugay',
          startedTick: 1,
          progressDays: 0,
          totalDays: 2,
        },
      ],
    }),
  };

  const runOneFullDay = (tickNum: number) => {
    const out = computeGameTick({
      tick: tickNum,
      hour: 12,
      hoursStep: 12,
      speed: 2,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: curNations,
      territories: curTerritories,
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
    });
    curNations = out.nations;
    curTerritories = out.territories;
  };

  // Day 1: Only index 0 advances (1/2); index 1 MUST remain at 0/2 waiting in queue
  runOneFullDay(1);
  assert.equal(curTerritories.P_CAP.constructionQueue?.length, 2);
  assert.equal(curTerritories.P_CAP.constructionQueue![0].progressDays, 1);
  assert.equal(curTerritories.P_CAP.constructionQueue![1].progressDays, 0, 'Second building must wait at 0 days while first builds');
  assert.equal(curTerritories.P_CAP.recruitmentQueue?.length, 2);
  assert.equal(curTerritories.P_CAP.recruitmentQueue![0].progressDays, 1);
  assert.equal(curTerritories.P_CAP.recruitmentQueue![1].progressDays, 0, 'Second recruitment order must wait at 0 days while first trains');

  // Day 2: Index 0 completes and leaves queue; index 1 moves to head at 0/2
  runOneFullDay(2);
  assert.equal(curTerritories.P_CAP.buildings.factory, 1, 'First queued building must complete on Day 2');
  assert.equal(curTerritories.P_CAP.buildings.barracks, 0, 'Second queued building must not finish on Day 2');
  assert.equal(curTerritories.P_CAP.constructionQueue?.length, 1);
  assert.equal(curTerritories.P_CAP.constructionQueue![0].building, 'barracks');
  assert.equal(curTerritories.P_CAP.constructionQueue![0].progressDays, 0);

  assert.equal(curTerritories.P_CAP.garrison, 2000, 'First recruitment batch (+1000) must join garrison on Day 2');
  assert.equal(curTerritories.P_CAP.recruitmentQueue?.length, 1);
  assert.equal(curTerritories.P_CAP.recruitmentQueue![0].id, 'r_second');
  assert.equal(curTerritories.P_CAP.recruitmentQueue![0].progressDays, 0);

  // Day 3: Second item now advances to 1/2
  runOneFullDay(3);
  assert.equal(curTerritories.P_CAP.constructionQueue![0].progressDays, 1);
  assert.equal(curTerritories.P_CAP.recruitmentQueue![0].progressDays, 1);

  // Day 4: Second item completes and both queues clear
  runOneFullDay(4);
  assert.equal(curTerritories.P_CAP.buildings.barracks, 1, 'Second building must complete on Day 4');
  assert.equal(curTerritories.P_CAP.constructionQueue?.length, 0);
  assert.equal(curTerritories.P_CAP.garrison, 2500, 'Second recruitment batch (+500) must join garrison on Day 4');
  assert.equal(curTerritories.P_CAP.units.armor, 500);
  assert.equal(curTerritories.P_CAP.recruitmentQueue?.length, 0);
});
