import test from 'node:test';
import assert from 'node:assert/strict';
import { geoNaturalEarth1 } from 'd3-geo';
import { computeGameTick } from './tickEngine';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';
import { evaluateMultiProvinceAiTurn } from './aiAndRebellionEngine';
import { detectHardwareProfile } from './bootLoader';
import {
  clearPrewarmedMapGeometryCache,
  getBaseProjectionScale,
  getPrewarmedMapGeometryCache,
  prewarmMapGeometryCacheChunked,
} from '../map/spatialIndex';
import type { GeoCountryFeature } from './worldBuilder';
import type {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  Territory,
} from '../types/game';

function makeNation(
  id: string,
  name: string,
  capitalTerritoryId: string,
  extra?: Partial<Nation>
): Nation {
  return {
    id,
    name,
    flagCode: id.slice(0, 2),
    color: '#b83232',
    capitalTerritoryId,
    ideology: 'MONARCHY',
    treasury: 5000,
    diplomacyPoints: 50,
    manpower: 45000,
    stability: 80,
    inflation: 0,
    researchPoints: 0,
    activeResearch: null,
    researchProgressByTech: {},
    stateReligion: 'ISLAM_SUNNI',
    primaryCulture: 'TURKIC_OGHUZ',
    taxRate: 30,
    budget: { military: 45, economy: 25, research: 15, welfare: 15 },
    aggressiveExpansion: 0,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    warExhaustion: 0,
    isEliminated: false,
    ...extra,
  };
}

function makeTerritory(
  id: string,
  name: string,
  ownerId: string,
  neighbors: string[],
  extra?: Partial<Territory>
): Territory {
  const garrison = extra?.garrison ?? 5000;
  return {
    id,
    name,
    ownerId,
    coreOwnerId: extra?.coreOwnerId ?? ownerId,
    centroid: [30, 40],
    population: 120000,
    baseGdp: 120,
    resource: 'TAHIL',
    garrison,
    units: extra?.units ?? {
      infantry: Math.round(garrison * 0.7),
      armor: Math.round(garrison * 0.2),
      airDrone: Math.max(
        0,
        garrison - Math.round(garrison * 0.7) - Math.round(garrison * 0.2)
      ),
    },
    terrain: 'OVA',
    buildings: {
      factory: 1,
      barracks: 1,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
      mint: 0,
      granary: 0,
    },
    neighbors,
    unrest: 5,
    isOccupied: false,
    assimilation: 100,
    religion: 'ISLAM_SUNNI',
    culture: 'TURKIC_OGHUZ',
    isCapital: false,
    ...extra,
  };
}

function makeRelation(
  a: string,
  b: string,
  extra?: Partial<DiplomaticRelation>
): DiplomaticRelation {
  const [nA, nB] = a < b ? [a, b] : [b, a];
  return {
    nationA: nA,
    nationB: nB,
    score: 0,
    isAllied: false,
    hasNonAggression: false,
    hasTradeAgreement: false,
    hasEmbargo: false,
    hasMilitaryAccess: false,
    truceUntilTick: 0,
    ...extra,
  };
}

test('Army arriving at FRIENDLY_PASS province (e.g. ally took target mid-march) NEVER vanishes and returns to origin garrison', () => {
  const ott = makeNation('OTT', 'Osmanlı', 'p1');
  const ally = makeNation('ALY', 'Müttefik', 'p2');
  const p1 = makeTerritory('p1', 'Edirne', 'OTT', ['p2'], {
    garrison: 2000,
    isCapital: true,
  });
  const p2 = makeTerritory('p2', 'Filibe', 'ALY', ['p1'], {
    garrison: 3000,
    isCapital: true,
  });
  const rel = makeRelation('OTT', 'ALY', { isAllied: true, score: 80 });

  const mv: ArmyMovement = {
    id: 'mv-friendly-arrival',
    ownerId: 'OTT',
    fromTerritoryId: 'p1',
    toTerritoryId: 'p2',
    troops: 6000,
    units: { infantry: 4200, armor: 1200, airDrone: 600 },
    progress: 99,
    isAttack: true,
    isNaval: false,
  };

  const out = computeGameTick({
    tick: 10,
    hour: 23,
    hoursStep: 1,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: ott, ALY: ally },
    territories: { p1, p2 },
    relations: { ALY_OTT: rel },
    wars: [],
    battles: [],
    movements: [mv],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.movements.length, 0);
  assert.ok(
    out.territories.p1.garrison >= 8000,
    `Expected >= 8000 garrison in p1 after safe return, got ${out.territories.p1.garrison}`
  );
  assert.ok(
    out.toasts.some((t) => t.includes('garnizonuna döndü')),
    `Expected clear return toast, got: ${JSON.stringify(out.toasts)}`
  );
});

test('Army arriving at BLOCKED / peacetime province returns safely home without launching a phantom battle or siege', () => {
  const ott = makeNation('OTT', 'Osmanlı', 'p1');
  const hun = makeNation('HUN', 'Macaristan', 'p2');
  const p1 = makeTerritory('p1', 'Niş', 'OTT', ['p2'], {
    garrison: 1500,
    isCapital: true,
  });
  const p2 = makeTerritory('p2', 'Belgrad', 'HUN', ['p1'], {
    garrison: 4000,
    isCapital: true,
  });

  const mv: ArmyMovement = {
    id: 'mv-peace-arrival',
    ownerId: 'OTT',
    fromTerritoryId: 'p1',
    toTerritoryId: 'p2',
    troops: 5500,
    units: { infantry: 3800, armor: 1100, airDrone: 600 },
    progress: 99,
    isAttack: true,
    isNaval: false,
  };

  const out = computeGameTick({
    tick: 12,
    hour: 23,
    hoursStep: 1,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: ott, HUN: hun },
    territories: { p1, p2 },
    relations: {},
    wars: [],
    battles: [],
    movements: [mv],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.battles.length, 0, 'Must not spawn a phantom peacetime battle');
  assert.equal(
    out.territories.p2.siege ?? null,
    null,
    'Must not spawn a phantom peacetime siege'
  );
  assert.ok(
    out.territories.p1.garrison >= 7000,
    `Expected returning 5500 + 1500 >= 7000 in p1, got ${out.territories.p1.garrison}`
  );
  assert.ok(
    out.toasts.some(
      (t) => t.includes('savaş sona erdi') || t.includes('garnizonuna döndü')
    ),
    `Expected clear peace-return toast, got: ${JSON.stringify(out.toasts)}`
  );
});

test('Winning battle on already-owned province merges survivors into garrison instead of dropping them', () => {
  const ott = makeNation('OTT', 'Osmanlı', 'p1');
  const hun = makeNation('HUN', 'Macaristan', 'p2');
  const p1 = makeTerritory('p1', 'Sofya', 'OTT', ['p2'], {
    garrison: 1200,
    isCapital: true,
  });
  const p2 = makeTerritory('p2', 'Vidin', 'HUN', ['p1'], {
    garrison: 3000,
    isCapital: true,
  });

  const war: ActiveWar = {
    id: 'war-1',
    name: 'Osmanlı-Macar Harbi',
    attackerId: 'OTT',
    defenderId: 'HUN',
    attackers: ['OTT'],
    defenders: ['HUN'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  const btl: ActiveBattle = {
    id: 'btl-owned-win',
    territoryId: 'p1',
    fromTerritoryId: 'p1',
    attackerId: 'OTT',
    defenderId: 'HUN',
    attackerTroops: 6000,
    defenderTroops: 10,
    attackerInitialTroops: 6000,
    defenderInitialTroops: 2000,
    attackerUnits: { infantry: 4000, armor: 1200, airDrone: 800 },
    defenderUnits: { infantry: 10, armor: 0, airDrone: 0 },
    attackerMorale: 100,
    defenderMorale: 1,
    round: 3,
  };

  const out = computeGameTick({
    tick: 15,
    hour: 10,
    hoursStep: 4,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: ott, HUN: hun },
    territories: { p1, p2 },
    relations: {},
    wars: [war],
    battles: [btl],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.battles.length, 0);
  assert.ok(
    out.territories.p1.garrison >= 6500,
    `Expected winning survivors merged into p1 garrison (>= 6500), got ${out.territories.p1.garrison}`
  );
});

test('Defeated attacker with 400 survivors and lost origin province safely retreats to capital instead of vanishing', () => {
  const ott = makeNation('OTT', 'Osmanlı', 'p_cap');
  const hun = makeNation('HUN', 'Macaristan', 'p_target');
  const pCap = makeTerritory('p_cap', 'Bursa', 'OTT', [], {
    garrison: 2000,
    isCapital: true,
  });
  const pTarget = makeTerritory('p_target', 'Budin', 'HUN', [], {
    garrison: 12000,
    isCapital: true,
  });

  const war: ActiveWar = {
    id: 'war-retreat',
    name: 'Tuna Seferi',
    attackerId: 'OTT',
    defenderId: 'HUN',
    attackers: ['OTT'],
    defenders: ['HUN'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  const btl: ActiveBattle = {
    id: 'btl-low-morale-retreat',
    territoryId: 'p_target',
    fromTerritoryId: 'p_target',
    attackerId: 'OTT',
    defenderId: 'HUN',
    attackerTroops: 420,
    defenderTroops: 12000,
    attackerInitialTroops: 3000,
    defenderInitialTroops: 12000,
    attackerUnits: { infantry: 300, armor: 80, airDrone: 40 },
    defenderUnits: { infantry: 8000, armor: 2500, airDrone: 1500 },
    attackerMorale: 1,
    defenderMorale: 95,
    round: 8,
  };

  const out = computeGameTick({
    tick: 18,
    hour: 10,
    hoursStep: 1,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: ott, HUN: hun },
    territories: { p_cap: pCap, p_target: pTarget },
    relations: {},
    wars: [war],
    battles: [btl],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.battles.length, 0);
  const retreatedToCap = out.territories.p_cap.garrison > 2000;
  const hasExplicitToast = out.toasts.some(
    (t) => t.includes('Bursa') || t.includes('tamamen imha')
  );
  assert.ok(
    retreatedToCap || hasExplicitToast,
    `Expected either safe retreat to capital or explicit wipeout toast. p_cap=${out.territories.p_cap.garrison}, toasts=${JSON.stringify(out.toasts)}`
  );
});

test('Contested rival siege overwrite returns displaced besieger safely home instead of deleting their army', () => {
  const ott = makeNation('OTT', 'Osmanlı', 'p_ott');
  const pol = makeNation('POL', 'Lehistan', 'p_pol');
  const hun = makeNation('HUN', 'Macaristan', 'p_hun');

  const pOtt = makeTerritory('p_ott', 'Edirne', 'OTT', ['p_hun'], {
    garrison: 1000,
    isCapital: true,
  });
  const pPol = makeTerritory('p_pol', 'Krakov', 'POL', ['p_hun'], {
    garrison: 1000,
    isCapital: true,
  });
  const pHun = makeTerritory('p_hun', 'Peşte', 'HUN', ['p_ott', 'p_pol'], {
    garrison: 0,
    isCapital: true,
    siege: {
      territoryId: 'p_hun',
      defenderId: 'HUN',
      attackerId: 'OTT',
      attackerTroops: 3000,
      attackerUnits: { infantry: 2100, armor: 600, airDrone: 300 },
      fromTerritoryId: 'p_ott',
      progress: 40,
      wallIntegrity: 80,
      startedTick: 10,
    },
  });

  const wars: ActiveWar[] = [
    {
      id: 'w-ott-hun',
      name: 'Osmanlı-Macar Harbi',
      attackerId: 'OTT',
      defenderId: 'HUN',
      attackers: ['OTT'],
      defenders: ['HUN'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
    {
      id: 'w-pol-hun',
      name: 'Lehistan-Macar Harbi',
      attackerId: 'POL',
      defenderId: 'HUN',
      attackers: ['POL'],
      defenders: ['HUN'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const mvPol: ArmyMovement = {
    id: 'mv-pol-rival',
    ownerId: 'POL',
    fromTerritoryId: 'p_pol',
    toTerritoryId: 'p_hun',
    troops: 7000,
    units: { infantry: 5000, armor: 1400, airDrone: 600 },
    progress: 99,
    isAttack: true,
    isNaval: false,
  };

  const out = computeGameTick({
    tick: 14,
    hour: 23,
    hoursStep: 1,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: ott, POL: pol, HUN: hun },
    territories: { p_ott: pOtt, p_pol: pPol, p_hun: pHun },
    relations: {},
    wars,
    battles: [],
    movements: [mvPol],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.territories.p_hun.siege?.attackerId, 'POL');
  assert.ok(
    out.territories.p_ott.garrison >= 4000,
    `Displaced OTT besiegers must return home to Edirne (>= 4000), got ${out.territories.p_ott.garrison}`
  );
});

test('AI White Peace (Statüko Barışı) restores occupied territories to coreOwnerId and clears sieges', () => {
  const player = makeNation('OTT', 'Osmanlı', 'p_ott');
  const aiA = makeNation('FRA', 'Fransa', 'p_fra', { warExhaustion: 90 });
  const aiB = makeNation('ENG', 'İngiltere', 'p_eng', { warExhaustion: 90 });

  const pOtt = makeTerritory('p_ott', 'Bursa', 'OTT', [], { isCapital: true });
  const pFra = makeTerritory('p_fra', 'Paris', 'FRA', ['p_norm'], {
    isCapital: true,
  });
  const pNorm = makeTerritory(
    'p_norm',
    'Normandiya',
    'FRA',
    ['p_fra', 'p_eng'],
    {
      coreOwnerId: 'ENG',
      isOccupied: true,
      occupiedById: 'FRA',
      siege: {
        territoryId: 'p_norm',
        defenderId: 'FRA',
        attackerId: 'ENG',
        attackerTroops: 2000,
        attackerUnits: { infantry: 1400, armor: 400, airDrone: 200 },
        fromTerritoryId: 'p_eng',
        progress: 30,
        wallIntegrity: 70,
        startedTick: 100,
      },
    }
  );
  const pEng = makeTerritory('p_eng', 'Londra', 'ENG', ['p_norm'], {
    isCapital: true,
  });

  const staleWar: ActiveWar = {
    id: 'war-stale',
    name: 'Yüz Yıl Harbi',
    attackerId: 'FRA',
    defenderId: 'ENG',
    attackers: ['FRA'],
    defenders: ['ENG'],
    startedTick: 1,
    attackerWarScore: 5,
    casualtiesAttacker: 15000,
    casualtiesDefender: 15000,
  };

  const res = evaluateMultiProvinceAiTurn({
    nextTick: 400,
    playerNationId: 'OTT',
    nations: { OTT: player, FRA: aiA, ENG: aiB },
    territories: { p_ott: pOtt, p_fra: pFra, p_norm: pNorm, p_eng: pEng },
    relations: {},
    wars: [staleWar],
    aiAggressiveness: 'NORMAL',
    gameMode: 'EMPIRES_1440',
  });

  assert.ok(res !== null, 'Expected AI turn to evaluate peace');
  assert.equal(res.updatedWars?.length, 0);
  assert.ok(
    res.updatedTerritories,
    'White Peace must return updatedTerritories when occupied lands exist'
  );
  assert.equal(res.updatedTerritories?.p_norm.ownerId, 'ENG');
  assert.equal(res.updatedTerritories?.p_norm.isOccupied, false);
  assert.equal(res.updatedTerritories?.p_norm.siege, undefined);
});

test('Weekly AI economy charges garrison upkeep and dampens runaway hoarding above 45k treasury', () => {
  const player = makeNation('OTT', 'Osmanlı', 'p_ott');
  const hugeAi = makeNation('MNG', 'Ming', 'p_mng', { treasury: 60000 });
  const pOtt = makeTerritory('p_ott', 'Bursa', 'OTT', [], { isCapital: true });
  const pMng = makeTerritory('p_mng', 'Pekin', 'MNG', [], {
    baseGdp: 100,
    garrison: 40000,
    isCapital: true,
  });

  const out = computeGameTick({
    tick: 6,
    hour: 23,
    hoursStep: 1,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: { OTT: player, MNG: hugeAi },
    territories: { p_ott: pOtt, p_mng: pMng },
    relations: {},
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.ok(
    out.nations.MNG.treasury < 60000,
    `Expected large garrison upkeep to reduce Ming treasury below 60000, got ${out.nations.MNG.treasury}`
  );
});

test('Boot loader provides graceful minDisplayMs across all hardware tiers and spatialIndex prewarms cache in chunks', async () => {
  const high = detectHardwareProfile({ cores: 8, memoryGb: 8, dpr: 3 });
  const balanced = detectHardwareProfile({ cores: 4, memoryGb: 4, dpr: 2 });
  const eco = detectHardwareProfile({ cores: 2, memoryGb: 2, dpr: 1 });

  assert.ok(high.minDisplayMs >= 2000 && high.minDisplayMs <= 2600);
  assert.ok(balanced.minDisplayMs >= 2200 && balanced.minDisplayMs <= 2800);
  assert.ok(eco.minDisplayMs >= 2400 && eco.minDisplayMs <= 3000);

  clearPrewarmedMapGeometryCache();
  const sampleFeatures: GeoCountryFeature[] = [
    {
      type: 'Feature',
      id: 'TST_1',
      properties: { name: 'Test Province 1' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [28, 40],
            [30, 40],
            [30, 42],
            [28, 42],
            [28, 40],
          ],
        ],
      },
    },
  ];
  const dimsKey = '1024x640_1';
  const proj = geoNaturalEarth1()
    .scale(getBaseProjectionScale(1024, 640))
    .translate([512, 320]);

  const progressSteps: number[] = [];
  const built = await prewarmMapGeometryCacheChunked({
    dimsKey,
    features: sampleFeatures,
    projection: proj,
    chunkSize: 12,
    yieldFrame: async () => Promise.resolve(),
    onProgress: (f) => progressSteps.push(f),
  });

  assert.ok(built !== null);
  assert.equal(getPrewarmedMapGeometryCache(dimsKey), built);
  assert.equal(getPrewarmedMapGeometryCache('other_key'), null);
  assert.equal(progressSteps[progressSteps.length - 1], 1);
  assert.equal(built.spatialTree.all().length, 1);
});

test('Ocean cartography defines unique sea labels, valid compass roses/lanes, and seasonal Arctic sea ice', async () => {
  const {
    OCEAN_AND_SEA_LABELS,
    COMPASS_ROSES,
    MARITIME_SEA_LANES,
    getArcticSeaIceIntensity,
  } = await import('../map/oceanCartographyRenderer');

  assert.ok(OCEAN_AND_SEA_LABELS.length >= 18);
  const labelIds = new Set(OCEAN_AND_SEA_LABELS.map((l) => l.id));
  assert.equal(labelIds.size, OCEAN_AND_SEA_LABELS.length);
  for (const lbl of OCEAN_AND_SEA_LABELS) {
    assert.ok(lbl.coords[0] >= -180 && lbl.coords[0] <= 180);
    assert.ok(lbl.coords[1] >= -90 && lbl.coords[1] <= 90);
  }

  assert.equal(COMPASS_ROSES.length, 3);
  assert.ok(MARITIME_SEA_LANES.length >= 6);
  for (const lane of MARITIME_SEA_LANES) {
    assert.ok(lane.waypoints.length >= 3);
  }

  // Winter peak sea ice vs zero ice in July
  assert.ok(getArcticSeaIceIntensity(1) > 0.2);
  assert.ok(getArcticSeaIceIntensity(12) > 0.2);
  assert.ok(getArcticSeaIceIntensity(3) > 0.05);
  assert.equal(getArcticSeaIceIntensity(7), 0);
});

test('SoundEngine playWarDrum and playTickCues execute safely in headless Node without throwing', async () => {
  const { sound } = await import('../utils/soundEngine');
  assert.doesNotThrow(() => {
    sound.playWarDrum();
    sound.playTickCues(['TREATY', 'BUILD', 'WAR_DRUM'], 5);
    sound.playTickCues(['MARCH', 'SELECT_TERRITORY'], 5);
  });
});

test('Audit fixes: initial selectedTerritoryId is null, TITLE_MENU clears transient UI state, and computeWorldPowerRankings is deterministic', async () => {
  const { computeWorldPowerRankings } = await import('./worldRankings');
  const ott = makeNation('OTT', 'Osmanlı', 'p_ott', { treasury: 1500 });
  const ven = makeNation('VEN', 'Venedik', 'p_ven', { treasury: 400 });
  const pOtt1 = makeTerritory('p_ott', 'Edirne', 'OTT', ['p_ott2'], {
    isCapital: true,
    baseGdp: 120,
    garrison: 25000,
  });
  const pOtt2 = makeTerritory('p_ott2', 'Bursa', 'OTT', ['p_ott'], {
    baseGdp: 90,
    garrison: 18000,
  });
  const pVen = makeTerritory('p_ven', 'Venedik', 'VEN', [], {
    isCapital: true,
    baseGdp: 80,
    garrison: 9000,
  });

  const ranked = computeWorldPowerRankings(
    { OTT: ott, VEN: ven },
    { p_ott: pOtt1, p_ott2: pOtt2, p_ven: pVen },
    [],
    'EMPIRES_1440',
    'SCORE'
  );
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].nation.id, 'OTT');
  assert.equal(ranked[0].ownedCount, 2);
  assert.equal(ranked[1].nation.id, 'VEN');

  const { useGameStore } = await import('../store/useGameStore');
  const initialState = useGameStore.getState();
  assert.equal(initialState.selectedTerritoryId, null);

  useGameStore.setState({
    screenState: 'PLAYING',
    selectedTerritoryId: 'p_ott',
    activeTab: 'DIPLOMACY',
    showNewsDrawer: true,
    showSystemModal: true,
    activeWarModalId: 'war-1',
  });

  useGameStore.getState().setScreenState('TITLE_MENU');
  const cleaned = useGameStore.getState();
  assert.equal(cleaned.screenState, 'TITLE_MENU');
  assert.equal(cleaned.selectedTerritoryId, null);
  assert.equal(cleaned.activeTab, 'NONE');
  assert.equal(cleaned.showNewsDrawer, false);
  assert.equal(cleaned.showSystemModal, false);
  assert.equal(cleaned.activeWarModalId, null);
});

test('countUnreadNewsEvents and store lastSeenNewsId clear unread indicators when opening Haberler or loading saves', async () => {
  const { countUnreadNewsEvents } = await import('./newsNotifications');
  const { useGameStore } = await import('../store/useGameStore');

  const mkEvent = (id: string, tick: number) => ({
    id,
    tick,
    dateStr: `1444-${tick}`,
    title: `Olay ${id}`,
    description: 'Açıklama',
    type: 'WAR' as const,
  });

  assert.equal(countUnreadNewsEvents([], null), 0);
  const events = [mkEvent('ev3', 3), mkEvent('ev2', 2), mkEvent('ev1', 1)];
  assert.equal(countUnreadNewsEvents(events, null), 3);
  assert.equal(countUnreadNewsEvents(events, 'ev1'), 2);
  assert.equal(countUnreadNewsEvents(events, 'ev3'), 0);
  assert.equal(countUnreadNewsEvents(events, 'rotated_out'), 3);

  // Store lifecycle: new campaign starts with init_1 unread, opening Haberler clears it
  useGameStore.getState().startNewGame();
  let st = useGameStore.getState();
  assert.equal(st.newsEvents.length, 1);
  assert.equal(st.lastSeenNewsId, null);
  assert.equal(countUnreadNewsEvents(st.newsEvents, st.lastSeenNewsId), 1);

  st.setShowNewsDrawer(true);
  st = useGameStore.getState();
  assert.equal(st.showNewsDrawer, true);
  assert.equal(st.lastSeenNewsId, 'init_1');
  assert.equal(countUnreadNewsEvents(st.newsEvents, st.lastSeenNewsId), 0);

  st.setShowNewsDrawer(false);
  st = useGameStore.getState();
  assert.equal(st.showNewsDrawer, false);
  assert.equal(countUnreadNewsEvents(st.newsEvents, st.lastSeenNewsId), 0);

  // Incoming newer news bumps unread count until read
  useGameStore.setState({
    newsEvents: [mkEvent('ev_new', 5), ...st.newsEvents],
  });
  st = useGameStore.getState();
  assert.equal(countUnreadNewsEvents(st.newsEvents, st.lastSeenNewsId), 1);

  st.markNewsAsRead();
  st = useGameStore.getState();
  assert.equal(st.lastSeenNewsId, 'ev_new');
  assert.equal(countUnreadNewsEvents(st.newsEvents, st.lastSeenNewsId), 0);
});

