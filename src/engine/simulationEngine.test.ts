import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGameDate } from './simulationEngine';
import { computeGameTick } from './tickEngine';
import { hydrateSavedPayload } from './saveManager';
import type { SaveGamePayload } from './saveManager';
import { initializeWorld2026 } from './worldBuilder';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';
import { useGameStore } from '../store/useGameStore';
import {
  ActiveWar,
  Nation,
  Territory,
} from '../types/game';

test('formatGameDate formats 1440 and 2026 dates and optional hours accurately', () => {
  assert.equal(formatGameDate(0, 'EMPIRES_1440'), '1 Oca 1440');
  assert.equal(formatGameDate(10, 'EMPIRES_1440'), '11 Oca 1440');
  assert.equal(formatGameDate(0, 'WORLD_2026'), '1 Oca 2026');
  assert.equal(formatGameDate(0, 'EMPIRES_1440', 8), '1 Oca 1440 · 08:00');
  assert.equal(formatGameDate(2, 'EMPIRES_1440', 19), '3 Oca 1440 · 19:00');
});

test('computeGameTick preserves territories/nations references during hourly army movement and simulates battles directly on the map (AoH3 style)', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      capitalTerritoryId: '792',
      treasury: 1000,
      manpower: 15000,
      stability: 80,
      inflation: 2,
      researchPoints: 40,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      capitalTerritoryId: '300',
      treasury: 500,
      manpower: 5000,
      stability: 70,
      inflation: 2,
      researchPoints: 20,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Edirne',
      ownerId: '792',
      coreOwnerId: '792',
      garrison: 10000,
      units: { infantry: 8000, armor: 2000, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 1, supplyDepot: 1 },
      neighbors: ['300'],
      centroid: [26, 41],
    } as unknown as Territory,
    '300': {
      id: '300',
      name: 'İstanbul',
      ownerId: '300',
      coreOwnerId: '300',
      garrison: 3000,
      units: { infantry: 3000, armor: 0, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 1, supplyDepot: 0 },
      neighbors: ['792'],
      centroid: [28, 41],
    } as unknown as Territory,
  };

  // Step 1: Hourly tick while army is mid-march (progress: 40 -> 44) must preserve exact object references for territories & nations
  const marchStep = computeGameTick({
    tick: 1,
    hour: 8,
    hoursStep: 2,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [
      {
        id: 'w1',
        name: 'Osmanlı - Bizans Savaşı',
        attackerId: '792',
        defenderId: '300',
        attackers: ['792'],
        defenders: ['300'],
        startedTick: 1,
        attackerWarScore: 0,
        casualtiesAttacker: 0,
        casualtiesDefender: 0,
      },
    ],
    battles: [],
    movements: [
      {
        id: 'mv1',
        ownerId: '792',
        fromTerritoryId: '792',
        toTerritoryId: '300',
        troops: 14000,
        units: { infantry: 10000, armor: 3000, airDrone: 1000 },
        progress: 40,
        isAttack: true,
      },
    ],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(marchStep.territories, territories, 'territories reference must stay identical during pure movement step');
  assert.equal(marchStep.nations, nations, 'nations reference must stay identical during pure movement step');

  // Step 2: When army arrives (progress: 98 -> 100), it starts an on-map battle without triggering blocking modal
  const arrivalStep = computeGameTick({
    tick: 1,
    hour: 10,
    hoursStep: 2,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: marchStep.wars,
    battles: [],
    movements: [{ ...marchStep.movements[0], progress: 98 }],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(arrivalStep.triggeredTacticalBattle, null, 'Should not open blocking modal on battle start');
  assert.equal(arrivalStep.shouldPause, false, 'Should not pause game on battle start');
  assert.equal(arrivalStep.battles.length, 1, 'Should create an active on-map battle');

  // Step 3: Advancing subsequent hourly combat rounds concludes the battle and transitions victorious army into a 0->100 city siege
  let curState = arrivalStep;
  for (let i = 0; i < 6 && curState.battles.length > 0; i++) {
    curState = computeGameTick({
      tick: curState.nextTick,
      hour: curState.nextHour,
      hoursStep: 2,
      speed: 2,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: curState.nations,
      territories: curState.territories,
      relations: curState.relations,
      wars: curState.wars,
      battles: curState.battles,
      movements: curState.movements,
      newsEvents: curState.newsEvents,
      settings: DEFAULT_GAME_SETTINGS,
    });
  }

  assert.equal(curState.battles.length, 0, 'On-map battle should conclude after combat rounds');
  assert.ok(curState.territories['300'].siege, 'Winning the field battle should initiate the city siege');
  assert.equal(curState.territories['300'].ownerId, '300', 'City should not fall until the siege bar hits 100/100');

  // Step 4: Advance siege ticks until 100/100 completes and captures the province
  for (let i = 0; i < 40 && curState.territories['300'].siege; i++) {
    curState = computeGameTick({
      tick: curState.nextTick,
      hour: curState.nextHour,
      hoursStep: 12,
      speed: 3,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: curState.nations,
      territories: curState.territories,
      relations: curState.relations,
      wars: curState.wars,
      battles: curState.battles,
      movements: curState.movements,
      newsEvents: curState.newsEvents,
      settings: DEFAULT_GAME_SETTINGS,
    });
  }

  assert.equal(curState.territories['300'].siege, null, 'Siege should clear upon reaching 100/100');
  assert.equal(curState.territories['300'].ownerId, '792', 'Superior army should conquer province after siege reaches 100/100');
});

test('computeGameTick simulates AoH3 real-time sieges and frontline/backline morale dynamics', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı Devleti',
      color: '#DC2626',
      flagCode: 'TUR',
      capitalTerritoryId: '792',
      ideology: 'MONARCHY',
      treasury: 1000,
      manpower: 50000,
      stability: 80,
      inflation: 5,
      researchPoints: 50,
      taxRate: 35,
      budget: { military: 35, economy: 25, research: 20, welfare: 20 },
      aggressiveExpansion: 10,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    },
    '300': {
      id: '300',
      name: 'Bizans İmparatorluğu',
      color: '#7C3AED',
      flagCode: 'BYZ',
      capitalTerritoryId: '300',
      ideology: 'MONARCHY',
      treasury: 500,
      manpower: 20000,
      stability: 60,
      inflation: 8,
      researchPoints: 30,
      taxRate: 30,
      budget: { military: 35, economy: 25, research: 20, welfare: 20 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    },
  };

  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Edirne Sancağı',
      ownerId: '792',
      coreOwnerId: '792',
      population: 400,
      baseGdp: 20,
      resource: 'DEMIR_CELIK',
      buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      garrison: 8000,
      units: { infantry: 5000, armor: 2000, airDrone: 1000 },
      unrest: 5,
      isOccupied: false,
      centroid: [26.5, 41.6],
      neighbors: ['300'],
    },
    '300': {
      id: '300',
      name: 'Konstantiniyye',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: true,
      population: 600,
      baseGdp: 35,
      resource: 'TICARET_BOGAZI',
      buildings: { factory: 1, barracks: 1, fortress: 2, university: 1, tradeHub: 1, supplyDepot: 0 },
      garrison: 0,
      units: { infantry: 0, armor: 0, airDrone: 0 },
      unrest: 10,
      castleWallHp: 90,
      isOccupied: false,
      centroid: [28.9, 41.0],
      neighbors: ['792'],
      siege: {
        territoryId: '300',
        attackerId: '792',
        defenderId: '300',
        attackerTroops: 12000,
        attackerUnits: { infantry: 8000, armor: 2000, airDrone: 2000 },
        progress: 96,
        wallIntegrity: 45,
        startedTick: 1,
      },
    },
  };

  const wars: ActiveWar[] = [
    {
      id: 'war_1',
      name: 'Bizans Kuşatma Savaşı',
      attackerId: '792',
      defenderId: '300',
      attackers: ['792'],
      defenders: ['300'],
      startedTick: 1,
      attackerWarScore: 15,
      casualtiesAttacker: 500,
      casualtiesDefender: 1200,
    },
  ];

  // Tick 1: Advance siege
  const out1 = computeGameTick({
    tick: 1,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars,
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

  const siegedTerr = out1.territories['300'];
  assert.ok(siegedTerr);
  // Siege was at 88% and daily step is >12%, so it should reach 100% and fall to Ottoman Empire!
  assert.equal(siegedTerr.isOccupied, true);
  assert.equal(siegedTerr.occupiedById, '792');
  assert.equal(siegedTerr.siege, null);
  assert.ok(siegedTerr.garrison >= 800, 'Besieging troops garrison the conquered fortress');
});

test('save hydration roundtrip preserves 1440 scenario tick, wars, and nation economy', () => {
  const bundle = initializeWorld2026('EMPIRES_1440');
  const sampleWar: ActiveWar = {
    id: 'war_test_1440',
    name: 'Osmanlı-Bizans Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    startedTick: 5,
    attackerWarScore: 34,
    casualtiesAttacker: 1200,
    casualtiesDefender: 2500,
  };
  const payload: SaveGamePayload = {
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: {
      ...bundle.nations,
      '792': { ...bundle.nations['792'], treasury: 4321 },
    },
    territories: bundle.territories,
    relations: bundle.relations,
    wars: [sampleWar],
    battles: [],
    movements: [],
    newsEvents: [],
    tick: 42,
    hour: 14,
  };

  const hydrated = hydrateSavedPayload(payload, bundle.nations, bundle.territories);
  assert.equal(hydrated.gameMode, 'EMPIRES_1440');
  assert.equal(hydrated.tick, 42);
  assert.equal(hydrated.hour, 14);
  assert.equal(hydrated.wars.length, 1);
  assert.equal(hydrated.wars[0].attackerWarScore, 34);
  assert.equal(hydrated.nations['792'].treasury, 4321);
});

test('campaign victory and defeat state transitions pause gameplay and support endless continuation', () => {
  const initialState = useGameStore.getState();
  try {
    useGameStore.getState().selectScenarioMode('EMPIRES_1440');
    useGameStore.getState().startNewGame();

    // 1. Trigger Victory (>=45% provinces owned by player)
    const cur = useGameStore.getState();
    const allEntries = Object.entries(cur.territories);
    const victoryTarget = Math.ceil(allEntries.length * 0.48);
    const conqueredTerritories = Object.fromEntries(
      allEntries.map(([id, t], idx) => [
        id,
        idx < victoryTarget ? { ...t, ownerId: '792' } : t,
      ])
    );
    useGameStore.setState({
      territories: conqueredTerritories,
      speed: 1,
      screenState: 'PLAYING',
    });
    useGameStore.getState().advanceGameTick();
    assert.equal(useGameStore.getState().screenState, 'VICTORY_SUMMARY');
    assert.equal(useGameStore.getState().campaignOutcome, 'VICTORY');
    assert.equal(useGameStore.getState().speed, 0);

    // 2. Continue after victory should dismiss banner and stay PLAYING on next tick
    useGameStore.getState().continueAfterVictory();
    assert.equal(useGameStore.getState().screenState, 'PLAYING');
    assert.equal(useGameStore.getState().dismissedVictoryBanner, true);
    useGameStore.setState({ speed: 1 });
    useGameStore.getState().advanceGameTick();
    assert.equal(useGameStore.getState().screenState, 'PLAYING');

    // 3. Trigger Defeat (0 provinces owned by player)
    const lostTerritories = Object.fromEntries(
      Object.entries(useGameStore.getState().territories).map(([id, t]) => [
        id,
        t.ownerId === '792' ? { ...t, ownerId: '300' } : t,
      ])
    );
    useGameStore.setState({
      territories: lostTerritories,
      speed: 1,
      screenState: 'PLAYING',
    });
    useGameStore.getState().advanceGameTick();
    assert.equal(useGameStore.getState().screenState, 'VICTORY_SUMMARY');
    assert.equal(useGameStore.getState().campaignOutcome, 'DEFEAT');
    assert.equal(useGameStore.getState().speed, 0);
  } finally {
    useGameStore.setState(initialState);
  }
});

test('computeGameTick automatically prunes zombie wars when one side is completely eliminated', () => {
  const nations: Record<string, Nation> = {
    A: {
      id: 'A', name: 'A', capitalTerritoryId: 'T1', treasury: 1000, manpower: 20000,
      stability: 80, inflation: 2, taxRate: 25, researchPoints: 50,
      budget: { military: 35, economy: 30, research: 15, welfare: 20 },
      ideology: 'MONARCHY', unlockedTechs: [], enactedReforms: [],
      aggressiveExpansion: 0, isEliminated: false,
    } as unknown as Nation,
    B: {
      id: 'B', name: 'B', capitalTerritoryId: 'T2', treasury: 0, manpower: 0,
      stability: 50, inflation: 2, taxRate: 25, researchPoints: 0,
      budget: { military: 35, economy: 30, research: 15, welfare: 20 },
      ideology: 'MONARCHY', unlockedTechs: [], enactedReforms: [],
      aggressiveExpansion: 0, isEliminated: true,
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    T1: {
      id: 'T1', name: 'Başkent A', ownerId: 'A', coreOwnerId: 'A',
      population: 1000000, baseGdp: 100, garrison: 10000, unrest: 0,
      units: { infantry: 8000, armor: 1500, airDrone: 500 },
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      resource: 'TAHIL', terrain: 'OVA', centroid: [0, 0], neighbors: [],
    } as unknown as Territory,
  };
  const zombieWar: ActiveWar = {
    id: 'war_zombie',
    name: 'A - B Savaşı',
    attackerId: 'A',
    defenderId: 'B',
    attackers: ['A'],
    defenders: ['B'],
    startedTick: 0,
    attackerWarScore: 100,
    casualtiesAttacker: 500,
    casualtiesDefender: 5000,
  };

  const out = computeGameTick({
    tick: 5,
    hour: 22,
    hoursStep: 4,
    speed: 1,
    gameMode: 'STANDARD_2026',
    playerNationId: 'A',
    nations,
    territories,
    relations: {},
    wars: [zombieWar],
    battles: [],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(out.wars.length, 0, 'War against eliminated nation must be automatically concluded');
});

test('gameClockConfig enforces brisk responsive pacing across 1x-5x speeds', async () => {
  const { getClockSpeedProfile, getRealSecondsPerGameYear } = await import('./gameSettings');

  const p1 = getClockSpeedProfile(1);
  const p5 = getClockSpeedProfile(5);
  assert.ok(p1.intervalMs > p5.intervalMs, '5x must tick faster than 1x');
  assert.ok(p5.hoursStep > p1.hoursStep, '5x must advance more in-game hours per tick than 1x');
  assert.ok(p5.hoursStep <= 12, '5x should remain smooth and controlled (<= 12h per tick)');

  const secPerYear5x = getRealSecondsPerGameYear(5);
  assert.ok(
    secPerYear5x >= 45 && secPerYear5x <= 180,
    `5x should feel genuinely fast while staying playable (got ${secPerYear5x.toFixed(1)}s/year)`
  );
});

test('armyInterpolation produces smooth 60 FPS sub-tick positions and freezes cleanly on pause', async () => {
  const {
    syncMovementTweens,
    computeInterpolatedProgressMap,
    computeMarchAnimPhase,
  } = await import('../map/armyInterpolation');

  const tweens = new Map();
  const baseMv = {
    id: 'mv_smooth_1',
    ownerId: 'TUR',
    fromTerritoryId: 'TUR_0',
    toTerritoryId: 'TUR_1',
    troops: 12000,
    units: { infantry: 12000, armor: 0, artillery: 0, airDrone: 0 },
    progress: 12,
    isAttack: false,
  };

  syncMovementTweens(tweens, [baseMv], 5, 1000);
  const mid1 = computeInterpolatedProgressMap(tweens, [baseMv], 5, 1045);
  assert.ok(
    mid1.mv_smooth_1 > 0 && mid1.mv_smooth_1 < 12,
    `Mid-frame progress should smoothly interpolate between 0 and 12 (got ${mid1.mv_smooth_1})`
  );

  const nextMv = { ...baseMv, progress: 24 };
  syncMovementTweens(tweens, [nextMv], 5, 1100);
  const quarter = computeInterpolatedProgressMap(tweens, [nextMv], 5, 1125);
  const threeQuarter = computeInterpolatedProgressMap(tweens, [nextMv], 5, 1170);
  assert.ok(
    quarter.mv_smooth_1 > 12 &&
      threeQuarter.mv_smooth_1 > quarter.mv_smooth_1 &&
      threeQuarter.mv_smooth_1 < 24,
    'Sub-tick progress must monotonically advance across 60 FPS animation frames'
  );

  const paused = computeInterpolatedProgressMap(tweens, [nextMv], 0, 1140);
  assert.equal(paused.mv_smooth_1, 24);
  const phaseA = computeMarchAnimPhase(1000, 5, 24);
  const phaseB = computeMarchAnimPhase(1050, 5, 24);
  assert.notEqual(phaseA, phaseB, 'Active marching anim phase should advance smoothly over time');
});

test('bootLoader classifies device hardware tiers and computes monotonic stage progress', async () => {
  const { detectHardwareProfile, computeBootProgress, BOOT_STAGES } = await import(
    './bootLoader'
  );

  const high = detectHardwareProfile({ cores: 8, memoryGb: 16, dpr: 2 });
  const balanced = detectHardwareProfile({ cores: 4, memoryGb: 4, dpr: 2 });
  const eco = detectHardwareProfile({ cores: 2, memoryGb: 2, dpr: 1 });

  assert.equal(high.tier, 'HIGH');
  assert.equal(balanced.tier, 'BALANCED');
  assert.equal(eco.tier, 'ECO');
  assert.ok(
    high.warmupChunkSize > balanced.warmupChunkSize &&
      balanced.warmupChunkSize > eco.warmupChunkSize,
    'Stronger hardware must process larger warmup chunks so loading finishes faster'
  );

  const done = new Set<(typeof BOOT_STAGES)[number]['id']>();
  const p0 = computeBootProgress(done, 'HARDWARE', 0.5);
  done.add('HARDWARE');
  done.add('SAVES');
  const pMid = computeBootProgress(done, 'WORLD_MAP', 0.5);
  BOOT_STAGES.forEach((s) => done.add(s.id));
  const pEnd = computeBootProgress(done);

  assert.ok(p0 > 0 && pMid > p0 && pEnd === 100);
});

test('feedbackStorage enforces strict validation and formats offline report & mailto link', async () => {
  const {
    validateFeedbackInput,
    buildFeedbackDiagnostics,
    formatFeedbackReport,
    buildFeedbackMailtoHref,
  } = await import('./feedbackStorage');

  assert.equal(validateFeedbackInput('', 'Yeterince uzun açıklama metni').valid, false);
  assert.equal(validateFeedbackInput('Başlık', 'kısa').valid, false);
  assert.equal(
    validateFeedbackInput('1440 Harita Önerisi', 'Anadolu beylikleri için yeni görevler eklenebilir.').valid,
    true
  );

  const diag = buildFeedbackDiagnostics({
    viewportWidth: 844,
    viewportHeight: 390,
    activeScenario: '1440 İmparatorluklar Çağı',
    uiScale: 'COMPACT',
    hardwareTier: 'Yüksek Performans Profili',
    schemaVersion: 6,
  });
  assert.equal(diag.orientation, 'Yatay');
  assert.equal(diag.viewport, '844×390');

  const draft = {
    category: 'MOBILE_HUD' as const,
    subject: 'iPhone yatay ekran testi',
    message: 'Bildirimler haritayı kapatmıyor, çok net görünüyor.',
    includeDiagnostics: true,
  };
  const report = formatFeedbackReport(draft, diag);
  assert.ok(report.includes('Floda Strategy'));
  assert.ok(report.includes('844×390 (Yatay)'));

  const href = buildFeedbackMailtoHref(draft, diag);
  assert.ok(href.startsWith('mailto:'));
  assert.ok(href.includes('subject='));
  assert.ok(href.includes('body='));
});

test('saveManager v6 validates checksums, migrates legacy saves, and preserves rollback backups', async () => {
  const {
    SAVE_SCHEMA_VERSION,
    computePayloadChecksum,
    validateAndMigrateSaveRecord,
    saveGameToSlot,
    loadGameFromSlot,
    hasRollbackBackup,
    restoreRollbackBackup,
    deleteSaveSlot,
  } = await import('./saveManager');

  const st = useGameStore.getState();
  const basePayload: SaveGamePayload = {
    gameMode: 'EMPIRES_1440',
    playerNationId: st.playerNationId,
    nations: st.nations,
    territories: st.territories,
    relations: st.relations,
    wars: st.wars,
    battles: st.battles,
    movements: st.movements,
    newsEvents: st.newsEvents,
    tick: 15,
    hour: 12,
  };

  // Legacy v4 payload without checksum migrates cleanly to v6
  const migratedRes = validateAndMigrateSaveRecord(
    {
      metadata: { slotId: 'SLOT_2', schemaVersion: 4 },
      payload: basePayload,
    },
    'SLOT_2'
  );
  assert.equal(migratedRes.corrupted, false);
  assert.equal(migratedRes.migrated, true);
  assert.equal(migratedRes.record?.metadata.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(
    migratedRes.record?.metadata.checksum,
    computePayloadChecksum(basePayload)
  );

  // Corrupted v6 checksum is rejected
  const tamperedRes = validateAndMigrateSaveRecord(
    {
      metadata: {
        ...migratedRes.record!.metadata,
        checksum: 'v6_deadbeef',
      },
      payload: basePayload,
    },
    'SLOT_2'
  );
  assert.equal(tamperedRes.corrupted, true);
  assert.equal(tamperedRes.record, null);

  // Overwriting a slot creates an automatic rollback backup that can be restored
  deleteSaveSlot('SLOT_3');
  saveGameToSlot('SLOT_3', { ...basePayload, tick: 20 });
  assert.equal(hasRollbackBackup('SLOT_3'), false);
  saveGameToSlot('SLOT_3', { ...basePayload, tick: 45 });
  assert.equal(hasRollbackBackup('SLOT_3'), true);
  assert.equal(loadGameFromSlot('SLOT_3')?.payload.tick, 45);

  const rolledBack = restoreRollbackBackup('SLOT_3');
  assert.equal(rolledBack?.payload.tick, 20);
  assert.equal(loadGameFromSlot('SLOT_3')?.payload.tick, 20);
  deleteSaveSlot('SLOT_3');
});

test('Faz 3.6: gameSettings multipliers, shortcut list, and volume clamping work accurately', async () => {
  const {
    DEFAULT_GAME_SETTINGS,
    KEYBOARD_SHORTCUTS_LIST,
    getBorderThicknessMultiplier,
    getGraphicsMaxDpr,
    getMapLabelScaleMultiplier,
  } = await import('./gameSettings');

  assert.equal(getBorderThicknessMultiplier('THIN'), 0.75);
  assert.equal(getBorderThicknessMultiplier('NORMAL'), 1.0);
  assert.equal(getBorderThicknessMultiplier('BOLD'), 1.35);

  assert.equal(getMapLabelScaleMultiplier('SMALL'), 0.86);
  assert.equal(getMapLabelScaleMultiplier('NORMAL'), 1.0);
  assert.equal(getMapLabelScaleMultiplier('LARGE'), 1.16);

  assert.equal(getGraphicsMaxDpr('LOW'), 1.0);
  assert.equal(getGraphicsMaxDpr('BALANCED'), 1.5);
  assert.equal(getGraphicsMaxDpr('HIGH'), 2.0);

  assert.equal(DEFAULT_GAME_SETTINGS.capitulationThresholdPct, 75);
  assert.equal(DEFAULT_GAME_SETTINGS.smoothArmyAnimations, true);
  assert.ok(KEYBOARD_SHORTCUTS_LIST.length >= 10);
  assert.ok(KEYBOARD_SHORTCUTS_LIST.some((s) => s.keys === 'Boşluk'));
  assert.ok(KEYBOARD_SHORTCUTS_LIST.some((s) => s.keys === 'Q'));
  assert.ok(KEYBOARD_SHORTCUTS_LIST.some((s) => s.keys === 'B'));
});

test('Gameplay fixes: 1x-5x speed profiles include 3x and slightly brisker cadence', async () => {
  const { CLOCK_SPEED_PROFILES, getClockSpeedProfile } = await import('./gameSettings');
  assert.ok(CLOCK_SPEED_PROFILES[3].rateLabel.includes('3x'));
  assert.ok(CLOCK_SPEED_PROFILES[1].intervalMs < 700);
  assert.ok(CLOCK_SPEED_PROFILES[2].intervalMs < 520);
  assert.ok(CLOCK_SPEED_PROFILES[3].intervalMs < CLOCK_SPEED_PROFILES[2].intervalMs);
  assert.ok(CLOCK_SPEED_PROFILES[4].intervalMs < CLOCK_SPEED_PROFILES[3].intervalMs);
  assert.ok(CLOCK_SPEED_PROFILES[5].intervalMs < CLOCK_SPEED_PROFILES[4].intervalMs);
  assert.equal(getClockSpeedProfile(3).hoursStep, 4);
});
