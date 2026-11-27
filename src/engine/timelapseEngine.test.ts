import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLivePlaybackTimelapse,
  createInitialTimelapse,
  extractTimelapseFromImportedObject,
  getGameYearForTick,
  projectTimelapseToWorldState,
  recordTimelapseProgress,
  reconstructTimelapseState,
  validateCampaignTimelapse,
} from './timelapseEngine';
import { IDEOLOGIES } from '../data/world2026Data';
import { Nation, Territory, WorldNewsEvent } from '../types/game';

function createMockNation(
  id: string,
  name: string,
  color: string,
  capitalTerritoryId: string
): Nation {
  return {
    id,
    name,
    color,
    flagCode: id.slice(0, 2),
    ideology: 'MONARCHY',
    treasury: 1000,
    manpower: 10000,
    taxRate: 25,
    budget: {
      military: 30,
      economy: 30,
      research: 20,
      welfare: 20,
    },
    researchPoints: 0,
    unlockedTechs: [],
    enactedReforms: [],
    recruitedGeneralIds: [],
    activeGeneralId: null,
    stability: 75,
    inflation: 2,
    capitalTerritoryId,
    aggressiveExpansion: 0,
    isEliminated: false,
  };
}

function createMockTerritory(
  id: string,
  name: string,
  ownerId: string,
  isCapital = false
): Territory {
  return {
    id,
    name,
    ownerId,
    coreOwnerId: ownerId,
    population: 500,
    garrison: 5000,
    units: { infantry: 5000, armor: 0, airDrone: 0 },
    unrest: 0,
    baseGdp: 50,
    buildings: {
      factory: 1,
      barracks: 1,
      fortress: 0,
      university: 0,
      tradeHub: 1,
      supplyDepot: 0,
    },
    resource: 'TAHIL',
    terrain: 'OVA',
    isCapital,
    isCoastal: false,
    isOccupied: false,
    neighbors: [],
    centroid: [29, 41],
    siege: null,
  };
}

test('getGameYearForTick handles 1440 leap year and 2026 calendars accurately', () => {
  assert.equal(getGameYearForTick(0, 'EMPIRES_1440'), 1440);
  // 1440 is a leap year (366 days)
  assert.equal(getGameYearForTick(365, 'EMPIRES_1440'), 1440);
  assert.equal(getGameYearForTick(366, 'EMPIRES_1440'), 1441);

  assert.equal(getGameYearForTick(0, 'STANDARD_2026'), 2026);
  // 2026 is not a leap year (365 days)
  assert.equal(getGameYearForTick(364, 'STANDARD_2026'), 2026);
  assert.equal(getGameYearForTick(365, 'STANDARD_2026'), 2027);
});

test('createInitialTimelapse captures baseline owners, start year, frame 0, and START milestone', () => {
  const nations = {
    OTT: createMockNation('OTT', 'Osmanlı Devleti', '#b91c1c', 'EDIRNE'),
    BYZ: createMockNation('BYZ', 'Bizans', '#7e22ce', 'KONST'),
  };
  const territories = {
    EDIRNE: createMockTerritory('EDIRNE', 'Edirne', 'OTT', true),
    BURSA: createMockTerritory('BURSA', 'Bursa', 'OTT', false),
    KONST: createMockTerritory('KONST', 'Konstantinopolis', 'BYZ', true),
  };

  const tl = createInitialTimelapse({
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories,
    tick: 0,
  });

  assert.equal(tl.startYear, 1440);
  assert.equal(tl.frames.length, 1);
  assert.equal(tl.frames[0].year, 1440);
  assert.equal(tl.frames[0].playerProvinceCount, 2);
  assert.equal(tl.frames[0].topNationId, 'OTT');
  assert.deepEqual(tl.initialOwners, {
    EDIRNE: 'OTT',
    BURSA: 'OTT',
    KONST: 'BYZ',
  });
  assert.equal(tl.milestones.length, 1);
  assert.equal(tl.milestones[0].type, 'START');
  assert.ok(IDEOLOGIES[nations.OTT.ideology]);
});

test('recordTimelapseProgress captures delta frames on year rollover, nation updates, and classified milestones', () => {
  const nations = {
    OTT: createMockNation('OTT', 'Osmanlı Beyliği', '#b91c1c', 'EDIRNE'),
    BYZ: createMockNation('BYZ', 'Bizans', '#7e22ce', 'KONST'),
  };
  const territories = {
    EDIRNE: createMockTerritory('EDIRNE', 'Edirne', 'OTT', true),
    BURSA: createMockTerritory('BURSA', 'Bursa', 'OTT', false),
    KONST: createMockTerritory('KONST', 'Konstantinopolis', 'BYZ', true),
  };

  let tl = createInitialTimelapse({
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories,
    tick: 0,
  });

  // Same-year tick does NOT add a redundant frame unless forceYearOrTickSnapshot=true
  tl = recordTimelapseProgress(tl, {
    nextTick: 120,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories,
    newsEvents: [
      {
        id: 'nw_1',
        tick: 90,
        dateStr: '1 Nisan 1440',
        title: 'Osmanlı - Bizans Savaşı Başladı',
        description: 'Sınır ihlali.',
        type: 'WAR',
      },
    ],
  });
  assert.equal(tl.frames.length, 1);
  assert.equal(tl.milestones.some((m) => m.type === 'WAR'), true);

  // Year rollover to 1441 after conquering KONST and forming Ottoman Empire
  const nextNations: Record<string, Nation> = {
    ...nations,
    OTT: {
      ...nations.OTT,
      name: 'Osmanlı İmparatorluğu',
      color: '#dc2626',
      capitalTerritoryId: 'KONST',
    },
  };
  const nextTerritories: Record<string, Territory> = {
    ...territories,
    KONST: {
      ...territories.KONST,
      ownerId: 'OTT',
    },
  };
  const nextNews: WorldNewsEvent[] = [
    {
      id: 'nw_2',
      tick: 366,
      dateStr: '1 Ocak 1441',
      title: 'Osmanlı İmparatorluğu Kuruldu',
      description: 'Yeni çağ.',
      type: 'REFORM',
    },
  ];

  tl = recordTimelapseProgress(tl, {
    nextTick: 366,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations: nextNations,
    territories: nextTerritories,
    newsEvents: nextNews,
  });

  assert.equal(tl.frames.length, 2);
  assert.equal(tl.frames[1].year, 1441);
  // Delta-only: only KONST changed owner
  assert.deepEqual(tl.frames[1].ownerDeltas, { KONST: 'OTT' });
  assert.equal(tl.frames[1].playerProvinceCount, 3);
  assert.ok(tl.frames[1].nationUpdates?.OTT);
  assert.equal(tl.frames[1].nationUpdates?.OTT?.name, 'Osmanlı İmparatorluğu');
  assert.equal(tl.milestones.some((m) => m.type === 'EMPIRE'), true);

  // Frame 0 still reconstructs initial 1440 state cleanly
  const f0 = reconstructTimelapseState(tl, 0);
  assert.equal(f0.owners.KONST, 'BYZ');
  assert.equal(f0.nationSnapshots.OTT.name, 'Osmanlı Beyliği');

  // Frame 1 projects updated empire name, color, capital, and eliminated status
  const projected1 = projectTimelapseToWorldState(tl, 1, territories, nations);
  assert.equal(projected1.territories.KONST.ownerId, 'OTT');
  assert.equal(projected1.territories.KONST.isCapital, true);
  assert.equal(projected1.nations.OTT.name, 'Osmanlı İmparatorluğu');
  assert.equal(projected1.nations.BYZ.isEliminated, true);
});

test('buildLivePlaybackTimelapse appends mid-year tail frame when board changed', () => {
  const nations = {
    OTT: createMockNation('OTT', 'Osmanlı', '#b91c1c', 'EDIRNE'),
    BYZ: createMockNation('BYZ', 'Bizans', '#7e22ce', 'KONST'),
  };
  const territories = {
    EDIRNE: createMockTerritory('EDIRNE', 'Edirne', 'OTT', true),
    KONST: createMockTerritory('KONST', 'Konstantinopolis', 'BYZ', true),
  };
  const tl = createInitialTimelapse({
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories,
    tick: 0,
  });

  const updatedTerritories = {
    ...territories,
    KONST: { ...territories.KONST, ownerId: 'OTT' },
  };
  const liveTl = buildLivePlaybackTimelapse(tl, {
    tick: 25,
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories: updatedTerritories,
  });

  assert.equal(liveTl.frames.length, 2);
  assert.equal(liveTl.frames[1].tick, 25);
  assert.deepEqual(liveTl.frames[1].ownerDeltas, { KONST: 'OTT' });
  assert.equal(liveTl.frames[1].playerProvinceCount, 2);
});

test('extractTimelapseFromImportedObject validates archive JSON, save JSON with embedded timelapse, and rejects invalid payloads', () => {
  const nations = {
    OTT: createMockNation('OTT', 'Osmanlı', '#b91c1c', 'EDIRNE'),
  };
  const territories = {
    EDIRNE: createMockTerritory('EDIRNE', 'Edirne', 'OTT', true),
  };
  const tl = createInitialTimelapse({
    gameMode: 'EMPIRES_1440',
    playerNationId: 'OTT',
    nations,
    territories,
    tick: 0,
  });

  // 1. Standalone Archive record format
  const fromArchive = extractTimelapseFromImportedObject({
    metadata: { id: 'arch_1', title: 'Özel Arşiv' },
    timelapse: tl,
  });
  assert.ok(fromArchive);
  assert.equal(fromArchive.suggestedTitle, 'Özel Arşiv');
  assert.equal(fromArchive.timelapse.playerNationId, 'OTT');

  // 2. SaveSlotRecord format with embedded payload.timelapse
  const fromSave = extractTimelapseFromImportedObject({
    metadata: { slotId: 'SLOT_1' },
    payload: { timelapse: tl },
  });
  assert.ok(fromSave);
  assert.equal(fromSave.timelapse.gameMode, 'EMPIRES_1440');

  // 3. Direct CampaignTimelapse format
  assert.ok(validateCampaignTimelapse(tl));

  // 4. Malformed payloads return null safely
  assert.equal(extractTimelapseFromImportedObject(null), null);
  assert.equal(extractTimelapseFromImportedObject({ foo: 'bar' }), null);
  assert.equal(
    validateCampaignTimelapse({ ...tl, frames: [] }),
    null
  );
});
