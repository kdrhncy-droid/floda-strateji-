import type { ProvinceSubSeed } from './core/provinceSeedTypes';

/**
 * Tier-3 district / sancak expansion seeds.
 *
 * Design rules (see plan):
 *  - Only large & medium countries are subdivided; micro-states and small
 *    islands (Cyprus, Switzerland, Belgium, Lebanon, Luxembourg, ...) are
 *    intentionally left untouched so every province stays thumb-tappable.
 *  - Every entry carries a 2026 modern name plus a 1444 period name
 *    (`historicName`) used only by the Empires of 1444 scenario.
 *  - `gdpShare` values are relative weights; `getNormalizedProvinceShares`
 *    normalizes each country to 1.00 so added districts never inflate a
 *    country's population, GDP or starting army.
 */
const d = (
  suffixId: string,
  name: string,
  lon: number,
  lat: number,
  gdpShare: number,
  historicName: string
): ProvinceSubSeed => ({
  suffixId,
  name,
  lon,
  lat,
  gdpShare,
  historicName,
  isDistrict: true,
});

export const DISTRICT_PROVINCE_SEEDS: Record<string, ProvinceSubSeed[]> = {
  // ── Türkiye / Osmanlı coğrafyası: 20 → 38 ────────────────────────────────
  '792': [
    d('KAY', 'Kayseri', 35.48, 38.72, 0.03, 'Kayseriye'),
    d('MAN', 'Manisa', 27.43, 38.61, 0.028, 'Saruhan'),
    d('BAL', 'Balıkesir', 27.89, 39.65, 0.026, 'Karesi'),
    d('KOC', 'Kocaeli', 29.92, 40.77, 0.03, 'İznikmid'),
    d('HTY', 'Hatay', 36.16, 36.2, 0.024, 'Antakya'),
    d('URF', 'Şanlıurfa', 38.79, 37.17, 0.022, 'Ruha'),
    d('MRD', 'Mardin', 40.74, 37.31, 0.018, 'Mardin'),
    d('AFY', 'Afyonkarahisar', 30.54, 38.76, 0.022, 'Karahisar-ı Sahib'),
    d('DNZ', 'Denizli', 29.09, 37.78, 0.024, 'Tonguzlu'),
    d('ESK', 'Eskişehir', 30.52, 39.78, 0.024, 'Sultanönü'),
    d('AYD', 'Aydın', 27.84, 37.85, 0.024, 'Güzelhisar'),
    d('ORD', 'Ordu', 37.88, 40.98, 0.018, 'Kotyora'),
    d('ELZ', 'Elazığ', 39.22, 38.67, 0.018, 'Harput'),
    d('COR', 'Çorum', 34.95, 40.55, 0.018, 'Çorum'),
    d('ISP', 'Isparta', 30.55, 37.76, 0.018, 'Isparta'),
    d('MER', 'Mersin', 34.63, 36.8, 0.022, 'İçel'),
    d('KAR', 'Kars', 43.1, 40.6, 0.014, 'Kars'),
    d('SNP', 'Sinop', 35.15, 42.03, 0.014, 'Sinop'),
  ],

  // ── Rusya / Avrasya bozkırları: 18 → 36 ─────────────────────────────────
  '643': [
    d('MUR', 'Murmansk', 33.08, 68.97, 0.02, 'Murman'),
    d('PTZ', 'Petrozavodsk', 34.35, 61.79, 0.02, 'Karelya'),
    d('PSK', 'Pskov', 28.33, 57.82, 0.024, 'Pskov'),
    d('NOG', 'Veliki Novgorod', 31.27, 58.52, 0.028, 'Novgorod'),
    d('TVR', 'Tver', 35.9, 56.86, 0.024, 'Tver'),
    d('YAR', 'Yaroslavl', 39.88, 57.63, 0.024, 'Yaroslavl'),
    d('VRN', 'Voronezh', 39.2, 51.66, 0.026, 'Voronej'),
    d('KRS', 'Kursk', 36.19, 51.73, 0.022, 'Kursk'),
    d('PNZ', 'Penza', 45.0, 53.2, 0.02, 'Penza'),
    d('SRT', 'Saratov', 46.03, 51.53, 0.026, 'Saratov'),
    d('UFA', 'Ufa', 55.97, 54.74, 0.028, 'Ufa'),
    d('PRM', 'Perm', 56.25, 58.01, 0.024, 'Perm'),
    d('CHL', 'Çelyabinsk', 61.4, 55.16, 0.026, 'Çelyabinsk'),
    d('TYU', 'Tümen', 65.53, 57.15, 0.02, 'Tümen'),
    d('TOM', 'Tomsk', 84.97, 56.5, 0.018, 'Tomsk'),
    d('YAK', 'Yakutsk', 129.73, 62.03, 0.016, 'Yakutsk'),
    d('MGD', 'Magadan', 150.8, 59.56, 0.012, 'Magadan'),
    d('KAM', 'Petropavlovsk', 158.65, 53.02, 0.012, 'Kamçatka'),
    // Sibirya / Uzak Doğu tundra sancakları: Moskova-Perm hattındaki il
    // tohumlarının kutuplara doğru açtığı ince kamaları böler.
    d('SLH', 'Salekhard', 66.6, 66.53, 0.008, 'Yugra'),
    d('MNG', 'Mangazeya', 82.2, 66.6, 0.006, 'Mangazeya'),
    d('NRK', 'Norilsk', 88.2, 69.35, 0.006, 'Pyasina'),
    d('KHT', 'Khatanga', 102.47, 71.98, 0.004, 'Taymyr'),
    d('TUR', 'Tura', 100.22, 64.28, 0.006, 'Evenk'),
    d('VKH', 'Verkhoyansk', 133.39, 67.55, 0.004, 'Yakut'),
    d('CKD', 'Chokurdakh', 147.9, 70.62, 0.004, 'Indigir'),
    d('AND', 'Anadyr', 177.51, 64.73, 0.004, 'Çukçi'),
    // Kuzey Urallar / Peçora ormanları: Kazan ve Perm hücrelerinin Kuzey Buz
    // Denizi'ne uzanan ince kamalarını böler.
    d('SYK', 'Sıktıvkar', 50.84, 61.67, 0.006, 'Ust-Sısolsk'),
    d('UKH', 'Uhta', 53.9, 63.6, 0.004, 'Peçora'),
  ],

  // ── ABD: 16 → 34 ────────────────────────────────────────────────────────
  '840': [
    d('NOL', 'New Orleans', -90.07, 29.95, 0.03, 'Nouvelle-Orléans'),
    d('STL', 'St. Louis', -90.2, 38.63, 0.028, 'Saint-Louis'),
    d('KSC', 'Kansas City', -94.58, 39.1, 0.028, 'Kansas'),
    d('CLE', 'Cleveland', -81.69, 41.5, 0.028, 'Cleveland'),
    d('PIT', 'Pittsburgh', -79.99, 40.44, 0.028, 'Fort Duquesne'),
    d('CIN', 'Cincinnati', -84.51, 39.1, 0.026, 'Cincinnati'),
    d('NSH', 'Nashville', -86.78, 36.16, 0.026, 'Nashborough'),
    d('CLT', 'Charlotte', -80.84, 35.23, 0.026, 'Charlotte Town'),
    d('ORL', 'Orlando', -81.38, 28.54, 0.028, 'Orlando'),
    d('TPA', 'Tampa', -82.46, 27.95, 0.026, 'Tampa'),
    d('SDG', 'San Diego', -117.16, 32.72, 0.03, 'San Diego'),
    d('LAS', 'Las Vegas', -115.14, 36.17, 0.026, 'Las Vegas'),
    d('SLC', 'Salt Lake City', -111.89, 40.76, 0.024, 'Great Salt Lake'),
    d('PDX', 'Portland', -122.68, 45.52, 0.028, 'Portland'),
    d('BOI', 'Boise', -116.2, 43.62, 0.02, 'Boise'),
    d('OMA', 'Omaha', -95.94, 41.26, 0.022, 'Omaha'),
    d('ANC', 'Anchorage', -149.9, 61.22, 0.018, 'Anchorage'),
    d('HNL', 'Honolulu', -157.86, 21.31, 0.022, 'Honolulu'),
    d('OME', 'Nome', -165.41, 64.5, 0.008, 'Inupiat'),
    d('BTT', 'Utqiagvik', -156.79, 71.29, 0.004, 'Inupiaq'),
  ],

  // ── Çin: 15 → 34 ────────────────────────────────────────────────────────
  '156': [
    d('TSN', 'Tianjin', 117.2, 39.13, 0.028, 'Tianjin'),
    d('NKG', 'Nanjing', 118.8, 32.06, 0.03, 'Yingtian'),
    d('HGH', 'Hangzhou', 120.15, 30.27, 0.03, 'Lin\'an'),
    d('SUZ', 'Suzhou', 120.62, 31.3, 0.028, 'Suzhou'),
    d('CGO', 'Zhengzhou', 113.63, 34.75, 0.028, 'Zhengzhou'),
    d('TYN', 'Taiyuan', 112.55, 37.87, 0.024, 'Taiyuan'),
    d('TNA', 'Jinan', 117.0, 36.67, 0.026, 'Jinan'),
    d('CSX', 'Changsha', 112.94, 28.23, 0.026, 'Changsha'),
    d('KHN', 'Nanchang', 115.86, 28.68, 0.024, 'Nanchang'),
    d('XMN', 'Xiamen', 118.09, 24.48, 0.026, 'Xiamen'),
    d('SWA', 'Shantou', 116.68, 23.35, 0.022, 'Shantou'),
    d('NNG', 'Nanning', 108.32, 22.82, 0.022, 'Nanning'),
    d('KWE', 'Guiyang', 106.63, 26.65, 0.02, 'Guiyang'),
    d('HFE', 'Hefei', 117.23, 31.82, 0.026, 'Hefei'),
    d('NGB', 'Ningbo', 121.55, 29.87, 0.028, 'Ningbo'),
    d('HET', 'Hohhot', 111.75, 40.84, 0.018, 'Kuku Khoto'),
    d('XNN', 'Xining', 101.78, 36.62, 0.016, 'Xining'),
    d('KHG', 'Kashgar', 75.99, 39.47, 0.016, 'Kashgar'),
    d('BAV', 'Baotou', 109.84, 40.66, 0.018, 'Baotou'),
  ],

  // ── Hindistan: 10 → 26 ─────────────────────────────────────────────────
  '356': [
    d('PNQ', 'Pune', 73.86, 18.52, 0.032, 'Pune'),
    d('STV', 'Surat', 72.83, 21.17, 0.028, 'Surat'),
    d('NAG', 'Nagpur', 79.09, 21.15, 0.026, 'Nagpur'),
    d('IDR', 'Indore', 75.86, 22.72, 0.024, 'Indore'),
    d('BHO', 'Bhopal', 77.41, 23.26, 0.022, 'Bhopal'),
    d('KNU', 'Kanpur', 80.35, 26.45, 0.024, 'Kanpur'),
    d('VNS', 'Varanasi', 82.97, 25.32, 0.022, 'Kashi'),
    d('AGR', 'Agra', 78.02, 27.18, 0.022, 'Agra'),
    d('ATQ', 'Amritsar', 74.87, 31.63, 0.022, 'Amritsar'),
    d('IXC', 'Chandigarh', 76.78, 30.73, 0.02, 'Chandigarh'),
    d('COK', 'Kochi', 76.27, 9.93, 0.024, 'Kochi'),
    d('CJB', 'Coimbatore', 76.96, 11.02, 0.022, 'Kovai'),
    d('VTZ', 'Visakhapatnam', 83.3, 17.69, 0.022, 'Vizagapatam'),
    d('BBI', 'Bhubaneswar', 85.82, 20.3, 0.02, 'Ekamra'),
    d('GAU', 'Guwahati', 91.75, 26.14, 0.02, 'Pragjyotishpura'),
    d('SXR', 'Srinagar', 74.8, 34.08, 0.018, 'Srinagar'),
  ],

  // ── Almanya: 11 → 20 ────────────────────────────────────────────────────
  '276': [
    d('DUS', 'Düsseldorf', 6.77, 51.23, 0.05, 'Düsseldorf'),
    d('LEJ', 'Leipzig', 12.37, 51.34, 0.048, 'Leipzig'),
    d('BRE', 'Bremen', 8.8, 53.08, 0.046, 'Bremen'),
    d('KIE', 'Kiel', 10.14, 54.32, 0.042, 'Kiel'),
    d('MAI', 'Mainz', 8.27, 50.0, 0.046, 'Mainz'),
    d('TRI', 'Trier', 6.64, 49.75, 0.04, 'Trier'),
    d('KAS', 'Kassel', 9.5, 51.31, 0.042, 'Kassel'),
    d('REG', 'Regensburg', 12.1, 49.02, 0.042, 'Regensburg'),
    d('FBG', 'Freiburg', 7.85, 47.99, 0.044, 'Freiburg'),
  ],

  // ── Fransa: 10 → 19 ─────────────────────────────────────────────────────
  '250': [
    d('SXB', 'Strazburg', 7.75, 48.58, 0.05, 'Strasbourg'),
    d('MET', 'Metz', 6.18, 49.12, 0.044, 'Metz'),
    d('LIL', 'Lille', 3.06, 50.63, 0.052, 'Flandre'),
    d('BES', 'Brest', -4.49, 48.39, 0.044, 'Brest'),
    d('RNE', 'Rennes', -1.68, 48.11, 0.046, 'Rennes'),
    d('PIS', 'Poitiers', 0.34, 46.58, 0.042, 'Poitiers'),
    d('LIG', 'Limoges', 1.26, 45.83, 0.04, 'Limoges'),
    d('MPL', 'Montpellier', 3.88, 43.61, 0.046, 'Languedoc'),
    d('AVN', 'Avignon', 4.81, 43.95, 0.042, 'Avignon'),
  ],

  // ── İtalya: 9 → 18 ──────────────────────────────────────────────────────
  '380': [
    d('BLQ', 'Bologna', 11.34, 44.49, 0.05, 'Bologna'),
    d('VRN', 'Verona', 10.99, 45.44, 0.046, 'Verona'),
    d('PDA', 'Padova', 11.88, 45.41, 0.044, 'Padova'),
    d('PSA', 'Pisa', 10.4, 43.72, 0.042, 'Pisa'),
    d('SAY', 'Siena', 11.33, 43.32, 0.04, 'Siena'),
    d('PEG', 'Perugia', 12.39, 43.11, 0.04, 'Perugia'),
    d('CAG', 'Cagliari', 9.11, 39.22, 0.042, 'Cagliari'),
    d('CTA', 'Catania', 15.09, 37.5, 0.042, 'Catania'),
    d('TRS', 'Trieste', 13.77, 45.65, 0.042, 'Trieste'),
  ],

  // ── İspanya: 9 → 18 ─────────────────────────────────────────────────────
  '724': [
    d('TOL', 'Toledo', -4.02, 39.86, 0.05, 'Toledo'),
    d('SCQ', 'Santiago', -8.54, 42.88, 0.044, 'Santiago'),
    d('OVD', 'Oviedo', -5.84, 43.36, 0.042, 'Oviedo'),
    d('SLM', 'Salamanca', -5.66, 40.97, 0.044, 'Salamanca'),
    d('ODB', 'Córdoba', -4.78, 37.89, 0.05, 'Córdoba'),
    d('AGP', 'Málaga', -4.42, 36.72, 0.048, 'Málaga'),
    d('PMI', 'Palma', -2.65, 39.57, 0.046, 'Mallorca'),
    d('ALC', 'Alicante', -0.48, 38.35, 0.046, 'Alacant'),
    d('BJZ', 'Badajoz', -6.97, 38.88, 0.04, 'Badajoz'),
  ],

  // ── Kanada: 6 → 16 ──────────────────────────────────────────────────────
  '124': [
    d('YQB', 'Québec', -71.21, 46.81, 0.05, 'Québec'),
    d('YHZ', 'Halifax', -63.58, 44.65, 0.044, 'Halifax'),
    d('YQR', 'Regina', -104.62, 50.45, 0.046, 'Regina'),
    d('YXE', 'Saskatoon', -106.67, 52.13, 0.044, 'Saskatoon'),
    d('YEG', 'Edmonton', -113.49, 53.55, 0.05, 'Edmonton'),
    d('YYJ', 'Victoria', -123.37, 48.43, 0.046, 'Victoria'),
    d('YYT', "St. John's", -52.71, 47.56, 0.04, "St. John's"),
    d('YQT', 'Thunder Bay', -89.25, 48.38, 0.04, 'Thunder Bay'),
    d('YSB', 'Sudbury', -81.0, 46.49, 0.038, 'Sudbury'),
    d('YQG', 'Windsor', -83.04, 42.32, 0.042, 'Windsor'),
    // Kuzey Kanada tundra/kutup sancakları: arktik adalardaki dev hücreleri böler.
    d('YXY', 'Whitehorse', -135.05, 60.72, 0.012, 'Yukon'),
    d('YEV', 'Inuvik', -133.72, 68.36, 0.006, 'Inuvialuit'),
    d('YZF', 'Yellowknife', -114.37, 62.45, 0.012, 'Slave'),
    d('YCB', 'Cambridge Bay', -105.06, 69.12, 0.006, 'Kitikmeot'),
    d('YRT', 'Rankin Inlet', -92.08, 62.81, 0.01, 'Kivalliq'),
    d('YFB', 'Iqaluit', -68.52, 63.75, 0.008, 'Nunavut'),
    d('YYQ', 'Churchill', -94.17, 58.77, 0.01, 'Rupert'),
    d('YYR', 'Goose Bay', -60.4, 53.3, 0.01, 'Naskapi'),
  ],

  // ── Birleşik Krallık: 8 → 15 ────────────────────────────────────────────
  '826': [
    d('BHX', 'Birmingham', -1.9, 52.48, 0.06, 'Birmingham'),
    d('LPL', 'Liverpool', -2.99, 53.41, 0.058, 'Liverpool'),
    d('LBA', 'Leeds', -1.55, 53.8, 0.054, 'Leeds'),
    d('SHE', 'Sheffield', -1.47, 53.38, 0.052, 'Sheffield'),
    d('PLH', 'Plymouth', -4.14, 50.38, 0.05, 'Plymouth'),
    d('INV', 'Inverness', -4.22, 57.48, 0.044, 'Inverness'),
    d('BFS', 'Belfast', -5.93, 54.6, 0.05, 'Belfast'),
  ],

  // ── İran: 7 → 15 ────────────────────────────────────────────────────────
  '364': [
    d('QOM', 'Kum', 50.88, 34.64, 0.045, 'Kum'),
    d('RAS', 'Reşt', 49.58, 37.28, 0.044, 'Reşt'),
    d('KSH', 'Kirmanşah', 47.06, 34.31, 0.042, 'Kirmanşah'),
    d('HDN', 'Hemedan', 48.51, 34.8, 0.042, 'Hemedan'),
    d('YZD', 'Yezd', 54.37, 31.9, 0.04, 'Yezd'),
    d('BND', 'Bandar Abbas', 56.27, 27.18, 0.046, 'Hürmüz'),
    d('ZAH', 'Zahedan', 60.86, 29.5, 0.036, 'Zahedan'),
    d('ARD', 'Erdebil', 48.29, 38.25, 0.04, 'Erdebil'),
  ],

  // ── Japonya: 7 → 14 ─────────────────────────────────────────────────────
  '392': [
    d('KYO', 'Kyoto', 135.77, 35.01, 0.07, 'Yamashiro'),
    d('NGS', 'Nagasaki', 129.87, 32.75, 0.06, 'Hizen'),
    d('KMQ', 'Kanazawa', 136.66, 36.56, 0.06, 'Kaga'),
    d('KIJ', 'Niigata', 139.04, 37.9, 0.06, 'Echigo'),
    d('MYJ', 'Matsuyama', 132.77, 33.84, 0.058, 'Iyo'),
    d('KOJ', 'Kagoshima', 130.56, 31.6, 0.058, 'Satsuma'),
    d('AOJ', 'Aomori', 140.75, 40.82, 0.05, 'Mutsu'),
  ],

  // ── Avustralya: 3 → 12 ──────────────────────────────────────────────────
  '036': [
    d('SYN', 'Sydney', 151.21, -33.87, 0.06, 'Sydney'),
    d('BNE', 'Brisbane', 153.03, -27.47, 0.056, 'Brisbane'),
    d('ADL', 'Adelaide', 138.6, -34.93, 0.052, 'Adelaide'),
    d('HBA', 'Hobart', 147.33, -42.88, 0.046, 'Hobart'),
    d('DRW', 'Darwin', 130.84, -12.46, 0.044, 'Darwin'),
    d('CNS', 'Cairns', 145.77, -16.92, 0.044, 'Cairns'),
    d('ASP', 'Alice Springs', 133.88, -23.7, 0.038, 'Alice Springs'),
    d('KGI', 'Kalgoorlie', 121.47, -30.75, 0.04, 'Kalgoorlie'),
    d('TSV', 'Townsville', 146.82, -19.26, 0.042, 'Townsville'),
    d('BME', 'Broome', 122.24, -17.96, 0.036, 'Yawuru'),
    d('LRE', 'Longreach', 144.25, -23.44, 0.03, 'Iningai'),
  ],

  // ── Meksika: 3 → 13 ─────────────────────────────────────────────────────
  '484': [
    d('PBC', 'Puebla', -98.2, 19.04, 0.05, 'Puebla'),
    d('VER', 'Veracruz', -96.13, 19.17, 0.048, 'Veracruz'),
    d('MID', 'Mérida', -89.62, 20.97, 0.046, 'Mérida'),
    d('CUN', 'Cancún', -86.85, 21.16, 0.046, 'Cancún'),
    d('ACA', 'Acapulco', -99.89, 16.85, 0.044, 'Acapulco'),
    d('OAX', 'Oaxaca', -96.73, 17.07, 0.042, 'Oaxaca'),
    d('TIJ', 'Tijuana', -117.04, 32.51, 0.05, 'Tijuana'),
    d('CUU', 'Chihuahua', -106.08, 28.63, 0.044, 'Chihuahua'),
    d('BJX', 'León', -101.68, 21.12, 0.046, 'León'),
    d('MLM', 'Morelia', -101.19, 19.7, 0.042, 'Morelia'),
  ],

  // ── Brezilya: 6 → 16 ────────────────────────────────────────────────────
  '076': [
    d('CNF', 'Belo Horizonte', -43.94, -19.92, 0.06, 'Belo Horizonte'),
    d('FOR', 'Fortaleza', -38.54, -3.73, 0.052, 'Fortaleza'),
    d('CWB', 'Curitiba', -49.27, -25.43, 0.05, 'Curitiba'),
    d('POA', 'Porto Alegre', -51.23, -30.03, 0.05, 'Porto Alegre'),
    d('BEL', 'Belém', -48.49, -1.46, 0.046, 'Belém'),
    d('GYN', 'Goiânia', -49.25, -16.68, 0.044, 'Goiás'),
    d('VCP', 'Campinas', -47.06, -22.91, 0.05, 'Campinas'),
    d('SLZ', 'São Luís', -44.3, -2.53, 0.042, 'São Luís'),
    d('NAT', 'Natal', -35.21, -5.79, 0.042, 'Natal'),
    d('VIX', 'Vitória', -40.34, -20.32, 0.044, 'Vitória'),
    d('MAO', 'Manaus', -60.02, -3.12, 0.03, 'Manao'),
    d('RBR', 'Rio Branco', -67.81, -9.97, 0.02, 'Akwawa'),
  ],

  // ── Güney Kore: 3 → 12 ──────────────────────────────────────────────────
  '410': [
    d('ICN', 'Incheon', 126.71, 37.46, 0.06, 'Incheon'),
    d('TAE', 'Daegu', 128.6, 35.87, 0.056, 'Daegu'),
    d('CJJ', 'Daejeon', 127.38, 36.35, 0.054, 'Daejeon'),
    d('GYE', 'Gyeongju', 129.22, 35.86, 0.05, 'Gyeongju'),
    d('CHN', 'Jeonju', 127.15, 35.82, 0.05, 'Jeonju'),
    d('CUC', 'Chuncheon', 127.73, 37.88, 0.044, 'Chuncheon'),
    d('KAG', 'Gangneung', 128.88, 37.75, 0.044, 'Gangneung'),
    d('MWX', 'Mokpo', 126.39, 34.81, 0.042, 'Mokpo'),
    d('SWU', 'Suwon', 127.03, 37.26, 0.05, 'Suwon'),
  ],

  // ── Avrupa: orta ölçekli ülkeler (+2 … +4) ─────────────────────────────
  '620': [
    d('CBP', 'Coimbra', -8.43, 40.21, 0.16, 'Coimbra'),
    d('BRG', 'Braga', -8.43, 41.55, 0.16, 'Braga'),
    d('EVR', 'Évora', -7.9, 38.57, 0.15, 'Évora'),
  ],
  '300': [
    d('LRS', 'Larisa', 22.42, 39.64, 0.15, 'Larisa'),
    d('PTR', 'Patras', 21.73, 38.25, 0.16, 'Patras'),
    d('VOL', 'Volos', 22.94, 39.36, 0.14, 'Volos'),
  ],
  '528': [
    d('HAG', 'Lahey', 4.3, 52.07, 0.22, 'Den Haag'),
    d('UTR', 'Utrecht', 5.12, 52.09, 0.22, 'Utrecht'),
  ],
  '040': [
    d('SZG', 'Salzburg', 13.04, 47.81, 0.2, 'Salzburg'),
    d('LNZ', 'Linz', 14.29, 48.31, 0.18, 'Linz'),
  ],
  '348': [
    d('SZE', 'Szeged', 20.15, 46.25, 0.18, 'Szeged'),
    d('MIS', 'Miskolc', 20.78, 48.1, 0.18, 'Miskolc'),
  ],
  '203': [
    d('OSR', 'Ostrava', 18.26, 49.82, 0.22, 'Ostrava'),
    d('PLZ', 'Plzeň', 13.38, 49.75, 0.2, 'Pilsen'),
  ],
  '703': [
    d('ZIL', 'Žilina', 18.74, 49.22, 0.22, 'Žilina'),
    d('POS', 'Prešov', 21.24, 48.99, 0.2, 'Prešov'),
  ],
  '752': [
    d('MMA', 'Malmö', 13.0, 55.6, 0.2, 'Malmö'),
    d('UPP', 'Uppsala', 17.64, 59.86, 0.18, 'Uppsala'),
  ],
  '578': [
    d('TRD', 'Trondheim', 10.4, 63.43, 0.2, 'Trondheim'),
    d('SVG', 'Stavanger', 5.73, 58.97, 0.18, 'Stavanger'),
  ],
  '246': [
    d('TKU', 'Turku', 22.27, 60.45, 0.22, 'Turku'),
    d('RVN', 'Rovaniemi', 25.73, 66.5, 0.16, 'Rovaniemi'),
  ],
  '208': [
    d('ODE', 'Odense', 10.39, 55.4, 0.2, 'Odense'),
    d('AAL', 'Aalborg', 9.92, 57.05, 0.18, 'Aalborg'),
  ],
  '372': [d('GWY', 'Galway', -9.05, 53.27, 0.24, 'Galway')],
  '688': [
    d('NSD', 'Novi Sad', 19.84, 45.25, 0.22, 'Novi Sad'),
    d('KGV', 'Kragujevac', 20.91, 44.01, 0.2, 'Kragujevac'),
  ],
  '191': [d('OSI', 'Osijek', 18.69, 45.55, 0.26, 'Osijek')],
  '070': [d('BNL', 'Banja Luka', 17.19, 44.77, 0.26, 'Banja Luka')],
  '100': [
    d('RSE', 'Rusçuk', 25.97, 43.85, 0.18, 'Rusçuk'),
    d('BOJ', 'Burgaz', 27.47, 42.51, 0.18, 'Burgaz'),
  ],
  '008': [d('DRR', 'Draç', 19.45, 41.32, 0.26, 'Draç')],
  '705': [
    { suffixId: 'LJU', name: 'Ljubljana', lon: 14.51, lat: 46.06, gdpShare: 0.42, historicName: 'Laibach', isCapital: true },
    d('MBX', 'Maribor', 15.65, 46.55, 0.3, 'Maribor'),
    d('CLJ', 'Celje', 15.27, 46.23, 0.28, 'Celje'),
  ],
  '112': [
    d('VTB', 'Vitebsk', 30.2, 55.19, 0.2, 'Vitebsk'),
    d('GME', 'Gomel', 30.98, 52.44, 0.2, 'Gomel'),
  ],
  '440': [
    d('KLP', 'Klaipėda', 21.13, 55.7, 0.2, 'Memel'),
    d('SQQ', 'Šiauliai', 23.35, 55.93, 0.18, 'Šiauliai'),
  ],
  '428': [
    { suffixId: 'RIX', name: 'Riga', lon: 24.11, lat: 56.95, gdpShare: 0.44, historicName: 'Riga', isCapital: true },
    d('DGP', 'Daugavpils', 26.53, 55.87, 0.3, 'Dünaburg'),
    d('LPX', 'Liepāja', 21.01, 56.51, 0.26, 'Libau'),
  ],
  '233': [
    { suffixId: 'TLL', name: 'Tallinn', lon: 24.75, lat: 59.44, gdpShare: 0.44, historicName: 'Reval', isCapital: true },
    d('TAY', 'Tartu', 26.72, 58.38, 0.3, 'Dorpat'),
    d('NAR', 'Narva', 28.19, 59.38, 0.26, 'Narva'),
  ],
  '498': [
    { suffixId: 'KIV', name: 'Kişinev', lon: 28.86, lat: 47.01, gdpShare: 0.44, historicName: 'Kişinev', isCapital: true },
    d('BZY', 'Bălți', 27.93, 47.76, 0.3, 'Bălți'),
    d('TIR', 'Tiraspol', 29.63, 46.84, 0.26, 'Tiraspol'),
  ],
  '268': [
    d('KUT', 'Kutaisi', 42.7, 42.27, 0.2, 'Kutaisi'),
    d('SUI', 'Sohum', 41.02, 43.0, 0.18, 'Sohum'),
  ],
  '051': [
    { suffixId: 'EVN', name: 'Erivan', lon: 44.51, lat: 40.18, gdpShare: 0.42, historicName: 'Erivan', isCapital: true },
    d('GYM', 'Gümrü', 43.85, 40.79, 0.3, 'Gümrü'),
    d('VGH', 'Eçmiyazin', 44.29, 40.16, 0.28, 'Eçmiyazin'),
  ],
  '031': [
    d('LNK', 'Lankaran', 48.85, 38.75, 0.18, 'Lankaran'),
    d('SMK', 'Şamahı', 48.64, 40.63, 0.16, 'Şamahı'),
  ],

  // ── Orta Doğu & Orta Asya ───────────────────────────────────────────────
  '760': [
    d('HMS', 'Humus', 36.72, 34.73, 0.16, 'Humus'),
    d('HMA', 'Hama', 36.75, 35.13, 0.15, 'Hama'),
    d('TTS', 'Tartus', 35.89, 34.89, 0.14, 'Tartus'),
  ],
  '368': [
    d('NJF', 'Necef', 44.33, 32.0, 0.18, 'Necef'),
    d('KBL', 'Kerbela', 44.02, 32.62, 0.16, 'Kerbela'),
    d('NSR', 'Nasıriye', 46.26, 31.04, 0.14, 'Nasıriye'),
  ],
  '887': [
    d('TAZ', 'Taiz', 44.02, 13.58, 0.2, 'Taiz'),
    d('HOD', 'Hudeyde', 42.95, 14.8, 0.18, 'Hudeyde'),
  ],
  '400': [
    { suffixId: 'AMM', name: 'Amman', lon: 35.93, lat: 31.95, gdpShare: 0.42, historicName: 'Amman', isCapital: true },
    d('ZRQ', 'Zerka', 36.09, 32.07, 0.3, 'Zerka'),
    d('AQJ', 'Akabe', 35.0, 29.53, 0.28, 'Akabe'),
  ],
  '376': [
    { suffixId: 'JRS', name: 'Kudüs', lon: 35.21, lat: 31.77, gdpShare: 0.4, historicName: 'Kudüs', isCapital: true },
    d('TLV', 'Tel Aviv', 34.78, 32.08, 0.32, 'Yafa'),
    d('HFA', 'Hayfa', 34.99, 32.79, 0.28, 'Hayfa'),
  ],
  '275': [
    { suffixId: 'RBH', name: 'Ramallah', lon: 35.2, lat: 31.9, gdpShare: 0.52, historicName: 'Ramallah', isCapital: true },
    d('GZA', 'Gazze', 34.47, 31.5, 0.48, 'Gazze'),
  ],
  '414': [
    { suffixId: 'KWI', name: 'Kuveyt', lon: 47.98, lat: 29.38, gdpShare: 0.6, historicName: 'Kuveyt', isCapital: true },
    d('AHM', 'Ahmedi', 48.08, 29.08, 0.4, 'Ahmedi'),
  ],
  '784': [
    { suffixId: 'AUH', name: 'Abu Dabi', lon: 54.37, lat: 24.45, gdpShare: 0.55, historicName: 'Abu Dabi', isCapital: true },
    d('DXB', 'Dubai', 55.27, 25.2, 0.45, 'Dubai'),
  ],
  '512': [
    { suffixId: 'MCT', name: 'Maskat', lon: 58.41, lat: 23.59, gdpShare: 0.42, historicName: 'Maskat', isCapital: true },
    d('SLL', 'Salalah', 54.09, 17.02, 0.3, 'Salalah'),
    d('NZW', 'Nizva', 57.53, 22.93, 0.28, 'Nizva'),
  ],
  '860': [
    d('BHK', 'Buhara', 64.42, 39.77, 0.2, 'Buhara'),
    d('NKS', 'Nukus', 59.61, 42.46, 0.16, 'Nukus'),
    d('AZN', 'Andican', 72.34, 40.78, 0.16, 'Andican'),
  ],
  '795': [
    d('MRV', 'Merv', 61.83, 37.6, 0.2, 'Merv'),
    d('TSZ', 'Daşoğuz', 59.97, 41.84, 0.18, 'Daşoğuz'),
  ],
  '762': [
    d('KLB', 'Külab', 69.79, 37.91, 0.22, 'Külab'),
    d('PNJ', 'Pencikent', 67.61, 39.49, 0.2, 'Pencikent'),
  ],
  '417': [
    d('KRL', 'Karakol', 78.39, 42.49, 0.22, 'Karakol'),
    d('JLB', 'Celalabad', 72.93, 40.93, 0.2, 'Celalabad'),
  ],
  '004': [
    d('MZR', 'Mezar-ı Şerif', 67.11, 36.71, 0.18, 'Mezar-ı Şerif'),
    d('GZN', 'Gazne', 68.42, 33.55, 0.16, 'Gazne'),
  ],
  '586': [
    d('LHE', 'Lahor', 74.36, 31.55, 0.2, 'Lahor'),
    d('MUX', 'Multan', 71.52, 30.2, 0.16, 'Multan'),
    d('UET', 'Ketta', 66.98, 30.18, 0.14, 'Ketta'),
    d('FSD', 'Faysalabad', 73.08, 31.42, 0.16, 'Faysalabad'),
  ],
  '050': [d('KHL', 'Khulna', 89.57, 22.82, 0.28, 'Khulna')],
  '144': [d('GLE', 'Galle', 80.22, 6.05, 0.26, 'Galle')],
  '524': [
    { suffixId: 'KTM', name: 'Katmandu', lon: 85.32, lat: 27.72, gdpShare: 0.4, historicName: 'Katmandu', isCapital: true },
    d('PKR', 'Pokhara', 83.99, 28.21, 0.3, 'Pokhara'),
    d('BRT', 'Biratnagar', 87.27, 26.45, 0.3, 'Biratnagar'),
  ],

  // ── Doğu & Güneydoğu Asya ───────────────────────────────────────────────
  '408': [
    { suffixId: 'FNJ', name: 'Pyongyang', lon: 125.75, lat: 39.02, gdpShare: 0.62, historicName: 'Pyongyang', isCapital: true },
    d('HGM', 'Hamhung', 127.54, 39.92, 0.38, 'Hamhung'),
  ],
  '158': [
    { suffixId: 'TPE', name: 'Taipei', lon: 121.56, lat: 25.03, gdpShare: 0.42, historicName: 'Taipei', isCapital: true },
    d('KHH', 'Kaohsiung', 120.3, 22.63, 0.3, 'Takao'),
    d('TXG', 'Taichung', 120.68, 24.15, 0.28, 'Taichung'),
  ],
  '496': [
    d('ERT', 'Erdenet', 104.04, 49.03, 0.24, 'Erdenet'),
    d('COQ', 'Çoybalsan', 114.53, 48.07, 0.22, 'Çoybalsan'),
  ],
  '704': [
    d('HUI', 'Huế', 107.58, 16.46, 0.16, 'Huế'),
    d('NHA', 'Nha Trang', 109.19, 12.24, 0.14, 'Nha Trang'),
    d('VCA', 'Can Tho', 105.78, 10.03, 0.14, 'Can Tho'),
    d('HPH', 'Haiphong', 106.68, 20.86, 0.16, 'Haiphong'),
  ],
  '764': [
    d('NAK', 'Nakhon Ratchasima', 102.1, 14.98, 0.16, 'Korat'),
    d('HKT', 'Phuket', 98.39, 7.88, 0.14, 'Phuket'),
    d('AYU', 'Ayutthaya', 100.57, 14.35, 0.16, 'Ayutthaya'),
    d('UTH', 'Udon Thani', 102.79, 17.41, 0.12, 'Udon'),
  ],
  '104': [
    d('NYT', 'Naypyidaw', 96.13, 19.75, 0.24, 'Naypyidaw'),
    d('BGO', 'Bago', 96.48, 17.34, 0.2, 'Bago'),
  ],
  '116': [
    d('BBD', 'Battambang', 103.2, 13.1, 0.22, 'Battambang'),
    d('KOS', 'Sihanoukville', 103.5, 10.63, 0.2, 'Sihanoukville'),
  ],
  '418': [
    { suffixId: 'VTE', name: 'Vientiane', lon: 102.63, lat: 17.97, gdpShare: 0.44, historicName: 'Vientiane', isCapital: true },
    d('LPQ', 'Luang Prabang', 102.13, 19.89, 0.3, 'Luang Prabang'),
    d('ZVK', 'Savannakhet', 104.75, 16.56, 0.26, 'Savannakhet'),
  ],
  '458': [
    d('PEN', 'Penang', 100.33, 5.41, 0.22, 'Penang'),
    d('JHB', 'Johor Bahru', 103.76, 1.49, 0.2, 'Johor'),
    d('BKI', 'Kota Kinabalu', 116.07, 5.98, 0.18, 'Kota Kinabalu'),
  ],
  '608': [
    d('LGP', 'Legazpi', 123.73, 13.14, 0.16, 'Legazpi'),
    d('CGY', 'Cagayan de Oro', 124.65, 8.48, 0.16, 'Cagayan'),
    d('ZAM', 'Zamboanga', 122.08, 6.91, 0.16, 'Zamboanga'),
  ],
  '598': [
    { suffixId: 'POM', name: 'Port Moresby', lon: 147.18, lat: -9.44, gdpShare: 0.44, historicName: 'Port Moresby', isCapital: true },
    d('LAE', 'Lae', 146.99, -6.72, 0.3, 'Lae'),
    d('HGU', 'Mount Hagen', 144.23, -5.86, 0.26, 'Mount Hagen'),
  ],
  '554': [
    { suffixId: 'WLG', name: 'Wellington', lon: 174.78, lat: -41.29, gdpShare: 0.32, historicName: 'Wellington', isCapital: true },
    d('AKL', 'Auckland', 174.76, -36.85, 0.28, 'Auckland'),
    d('CHC', 'Christchurch', 172.64, -43.53, 0.22, 'Christchurch'),
    d('DUD', 'Dunedin', 170.5, -45.87, 0.18, 'Dunedin'),
  ],

  // ── Büyük & orta ölçekli Afrika ─────────────────────────────────────────
  '504': [
    d('CAS', 'Kazablanka', -7.59, 33.57, 0.2, 'Kazablanka'),
    d('TNG', 'Tanca', -5.8, 35.76, 0.18, 'Tanca'),
  ],
  '012': [
    d('CZL', 'Konstantin', 6.61, 36.36, 0.2, 'Konstantin'),
    d('GHA', 'Gardaya', 3.67, 32.49, 0.16, 'Gardaya'),
  ],
  '788': [
    d('SFA', 'Sfaks', 10.76, 34.74, 0.2, 'Sfaks'),
    d('BZT', 'Bizerta', 9.87, 37.27, 0.18, 'Bizerta'),
  ],
  '434': [
    d('MRA', 'Misrata', 15.09, 32.38, 0.2, 'Misrata'),
    d('SEB', 'Sabha', 14.43, 27.04, 0.16, 'Sabha'),
  ],
  '729': [
    d('WMD', 'Vad Medeni', 33.52, 14.4, 0.18, 'Vad Medeni'),
    d('NYL', 'Nyala', 24.88, 12.05, 0.16, 'Nyala'),
  ],
  '728': [
    { suffixId: 'JUB', name: 'Cuba', lon: 31.58, lat: 4.85, gdpShare: 0.42, historicName: 'Cuba', isCapital: true },
    d('MAK', 'Malakal', 31.66, 9.53, 0.3, 'Malakal'),
    d('WAU', 'Vau', 27.99, 7.7, 0.28, 'Vau'),
  ],
  '404': [
    d('KIS', 'Kisumu', 34.77, -0.09, 0.18, 'Kisumu'),
    d('NUU', 'Nakuru', 36.07, -0.3, 0.18, 'Nakuru'),
    d('ELD', 'Eldoret', 35.27, 0.52, 0.16, 'Eldoret'),
  ],
  '834': [
    d('ARK', 'Arusha', 36.68, -3.37, 0.18, 'Arusha'),
    d('MBI', 'Mbeya', 33.46, -8.91, 0.16, 'Mbeya'),
  ],
  '800': [
    { suffixId: 'KLA', name: 'Kampala', lon: 32.58, lat: 0.35, gdpShare: 0.42, historicName: 'Kampala', isCapital: true },
    d('GUL', 'Gulu', 32.3, 2.78, 0.3, 'Gulu'),
    d('JIN', 'Jinja', 33.2, 0.42, 0.28, 'Jinja'),
  ],
  '646': [
    { suffixId: 'KGL', name: 'Kigali', lon: 30.06, lat: -1.95, gdpShare: 0.58, historicName: 'Kigali', isCapital: true },
    d('BTQ', 'Butare', 29.74, -2.6, 0.42, 'Butare'),
  ],
  '108': [
    { suffixId: 'BJM', name: 'Bujumbura', lon: 29.36, lat: -3.38, gdpShare: 0.56, historicName: 'Bujumbura', isCapital: true },
    d('GIT', 'Gitega', 29.93, -3.43, 0.44, 'Gitega'),
  ],
  '180': [
    d('MDK', 'Mbandaka', 18.26, 0.05, 0.16, 'Mbandaka'),
    d('BKY', 'Bukavu', 28.85, -2.51, 0.18, 'Bukavu'),
  ],
  '178': [
    { suffixId: 'BZV', name: 'Brazzaville', lon: 15.28, lat: -4.26, gdpShare: 0.42, historicName: 'Brazzaville', isCapital: true },
    d('PNR', 'Pointe-Noire', 11.86, -4.79, 0.32, 'Pointe-Noire'),
    d('OUE', 'Ouesso', 16.05, 1.61, 0.26, 'Ouesso'),
  ],
  '120': [
    d('BAF', 'Bafoussam', 10.42, 5.48, 0.24, 'Bafoussam'),
    d('GOU', 'Garoua', 13.4, 9.3, 0.22, 'Garoua'),
  ],
  '288': [
    d('TML', 'Tamale', -0.84, 9.4, 0.22, 'Tamale'),
    d('TKD', 'Takoradi', -1.76, 4.93, 0.2, 'Takoradi'),
  ],
  '384': [
    { suffixId: 'ASK', name: 'Yamoussoukro', lon: -5.28, lat: 6.82, gdpShare: 0.42, historicName: 'Yamoussoukro', isCapital: true },
    d('BYK', 'Bouaké', -5.03, 7.69, 0.3, 'Bouaké'),
    d('ABJ', 'Abidjan', -4.02, 5.35, 0.28, 'Abidjan'),
  ],
  '686': [
    { suffixId: 'DKR', name: 'Dakar', lon: -17.45, lat: 14.69, gdpShare: 0.44, historicName: 'Dakar', isCapital: true },
    d('THS', 'Thiès', -16.93, 14.79, 0.3, 'Thiès'),
    d('XLS', 'Saint-Louis', -16.49, 16.03, 0.26, 'Saint-Louis'),
  ],
  '466': [
    d('GAO', 'Gao', -0.05, 16.27, 0.2, 'Gao'),
    d('SEG', 'Ségou', -6.26, 13.43, 0.18, 'Ségou'),
  ],
  '562': [d('ZND', 'Zinder', 8.99, 13.81, 0.22, 'Zinder')],
  '148': [d('MOU', 'Moundou', 16.08, 8.57, 0.22, 'Moundou')],
  '894': [d('KIT', 'Kitwe', 28.22, -12.8, 0.24, 'Kitwe')],
  '716': [d('UTA', 'Mutare', 32.67, -18.97, 0.24, 'Mutare')],
  '508': [
    { suffixId: 'MPM', name: 'Maputo', lon: 32.58, lat: -25.97, gdpShare: 0.44, historicName: 'Maputo', isCapital: true },
    d('BEW', 'Beira', 34.84, -19.83, 0.3, 'Beira'),
    d('APL', 'Nampula', 39.27, -15.12, 0.26, 'Nampula'),
  ],
  '024': [
    d('BUG', 'Benguela', 13.41, -12.58, 0.2, 'Benguela'),
    d('MAL', 'Malanje', 16.34, -9.54, 0.16, 'Malanje'),
  ],
  '516': [d('RUD', 'Rundu', 19.77, -17.92, 0.22, 'Rundu')],
  '450': [
    d('MJN', 'Mahajanga', 46.32, -15.72, 0.22, 'Mahajanga'),
    d('FIA', 'Fianarantsoa', 47.09, -21.45, 0.2, 'Fianarantsoa'),
  ],
  '706': [
    { suffixId: 'MGQ', name: 'Mogadişu', lon: 45.34, lat: 2.04, gdpShare: 0.42, historicName: 'Mogadişu', isCapital: true },
    d('KMU', 'Kismayo', 42.55, -0.36, 0.3, 'Kismayo'),
    d('BSA', 'Bosaso', 49.18, 11.28, 0.28, 'Bosaso'),
  ],

  // ── Büyük & orta ölçekli Amerika ────────────────────────────────────────
  '032': [
    d('ROS', 'Rosario', -60.64, -32.95, 0.2, 'Rosario'),
    d('MDZ', 'Mendoza', -68.83, -32.89, 0.18, 'Mendoza'),
    d('SLA', 'Salta', -65.41, -24.79, 0.16, 'Salta'),
  ],
  '152': [
    d('CCP', 'Concepción', -73.05, -36.83, 0.2, 'Concepción'),
    d('IQQ', 'Iquique', -70.14, -20.21, 0.18, 'Iquique'),
  ],
  '604': [
    d('AQP', 'Arequipa', -71.54, -16.41, 0.2, 'Arequipa'),
    d('TRU', 'Trujillo', -79.03, -8.11, 0.18, 'Trujillo'),
    d('PUN', 'Puno', -70.02, -15.84, 0.14, 'Puno'),
  ],
  '170': [
    d('CLO', 'Cali', -76.53, 3.45, 0.2, 'Cali'),
    d('BAQ', 'Barranquilla', -74.8, 10.98, 0.18, 'Barranquilla'),
    d('BGA', 'Bucaramanga', -73.13, 7.13, 0.16, 'Bucaramanga'),
  ],
  '862': [
    d('VLC', 'Valensiya', -68.0, 10.16, 0.2, 'Valencia'),
    d('BRM', 'Barquisimeto', -69.32, 10.07, 0.18, 'Barquisimeto'),
  ],
  '218': [
    d('CUE', 'Cuenca', -79.0, -2.9, 0.22, 'Cuenca'),
    d('MEC', 'Manta', -80.73, -0.95, 0.2, 'Manta'),
  ],
  '068': [
    d('CBB', 'Cochabamba', -66.16, -17.39, 0.22, 'Cochabamba'),
    d('SRE', 'Sucre', -65.26, -19.03, 0.2, 'Chuquisaca'),
  ],
  '600': [d('AGT', 'Ciudad del Este', -54.62, -25.51, 0.24, 'Ciudad del Este')],
  '858': [
    { suffixId: 'MVD', name: 'Montevideo', lon: -56.16, lat: -34.9, gdpShare: 0.46, historicName: 'Montevideo', isCapital: true },
    d('STY', 'Salto', -57.96, -31.39, 0.28, 'Salto'),
    d('PDP', 'Punta del Este', -54.95, -34.96, 0.26, 'Maldonado'),
  ],
  '320': [
    { suffixId: 'GUA', name: 'Guatemala', lon: -90.51, lat: 14.63, gdpShare: 0.42, historicName: 'Guatemala', isCapital: true },
    d('XLA', 'Quetzaltenango', -91.52, 14.83, 0.3, 'Xelajú'),
    d('ANT', 'Antigua', -90.73, 14.56, 0.28, 'Antigua'),
  ],
  '340': [
    { suffixId: 'TGU', name: 'Tegucigalpa', lon: -87.19, lat: 14.07, gdpShare: 0.56, historicName: 'Tegucigalpa', isCapital: true },
    d('SAP', 'San Pedro Sula', -88.03, 15.5, 0.44, 'San Pedro Sula'),
  ],
  '222': [
    { suffixId: 'SAL', name: 'San Salvador', lon: -89.19, lat: 13.69, gdpShare: 0.56, historicName: 'San Salvador', isCapital: true },
    d('SAA', 'Santa Ana', -89.56, 13.99, 0.44, 'Santa Ana'),
  ],
  '558': [
    { suffixId: 'MGA', name: 'Managua', lon: -86.25, lat: 12.13, gdpShare: 0.56, historicName: 'Managua', isCapital: true },
    d('LEO', 'León', -86.88, 12.43, 0.44, 'León'),
  ],
  '188': [
    { suffixId: 'SJO', name: 'San José', lon: -84.09, lat: 9.93, gdpShare: 0.56, historicName: 'San José', isCapital: true },
    d('ALA', 'Alajuela', -84.21, 10.02, 0.44, 'Alajuela'),
  ],
  '591': [
    { suffixId: 'PTY', name: 'Panama', lon: -79.52, lat: 8.98, gdpShare: 0.58, historicName: 'Panama', isCapital: true },
    d('ONX', 'Colón', -79.9, 9.36, 0.42, 'Colón'),
  ],
  '192': [d('CMW', 'Camagüey', -77.92, 21.38, 0.28, 'Camagüey')],
  '214': [
    { suffixId: 'SDQ', name: 'Santo Domingo', lon: -69.93, lat: 18.47, gdpShare: 0.58, historicName: 'Santo Domingo', isCapital: true },
    d('STI', 'Santiago', -70.7, 19.45, 0.42, 'Santiago'),
  ],
  '332': [
    { suffixId: 'PAP', name: 'Port-au-Prince', lon: -72.34, lat: 18.54, gdpShare: 0.58, historicName: 'Port-au-Prince', isCapital: true },
    d('CAP', 'Cap-Haïtien', -72.2, 19.76, 0.42, 'Cap-Français'),
  ],

  '616': [
    d('LCJ', 'Łódź', 19.46, 51.76, 0.045, 'Lodz'),
    d('SZZ', 'Szczecin', 14.55, 53.43, 0.04, 'Stettin'),
    d('TOR', 'Toruń', 18.6, 53.01, 0.038, 'Thorn'),
    d('BIA', 'Białystok', 23.16, 53.13, 0.036, 'Białystok'),
    d('KTW', 'Katowice', 19.02, 50.26, 0.042, 'Kattowitz'),
    d('PLO', 'Płock', 19.7, 52.55, 0.036, 'Płock'),
  ],

  // ── Plan hedefi: büyük/orta ülkelerde ek derinlik ───────────────────────
  '804': [
    d('DNK', 'Dnipro', 35.05, 48.46, 0.03, 'Dnipro'),
    d('DOK', 'Donetsk', 37.8, 48.02, 0.032, 'Donetsk'),
    d('OZH', 'Zaporijya', 35.14, 47.84, 0.028, 'Zaporijya'),
    d('CEJ', 'Çernihiv', 31.29, 51.49, 0.024, 'Çernihiv'),
    d('UZH', 'Ujgorod', 22.29, 48.62, 0.022, 'Ungvár'),
    d('PLV', 'Poltava', 34.55, 49.59, 0.026, 'Poltava'),
  ],
  '818': [
    d('PSD', 'Port Said', 32.3, 31.26, 0.035, 'Port Said'),
    d('MNS', 'Mansura', 31.38, 31.04, 0.03, 'Mansura'),
    d('LXR', 'Luksor', 32.64, 25.69, 0.028, 'Thebai'),
    d('SHG', 'Sohag', 31.7, 26.56, 0.024, 'Sohag'),
    d('TNT', 'Tanta', 30.95, 30.79, 0.026, 'Tanta'),
    d('HRG', 'Hurghada', 33.81, 27.26, 0.024, 'Hurghada'),
  ],
  '682': [
    d('TIF', 'Taif', 40.42, 21.27, 0.032, 'Taif'),
    d('TBK', 'Tebük', 36.57, 28.38, 0.028, 'Tebük'),
    d('ABH', 'Abha', 42.51, 18.22, 0.026, 'Abha'),
    d('HAS', 'Hail', 41.69, 27.52, 0.024, 'Hail'),
    d('JZN', 'Cizan', 42.55, 16.89, 0.022, 'Cizan'),
    d('BRD', 'Burayda', 43.97, 26.33, 0.024, 'Burayda'),
  ],
  '360': [
    d('SUB', 'Surabaya', 112.75, -7.25, 0.04, 'Surabaya'),
    d('BDO', 'Bandung', 107.61, -6.92, 0.04, 'Bandung'),
    d('SMG', 'Semarang', 110.42, -6.99, 0.036, 'Semarang'),
    d('JOG', 'Yogyakarta', 110.37, -7.8, 0.036, 'Yogyakarta'),
    d('UPG', 'Makassar', 119.43, -5.15, 0.034, 'Makassar'),
    d('PLM', 'Palembang', 104.76, -2.99, 0.032, 'Palembang'),
    d('BDJ', 'Banjarmasin', 114.59, -3.32, 0.03, 'Banjarmasin'),
  ],
  '398': [
    d('KGF', 'Karaganda', 73.09, 49.8, 0.032, 'Karaganda'),
    d('PLX', 'Semey', 80.23, 50.41, 0.026, 'Semey'),
    d('PWQ', 'Pavlodar', 76.95, 52.29, 0.026, 'Pavlodar'),
    d('KSN', 'Kostanay', 63.62, 53.21, 0.026, 'Kostanay'),
    d('GUW', 'Atırav', 51.92, 47.11, 0.03, 'Atırav'),
    d('KZO', 'Kızılorda', 65.51, 44.85, 0.024, 'Kızılorda'),
  ],
  '642': [
    d('SBI', 'Sibiu', 24.15, 45.8, 0.05, 'Sibiu'),
    d('BCM', 'Bacău', 26.91, 46.57, 0.048, 'Bacău'),
    d('PLI', 'Ploiești', 26.03, 44.94, 0.046, 'Ploiești'),
    d('ORA', 'Oradea', 21.93, 47.06, 0.046, 'Nagyvárad'),
  ],
  '566': [
    d('KAN', 'Kano', 8.52, 12.0, 0.045, 'Kano'),
    d('IBA', 'Ibadan', 3.95, 7.38, 0.045, 'Ibadan'),
    d('PHC', 'Port Harcourt', 7.01, 4.82, 0.04, 'Port Harcourt'),
    d('BNI', 'Benin City', 5.6, 6.34, 0.038, 'Benin'),
    d('KAD', 'Kaduna', 7.44, 10.52, 0.038, 'Kaduna'),
    d('MGD', 'Maiduguri', 13.15, 11.83, 0.034, 'Maiduguri'),
  ],
  '710': [
    d('DUR', 'Durban', 31.02, -29.86, 0.045, 'Durban'),
    d('JHB', 'Johannesburg', 28.05, -26.2, 0.05, 'Johannesburg'),
    d('BFN', 'Bloemfontein', 26.16, -29.09, 0.038, 'Bloemfontein'),
    d('PLZ', 'Port Elizabeth', 25.6, -33.96, 0.038, 'Port Elizabeth'),
    d('ELS', 'East London', 27.85, -33.02, 0.032, 'East London'),
    d('KIM', 'Kimberley', 24.76, -28.73, 0.032, 'Kimberley'),
  ],
  '231': [
    d('GDQ', 'Gondar', 37.47, 12.6, 0.045, 'Gondar'),
    d('MQX', 'Mekele', 39.47, 13.5, 0.04, 'Mekele'),
    d('BJR', 'Bahir Dar', 37.39, 11.59, 0.04, 'Bahir Dar'),
    d('DES', 'Dessie', 39.63, 11.13, 0.034, 'Dessie'),
    d('JIM', 'Jimma', 36.83, 7.67, 0.034, 'Jimma'),
    d('AXU', 'Aksum', 38.72, 14.13, 0.032, 'Aksum'),
  ],
};
