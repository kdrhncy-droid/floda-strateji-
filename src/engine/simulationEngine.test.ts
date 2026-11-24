import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustAggressiveExpansionGain,
  adjustOccupiedUnrestDrift,
  calculateNationEconomy,
  calculateProvinceDevelopment,
  computeCombatStrength,
  computeNationManpowerCap,
  formatGameDate,
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
  isNationEmbargoed,
  resolveWarParticipants,
} from './simulationEngine';
import {
  calculateBlockadedCorridorIncome,
  calculateNationTradeAndStraits,
} from './straitsAndTradeEngine';
import { hydrateSavedPayload } from './saveManager';
import type { SaveGamePayload } from './saveManager';
import {
  evaluateMultiProvinceAiTurn,
  evaluateWartimeAiOperations,
  evaluateWeeklyUnrestAndRebellions,
} from './aiAndRebellionEngine';
import { buildNationDiplomacySummary } from './nationDiplomacySummary';
import {
  assimilateTerritoryDomain,
  batchAssimilateDomain,
  batchBorderMobilizationDomain,
  batchStabilityFestivalDomain,
  batchUpgradeBuildingDomain,
  cancelResearchDomain,
  enactReformDomain,
  executeArmyMoveDomain,
  executeBatchArmyMoveDomain,
  formEmpireDomain,
  resolveCrisisDomain,
  siegeBombardmentDomain,
  startMissionaryDomain,
  startResearchDomain,
  upgradeBuildingDomain,
} from './empireAndArmyActions';
import { TECH_TREE, TECH_TREE_1440 } from '../data/techAndArmyTiers';
import { isTerritoryCoastal } from './worldBuilder';
import { ActiveBattle, ActiveWar, DiplomaticRelation, Nation, Territory } from '../types/game';
import { resolveTerritoryFillColor } from '../map/mapPolygonRenderer';
import {
  formatProvinceMapLabel,
  getMapLabelThresholds,
} from '../map/mapLabelsAndUnitsRenderer';
import { RELIGIONS, CULTURES } from '../data/religionAndCultureData';
import {
  cleanNationName,
  cleanProvinceName,
  formatTroopsShort,
  normalizeFlagCode,
} from '../utils/formatters';
import { EMPIRES_1440_DEFS } from './scenario1440Builder';
import { useGameStore } from '../store/useGameStore';

test('formatGameDate formats 1440 and 2026 dates and optional hours accurately', () => {
  assert.equal(formatGameDate(0, 'EMPIRES_1440'), '1 Oca 1440');
  assert.equal(formatGameDate(10, 'EMPIRES_1440'), '11 Oca 1440');
  assert.equal(formatGameDate(0, 'WORLD_2026'), '1 Oca 2026');
  assert.equal(formatGameDate(0, 'EMPIRES_1440', 8), '1 Oca 1440 · 08:00');
  assert.equal(formatGameDate(2, 'EMPIRES_1440', 19), '3 Oca 1440 · 19:00');
});

test('getOrCreateRelation returns sorted nation pair defaults when relation missing', () => {
  const rel = getOrCreateRelation({}, 'TUR', 'GRC');
  assert.equal(rel.nationA, 'GRC');
  assert.equal(rel.nationB, 'TUR');
  assert.equal(rel.score, 0);
  assert.equal(rel.isAllied, false);
});

test('resolveWarParticipants calls offensive allies for attacker and defensive/vassals for defender', () => {
  const nations: Record<string, Nation> = {
    A: { id: 'A', isEliminated: false } as Nation,
    B: { id: 'B', isEliminated: false } as Nation,
    C: { id: 'C', isEliminated: false } as Nation,
    D: { id: 'D', isEliminated: false, vassalOf: 'B' } as Nation,
  };
  const relations: Record<string, DiplomaticRelation> = {
    'A--C': {
      nationA: 'A',
      nationB: 'C',
      score: 80,
      isAllied: true,
      allianceType: 'OFFENSIVE',
      hasNonAggression: true,
      hasTradeAgreement: true,
      hasEmbargo: false,
      hasMilitaryAccess: true,
      truceUntilTick: 0,
    },
  };

  const res = resolveWarParticipants('A', 'B', relations, nations);
  assert.deepEqual(res.attackers.sort(), ['A', 'C']);
  assert.deepEqual(res.defenders.sort(), ['B', 'D']);
});

test('isAtWar identifies active war between two nations regardless of side order', () => {
  const wars: ActiveWar[] = [
    {
      id: 'w1',
      name: 'Test War',
      attackerId: 'TUR',
      defenderId: 'GRC',
      attackers: ['TUR'],
      defenders: ['GRC'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];
  assert.ok(isAtWar(wars, 'TUR', 'GRC'));
  assert.ok(isAtWar(wars, 'GRC', 'TUR'));
  assert.equal(isAtWar(wars, 'TUR', 'FRA'), undefined);
});

test('executeArmyMoveDomain blocks unauthorized entry into neutral foreign province and returns pendingWarMove', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 1000,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      treasury: 500,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Edirne',
      ownerId: '792',
      garrison: 12000,
      units: { infantry: 8000, armor: 3000, airDrone: 1000 },
      neighbors: ['300'],
      centroid: [26, 41],
    } as unknown as Territory,
    '300': {
      id: '300',
      name: 'Konstantinopolis',
      ownerId: '300',
      garrison: 6000,
      units: { infantry: 5000, armor: 1000, airDrone: 0 },
      neighbors: ['792'],
      centroid: [28, 41],
    } as unknown as Territory,
  };

  // Without war or military access, moving into neutral territory must return pendingWarMove
  const blockedRes = executeArmyMoveDomain({
    fromId: '792',
    toId: '300',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
    moveRatio: 0.5,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
    forceDeclareWar: false,
  });
  assert.equal(blockedRes.movements, undefined);
  assert.deepEqual(blockedRes.pendingWarMove, {
    fromId: '792',
    toId: '300',
    targetNationId: '300',
  });

  // Confirming war declaration (forceDeclareWar = true) declares war and starts the march
  const confirmedRes = executeArmyMoveDomain({
    fromId: '792',
    toId: '300',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
    moveRatio: 0.5,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
    forceDeclareWar: true,
  });
  assert.equal(confirmedRes.wars?.length, 1);
  assert.ok((confirmedRes.movements?.length || 0) >= 1);
  const halfMove = confirmedRes.movements?.[0];
  const halfDeparture = confirmedRes.territories?.['792'];
  assert.equal(halfMove?.troops, 5750);
  assert.equal(halfDeparture?.garrison, 6250);
  assert.equal(
    halfMove?.units.infantry + halfMove?.units.armor + halfMove?.units.airDrone,
    5750
  );
  assert.equal(
    halfDeparture?.units.infantry +
      halfDeparture?.units.armor +
      halfDeparture?.units.airDrone,
    6250
  );

  const fullMoveRes = executeArmyMoveDomain({
    fromId: '792',
    toId: '300',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
    moveRatio: 1,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
    forceDeclareWar: true,
  });
  assert.equal(fullMoveRes.movements?.[0].troops, 11500);
  assert.equal(fullMoveRes.territories?.['792'].garrison, 500);
});

test('formEmpireDomain prevents instant day-1 Turan formation until province, tech, city, and gold requirements are met', () => {
  const playerNation: Nation = {
    id: '792',
    name: 'Osmanlı Cihan Devleti',
    treasury: 1400,
    stability: 80,
    unlockedTechs: [],
  } as unknown as Nation;

  const territories: Record<string, Territory> = {
    '792': { id: '792', name: 'Edirne', ownerId: '792' } as Territory,
  };

  const earlyAttempt = formEmpireDomain({
    empireId: 'emp_turan',
    playerNationId: '792',
    nations: { '792': playerNation },
    territories,
    newsEvents: [],
    tick: 1,
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(earlyAttempt.nations, undefined);
  assert.ok(earlyAttempt.toastMessage?.includes('25 eyalet gerekli'));
});

import {
  executeDiplomaticActionDomain,
  resolvePeaceDealDomain,
  resolveTacticalBattleOutcomeDomain,
} from './diplomacyAndWarActions';

test('military access grants the displayed relationship bonus once and cancellation is free', () => {
  const nations: Record<string, Nation> = {
    A: { id: 'A', name: 'Oyuncu', diplomacyPoints: 100 } as Nation,
    B: { id: 'B', name: 'Komşu', diplomacyPoints: 100 } as Nation,
  };
  const relation: DiplomaticRelation = {
    nationA: 'A', nationB: 'B', score: 10, isAllied: false,
    hasNonAggression: false, hasTradeAgreement: false, hasEmbargo: false,
    hasMilitaryAccess: false, truceUntilTick: 0,
  };
  const act = (
    currentNations: Record<string, Nation>,
    currentRelation: DiplomaticRelation
  ) => executeDiplomaticActionDomain({
    targetNationId: 'B', action: 'MILITARY_ACCESS', playerNationId: 'A',
    totalPlayerGarrison: 0, tick: 1, gameMode: 'EMPIRES_1440',
    nations: currentNations, territories: {}, relations: { A_B: currentRelation },
    wars: [], movements: [], newsEvents: [],
  });

  const granted = act(nations, relation);
  assert.equal(granted.relations?.A_B?.hasMilitaryAccess, true);
  assert.equal(granted.relations?.A_B?.score, 18);
  assert.equal(granted.nations?.A?.diplomacyPoints, 90);

  const cancelled = act(
    granted.nations ?? nations,
    granted.relations?.A_B ?? relation
  );
  assert.equal(cancelled.relations?.A_B?.hasMilitaryAccess, false);
  assert.equal(cancelled.relations?.A_B?.score, 18);
  assert.equal(cancelled.nations?.A?.diplomacyPoints, 90);
});

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

test('diplomacy blocks war above the AOH3 relation threshold and spends points on improvement', () => {
  const player = {
    id: 'P',
    name: 'Oyuncu',
    treasury: 1000,
    diplomacyPoints: 10,
    isEliminated: false,
  } as unknown as Nation;
  const target = {
    id: 'T',
    name: 'Hedef',
    treasury: 1000,
    isEliminated: false,
  } as unknown as Nation;
  const relations = {
    'P_T': {
      nationA: 'P',
      nationB: 'T',
      score: 0,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
  };
  const base = {
    targetNationId: 'T',
    playerNationId: 'P',
    totalPlayerGarrison: 0,
    tick: 1,
    gameMode: 'EMPIRES_1440' as const,
    nations: { P: player, T: target },
    territories: {},
    relations,
    wars: [],
    movements: [],
    newsEvents: [],
  };
  const blocked = executeDiplomaticActionDomain({
    ...base,
    action: 'DECLARE_WAR',
  });
  assert.match(blocked.toast || '', /-30/);

  const improved = executeDiplomaticActionDomain({
    ...base,
    action: 'IMPROVE',
  });
  assert.equal(improved.nations?.P?.diplomacyPoints, 5);
  assert.equal(improved.relations?.P_T?.score, 20);
});

test('resolvePeaceDealDomain blocks Day-1 zero-warscore peace exploits and allows peace once warscore is earned', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792', name: 'Osmanlı', treasury: 1000, aggressiveExpansion: 10,
      unlockedTechs: ['adm_2'],
    } as unknown as Nation,
    '300': { id: '300', name: 'Bizans', treasury: 800 } as Nation,
  };
  const territories: Record<string, Territory> = {
    '792': { id: '792', name: 'Edirne', ownerId: '792', coreOwnerId: '792' } as Territory,
    '300': { id: '300', name: 'İstanbul', ownerId: '300', coreOwnerId: '300' } as Territory,
  };
  const warZeroScore: ActiveWar = {
    id: 'w_zero',
    name: 'Osmanlı - Bizans Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // At 0% warscore and 0 occupied provinces, VASSALIZE, REPARATIONS, and ANNEX_OCCUPIED must be rejected
  const blockedVassal = resolvePeaceDealDomain({
    warId: 'w_zero',
    dealType: 'VASSALIZE',
    playerNationId: '792',
    tick: 2,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [warZeroScore],
    newsEvents: [],
  });
  assert.equal(blockedVassal.wars, undefined);
  assert.ok(blockedVassal.toast?.includes('50'));

  const blockedAnnex = resolvePeaceDealDomain({
    warId: 'w_zero',
    dealType: 'ANNEX_OCCUPIED',
    playerNationId: '792',
    tick: 2,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [warZeroScore],
    newsEvents: [],
  });
  assert.equal(blockedAnnex.wars, undefined);
  assert.ok(blockedAnnex.toast?.includes('+25'));

  // At +56% warscore, VASSALIZE succeeds
  const wonWar: ActiveWar = { ...warZeroScore, attackerWarScore: 56 };
  const acceptedVassal = resolvePeaceDealDomain({
    warId: 'w_zero',
    dealType: 'VASSALIZE',
    playerNationId: '792',
    tick: 10,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [wonWar],
    newsEvents: [],
  });
  assert.equal(acceptedVassal.wars?.length, 0);
  assert.equal(acceptedVassal.nations?.['300']?.vassalOf, '792');
});

test('resolveTacticalBattleOutcomeDomain returns surviving attacker troops to adjacent friendly territory on defeat', () => {
  const nations: Record<string, Nation> = {
    '792': { id: '792', name: 'Osmanlı', capitalTerritoryId: '792', researchPoints: 50 } as Nation,
    '300': { id: '300', name: 'Bizans', capitalTerritoryId: '300', researchPoints: 50 } as Nation,
  };
  const territories: Record<string, Territory> = {
    '792': {
      id: '792',
      name: 'Edirne',
      ownerId: '792',
      garrison: 5000,
      units: { infantry: 3500, armor: 1000, airDrone: 500 },
      neighbors: ['300'],
    } as unknown as Territory,
    '300': {
      id: '300',
      name: 'İstanbul',
      ownerId: '300',
      garrison: 18000,
      units: { infantry: 14000, armor: 3000, airDrone: 1000 },
      neighbors: ['792'],
    } as unknown as Territory,
  };

  const patch = resolveTacticalBattleOutcomeDomain({
    finalBattle: {
      battleId: 'b_test',
      territoryId: '300',
      territoryName: 'İstanbul',
      terrain: 'METROPOL',
      castleWallHp: 80,
      attackerNationId: '792',
      defenderNationId: '300',
      attackerTroops: 4000,
      defenderTroops: 14000,
      attackerMaxTroops: 8000,
      defenderMaxTroops: 18000,
      attackerMorale: 10,
      defenderMorale: 75,
      attackerUnits: { infantry: 3000, armor: 1000, airDrone: 0 },
      defenderUnits: { infantry: 11000, armor: 2000, airDrone: 1000 },
      attackerCommanderId: null,
      defenderCommanderId: null,
      selectedPlayerTactic: 'BALANCED_LINE',
      selectedAiTactic: 'IRON_PORCUPINE',
      round: 3,
      maxRounds: 5,
      combatLog: [],
      status: 'DEFEAT',
      outcome: {
        winnerId: '300',
        loserId: '792',
        attackerSurvivingTroops: 4000,
        defenderSurvivingTroops: 14000,
        attackerTotalLosses: 4000,
        defenderTotalLosses: 4000,
        territoryConquered: false,
        earnedResearch: 20,
        earnedInfluence: 15,
      },
    },
    playerNationId: '792',
    tick: 5,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    wars: [],
    newsEvents: [],
  });

  // Edirne ('792') had 5000 garrison + 4000 retreating survivors = 9000!
  assert.equal(patch.territories?.['792']?.garrison, 9000);
});

import { computeGameTick } from './tickEngine';
import { DEFAULT_GAME_SETTINGS } from './gameSettings';

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

  // Step 3: Advancing subsequent hourly combat rounds resolves the on-map battle and conquers the province
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
  assert.equal(curState.territories['300'].ownerId, '792', 'Superior army should conquer province on the map');
});

import { initializeWorld2026 } from './worldBuilder';
import { COUNTRY_PROVINCE_SEEDS } from './polygonSubdivider';
import { MUSIC_TRACKS } from './musicEngine';

test('expanded province seeds and 1440 scenario cover 100% of world landmasses with 14+ Ottoman sancaks and offline Mehter tracks', () => {
  assert.ok(
    COUNTRY_PROVINCE_SEEDS['792'].length >= 20,
    `Ottoman/Turkey (792) should have >= 20 historical sancak subdivisions, got ${COUNTRY_PROVINCE_SEEDS['792'].length}`
  );

  const world2026 = initializeWorld2026('STANDARD_2026');
  const world1440 = initializeWorld2026('EMPIRES_1440');

  assert.ok(
    world2026.features.length >= 280,
    `Expected >= 280 provinces in 2026 world, got ${world2026.features.length}`
  );
  assert.equal(
    world1440.features.length,
    world2026.features.length,
    '1440 scenario must preserve 100% of world landmass polygons with zero missing gaps'
  );
  assert.ok(
    world1440.nations['300'],
    '1440 scenario should include Byzantium & Morea (300)'
  );
  assert.ok(
    world1440.nations['031'],
    '1440 scenario should include Karakoyunlu & Akkoyunlu (031)'
  );

  const ottomanProvinces1440 = Object.values(world1440.territories).filter(
    (t) => t.ownerId === '792'
  );
  assert.ok(
    ottomanProvinces1440.length >= 19,
    `Expected Ottoman 1440 to start with >= 19 provinces, got ${ottomanProvinces1440.length}`
  );

  // Verify offline Ottoman Mehter track catalog
  const mehterTracks = MUSIC_TRACKS.filter((t) => t.isMehter);
  assert.ok(mehterTracks.length >= 5, 'Should include at least 5 offline Mehter tracks');
  assert.ok(
    MUSIC_TRACKS.some((t) => t.id === 'TR_MEHTER_CEDDIN' && t.isMehter),
    'Should include Ceddin Deden Mehter track'
  );
  assert.ok(
    MUSIC_TRACKS.some((t) => t.id === 'TR_MEHTER_HUCUM' && t.isMehter),
    'Should include Mehter Hücum Marşı track'
  );
  assert.ok(
    MUSIC_TRACKS.every((t) => t.bpm >= 80 && t.bpm <= 160 && t.title.length > 0),
    'All offline tracks must have valid BPM and title'
  );
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


test('siege bombardments cannot increase a small garrison and keep wall/force text truthful', () => {
  const territory = {
    id: 'fort',
    name: 'Kale',
    ownerId: 'B',
    coreOwnerId: 'B',
    population: 100,
    baseGdp: 50,
    resource: 'IRON',
    buildings: { factory: 0, barracks: 0, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0 },
    garrison: 300,
    units: { infantry: 240, armor: 50, airDrone: 10 },
    unrest: 0,
    isOccupied: false,
    centroid: [0, 0],
    neighbors: ['home'],
    castleWallHp: 20,
  } as unknown as Territory;
  const home = {
    ...territory,
    id: 'home',
    name: 'Yurt',
    ownerId: 'A',
    coreOwnerId: 'A',
    neighbors: ['fort'],
  } as Territory;
  const territories = { fort: territory, home };
  const nations = {
    A: { id: 'A', name: 'Oyuncu', treasury: 1000, clanInfluence: 100 },
  } as unknown as Record<string, Nation>;

  const artillery = siegeBombardmentDomain({
    territoryId: 'fort',
    method: 'ARTILLERY',
    territories,
    nations,
    playerNationId: 'A',
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(artillery.territories?.fort.garrison, 270);
  assert.equal(
    artillery.territories!.fort.units.infantry +
      artillery.territories!.fort.units.armor +
      artillery.territories!.fort.units.airDrone,
    270
  );
  assert.equal(artillery.territories?.fort.castleWallHp, 0);
  assert.match(artillery.toastMessage || '', /300 → 270 asker/);

  const raid = siegeBombardmentDomain({
    territoryId: 'fort',
    method: 'DRONE_RAID',
    territories,
    nations,
    playerNationId: 'A',
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(raid.territories?.fort.garrison, 246);
  assert.equal(
    raid.territories!.fort.units.infantry +
      raid.territories!.fort.units.armor +
      raid.territories!.fort.units.airDrone,
    246
  );
  assert.match(raid.toastMessage || '', /300 → 246 asker/);
});

test('tactical bombardment respects the 200-troop floor and Turan bonus is one-use', () => {
  const original = useGameStore.getState();
  const target = {
    id: 'target', name: 'Hedef', ownerId: 'B', coreOwnerId: 'B', isCapital: false,
    population: 100, baseGdp: 50, resource: 'IRON',
    buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
    garrison: 1000, units: { infantry: 800, armor: 200, airDrone: 0 },
    unrest: 0, isOccupied: false, centroid: [0, 0], neighbors: ['home'],
  } as unknown as Territory;
  const home = {
    ...target, id: 'home', name: 'Yurt', ownerId: 'A', coreOwnerId: 'A',
    garrison: 1000, units: { infantry: 1000, armor: 0, airDrone: 0 }, neighbors: ['target'],
  } as Territory;
  const battle: ActiveBattle = {
    id: 'battle', territoryId: 'target', fromTerritoryId: 'home',
    attackerId: 'A', defenderId: 'B', attackerTroops: 1000, attackerInitialTroops: 1000,
    attackerUnits: { infantry: 800, armor: 200, airDrone: 0 },
    defenderTroops: 1000, defenderInitialTroops: 1000,
    defenderUnits: { infantry: 800, armor: 200, airDrone: 0 }, round: 1,
  };
  const nations = {
    A: { id: 'A', name: 'Oyuncu', treasury: 1000, capitalTerritoryId: 'home' },
    B: { id: 'B', name: 'Rakip', treasury: 1000, capitalTerritoryId: 'target' },
  } as unknown as Record<string, Nation>;
  try {
    useGameStore.setState({
      ...original, playerNationId: 'A', battles: [battle], territories: { target, home },
      nations, wars: [],
    }, true);

    useGameStore.getState().applyTacticalOrder('target', 'BOMBARD');
    let current = useGameStore.getState().battles[0];
    assert.equal(current.defenderTroops, 850);
    assert.equal(current.defenderUnits.infantry + current.defenderUnits.armor + current.defenderUnits.airDrone, 850);

    useGameStore.setState({ ...useGameStore.getState(), battles: [{
      ...battle, defenderTroops: 199, defenderInitialTroops: 199,
      defenderUnits: { infantry: 199, armor: 0, airDrone: 0 },
    }] }, true);
    useGameStore.getState().applyTacticalOrder('target', 'BOMBARD');
    current = useGameStore.getState().battles[0];
    assert.equal(current.defenderTroops, 199);
    assert.equal(current.defenderUnits.infantry, 199);
    assert.match(useGameStore.getState().toastMessage || '', /200 asker tabanında/);

    useGameStore.setState({ ...useGameStore.getState(), battles: [battle] }, true);
    useGameStore.getState().applyTacticalOrder('target', 'TURAN');
    current = useGameStore.getState().battles[0];
    assert.equal(current.attackerTuranPowerBonus, 18);
    assert.equal(current.attackerTuranUsed, true);
    useGameStore.getState().applyTacticalOrder('target', 'TURAN');
    current = useGameStore.getState().battles[0];
    assert.equal(current.attackerTuranPowerBonus, 18);
    assert.match(useGameStore.getState().toastMessage || '', /zaten kullanıldı/);
  } finally {
    useGameStore.setState(original, true);
  }
});

test('manual retreat preserves troops, units, ownership, capitals and war score for either side', () => {
  const original = useGameStore.getState();
  const makeTerritory = (
    id: string, ownerId: string, neighbors: string[], garrison: number,
    units: { infantry: number; armor: number; airDrone: number }, isCapital = false
  ) => ({
    id, name: id, ownerId, coreOwnerId: ownerId, isCapital, population: 100,
    baseGdp: 50, resource: 'IRON',
    buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
    garrison, units, unrest: 0, isOccupied: false, centroid: [0, 0], neighbors,
  } as unknown as Territory);
  const battle: ActiveBattle = {
    id: 'battle', territoryId: 'target', fromTerritoryId: 'origin',
    attackerId: 'A', defenderId: 'B', attackerTroops: 600, attackerInitialTroops: 1000,
    attackerUnits: { infantry: 300, armor: 200, airDrone: 100 },
    defenderTroops: 800, defenderInitialTroops: 1000,
    defenderUnits: { infantry: 600, armor: 200, airDrone: 0 }, round: 2,
  };
  const war: ActiveWar = {
    id: 'war', name: 'Test Savaşı', attackerId: 'A', defenderId: 'B',
    attackers: ['A'], defenders: ['B'], startedTick: 0, attackerWarScore: 0,
    casualtiesAttacker: 0, casualtiesDefender: 0,
  };
  const nations = {
    A: { id: 'A', name: 'A', treasury: 1000, capitalTerritoryId: 'a-home' },
    B: { id: 'B', name: 'B', treasury: 1000, capitalTerritoryId: 'target' },
  } as unknown as Record<string, Nation>;
  try {
    const target = makeTerritory('target', 'B', ['origin', 'a-home'], 800, battle.defenderUnits, true);
    const origin = makeTerritory('origin', 'B', ['target'], 3000, { infantry: 3000, armor: 0, airDrone: 0 });
    const aHome = makeTerritory('a-home', 'A', ['target'], 100, { infantry: 100, armor: 0, airDrone: 0 });
    useGameStore.setState({
      ...original, playerNationId: 'A', battles: [battle], territories: { target, origin, 'a-home': aHome },
      nations, wars: [war], activeBattleOverviewTerritoryId: 'target',
    }, true);
    useGameStore.getState().applyTacticalOrder('target', 'RETREAT');
    let state = useGameStore.getState();
    assert.equal(state.battles.length, 0);
    assert.equal(state.territories.origin.garrison, 3000);
    assert.equal(state.territories['a-home'].garrison, 700);
    assert.deepEqual(state.territories['a-home'].units, { infantry: 400, armor: 200, airDrone: 100 });
    assert.equal(state.territories.target.ownerId, 'B');
    assert.equal(state.wars[0].attackerWarScore, -28);

    const defenderHome = makeTerritory('b-home', 'B', ['target'], 100, { infantry: 100, armor: 0, airDrone: 0 });
    const defenderTarget = makeTerritory('target', 'B', ['b-home'], 800, battle.defenderUnits, true);
    const attackerOrigin = makeTerritory('origin', 'A', ['target'], 3000, { infantry: 3000, armor: 0, airDrone: 0 });
    useGameStore.setState({
      ...original, playerNationId: 'B', battles: [battle],
      territories: { target: defenderTarget, 'b-home': defenderHome, origin: attackerOrigin },
      nations, wars: [war], activeBattleOverviewTerritoryId: 'target',
    }, true);
    useGameStore.getState().applyTacticalOrder('target', 'RETREAT');
    state = useGameStore.getState();
    assert.equal(state.battles.length, 0);
    assert.equal(state.territories['b-home'].garrison, 900);
    assert.deepEqual(state.territories['b-home'].units, { infantry: 700, armor: 200, airDrone: 0 });
    assert.equal(state.territories.target.ownerId, 'A');
    assert.equal(state.territories.target.garrison, 600);
    assert.equal(state.territories.target.isCapital, false);
    assert.equal(state.territories['b-home'].isCapital, true);
    assert.equal(state.nations.B.capitalTerritoryId, 'b-home');
    assert.equal(state.wars[0].attackerWarScore, 28);
  } finally {
    useGameStore.setState(original, true);
  }
});

test('tactical siege bombardment updates both wall-integrity fields', () => {
  const original = useGameStore.getState();
  const territory = {
    id: 'target', name: 'Hisar', ownerId: 'B', coreOwnerId: 'B', population: 100,
    baseGdp: 50, resource: 'IRON',
    buildings: { factory: 0, barracks: 0, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0 },
    garrison: 100, units: { infantry: 100, armor: 0, airDrone: 0 }, unrest: 0,
    isOccupied: false, centroid: [0, 0], neighbors: ['home'], castleWallHp: 50,
    siege: { territoryId: 'target', attackerId: 'A', defenderId: 'B', attackerTroops: 1000,
      attackerUnits: { infantry: 1000, armor: 0, airDrone: 0 }, progress: 10, wallIntegrity: 50, startedTick: 1 },
  } as unknown as Territory;
  try {
    useGameStore.setState({
      ...original, playerNationId: 'A', battles: [], territories: { target: territory },
    }, true);
    useGameStore.getState().applyTacticalOrder('target', 'BOMBARD');
    const updated = useGameStore.getState().territories.target;
    assert.equal(updated.castleWallHp, 30);
    assert.equal(updated.siege?.wallIntegrity, 30);
  } finally {
    useGameStore.setState(original, true);
  }
});


test('Turan combat bonus changes casualties for either side and is consumed after one round', () => {
  const nations = {
    A: {
      id: 'A', name: 'Oyuncu', capitalTerritoryId: 'home', treasury: 1000,
      manpower: 50000, stability: 80, inflation: 2, researchPoints: 0, taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0, unlockedTechs: [], enactedReforms: [],
      recruitedGeneralIds: [], activeGeneralId: null, isEliminated: false,
    },
    B: {
      id: 'B', name: 'Rakip', capitalTerritoryId: 'target', treasury: 1000,
      manpower: 50000, stability: 80, inflation: 2, researchPoints: 0, taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0, unlockedTechs: [], enactedReforms: [],
      recruitedGeneralIds: [], activeGeneralId: null, isEliminated: false,
    },
  } as unknown as Record<string, Nation>;
  const territories = {
    home: {
      id: 'home', name: 'Yurt', ownerId: 'A', coreOwnerId: 'A', garrison: 100000,
      units: { infantry: 80000, armor: 20000, airDrone: 0 },
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['target'], centroid: [0, 0], population: 100, baseGdp: 100,
      resource: 'IRON', unrest: 0, isOccupied: false,
    },
    target: {
      id: 'target', name: 'Hedef', ownerId: 'B', coreOwnerId: 'B', garrison: 100000,
      units: { infantry: 80000, armor: 20000, airDrone: 0 },
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['home'], centroid: [0, 0], population: 100, baseGdp: 100,
      resource: 'IRON', unrest: 0, isOccupied: false,
    },
  } as unknown as Record<string, Territory>;
  const battle: ActiveBattle = {
    id: 'battle', territoryId: 'target', fromTerritoryId: 'home', attackerId: 'A',
    defenderId: 'B', attackerTroops: 100000, attackerInitialTroops: 100000,
    attackerUnits: { infantry: 80000, armor: 20000, airDrone: 0 },
    defenderTroops: 100000, defenderInitialTroops: 100000,
    defenderUnits: { infantry: 80000, armor: 20000, airDrone: 0 },
    attackerMorale: 100, defenderMorale: 100, round: 0,
  };
  const runOneRound = (activeBattle: ActiveBattle) => computeGameTick({
    tick: 1, hour: 8, hoursStep: 2, speed: 1, gameMode: 'EMPIRES_1440',
    playerNationId: 'A', nations, territories, relations: {}, wars: [],
    battles: [activeBattle], movements: [], newsEvents: [],
    settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
  }).battles[0];

  const baseline = runOneRound(battle);
  const attackerTuran = runOneRound({
    ...battle, attackerTuranPowerBonus: 18, attackerTuranUsed: true,
  });
  assert.ok(attackerTuran.defenderTroops < baseline.defenderTroops);
  assert.ok(attackerTuran.attackerTroops > baseline.attackerTroops);
  assert.equal(attackerTuran.attackerTuranPowerBonus, 0);
  assert.equal(attackerTuran.attackerTuranUsed, true);

  const defenderTuran = runOneRound({
    ...battle, defenderTuranPowerBonus: 18, defenderTuranUsed: true,
  });
  assert.ok(defenderTuran.attackerTroops < baseline.attackerTroops);
  assert.ok(defenderTuran.defenderTroops > baseline.defenderTroops);
  assert.equal(defenderTuran.defenderTuranPowerBonus, 0);
  assert.equal(defenderTuran.defenderTuranUsed, true);
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


test('war score is signed from the viewing nation side', () => {
  const war: ActiveWar = {
    id: 'perspective', name: 'Test Savaşı', attackerId: 'A', defenderId: 'B',
    attackers: ['A', 'ALLY'], defenders: ['B', 'ALLY_2'], startedTick: 0,
    attackerWarScore: 37, casualtiesAttacker: 0, casualtiesDefender: 0,
  };
  assert.equal(getWarScoreForNation(war, 'A'), 37);
  assert.equal(getWarScoreForNation(war, 'ALLY'), 37);
  assert.equal(getWarScoreForNation(war, 'B'), -37);
  assert.equal(getWarScoreForNation(war, 'ALLY_2'), -37);
  assert.equal(getWarScoreForNation(war, 'NEUTRAL'), null);
});


test('ADM_1 reduces positive non-core weekly unrest drift and leaves relief unchanged', () => {
  const nation = (id: string, unlockedTechs: string[]) => ({
    id,
    name: id,
    unlockedTechs,
    taxRate: 30,
    budget: { welfare: 20 },
    isEliminated: false,
  } as unknown as Nation);
  const territory = (id: string, ownerId: string) => ({
    id,
    name: id,
    ownerId,
    coreOwnerId: 'ORIGINAL',
    isOccupied: true,
    garrison: 0,
    unrest: 20,
    buildings: { supplyDepot: 0 },
  } as unknown as Territory);

  const result = evaluateWeeklyUnrestAndRebellions(
    { A: territory('A', 'A'), B: territory('B', 'B') },
    { A: nation('A', []), B: nation('B', ['adm_1']) }
  );
  assert.equal(result.updatedTerritories.A.unrest, 24);
  assert.equal(result.updatedTerritories.B.unrest, 23);
  assert.equal(adjustOccupiedUnrestDrift({ unlockedTechs: ['adm_1'] } as Nation, 4.2), 2.94);
  assert.equal(adjustOccupiedUnrestDrift({ unlockedTechs: ['adm_1'] } as Nation, -2), -2);
});

test('ADM_2 reduces positive aggressive-expansion gains without changing reductions', () => {
  const nation = {
    id: 'A',
    name: 'A',
    aggressiveExpansion: 20,
    treasury: 100,
    manpower: 100,
    stability: 50,
    inflation: 2,
    researchPoints: 0,
    diplomacyPoints: 0,
    unlockedTechs: ['adm_2'],
    enactedReforms: [],
  } as unknown as Nation;
  const result = resolveCrisisDomain({
    option: {
      id: 'ae-gain',
      label: 'Karar',
      effectSummary: 'AE artışı',
      effects: { aeDelta: 20 },
    },
    nations: { A: nation },
    territories: {},
    playerNationId: 'A',
    activeCrisis: null,
    tick: 0,
    gameMode: 'STANDARD_2026',
    newsEvents: [],
  });
  assert.equal(result.nations?.A.aggressiveExpansion, 35);
  assert.equal(adjustAggressiveExpansionGain(nation, 20), 15);
  assert.equal(adjustAggressiveExpansionGain(nation, -10), -10);
});


test('ADM_2 reduces the aggressive-expansion gain after a successful conquest', () => {
  const battle = {
    battleId: 'adm2-victory',
    territoryId: 'target',
    territoryName: 'Hedef',
    terrain: 'OVA',
    castleWallHp: 100,
    attackerNationId: 'A',
    defenderNationId: 'B',
    attackerTroops: 1000,
    defenderTroops: 1000,
    attackerMaxTroops: 1000,
    defenderMaxTroops: 1000,
    attackerMorale: 100,
    defenderMorale: 0,
    attackerUnits: { infantry: 1000, armor: 0, airDrone: 0 },
    defenderUnits: { infantry: 1000, armor: 0, airDrone: 0 },
    attackerCommanderId: null,
    defenderCommanderId: null,
    selectedPlayerTactic: 'BALANCED_LINE',
    selectedAiTactic: 'BALANCED_LINE',
    round: 5,
    maxRounds: 5,
    combatLog: [],
    status: 'VICTORY',
    outcome: {
      winnerId: 'A',
      loserId: 'B',
      attackerSurvivingTroops: 1000,
      defenderSurvivingTroops: 0,
      attackerTotalLosses: 0,
      defenderTotalLosses: 1000,
      territoryConquered: true,
      earnedResearch: 0,
      earnedInfluence: 0,
    },
  } as unknown as Parameters<typeof resolveTacticalBattleOutcomeDomain>[0]['finalBattle'];
  const nations: Record<string, Nation> = {
    A: {
      id: 'A', name: 'A', capitalTerritoryId: 'home', aggressiveExpansion: 10,
      unlockedTechs: ['adm_2'], researchPoints: 0, clanInfluence: 120,
    } as unknown as Nation,
    B: { id: 'B', name: 'B', capitalTerritoryId: 'target' } as Nation,
  };
  const territories: Record<string, Territory> = {
    home: { id: 'home', name: 'Yurt', ownerId: 'A', coreOwnerId: 'A', garrison: 1000 } as unknown as Territory,
    target: { id: 'target', name: 'Hedef', ownerId: 'B', coreOwnerId: 'B', garrison: 1000, unrest: 0, neighbors: ['home'] } as unknown as Territory,
  };

  const result = resolveTacticalBattleOutcomeDomain({
    finalBattle: battle,
    playerNationId: 'A',
    tick: 1,
    gameMode: 'STANDARD_2026',
    nations,
    territories,
    wars: [],
    newsEvents: [],
  });
  assert.equal(result.nations?.A.aggressiveExpansion, 14.5);
});

test('imperial diplomacy reform reduces AE once and improves each living foreign relation once', () => {
  const nations: Record<string, Nation> = {
    A: {
      id: 'A', name: 'A', treasury: 2000, researchPoints: 200,
      aggressiveExpansion: 30, stability: 50, enactedReforms: [], isEliminated: false,
    } as unknown as Nation,
    B: { id: 'B', name: 'B', isEliminated: false } as Nation,
    C: { id: 'C', name: 'C', isEliminated: false } as Nation,
    D: { id: 'D', name: 'D', isEliminated: true } as Nation,
  };
  const relations = {
    A_B: { nationA: 'A', nationB: 'B', score: 20 } as DiplomaticRelation,
    A_C: { nationA: 'A', nationB: 'C', score: 95 } as DiplomaticRelation,
  };

  const result = enactReformDomain({
    reformId: 'ref_imperial_diplomacy',
    nations,
    relations,
    playerNationId: 'A',
    gameMode: 'STANDARD_2026',
  });
  assert.equal(result.nations?.A.aggressiveExpansion, 15);
  assert.equal(result.nations?.A.treasury, 900);
  assert.equal(result.nations?.A.researchPoints, 85);
  assert.equal(result.relations?.A_B.score, 35);
  assert.equal(result.relations?.A_C.score, 100);
  assert.equal(result.relations?.A_D, undefined);

  const repeated = enactReformDomain({
    reformId: 'ref_imperial_diplomacy',
    nations: result.nations!,
    relations: result.relations!,
    playerNationId: 'A',
    gameMode: 'STANDARD_2026',
  });
  assert.equal(repeated.nations, undefined);
  assert.equal(repeated.relations, undefined);
});

test('map label density selects distinct mobile and desktop zoom thresholds', () => {
  const compactMobile = getMapLabelThresholds('COMPACT', true);
  const balancedMobile = getMapLabelThresholds('BALANCED', true);
  const detailedMobile = getMapLabelThresholds('DETAILED', true);
  const compactDesktop = getMapLabelThresholds('COMPACT', false);
  const detailedDesktop = getMapLabelThresholds('DETAILED', false);

  assert.ok(compactMobile.capitalNameMinZoom > balancedMobile.capitalNameMinZoom);
  assert.ok(balancedMobile.capitalNameMinZoom > detailedMobile.capitalNameMinZoom);
  assert.ok(compactMobile.provinceNameMinZoom > balancedMobile.provinceNameMinZoom);
  assert.ok(balancedMobile.provinceNameMinZoom > detailedMobile.provinceNameMinZoom);
  assert.ok(compactDesktop.provinceNameMinZoom > detailedDesktop.provinceNameMinZoom);
});

test('1440 scenario balances historical superpowers and localizes Northern Cyprus and Mosul cleanly', () => {
  const world1440 = initializeWorld2026('EMPIRES_1440');
  const world2026 = initializeWorld2026('STANDARD_2026');

  const ranksByArmy = Object.values(world1440.nations)
    .map((n) => {
      const provs = Object.values(world1440.territories).filter(
        (t) => t.ownerId === n.id
      );
      return {
        id: n.id,
        name: n.name,
        army: provs.reduce((sum, t) => sum + t.garrison, 0),
        gdp: provs.reduce((sum, t) => sum + t.baseGdp, 0),
      };
    })
    .sort((a, b) => b.army - a.army);

  assert.equal(ranksByArmy[0].id, '156', 'Ming Dynasty should lead 1440 starting army');
  assert.equal(ranksByArmy[1].id, '792', 'Ottoman Empire should rank #2 in 1440 starting army');
  const mali = ranksByArmy.find((r) => r.id === '566');
  const inca = ranksByArmy.find((r) => r.id === '076');
  const kilwa = ranksByArmy.find((r) => r.id === '710');
  assert.ok(mali && mali.army < ranksByArmy[1].army, 'Mali army must remain below Ottoman army');
  assert.ok(inca && inca.army < ranksByArmy[1].army, 'Inca army must remain below Ottoman army');
  assert.ok(kilwa && kilwa.army < ranksByArmy[1].army, 'Kilwa army must remain below Ottoman army');

  const hasEnglishNCyprus = Object.values(world2026.territories).some(
    (t) => t.name === 'N. Cyprus'
  );
  const hasArabicTypo = Object.values(world1440.territories).some((t) =>
    /ربيعة/.test(t.name)
  );
  assert.equal(hasEnglishNCyprus, false, 'N. Cyprus should be localized to Turkish');
  assert.equal(hasArabicTypo, false, 'Mosul province name must not contain Arabic script typo');
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

test('buildNationDiplomacySummary categorizes all treaties, wars, truces, vassals, embargoes and standings for any nation', () => {
  const mkNation = (id: string, name: string, vassalOf?: string): Nation =>
    ({
      id,
      name,
      flagCode: id,
      color: '#336699',
      capitalTerritoryId: `${id}_CAP`,
      ideology: 'MONARCHY',
      treasury: 1000,
      manpower: 20000,
      stability: 80,
      inflation: 1,
      researchPoints: 50,
      taxRate: 25,
      budget: { military: 35, economy: 30, research: 15, welfare: 20 },
      aggressiveExpansion: 10,
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
      vassalOf,
    }) as unknown as Nation;

  const nations: Record<string, Nation> = {
    OSM: mkNation('OSM', 'Osmanlı'),
    VEN: mkNation('VEN', 'Venedik'),
    FRA: mkNation('FRA', 'Fransa'),
    POL: mkNation('POL', 'Lehistan'),
    HUN: mkNation('HUN', 'Macaristan'),
    WAL: mkNation('WAL', 'Eflak', 'OSM'),
    MAM: mkNation('MAM', 'Memlük'),
  };

  const territories: Record<string, Territory> = {};
  for (const id of Object.keys(nations)) {
    territories[`${id}_CAP`] = {
      id: `${id}_CAP`,
      name: `${id} Başkent`,
      ownerId: id,
      coreOwnerId: id,
      garrison: 10000,
      neighbors: [],
      centroid: [0, 0],
    } as unknown as Territory;
  }

  const mkRel = (
    a: string,
    b: string,
    partial: Partial<DiplomaticRelation>
  ): DiplomaticRelation => {
    const [nationA, nationB] = a < b ? [a, b] : [b, a];
    return {
      nationA,
      nationB,
      score: 0,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
      ...partial,
    };
  };

  const relations: Record<string, DiplomaticRelation> = {
    FRA_OSM: mkRel('OSM', 'FRA', {
      score: 65,
      isAllied: true,
      allianceType: 'OFFENSIVE',
      hasTradeAgreement: true,
      hasMilitaryAccess: true,
    }),
    OSM_POL: mkRel('OSM', 'POL', {
      score: 40,
      isAllied: true,
      allianceType: 'DEFENSIVE',
      hasNonAggression: true,
    }),
    HUN_OSM: mkRel('OSM', 'HUN', {
      score: -45,
      truceUntilTick: 85,
      hasEmbargo: true,
      embargoingNationIds: ['OSM'],
    }),
    MAM_OSM: mkRel('OSM', 'MAM', {
      score: -60,
      hasEmbargo: true,
      embargoingNationIds: ['MAM'],
    }),
    OSM_VEN: mkRel('OSM', 'VEN', { score: -80 }),
  };

  const wars: ActiveWar[] = [
    {
      id: 'w1',
      name: 'Osmanlı-Venedik Savaşı',
      attackerId: 'OSM',
      defenderId: 'VEN',
      attackers: ['OSM'],
      defenders: ['VEN'],
      startedTick: 10,
      attackerWarScore: 32,
      casualtiesAttacker: 1000,
      casualtiesDefender: 3000,
    },
  ];

  const osmSummary = buildNationDiplomacySummary({
    targetNationId: 'OSM',
    nations,
    territories,
    relations,
    wars,
    movements: [],
    tick: 50,
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(osmSummary);
  assert.equal(osmSummary.activeWars.length, 1);
  assert.equal(osmSummary.activeWars[0].nation.id, 'VEN');
  assert.equal(osmSummary.activeWars[0].warScore, 32);
  assert.deepEqual(osmSummary.offensiveAllies.map((e) => e.nation.id), ['FRA']);
  assert.deepEqual(osmSummary.defensivePacts.map((e) => e.nation.id), ['POL']);
  assert.deepEqual(osmSummary.tradePartners.map((e) => e.nation.id), ['FRA']);
  assert.deepEqual(osmSummary.nonAggressionPacts.map((e) => e.nation.id), ['POL']);
  assert.deepEqual(osmSummary.militaryAccess.map((e) => e.nation.id), ['FRA']);
  assert.deepEqual(osmSummary.vassals.map((e) => e.nation.id), ['WAL']);
  assert.equal(osmSummary.activeTruces.length, 1);
  assert.equal(osmSummary.activeTruces[0].truceDaysRemaining, 35);
  assert.equal(
    osmSummary.embargoes.find((e) => e.nation.id === 'HUN')?.embargoDirection,
    'OUTGOING'
  );
  assert.equal(
    osmSummary.embargoes.find((e) => e.nation.id === 'MAM')?.embargoDirection,
    'INCOMING'
  );
  assert.ok(osmSummary.friendlyNations.some((e) => e.nation.id === 'FRA'));
  assert.ok(osmSummary.hostileNations.some((e) => e.nation.id === 'MAM'));

  // Cross-inspecting Venice flips war score perspective to -32 and inspecting Wallachia reveals Overlord
  const venSummary = buildNationDiplomacySummary({
    targetNationId: 'VEN',
    nations,
    territories,
    relations,
    wars,
    movements: [],
    tick: 50,
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(venSummary?.activeWars[0].warScore, -32);

  const walSummary = buildNationDiplomacySummary({
    targetNationId: 'WAL',
    nations,
    territories,
    relations,
    wars,
    movements: [],
    tick: 50,
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(walSummary?.overlord?.id, 'OSM');
});

test('formatProvinceMapLabel displays complete untruncated city names when zoomed in or selected and strips legacy title suffixes', () => {
  const longName = 'Kostantiniyye & Boğaz Sancağı';
  const zoomedDesktop = formatProvinceMapLabel(longName, true, false, 3.4, false);
  assert.equal(zoomedDesktop.isFull, true);
  assert.equal(zoomedDesktop.lines.join(' '), '★ Kostantiniyye & Boğaz');
  assert.equal(zoomedDesktop.lines.join(' ').includes('…'), false);

  const zoomedMobile = formatProvinceMapLabel('Çanakkale & Gelibolu Boğazı', false, false, 3.2, true);
  assert.equal(zoomedMobile.isFull, true);
  assert.equal(zoomedMobile.lines.join(' '), 'Çanakkale & Gelibolu');

  const selectedOverview = formatProvinceMapLabel('Diyarbakır & Yukarı Dicle', false, true, 1.5, true);
  assert.equal(selectedOverview.isFull, true);
  assert.equal(selectedOverview.lines.join(' '), 'Diyarbakır & Yukarı Dicle');
});

test('expanded missing cities exist with valid centroids, connectivity, and zero Arabic script typos', () => {
  const world2026 = initializeWorld2026('STANDARD_2026');
  const world1440 = initializeWorld2026('EMPIRES_1440');

  const expectedNewProvinces = [
    '792_GLB', '792_MUG', '792_SAM', '792_GZP', '792_MLT', '792_VAN',
    '300_IOA', '642_TSR', '642_IAS', '364_KER', '276_STR', '250_TLS',
    '380_FLR', '380_PMO', '724_VLC', '724_GRX', '616_POZ',
    '643_VOG', '643_IKT', '643_VVO', '840_NYC', '840_MIA', '840_SEA',
    '156_SIA', '156_LXA', '356_AMD', '356_PAT',
  ];

  for (const id of expectedNewProvinces) {
    const t26 = world2026.territories[id];
    const t40 = world1440.territories[id];
    assert.ok(t26, `2026 scenario should include new city ${id}`);
    assert.ok(t40, `1440 scenario should include new city ${id}`);
    assert.ok(t26.neighbors.length >= 1, `${id} must connect to at least 1 neighbor`);
    assert.ok(
      Number.isFinite(t26.centroid[0]) && Number.isFinite(t26.centroid[1]),
      `${id} must have finite centroid`
    );
  }

  for (const world of [world2026, world1440]) {
    for (const t of Object.values(world.territories)) {
      assert.equal(
        /[\u0600-\u06FF]/.test(t.name),
        false,
        `Province ${t.id} (${t.name}) must not contain Arabic script characters`
      );
    }
  }
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

test('gameClockConfig enforces realistic time pacing even at 5x speed', async () => {
  const { getClockSpeedProfile, getRealSecondsPerGameYear } = await import('./gameSettings');

  const p1 = getClockSpeedProfile(1);
  const p5 = getClockSpeedProfile(5);
  assert.ok(p1.intervalMs > p5.intervalMs, '5x must tick faster than 1x');
  assert.ok(p5.hoursStep <= 4, '5x should advance at most 4 in-game hours per tick');

  const secPerYear5x = getRealSecondsPerGameYear(5);
  assert.ok(
    secPerYear5x >= 240,
    `Even at 5x, a game year must never rush by in 10-15s (got ${secPerYear5x.toFixed(1)}s)`
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
  const mid1 = computeInterpolatedProgressMap(tweens, [baseMv], 5, 1135);
  assert.ok(
    mid1.mv_smooth_1 > 0 && mid1.mv_smooth_1 < 12,
    `Mid-frame progress should smoothly interpolate between 0 and 12 (got ${mid1.mv_smooth_1})`
  );

  const nextMv = { ...baseMv, progress: 24 };
  syncMovementTweens(tweens, [nextMv], 5, 1270);
  const quarter = computeInterpolatedProgressMap(tweens, [nextMv], 5, 1337.5);
  const threeQuarter = computeInterpolatedProgressMap(tweens, [nextMv], 5, 1472.5);
  assert.ok(
    quarter.mv_smooth_1 > 12 &&
      threeQuarter.mv_smooth_1 > quarter.mv_smooth_1 &&
      threeQuarter.mv_smooth_1 < 24,
    'Sub-tick progress must monotonically advance across 60 FPS animation frames'
  );

  const paused = computeInterpolatedProgressMap(tweens, [nextMv], 0, 1300);
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
  assert.ok(report.includes('Floda Strateji Oyunu'));
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

function mkFaz3Nation(id: string, overrides: Partial<Nation> = {}): Nation {
  return {
    id,
    name: id,
    flagCode: id,
    color: '#B91C1C',
    capitalTerritoryId: `${id}_0`,
    ideology: 'MONARCHY',
    treasury: 1000,
    manpower: 10000,
    stability: 80,
    inflation: 2,
    researchPoints: 50,
    taxRate: 25,
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

function mkFaz3Territory(id: string, overrides: Partial<Territory> = {}): Territory {
  return {
    id,
    name: id,
    ownerId: 'TUR',
    coreOwnerId: overrides.ownerId || 'TUR',
    population: 100,
    baseGdp: 30,
    resource: 'TAHIL',
    buildings: {
      factory: 1,
      barracks: 1,
      fortress: 0,
      university: 0,
      tradeHub: 0,
      supplyDepot: 0,
    },
    garrison: 3000,
    units: {
      infantry: overrides.garrison ?? 3000,
      armor: 0,
      airDrone: 0,
    },
    unrest: 0,
    isOccupied: false,
    centroid: [30, 39],
    neighbors: [],
    ...overrides,
  };
}

test('polygon adjacency builds connected sub-provinces and spherical A* finds shortest direct path', async () => {
  const { buildPolygonAdjacencyNeighbors } = await import('./worldBuilder');
  const { findArmyRouteAStar } = await import('./pathfindingEngine');

  const makeSquareFeature = (id: string, x0: number, y0: number, x1: number, y1: number) => ({
    type: 'Feature' as const,
    id,
    properties: { name: id },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
    },
  });

  const feats = [
    makeSquareFeature('A', 28, 39, 29, 40),
    makeSquareFeature('B', 29, 39, 30, 40),
    makeSquareFeature('C', 30, 39, 31, 40),
    makeSquareFeature('D', 31, 39, 32, 40),
    makeSquareFeature('N', 28.5, 42, 31.5, 44), // distant northern province NOT touching A..D
  ];

  const nations: Record<string, Nation> = {
    TUR: mkFaz3Nation('TUR', { name: 'Osmanlı', capitalTerritoryId: 'A' }),
  };
  const territories: Record<string, Territory> = {
    A: mkFaz3Territory('A', { ownerId: 'TUR', centroid: [28.5, 39.5], garrison: 10000 }),
    B: mkFaz3Territory('B', { ownerId: 'TUR', centroid: [29.5, 39.5], garrison: 3000 }),
    C: mkFaz3Territory('C', { ownerId: 'TUR', centroid: [30.5, 39.5], garrison: 3000 }),
    D: mkFaz3Territory('D', { ownerId: 'TUR', centroid: [31.5, 39.5], garrison: 3000 }),
    N: mkFaz3Territory('N', { ownerId: 'TUR', centroid: [30.0, 43.0], garrison: 3000 }),
  };

  buildPolygonAdjacencyNeighbors(feats, territories, (a, b) => {
    if (!territories[a].neighbors.includes(b)) territories[a].neighbors.push(b);
    if (!territories[b].neighbors.includes(a)) territories[b].neighbors.push(a);
  });

  assert.ok(territories.A.neighbors.includes('B') && territories.B.neighbors.includes('C') && territories.C.neighbors.includes('D'));
  assert.equal(territories.A.neighbors.includes('N'), false);

  // Add optional distant northern shortcut to confirm spherical A* still chooses shorter direct corridor A-B-C-D
  territories.A.neighbors.push('N');
  territories.N.neighbors.push('A', 'D');
  territories.D.neighbors.push('N');

  const res = findArmyRouteAStar({
    fromId: 'A',
    toId: 'D',
    moverNationId: 'TUR',
    territories,
    nations,
    relations: {},
    wars: [],
  });

  assert.equal(res.reachable, true);
  assert.deepEqual(res.hops, ['B', 'C', 'D'], 'A* must take the shorter A-B-C-D southern corridor over the distant northern N detour');
});

test('mergeNeighborArmiesDomain and disbandArmyDomain respect safety reserves, battles, sieges, and manpower refund', async () => {
  const { mergeNeighborArmiesDomain, disbandArmyDomain } = await import('./empireAndArmyActions');

  const nations: Record<string, Nation> = {
    TUR: mkFaz3Nation('TUR', { name: 'Osmanlı', manpower: 5000, capitalTerritoryId: 'P1' }),
    BYZ: mkFaz3Nation('BYZ', { name: 'Bizans', capitalTerritoryId: 'E1' }),
  };
  const territories: Record<string, Territory> = {
    P1: mkFaz3Territory('P1', { ownerId: 'TUR', isCapital: true, neighbors: ['P2', 'P3', 'P4'], garrison: 4000 }),
    P2: mkFaz3Territory('P2', { ownerId: 'TUR', neighbors: ['P1'], garrison: 3000 }), // Peaceful neighbor -> sends 2500 (leaves 500)
    P3: mkFaz3Territory('P3', { ownerId: 'TUR', neighbors: ['P1'], garrison: 3000, siege: { territoryId: 'P3', attackerId: 'BYZ', defenderId: 'TUR', attackerTroops: 2000, progress: 25, wallIntegrity: 80, startedTick: 1 } }), // Under siege -> skipped!
    P4: mkFaz3Territory('P4', { ownerId: 'TUR', neighbors: ['P1', 'E1'], garrison: 2500 }), // Borders war enemy -> keeps 1000, sends 1500
    E1: mkFaz3Territory('E1', { ownerId: 'BYZ', neighbors: ['P4'], garrison: 1500 }),
  };
  const wars: ActiveWar[] = [
    {
      id: 'war_1',
      name: 'Osmanlı - Bizans Savaşı',
      attackerId: 'TUR',
      defenderId: 'BYZ',
      attackers: ['TUR'],
      defenders: ['BYZ'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const merged = mergeNeighborArmiesDomain({
    targetTerritoryId: 'P1',
    territories,
    wars,
    battles: [],
    movements: [],
    playerNationId: 'TUR',
    speed: 0,
  });

  assert.equal(merged.movements?.length, 2, 'Should gather safe troops from P2 and P4 while skipping besieged P3');
  assert.equal(merged.territories?.P2.garrison, 500);
  assert.equal(merged.territories?.P3.garrison, 3000);
  assert.equal(merged.territories?.P4.garrison, 1000);

  // Disband blocked during active siege on P3
  const blockedSiege = disbandArmyDomain({
    territoryId: 'P3',
    ratio: 0.5,
    territories,
    nations,
    battles: [],
    playerNationId: 'TUR',
  });
  assert.equal(blockedSiege.territories, undefined);

  // Disband blocked during active battle on P1
  const activeBattleMock: ActiveBattle = {
    id: 'btl_1',
    territoryId: 'P1',
    attackerId: 'BYZ',
    defenderId: 'TUR',
    attackerTroops: 2000,
    attackerUnits: { infantry: 2000, armor: 0, airDrone: 0 },
    defenderTroops: 4000,
    defenderUnits: { infantry: 4000, armor: 0, airDrone: 0 },
    round: 1,
  };
  const blockedBattle = disbandArmyDomain({
    territoryId: 'P1',
    ratio: 1,
    territories,
    nations,
    battles: [activeBattleMock],
    playerNationId: 'TUR',
  });
  assert.equal(blockedBattle.territories, undefined);

  // Disband 100% cleanly on peaceful P2 and verify 75% manpower refund
  const disbandedFull = disbandArmyDomain({
    territoryId: 'P2',
    ratio: 1,
    territories,
    nations,
    battles: [],
    playerNationId: 'TUR',
  });
  assert.equal(disbandedFull.territories?.P2.garrison, 0);
  assert.equal(disbandedFull.nations?.TUR.manpower, 5000 + Math.round(3000 * 0.75));
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

import {
  getSpecialtyTerritoryEligibility,
  hireMercenaryDomain,
  investSpecialtyProductionDomain,
  SPECIALTY_PRODUCTION_OPTIONS,
} from './empireAndArmyActions';
import { ARMY_GENERATIONS_1440, ARMY_GENERATIONS_2026 } from '../data/techAndArmyTiers';
import {
  applyConquestDiplomaticPenalty,
  calculateProvincePeaceScoreCost,
  calculateWarPeaceBudget,
  callAllyToWarDomain,
  resolvePeaceConferenceDomain,
} from './diplomacyAndWarActions';

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

  // 1d. Mercenary hiring consumes gold but 0 manpower
  const mercRes = hireMercenaryDomain({
    territoryId: '792_edi',
    companyId: 'merc_vanguard',
    territories: investRes.territories!,
    nations: investRes.nations!,
    playerNationId: '792',
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(mercRes.territories, 'Mercenary hiring should succeed');
  assert.equal(mercRes.nations!['792'].manpower, 10000, 'Mercenary hiring must cost 0 manpower');
  assert.ok(mercRes.territories!['792_edi'].garrison > edirne.garrison);

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

test('Faz 3.3: Unified War Table ally calling and point-budget Peace Conference (provinces, full annexation, reparations, tribute, white peace, surrender)', () => {
  const ottoman = mkFaz3Nation('792', {
    name: 'Osmanlı Devleti',
    treasury: 1000,
    diplomacyPoints: 40,
    capitalTerritoryId: '792_edi',
  });
  const byzantium = mkFaz3Nation('300', {
    name: 'Bizans İmparatorluğu',
    treasury: 800,
    capitalTerritoryId: '300_ist',
  });
  const wallachia = mkFaz3Nation('642', {
    name: 'Eflak Voyvodalığı',
    treasury: 400,
    capitalTerritoryId: '642_buc',
  });

  const edirne = mkFaz3Territory('792_edi', {
    name: 'Edirne',
    ownerId: '792',
    coreOwnerId: '792',
    isCapital: true,
    garrison: 8000,
  });
  const selanik = mkFaz3Territory('300_sel', {
    name: 'Selanik',
    ownerId: '792',
    coreOwnerId: '300',
    isOccupied: true,
    baseGdp: 45,
    garrison: 3000,
  });
  const istanbul = mkFaz3Territory('300_ist', {
    name: 'Konstantiniyye',
    ownerId: '300',
    coreOwnerId: '300',
    isCapital: true,
    baseGdp: 95,
    garrison: 4000,
  });
  const mora = mkFaz3Territory('300_mor', {
    name: 'Mora',
    ownerId: '300',
    coreOwnerId: '300',
    baseGdp: 40,
    garrison: 2000,
  });

  const nations: Record<string, Nation> = {
    '792': ottoman,
    '300': byzantium,
    '642': wallachia,
  };
  const territories: Record<string, Territory> = {
    '792_edi': edirne,
    '300_sel': selanik,
    '300_ist': istanbul,
    '300_mor': mora,
  };
  const relations: Record<string, DiplomaticRelation> = {
    '642_792': {
      nationA: '642',
      nationB: '792',
      score: 55,
      isAllied: true,
      allianceType: 'OFFENSIVE',
      hasNonAggression: true,
      hasTradeAgreement: true,
      hasEmbargo: false,
      hasMilitaryAccess: true,
      truceUntilTick: 0,
    },
  };

  const war: ActiveWar = {
    id: 'war_792_300',
    name: 'Osmanlı - Bizans Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    startedTick: 1,
    attackerWarScore: 48,
    casualtiesAttacker: 1200,
    casualtiesDefender: 3400,
  };

  // 1. Call ally to war
  const callAllyRes = callAllyToWarDomain({
    warId: war.id,
    allyNationId: '642',
    playerNationId: '792',
    tick: 5,
    gameMode: 'EMPIRES_1440',
    nations,
    relations,
    wars: [war],
    newsEvents: [],
  });
  assert.ok(callAllyRes.wars, 'Ally should join war');
  assert.ok(callAllyRes.wars![0].attackers.includes('642'));

  // 2. Peace budget & province cost calculation
  const budget = calculateWarPeaceBudget(
    callAllyRes.wars![0],
    '792',
    territories,
    '300'
  );
  assert.ok(
    budget.availableBudget >= 58,
    'Peace budget should include war score + occupied province bonus'
  );
  const occupiedSelanikCost = calculateProvincePeaceScoreCost(
    selanik,
    ottoman,
    true
  );
  const unoccupiedIstanbulCost = calculateProvincePeaceScoreCost(
    istanbul,
    ottoman,
    false
  );
  assert.ok(
    occupiedSelanikCost < unoccupiedIstanbulCost,
    'Occupied non-capital province must cost fewer peace points than unoccupied enemy capital'
  );

  // 3. Over-budget peace demand should be rejected
  const overBudgetRes = resolvePeaceConferenceDomain({
    request: {
      warId: war.id,
      mode: 'PEACE_DEMANDS',
      demandedTerritoryIds: ['300_sel', '300_ist', '300_mor'],
      fullAnnexation: true,
      vassalizeEnemy: true,
      demandTribute: true,
      demandReparations: true,
    },
    playerNationId: '792',
    tick: 8,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations,
    wars: callAllyRes.wars!,
    battles: [],
    movements: [],
    newsEvents: [],
  });
  assert.equal(overBudgetRes.wars, undefined, 'Over-budget demand must be rejected');

  // 4. Valid point-budget peace conference (claim occupied Selanik + Mora + war reparations)
  const validPeaceRes = resolvePeaceConferenceDomain({
    request: {
      warId: war.id,
      mode: 'PEACE_DEMANDS',
      demandedTerritoryIds: ['300_sel', '300_mor'],
      fullAnnexation: false,
      vassalizeEnemy: false,
      demandTribute: false,
      demandReparations: true,
    },
    playerNationId: '792',
    tick: 8,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations,
    wars: callAllyRes.wars!,
    battles: [],
    movements: [],
    newsEvents: [],
  });
  assert.equal(validPeaceRes.wars?.length, 0, 'War should conclude on signed peace treaty');
  assert.equal(validPeaceRes.territories?.['300_sel']?.ownerId, '792');
  assert.equal(validPeaceRes.territories?.['300_sel']?.isOccupied, false);
  assert.equal(validPeaceRes.territories?.['300_sel']?.assimilation, 25);
  assert.equal(validPeaceRes.territories?.['300_mor']?.ownerId, '792');
  assert.equal(validPeaceRes.territories?.['300_mor']?.coreOwnerId, '300');
  assert.ok((validPeaceRes.nations?.['792']?.treasury ?? 0) > ottoman.treasury);
});

test('formatters clean nation/province names, format troop counts, and normalize Turkish flag codes safely', () => {
  assert.equal(cleanNationName('Osmanlı İmparatorluğu (1440)'), 'Osmanlı İmparatorluğu');
  assert.equal(cleanProvinceName('★ Konstantiniyye'), 'Konstantiniyye');
  assert.equal(formatTroopsShort(15400), '15.4B');
  assert.equal(formatTroopsShort(600), '600');
  assert.equal(normalizeFlagCode('BİZ'), 'BIZ');
  assert.equal(normalizeFlagCode('TİM'), 'TIM');
  assert.equal(normalizeFlagCode('İNG'), 'ING');
  assert.equal(normalizeFlagCode('ŞOG'), 'SOG');
  assert.equal(normalizeFlagCode('MAĞ'), 'MAG');
  assert.equal(normalizeFlagCode('osm'), 'OSM');
});

test('1440 Ottoman Empire uses authentic blackish-green map color and OSM flag code', () => {
  const ottoman = EMPIRES_1440_DEFS.find((n) => n.id === '792');
  assert.ok(ottoman, '1440 Ottoman Empire nation must exist');
  assert.equal(ottoman.color, '#183222');
  assert.equal(ottoman.flagCode, 'OSM');
});

test('executeBatchArmyMoveDomain coordinates multi-city dispatch, gates neutral wars, and preserves reserves/ratio', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 2000,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      treasury: 800,
      unlockedTechs: [],
      enactedReforms: [],
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    edi: {
      id: 'edi',
      name: 'Edirne',
      ownerId: '792',
      garrison: 8500,
      units: { infantry: 6000, armor: 2000, airDrone: 500 },
      neighbors: ['kon'],
      centroid: [26.5, 41.6],
    } as unknown as Territory,
    bur: {
      id: 'bur',
      name: 'Bursa',
      ownerId: '792',
      garrison: 6500,
      units: { infantry: 5000, armor: 1500, airDrone: 0 },
      neighbors: ['kon'],
      centroid: [29.0, 40.2],
    } as unknown as Territory,
    low: {
      id: 'low',
      name: 'İzmit',
      ownerId: '792',
      garrison: 900,
      units: { infantry: 900, armor: 0, airDrone: 0 },
      neighbors: ['kon'],
      centroid: [29.9, 40.7],
    } as unknown as Territory,
    kon: {
      id: 'kon',
      name: 'Konstantiniyye',
      ownerId: '300',
      garrison: 4000,
      units: { infantry: 3500, armor: 500, airDrone: 0 },
      neighbors: ['edi', 'bur', 'low'],
      centroid: [28.9, 41.0],
    } as unknown as Territory,
  };

  const blocked = executeBatchArmyMoveDomain({
    sourceIds: ['edi', 'bur', 'low'],
    toId: 'kon',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
    moveRatio: 0.5,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
    forceDeclareWar: false,
  });
  assert.equal(blocked.movements, undefined);
  assert.deepEqual(blocked.pendingWarMove, {
    fromId: 'edi',
    sourceTerritoryIds: ['edi', 'bur'],
    moveRatio: 0.5,
    toId: 'kon',
    targetNationId: '300',
  });

  const confirmed = executeBatchArmyMoveDomain({
    sourceIds: ['edi', 'bur', 'low'],
    toId: 'kon',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
    moveRatio: 0.5,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
    forceDeclareWar: true,
  });
  assert.equal(confirmed.wars?.length, 1);
  assert.equal(confirmed.movements?.length, 2);
  assert.equal(confirmed.territories?.edi.garrison, 4500);
  assert.equal(confirmed.territories?.bur.garrison, 3500);
  assert.equal(confirmed.territories?.low.garrison, 900);
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

test('ARMY_GENERATIONS expose explicit AoH3 troop class labels for every tier in 1440 and 2026', () => {
  for (const gen of [...ARMY_GENERATIONS_1440, ...ARMY_GENERATIONS_2026]) {
    assert.ok(gen.infantryClassLabel.trim().length >= 5, `Tier ${gen.tier} missing infantryClassLabel`);
    assert.ok(gen.armorClassLabel.trim().length >= 5, `Tier ${gen.tier} missing armorClassLabel`);
    assert.ok(gen.airArtilleryClassLabel.trim().length >= 5, `Tier ${gen.tier} missing airArtilleryClassLabel`);
  }
  assert.match(ARMY_GENERATIONS_1440[0].infantryClassLabel, /Piyade|Okçu/i);
  assert.match(ARMY_GENERATIONS_1440[0].armorClassLabel, /Atlı Okçu|Süvari/i);
  assert.match(ARMY_GENERATIONS_2026[0].armorClassLabel, /Tank|Zırhlı/i);
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
    territoryId: '792_IST',
    building: 'shipyard',
    territories: bundle.territories,
    nations,
    playerNationId: '792',
  });
  assert.equal(accepted.nations?.['792'].treasury, 5000 - 520);
  assert.equal(accepted.territories?.['792_IST'].constructionQueue?.[0]?.building, 'shipyard');
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
      isOccupied: true,
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
  assert.equal(mobRes.territories?.coast.garrison, 3000);
  assert.equal(mobRes.territories?.inland.garrison, 3000);
  assert.equal(mobRes.nations?.['792'].manpower, 4000);
});




