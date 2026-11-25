import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustAggressiveExpansionGain,
  adjustOccupiedUnrestDrift,
  calculateNationEconomy,
  calculateProvinceDevelopment,
  computeCombatStrength,
  computeNationManpowerCap,
  computeNationNavalBonus,
  computeNavalBlockadedTerritoryIds,
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
import {
  ActiveBattle,
  ActiveWar,
  ArmyMovement,
  DiplomaticRelation,
  Nation,
  SeaArmy,
  Territory,
} from '../types/game';
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
import {
  calculateProvinceSupplyLimit,
  evaluateAutomaticCapitulations,
  evaluateWeeklySupplyAndSeasonAttrition,
  getGameSeason,
  pruneDeadAlliances,
  resolveNationAiPersonality,
} from './seasonSupplyAndAiProfile';
import {
  calculateProvincePurchasePrice,
  calculateVassalAnnexCost,
  canAcceptLandPurchase,
  evaluateLandPurchaseDomain,
  issueProvinceUltimatumDomain,
  respondToDiplomaticOfferDomain,
} from './diplomacyAndWarActions';

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

import { geoArea, geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { initializeWorld2026 } from './worldBuilder';
import {
  COUNTRY_PROVINCE_SEEDS,
  getHistoricProvinceNames,
  getNormalizedProvinceShares,
} from './polygonSubdivider';
import { MUSIC_TRACKS } from './musicEngine';
import { buildSeedForFeature } from '../data/world2026Data';
import {
  renderMapLabelsAndBattles,
  shouldRenderProvinceLabel,
} from '../map/mapLabelsAndUnitsRenderer';

test('expanded province seeds and 1440 scenario cover 100% of world landmasses with 14+ Ottoman sancaks and offline Mehter tracks', () => {
  assert.ok(
    COUNTRY_PROVINCE_SEEDS['792'].length >= 36,
    `Ottoman/Turkey (792) should have >= 36 historical sancak subdivisions, got ${COUNTRY_PROVINCE_SEEDS['792'].length}`
  );

  const world2026 = initializeWorld2026('STANDARD_2026');
  const world1440 = initializeWorld2026('EMPIRES_1440');

  assert.ok(
    world2026.features.length >= 880 && world2026.features.length <= 920,
    `Expected 880-920 provinces in 2026 world, got ${world2026.features.length}`
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
    ottomanProvinces1440.length >= 30,
    `Expected Ottoman 1440 to start with >= 30 provinces, got ${ottomanProvinces1440.length}`
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
  assert.equal(mobRes.territories?.coast.garrison, 3000);
  assert.equal(mobRes.territories?.inland.garrison, 3000);
  assert.equal(mobRes.nations?.['792'].manpower, 4000);
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

test('Faz 4.4: pruneDeadAlliances clears alliances of eliminated states, warring pairs, and hostile relations while preserving healthy pacts', () => {
  const nations: Record<string, Nation> = {
    A: { id: 'A', isEliminated: false } as unknown as Nation,
    B: { id: 'B', isEliminated: false } as unknown as Nation,
    C: { id: 'C', isEliminated: true } as unknown as Nation,
    D: { id: 'D', isEliminated: false } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    tA: { id: 'tA', ownerId: 'A' } as unknown as Territory,
    tB: { id: 'tB', ownerId: 'B' } as unknown as Territory,
    tD: { id: 'tD', ownerId: 'D' } as unknown as Territory,
  };
  const relations: Record<string, DiplomaticRelation> = {
    A_B: { nationA: 'A', nationB: 'B', score: 60, isAllied: true, allianceType: 'DEFENSIVE' } as unknown as DiplomaticRelation,
    A_C: { nationA: 'A', nationB: 'C', score: 40, isAllied: true, allianceType: 'FULL' } as unknown as DiplomaticRelation,
    A_D: { nationA: 'A', nationB: 'D', score: -45, isAllied: true, allianceType: 'DEFENSIVE' } as unknown as DiplomaticRelation,
    B_D: { nationA: 'B', nationB: 'D', score: 25, isAllied: true, allianceType: 'DEFENSIVE', hasTradeAgreement: true } as unknown as DiplomaticRelation,
  };
  const wars: ActiveWar[] = [
    {
      id: 'wBD',
      name: 'B-D War',
      attackerId: 'B',
      defenderId: 'D',
      attackers: ['B'],
      defenders: ['D'],
      attackerWarScore: 0,
      startedTick: 1,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const res = pruneDeadAlliances({ nations, territories, relations, wars });
  assert.equal(res.prunedCount, 3);
  assert.equal(res.updatedRelations.A_B.isAllied, true);
  assert.equal(res.updatedRelations.A_C.isAllied, false);
  assert.equal(res.updatedRelations.A_D.isAllied, false);
  assert.equal(res.updatedRelations.B_D.isAllied, false);
  assert.equal(res.updatedRelations.B_D.hasTradeAgreement, false);
});

test('Faz 4.3: land purchase transfers friendly non-capital border province and blocks capitals or hostile owners', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 5000,
      diplomacyPoints: 50,
      isEliminated: false,
    } as unknown as Nation,
    '380': {
      id: '380',
      name: 'Venedik',
      treasury: 500,
      aiPersonality: 'MERCHANT',
      capitalTerritoryId: 'vCap',
      isEliminated: false,
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    o1: { id: 'o1', name: 'Edirne', ownerId: '792', coreOwnerId: '792', neighbors: ['vBorder', 'vCap'] } as unknown as Territory,
    vCap: { id: 'vCap', name: 'Venedik', ownerId: '380', coreOwnerId: '380', isCapital: true, baseGdp: 100, garrison: 4000, neighbors: ['o1', 'vBorder'] } as unknown as Territory,
    vBorder: {
      id: 'vBorder',
      name: 'Dalmaçya',
      ownerId: '380',
      coreOwnerId: '191',
      isCapital: false,
      baseGdp: 60,
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      neighbors: ['o1', 'vCap'],
    } as unknown as Territory,
  };
  const relations: Record<string, DiplomaticRelation> = {
    '380_792': { nationA: '380', nationB: '792', score: 45, truceUntilTick: 0 } as unknown as DiplomaticRelation,
  };

  assert.equal(calculateVassalAnnexCost('380', territories), 650);
  const price = calculateProvincePurchasePrice(territories.vBorder, nations['380'], 45);
  assert.ok(price >= 450);

  const capCheck = canAcceptLandPurchase({
    territory: territories.vCap,
    sellerNation: nations['380'],
    sellerPersonality: 'MERCHANT',
    relationScore: 45,
    sellerProvCount: 2,
  });
  assert.equal(capCheck.willAccept, false);

  const buyRes = evaluateLandPurchaseDomain({
    territoryId: 'vBorder',
    playerNationId: '792',
    tick: 25,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations,
    wars: [],
    newsEvents: [],
  });
  assert.equal(buyRes.territories?.vBorder.ownerId, '792');
  assert.equal(buyRes.territories?.vCap.garrison, 6000);
  assert.equal(buyRes.nations?.['792'].treasury, 5000 - price);
  assert.equal(buyRes.nations?.['380'].treasury, 500 + price);
  assert.equal(buyRes.relations?.['380_792'].score, 55);
});

test('Faz 4.3: territorial ultimatum forces bloodless cession when player has overwhelming army and fails with relation penalty when weak', () => {
  const baseNations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      diplomacyPoints: 60,
      aggressiveExpansion: 5,
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      aiPersonality: 'DEFENDER',
      capitalTerritoryId: 'bCap',
      isEliminated: false,
    } as unknown as Nation,
  };
  const baseTerrs: Record<string, Territory> = {
    o1: { id: 'o1', name: 'Edirne', ownerId: '792', coreOwnerId: '792', garrison: 30_000, neighbors: ['bBorder'] } as unknown as Territory,
    bBorder: {
      id: 'bBorder',
      name: 'Selanik',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: false,
      garrison: 3_000,
      units: { infantry: 3_000, armor: 0, airDrone: 0 },
      neighbors: ['o1', 'bCap'],
    } as unknown as Territory,
    bCap: {
      id: 'bCap',
      name: 'Konstantinopolis',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: true,
      garrison: 4_000,
      units: { infantry: 4_000, armor: 0, airDrone: 0 },
      neighbors: ['bBorder'],
    } as unknown as Territory,
  };

  const strongRes = issueProvinceUltimatumDomain({
    territoryId: 'bBorder',
    playerNationId: '792',
    tick: 30,
    gameMode: 'EMPIRES_1440',
    nations: baseNations,
    territories: baseTerrs,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.equal(strongRes.territories?.bBorder.ownerId, '792');
  assert.equal(strongRes.territories?.bCap.garrison, 7_000);
  assert.ok((strongRes.nations?.['792'].aggressiveExpansion || 0) > 5);
  assert.equal(strongRes.relations?.['300_792'].truceUntilTick, 90);

  const weakTerrs = {
    ...baseTerrs,
    o1: { ...baseTerrs.o1, garrison: 4_000 },
  };
  const weakRes = issueProvinceUltimatumDomain({
    territoryId: 'bBorder',
    playerNationId: '792',
    tick: 30,
    gameMode: 'EMPIRES_1440',
    nations: baseNations,
    territories: weakTerrs,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.equal(weakRes.territories, undefined);
  assert.equal(weakRes.relations?.['300_792'].score, -35);
});

test('Faz 4.2: respondToDiplomaticOfferDomain activates TRADE pact, transfers TRIBUTE_GIFT gold, and applies -5 relation on decline', () => {
  const nations: Record<string, Nation> = {
    '792': { id: '792', name: 'Osmanlı', treasury: 1000, isEliminated: false } as unknown as Nation,
    '380': { id: '380', name: 'Venedik', treasury: 900, isEliminated: false } as unknown as Nation,
  };

  const tradeAccept = respondToDiplomaticOfferDomain({
    offer: {
      id: 'off1',
      fromNationId: '380',
      kind: 'TRADE',
      message: 'Ticaret anlaşması öneriyor.',
      createdTick: 20,
      expiresTick: 32,
    },
    accept: true,
    playerNationId: '792',
    tick: 22,
    gameMode: 'EMPIRES_1440',
    nations,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.equal(tradeAccept.relations?.['380_792'].hasTradeAgreement, true);
  assert.equal(tradeAccept.relations?.['380_792'].score, 10);

  const giftAccept = respondToDiplomaticOfferDomain({
    offer: {
      id: 'off2',
      fromNationId: '380',
      kind: 'TRIBUTE_GIFT',
      message: 'Altın hediye ediyor.',
      goldGift: 300,
      createdTick: 20,
      expiresTick: 32,
    },
    accept: true,
    playerNationId: '792',
    tick: 22,
    gameMode: 'EMPIRES_1440',
    nations,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.equal(giftAccept.nations?.['792'].treasury, 1300);
  assert.equal(giftAccept.nations?.['380'].treasury, 600);

  const declined = respondToDiplomaticOfferDomain({
    offer: {
      id: 'off3',
      fromNationId: '380',
      kind: 'NON_AGGRESSION',
      message: 'Saldırmazlık öneriyor.',
      createdTick: 20,
      expiresTick: 32,
    },
    accept: false,
    playerNationId: '792',
    tick: 22,
    gameMode: 'EMPIRES_1440',
    nations,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.equal(declined.relations?.['380_792'].score, -5);
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

test('Gameplay fixes: 1x-5x speed profiles include 3x and slightly brisker cadence', async () => {
  const { CLOCK_SPEED_PROFILES, getClockSpeedProfile } = await import('./gameSettings');
  assert.ok(CLOCK_SPEED_PROFILES[3].rateLabel.includes('3x'));
  assert.ok(CLOCK_SPEED_PROFILES[1].intervalMs < 700);
  assert.ok(CLOCK_SPEED_PROFILES[2].intervalMs < 520);
  assert.ok(CLOCK_SPEED_PROFILES[3].intervalMs < CLOCK_SPEED_PROFILES[2].intervalMs);
  assert.ok(CLOCK_SPEED_PROFILES[4].intervalMs < CLOCK_SPEED_PROFILES[3].intervalMs);
  assert.ok(CLOCK_SPEED_PROFILES[5].intervalMs < CLOCK_SPEED_PROFILES[4].intervalMs);
  assert.equal(getClockSpeedProfile(3).hoursStep, 3);
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

test('Gameplay fixes: wartime occupied territories cannot be assimilated until permanently annexed after peace', async () => {
  const { assimilateTerritoryDomain } = await import('./empireAndArmyActions');

  const nations: Record<string, Nation> = {
    '792': { id: '792', name: 'Osmanlı', treasury: 2000, manpower: 20000, stability: 70, enactedReforms: [] } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    occ: {
      id: 'occ',
      name: 'Selanik',
      ownerId: '792',
      coreOwnerId: '300',
      isOccupied: true,
      assimilation: 25,
      isAssimilating: false,
    } as unknown as Territory,
    annexed: {
      id: 'annexed',
      name: 'Atina',
      ownerId: '792',
      coreOwnerId: '300',
      isOccupied: false,
      assimilation: 30,
      isAssimilating: false,
    } as unknown as Territory,
  };

  const occSingle = assimilateTerritoryDomain({ territoryId: 'occ', territories, nations, playerNationId: '792' });
  assert.equal(occSingle.territories, undefined);
  assert.ok(occSingle.toastMessage?.includes('Barış'));

  const occBatch = batchAssimilateDomain({
    territories: { occ: territories.occ },
    nations,
    playerNationId: '792',
  });
  assert.equal(occBatch.territories, undefined);

  const annexedSingle = assimilateTerritoryDomain({ territoryId: 'annexed', territories, nations, playerNationId: '792' });
  assert.equal(annexedSingle.territories?.annexed.isAssimilating, true);
});

test('Gameplay fixes: recapturing a lost allied core province returns ownership & color to the ally and returns player troops safely', async () => {
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');
  const { computeGameTick } = await import('./tickEngine');
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Türkiye',
      color: '#dc2626',
      treasury: 5000,
      manpower: 50000,
      stability: 75,
      capitalTerritoryId: 'tr1',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '31': {
      id: '31',
      name: 'Azerbaycan',
      color: '#0284c7',
      treasury: 2000,
      manpower: 20000,
      stability: 70,
      capitalTerritoryId: 'az1',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '643': {
      id: '643',
      name: 'Rusya',
      color: '#15803d',
      treasury: 4000,
      manpower: 40000,
      stability: 70,
      capitalTerritoryId: 'ru1',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    tr1: {
      id: 'tr1',
      name: 'Ankara',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: true,
      garrison: 10000,
      units: { infantry: 10000, armor: 0, airDrone: 0 },
      population: 50000,
      baseGdp: 100,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['az2'],
      centroid: [33, 40],
    } as unknown as Territory,
    az1: {
      id: 'az1',
      name: 'Bakü',
      ownerId: '31',
      coreOwnerId: '31',
      isCapital: true,
      garrison: 5000,
      units: { infantry: 5000, armor: 0, airDrone: 0 },
      population: 10000,
      baseGdp: 60,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['az2'],
      centroid: [49, 40],
    } as unknown as Territory,
    az2: {
      id: 'az2',
      name: 'Gence',
      ownerId: '643',
      coreOwnerId: '31',
      isCapital: false,
      isOccupied: true,
      garrison: 0,
      units: { infantry: 0, armor: 0, airDrone: 0 },
      population: 8000,
      baseGdp: 40,
      unrest: 25,
      assimilation: 25,
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['tr1', 'az1', 'ru1'],
      centroid: [46, 40.5],
    } as unknown as Territory,
    ru1: {
      id: 'ru1',
      name: 'Moskova',
      ownerId: '643',
      coreOwnerId: '643',
      isCapital: true,
      garrison: 12000,
      units: { infantry: 12000, armor: 0, airDrone: 0 },
      population: 80000,
      baseGdp: 150,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['az2'],
      centroid: [37, 55],
    } as unknown as Territory,
  };

  const wars: ActiveWar[] = [
    {
      id: 'w_ally',
      name: 'Büyük Savaş',
      attackerId: '643',
      defenderId: '31',
      attackers: ['643'],
      defenders: ['31', '792'],
      startedTick: 1,
      attackerWarScore: 10,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const movements: ArmyMovement[] = [
    {
      id: 'mv_lib',
      ownerId: '792',
      fromTerritoryId: 'tr1',
      toTerritoryId: 'az2',
      troops: 6000,
      units: { infantry: 4800, armor: 1200, airDrone: 0 },
      progress: 98,
      isAttack: true,
    },
  ];

  const out = computeGameTick({
    tick: 5,
    hour: 20,
    hoursStep: 4,
    speed: 5,
    gameMode: 'STANDARD_2026',
    playerNationId: '792',
    nations,
    territories,
    relations: {
      '31_792': {
        nationA: '31',
        nationB: '792',
        score: 85,
        isAllied: true,
        hasTradeAgreement: true,
        hasNonAggression: true,
        hasMilitaryAccess: true,
        hasEmbargo: false,
        truceUntilTick: 0,
      },
    },
    wars,
    battles: [],
    movements,
    seaArmies: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  // Territory must be returned to ally '31' with isOccupied = false, NOT '792'!
  assert.equal(out.territories.az2.ownerId, '31');
  assert.equal(out.territories.az2.isOccupied, false);
  assert.equal(out.territories.az2.assimilation, 100);
  // Player's 6000 troops must be safely returned to origin province tr1!
  assert.ok(out.territories.tr1.garrison >= 16000, `Expected player troops returned to tr1, got ${out.territories.tr1.garrison}`);
});

test('Gameplay fixes: armies can embark onto open sea, anchor as SeaArmy, disembark to coast, and disband with manpower refund', async () => {
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');
  const { computeGameTick } = await import('./tickEngine');
  const {
    executeEmbarkToSeaDomain,
    executeDisembarkFromSeaDomain,
    disbandSeaArmyDomain,
  } = await import('./empireAndArmyActions');

  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Türkiye',
      treasury: 5000,
      manpower: 30000,
      stability: 75,
      capitalTerritoryId: 'izmir',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    izmir: {
      id: 'izmir',
      name: 'İzmir',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: true,
      isCapital: true,
      garrison: 10000,
      units: { infantry: 7000, armor: 2000, airDrone: 1000 },
      population: 25000,
      baseGdp: 80,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 1 },
      neighbors: ['antalya'],
      centroid: [27.1, 38.4],
    } as unknown as Territory,
    antalya: {
      id: 'antalya',
      name: 'Antalya',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: true,
      isCapital: false,
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      population: 12000,
      baseGdp: 50,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0, shipyard: 0 },
      neighbors: ['izmir'],
      centroid: [30.7, 36.9],
    } as unknown as Territory,
  };

  // 1. Embark 50% from Izmir to Aegean open water [25.5, 37.8]
  const embarkPatch = executeEmbarkToSeaDomain({
    sourceTerritoryId: 'izmir',
    targetCoords: [25.5, 37.8],
    territories,
    nations,
    movements: [],
    seaArmies: [],
    playerNationId: '792',
    moveRatio: 0.5,
    speed: 1,
  });
  assert.equal(embarkPatch.movements?.length, 1);
  assert.equal(embarkPatch.movements?.[0].isNaval, true);
  assert.deepEqual(embarkPatch.movements?.[0].toCoords, [25.5, 37.8]);
  assert.ok((embarkPatch.territories?.izmir.garrison ?? 0) < 10000);

  // 2. Advance movement to arrival via computeGameTick -> stations a SeaArmy!
  const arrivingMove = { ...embarkPatch.movements![0], progress: 98 };
  const tickOut = computeGameTick({
    tick: 10,
    hour: 20,
    hoursStep: 4,
    speed: 5,
    gameMode: 'STANDARD_2026',
    playerNationId: '792',
    nations,
    territories: embarkPatch.territories!,
    relations: {},
    wars: [],
    battles: [],
    movements: [arrivingMove],
    seaArmies: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.equal(tickOut.seaArmies.length, 1);
  const fleet = tickOut.seaArmies[0];
  assert.equal(fleet.ownerId, '792');
  assert.equal(fleet.troops, arrivingMove.troops);

  // 3. Disembark 50% of fleet onto Antalya coast
  const disembarkPatch = executeDisembarkFromSeaDomain({
    sourceSeaArmyId: fleet.id,
    toTerritoryId: 'antalya',
    territories: tickOut.territories,
    nations: tickOut.nations,
    relations: {},
    wars: [],
    movements: [],
    seaArmies: tickOut.seaArmies,
    playerNationId: '792',
    moveRatio: 0.5,
    tick: 11,
    gameMode: 'STANDARD_2026',
    newsEvents: [],
    speed: 1,
  });
  assert.equal(disembarkPatch.movements?.length, 1);
  assert.equal(disembarkPatch.movements?.[0].toTerritoryId, 'antalya');
  assert.equal(disembarkPatch.seaArmies?.length, 1);
  assert.ok(disembarkPatch.seaArmies![0].troops < fleet.troops);

  // 4. Disband remaining sea army and check 75% manpower refund
  const remFleet = disembarkPatch.seaArmies![0];
  const disbandPatch = disbandSeaArmyDomain({
    seaArmyId: remFleet.id,
    ratio: 1,
    seaArmies: disembarkPatch.seaArmies!,
    nations: tickOut.nations,
    playerNationId: '792',
  });
  assert.equal(disbandPatch.seaArmies?.length, 0);
  assert.equal(
    disbandPatch.nations?.['792'].manpower,
    tickOut.nations['792'].manpower + Math.round(remFleet.troops * 0.75)
  );
});

test('Naval warfare: coastal blockade cuts economy and increases daily unrest while shipyards grant naval combat bonus', async () => {
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');
  const { computeGameTick } = await import('./tickEngine');

  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 2000,
      manpower: 20000,
      stability: 80,
      inflation: 2,
      taxRate: 30,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      capitalTerritoryId: 'izmir',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Venedik',
      treasury: 2000,
      manpower: 20000,
      stability: 80,
      inflation: 2,
      taxRate: 30,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      capitalTerritoryId: 'venedik',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    izmir: {
      id: 'izmir',
      name: 'İzmir',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: true,
      isCapital: true,
      garrison: 8000,
      units: { infantry: 6000, armor: 1500, airDrone: 500 },
      population: 30000,
      baseGdp: 120,
      resource: 'TICARET_BOGAZI',
      unrest: 5,
      assimilation: 100,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 2,
        supplyDepot: 0,
        shipyard: 2,
      },
      neighbors: [],
      centroid: [27.1, 38.4],
    } as unknown as Territory,
    venedik: {
      id: 'venedik',
      name: 'Venedik',
      ownerId: '300',
      coreOwnerId: '300',
      isCoastal: true,
      isCapital: true,
      garrison: 8000,
      units: { infantry: 6000, armor: 1500, airDrone: 500 },
      population: 25000,
      baseGdp: 110,
      resource: 'TICARET_BOGAZI',
      unrest: 0,
      assimilation: 100,
      buildings: {
        factory: 0,
        barracks: 0,
        fortress: 0,
        university: 0,
        tradeHub: 1,
        supplyDepot: 0,
        shipyard: 0,
      },
      neighbors: [],
      centroid: [12.3, 45.4],
    } as unknown as Territory,
  };

  const wars: ActiveWar[] = [
    {
      id: 'war_aegean',
      name: 'Ege Deniz Savaşı',
      attackerId: '300',
      defenderId: '792',
      attackers: ['300'],
      defenders: ['792'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  // Shipyard bonus scales +8% per level (2 shipyards => 1.16x)
  assert.equal(computeNationNavalBonus('792', territories), 1.16);
  assert.equal(computeNationNavalBonus('300', territories), 1);

  const enemyBlockadingFleet: SeaArmy = {
    id: 'sea_venice_1',
    ownerId: '300',
    name: 'Venedik Abluka Filosu',
    coords: [25.5, 38.0], // ~1.65° from Izmir (within 4.5° blockade radius)
    troops: 4500,
    units: { infantry: 3500, armor: 1000, airDrone: 0 },
  };

  const blockadedIds = computeNavalBlockadedTerritoryIds(territories, wars, [
    enemyBlockadingFleet,
  ]);
  assert.equal(blockadedIds.has('izmir'), true);
  assert.equal(blockadedIds.has('venedik'), false);

  const econFree = calculateNationEconomy(
    nations['792'],
    territories,
    nations,
    {},
    [],
    wars,
    'EMPIRES_1440',
    []
  );
  const econBlockaded = calculateNationEconomy(
    nations['792'],
    territories,
    nations,
    {},
    [],
    wars,
    'EMPIRES_1440',
    [enemyBlockadingFleet]
  );
  assert.ok(
    econBlockaded.taxIncome + econBlockaded.tradeIncome <
      econFree.taxIncome + econFree.tradeIncome,
    'Naval blockade should reduce coastal tax and trade income'
  );

  // Full day wrap adds +1.5 unrest pressure on blockaded coastal province
  const tickOut = computeGameTick({
    tick: 5,
    hour: 20,
    hoursStep: 4,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars,
    battles: [],
    movements: [],
    seaArmies: [enemyBlockadingFleet],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.ok(
    tickOut.territories.izmir.unrest > territories.izmir.unrest,
    `Expected blockaded Izmir unrest > ${territories.izmir.unrest}, got ${tickOut.territories.izmir.unrest}`
  );
});

test('Naval warfare: open-sea interception applies shipyard bonus, updates war casualties/warScore, and logs World News', async () => {
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');
  const { computeGameTick } = await import('./tickEngine');

  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      treasury: 3000,
      manpower: 25000,
      stability: 80,
      inflation: 1,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      capitalTerritoryId: 'izmir',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Venedik',
      treasury: 3000,
      manpower: 25000,
      stability: 80,
      inflation: 1,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      capitalTerritoryId: 'venedik',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    izmir: {
      id: 'izmir',
      name: 'İzmir',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: true,
      isCapital: true,
      garrison: 12000,
      units: { infantry: 8000, armor: 2000, airDrone: 2000 },
      population: 25000,
      baseGdp: 100,
      unrest: 0,
      assimilation: 100,
      buildings: {
        factory: 0,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 1,
        supplyDepot: 0,
        shipyard: 4, // +32% naval power bonus
      },
      neighbors: [],
      centroid: [27.1, 38.4],
    } as unknown as Territory,
    venedik: {
      id: 'venedik',
      name: 'Venedik',
      ownerId: '300',
      coreOwnerId: '300',
      isCoastal: true,
      isCapital: true,
      garrison: 8000,
      units: { infantry: 6000, armor: 2000, airDrone: 0 },
      population: 20000,
      baseGdp: 90,
      unrest: 0,
      assimilation: 100,
      buildings: {
        factory: 0,
        barracks: 0,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
        shipyard: 0,
      },
      neighbors: [],
      centroid: [12.3, 45.4],
    } as unknown as Territory,
  };

  const wars: ActiveWar[] = [
    {
      id: 'war_naval_1',
      name: 'Akdeniz Deniz Savaşı',
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

  // Equal troop counts (5,000 vs 5,000), but Ottoman 4 shipyards give decisive naval victory
  const enemyFleet: SeaArmy = {
    id: 'sea_enemy_1',
    ownerId: '300',
    name: 'Venedik Kadırga Filosu',
    coords: [24.0, 37.5],
    troops: 5000,
    units: { infantry: 4000, armor: 1000, airDrone: 0 },
  };

  const arrivingFleetMove: ArmyMovement = {
    id: 'mv_naval_attack',
    ownerId: '792',
    fromTerritoryId: 'izmir',
    toTerritoryId: 'SEA_AEGEAN',
    toCoords: [24.2, 37.6], // Within 5.5° interception radius of enemyFleet
    targetSeaName: 'Ege Açıkları',
    troops: 5000,
    units: { infantry: 4000, armor: 1000, airDrone: 0 },
    progress: 98,
    isAttack: true,
    isNaval: true,
  };

  const out = computeGameTick({
    tick: 12,
    hour: 10,
    hoursStep: 4,
    speed: 3,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars,
    battles: [],
    movements: [arrivingFleetMove],
    seaArmies: [enemyFleet],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  // Enemy fleet sunk, Ottoman victorious fleet anchored on sea
  assert.equal(out.seaArmies.length, 1);
  assert.equal(out.seaArmies[0].ownerId, '792');
  assert.ok(out.seaArmies[0].troops > 0 && out.seaArmies[0].troops < 5000);

  // War score and casualties updated
  const updatedWar = out.wars.find((w) => w.id === 'war_naval_1')!;
  assert.equal(updatedWar.attackerWarScore, 8);
  assert.equal(updatedWar.casualtiesDefender, 5000);
  assert.ok(updatedWar.casualtiesAttacker > 0);

  // Turkish naval victory news emitted
  assert.ok(
    out.newsEvents.some((e) => e.title.includes('Deniz Muharebesi Zaferi')),
    'Expected Deniz Muharebesi Zaferi news event'
  );
});

test('Naval warfare: wartime AI launches counter-blockade fleets and amphibious coastal assaults', () => {
  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Oyuncu',
      treasury: 4000,
      manpower: 30000,
      stability: 80,
      capitalTerritoryId: 'p_coast',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Venedik',
      treasury: 4000,
      manpower: 30000,
      stability: 80,
      capitalTerritoryId: 'ai_coast',
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const makeTerritories = (): Record<string, Territory> => ({
    p_coast: {
      id: 'p_coast',
      name: 'İzmir',
      ownerId: '792',
      coreOwnerId: '792',
      isCoastal: true,
      isCapital: true,
      garrison: 2200,
      units: { infantry: 2200, armor: 0, airDrone: 0 },
      population: 15000,
      baseGdp: 60,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: [], // Purely across water (no land bridge)
      centroid: [26.0, 38.0],
    } as unknown as Territory,
    ai_coast: {
      id: 'ai_coast',
      name: 'Venedik',
      ownerId: '300',
      coreOwnerId: '300',
      isCoastal: true,
      isCapital: true,
      garrison: 18000,
      units: { infantry: 13000, armor: 3000, airDrone: 2000 },
      population: 25000,
      baseGdp: 80,
      unrest: 0,
      assimilation: 100,
      buildings: { factory: 0, barracks: 1, fortress: 0, university: 0, tradeHub: 1, supplyDepot: 0, shipyard: 1 },
      neighbors: [], // Purely across water (no land bridge)
      centroid: [18.0, 40.0], // ~8.2° across open water from p_coast (within 28° range)
    } as unknown as Territory,
  });

  const wars: ActiveWar[] = [
    {
      id: 'war_med',
      name: 'Deniz Savaşı',
      attackerId: '300',
      defenderId: '792',
      attackers: ['300'],
      defenders: ['792'],
      startedTick: 1,
      attackerWarScore: 0,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  // Scenario A: Player blockades AI coastline -> AI dispatches naval counter-fleet to intercept
  const blockadingPlayerFleet: SeaArmy = {
    id: 'sea_player_blockade',
    ownerId: '792',
    name: '1. Abluka Filosu',
    coords: [19.5, 39.5], // ~1.6° from ai_coast
    troops: 4000,
    units: { infantry: 3000, armor: 1000, airDrone: 0 },
  };
  const outCounter = evaluateWartimeAiOperations({
    nextTick: 20,
    playerNationId: '792',
    territories: makeTerritories(),
    nations,
    relations: {},
    wars,
    movements: [],
    seaArmies: [blockadingPlayerFleet],
    aiAggressiveness: 'NORMAL',
  });
  assert.ok(outCounter, 'Expected AI wartime naval counter-fleet output');
  const counterMove = outCounter.newMovements.find(
    (m) => m.ownerId === '300' && m.isNaval && Boolean(m.toCoords)
  );
  assert.ok(counterMove, 'AI should launch naval counter-fleet against hostile blockading SeaArmy');
  assert.deepEqual(counterMove?.toCoords, blockadingPlayerFleet.coords);

  // Scenario B: No hostile fleet nearby -> AI launches amphibious assault on vulnerable player coast
  const outAmphib = evaluateWartimeAiOperations({
    nextTick: 21,
    playerNationId: '792',
    territories: makeTerritories(),
    nations,
    relations: {},
    wars,
    movements: [],
    seaArmies: [],
    aiAggressiveness: 'NORMAL',
  });
  assert.ok(outAmphib, 'Expected AI wartime amphibious assault output');
  const amphibMove = outAmphib.newMovements.find(
    (m) => m.ownerId === '300' && m.isNaval && m.toTerritoryId === 'p_coast'
  );
  assert.ok(amphibMove, 'AI should launch amphibious coastal assault across open water');
  assert.equal(amphibMove?.isAttack, true);
  assert.ok(
    outAmphib.playerAlerts.some((a) => a.includes('AMFİBİ ÇIKARMA')),
    'Expected Turkish amphibious assault alert for player'
  );
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

test('both 1440 and 2026 tech trees expose 48 illustrated branching technologies across 6 eras with valid prerequisites', async () => {
  const { TECH_TREE, TECH_TREE_1440 } = await import('../data/techAndArmyTiers');

  for (const [label, tree] of [
    ['1440', TECH_TREE_1440],
    ['2026', TECH_TREE],
  ] as const) {
    assert.equal(tree.length, 48, `${label} tech tree must have 48 technologies`);
    const ids = new Set(tree.map((t) => t.id));
    assert.equal(ids.size, 48, `${label} tech IDs must be unique`);

    for (const branch of ['MILITARY', 'ECONOMY', 'ADMINISTRATION', 'SCIENCE'] as const) {
      const branchItems = tree.filter((t) => t.branch === branch);
      assert.equal(branchItems.length, 12, `${label} ${branch} must have 12 techs (2 tracks × 6 eras)`);
      assert.equal(
        branchItems.filter((t) => t.subRow === 0).length,
        6,
        `${label} ${branch} main track must have 6 tiers`
      );
      assert.equal(
        branchItems.filter((t) => t.subRow === 1).length,
        6,
        `${label} ${branch} specialist track must have 6 tiers`
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

test('mid-march hostile army interception (Meydan Muharebesi) clashes opposing armies crossing paths or passing side-by-side before reaching cities', () => {
  const nationA = mkFaz3Nation('792', {
    name: 'Osmanlı',
    capitalTerritoryId: 'A',
  });
  const nationB = mkFaz3Nation('300', {
    name: 'Bizans',
    capitalTerritoryId: 'B',
  });

  const territories: Record<string, Territory> = {
    A: {
      id: 'A',
      name: 'Edirne',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: true,
      population: 100000,
      baseGdp: 150,
      resource: 'TAHIL',
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: false,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 1,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      neighbors: ['B', 'C'],
      centroid: [26.5, 41.6],
    } as unknown as Territory,
    B: {
      id: 'B',
      name: 'Selanik',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: true,
      population: 90000,
      baseGdp: 130,
      resource: 'DEMIR',
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: false,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 1,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      neighbors: ['A', 'D'],
      centroid: [23.0, 40.6],
    } as unknown as Territory,
    C: {
      id: 'C',
      name: 'Filibe',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: false,
      population: 80000,
      baseGdp: 110,
      resource: 'TAHIL',
      garrison: 1500,
      units: { infantry: 1500, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: false,
      buildings: {
        factory: 0,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      neighbors: ['A', 'D'],
      centroid: [24.7, 42.1],
    } as unknown as Territory,
    D: {
      id: 'D',
      name: 'Serez',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: false,
      population: 75000,
      baseGdp: 100,
      resource: 'TAHIL',
      garrison: 1500,
      units: { infantry: 1500, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: false,
      buildings: {
        factory: 0,
        barracks: 1,
        fortress: 0,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      neighbors: ['B', 'C'],
      centroid: [23.5, 41.1],
    } as unknown as Territory,
  };

  const war: ActiveWar = {
    id: 'war_intercept_test',
    name: 'Osmanlı-Bizans Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // Case 1: Opposite march A -> B (12,000 troops) vs B -> A (5,000 troops)
  const tickOut = computeGameTick({
    tick: 5,
    hour: 10,
    hoursStep: 4,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': nationA, '300': nationB },
    territories,
    relations: {},
    wars: [war],
    battles: [],
    movements: [
      {
        id: 'mv_ott',
        ownerId: '792',
        fromTerritoryId: 'A',
        toTerritoryId: 'B',
        fromCoords: [26.5, 41.6],
        toCoords: [23.0, 40.6],
        troops: 12000,
        units: { infantry: 7000, armor: 3500, airDrone: 1500 },
        progress: 40,
        isAttack: true,
      },
      {
        id: 'mv_byz',
        ownerId: '300',
        fromTerritoryId: 'B',
        toTerritoryId: 'A',
        fromCoords: [23.0, 40.6],
        toCoords: [26.5, 41.6],
        troops: 5000,
        units: { infantry: 4500, armor: 500, airDrone: 0 },
        progress: 38,
        isAttack: true,
      },
    ],
    seaArmies: [],
    newsEvents: [],
    settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
  });

  // The weaker Byzantine army must be intercepted and eliminated from active movements
  const activeTestMovements1 = tickOut.movements.filter(
    (m) => m.id === 'mv_ott' || m.id === 'mv_byz'
  );
  assert.equal(
    activeTestMovements1.length,
    1,
    'Opposing armies crossing paths must intercept mid-march, leaving only the victorious army marching'
  );
  assert.equal(
    activeTestMovements1[0].ownerId,
    '792',
    'Stronger Ottoman army must win the field battle and continue marching'
  );
  assert.ok(
    activeTestMovements1[0].troops < 12000 && activeTestMovements1[0].troops > 6000,
    'Winning army must take realistic field battle casualties'
  );
  assert.ok(
    tickOut.wars[0].casualtiesDefender > 0 && tickOut.wars[0].attackerWarScore > 0,
    'Mid-march field battle must record war casualties and warScore'
  );

  // Case 2: Side-by-side passing on adjacent roads (A -> D vs C -> B) within 2.65 degrees proximity
  const sideBySideOut = computeGameTick({
    tick: 6,
    hour: 14,
    hoursStep: 4,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: { '792': nationA, '300': nationB },
    territories,
    relations: {},
    wars: [war],
    battles: [],
    movements: [
      {
        id: 'mv_side_a',
        ownerId: '792',
        fromTerritoryId: 'C',
        toTerritoryId: 'D',
        fromCoords: [24.7, 42.1],
        toCoords: [23.5, 41.1],
        troops: 9000,
        units: { infantry: 5000, armor: 3000, airDrone: 1000 },
        progress: 45,
        isAttack: true,
      },
      {
        id: 'mv_side_b',
        ownerId: '300',
        fromTerritoryId: 'B',
        toTerritoryId: 'A',
        fromCoords: [23.0, 40.6],
        toCoords: [26.5, 41.6],
        troops: 4000,
        units: { infantry: 4000, armor: 0, airDrone: 0 },
        progress: 35,
        isAttack: true,
      },
    ],
    seaArmies: [],
    newsEvents: [],
    settings: { ...DEFAULT_GAME_SETTINGS, crisisFrequencyDays: 0 },
  });

  const activeTestMovements2 = sideBySideOut.movements.filter(
    (m) => m.id === 'mv_side_a' || m.id === 'mv_side_b'
  );
  assert.equal(
    activeTestMovements2.length,
    1,
    'Hostile armies passing side-by-side within field proximity must engage in a mid-march battle'
  );
  assert.equal(activeTestMovements2[0].ownerId, '792');
});

test('batchRecruitUnitsDomain supports recruiting infantry, armor, airDrone, and MIXED armies across SINGLE_MAX, BORDER, and ALL provinces', async () => {
  const { batchRecruitUnitsDomain } = await import('./empireAndArmyActions');

  const nation = mkFaz3Nation('792', {
    treasury: 12000,
    manpower: 45000,
    capitalTerritoryId: 'P1',
  });

  const makeTerritories = (): Record<string, Territory> => ({
    P1: {
      id: 'P1',
      name: 'İstanbul',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: true,
      population: 120000,
      baseGdp: 200,
      resource: 'TICARET_BOGAZI',
      garrison: 5000,
      units: { infantry: 4000, armor: 1000, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: true,
      buildings: {
        factory: 1,
        barracks: 2,
        fortress: 2,
        university: 1,
        tradeHub: 1,
        supplyDepot: 1,
      },
      neighbors: ['P2', 'ENEMY_1'],
      centroid: [28.9, 41.0],
    } as unknown as Territory,
    P2: {
      id: 'P2',
      name: 'Bursa',
      ownerId: '792',
      coreOwnerId: '792',
      isCapital: false,
      population: 95000,
      baseGdp: 150,
      resource: 'IPEK_TEKSTIL',
      garrison: 3000,
      units: { infantry: 3000, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: false,
      buildings: {
        factory: 1,
        barracks: 1,
        fortress: 1,
        university: 0,
        tradeHub: 1,
        supplyDepot: 0,
      },
      neighbors: ['P1'],
      centroid: [29.0, 40.2],
    } as unknown as Territory,
    ENEMY_1: {
      id: 'ENEMY_1',
      name: 'Selanik',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: true,
      population: 80000,
      baseGdp: 120,
      resource: 'DEMIR',
      garrison: 4000,
      units: { infantry: 4000, armor: 0, airDrone: 0 },
      unrest: 0,
      assimilation: 100,
      isOccupied: false,
      isCoastal: true,
      buildings: {
        factory: 0,
        barracks: 1,
        fortress: 1,
        university: 0,
        tradeHub: 0,
        supplyDepot: 0,
      },
      neighbors: ['P1'],
      centroid: [23.0, 40.6],
    } as unknown as Territory,
  });

  // 1. Recruit armor (Cavalry / Tanks) in SINGLE_MAX mode
  const armorMax = batchRecruitUnitsDomain({
    territories: makeTerritories(),
    nations: { '792': nation },
    playerNationId: '792',
    scope: 'SINGLE_MAX',
    unitMode: 'armor',
    territoryId: 'P2',
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(
    (armorMax.territories?.['P2']?.units?.armor ?? 0) >= 6000,
    'SINGLE_MAX armor must recruit multiple cavalry/armor regiments in target city'
  );

  // 2. Recruit airDrone (Artillery / Air-Drone) across BORDER provinces
  const airBorder = batchRecruitUnitsDomain({
    territories: makeTerritories(),
    nations: { '792': nation },
    playerNationId: '792',
    scope: 'BORDER',
    unitMode: 'airDrone',
    roundsPerCity: 2,
    gameMode: 'EMPIRES_1440',
  });
  assert.equal(
    airBorder.territories?.['P1']?.units?.airDrone,
    2000,
    'BORDER airDrone batch recruit must add artillery/air units to border province P1'
  );
  assert.equal(
    airBorder.territories?.['P2']?.units?.airDrone,
    0,
    'Non-border province P2 must not be recruited during BORDER scope'
  );

  // 3. Recruit MIXED army across ALL provinces
  const mixedAll = batchRecruitUnitsDomain({
    territories: makeTerritories(),
    nations: { '792': nation },
    playerNationId: '792',
    scope: 'ALL',
    unitMode: 'MIXED',
    roundsPerCity: 1,
    gameMode: 'EMPIRES_1440',
  });
  assert.ok(
    (mixedAll.territories?.['P1']?.units?.infantry ?? 0) > 4000 &&
      (mixedAll.territories?.['P1']?.units?.armor ?? 0) > 1000 &&
      (mixedAll.territories?.['P1']?.units?.airDrone ?? 0) > 0,
    'MIXED batch recruitment across ALL must add infantry, armor, and airDrone to P1'
  );
  assert.ok(
    (mixedAll.territories?.['P2']?.units?.infantry ?? 0) > 3000 &&
      (mixedAll.territories?.['P2']?.units?.armor ?? 0) > 0 &&
      (mixedAll.territories?.['P2']?.units?.airDrone ?? 0) > 0,
    'MIXED batch recruitment across ALL must add all 3 unit classes to P2'
  );
});

test('opposing naval fleets passing at sea and moving fleets passing anchored SeaArmies clash mid-voyage', () => {
  const world = initializeWorld2026('EMPIRES_1440');
  const war: ActiveWar = {
    id: 'war_naval_clash',
    name: 'Ege Deniz Savaşı',
    attackerId: '792',
    defenderId: '300',
    attackers: ['792'],
    defenders: ['300'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // Case A: Two moving naval fleets crossing paths in the Aegean Sea
  const fleetOtt: ArmyMovement = {
    id: 'fleet_ott_1',
    ownerId: '792',
    fromTerritoryId: '792_3',
    toTerritoryId: '300_1',
    fromCoords: [26.5, 39.0],
    toCoords: [24.0, 38.0],
    troops: 11000,
    units: { infantry: 8000, armor: 2000, airDrone: 1000 },
    progress: 40,
    isAttack: true,
    isNaval: true,
  };
  const fleetByz: ArmyMovement = {
    id: 'fleet_byz_1',
    ownerId: '300',
    fromTerritoryId: '300_1',
    toTerritoryId: '792_3',
    fromCoords: [24.0, 38.0],
    toCoords: [26.5, 39.0],
    troops: 4500,
    units: { infantry: 4000, armor: 500, airDrone: 0 },
    progress: 40,
    isAttack: true,
    isNaval: true,
  };

  const outA = computeGameTick({
    tick: 12,
    hour: 12,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: world.nations,
    territories: world.territories,
    relations: world.relations,
    wars: [war],
    battles: [],
    movements: [fleetOtt, fleetByz],
    seaArmies: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  const survivingMovingFleets = outA.movements.filter(
    (m) => m.id === 'fleet_ott_1' || m.id === 'fleet_byz_1'
  );
  assert.equal(
    survivingMovingFleets.length,
    1,
    'Passing hostile naval fleets must intercept each other mid-voyage so only the victor continues'
  );
  assert.equal(survivingMovingFleets[0].ownerId, '792');
  assert.ok(
    survivingMovingFleets[0].troops < 11000,
    'Winning fleet must take combat casualties during open-sea clash'
  );
  assert.ok(
    outA.newsEvents.some((ev) => ev.title.includes('Deniz Muharebesi')),
    'Open-sea clash must log a Deniz Muharebesi news event'
  );

  // Case B: An amphibious invasion / moving fleet passing within 5.0° of an anchored hostile SeaArmy
  const movingInvasion: ArmyMovement = {
    id: 'amph_ott_1',
    ownerId: '792',
    fromTerritoryId: '792_3',
    toTerritoryId: '300_1',
    fromCoords: [27.0, 39.0],
    toCoords: [23.5, 38.0],
    troops: 12000,
    units: { infantry: 9000, armor: 2000, airDrone: 1000 },
    progress: 35,
    isAttack: true,
    isNaval: true,
  };
  const anchoredBlockade = {
    id: 'sea_byz_guard',
    ownerId: '300',
    name: 'Bizans Ege Filosu',
    coords: [25.2, 38.5] as [number, number],
    troops: 4000,
    units: { infantry: 3500, armor: 500, airDrone: 0 },
  };

  const outB = computeGameTick({
    tick: 14,
    hour: 8,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: world.nations,
    territories: world.territories,
    relations: world.relations,
    wars: [war],
    battles: [],
    movements: [movingInvasion],
    seaArmies: [anchoredBlockade],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(
    outB.seaArmies?.some((s) => s.id === 'sea_byz_guard'),
    false,
    'Weaker anchored hostile SeaArmy in the path of a stronger fleet must be intercepted and sunk mid-voyage'
  );
  const survInvasion = outB.movements.find((m) => m.id === 'amph_ott_1');
  assert.ok(
    survInvasion && survInvasion.troops < 12000,
    'Victorious moving fleet must continue its voyage after defeating the anchored blockade fleet'
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

test('computeEncircledProvinceIds detects cut-off inland pockets and applies wartime encirclement attrition', async () => {
  const {
    computeEncircledProvinceIds,
    evaluateWeeklySupplyAndSeasonAttrition,
    getGameSeason,
  } = await import('./seasonSupplyAndAiProfile');

  const nations: Record<string, Nation> = {
    A: mkFaz3Nation('A', { capitalTerritoryId: 'A_CAP' }),
    B: mkFaz3Nation('B', { capitalTerritoryId: 'B_BRIDGE' }),
  };

  // A owns A_CAP and A_POCKET, separated by enemy-controlled B_BRIDGE (and A_POCKET is inland)
  const territories: Record<string, Territory> = {
    A_CAP: mkFaz3Territory('A_CAP', {
      ownerId: 'A',
      isCapital: true,
      isCoastal: false,
      neighbors: ['B_BRIDGE'],
      garrison: 6000,
    }),
    B_BRIDGE: mkFaz3Territory('B_BRIDGE', {
      ownerId: 'B',
      isCapital: true,
      isCoastal: false,
      neighbors: ['A_CAP', 'A_POCKET'],
      garrison: 8000,
    }),
    A_POCKET: mkFaz3Territory('A_POCKET', {
      ownerId: 'A',
      isCapital: false,
      isCoastal: false,
      neighbors: ['B_BRIDGE'],
      garrison: 4000,
    }),
  };

  const encircled = computeEncircledProvinceIds(territories, nations);
  assert.equal(
    encircled.has('A_POCKET'),
    true,
    'Inland province cut off from its capital and ports must be marked encircled'
  );
  assert.equal(
    encircled.has('A_CAP'),
    false,
    'Capital province must never be marked encircled'
  );

  const war: ActiveWar = {
    id: 'w_enc',
    name: 'Encirclement War',
    attackerId: 'B',
    defenderId: 'A',
    attackers: ['B'],
    defenders: ['A'],
    startedTick: 1,
    attackerWarScore: 10,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  const attRes = evaluateWeeklySupplyAndSeasonAttrition({
    territories,
    nations,
    season: getGameSeason(60, 'EMPIRES_1440'),
    playerNationId: 'A',
    wars: [war],
  });

  assert.equal(attRes.changed, true);
  assert.ok(
    attRes.updatedTerritories['A_POCKET'].garrison < 4000,
    'Encircled wartime garrison must suffer weekly encirclement attrition even below normal supply limit'
  );
  assert.equal(
    attRes.updatedTerritories['A_CAP'].garrison,
    6000,
    'Supplied capital below supply limit must not suffer encirclement attrition'
  );
});

test('covert espionage operations (sabotage fort, incite revolt, siphon treasury) and anti-hegemon coalitions work end-to-end', async () => {
  const { evaluateAntiHegemonCoalitions } = await import(
    './seasonSupplyAndAiProfile'
  );

  const nations: Record<string, Nation> = {
    PLR: mkFaz3Nation('PLR', {
      name: 'Osmanlı',
      treasury: 1200,
      diplomacyPoints: 95,
      researchPoints: 40,
      aggressiveExpansion: 78,
    }),
    ENM: mkFaz3Nation('ENM', {
      name: 'Venedik',
      treasury: 1000,
      stability: 75,
    }),
    NB1: mkFaz3Nation('NB1', { name: 'Macaristan' }),
    NB2: mkFaz3Nation('NB2', { name: 'Avusturya' }),
  };

  const territories: Record<string, Territory> = {
    P1: mkFaz3Territory('P1', {
      ownerId: 'PLR',
      neighbors: ['E1', 'N1', 'N2'],
    }),
    P2: mkFaz3Territory('P2', { ownerId: 'PLR', neighbors: ['P1'] }),
    P3: mkFaz3Territory('P3', { ownerId: 'PLR', neighbors: ['P1'] }),
    E1: mkFaz3Territory('E1', {
      ownerId: 'ENM',
      name: 'Girit Kalesi',
      neighbors: ['P1'],
      garrison: 5000,
      castleWallHp: 100,
      unrest: 20,
      buildings: {
        ...mkFaz3Territory('x').buildings,
        fortress: 3,
      },
    }),
    N1: mkFaz3Territory('N1', { ownerId: 'NB1', neighbors: ['P1', 'N2'] }),
    N2: mkFaz3Territory('N2', { ownerId: 'NB2', neighbors: ['P1', 'N1'] }),
  };

  // 1. Sabotage Fortress
  const sabRes = executeDiplomaticActionDomain({
    targetNationId: 'ENM',
    action: 'ESPIONAGE_SABOTAGE_FORT',
    playerNationId: 'PLR',
    totalPlayerGarrison: 10000,
    tick: 20,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [],
    newsEvents: [],
  });
  assert.ok(
    (sabRes.territories?.E1.castleWallHp ?? 100) <= 45 &&
      (sabRes.territories?.E1.garrison ?? 5000) < 5000,
    'ESPIONAGE_SABOTAGE_FORT must damage enemy fortress wall integrity and reduce garrison'
  );

  // 2. Incite Revolt
  const revRes = executeDiplomaticActionDomain({
    targetNationId: 'ENM',
    action: 'ESPIONAGE_INCITE_REVOLT',
    playerNationId: 'PLR',
    totalPlayerGarrison: 10000,
    tick: 21,
    gameMode: 'EMPIRES_1440',
    nations: sabRes.nations!,
    territories: sabRes.territories!,
    relations: sabRes.relations!,
    wars: [],
    newsEvents: [],
  });
  assert.ok(
    (revRes.territories?.E1.unrest ?? 0) >= 60,
    'ESPIONAGE_INCITE_REVOLT must spike target province unrest by +42'
  );

  // 3. Siphon Treasury & Science
  const sipRes = executeDiplomaticActionDomain({
    targetNationId: 'ENM',
    action: 'ESPIONAGE_SIPHON_TREASURY',
    playerNationId: 'PLR',
    totalPlayerGarrison: 10000,
    tick: 22,
    gameMode: 'EMPIRES_1440',
    nations: revRes.nations!,
    territories: revRes.territories!,
    relations: revRes.relations!,
    wars: [],
    newsEvents: [],
  });
  assert.ok(
    (sipRes.nations?.PLR.treasury ?? 0) > (revRes.nations?.PLR.treasury ?? 0) &&
      (sipRes.nations?.PLR.researchPoints ?? 0) === 75,
    'ESPIONAGE_SIPHON_TREASURY must yield net positive gold and +35 research points'
  );

  // 4. Anti-Hegemon Coalition forms between threatened neighbors NB1 and NB2 against high-AE PLR (AE=78)
  const relationsWithThreat: Record<string, DiplomaticRelation> = {
    NB1_PLR: {
      nationA: 'NB1',
      nationB: 'PLR',
      score: -45,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
    NB2_PLR: {
      nationA: 'NB2',
      nationB: 'PLR',
      score: -40,
      isAllied: false,
      hasNonAggression: false,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
  };

  const coalRes = evaluateAntiHegemonCoalitions({
    nations,
    territories,
    relations: relationsWithThreat,
    wars: [],
    playerNationId: 'PLR',
  });
  assert.equal(coalRes.formedCoalitions.length, 1);
  assert.equal(coalRes.formedCoalitions[0].isAgainstPlayer, true);
  assert.equal(
    coalRes.updatedRelations.NB1_NB2?.allianceType,
    'DEFENSIVE',
    'Threatened neighbors of high-AE hegemon must form a mutual Defensive Coalition Pact'
  );
});

test('1444 scenario distributes historical city counts, borders, and capitals accurately across all realms', () => {
  const world1440 = initializeWorld2026('EMPIRES_1440');
  const countByOwner = (ownerId: string) =>
    Object.values(world1440.territories).filter((t) => t.ownerId === ownerId);

  // Every nation must own its capital territory and mark it isCapital
  for (const nation of Object.values(world1440.nations)) {
    const cap = world1440.territories[nation.capitalTerritoryId];
    assert.ok(cap, `Nation ${nation.id} (${nation.name}) must have a valid capitalTerritoryId`);
    assert.equal(
      cap.ownerId,
      nation.id,
      `Capital ${nation.capitalTerritoryId} of ${nation.name} must be owned by ${nation.id}, got ${cap.ownerId}`
    );
    assert.equal(cap.isCapital, true, `Capital ${nation.capitalTerritoryId} must have isCapital=true`);
  }

  // No ahistorical 25-32 province continent blobs
  const ownerCounts = Object.keys(world1440.nations).map((id) => ({
    id,
    count: countByOwner(id).length,
  }));
  const maxCityCount = Math.max(...ownerCounts.map((x) => x.count));
  assert.ok(
    maxCityCount <= 45,
    `No 1444 realm should exceed 45 provinces after the district expansion, found ${maxCityCount}`
  );

  // Key Eurasian historical city counts & borders
  assert.equal(countByOwner('792').length, 35, 'Ottoman Empire (1444) should have 35 provinces');
  assert.equal(world1440.territories['300_SKG'].ownerId, '792', 'Selanik should be Ottoman in 1444');
  assert.equal(world1440.territories['300_IOA'].ownerId, '792', 'Yanya should be Ottoman in 1444');
  assert.equal(world1440.territories['642_CND'].ownerId, '792', 'Dobruca/Silistre should be Ottoman in 1444');

  assert.equal(countByOwner('300').length, 5, 'Byzantium & Morea (1444) should have 5 provinces');
  assert.equal(world1440.territories['792_IST'].ownerId, '300', 'Constantinople must belong to Byzantium');
  assert.equal(world1440.territories['300_CRT'].ownerId, '380', 'Crete must belong to Venice');

  assert.equal(countByOwner('818').length, 31, 'Mamluk Sultanate should have 31 provinces');
  assert.equal(countByOwner('156').length, 36, 'Ming Dynasty should have 36 provinces');
  assert.equal(countByOwner('276').length, 20, 'Holy Roman Empire should have 20 provinces');
  assert.equal(countByOwner('250').length, 18, 'Kingdom of France should have 18 provinces');
  assert.equal(countByOwner('724').length, 20, 'Castile & Aragon should have 20 provinces');
  assert.equal(countByOwner('348').length, 12, 'Kingdom of Hungary should have 12 provinces');
  assert.equal(world1440.territories['642_CLJ'].ownerId, '348', 'Transylvania should belong to Hungary');
  assert.equal(countByOwner('392').length, 14, 'Ashikaga Japan should have 14 provinces');
  assert.equal(countByOwner('826').length, 13, 'Kingdom of England should have 13 provinces');
  assert.equal(countByOwner('905').length, 2, 'Kingdom of Scotland should have 2 cities');
  assert.equal(world1440.territories['826_EDI'].ownerId, '905', 'Edinburgh should belong to Scotland');
  assert.equal(countByOwner('616').length, 12, 'Kingdom of Poland should have 12 provinces');
  assert.equal(world1440.territories['616_GDN'].ownerId, '428', 'Marienburg/Danzig should belong to Teutonic Order');
  assert.equal(countByOwner('440').length, 10, 'Grand Duchy of Lithuania should have 10 provinces');
  assert.equal(world1440.territories['804'].ownerId, '440', 'Kiev should belong to Lithuania');
  assert.equal(countByOwner('642').length, 6, 'Wallachia should have 6 provinces');
  assert.equal(countByOwner('498').length, 4, 'Moldavia should have 4 provinces');
  assert.equal(world1440.territories['642_IAS'].ownerId, '498', 'Iasi should belong to Moldavia');
  assert.equal(world1440.nations['031'].capitalTerritoryId, '364_TBZ', 'Karakoyunlu capital should be Tabriz');
  assert.equal(world1440.nations['364'].capitalTerritoryId, '860_SKD', 'Timurid capital should be Samarkand');
});


// ─────────────────────────────────────────────────────────────────────────────
// Expanded world map: ~880–920 provinces, 3-stage labels, period naming
// ─────────────────────────────────────────────────────────────────────────────

function pointInOuterRingForTest(
  lon: number,
  lat: number,
  ring: number[][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function geometryContainsPointForTest(
  geometry: { type: string; coordinates: unknown },
  lon: number,
  lat: number
): boolean {
  if (geometry.type === 'Polygon') {
    const ring = (geometry.coordinates as number[][][])[0];
    return ring ? pointInOuterRingForTest(lon, lat, ring) : false;
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).some(
      (poly) => poly[0] && pointInOuterRingForTest(lon, lat, poly[0])
    );
  }
  return false;
}

test('expanded map keeps every district polygon on land, connected and tappable', () => {
  const world = initializeWorld2026('STANDARD_2026');
  const totalProvinces = world.features.length;

  assert.equal(Object.keys(world.territories).length, totalProvinces);
  assert.equal(
    new Set(world.features.map((f) => f.id)).size,
    totalProvinces,
    'Province IDs must stay unique'
  );

  const districts = Object.values(world.territories).filter((t) => t.isDistrict);
  assert.ok(
    districts.length >= 430,
    `Expected >= 430 tier-3 districts, got ${districts.length}`
  );

  const featureById = new Map(world.features.map((f) => [f.id, f]));
  for (const district of districts) {
    const feature = featureById.get(district.id);
    assert.ok(feature, `District ${district.id} must have a polygon feature`);
    assert.ok(
      geoArea(feature as unknown as Parameters<typeof geoArea>[0]) > 1e-7,
      `District ${district.name} (${district.id}) must have a real land polygon`
    );
    assert.ok(
      district.neighbors.length >= 1,
      `District ${district.name} (${district.id}) must have >= 1 neighbour`
    );
    // Label anchor must sit on its own land (never in the ocean/bay).
    assert.ok(
      geometryContainsPointForTest(
        feature!.geometry as unknown as { type: string; coordinates: unknown },
        district.centroid[0],
        district.centroid[1]
      ),
      `District label anchor of ${district.name} (${district.id}) must be on land`
    );
  }

  // Legacy provinces also keep at least one neighbour (no isolated islands).
  for (const territory of Object.values(world.territories)) {
    assert.ok(
      territory.neighbors.length >= 1,
      `Province ${territory.name} (${territory.id}) must have >= 1 neighbour`
    );
  }

  // Every nation keeps a valid, owned capital province.
  for (const nation of Object.values(world.nations)) {
    const capital = world.territories[nation.capitalTerritoryId];
    assert.ok(capital, `${nation.name} must keep capital ${nation.capitalTerritoryId}`);
    assert.equal(capital!.isCapital, true);
    assert.equal(capital!.ownerId, nation.id);
    assert.notEqual(capital!.isDistrict, true, 'A capital can never be a tier-3 district');
  }
});

test('regional scaling targets match the approved plan and micro-states stay whole', () => {
  const minimums: Record<string, number> = {
    '792': 36, // Türkiye / Anadolu
    '643': 34, // Rusya
    '840': 32, // ABD
    '156': 32, // Çin
    '356': 24, // Hindistan
    '276': 20, // Almanya
    '250': 19, // Fransa
    '380': 17, // İtalya
    '724': 17, // İspanya
    '124': 16, // Kanada
    '826': 15, // Birleşik Krallık
    '364': 15, // İran
    '392': 14, // Japonya
    '036': 12, // Avustralya
    '484': 12, // Meksika
    '616': 12, // Polonya
    '076': 16, // Brezilya
    '410': 11, // Güney Kore
    '804': 10, // Ukrayna
    '818': 10, // Mısır
    '682': 10, // Suudi Arabistan
    '360': 10, // Endonezya
    '398': 10, // Kazakistan
    '642': 10, // Romanya
    '566': 8, // Nijerya
    '710': 8, // Güney Afrika
    '231': 8, // Etiyopya
  };

  for (const [countryId, minimum] of Object.entries(minimums)) {
    const seeds = COUNTRY_PROVINCE_SEEDS[countryId];
    assert.ok(seeds, `Country ${countryId} must have a seed list`);
    assert.ok(
      seeds!.length >= minimum,
      `Country ${countryId} should have >= ${minimum} provinces, got ${seeds!.length}`
    );
  }

  // Micro-states and small islands are intentionally NOT over-divided: they
  // either stay a single province or keep their original at most two cities.
  for (const microState of ['196', '756', '056', '422', '442', '064', '352', '242', '044']) {
    const seeds = COUNTRY_PROVINCE_SEEDS[microState];
    assert.ok(
      !seeds || seeds.length <= 2,
      `Micro-state ${microState} must stay at most 2 tappable provinces, got ${seeds?.length}`
    );
  }

  // Every new district carries both a modern and a period name.
  const districtSeeds = Object.values(COUNTRY_PROVINCE_SEEDS)
    .flat()
    .filter((seed) => seed.isDistrict);
  assert.ok(districtSeeds.length >= 430);
  for (const seed of districtSeeds) {
    assert.ok(seed.name.length > 0, 'District must have a modern 2026 name');
    assert.ok(
      Boolean(seed.historicName),
      `District ${seed.name} must carry a 1444 period name`
    );
  }
});

test('district additions normalize population, GDP and army shares to 1.00 per country', () => {
  for (const [countryId, seeds] of Object.entries(COUNTRY_PROVINCE_SEEDS)) {
    const shares = getNormalizedProvinceShares(seeds);
    assert.equal(shares.length, seeds.length);
    const sum = shares.reduce((acc, v) => acc + v, 0);
    assert.ok(
      Math.abs(sum - 1) < 1e-9,
      `${countryId} normalized shares must sum to 1.00, got ${sum}`
    );
    assert.ok(
      shares.every((v) => Number.isFinite(v) && v > 0),
      `${countryId} shares must be positive`
    );
  }

  // Recompute the country seed exactly like worldBuilder does and verify that
  // adding districts did not change the country's total population.
  const topo = worldData as unknown as {
    objects: { countries: unknown };
  };
  const geoCollection = feature(
    topo as never,
    topo.objects.countries as never
  ) as unknown as { features: { id?: string; properties?: { name?: string } }[] };
  const filtered = geoCollection.features.filter(
    (f) =>
      String(f.id) !== '010' &&
      f.properties?.name !== 'Antarctica'
  );
  const metaById = new Map<string, { rawName: string; index: number }>();
  filtered.forEach((f, idx) => {
    metaById.set(String(f.id || `90${idx}`).padStart(3, '0'), {
      rawName: f.properties?.name || '',
      index: idx,
    });
  });

  const world = initializeWorld2026('STANDARD_2026');
  for (const countryId of ['792', '840', '276', '356', '643', '616']) {
    const meta = metaById.get(countryId);
    assert.ok(meta, `Country ${countryId} must exist in the atlas`);
    const seed = buildSeedForFeature(countryId, meta!.rawName, meta!.index);
    const provinces = COUNTRY_PROVINCE_SEEDS[countryId]
      .map((s) =>
        world.territories[s.isCapital ? countryId : `${countryId}_${s.suffixId}`]
      )
      .filter(Boolean);
    const totalPopulation = provinces.reduce((acc, p) => acc + p!.population, 0);
    assert.ok(
      Math.abs(totalPopulation - seed.population) <=
        Math.max(10, seed.population * 0.005),
      `${countryId} total population must stay ${seed.population}, got ${totalPopulation}`
    );

    const totalArmy = provinces.reduce((acc, p) => acc + p!.garrison, 0);
    assert.ok(
      Math.abs(totalArmy - seed.garrison) <= Math.max(20, seed.garrison * 0.02),
      `${countryId} starting army must stay ${seed.garrison}, got ${totalArmy}`
    );

    const expectedGdp = Math.round(seed.baseGdp * 1.15);
    const totalGdp = provinces.reduce((acc, p) => acc + p!.baseGdp, 0);
    assert.ok(
      Math.abs(totalGdp - expectedGdp) <= Math.max(6, expectedGdp * 0.05),
      `${countryId} total GDP must stay ${expectedGdp}, got ${totalGdp}`
    );
  }
});

test('2026 uses modern names while 1444 uses period sancak/eyalet names', () => {
  const modern = initializeWorld2026('STANDARD_2026');
  const historic = initializeWorld2026('EMPIRES_1440');

  const expectations: [string, string, string][] = [
    ['792_GZP', 'Gaziantep', 'Ayıntab'],
    ['792_MAN', 'Manisa', 'Saruhan'],
    ['792_BAL', 'Balıkesir', 'Karesi'],
    ['792_KOC', 'Kocaeli', 'İznikmid'],
    ['792_URF', 'Şanlıurfa', 'Ruha'],
    ['792_DYB', 'Diyarbakır', 'Amid'],
    ['643_PSK', 'Pskov', 'Pskov'],
    ['392_KIJ', 'Niigata', 'Echigo'],
    ['392', 'Tokyo', 'Edo'],
    ['250_LIL', 'Lille', 'Flandre'],
    ['250_MPL', 'Montpellier', 'Languedoc'],
    ['484', 'Meksiko', '★ Tenochtitlan'],
  ];

  for (const [provinceId, modernName, periodName] of expectations) {
    assert.equal(
      modern.territories[provinceId]?.name,
      modernName,
      `${provinceId} must keep its modern 2026 name`
    );
    assert.equal(
      historic.territories[provinceId]?.name,
      periodName,
      `${provinceId} must use its 1444 period name`
    );
  }

  const periodNames = getHistoricProvinceNames();
  assert.ok(
    Object.keys(periodNames).length >= 500,
    `Expected >= 500 period names, got ${Object.keys(periodNames).length}`
  );
  assert.equal(periodNames['792_GZP'], 'Ayıntab');
  assert.equal(periodNames['392_KIJ'], 'Echigo');
  assert.equal(periodNames['250_LIL'], 'Flandre');

  // Modern-only names must never leak into the 1444 scenario for renamed ids.
  for (const [provinceId, modernName] of expectations) {
    if (modernName === historic.territories[provinceId]?.name) continue;
    assert.notEqual(
      historic.territories[provinceId]?.name,
      modernName,
      `${provinceId} must not show its modern name in 1444`
    );
  }
});

test('three-stage label LOD keeps distant maps clean and reveals districts only when zoomed', () => {
  const desktop = getMapLabelThresholds('BALANCED', false);
  const mobile = getMapLabelThresholds('BALANCED', true);

  assert.ok(desktop.nationNameMaxZoom <= desktop.capitalNameMinZoom);
  assert.ok(desktop.capitalNameMinZoom < desktop.provinceNameMinZoom);
  assert.ok(desktop.provinceNameMinZoom < desktop.districtNameMinZoom);
  assert.ok(
    desktop.districtNameMinZoom >= 2.4,
    'Districts should only appear at >= 2.4x on desktop'
  );
  assert.ok(
    mobile.districtNameMinZoom >= 2.8,
    'Districts should only appear at >= 2.8x on mobile'
  );

  assert.equal(shouldRenderProvinceLabel('district', 0.5, desktop, true), true);
  assert.equal(
    shouldRenderProvinceLabel('district', desktop.districtNameMinZoom - 0.01, desktop, false),
    false
  );
  assert.equal(
    shouldRenderProvinceLabel('district', desktop.districtNameMinZoom, desktop, false),
    true
  );
  assert.equal(shouldRenderProvinceLabel('city', 2.5, desktop, false), true);
  assert.equal(shouldRenderProvinceLabel('capital', 1.45, desktop, false), true);
  assert.equal(shouldRenderProvinceLabel('capital', 1.3, desktop, false), false);

  // Density setting still shifts the thresholds (COMPACT later, DETAILED earlier).
  const compact = getMapLabelThresholds('COMPACT', false);
  const detailed = getMapLabelThresholds('DETAILED', false);
  assert.ok(compact.districtNameMinZoom > desktop.districtNameMinZoom);
  assert.ok(detailed.districtNameMinZoom < desktop.districtNameMinZoom);
  assert.ok(compact.capitalNameMinZoom > desktop.capitalNameMinZoom);
  assert.ok(detailed.capitalNameMinZoom < desktop.capitalNameMinZoom);
});

test('1444 great-power ranking is preserved after the district expansion', () => {
  const world1440 = initializeWorld2026('EMPIRES_1440');
  const totals: Record<string, { gdp: number; army: number }> = {};
  for (const territory of Object.values(world1440.territories)) {
    const bucket = (totals[territory.ownerId] ??= { gdp: 0, army: 0 });
    bucket.gdp += territory.baseGdp;
    bucket.army += territory.garrison;
  }

  const topGdp = Object.entries(totals)
    .sort((a, b) => b[1].gdp - a[1].gdp)
    .slice(0, 8)
    .map(([id]) => id);
  for (const greatPower of ['156', '792', '818', '364', '276', '250']) {
    assert.ok(
      topGdp.includes(greatPower),
      `Great power ${greatPower} must remain in the 1444 GDP top 8, got ${topGdp.join(',')}`
    );
  }

  const topArmy = Object.entries(totals)
    .sort((a, b) => b[1].army - a[1].army)
    .slice(0, 5)
    .map(([id]) => id);
  assert.ok(topArmy.includes('156'), 'Ming must lead the 1444 army ranking');
  assert.ok(topArmy.includes('792'), 'Ottoman army must stay in the 1444 top 5');
});

test('~900-province world build stays within the interactive start budget', () => {
  const startedAt = performance.now();
  const world = initializeWorld2026('STANDARD_2026');
  const elapsed = performance.now() - startedAt;

  assert.ok(world.features.length >= 880 && world.features.length <= 920);
  assert.ok(
    elapsed < 1500,
    `World creation with ~900 provinces took ${elapsed.toFixed(0)}ms (budget 1500ms, target 350ms)`
  );
});


function createStubCanvasContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const base: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => gradient,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    canvas: { width: 800, height: 600 },
  };
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

test('canvas labels render without errors at every LOD stage with ~900 provinces', () => {
  const world = initializeWorld2026('STANDARD_2026');
  const projection = geoMercator().scale(120).translate([400, 300]);
  const ctx = createStubCanvasContext();

  // Overview → capitals → major cities → districts → deep zoom.
  for (const k of [0.8, 1.45, 1.9, 2.5, 3.4]) {
    assert.doesNotThrow(() =>
      renderMapLabelsAndBattles({
        ctx,
        width: 800,
        height: 600,
        transform: { x: 0, y: 0, k },
        visibleFeatures: world.features,
        territories: world.territories,
        nations: world.nations,
        relations: world.relations,
        wars: [],
        battles: [],
        projection,
        mapMode: 'POLITICAL',
        mapLabelDensity: 'BALANCED',
        mapLabelScaleMultiplier: 1,
        playerNationId: '792',
        selectedTerritoryId: '792_GZP',
        armyOrderSourceId: null,
        fogOfWarEnabled: false,
        visibleTerritoryIds: new Set(Object.keys(world.territories)),
      })
    );
  }
});
