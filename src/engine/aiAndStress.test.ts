import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGameTick } from './tickEngine';
import { evaluateMultiProvinceAiTurn, evaluateWartimeAiOperations } from './aiAndRebellionEngine';
import { executeDiplomaticActionDomain } from './diplomacyAndWarActions';
import {
  calculateProvinceSupplyLimit,
  evaluateAutomaticCapitulations,
  evaluateWeeklySupplyAndSeasonAttrition,
  getGameSeason,
  resolveNationAiPersonality,
} from './seasonSupplyAndAiProfile';
import { initializeWorld2026 } from './worldBuilder';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';
import { useGameStore } from '../store/useGameStore';
import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  SeaArmy,
  Territory,
} from '../types/game';
import { mkFaz3Nation, mkFaz3Territory } from '../testHelpers/mockWorldFactories';

test('declaring war on a neighboring nation immediately triggers enemy AI mobilization and counter-attack', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı Cihan Devleti',
      treasury: 1200,
      manpower: 20000,
      isEliminated: false,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
    '348': {
      id: '348',
      name: 'Macaristan Krallığı',
      treasury: 900,
      manpower: 18000,
      isEliminated: false,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    '792_sof': {
      id: '792_sof',
      name: 'Sofya',
      ownerId: '792',
      coreOwnerId: '792',
      garrison: 12000,
      units: { infantry: 9000, armor: 2000, airDrone: 1000 },
      neighbors: ['348'],
      centroid: [23, 42],
    } as unknown as Territory,
    '348': {
      id: '348',
      name: 'Budin',
      ownerId: '348',
      coreOwnerId: '348',
      garrison: 16000,
      units: { infantry: 11000, armor: 3500, airDrone: 1500 },
      neighbors: ['792_sof'],
      centroid: [19, 47],
    } as unknown as Territory,
  };

  const warPatch = executeDiplomaticActionDomain({
    targetNationId: '348',
    action: 'DECLARE_WAR',
    playerNationId: '792',
    totalPlayerGarrison: 12000,
    tick: 2,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {
      '348_792': {
        nationA: '348',
        nationB: '792',
        score: -40,
        isAllied: false,
        hasNonAggression: false,
        hasTradeAgreement: false,
        hasEmbargo: false,
        hasMilitaryAccess: false,
        truceUntilTick: 0,
      },
    },
    wars: [],
    movements: [],
    newsEvents: [],
  });

  assert.equal(warPatch.wars?.length, 1);
  assert.equal(warPatch.nations?.['792']?.diplomacyPoints, 90);
  // Enemy AI (348 Hungary) must immediately launch a counter-attack movement against 792_sof!
  const enemyCounterMove = warPatch.movements?.find(
    (m) => m.ownerId === '348' && m.toTerritoryId === '792_sof' && m.isAttack
  );
  assert.ok(
    enemyCounterMove,
    'Enemy nation 348 should launch an active counter-attack upon war declaration'
  );
});

test('180-day headless simulation stress test maintains state invariants across 1440 and 2026', () => {
  for (const mode of ['EMPIRES_1440', 'STANDARD_2026'] as const) {
    const bundle = initializeWorld2026(mode);
    let tick = 0;
    let hour = 8;
    let nations = bundle.nations;
    let territories = bundle.territories;
    let relations = bundle.relations;
    let wars: ActiveWar[] = [];
    let battles: ActiveBattle[] = [];
    let movements: Parameters<typeof computeGameTick>[0]['movements'] = [];
    let newsEvents: Parameters<typeof computeGameTick>[0]['newsEvents'] = [];

    // 180 days at 6 hours per step = 720 steps
    for (let step = 0; step < 720; step++) {
      const out = computeGameTick({
        tick,
        hour,
        hoursStep: 6,
        speed: 4,
        gameMode: mode,
        playerNationId: '792',
        nations,
        territories,
        relations,
        wars,
        battles,
        movements,
        newsEvents,
        settings: DEFAULT_GAME_SETTINGS,
      });
      tick = out.nextTick;
      hour = out.nextHour;
      nations = out.nations;
      territories = out.territories;
      relations = out.relations;
      wars = out.wars;
      battles = out.battles;
      movements = out.movements;
      newsEvents = out.newsEvents;
    }

    assert.equal(tick, 180, `${mode} should reach day 180`);
    for (const t of Object.values(territories)) {
      assert.ok(Number.isFinite(t.garrison) && t.garrison >= 0, `${mode} ${t.id} invalid garrison`);
      assert.ok(Boolean(nations[t.ownerId]), `${mode} ${t.id} missing owner nation`);
      if (t.units) {
        assert.ok(
          Number.isFinite(t.units.infantry) &&
            Number.isFinite(t.units.armor) &&
            Number.isFinite(t.units.airDrone) &&
            t.units.infantry >= 0 &&
            t.units.armor >= 0 &&
            t.units.airDrone >= 0,
          `${mode} ${t.id} invalid unit counts`
        );
      }
    }
    for (const n of Object.values(nations)) {
      assert.ok(
        Number.isFinite(n.treasury) &&
          Number.isFinite(n.inflation) &&
          Number.isFinite(n.stability) &&
          Number.isFinite(n.manpower),
        `${mode} nation ${n.id} has non-finite stats`
      );
    }
  }
});

test('manpower growth is bounded by empire manpower cap over long campaigns', () => {
  const bundle = initializeWorld2026('EMPIRES_1440');
  let tick = 0;
  let hour = 8;
  let nations = bundle.nations;
  let territories = bundle.territories;
  let relations = bundle.relations;
  let wars: ActiveWar[] = [];
  let battles: ActiveBattle[] = [];
  let movements: Parameters<typeof computeGameTick>[0]['movements'] = [];
  let newsEvents: Parameters<typeof computeGameTick>[0]['newsEvents'] = [];

  for (let step = 0; step < 360; step++) {
    const out = computeGameTick({
      tick,
      hour,
      hoursStep: 6,
      speed: 4,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations,
      territories,
      relations,
      wars,
      battles,
      movements,
      newsEvents,
      settings: DEFAULT_GAME_SETTINGS,
    });
    tick = out.nextTick;
    hour = out.nextHour;
    nations = out.nations;
    territories = out.territories;
    relations = out.relations;
    wars = out.wars;
    battles = out.battles;
    movements = out.movements;
    newsEvents = out.newsEvents;
  }

  assert.ok(
    nations['792'].manpower < 650_000,
    `Ottoman manpower should stay bounded below 650K after 90 days, got ${nations['792'].manpower}`
  );
});

test('upgraded AI relieves besieged capitals, builds peacetime economy, and signs proactive AI-to-AI pacts', () => {
  const mkNation = (id: string, overrides: Partial<Nation> = {}): Nation =>
    ({
      id,
      name: id,
      flagCode: id,
      color: '#445566',
      capitalTerritoryId: `${id}_1`,
      ideology: 'MONARCHY',
      treasury: 1800,
      manpower: 25000,
      stability: 80,
      inflation: 1,
      researchPoints: 0,
      taxRate: 25,
      budget: { military: 35, economy: 30, research: 15, welfare: 20 },
      aggressiveExpansion: 5,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
      ...overrides,
    }) as unknown as Nation;

  const mkTerr = (id: string, ownerId: string, neighbors: string[], overrides: Partial<Territory> = {}): Territory =>
    ({
      id,
      name: id,
      ownerId,
      coreOwnerId: ownerId,
      isCapital: false,
      population: 1_000_000,
      baseGdp: 100,
      resource: 'TAHIL',
      terrain: 'OVA',
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      garrison: 12000,
      units: { infantry: 9000, armor: 2000, airDrone: 1000 },
      unrest: 5,
      isOccupied: false,
      centroid: [0, 0],
      neighbors,
      ...overrides,
    }) as unknown as Territory;

  // 1. Wartime AI relieves a besieged capital from a rear reserve province
  const warNations: Record<string, Nation> = {
    PLR: mkNation('PLR'),
    AI_A: mkNation('AI_A'),
    AI_B: mkNation('AI_B'),
  };
  const warTerrs: Record<string, Territory> = {
    PLR_1: mkTerr('PLR_1', 'PLR', []),
    AI_A_1: mkTerr('AI_A_1', 'AI_A', ['AI_A_2', 'AI_B_1'], {
      isCapital: true,
      garrison: 3000,
      siege: {
        territoryId: 'AI_A_1',
        attackerId: 'AI_B',
        defenderId: 'AI_A',
        attackerTroops: 9000,
        attackerUnits: { infantry: 7000, armor: 1500, airDrone: 500 },
        progress: 40,
        wallIntegrity: 70,
        startedTick: 1,
      },
    }),
    AI_A_2: mkTerr('AI_A_2', 'AI_A', ['AI_A_1'], { garrison: 24000 }),
    AI_B_1: mkTerr('AI_B_1', 'AI_B', ['AI_A_1'], { isCapital: true, garrison: 20000 }),
  };
  const activeWar: ActiveWar = {
    id: 'w_relief',
    name: 'Test War',
    attackerId: 'AI_B',
    defenderId: 'AI_A',
    attackers: ['AI_B'],
    defenders: ['AI_A'],
    startedTick: 1,
    attackerWarScore: 15,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  const warRes = evaluateWartimeAiOperations({
    nextTick: 12,
    playerNationId: 'PLR',
    nations: warNations,
    territories: warTerrs,
    relations: {},
    wars: [activeWar],
    movements: [],
    aiAggressiveness: 'NORMAL',
  });
  assert.ok(warRes, 'Wartime AI should produce relief action');
  assert.ok(
    warRes.newMovements.some(
      (mv) => mv.ownerId === 'AI_A' && mv.fromTerritoryId === 'AI_A_2' && mv.toTerritoryId === 'AI_A_1'
    ),
    'Wartime AI must march rear reserve troops to relieve its besieged capital'
  );

  // 2. Peacetime AI upgrades economy even with < 26K garrison AND forms AI-to-AI diplomatic pact
  const peaceNations: Record<string, Nation> = {
    PLR: mkNation('PLR'),
    AI_1: mkNation('AI_1', { treasury: 1600, manpower: 22000 }),
    AI_2: mkNation('AI_2', { treasury: 1600, manpower: 22000 }),
    BOSS: mkNation('BOSS', { aggressiveExpansion: 55 }),
  };
  const peaceTerrs: Record<string, Territory> = {
    PLR_1: mkTerr('PLR_1', 'PLR', []),
    AI_1_1: mkTerr('AI_1_1', 'AI_1', ['AI_2_1', 'BOSS_1'], { isCapital: true, garrison: 14000 }),
    AI_2_1: mkTerr('AI_2_1', 'AI_2', ['AI_1_1'], { isCapital: true, garrison: 14000 }),
    BOSS_1: mkTerr('BOSS_1', 'BOSS', ['AI_1_1'], { isCapital: true, garrison: 45000 }),
  };
  const peaceRelations: Record<string, DiplomaticRelation> = {
    AI_1_AI_2: {
      nationA: 'AI_1',
      nationB: 'AI_2',
      score: 30,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
  };

  // Pick a tick where AI_1 is the selected actor (index 0 among [AI_1, AI_2, BOSS]) and stepIndex is even
  const peaceRes = evaluateMultiProvinceAiTurn({
    nextTick: 0,
    gameMode: 'STANDARD_2026',
    playerNationId: 'PLR',
    nations: peaceNations,
    territories: peaceTerrs,
    relations: peaceRelations,
    wars: [],
    movements: [],
    aiAggressiveness: 'NORMAL',
  });
  assert.ok(peaceRes, 'Peacetime AI should act');
  const upgradedBuildings = peaceRes.updatedTerritories?.AI_1_1?.buildings;
  assert.ok(
    upgradedBuildings &&
      Object.values(upgradedBuildings).some((lvl) => lvl > 0),
    'Peacetime AI should invest in province buildings even when border garrison is 14K'
  );
  assert.equal(
    peaceRes.updatedRelations?.AI_1_AI_2?.allianceType,
    'DEFENSIVE',
    'Threatened peaceful AI should proactively form a Defensive Pact with a friendly peer'
  );
});

test('evaluatePlayerAiCommander operates strictly at war, relieves sieges first, attacks winnable targets, and advances reserves', async () => {
  const { evaluatePlayerAiCommander } = await import('./playerAiCommander');

  const nations: Record<string, Nation> = {
    TUR: mkFaz3Nation('TUR', { name: 'Osmanlı', capitalTerritoryId: 'CAP' }),
    ENM: mkFaz3Nation('ENM', { name: 'Düşman', capitalTerritoryId: 'E_FORT' }),
  };

  const baseFort = mkFaz3Territory('x').buildings;
  const territories: Record<string, Territory> = {
    REAR: mkFaz3Territory('REAR', { ownerId: 'TUR', neighbors: ['CAP'], centroid: [28, 39], garrison: 8000 }),
    CAP: mkFaz3Territory('CAP', {
      ownerId: 'TUR',
      isCapital: true,
      neighbors: ['REAR', 'FRONT'],
      centroid: [29, 39],
      garrison: 2000,
      siege: { territoryId: 'CAP', attackerId: 'ENM', defenderId: 'TUR', attackerTroops: 5000, progress: 45, wallIntegrity: 60, startedTick: 2 },
    }),
    FRONT: mkFaz3Territory('FRONT', { ownerId: 'TUR', neighbors: ['CAP', 'E_WEAK', 'E_FORT'], centroid: [30, 39], garrison: 9000 }),
    E_WEAK: mkFaz3Territory('E_WEAK', { ownerId: 'ENM', neighbors: ['FRONT'], centroid: [31, 39], garrison: 2000, units: { infantry: 2000, armor: 0, airDrone: 0 } }),
    E_FORT: mkFaz3Territory('E_FORT', { ownerId: 'ENM', neighbors: ['FRONT'], centroid: [31, 40], garrison: 12000, buildings: { ...baseFort, fortress: 3 } }),
  };

  // Returns null during peacetime
  const peaceRes = evaluatePlayerAiCommander({
    tick: 10,
    playerNationId: 'TUR',
    nations,
    territories,
    relations: {},
    wars: [],
    battles: [],
    movements: [],
  });
  assert.equal(peaceRes, null);

  const warRes = evaluatePlayerAiCommander({
    tick: 10,
    playerNationId: 'TUR',
    nations,
    territories,
    relations: {},
    wars: [
      {
        id: 'war_ai',
        name: 'Osmanlı - Düşman Savaşı',
        attackerId: 'TUR',
        defenderId: 'ENM',
        attackers: ['TUR'],
        defenders: ['ENM'],
        startedTick: 1,
        attackerWarScore: 0,
        casualtiesAttacker: 0,
        casualtiesDefender: 0,
      },
    ],
    battles: [],
    movements: [],
  });

  assert.ok(warRes && warRes.newMovements.length >= 2, 'AI commander must dispatch siege relief and winnable offensive movements');
  assert.ok(
    warRes.newMovements.some((m) => m.finalDestinationId === 'CAP'),
    'AI commander must prioritize relieving besieged capital CAP'
  );
  assert.ok(
    warRes.newMovements.some((m) => m.fromTerritoryId === 'FRONT' && m.toTerritoryId === 'E_WEAK'),
    'AI commander must attack weak E_WEAK'
  );
  assert.equal(
    warRes.newMovements.some((m) => m.toTerritoryId === 'E_FORT'),
    false,
    'AI commander must avoid suicidal attack into fortified E_FORT'
  );
});

test('evaluatePlayerAiCommander respects AGGRESSIVE vs DEFENSIVE front stances', async () => {
  const { evaluatePlayerAiCommander } = await import('./playerAiCommander');

  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      isEliminated: false,
      modernizedArmyTier: 0,
      unlockedTechs: [],
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      isEliminated: false,
      modernizedArmyTier: 0,
      unlockedTechs: [],
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    p1: {
      id: 'p1',
      name: 'Edirne',
      ownerId: '792',
      isCapital: false,
      garrison: 4600,
      units: { infantry: 4600, armor: 0, airDrone: 0 },
      neighbors: ['e1'],
      centroid: [26, 41],
    } as unknown as Territory,
    e1: {
      id: 'e1',
      name: 'Dimetoka',
      ownerId: '300',
      isCapital: false,
      garrison: 3000,
      units: { infantry: 3000, armor: 0, airDrone: 0 },
      neighbors: ['p1'],
      centroid: [26.5, 41.3],
    } as unknown as Territory,
  };

  const wars: ActiveWar[] = [
    {
      id: 'w1',
      name: 'Savaş',
      attackerId: '792',
      defenderId: '300',
      attackers: ['792'],
      defenders: ['300'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const defRes = evaluatePlayerAiCommander({
    tick: 5,
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars,
    battles: [],
    movements: [],
    stance: 'DEFENSIVE',
  });
  assert.equal(defRes, null, 'DEFENSIVE stance should not launch risky low-odds frontier push');

  const aggRes = evaluatePlayerAiCommander({
    tick: 5,
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars,
    battles: [],
    movements: [],
    stance: 'AGGRESSIVE',
  });
  assert.ok(aggRes && aggRes.newMovements.length === 1, 'AGGRESSIVE stance should push into winnable border province');
  assert.equal(aggRes!.newMovements[0].toTerritoryId, 'e1');

  useGameStore.getState().setAiCommanderStance('AGGRESSIVE');
  assert.equal(useGameStore.getState().aiCommanderStance, 'AGGRESSIVE');
  useGameStore.getState().setAiCommanderStance('BALANCED');
});

test('Faz 4.1: resolveNationAiPersonality respects presets and shifts to REVANCHIST when losing a homeland core', () => {
  const ottoman = { id: '792', name: 'Osmanlı', ideology: 'MONARCHY' } as unknown as Nation;
  const venice = { id: '380', name: 'Venedik', ideology: 'DEMOCRACY' } as unknown as Nation;
  const poland = { id: '616', name: 'Polonya', ideology: 'MONARCHY' } as unknown as Nation;

  const intactTerrs: Record<string, Territory> = {
    p1: { id: 'p1', ownerId: '792', coreOwnerId: '792' } as unknown as Territory,
    p2: { id: 'p2', ownerId: '380', coreOwnerId: '380' } as unknown as Territory,
    p3: { id: 'p3', ownerId: '616', coreOwnerId: '616' } as unknown as Territory,
  };

  assert.equal(resolveNationAiPersonality(ottoman, intactTerrs), 'CONQUEROR');
  assert.equal(resolveNationAiPersonality(venice, intactTerrs), 'MERCHANT');
  assert.equal(resolveNationAiPersonality(poland, intactTerrs), 'DEFENDER');

  const lostCoreTerrs: Record<string, Territory> = {
    ...intactTerrs,
    p2: { id: 'p2', ownerId: '792', coreOwnerId: '380' } as unknown as Territory,
  };
  assert.equal(resolveNationAiPersonality(venice, lostCoreTerrs), 'REVANCHIST');
});

test('Faz 4.4: seasonal supply limits respond to winter/terrain/logistics and weekly attrition trims oversized garrisons', () => {
  const winter = getGameSeason(10, 'EMPIRES_1440');
  const summer = getGameSeason(180, 'EMPIRES_1440');
  assert.equal(winter.id, 'WINTER');
  assert.equal(summer.id, 'SUMMER');

  const owner = { id: '792', unlockedTechs: [] } as unknown as Nation;
  const mountainProv = {
    id: 'm1',
    name: 'Erzurum',
    ownerId: '792',
    terrain: 'DAGLIK',
    population: 180_000,
    garrison: 60_000,
    units: { infantry: 42_000, armor: 12_000, airDrone: 6_000 },
    buildings: {
      factory: 0,
      barracks: 1,
      fortress: 1,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
      shipyard: 0,
      mint: 0,
      granary: 0,
    },
    isCoastal: false,
  } as unknown as Territory;

  const boostedProv = {
    ...mountainProv,
    buildings: {
      ...mountainProv.buildings,
      supplyDepot: 2,
      granary: 2,
    },
  } as unknown as Territory;

  const winterMountainLimit = calculateProvinceSupplyLimit(mountainProv, owner, winter);
  const summerMountainLimit = calculateProvinceSupplyLimit(mountainProv, owner, summer);
  const boostedWinterLimit = calculateProvinceSupplyLimit(boostedProv, owner, winter);

  assert.ok(winterMountainLimit < summerMountainLimit);
  assert.ok(boostedWinterLimit > winterMountainLimit * 1.8);

  const attritionRes = evaluateWeeklySupplyAndSeasonAttrition({
    territories: { m1: mountainProv },
    nations: { '792': owner },
    season: winter,
    playerNationId: '792',
  });
  assert.equal(attritionRes.changed, true);
  assert.equal(attritionRes.playerAffectedCount, 1);
  assert.ok(attritionRes.playerTotalLoss > 0);
  assert.ok(attritionRes.updatedTerritories.m1.garrison < 60_000);
  assert.ok(attritionRes.updatedTerritories.m1.garrison >= Math.round(winterMountainLimit * 0.92));
});

test('Faz 4.4: evaluateAutomaticCapitulations forces AI collapse at >=75% occupied & >=50 warscore but never auto-capitulates human player', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 1000,
      stability: 70,
      aggressiveExpansion: 10,
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      treasury: 800,
      stability: 50,
      aggressiveExpansion: 0,
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    p1: { id: 'p1', name: 'Edirne', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    p2: { id: 'p2', name: 'Selanik', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    p3: { id: 'p3', name: 'Mora', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    p4: { id: 'p4', name: 'Atina', ownerId: '300', coreOwnerId: '300', isOccupied: false, unrest: 5, assimilation: 100 } as unknown as Territory,
  };

  const war: ActiveWar = {
    id: 'w1',
    name: 'Osmanlı - Bizans Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    attackerWarScore: 62,
    startedTick: 10,
    casualtiesAttacker: 2000,
    casualtiesDefender: 9000,
  };

  // Player winning -> AI (300) capitulates (3/4 = 75% occupied, warscore 62 >= 50)
  const aiCapRes = evaluateAutomaticCapitulations({
    nextTick: 40,
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [war],
  });
  assert.equal(aiCapRes.capitulatedCount, 1);
  assert.equal(aiCapRes.updatedWars.length, 0);
  assert.equal(aiCapRes.updatedTerritories.p1.isOccupied, false);
  assert.ok(aiCapRes.updatedNations['792'].treasury > 1000);
  assert.ok(aiCapRes.updatedRelations['300_792'].truceUntilTick === 160);

  // If human player is '300', must NOT auto-capitulate
  const humanSafeRes = evaluateAutomaticCapitulations({
    nextTick: 40,
    playerNationId: '300',
    nations,
    territories,
    relations: {},
    wars: [war],
  });
  assert.equal(humanSafeRes.capitulatedCount, 0);
  assert.equal(humanSafeRes.updatedWars.length, 1);
});

test('Faz 3.6: evaluateAutomaticCapitulations respects custom capitulationThresholdPct (60% vs 100%)', () => {
  const nations: Record<string, Nation> = {
    '792': { id: '792', name: 'Osmanlı', treasury: 1000, stability: 75, aggressiveExpansion: 5, capitalTerritoryId: 'o1', isEliminated: false } as unknown as Nation,
    '300': { id: '300', name: 'Bizans', treasury: 600, stability: 50, aggressiveExpansion: 0, capitalTerritoryId: 'b1', isEliminated: false } as unknown as Nation,
  };
  const makeTerritories = (): Record<string, Territory> => ({
    o1: { id: 'o1', name: 'Edirne', ownerId: '792', coreOwnerId: '792', isOccupied: false, unrest: 0, assimilation: 100 } as unknown as Territory,
    // 3 of 4 Byzantine cores occupied (75% occupied -> >= 60%, < 100%)
    b1: { id: 'b1', name: 'Konstantinopolis', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    b2: { id: 'b2', name: 'Selanik', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    b3: { id: 'b3', name: 'Atina', ownerId: '792', coreOwnerId: '300', isOccupied: true, unrest: 20, assimilation: 25 } as unknown as Territory,
    b4: { id: 'b4', name: 'Mora', ownerId: '300', coreOwnerId: '300', isOccupied: false, unrest: 5, assimilation: 100 } as unknown as Territory,
  });
  const wars: ActiveWar[] = [
    {
      id: 'w1',
      name: 'Osmanlı-Bizans Savaşı',
      attackerId: '792',
      defenderId: '300',
      attackers: ['792'],
      defenders: ['300'],
      startedTick: 1,
      attackerWarScore: 80,
      casualtiesAttacker: 1000,
      casualtiesDefender: 5000,
    },
  ];

  // With 100% threshold, 75% occupation must NOT capitulate
  const at100 = evaluateAutomaticCapitulations({
    nextTick: 30,
    playerNationId: '792',
    nations,
    territories: makeTerritories(),
    relations: {},
    wars,
    thresholdPct: 100,
  });
  assert.equal(at100.capitulatedCount, 0);
  assert.equal(at100.updatedWars.length, 1);

  // With 60% threshold, 75% occupation MUST capitulate Bizans
  const at60 = evaluateAutomaticCapitulations({
    nextTick: 30,
    playerNationId: '792',
    nations,
    territories: makeTerritories(),
    relations: {},
    wars,
    thresholdPct: 60,
  });
  assert.equal(at60.capitulatedCount, 1);
  assert.equal(at60.updatedWars.length, 0);
  assert.equal(at60.updatedTerritories.b1.isOccupied, false);
});

test('seeded living world produces distinct AI permutations across seeds and blocks scripted Day-12 embargoes', async () => {
  const { seededShuffle, seededHash } = await import('./aiAndRebellionEngine');

  const sampleIds = ['300', '380', '276', '250', '643', '616', '348', '724'];
  const permA = seededShuffle(sampleIds, 10101, 'ai_cycle_0');
  const permB = seededShuffle(sampleIds, 90909, 'ai_cycle_0');
  assert.notDeepEqual(
    permA,
    permB,
    'Different worldSeed values should shuffle AI actor order differently'
  );
  assert.deepEqual(
    permA,
    seededShuffle(sampleIds, 10101, 'ai_cycle_0'),
    'Same worldSeed must stay reproducible'
  );
  assert.notEqual(
    seededHash(10101, 'emb_gate_18_300'),
    seededHash(90909, 'emb_gate_18_300')
  );

  // Premature Day-12 scripted embargo must NOT trigger when worldSeed is active
  const nations: Record<string, Nation> = {
    '792': mkFaz3Nation('792', { name: 'Osmanlı', capitalTerritoryId: 'p_1' }),
    '300': mkFaz3Nation('300', {
      name: 'Bizans',
      capitalTerritoryId: 'b_1',
      treasury: 100, // Keep low so AI doesn't build/levy and reaches diplomacy step
    }),
  };
  const territories: Record<string, Territory> = {
    p_1: mkFaz3Territory('p_1', { ownerId: '792', garrison: 25000, neighbors: ['b_1'] }),
    b_1: mkFaz3Territory('b_1', { ownerId: '300', garrison: 8000, neighbors: ['p_1'] }),
  };
  const relations: Record<string, DiplomaticRelation> = {
    '300_792': {
      nationA: '300',
      nationB: '792',
      score: -70,
      isAllied: false,
      hasNonAggression: false,
      hasMilitaryAccess: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      truceUntilTick: 0,
    },
  };

  const day12Res = evaluateMultiProvinceAiTurn({
    nextTick: 12,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations,
    wars: [],
    aiAggressiveness: 'NORMAL',
    worldSeed: 424242,
  });
  const relAfter = day12Res?.updatedRelations?.['300_792'];
  assert.equal(
    Boolean(relAfter?.hasEmbargo),
    false,
    'Seeded live campaigns must not fire deterministic Day-12 embargoes on start'
  );
});

test('computeAllianceCompatibilityScore blocks enemy-allies/embargoes and rewards shared war enemies and faith', async () => {
  const { computeAllianceCompatibilityScore } = await import('./aiAndRebellionEngine');

  const actor = mkFaz3Nation('A', {
    ideology: 'MONARCHY',
    stateReligion: 'ISLAM_SUNNI',
  });
  const friendlyPeer = mkFaz3Nation('B', {
    ideology: 'MONARCHY',
    stateReligion: 'ISLAM_SUNNI',
  });
  const enemyNation = mkFaz3Nation('E', {
    ideology: 'MONARCHY',
    stateReligion: 'CHRISTIAN_ORTHODOX',
    aggressiveExpansion: 50,
  });
  const nations = { A: actor, B: friendlyPeer, E: enemyNation };

  const activeWar: ActiveWar = {
    id: 'w_ae',
    name: 'A-E War',
    attackerId: 'E',
    defenderId: 'A',
    attackers: ['E'],
    defenders: ['A'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // Case 1: Peer is allied to our active war enemy -> MUST be blocked!
  const relAB: DiplomaticRelation = {
    nationA: 'A',
    nationB: 'B',
    score: 40,
    isAllied: false,
    hasNonAggression: true,
    hasMilitaryAccess: false,
    hasTradeAgreement: true,
    hasEmbargo: false,
    truceUntilTick: 0,
  };
  const blockedByEnemyAlly = computeAllianceCompatibilityScore({
    actor,
    peer: friendlyPeer,
    rel: relAB,
    wars: [activeWar],
    relations: {
      A_B: relAB,
      B_E: {
        nationA: 'B',
        nationB: 'E',
        score: 60,
        isAllied: true,
        allianceType: 'DEFENSIVE',
        hasNonAggression: true,
        hasMilitaryAccess: true,
        hasTradeAgreement: false,
        hasEmbargo: false,
        truceUntilTick: 0,
      },
    },
    nations,
    gameMode: 'EMPIRES_1440',
    threatNeighborIds: ['E'],
  });
  assert.equal(
    blockedByEnemyAlly.blocked,
    true,
    'AI must never ally with a nation allied to its active war enemy'
  );

  // Case 2: Embargoed peer -> MUST be blocked!
  const blockedByEmbargo = computeAllianceCompatibilityScore({
    actor,
    peer: friendlyPeer,
    rel: { ...relAB, hasEmbargo: true, embargoingNationIds: ['A'] },
    wars: [],
    relations: {},
    nations,
    gameMode: 'EMPIRES_1440',
    threatNeighborIds: [],
  });
  assert.equal(blockedByEmbargo.blocked, true);

  // Case 3: Compatible peer sharing threat + faith + ideology -> strong positive score
  const compatible = computeAllianceCompatibilityScore({
    actor,
    peer: friendlyPeer,
    rel: { ...relAB, score: 10 },
    wars: [],
    relations: {
      B_E: {
        nationA: 'B',
        nationB: 'E',
        score: -30,
        isAllied: false,
        hasNonAggression: false,
        hasMilitaryAccess: false,
        hasTradeAgreement: false,
        hasEmbargo: false,
        truceUntilTick: 0,
      },
    },
    nations,
    gameMode: 'EMPIRES_1440',
    threatNeighborIds: ['E'],
  });
  assert.equal(compatible.blocked, false);
  assert.equal(compatible.sharesCommonThreat, true);
  assert.ok(
    compatible.score >= 45,
    `Expected strong alliance compatibility score (>= 45), got ${compatible.score}`
  );
});

test('evaluatePlayerAiCommander finishes off last enemy pockets via coordinated pincer attack and amphibious landing without stalling', async () => {
  const { evaluatePlayerAiCommander } = await import('./playerAiCommander');

  const mkNation = (id: string, capId: string): Nation =>
    ({
      id,
      name: id,
      flagCode: id,
      color: '#112233',
      capitalTerritoryId: capId,
      ideology: 'MONARCHY',
      treasury: 2000,
      manpower: 30000,
      stability: 80,
      inflation: 1,
      researchPoints: 50,
      taxRate: 25,
      budget: { military: 35, economy: 30, research: 15, welfare: 20 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    }) as unknown as Nation;

  const mkProv = (
    id: string,
    ownerId: string,
    garrison: number,
    neighbors: string[],
    coords: [number, number] = [29, 41],
    isCoastal = false
  ): Territory =>
    ({
      id,
      name: id,
      ownerId,
      coreOwnerId: ownerId,
      isCapital: false,
      population: 100000,
      baseGdp: 100,
      resource: 'TAHIL',
      terrain: 'OVA',
      isCoastal,
      buildings: {
        factory: 0,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      garrison,
      units: { infantry: garrison, armor: 0, airDrone: 0 },
      unrest: 0,
      isOccupied: false,
      centroid: coords,
      neighbors,
    }) as unknown as Territory;

  const nations = {
    PLR: mkNation('PLR', 'P1'),
    ENM: mkNation('ENM', 'E_LAST'),
  };
  const war: ActiveWar = {
    id: 'war_mopup',
    name: 'Mop-Up War',
    attackerId: 'PLR',
    defenderId: 'ENM',
    attackers: ['PLR'],
    defenders: ['ENM'],
    startedTick: 1,
    attackerWarScore: 80,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // Scenario 1: Enemy has 1 last province (E_LAST with 3,400 troops).
  // Player has three adjacent provinces with 2,200 troops each (previously stalled below 3,200 single-province threshold).
  const pincerTerrs: Record<string, Territory> = {
    P1: { ...mkProv('P1', 'PLR', 2200, ['E_LAST', 'P2']), isCapital: true },
    P2: mkProv('P2', 'PLR', 2200, ['E_LAST', 'P1', 'P3']),
    P3: mkProv('P3', 'PLR', 2200, ['E_LAST', 'P2']),
    E_LAST: { ...mkProv('E_LAST', 'ENM', 3400, ['P1', 'P2', 'P3']), isCapital: true },
  };

  const pincerRes = evaluatePlayerAiCommander({
    tick: 30,
    playerNationId: 'PLR',
    stance: 'BALANCED',
    nations,
    territories: pincerTerrs,
    relations: {},
    wars: [war],
    movements: [],
  });

  assert.ok(pincerRes, 'AI Commander must act during mop-up phase instead of stalling');
  const attacksOnLast = pincerRes.newMovements.filter(
    (m) => m.ownerId === 'PLR' && m.toTerritoryId === 'E_LAST' && m.isAttack
  );
  assert.ok(
    attacksOnLast.length >= 2,
    `AI Commander must launch a coordinated multi-province pincer assault against the last enemy holdout (got ${attacksOnLast.length} movements)`
  );
  const totalAttackingTroops = attacksOnLast.reduce((s, m) => s + m.troops, 0);
  assert.ok(
    totalAttackingTroops > 3400,
    `Coordinated pincer troops (${totalAttackingTroops}) must exceed the last enemy holdout garrison (3400)`
  );

  // Scenario 2: Enemy's last remaining province is an island/coastal holdout with no land connection,
  // and player has an anchored SeaArmy nearby.
  const islandTerrs: Record<string, Territory> = {
    P_MAIN: { ...mkProv('P_MAIN', 'PLR', 5000, [], [27.1, 38.4], true), isCapital: true },
    E_ISLAND: { ...mkProv('E_ISLAND', 'ENM', 1800, [], [25.1, 35.3], true), isCapital: true },
  };
  const seaRes = evaluatePlayerAiCommander({
    tick: 35,
    playerNationId: 'PLR',
    stance: 'BALANCED',
    nations: {
      PLR: mkNation('PLR', 'P_MAIN'),
      ENM: mkNation('ENM', 'E_ISLAND'),
    },
    territories: islandTerrs,
    relations: {},
    wars: [war],
    movements: [],
    seaArmies: [
      {
        id: 'plr_fleet_1',
        ownerId: 'PLR',
        name: 'Oyuncu Çıkarma Filosu',
        coords: [25.5, 36.2],
        troops: 4500,
        units: { infantry: 4500, armor: 0, airDrone: 0 },
      },
    ],
  });

  assert.ok(seaRes, 'AI Commander must launch amphibious landing onto remaining enemy island holdout');
  assert.ok(
    seaRes.newMovements.some(
      (m) => m.ownerId === 'PLR' && m.toTerritoryId === 'E_ISLAND' && m.isNaval && m.isAttack
    ),
    'Anchored player SeaArmy must disembark to conquer the remaining enemy island province'
  );
  assert.equal(
    seaRes.updatedSeaArmies?.length,
    0,
    'Disembarked SeaArmy must be consumed into the amphibious landing movement'
  );
});

test('Late-game 5x world-war load balancing stays within tick frame budget and scoped encirclement matches full scan', async () => {
  const { computeEncircledProvinceIds } = await import('./seasonSupplyAndAiProfile');
  const world = initializeWorld2026('EMPIRES_1440');
  const nationIds = Object.keys(world.nations).filter(
    (id) => !world.nations[id].isEliminated && id !== '792'
  );
  const coalitionMembers = nationIds.slice(0, 35);

  let stateNations = world.nations;
  let stateTerritories = world.territories;
  let stateRelations = world.relations;
  let stateWars: ActiveWar[] = [
    {
      id: 'war_world_5x_stress',
      name: 'Dünya Koalisyonu Stres Testi',
      attackerId: coalitionMembers[0],
      defenderId: '792',
      attackers: coalitionMembers,
      defenders: ['792'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];
  let stateBattles: ActiveBattle[] = [];
  let stateMovements: ArmyMovement[] = [];
  let stateSeaArmies: SeaArmy[] = [];
  let stateNews: import('../types/game').WorldNewsEvent[] = [];
  let tick = 100;
  let hour = 8;

  // Verify scoped encirclement matches full scan for targeted owner
  const fullEnc = computeEncircledProvinceIds(stateTerritories, stateNations);
  const scopedEnc = computeEncircledProvinceIds(
    stateTerritories,
    stateNations,
    new Set(['792'])
  );
  for (const tId of scopedEnc) {
    assert.ok(fullEnc.has(tId), 'Scoped encirclement must be a strict subset of full encirclement');
  }
  for (const tId of fullEnc) {
    if (stateTerritories[tId]?.ownerId === '792') {
      assert.ok(scopedEnc.has(tId), 'Scoped encirclement must include every encircled province of requested owner');
    }
  }

  // Simulate 30 consecutive 5x ticks (+12h/tick = 15 full days including weekly & 3-day AI passes) under 35-nation world war
  const t0 = performance.now();
  for (let step = 0; step < 30; step++) {
    const out = computeGameTick({
      tick,
      hour,
      hoursStep: 12,
      speed: 5,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: stateNations,
      territories: stateTerritories,
      relations: stateRelations,
      wars: stateWars,
      battles: stateBattles,
      movements: stateMovements,
      seaArmies: stateSeaArmies,
      newsEvents: stateNews,
      settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
      worldSeed: 1444,
    });
    tick = out.nextTick;
    hour = out.nextHour;
    stateNations = out.nations;
    stateTerritories = out.territories;
    stateRelations = out.relations;
    stateWars = out.wars;
    stateBattles = out.battles;
    stateMovements = out.movements;
    stateSeaArmies = out.seaArmies;
    stateNews = out.newsEvents;
  }
  const elapsedMs = performance.now() - t0;
  const avgMsPerTick = elapsedMs / 30;

  assert.equal(tick, 115, '30 ticks at +12h/tick must advance exactly 15 full game days');
  assert.ok(
    avgMsPerTick < 65,
    `Expected average 5x world-war tick to stay under 65ms (got ${avgMsPerTick.toFixed(1)}ms)`
  );
});
