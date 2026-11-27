import test from 'node:test';
import assert from 'node:assert/strict';
import { Nation, Territory } from '../types/game';
import {
  computeMonthlyDeathProbability,
  ensureAllNationsHaveRulers,
  ensureNationRulerState,
  evaluateMonthlyDynastySuccession,
  formatRulerFullTitle,
  getGameYearFromTick,
  getRulerAge,
  getRulerModifiers,
  isElectiveRegime,
  pickRealisticDeathCause,
  resolveSuccessionChoiceDomain,
} from './dynastyAndSuccessionEngine';
import {
  calculateNationEconomy,
  computeCombatStrength,
} from './simulationEngine';

function makeBaseNation(overrides: Partial<Nation> = {}): Nation {
  return {
    id: '792',
    name: 'Osmanlı İmparatorluğu',
    flagCode: 'TR',
    color: '#b91c1c',
    capitalTerritoryId: '792_0',
    ideology: 'MONARCHY',
    treasury: 3000,
    diplomacyPoints: 50,
    manpower: 40000,
    stability: 80,
    inflation: 2,
    researchPoints: 0,
    taxRate: 25,
    budget: { military: 35, economy: 30, research: 15, welfare: 20 },
    aggressiveExpansion: 10,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    primaryCulture: 'TURKIC_OGHUZ',
    isEliminated: false,
    ...overrides,
  };
}

function makeBaseTerritory(overrides: Partial<Territory> = {}): Territory {
  return {
    id: '792_0',
    name: 'Edirne',
    ownerId: '792',
    coreOwnerId: '792',
    isCapital: true,
    isCoastal: true,
    terrain: 'OVA',
    population: 1200,
    baseGdp: 120,
    resource: 'TAHIL',
    buildings: {
      factory: 1,
      barracks: 1,
      fortress: 1,
      university: 0,
      tradeHub: 1,
      supplyDepot: 0,
    },
    garrison: 12000,
    units: { infantry: 10000, armor: 2000, airDrone: 0 },
    unrest: 5,
    isOccupied: false,
    centroid: [26.5, 41.6],
    neighbors: [],
    ...overrides,
  };
}

test('1440 historical dynasty initialization assigns II. Murad and Fatih Sultan Mehmed as heir', () => {
  const ottoman = ensureNationRulerState(
    makeBaseNation({ id: '792' }),
    'EMPIRES_1440',
    0,
    1440
  );

  assert.ok(ottoman.ruler);
  assert.equal(ottoman.ruler.name, 'II. Murad');
  assert.equal(formatRulerFullTitle(ottoman.ruler), 'Sultan II. Murad');
  assert.equal(ottoman.ruler.dynastyName, 'Osmanoğulları');
  assert.equal(getRulerAge(ottoman.ruler, 1440), 36);

  assert.ok(ottoman.heir);
  assert.equal(ottoman.heir.name, 'Fatih Sultan Mehmed');
  assert.equal(formatRulerFullTitle(ottoman.heir), 'Fatih Sultan Mehmed');
  assert.equal(ottoman.dynastyQueueIndex, 0);
});

test('non-deterministic mortality curve scales realistically with age, war, stability, and science tech', () => {
  const youngPeace = computeMonthlyDeathProbability({
    age: 28,
    reignDays: 720,
    isAtWar: false,
    hasActiveCampaign: false,
    isCapitalUnderSiege: false,
    isWinter: false,
    stability: 85,
    minLordLoyalty: 75,
    scienceTechCount: 0,
    coupResistance: 0,
  });

  const olderPeace = computeMonthlyDeathProbability({
    age: 68,
    reignDays: 3650,
    isAtWar: false,
    hasActiveCampaign: false,
    isCapitalUnderSiege: false,
    isWinter: false,
    stability: 85,
    minLordLoyalty: 75,
    scienceTechCount: 0,
    coupResistance: 0,
  });

  const olderWithMedicine = computeMonthlyDeathProbability({
    age: 68,
    reignDays: 3650,
    isAtWar: false,
    hasActiveCampaign: false,
    isCapitalUnderSiege: false,
    isWinter: false,
    stability: 85,
    minLordLoyalty: 75,
    scienceTechCount: 6,
    coupResistance: 0,
  });

  const wartimeUnstable = computeMonthlyDeathProbability({
    age: 42,
    reignDays: 1000,
    isAtWar: true,
    hasActiveCampaign: true,
    isCapitalUnderSiege: true,
    isWinter: true,
    stability: 22,
    minLordLoyalty: 20,
    scienceTechCount: 0,
    coupResistance: 0,
  });

  assert.ok(olderPeace.totalMonthlyProb > youngPeace.totalMonthlyProb * 5);
  assert.ok(olderWithMedicine.totalMonthlyProb < olderPeace.totalMonthlyProb);
  assert.ok(wartimeUnstable.campaignWeight > 0);
  assert.ok(wartimeUnstable.coupWeight > 0);
  assert.equal(pickRealisticDeathCause(wartimeUnstable, 0.01), 'PALACE_COUP');
  assert.equal(pickRealisticDeathCause(olderPeace, 0.99), 'NATURAL_AGE');
});

test('multi-decade 1440 simulation produces sequential Ottoman rulers with dynamic varied lifespans across seeds', () => {
  const simulateOttomanSuccession = (seed: number) => {
    let nations: Record<string, Nation> = ensureAllNationsHaveRulers(
      { '792': makeBaseNation({ id: '792', stability: 78 }) },
      'EMPIRES_1440',
      0,
      seed
    );
    const territories: Record<string, Territory> = {
      '792_0': makeBaseTerritory(),
    };
    const ascendedNames: string[] = [nations['792'].ruler!.name];
    const successionTicks: number[] = [];

    // Run 80 years (month by month = 960 months)
    for (let month = 1; month <= 960; month++) {
      const tick = month * 30;
      const res = evaluateMonthlyDynastySuccession({
        nextTick: tick,
        gameMode: 'EMPIRES_1440',
        playerNationId: '792',
        nations,
        territories,
        wars: [],
        movements: [],
        isWinter: month % 12 === 0,
        worldSeed: seed,
      });
      if (res.updatedNations) {
        nations = res.updatedNations;
      }
      if (res.playerSuccessionEvent) {
        ascendedNames.push(res.playerSuccessionEvent.incomingRuler.name);
        successionTicks.push(tick);
      }
    }
    return { ascendedNames, successionTicks, finalNation: nations['792'] };
  };

  const runA = simulateOttomanSuccession(101);
  const runB = simulateOttomanSuccession(909);

  // Both runs follow exact historical Ottoman succession sequence
  assert.ok(runA.ascendedNames.length >= 2);
  assert.equal(runA.ascendedNames[0], 'II. Murad');
  assert.equal(runA.ascendedNames[1], 'Fatih Sultan Mehmed');
  if (runA.ascendedNames.length >= 3) {
    assert.equal(runA.ascendedNames[2], 'II. Bayezid');
  }

  // Exact death ticks differ dynamically between different campaign seeds!
  assert.notDeepEqual(runA.successionTicks, runB.successionTicks);
  assert.ok((runA.finalNation.dynastyHistory?.length ?? 0) >= 1);
});

test('ruler skill and trait modifiers feed cleanly into economy and combat strength within realistic bounds', () => {
  const territories = { '792_0': makeBaseTerritory() };
  const weakNation = makeBaseNation({
    ruler: {
      id: 'r_weak',
      name: 'Zayıf Hükümdar',
      title: 'Sultan',
      dynastyName: 'Test',
      birthYear: 1410,
      reignStartYear: 1440,
      reignStartTick: 0,
      admin: 1,
      diplomacy: 1,
      military: 1,
      traitId: 'CAUTIOUS',
    },
  });
  const kanuniNation = makeBaseNation({
    ruler: {
      id: 'r_kanuni',
      name: 'Kanuni Sultan Süleyman',
      title: 'Sultan',
      dynastyName: 'Osmanoğulları',
      birthYear: 1494,
      reignStartYear: 1520,
      reignStartTick: 0,
      admin: 6,
      diplomacy: 5,
      military: 6,
      traitId: 'JUST_LAWGIVER',
    },
  });

  const modsWeak = getRulerModifiers(weakNation);
  const modsKanuni = getRulerModifiers(kanuniNation);
  assert.ok(modsKanuni.taxMultDelta > 0.1 && modsKanuni.taxMultDelta <= 0.15);
  assert.ok(modsWeak.taxMultDelta < 0 && modsWeak.taxMultDelta >= -0.06);

  const econWeak = calculateNationEconomy(
    weakNation,
    territories,
    { '792': weakNation },
    {},
    []
  );
  const econKanuni = calculateNationEconomy(
    kanuniNation,
    territories,
    { '792': kanuniNation },
    {},
    []
  );
  assert.ok(econKanuni.taxIncome > econWeak.taxIncome);
  assert.ok(econKanuni.dailyManpower > econWeak.dailyManpower);

  const strWeak = computeCombatStrength(weakNation, territories['792_0'], false);
  const strKanuni = computeCombatStrength(
    kanuniNation,
    territories['792_0'],
    false
  );
  assert.ok(strKanuni > strWeak);
});

test('2026 democracy triggers realistic 4-year election cycle and supports re-election or transition', () => {
  const turkey2026 = ensureNationRulerState(
    makeBaseNation({
      id: '792',
      name: 'Türkiye',
      ideology: 'DEMOCRACY',
    }),
    'STANDARD_2026',
    0,
    2026
  );

  assert.equal(isElectiveRegime(turkey2026, 'STANDARD_2026'), true);
  assert.equal(turkey2026.ruler?.isElected, true);
  assert.equal(turkey2026.ruler?.termLimitYears, 4);

  // Trigger at 4 years (1470 days, multiple of 30)
  const tick4Years = 1470;
  const res = evaluateMonthlyDynastySuccession({
    nextTick: tick4Years,
    gameMode: 'STANDARD_2026',
    playerNationId: '792',
    nations: { '792': turkey2026 },
    territories: { '792_0': makeBaseTerritory() },
    wars: [],
    movements: [],
    isWinter: false,
    worldSeed: 2026,
  });

  assert.ok(res.playerSuccessionEvent);
  assert.equal(res.playerSuccessionEvent.isElection, true);
  assert.equal(res.playerSuccessionEvent.eventYear, getGameYearFromTick(tick4Years, 'STANDARD_2026'));

  const newMandateOption = res.playerSuccessionEvent.options.find(
    (o) => o.id === 'NEW_MANDATE'
  );
  assert.ok(newMandateOption);

  const resolved = resolveSuccessionChoiceDomain({
    nations: { '792': turkey2026 },
    playerNationId: '792',
    activeSuccession: res.playerSuccessionEvent,
    option: newMandateOption,
    tick: tick4Years,
    gameMode: 'STANDARD_2026',
    newsEvents: [],
    dateStr: '10 Oca 2030',
  });

  assert.equal(resolved.activeSuccession, null);
  assert.equal(
    resolved.nations['792'].ruler?.name,
    res.playerSuccessionEvent.incomingRuler.name
  );
  assert.equal(resolved.nations['792'].dynastyHistory?.length, 1);
  assert.equal(resolved.nations['792'].dynastyHistory?.[0].cause, 'TERM_ENDED');
});

test('coronation cülus choice deducts gold and boosts stability while frugal transition saves gold at stability cost', () => {
  const ottoman = ensureNationRulerState(
    makeBaseNation({ id: '792', treasury: 2000, stability: 70, prestige: 20 }),
    'EMPIRES_1440',
    0,
    1440
  );

  // Force a guaranteed monarch succession event using a mock event
  const mockEvent = {
    id: 'succ_test',
    nationId: '792',
    nationName: 'Osmanlı İmparatorluğu',
    isElection: false,
    eventYear: 1451,
    previousRuler: {
      name: 'II. Murad',
      title: 'Sultan',
      dynastyName: 'Osmanoğulları',
      reignStartYear: 1440,
      reignEndYear: 1451,
      ageAtEnd: 47,
      cause: 'NATURAL_AGE' as const,
      admin: 4,
      diplomacy: 4,
      military: 5,
      traitId: 'IRON_WILL' as const,
    },
    incomingRuler: {
      id: 'r_fatih',
      name: 'Fatih Sultan Mehmed',
      title: 'Sultan',
      dynastyName: 'Osmanoğulları',
      birthYear: 1432,
      reignStartYear: 1451,
      reignStartTick: 4000,
      admin: 5,
      diplomacy: 5,
      military: 6,
      traitId: 'SIEGE_MASTER' as const,
    },
    nextHeir: null,
    headline: 'Taht Değişimi',
    description: 'Test',
    options: [
      {
        id: 'CORONATION_DONATIVE' as const,
        label: 'Cülus Bahşişi Dağıt',
        subtitle: 'Test',
        effectSummary: '-280 Altın · +4 İstikrar',
        goldCost: 280,
        stabilityDelta: 4,
        prestigeDelta: 18,
      },
      {
        id: 'FRUGAL_TRANSITION' as const,
        label: 'Hazineyi Koru',
        subtitle: 'Test',
        effectSummary: '0 Altın · -6 İstikrar',
        goldCost: 0,
        stabilityDelta: -6,
        prestigeDelta: -5,
      },
    ],
  };

  const donativeRes = resolveSuccessionChoiceDomain({
    nations: { '792': ottoman },
    playerNationId: '792',
    activeSuccession: mockEvent,
    option: mockEvent.options[0],
    tick: 4000,
    gameMode: 'EMPIRES_1440',
    newsEvents: [],
    dateStr: '15 Şub 1451',
  });
  assert.equal(donativeRes.nations['792'].treasury, 1720);
  assert.equal(donativeRes.nations['792'].stability, 74);
  assert.equal(donativeRes.nations['792'].prestige, 38);

  const frugalRes = resolveSuccessionChoiceDomain({
    nations: { '792': ottoman },
    playerNationId: '792',
    activeSuccession: mockEvent,
    option: mockEvent.options[1],
    tick: 4000,
    gameMode: 'EMPIRES_1440',
    newsEvents: [],
    dateStr: '15 Şub 1451',
  });
  assert.equal(frugalRes.nations['792'].treasury, 2000);
  assert.equal(frugalRes.nations['792'].stability, 64);
  assert.equal(frugalRes.nations['792'].prestige, 15);
});
