import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustAggressiveExpansionGain,
  adjustOccupiedUnrestDrift,
  calculateNationEconomy,
  computeNationNavalBonus,
  computeNavalBlockadedTerritoryIds,
  getOrCreateRelation,
  getWarScoreForNation,
  isAtWar,
  resolveWarParticipants,
} from './simulationEngine';
import { computeGameTick } from './tickEngine';
import { evaluateWartimeAiOperations, evaluateWeeklyUnrestAndRebellions } from './aiAndRebellionEngine';
import { buildNationDiplomacySummary } from './nationDiplomacySummary';
import {
  batchAssimilateDomain,
  enactReformDomain,
  executeArmyMoveDomain,
  executeBatchArmyMoveDomain,
  formEmpireDomain,
  resolveCrisisDomain,
  siegeBombardmentDomain,
} from './empireAndArmyActions';
import {
  calculateProvincePeaceScoreCost,
  calculateProvincePurchasePrice,
  calculateVassalAnnexCost,
  calculateWarPeaceBudget,
  callAllyToWarDomain,
  canAcceptLandPurchase,
  evaluateLandPurchaseDomain,
  executeDiplomaticActionDomain,
  issueProvinceUltimatumDomain,
  resolvePeaceConferenceDomain,
  resolvePeaceDealDomain,
  resolveTacticalBattleOutcomeDomain,
  respondToDiplomaticOfferDomain,
} from './diplomacyAndWarActions';
import { pruneDeadAlliances } from './seasonSupplyAndAiProfile';
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
  assert.equal(halfMove?.troops, 6000);
  assert.equal(halfDeparture?.garrison, 6000);
  assert.equal(
    halfMove?.units.infantry + halfMove?.units.armor + halfMove?.units.airDrone,
    6000
  );
  assert.equal(
    halfDeparture?.units.infantry +
      halfDeparture?.units.armor +
      halfDeparture?.units.airDrone,
    6000
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
  assert.equal(fullMoveRes.movements?.[0].troops, 12000);
  assert.equal(fullMoveRes.territories?.['792'].garrison, 0);
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
  assert.equal(improved.startEnvoy?.mission, 'IMPROVE');
  assert.equal(improved.startEnvoy?.dailyDelta, 3);
  assert.equal(improved.startEnvoy?.daysRemaining, 10);
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
    playerNationId: 'A', nations, territories, relations: {},
    wars: [{
      id: 'w_turan', name: 'Test Savaşı', attackerId: 'A', defenderId: 'B',
      attackers: ['A'], defenders: ['B'], startedTick: 0,
      attackerWarScore: 0, casualtiesAttacker: 0, casualtiesDefender: 0,
    }],
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
  assert.equal(merged.territories?.P2.garrison, 0);
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
      garrison: 250,
      units: { infantry: 250, armor: 0, airDrone: 0 },
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
  assert.equal(confirmed.territories?.edi.garrison, 4250);
  assert.equal(confirmed.territories?.bur.garrison, 3250);
  assert.equal(confirmed.territories?.low.garrison, 250);
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

  let out = computeGameTick({
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

  // Even an empty occupied city starts a 0/100 -> 100/100 siege first
  assert.ok(out.territories.az2.siege, 'Arriving at occupied allied city starts siege');
  for (let i = 0; i < 20 && out.territories.az2.siege; i++) {
    out = computeGameTick({
      tick: out.nextTick,
      hour: out.nextHour,
      hoursStep: 12,
      speed: 5,
      gameMode: 'STANDARD_2026',
      playerNationId: '792',
      nations: out.nations,
      territories: out.territories,
      relations: out.relations,
      wars: out.wars,
      battles: out.battles,
      movements: out.movements,
      seaArmies: out.seaArmies,
      newsEvents: out.newsEvents,
      settings: DEFAULT_GAME_SETTINGS,
    });
  }

  // Territory must be returned to ally '31' with isOccupied = false, NOT '792'!
  assert.equal(out.territories.az2.siege, null);
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

  const queuedOfType = (t: Territory | undefined, type: 'infantry' | 'armor' | 'airDrone') =>
    (t?.recruitmentQueue ?? []).reduce((s, j) => s + (j.units?.[type] || 0), 0);

  // 1. Recruit armor (Cavalry / Tanks) in SINGLE_MAX mode (queues regiments)
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
    queuedOfType(armorMax.territories?.['P2'], 'armor') >= 5000,
    'SINGLE_MAX armor must queue multiple cavalry/armor regiments in target city'
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
    queuedOfType(airBorder.territories?.['P1'], 'airDrone'),
    2000,
    'BORDER airDrone batch recruit must queue artillery/air units in border province P1'
  );
  assert.equal(
    queuedOfType(airBorder.territories?.['P2'], 'airDrone'),
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
    queuedOfType(mixedAll.territories?.['P1'], 'infantry') > 0 &&
      queuedOfType(mixedAll.territories?.['P1'], 'armor') > 0 &&
      queuedOfType(mixedAll.territories?.['P1'], 'airDrone') > 0,
    'MIXED batch recruitment across ALL must queue infantry, armor, and airDrone in P1'
  );
  assert.ok(
    queuedOfType(mixedAll.territories?.['P2'], 'infantry') > 0 &&
      queuedOfType(mixedAll.territories?.['P2'], 'armor') > 0 &&
      queuedOfType(mixedAll.territories?.['P2'], 'airDrone') > 0,
    'MIXED batch recruitment across ALL must queue all 3 unit classes in P2'
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

test('Siege mechanic: small armies (>=300) can march and any army arriving at a 0-garrison unfortified enemy city runs a 0->100 siege bar, accepts reinforcements, and triggers relief battles', async () => {
  const { executeArmyMoveDomain, MIN_MARCH_TROOPS } = await import('./actions/armyMovementActions');
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  assert.equal(MIN_MARCH_TROOPS, 300);

  const nations: Record<string, Nation> = {
    '792': {
      id: '792',
      name: 'Osmanlı',
      capitalTerritoryId: 'att_home',
      treasury: 3000,
      manpower: 20000,
      stability: 80,
      inflation: 2,
      researchPoints: 20,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
    '300': {
      id: '300',
      name: 'Bizans',
      capitalTerritoryId: 'def_cap',
      treasury: 1000,
      manpower: 10000,
      stability: 70,
      inflation: 2,
      researchPoints: 10,
      taxRate: 25,
      budget: { military: 40, economy: 30, research: 15, welfare: 15 },
      aggressiveExpansion: 0,
      unlockedTechs: [],
      enactedReforms: [],
      isEliminated: false,
    } as unknown as Nation,
  };

  const territories: Record<string, Territory> = {
    att_home: {
      id: 'att_home',
      name: 'Edirne',
      ownerId: '792',
      coreOwnerId: '792',
      garrison: 850, // Typical post-conquest survivor stack (< 1500!) must still be able to march!
      units: { infantry: 850, armor: 0, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['empty_city'],
      centroid: [26.5, 41.6],
    } as unknown as Territory,
    att_reinf: {
      id: 'att_reinf',
      name: 'Tekirdağ',
      ownerId: '792',
      coreOwnerId: '792',
      garrison: 8000,
      units: { infantry: 5500, armor: 1500, airDrone: 1000 },
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['empty_city'],
      centroid: [27.5, 41.0],
    } as unknown as Territory,
    empty_city: {
      id: 'empty_city',
      name: 'Silivri',
      ownerId: '300',
      coreOwnerId: '300',
      isDistrict: true,
      garrison: 0, // Zero soldiers inside enemy city!
      units: { infantry: 0, armor: 0, airDrone: 0 },
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['att_home', 'att_reinf', 'def_cap'],
      centroid: [28.2, 41.1],
    } as unknown as Territory,
    def_cap: {
      id: 'def_cap',
      name: 'İstanbul',
      ownerId: '300',
      coreOwnerId: '300',
      isCapital: true,
      garrison: 1200,
      units: { infantry: 1200, armor: 0, airDrone: 0 },
      buildings: { factory: 1, barracks: 1, fortress: 1, university: 0, tradeHub: 0, supplyDepot: 0 },
      neighbors: ['empty_city'],
      centroid: [28.9, 41.0],
    } as unknown as Territory,
  };

  const wars: ActiveWar[] = [
    {
      id: 'w_siege',
      name: 'Trakya Savaşı',
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

  // 1. March 850-troop province (leaves 200 reserve, sends 650 troops!)
  const movePatch = executeArmyMoveDomain({
    fromId: 'att_home',
    toId: 'empty_city',
    territories,
    nations,
    relations: {},
    wars,
    movements: [],
    newsEvents: [],
    playerNationId: '792',
    moveRatio: 1,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    speed: 1,
  });
  assert.equal(movePatch.movements?.length, 1, '850-troop army should dispatch cleanly without hitting 1500 ceiling');
  assert.equal(movePatch.movements?.[0].troops, 850);

  // 2. Arrive at 0-garrison unfortified enemy city -> MUST initiate siege (progress: 0 -> stepped) instead of failing or skipping siege
  const arrivingMove = { ...movePatch.movements![0], progress: 99 };
  let state = computeGameTick({
    tick: 1,
    hour: 10,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: movePatch.nations || nations,
    territories: movePatch.territories!,
    relations: {},
    wars,
    battles: [],
    movements: [arrivingMove],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.ok(state.territories.empty_city.siege, '0-garrison unfortified city must begin a timed siege');
  assert.equal(state.territories.empty_city.ownerId, '300', 'City stays under defender control until siege bar reaches 100/100');
  const progressAfterArrival = state.territories.empty_city.siege!.progress;
  assert.ok(progressAfterArrival > 0 && progressAfterArrival < 100, `Expected partial siege progress (0..100), got ${progressAfterArrival}`);

  // 3. Friendly reinforcement arrival merges into active siege without resetting progress
  const reinfMove: ArmyMovement = {
    id: 'mv_reinf',
    ownerId: '792',
    fromTerritoryId: 'att_reinf',
    toTerritoryId: 'empty_city',
    troops: 6000,
    units: { infantry: 4200, armor: 1000, airDrone: 800 },
    progress: 99,
    isAttack: true,
  };
  state = computeGameTick({
    tick: state.nextTick,
    hour: state.nextHour,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations: state.nations,
    territories: state.territories,
    relations: state.relations,
    wars: state.wars,
    battles: state.battles,
    movements: [reinfMove],
    newsEvents: state.newsEvents,
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.ok(state.territories.empty_city.siege);
  assert.ok(state.territories.empty_city.siege!.attackerTroops >= 6650, 'Reinforcement must merge into besieging stack');
  assert.ok(state.territories.empty_city.siege!.progress >= progressAfterArrival, 'Reinforcing siege must not reset progress');

  // 4. Advance until siege bar hits 100/100 and captures the city!
  for (let i = 0; i < 20 && state.territories.empty_city.siege; i++) {
    state = computeGameTick({
      tick: state.nextTick,
      hour: state.nextHour,
      hoursStep: 12,
      speed: 3,
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: state.nations,
      territories: state.territories,
      relations: state.relations,
      wars: state.wars,
      battles: state.battles,
      movements: state.movements,
      newsEvents: state.newsEvents,
      settings: DEFAULT_GAME_SETTINGS,
    });
  }
  assert.equal(state.territories.empty_city.siege, null, 'Siege clears at 100/100');
  assert.equal(state.territories.empty_city.ownerId, '792', 'City falls once siege bar hits 100/100');

  // 5. Verify relief army arriving on a besieged city starts an ActiveBattle instead of being ignored
  const siegeUnderwayState = computeGameTick({
    tick: 1,
    hour: 10,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories: {
      ...territories,
      empty_city: {
        ...territories.empty_city,
        siege: {
          territoryId: 'empty_city',
          fromTerritoryId: 'att_reinf',
          attackerId: '792',
          defenderId: '300',
          attackerTroops: 2000,
          attackerUnits: { infantry: 2000, armor: 0, airDrone: 0 },
          progress: 50,
          wallIntegrity: 100,
          startedTick: 1,
        },
      },
    },
    relations: {},
    wars,
    battles: [],
    movements: [
      {
        id: 'mv_relief',
        ownerId: '300',
        fromTerritoryId: 'def_cap',
        toTerritoryId: 'empty_city',
        troops: 1000,
        units: { infantry: 1000, armor: 0, airDrone: 0 },
        progress: 99,
        isAttack: false,
      },
    ],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.equal(siegeUnderwayState.battles.length, 1, 'Friendly relief force (>350) arriving at besieged city triggers an immediate battle');
});

test('time-based IMPROVE and DAMAGE envoys progress daily, auto-complete, and withdraw if war breaks out', () => {
  const nations: Record<string, Nation> = {
    A: {
      id: 'A',
      name: 'Osmanlı',
      flagCode: 'TUR',
      color: '#C22222',
      diplomacyPoints: 100,
      capitalTerritoryId: 'A1',
      treasury: 1000,
      manpower: 10000,
      stability: 80,
      inflation: 0,
      researchPoints: 0,
      taxRate: 25,
      budget: { military: 30, economy: 30, research: 20, welfare: 20 },
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    } as unknown as Nation,
    B: {
      id: 'B',
      name: 'Venedik',
      flagCode: 'ITA',
      color: '#2563EB',
      diplomacyPoints: 100,
      capitalTerritoryId: 'B1',
      treasury: 1000,
      manpower: 10000,
      stability: 80,
      inflation: 0,
      researchPoints: 0,
      taxRate: 25,
      budget: { military: 30, economy: 30, research: 20, welfare: 20 },
      unlockedTechs: [],
      enactedReforms: [],
      recruitedGeneralIds: [],
      activeGeneralId: null,
      isEliminated: false,
    } as unknown as Nation,
  };
  const territories: Record<string, Territory> = {
    A1: {
      id: 'A1',
      name: 'Edirne',
      ownerId: 'A',
      coreOwnerId: 'A',
      population: 100,
      baseGdp: 20,
      resource: 'TAHIL',
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      garrison: 1000,
      units: { infantry: 1000, armor: 0, airDrone: 0 },
      unrest: 0,
      isOccupied: false,
      centroid: [26, 41],
      neighbors: ['B1'],
    } as unknown as Territory,
    B1: {
      id: 'B1',
      name: 'Venedik',
      ownerId: 'B',
      coreOwnerId: 'B',
      population: 100,
      baseGdp: 20,
      resource: 'TAHIL',
      buildings: { factory: 0, barracks: 0, fortress: 0, university: 0, tradeHub: 0, supplyDepot: 0 },
      garrison: 1000,
      units: { infantry: 1000, armor: 0, airDrone: 0 },
      unrest: 0,
      isOccupied: false,
      centroid: [12, 45],
      neighbors: ['A1'],
    } as unknown as Territory,
  };

  const improvePatch = executeDiplomaticActionDomain({
    targetNationId: 'B',
    action: 'IMPROVE',
    playerNationId: 'A',
    totalPlayerGarrison: 1000,
    tick: 1,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [],
    movements: [],
    newsEvents: [],
  });
  assert.ok(improvePatch.startEnvoy);
  assert.equal(improvePatch.startEnvoy.mission, 'IMPROVE');
  assert.equal(improvePatch.startEnvoy.dailyDelta, 3);
  assert.equal(improvePatch.startEnvoy.daysRemaining, 10);

  let envoys = [
    {
      ...improvePatch.startEnvoy,
      id: 'envoy_test_1',
      startedTick: 1,
    },
  ];
  let rels: Record<string, DiplomaticRelation> = {};
  let curNations = improvePatch.nations || nations;
  let curTerrs = territories;
  for (let day = 0; day < 10; day++) {
    const step = computeGameTick({
      tick: day + 1,
      hour: 8,
      hoursStep: 24,
      speed: 1,
      gameMode: 'EMPIRES_1440',
      playerNationId: 'A',
      nations: curNations,
      territories: curTerrs,
      relations: rels,
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      diplomaticEnvoys: envoys,
      settings: DEFAULT_GAME_SETTINGS,
    });
    rels = step.relations;
    curNations = step.nations;
    curTerrs = step.territories;
    envoys = step.diplomaticEnvoys || [];
  }
  assert.equal(getOrCreateRelation(rels, 'A', 'B').score, 30, '10 days of +3/day envoy adds +30 score');
  assert.equal(envoys.length, 0, 'Envoy auto-stops after completing 10 days');

  const damagePatch = executeDiplomaticActionDomain({
    targetNationId: 'B',
    action: 'DAMAGE',
    playerNationId: 'A',
    totalPlayerGarrison: 1000,
    tick: 12,
    gameMode: 'EMPIRES_1440',
    nations: curNations,
    territories: curTerrs,
    relations: rels,
    wars: [],
    movements: [],
    newsEvents: [],
  });
  assert.ok(damagePatch.startEnvoy);
  assert.equal(damagePatch.startEnvoy.mission, 'DAMAGE');
  assert.equal(damagePatch.startEnvoy.dailyDelta, -3);

  const stepDamage = computeGameTick({
    tick: 12,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'A',
    nations: damagePatch.nations || curNations,
    territories: curTerrs,
    relations: rels,
    wars: [],
    battles: [],
    movements: [],
    newsEvents: [],
    diplomaticEnvoys: [{ ...damagePatch.startEnvoy, id: 'envoy_dmg_1', startedTick: 12 }],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.equal(getOrCreateRelation(stepDamage.relations, 'A', 'B').score, 27);
  assert.equal(stepDamage.diplomaticEnvoys?.[0]?.daysRemaining, 9);

  // If war breaks out while IMPROVE envoy is active, envoy auto-withdraws
  const warStep = computeGameTick({
    tick: 13,
    hour: 8,
    hoursStep: 24,
    speed: 1,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'A',
    nations: curNations,
    territories: curTerrs,
    relations: rels,
    wars: [
      {
        id: 'w_1',
        name: 'War',
        attackerId: 'A',
        defenderId: 'B',
        attackers: ['A'],
        defenders: ['B'],
        startedTick: 13,
        attackerWarScore: 0,
        casualtiesAttacker: 0,
        casualtiesDefender: 0,
      },
    ],
    battles: [],
    movements: [],
    newsEvents: [],
    diplomaticEnvoys: [{ ...improvePatch.startEnvoy, id: 'envoy_war_stop', startedTick: 12 }],
    settings: DEFAULT_GAME_SETTINGS,
  });
  assert.equal(warStep.diplomaticEnvoys?.length, 0);
});

test('INSULT enforces 5-day cooldown, drops score by 30, grants +1 prestige, and DECLARE_WAR honors selective calledAllyIds & emits warAnnouncement', () => {
  const nations: Record<string, Nation> = {
    A: { id: 'A', name: 'Osmanlı', flagCode: 'TUR', diplomacyPoints: 100, prestige: 10 } as unknown as Nation,
    B: { id: 'B', name: 'Macaristan', flagCode: 'HUN', diplomacyPoints: 100, prestige: 10 } as unknown as Nation,
    C: { id: 'C', name: 'Kırım', flagCode: 'CRI', diplomacyPoints: 100, prestige: 5 } as unknown as Nation,
    D: { id: 'D', name: 'Eflak', flagCode: 'ROU', diplomacyPoints: 100, prestige: 5 } as unknown as Nation,
  };
  const relations: Record<string, DiplomaticRelation> = {
    A_B: {
      nationA: 'A',
      nationB: 'B',
      score: 0,
      isAllied: true,
      allianceType: 'DEFENSIVE',
      hasNonAggression: true,
      hasTradeAgreement: false,
      hasEmbargo: false,
      hasMilitaryAccess: false,
      truceUntilTick: 0,
    },
    A_C: {
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
    A_D: {
      nationA: 'A',
      nationB: 'D',
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

  const insult1 = executeDiplomaticActionDomain({
    targetNationId: 'B',
    action: 'INSULT',
    playerNationId: 'A',
    totalPlayerGarrison: 5000,
    tick: 10,
    gameMode: 'EMPIRES_1440',
    nations,
    territories: {},
    relations,
    wars: [],
    movements: [],
    newsEvents: [],
  });
  assert.equal(insult1.relations?.A_B?.score, -30);
  assert.equal(insult1.relations?.A_B?.isAllied, false);
  assert.equal(insult1.relations?.A_B?.hasNonAggression, false);
  assert.equal(insult1.nations?.A?.prestige, 11);

  const insultTooSoon = executeDiplomaticActionDomain({
    targetNationId: 'B',
    action: 'INSULT',
    playerNationId: 'A',
    totalPlayerGarrison: 5000,
    tick: 12,
    gameMode: 'EMPIRES_1440',
    nations: insult1.nations || nations,
    territories: {},
    relations: insult1.relations || relations,
    wars: [],
    movements: [],
    newsEvents: [],
  });
  assert.match(insultTooSoon.toast || '', /3 gün beklemelisiniz/);

  // War declaration selectively calls ONLY ally C (skipping D) and produces WarAnnouncement
  const warPatch = executeDiplomaticActionDomain({
    targetNationId: 'B',
    action: 'DECLARE_WAR',
    playerNationId: 'A',
    totalPlayerGarrison: 5000,
    tick: 15,
    gameMode: 'EMPIRES_1440',
    nations: insult1.nations || nations,
    territories: {},
    relations: insult1.relations || relations,
    wars: [],
    movements: [],
    newsEvents: [],
    calledAllyIds: ['C'],
  });
  assert.ok(warPatch.wars?.length === 1);
  assert.ok(warPatch.wars![0].attackers.includes('C'));
  assert.ok(!warPatch.wars![0].attackers.includes('D'), 'Unchecked ally D should not be dragged into war');
  assert.ok(warPatch.warAnnouncement);
  assert.equal(warPatch.warAnnouncement?.attackerId, 'A');
  assert.equal(warPatch.warAnnouncement?.defenderId, 'B');
  assert.equal(warPatch.warAnnouncement?.isPlayerAttacker, true);
});

test('Anti-snowball wartime exhaustion and multi-front war weaken economy, manpower, and combat strength', async () => {
  const { calculateNationEconomy, computeCombatStrength } = await import('./simulationEngine');
  const freshNation = mkFaz3Nation('792', {
    treasury: 5000,
    manpower: 20000,
    warExhaustion: 0,
  });
  const exhaustedNation = mkFaz3Nation('792', {
    treasury: 5000,
    manpower: 20000,
    warExhaustion: 75,
  });
  const prov = mkFaz3Territory('P1', {
    ownerId: '792',
    coreOwnerId: '792',
    garrison: 25000,
    units: { infantry: 25000, armor: 0, airDrone: 0 },
    baseGdp: 120,
    population: 120,
  });
  const multiWars: ActiveWar[] = [
    { id: 'w1', name: 'W1', attackerId: '792', defenderId: '300', attackers: ['792'], defenders: ['300'], startedTick: 1, attackerWarScore: 0, casualtiesAttacker: 0, casualtiesDefender: 0 },
    { id: 'w2', name: 'W2', attackerId: '792', defenderId: '818', attackers: ['792'], defenders: ['818'], startedTick: 1, attackerWarScore: 0, casualtiesAttacker: 0, casualtiesDefender: 0 },
    { id: 'w3', name: 'W3', attackerId: '792', defenderId: '380', attackers: ['792'], defenders: ['380'], startedTick: 1, attackerWarScore: 0, casualtiesAttacker: 0, casualtiesDefender: 0 },
  ];

  const peaceEcon = calculateNationEconomy(freshNation, { P1: prov }, { '792': freshNation }, {}, [], []);
  const warEcon = calculateNationEconomy(exhaustedNation, { P1: prov }, { '792': exhaustedNation }, {}, [], multiWars);
  assert.ok(warEcon.militaryUpkeep > peaceEcon.militaryUpkeep * 1.8, 'Multi-front war + high WE must sharply raise military upkeep');
  assert.ok(warEcon.taxIncome < peaceEcon.taxIncome, 'High war exhaustion must reduce tax revenue');
  assert.ok(warEcon.dailyManpower < peaceEcon.dailyManpower, 'High war exhaustion must reduce daily manpower recovery');

  const freshPower = computeCombatStrength(freshNation, prov, false, { infantry: 10000, armor: 0, airDrone: 0 });
  const exhaustedPower = computeCombatStrength(exhaustedNation, prov, false, { infantry: 10000, armor: 0, airDrone: 0 });
  assert.ok(exhaustedPower < freshPower * 0.78, 'High war exhaustion must materially reduce army combat effectiveness');
});

test('Automatic annexation is removed: 100%-occupied enemy stays alive in active war at +100 war score until Peace Conference', async () => {
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');

  const nations: Record<string, Nation> = {
    '792': mkFaz3Nation('792', { name: 'Osmanlı', capitalTerritoryId: 'P1' }),
    '300': mkFaz3Nation('300', { name: 'Bizans', capitalTerritoryId: 'P2' }),
  };
  const territories: Record<string, Territory> = {
    P1: mkFaz3Territory('P1', { ownerId: '792', coreOwnerId: '792', isCapital: true, isOccupied: false }),
    P2: mkFaz3Territory('P2', { ownerId: '792', coreOwnerId: '300', isCapital: true, isOccupied: true }),
  };
  const wars: ActiveWar[] = [
    {
      id: 'war_no_auto_annex',
      name: 'Osmanlı-Bizans Savaşı',
      attackerId: '792',
      defenderId: '300',
      attackers: ['792'],
      defenders: ['300'],
      startedTick: 1,
      attackerWarScore: 60,
      casualtiesAttacker: 1000,
      casualtiesDefender: 3000,
    },
  ];

  const tickRes = computeGameTick({
    tick: 5,
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
    settings: { ...DEFAULT_GAME_SETTINGS, fogOfWarEnabled: false, crisisFrequencyDays: 0 },
  });

  assert.equal(tickRes.nations['300'].isEliminated, false, '100%-occupied warring nation must NOT auto-eliminate');
  assert.equal(tickRes.wars.length, 1, 'War must stay open until Peace Conference is signed');
  assert.equal(tickRes.wars[0].attackerWarScore, 100, '100%-occupied enemy war must report +100 war score');
});

test('Peace AE scales with territory count/value, triggers World Coalition War at 100 AE (Mamluk full annex), and spares minor annexations', async () => {
  const {
    calculateProjectedPeaceAE,
    evaluateWorldCoalitionAt100AE,
  } = await import('./simulationEngine');
  const { resolvePeaceConferenceDomain } = await import('./diplomacyAndWarActions');

  const world = initializeWorld2026('EMPIRES_1440');
  const ottoman = { ...world.nations['792'], aggressiveExpansion: 0 };
  const mamlukTerrIds = Object.values(world.territories)
    .filter((t) => t.ownerId === '818')
    .map((t) => t.id);
  const byzTerrIds = Object.values(world.territories)
    .filter((t) => t.ownerId === '300')
    .map((t) => t.id);

  // Small minor full annexation stays well below 100 AE
  const minorAE = calculateProjectedPeaceAE({
    territories: world.territories,
    demandedTerritoryIds: byzTerrIds.slice(0, 2),
    isFullAnnex: true,
    demandVassal: false,
    conquerorNation: ottoman,
  });
  assert.ok(minorAE.projectedTotal < 45, `Small minor full annex AE (${minorAE.projectedTotal}) must stay well under 100`);
  assert.equal(minorAE.triggersCoalition, false);

  // Day-1 Mamluk full annexation hits 100 AE and triggers World Coalition
  const mamlukAE = calculateProjectedPeaceAE({
    territories: world.territories,
    demandedTerritoryIds: mamlukTerrIds,
    isFullAnnex: true,
    demandVassal: false,
    conquerorNation: ottoman,
  });
  assert.ok(mamlukAE.projectedTotal >= 100, `Full Mamluk annex AE (${mamlukAE.projectedTotal}) must hit 100`);
  assert.equal(mamlukAE.triggersCoalition, true);

  // Triggering Peace Conference with full Mamluk annexation launches a World Coalition War
  const war: ActiveWar = {
    id: 'war_ott_mam',
    name: 'Osmanlı-Memlük Savaşı',
    attackerId: '792',
    defenderId: '818',
    attackers: ['792'],
    defenders: ['818'],
    startedTick: 1,
    attackerWarScore: 100,
    casualtiesAttacker: 5000,
    casualtiesDefender: 15000,
  };
  const occupiedTerrs = { ...world.territories };
  for (const tid of mamlukTerrIds) {
    occupiedTerrs[tid] = { ...occupiedTerrs[tid], ownerId: '792', coreOwnerId: '818', isOccupied: true };
  }
  const peaceRes = resolvePeaceConferenceDomain({
    request: {
      warId: war.id,
      mode: 'PEACE_DEMANDS',
      demandedTerritoryIds: mamlukTerrIds,
      demandVassal: false,
      demandTribute: false,
      demandReparations: false,
    },
    wars: [war],
    nations: { ...world.nations, '792': ottoman },
    territories: occupiedTerrs,
    relations: world.relations,
    playerNationId: '792',
    tick: 30,
    gameMode: 'EMPIRES_1440',
    newsEvents: [],
    movements: [],
    battles: [],
  });
  assert.ok(peaceRes.nations!['792'].aggressiveExpansion >= 100, 'Player AE must reach 100');
  const coalitionWar = (peaceRes.wars ?? []).find((w) => w.isCoalitionWar);
  assert.ok(coalitionWar, 'Reaching 100 AE in Peace Conference must trigger a World Coalition War');
  assert.ok(
    coalitionWar!.attackers.length >= 10,
    `World Coalition must rally living nations against 100-AE aggressor (got ${coalitionWar!.attackers.length})`
  );

  // Direct coalition helper also works for AI aggressors at 100 AE
  const aiRes = evaluateWorldCoalitionAt100AE({
    targetNationId: '250',
    nations: { ...world.nations, '250': { ...world.nations['250'], aggressiveExpansion: 100 } },
    territories: world.territories,
    relations: world.relations,
    wars: [],
    tick: 50,
    gameMode: 'EMPIRES_1440',
    newsEvents: [],
    playerNationId: '792',
  });
  assert.equal(aiRes.triggered, true, 'AI nation reaching 100 AE must also trigger World Coalition War');
});

test('1444 -> 2026 Nuclear Missile doctrine (mil_10) unlocks devastating nuclear strike with AE and cooldown', async () => {
  const { launchNuclearStrikeDomain } = await import('./empireAndArmyActions');
  const nations: Record<string, Nation> = {
    '792': mkFaz3Nation('792', {
      name: 'Osmanlı',
      treasury: 5000,
      aggressiveExpansion: 10,
      unlockedTechs: ['mil_10'],
      lastNuclearStrikeTick: 0,
    }),
    '818': mkFaz3Nation('818', { name: 'Memlük' }),
  };
  const territories: Record<string, Territory> = {
    P_ENEMY: mkFaz3Territory('P_ENEMY', {
      name: 'Kahire',
      ownerId: '818',
      coreOwnerId: '818',
      garrison: 20000,
      units: { infantry: 16000, armor: 4000, airDrone: 0 },
      castleWallHp: 100,
      unrest: 5,
      buildings: { factory: 2, barracks: 2, armyHearth: 1, fortress: 2, university: 1, tradeHub: 1, supplyDepot: 0 },
    }),
  };
  const wars: ActiveWar[] = [
    {
      id: 'war_nuke',
      name: 'Nükleer Test Savaşı',
      attackerId: '792',
      defenderId: '818',
      attackers: ['792'],
      defenders: ['818'],
      startedTick: 1,
      attackerWarScore: 10,
      casualtiesAttacker: 0,
      casualtiesDefender: 0,
    },
  ];

  const strike = launchNuclearStrikeDomain({
    territoryId: 'P_ENEMY',
    territories,
    nations,
    relations: {},
    wars,
    playerNationId: '792',
    tick: 40,
  });
  assert.ok(strike.territories, 'Nuclear strike should succeed when mil_10 is unlocked and at war');
  assert.ok(strike.territories!.P_ENEMY.garrison < 6000, 'Nuclear strike must devastate enemy garrison');
  assert.equal(strike.territories!.P_ENEMY.castleWallHp, 0, 'Nuclear strike must shatter fortress walls');
  assert.ok(strike.nations!['792'].aggressiveExpansion >= 28, 'Nuclear strike must add +18 AE');
});

test('Peacetime ends active battles & sieges returning troops home, and save hydration preserves envoys & sanitizes state', async () => {
  const { computeGameTick } = await import('./tickEngine');
  const { DEFAULT_GAME_SETTINGS } = await import('./gameSettings');
  const { hydrateSavedPayload } = await import('./saveManager');

  const nations: Record<string, Nation> = {
    '792': mkFaz3Nation('792', {
      name: 'Osmanlı',
      capitalTerritoryId: 'P_ATT',
      warExhaustion: 140,
      aggressiveExpansion: -12,
    }),
    '818': mkFaz3Nation('818', {
      name: 'Memlük',
      capitalTerritoryId: 'P_DEF',
      warExhaustion: 25,
      aggressiveExpansion: 40,
    }),
  };

  const territories: Record<string, Territory> = {
    P_ATT: mkFaz3Territory('P_ATT', {
      ownerId: '792',
      coreOwnerId: '792',
      garrison: 2000,
      units: { infantry: 2000, armor: 0, airDrone: 0 },
    }),
    P_DEF: mkFaz3Territory('P_DEF', {
      ownerId: '818',
      coreOwnerId: '818',
      garrison: 0,
      units: { infantry: 0, armor: 0, airDrone: 0 },
      siege: {
        territoryId: 'P_DEF',
        attackerId: '792',
        defenderId: '818',
        attackerTroops: 4500,
        attackerUnits: { infantry: 3500, armor: 1000, airDrone: 0 },
        progress: 92,
        wallIntegrity: 40,
        startedTick: 1,
        fromTerritoryId: 'P_ATT',
      },
    }),
  };

  const tickRes = computeGameTick({
    tick: 10,
    hour: 12,
    hoursStep: 4,
    speed: 2,
    gameMode: 'EMPIRES_1440',
    playerNationId: '792',
    nations,
    territories,
    relations: {},
    wars: [],
    battles: [
      {
        id: 'btl_post_peace',
        territoryId: 'P_DEF',
        fromTerritoryId: 'P_ATT',
        attackerId: '792',
        defenderId: '818',
        attackerTroops: 1500,
        attackerInitialTroops: 1500,
        attackerUnits: { infantry: 1500, armor: 0, airDrone: 0 },
        attackerFrontline: 1500,
        attackerBackline: 0,
        defenderTroops: 1000,
        defenderInitialTroops: 1000,
        defenderUnits: { infantry: 1000, armor: 0, airDrone: 0 },
        defenderFrontline: 1000,
        defenderBackline: 0,
        round: 1,
        combatWidth: 25000,
        attackerMorale: 100,
        defenderMorale: 100,
      },
    ],
    movements: [],
    newsEvents: [],
    settings: DEFAULT_GAME_SETTINGS,
  });

  assert.equal(tickRes.battles.length, 0, 'Active battle must terminate immediately when nations are at peace');
  assert.equal(tickRes.territories.P_DEF.siege, null, 'Active siege must lift immediately during peace');
  assert.equal(tickRes.territories.P_DEF.ownerId, '818', 'City must NOT be captured during peace');
  assert.equal(
    tickRes.territories.P_ATT.garrison,
    2000 + 1500 + 4500,
    'Surviving battle and siege troops must return safely to origin territory'
  );

  const hydrated = hydrateSavedPayload(
    {
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations,
      territories,
      relations: {},
      wars: [],
      battles: [
        {
          id: 'b_orphan',
          territoryId: 'MISSING_PROV',
          attackerId: '792',
          defenderId: '818',
          attackerTroops: 500,
          attackerInitialTroops: 500,
          attackerUnits: { infantry: 500, armor: 0, airDrone: 0 },
          attackerFrontline: 500,
          attackerBackline: 0,
          defenderTroops: 500,
          defenderInitialTroops: 500,
          defenderUnits: { infantry: 500, armor: 0, airDrone: 0 },
          defenderFrontline: 500,
          defenderBackline: 0,
          round: 1,
          combatWidth: 25000,
        },
      ],
      movements: [],
      diplomaticEnvoys: [
        {
          id: 'env_ok',
          targetNationId: '818',
          mission: 'IMPROVE',
          dailyDelta: 2.5,
          daysRemaining: 10,
          totalDays: 14,
          startScore: 10,
          startedTick: 1,
        },
        {
          id: 'env_bad',
          targetNationId: 'GHOST_NATION',
          mission: 'DAMAGE',
          dailyDelta: -2.5,
          daysRemaining: 10,
          totalDays: 14,
          startScore: 0,
          startedTick: 1,
        },
      ],
      newsEvents: [],
      tick: 12,
    },
    nations,
    territories
  );

  assert.equal(hydrated.nations['792'].warExhaustion, 100, 'warExhaustion must be clamped to <= 100');
  assert.equal(hydrated.nations['792'].aggressiveExpansion, 0, 'aggressiveExpansion must be clamped to >= 0');
  assert.equal(hydrated.battles.length, 0, 'Orphan battles referencing missing territories must be filtered out');
  assert.equal(hydrated.diplomaticEnvoys?.length, 1, 'Valid diplomaticEnvoys must survive save hydration');
  assert.equal(hydrated.diplomaticEnvoys?.[0].id, 'env_ok');
});

test('Peace treaties NEVER annex secondary war-ally territories and safely evacuate occupying troops home', () => {
  const nations: Record<string, Nation> = {
    PLR: mkFaz3Nation('PLR', { name: 'Osmanlı', capitalTerritoryId: 'P_HOME' }),
    ENM: mkFaz3Nation('ENM', { name: 'Sırbistan', capitalTerritoryId: 'E_CAP' }),
    ALLY: mkFaz3Nation('ALLY', { name: 'Bosna', capitalTerritoryId: 'A_CAP' }),
  };

  // Player declared war on ENM; ALLY joined alongside ENM (`defenders: ['ENM', 'ALLY']`).
  // Player occupied E_CAP (primary enemy) AND A_OCC (secondary ally), with 5000 player soldiers sitting in A_OCC!
  const territories: Record<string, Territory> = {
    P_HOME: mkFaz3Territory('P_HOME', {
      name: 'Edirne',
      ownerId: 'PLR',
      coreOwnerId: 'PLR',
      isCapital: true,
      garrison: 4000,
      neighbors: ['E_CAP', 'A_OCC'],
    }),
    E_CAP: mkFaz3Territory('E_CAP', {
      name: 'Belgrad',
      ownerId: 'PLR',
      coreOwnerId: 'ENM',
      occupiedFromId: 'ENM',
      isOccupied: true,
      occupiedById: 'PLR',
      isCapital: true,
      garrison: 3000,
      neighbors: ['P_HOME'],
    }),
    A_CAP: mkFaz3Territory('A_CAP', {
      name: 'Saraybosna',
      ownerId: 'ALLY',
      coreOwnerId: 'ALLY',
      isCapital: true,
      garrison: 2500,
      neighbors: ['A_OCC'],
    }),
    A_OCC: mkFaz3Territory('A_OCC', {
      name: 'Travnik',
      ownerId: 'PLR',
      coreOwnerId: 'ALLY',
      occupiedFromId: 'ALLY',
      isOccupied: true,
      occupiedById: 'PLR',
      garrison: 5000,
      neighbors: ['P_HOME', 'A_CAP'],
    }),
  };

  const war: ActiveWar = {
    id: 'w_no_ally_annex',
    name: 'Osmanlı - Sırbistan Savaşı',
    attackerId: 'PLR',
    defenderId: 'ENM',
    attackers: ['PLR'],
    defenders: ['ENM', 'ALLY'],
    startedTick: 1,
    attackerWarScore: 100,
    casualtiesAttacker: 500,
    casualtiesDefender: 4000,
  };

  // 1. `calculateWarPeaceBudget` must ONLY list primary enemy (`ENM`) provinces as claimable
  const budget = calculateWarPeaceBudget(war, 'PLR', territories);
  assert.deepEqual(
    budget.claimableEnemyProvinces.map((t) => t.id),
    ['E_CAP'],
    'Secondary war-ally territories must never appear in claimableEnemyProvinces'
  );

  // 2. Peace Conference (`fullAnnexation: true` or explicit `demandedTerritoryIds` with A_OCC) annexes E_CAP ONLY,
  // restores A_OCC to ALLY, and evacuates the 5000 player soldiers from A_OCC back to P_HOME!
  const confRes = resolvePeaceConferenceDomain({
    request: {
      warId: war.id,
      mode: 'PEACE_DEMANDS',
      fullAnnexation: true,
      demandedTerritoryIds: ['E_CAP', 'A_OCC'],
    },
    playerNationId: 'PLR',
    tick: 25,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [war],
    movements: [],
    battles: [],
    newsEvents: [],
  });

  assert.equal(confRes.wars?.length, 0);
  assert.equal(confRes.territories?.E_CAP.ownerId, 'PLR', 'Primary enemy territory should be annexed');
  assert.equal(confRes.territories?.E_CAP.isOccupied, false);
  assert.equal(confRes.territories?.A_OCC.ownerId, 'ALLY', 'Secondary ally territory MUST be returned to ALLY');
  assert.equal(confRes.territories?.A_OCC.isOccupied, false);
  assert.equal(confRes.territories?.A_CAP.ownerId, 'ALLY', 'Unoccupied secondary ally territory stays with ALLY');
  assert.equal(
    confRes.territories?.P_HOME.garrison,
    9000,
    '5000 player occupying soldiers from restored A_OCC must return safely to P_HOME (4000 + 5000)'
  );
  assert.equal(confRes.nations?.ALLY.isEliminated, false);

  // 3. Quick peace deal (`ANNEX_OCCUPIED`) ALSO spares secondary ally territories and restores A_OCC to ALLY
  const quickDealRes = resolvePeaceDealDomain({
    warId: war.id,
    dealType: 'ANNEX_OCCUPIED',
    playerNationId: 'PLR',
    tick: 25,
    gameMode: 'EMPIRES_1440',
    nations,
    territories,
    relations: {},
    wars: [war],
    newsEvents: [],
  });
  assert.equal(quickDealRes.territories?.E_CAP.ownerId, 'PLR');
  assert.equal(quickDealRes.territories?.A_OCC.ownerId, 'ALLY', 'ANNEX_OCCUPIED must never annex secondary ally territory');
  assert.equal(quickDealRes.territories?.A_OCC.isOccupied, false);
});

test('War balance percentage (`warBalanceScore`) starts at 0%, scales proportionally without double-counting, and stays symmetric', () => {
  const territories: Record<string, Territory> = {};
  for (let i = 1; i <= 10; i++) {
    territories[`P_${i}`] = mkFaz3Territory(`P_${i}`, {
      name: `Oyuncu ${i}`,
      ownerId: 'PLR',
      coreOwnerId: 'PLR',
      garrison: 2000,
    });
    territories[`E_${i}`] = mkFaz3Territory(`E_${i}`, {
      name: `Düşman ${i}`,
      ownerId: 'ENM',
      coreOwnerId: 'ENM',
      garrison: 2000,
    });
  }
  territories.ALLY_1 = mkFaz3Territory('ALLY_1', {
    name: 'Müttefik 1',
    ownerId: 'ALLY',
    coreOwnerId: 'ALLY',
    garrison: 1000,
  });

  const baseWar: ActiveWar = {
    id: 'w_balance_pct',
    name: 'Denge Testi',
    attackerId: 'PLR',
    defenderId: 'ENM',
    attackers: ['PLR'],
    defenders: ['ENM', 'ALLY'],
    startedTick: 1,
    attackerWarScore: 0,
    casualtiesAttacker: 0,
    casualtiesDefender: 0,
  };

  // 1. At war start (tick 1, 0 battles, 0 occupations): warBalanceScore MUST be 0%
  const startInfo = calculateWarPeaceBudget(baseWar, 'PLR', territories);
  assert.equal(startInfo.warBalanceScore, 0);

  // 2. Occupying 1 of 10 primary enemy provinces (with proportional siege score +8) yields ~+9..+12%, NOT +39%!
  const oneOccTerrs: Record<string, Territory> = {
    ...territories,
    E_1: {
      ...territories.E_1,
      ownerId: 'PLR',
      occupiedFromId: 'ENM',
      isOccupied: true,
    },
  };
  const oneOccInfo = calculateWarPeaceBudget(
    { ...baseWar, attackerWarScore: 8 },
    'PLR',
    oneOccTerrs
  );
  assert.ok(
    oneOccInfo.warBalanceScore >= 8 && oneOccInfo.warBalanceScore <= 15,
    `1/10 occupied should give ~9..15% warBalanceScore, got ${oneOccInfo.warBalanceScore}%`
  );

  // 3. Symmetric when enemy occupies 1 of 10 player provinces (-8 war score)
  const oneLostTerrs: Record<string, Territory> = {
    ...territories,
    P_1: {
      ...territories.P_1,
      ownerId: 'ENM',
      occupiedFromId: 'PLR',
      isOccupied: true,
    },
  };
  const oneLostInfo = calculateWarPeaceBudget(
    { ...baseWar, attackerWarScore: -8 },
    'PLR',
    oneLostTerrs
  );
  assert.equal(
    oneLostInfo.warBalanceScore,
    -oneOccInfo.warBalanceScore,
    'War balance percentage must be 100% symmetric between winning and losing'
  );

  // 4. Occupying a secondary ally's sole province does NOT trigger +100% war score against primary enemy
  const allyOccTerrs: Record<string, Territory> = {
    ...territories,
    ALLY_1: {
      ...territories.ALLY_1,
      ownerId: 'PLR',
      occupiedFromId: 'ALLY',
      isOccupied: true,
    },
  };
  const allyOccInfo = calculateWarPeaceBudget(
    { ...baseWar, attackerWarScore: 5 },
    'PLR',
    allyOccTerrs
  );
  assert.equal(allyOccInfo.warBalanceScore, 5);

  // 5. Occupying all 10 of 10 primary enemy provinces reaches +100% even while secondary ally still holds ALLY_1
  const allEnemyOccTerrs: Record<string, Territory> = { ...territories };
  for (let i = 1; i <= 10; i++) {
    allEnemyOccTerrs[`E_${i}`] = {
      ...territories[`E_${i}`],
      ownerId: 'PLR',
      occupiedFromId: 'ENM',
      isOccupied: true,
    };
  }
  const fullOccInfo = calculateWarPeaceBudget(
    { ...baseWar, attackerWarScore: 88 },
    'PLR',
    allEnemyOccTerrs
  );
  assert.equal(fullOccInfo.warBalanceScore, 100);
});
