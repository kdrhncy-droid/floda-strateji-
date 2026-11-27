import test from 'node:test';
import assert from 'node:assert/strict';
import { ARMY_GENERATIONS_1440, ARMY_GENERATIONS_2026 } from '../data/techAndArmyTiers';
import {
  deconflictNeighborColors,
  initializeWorld2026,
  rgbColorDistance,
} from './worldBuilder';
import {
  COUNTRY_PROVINCE_SEEDS,
  getHistoricProvinceNames,
  getNormalizedProvinceShares,
} from './polygonSubdivider';
import { EMPIRES_1440_DEFS } from './scenario1440Builder';
import { MUSIC_TRACKS } from './musicEngine';
import { buildSeedForFeature } from '../data/world2026Data';
import {
  getNationTag,
  getNationTagForMode,
  resolveNationRuntimeId,
} from '../data/nationTagRegistry';
import {
  HISTORICAL_DYNASTIES_1440,
  MODERN_2026_FIRST_NAMES,
} from '../data/historicalDynasties';
import { hydrateSavedPayload } from './saveManager';
import {
  cleanNationName,
  cleanProvinceName,
  formatTroopsShort,
  normalizeFlagCode,
} from '../utils/formatters';
import {
  formatProvinceMapLabel,
  getMapLabelThresholds,
  renderMapLabelsAndBattles,
  shouldRenderProvinceLabel,
} from '../map/mapLabelsAndUnitsRenderer';
import { geoArea, geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { Nation, Territory } from '../types/game';
import {
  mkFaz3Nation,
  mkFaz3Territory,
  geometryContainsPointForTest,
  createStubCanvasContext,
} from '../testHelpers/mockWorldFactories';

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

  // Verify offline orchestral MP3 track catalog (no procedural Web Audio synth tracks)
  assert.ok(
    MUSIC_TRACKS.length >= 4,
    'Should include at least 4 offline orchestral MP3 tracks'
  );
  assert.ok(
    MUSIC_TRACKS.every(
      (t) =>
        typeof t.audioUrl === 'string' &&
        t.audioUrl.endsWith('.mp3') &&
        t.bpm >= 80 &&
        t.bpm <= 160 &&
        t.title.length > 0
    ),
    'All offline music tracks must be real MP3 recordings with valid BPM and title'
  );
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

  assert.equal(countByOwner('818').length, 33, 'Mamluk Sultanate should have 33 provinces (including Tabuk & Taif)');
  assert.equal(countByOwner('156').length, 35, 'Ming Dynasty should have 35 provinces (Tarim belongs to Chagatai)');
  assert.equal(countByOwner('276').length, 21, 'Holy Roman Empire should have 21 provinces (including Pomerania/Stettin)');
  assert.equal(countByOwner('250').length, 18, 'Kingdom of France should have 18 metropolitan provinces');
  assert.equal(world1440.territories['250_CAY'].ownerId, '170', 'Guiana should belong to South America in 1444');
  assert.equal(countByOwner('724').length, 21, 'Castile & Aragon should have 21 provinces (including unified Sicily & Sardinia)');
  assert.equal(countByOwner('348').length, 15, 'Kingdom of Hungary should have 15 provinces (including Transylvania & Ungvar)');
  assert.equal(world1440.territories['642_CLJ'].ownerId, '348', 'Transylvania should belong to Hungary');
  assert.equal(countByOwner('392').length, 14, 'Ashikaga Japan should have 14 provinces');
  assert.equal(countByOwner('826').length, 11, 'Kingdom of England should have 11 provinces');
  assert.equal(countByOwner('905').length, 3, 'Kingdom of Scotland should have 3 cities');
  assert.equal(world1440.territories['826_EDI'].ownerId, '905', 'Edinburgh should belong to Scotland');
  assert.equal(world1440.territories['826_INV'].ownerId, '905', 'Inverness should belong to Scotland');
  assert.equal(countByOwner('616').length, 10, 'Kingdom of Poland should have 10 provinces');
  assert.equal(world1440.territories['616_GDN'].ownerId, '428', 'Marienburg/Danzig should belong to Teutonic Order');
  assert.equal(world1440.territories['643_KGD'].ownerId, '428', 'Konigsberg should belong to Teutonic Order');
  assert.equal(world1440.territories['440_KLP'].ownerId, '428', 'Memel should belong to Teutonic Order');
  assert.equal(countByOwner('440').length, 11, 'Grand Duchy of Lithuania should have 11 provinces');
  assert.equal(world1440.territories['804'].ownerId, '440', 'Kiev should belong to Lithuania');
  assert.equal(countByOwner('642').length, 3, 'Wallachia should have 3 provinces');
  assert.equal(countByOwner('498').length, 5, 'Moldavia should have 5 provinces');
  assert.equal(world1440.territories['642_IAS'].ownerId, '498', 'Iasi should belong to Moldavia');
  assert.equal(countByOwner('902').length, 10, 'Great Horde & Kazan should have 10 contiguous Volga-Ural provinces');
  assert.equal(countByOwner('903').length, 19, 'Sibir & Manchuria should have 19 contiguous Siberian provinces');
  assert.equal(countByOwner('643').length, 12, 'Muscovy should have 12 western Rus provinces');
  assert.equal(world1440.nations['031'].capitalTerritoryId, '364_TBZ', 'Karakoyunlu capital should be Tabriz');
  assert.equal(world1440.nations['364'].capitalTerritoryId, '860_SKD', 'Timurid capital should be Samarkand');
});

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
    desktop.capitalNameMinZoom >= 2.0,
    'Capitals and cities must disappear when zooming out below 2.0x on desktop'
  );
  assert.ok(
    mobile.capitalNameMinZoom >= 2.2,
    'Capitals and cities must disappear when zooming out below 2.2x on mobile'
  );
  assert.ok(
    desktop.districtNameMinZoom >= 3.0,
    'Districts should only appear at >= 3.0x on desktop'
  );
  assert.ok(
    mobile.districtNameMinZoom >= 3.3,
    'Districts should only appear at >= 3.3x on mobile'
  );

  // Selected province stays visible even when zoomed out
  assert.equal(shouldRenderProvinceLabel('district', 0.5, desktop, true), true);
  assert.equal(shouldRenderProvinceLabel('city', 1.8, desktop, false), false);
  assert.equal(shouldRenderProvinceLabel('capital', 1.8, desktop, false), false);
  assert.equal(
    shouldRenderProvinceLabel('district', desktop.districtNameMinZoom - 0.01, desktop, false),
    false
  );
  assert.equal(
    shouldRenderProvinceLabel('district', desktop.districtNameMinZoom, desktop, false),
    true
  );
  assert.equal(
    shouldRenderProvinceLabel('city', desktop.provinceNameMinZoom, desktop, false),
    true
  );
  assert.equal(
    shouldRenderProvinceLabel('capital', desktop.capitalNameMinZoom, desktop, false),
    true
  );

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

test('all 1444 mainland realms form contiguous regions with unique city names and spaced Voronoi seeds', () => {
  const world2026 = initializeWorld2026('STANDARD_2026');
  const world1440 = initializeWorld2026('EMPIRES_1440');

  // 1. No duplicate city names within the same realm in either scenario
  for (const [label, w] of [
    ['STANDARD_2026', world2026],
    ['EMPIRES_1440', world1440],
  ] as const) {
    const seenByOwner = new Map<string, Set<string>>();
    for (const terr of Object.values(w.territories)) {
      const normalized = terr.name.replace(/^★\s*/, '');
      let ownerSet = seenByOwner.get(terr.ownerId);
      if (!ownerSet) {
        ownerSet = new Set<string>();
        seenByOwner.set(terr.ownerId, ownerSet);
      }
      assert.ok(
        !ownerSet.has(normalized),
        `Duplicate province name "${normalized}" (${terr.id}) in ${label} realm ${terr.ownerId}`
      );
      ownerSet.add(normalized);
    }
  }

  // 2. Key mainland 1444 realms must each form a single connected landmass component
  const contiguousRealms1440 = [
    '902', '903', '643', '804', '642', '348', '498', '905', '826', '372',
    '428', '440', '616', '276', '250', '170', '268', '904', '356', '050',
    '860', '364', '840', '906', '124',
  ];
  for (const ownerId of contiguousRealms1440) {
    const ownedIds = Object.values(world1440.territories)
      .filter((t) => t.ownerId === ownerId)
      .map((t) => t.id);
    const ownedSet = new Set(ownedIds);
    assert.ok(ownedIds.length > 0, `Realm ${ownerId} must own >= 1 territory`);

    const visited = new Set<string>([ownedIds[0]]);
    const queue = [ownedIds[0]];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const n of world1440.territories[cur].neighbors) {
        if (ownedSet.has(n) && !visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    const unreached = ownedIds.filter((id) => !visited.has(id));
    assert.equal(
      unreached.length,
      0,
      `1444 realm ${ownerId} (${world1440.nations[ownerId]?.name}) has disconnected exclaves: ${unreached.join(', ')}`
    );
  }

  // 3. No near-duplicate Voronoi seeds within the same base country (< 0.40 deg)
  const seedsByBase = new Map<string, { id: string; name: string; centroid: [number, number] }[]>();
  for (const terr of Object.values(world2026.territories)) {
    const base = terr.id.split('_')[0];
    let arr = seedsByBase.get(base);
    if (!arr) {
      arr = [];
      seedsByBase.set(base, arr);
    }
    arr.push(terr);
  }
  for (const [, list] of seedsByBase) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const dist = Math.hypot(
          list[i].centroid[0] - list[j].centroid[0],
          list[i].centroid[1] - list[j].centroid[1]
        );
        assert.ok(
          dist >= 0.4,
          `Overlapping seeds in ${list[i].id} (${list[i].name}) vs ${list[j].id} (${list[j].name}): ${dist.toFixed(3)} deg`
        );
      }
    }
  }
});

test('polygon subdivision eliminates collinear sea bridges, keeps Chalkidiki inside Selanik, and avoids cross-bay city slivers', () => {
  const world2026 = initializeWorld2026('STANDARD_2026');
  const byId = new Map(world2026.features.map((f) => [f.id, f]));

  const ptSegDist = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
  ) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) return { d: Math.hypot(px - ax, py - ay), t: 0 };
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
  };

  let totalSpikes = 0;
  const badSubFeatures: string[] = [];
  for (const feat of world2026.features) {
    const polys =
      feat.geometry.type === 'Polygon'
        ? [feat.geometry.coordinates]
        : feat.geometry.type === 'MultiPolygon'
        ? feat.geometry.coordinates
        : [];
    for (const poly of polys) {
      const ring = poly[0];
      if (!ring || ring.length < 4) continue;
      const pts = ring.slice(0, -1);
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const lenA = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (lenA < 1e-4) continue;
        for (let j = i + 1; j < n; j++) {
          const c = pts[j];
          const d = pts[(j + 1) % n];
          const lenB = Math.hypot(d[0] - c[0], d[1] - c[1]);
          if (lenB < 1e-4) continue;
          const cross =
            ((b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])) /
            (lenA * lenB);
          const dot =
            ((b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1])) /
            (lenA * lenB);
          if (Math.abs(cross) < 1e-4 && dot < -0.999) {
            const distC = ptSegDist(c[0], c[1], a[0], a[1], b[0], b[1]);
            const distD = ptSegDist(d[0], d[1], a[0], a[1], b[0], b[1]);
            const distA = ptSegDist(a[0], a[1], c[0], c[1], d[0], d[1]);
            const distB = ptSegDist(b[0], b[1], c[0], c[1], d[0], d[1]);
            if (
              Math.min(distC.d, distD.d) < 1e-4 &&
              ((distC.d < 1e-4 && distC.t > 0.01 && distC.t < 0.99) ||
                (distD.d < 1e-4 && distD.t > 0.01 && distD.t < 0.99) ||
                (distA.d < 1e-4 && distA.t > 0.01 && distA.t < 0.99) ||
                (distB.d < 1e-4 && distB.t > 0.01 && distB.t < 0.99) ||
                (distC.d < 1e-4 && distD.d < 1e-4))
            ) {
              totalSpikes++;
              if (feat.id !== '729_NYL') {
                badSubFeatures.push(feat.id);
              }
            }
          }
        }
      }
    }
  }

  assert.deepEqual(
    badSubFeatures,
    [],
    `No subdivided or dateline province should have collinear bridge spikes, found: ${badSubFeatures.join(', ')}`
  );
  assert.ok(totalSpikes <= 1, `Expected <= 1 natural raw hairpin total, got ${totalSpikes}`);

  // Selanik (300_SKG) must hold all of Chalkidiki cleanly as a single Polygon,
  // and Volos (300_VOL) must stay south on the Thessalian mainland without crossing the sea.
  const selanik = byId.get('300_SKG');
  const volos = byId.get('300_VOL');
  assert.equal(selanik?.geometry.type, 'Polygon', 'Selanik must be a single Polygon');
  assert.equal(volos?.geometry.type, 'Polygon', 'Volos must be a single Polygon');
  assert.equal(
    geometryContainsPointForTest(selanik!.geometry as unknown as { type: string; coordinates: unknown }, 23.6, 40.15),
    true,
    'Chalkidiki peninsula must stay inside Selanik'
  );
  assert.equal(
    geometryContainsPointForTest(volos!.geometry as unknown as { type: string; coordinates: unknown }, 23.6, 39.98),
    false,
    'Volos must not steal the tip of Chalkidiki across the sea'
  );
  const volosMaxLat = Math.max(
    ...((volos!.geometry as { coordinates: number[][][] }).coordinates[0].map((p) => p[1]))
  );
  assert.ok(
    volosMaxLat < 39.85,
    `Volos northernmost latitude must stay below 39.85°, got ${volosMaxLat.toFixed(3)}`
  );

  // Cities that previously had detached cross-strait/border slivers must remain single Polygons
  for (const cleanPolyId of ['792_BAL', '276_FBG', '392_SPK', '156_CAN', '643_AND']) {
    const f = byId.get(cleanPolyId);
    assert.equal(
      f?.geometry.type,
      'Polygon',
      `${cleanPolyId} (${world2026.territories[cleanPolyId]?.name}) must be a single contiguous Polygon`
    );
  }
});

test('1440 Mamluk unification includes 682_TBK and 682_TIF and neighbor nations maintain distinct colors', () => {
  const world1440 = initializeWorld2026('EMPIRES_1440');
  assert.equal(world1440.territories['682_TBK']?.ownerId, '818');
  assert.equal(world1440.territories['682_TIF']?.ownerId, '818');

  const testNations: Record<string, Nation> = {
    '818': { id: '818', name: 'Memlük Sultanlığı', color: '#D97706' } as Nation,
    N_NEIGH: { id: 'N_NEIGH', name: 'Komşu Emirlik', color: '#DA7807' } as Nation,
  };
  const testTerritories: Record<string, Territory> = {
    M1: { id: 'M1', ownerId: '818', neighbors: ['K1'] } as Territory,
    K1: { id: 'K1', ownerId: 'N_NEIGH', neighbors: ['M1'] } as Territory,
  };
  deconflictNeighborColors(testNations, testTerritories, 58);
  assert.ok(
    rgbColorDistance(testNations['818'].color, testNations.N_NEIGH.color) >= 58,
    'Adjacent nations must be separated by at least 58 RGB distance'
  );
});

test('JSON nation tag registry resolves readable tags bidirectionally and populates Nation.tag across eras and legacy saves', () => {
  // Bidirectional registry lookup
  assert.equal(resolveNationRuntimeId('OTT', '1440'), '792');
  assert.equal(resolveNationRuntimeId('BYZ', '1440'), '300');
  assert.equal(resolveNationRuntimeId('GOL', '1440'), '902');
  assert.equal(resolveNationRuntimeId('TUR', '2026'), '792');
  assert.equal(getNationTag('792', '1440'), 'OTT');
  assert.equal(getNationTag('792', '2026'), 'TUR');
  assert.equal(getNationTagForMode('792', 'EMPIRES_1440'), 'OTT');
  assert.equal(getNationTagForMode('792', 'STANDARD_2026'), 'TUR');

  // 1440 JSON scenario populates unique tags & 11 starting relations
  const world1440 = initializeWorld2026('EMPIRES_1440');
  const tags1440 = Object.values(world1440.nations).map((n) => n.tag);
  assert.ok(
    tags1440.every((tag) => typeof tag === 'string' && tag.trim().length > 0),
    'Every 1440 empire must carry a non-empty readable tag'
  );
  assert.equal(
    new Set(tags1440).size,
    tags1440.length,
    'Every 1440 empire tag must be unique'
  );
  assert.equal(world1440.nations['792'].tag, 'OTT');
  assert.equal(world1440.nations['300'].tag, 'BYZ');
  assert.equal(world1440.nations['818'].tag, 'MEM');
  assert.equal(world1440.nations['902'].tag, 'GOL');

  const relCount1440 = Object.keys(world1440.relations).length;
  assert.equal(relCount1440, 11, `Expected all 11 historical 1440 starting relations, got ${relCount1440}`);
  const ottByzRel = world1440.relations['300_792'] ?? world1440.relations['792_300'];
  assert.equal(ottByzRel?.score, -70, 'OTT-BYZ starting relation score must be -70');
  const hunPolRel = world1440.relations['348_616'] ?? world1440.relations['616_348'];
  assert.equal(hunPolRel?.isAllied, true, 'HUN-POL must start allied in 1440');

  // 2026 JSON preset populates readable tags
  const world2026 = initializeWorld2026('STANDARD_2026');
  assert.equal(world2026.nations['792'].tag, 'TUR');
  assert.equal(world2026.nations['840'].tag, 'USA');

  // Dual-key JSON dynasty & ruler lookup
  assert.equal(
    HISTORICAL_DYNASTIES_1440['OTT'],
    HISTORICAL_DYNASTIES_1440['792'],
    'HISTORICAL_DYNASTIES_1440 must resolve identically by tag OTT and numeric ID 792'
  );
  assert.ok(HISTORICAL_DYNASTIES_1440['OTT'].length >= 3);
  assert.equal(
    MODERN_2026_FIRST_NAMES['TUR'],
    MODERN_2026_FIRST_NAMES['792'],
    'MODERN_2026_FIRST_NAMES must resolve identically by tag TUR and numeric ID 792'
  );

  // Legacy save hydration backfills missing Nation.tag
  const legacyNation1440 = { ...world1440.nations['792'] };
  delete legacyNation1440.tag;
  const hydrated1440 = hydrateSavedPayload(
    {
      gameMode: 'EMPIRES_1440',
      playerNationId: '792',
      nations: { '792': legacyNation1440 },
      territories: {},
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      tick: 12,
    },
    {},
    {}
  );
  assert.equal(hydrated1440.nations['792'].tag, 'OTT');

  const legacyNation2026 = { ...world2026.nations['792'] };
  delete legacyNation2026.tag;
  const hydrated2026 = hydrateSavedPayload(
    {
      gameMode: 'STANDARD_2026',
      playerNationId: '792',
      nations: { '792': legacyNation2026 },
      territories: {},
      relations: {},
      wars: [],
      battles: [],
      movements: [],
      newsEvents: [],
      tick: 12,
    },
    {},
    {}
  );
  assert.equal(hydrated2026.nations['792'].tag, 'TUR');
});
