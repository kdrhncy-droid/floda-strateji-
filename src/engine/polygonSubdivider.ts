import { geoArea } from 'd3-geo';
import type { Feature, Geometry, Polygon, Position } from 'geojson';
import { DISTRICT_PROVINCE_SEEDS } from './districtSeeds';
import type { ProvinceSubSeed } from './core/provinceSeedTypes';

export type { ProvinceSubSeed } from './core/provinceSeedTypes';

// Curated authentic sub-provinces for major and regional countries (original 448-province map).
// Preserved verbatim so every legacy province ID survives without a save/scenario migration.
const CURATED_PROVINCE_SEEDS: Record<string, ProvinceSubSeed[]> = {
  // Türkiye / Osmanlı Coğrafyası (20 Şehir)
  '792': [
    { suffixId: 'ANK', name: 'Ankara', lon: 32.85, lat: 39.92, isCapital: true, gdpShare: 0.09, historicName: 'Engürü', resource: 'DEMIR_CELIK' },
    { suffixId: 'IST', name: 'İstanbul', lon: 28.97, lat: 41.02, gdpShare: 0.13, historicName: 'Konstantiniyye', resource: 'TICARET_BOGAZI' },
    { suffixId: 'EDR', name: 'Edirne', lon: 26.55, lat: 41.67, gdpShare: 0.06, historicName: 'Edirne', resource: 'TAHIL' },
    { suffixId: 'GLB', name: 'Çanakkale', lon: 26.65, lat: 39.95, gdpShare: 0.04, historicName: 'Gelibolu', resource: 'TICARET_BOGAZI' },
    { suffixId: 'BUR', name: 'Bursa', lon: 29.06, lat: 40.18, gdpShare: 0.07, historicName: 'Hüdavendigar', resource: 'FINANS_MERKEZI' },
    { suffixId: 'IZM', name: 'İzmir', lon: 27.14, lat: 38.42, gdpShare: 0.07, historicName: 'İzmir', resource: 'PAMUK' },
    { suffixId: 'MUG', name: 'Muğla', lon: 28.36, lat: 37.21, gdpShare: 0.04, historicName: 'Menteşe', resource: 'KERESTE' },
    { suffixId: 'KUT', name: 'Kütahya', lon: 29.98, lat: 39.42, gdpShare: 0.04, historicName: 'Germiyan', resource: 'ALTIN' },
    { suffixId: 'ANT', name: 'Antalya', lon: 30.70, lat: 36.88, gdpShare: 0.05, historicName: 'Teke', resource: 'KERESTE' },
    { suffixId: 'KNY', name: 'Konya', lon: 32.48, lat: 37.87, gdpShare: 0.05, historicName: 'Karaman', resource: 'TAHIL' },
    { suffixId: 'KYS', name: 'Sivas', lon: 36.15, lat: 39.20, gdpShare: 0.05, historicName: 'Rum', resource: 'SIGIR' },
    { suffixId: 'KST', name: 'Kastamonu', lon: 34.05, lat: 41.55, gdpShare: 0.04, historicName: 'Kastamonu', resource: 'KERESTE' },
    { suffixId: 'SAM', name: 'Samsun', lon: 36.33, lat: 41.28, gdpShare: 0.04, historicName: 'Canik', resource: 'TAHIL' },
    { suffixId: 'ADA', name: 'Adana', lon: 35.32, lat: 37.00, gdpShare: 0.04, historicName: 'Adana', resource: 'PAMUK' },
    { suffixId: 'GZP', name: 'Gaziantep', lon: 37.38, lat: 37.35, gdpShare: 0.04, historicName: 'Ayıntab', resource: 'PAMUK' },
    { suffixId: 'MLT', name: 'Malatya', lon: 38.55, lat: 38.65, gdpShare: 0.03, historicName: 'Malatya', resource: 'ALTIN' },
    { suffixId: 'TRB', name: 'Trabzon', lon: 40.35, lat: 40.95, gdpShare: 0.04, historicName: 'Trabzon', resource: 'KERESTE' },
    { suffixId: 'ERZ', name: 'Erzurum', lon: 41.27, lat: 39.85, gdpShare: 0.03, historicName: 'Erzurum', resource: 'SIGIR' },
    { suffixId: 'DYB', name: 'Diyarbakır', lon: 40.23, lat: 37.91, gdpShare: 0.03, historicName: 'Amid', resource: 'PETROL' },
    { suffixId: 'VAN', name: 'Van', lon: 43.15, lat: 38.50, gdpShare: 0.02, historicName: 'Van', resource: 'SIGIR' },
  ],
  // Yunanistan (4 Şehir)
  '300': [
    { suffixId: 'ATH', name: 'Atina', lon: 23.72, lat: 37.98, isCapital: true, gdpShare: 0.42, historicName: 'Atina', resource: 'TICARET_BOGAZI' },
    { suffixId: 'SKG', name: 'Selanik', lon: 22.94, lat: 40.64, gdpShare: 0.26, historicName: 'Selanik', resource: 'PAMUK' },
    { suffixId: 'IOA', name: 'Yanya', lon: 20.85, lat: 39.66, gdpShare: 0.14, resource: 'SIGIR' },
    { suffixId: 'CRT', name: 'Girit', lon: 25.14, lat: 35.33, gdpShare: 0.18, resource: 'TICARET_BOGAZI' },
  ],
  // Bulgaristan (3 Şehir)
  '100': [
    { suffixId: 'SOF', name: 'Sofya', lon: 23.32, lat: 42.69, isCapital: true, gdpShare: 0.44, historicName: 'Sofya', resource: 'DEMIR_CELIK' },
    { suffixId: 'PDV', name: 'Filibe', lon: 24.74, lat: 42.14, gdpShare: 0.30, resource: 'TAHIL' },
    { suffixId: 'VAR', name: 'Varna', lon: 27.91, lat: 43.21, gdpShare: 0.26, resource: 'KERESTE' },
  ],
  // Sırbistan (2 Şehir)
  '688': [
    { suffixId: 'BEG', name: 'Belgrad', lon: 20.46, lat: 44.81, isCapital: true, gdpShare: 0.58, resource: 'ALTIN' },
    { suffixId: 'NIS', name: 'Niş', lon: 21.89, lat: 43.32, gdpShare: 0.42, resource: 'SIGIR' },
  ],
  // Bosna-Hersek (2 Şehir)
  '070': [
    { suffixId: 'SJJ', name: 'Saraybosna', lon: 18.41, lat: 43.85, isCapital: true, gdpShare: 0.60, resource: 'DEMIR_CELIK' },
    { suffixId: 'OMO', name: 'Mostar', lon: 17.80, lat: 43.34, gdpShare: 0.40, resource: 'TAHIL' },
  ],
  // Hırvatistan (2 Şehir)
  '191': [
    { suffixId: 'ZAG', name: 'Zagreb', lon: 15.98, lat: 45.81, isCapital: true, gdpShare: 0.58, resource: 'TAHIL' },
    { suffixId: 'SPU', name: 'Split', lon: 16.44, lat: 43.50, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // Romanya (6 Şehir)
  '642': [
    { suffixId: 'BUH', name: 'Bükreş', lon: 26.10, lat: 44.42, isCapital: true, gdpShare: 0.28, resource: 'FINANS_MERKEZI' },
    { suffixId: 'CLJ', name: 'Kaloşvar', lon: 23.60, lat: 46.77, gdpShare: 0.20, resource: 'DEMIR_CELIK' },
    { suffixId: 'TSR', name: 'Temeşvar', lon: 21.23, lat: 45.75, gdpShare: 0.13, resource: 'TAHIL' },
    { suffixId: 'IAS', name: 'Yaş', lon: 27.60, lat: 47.16, gdpShare: 0.14, resource: 'TAHIL' },
    { suffixId: 'CND', name: 'Köstence', lon: 28.63, lat: 44.17, gdpShare: 0.13, resource: 'PETROL' },
    { suffixId: 'CRA', name: 'Krayova', lon: 23.80, lat: 44.32, gdpShare: 0.12, resource: 'TAHIL' },
  ],
  // Macaristan (4 Şehir)
  '348': [
    { suffixId: 'BUD', name: 'Budin', lon: 19.04, lat: 47.49, isCapital: true, gdpShare: 0.40, resource: 'FINANS_MERKEZI' },
    { suffixId: 'DEB', name: 'Debrecen', lon: 21.62, lat: 47.53, gdpShare: 0.24, resource: 'TAHIL' },
    { suffixId: 'PEC', name: 'Peçuy', lon: 18.23, lat: 46.07, gdpShare: 0.19, resource: 'DEMIR_CELIK' },
    { suffixId: 'QGY', name: 'Győr', lon: 17.30, lat: 47.45, gdpShare: 0.17, resource: 'TAHIL' },
  ],
  // Avusturya (3 Şehir)
  '040': [
    { suffixId: 'VIE', name: 'Viyana', lon: 16.37, lat: 48.20, isCapital: true, gdpShare: 0.48, historicName: 'Wien', resource: 'FINANS_MERKEZI' },
    { suffixId: 'GRZ', name: 'Graz', lon: 15.43, lat: 47.07, gdpShare: 0.28, resource: 'DEMIR_CELIK' },
    { suffixId: 'INN', name: 'Innsbruck', lon: 11.40, lat: 47.26, gdpShare: 0.24, resource: 'YARI_ILETKEN' },
  ],
  // Çekya (2 Şehir)
  '203': [
    { suffixId: 'PRG', name: 'Prag', lon: 14.43, lat: 50.07, isCapital: true, gdpShare: 0.60, historicName: 'Praha', resource: 'DEMIR_CELIK' },
    { suffixId: 'BRQ', name: 'Brno', lon: 16.60, lat: 49.19, gdpShare: 0.40, resource: 'YARI_ILETKEN' },
  ],
  // Suriye (4 Şehir)
  '760': [
    { suffixId: 'DAM', name: 'Şam', lon: 36.29, lat: 33.51, isCapital: true, gdpShare: 0.34, historicName: 'Dimaşk', resource: 'TAHIL' },
    { suffixId: 'ALP', name: 'Halep', lon: 37.16, lat: 36.20, gdpShare: 0.30, resource: 'TAHIL' },
    { suffixId: 'LTK', name: 'Lazkiye', lon: 35.78, lat: 35.53, gdpShare: 0.18, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DEZ', name: 'Deyrizor', lon: 40.14, lat: 35.33, gdpShare: 0.18, resource: 'PETROL' },
  ],
  // Irak (4 Şehir)
  '368': [
    { suffixId: 'BGW', name: 'Bağdat', lon: 44.36, lat: 33.31, isCapital: true, gdpShare: 0.36, historicName: 'Bağdat', resource: 'PETROL' },
    { suffixId: 'BSR', name: 'Basra', lon: 47.78, lat: 30.50, gdpShare: 0.28, resource: 'PETROL' },
    { suffixId: 'EBL', name: 'Musul', lon: 43.13, lat: 36.34, gdpShare: 0.20, resource: 'DOGALGAZ' },
    { suffixId: 'KIK', name: 'Kerkük', lon: 44.39, lat: 35.46, gdpShare: 0.16, resource: 'PETROL' },
  ],
  // Gürcistan (2 Şehir)
  '268': [
    { suffixId: 'TBS', name: 'Tiflis', lon: 44.78, lat: 41.71, isCapital: true, gdpShare: 0.62, resource: 'DEMIR_CELIK' },
    { suffixId: 'BUS', name: 'Batum', lon: 41.63, lat: 41.64, gdpShare: 0.38, resource: 'TICARET_BOGAZI' },
  ],
  // Azerbaycan (3 Şehir)
  '031': [
    { suffixId: 'BAK', name: 'Bakü', lon: 49.86, lat: 40.40, isCapital: true, gdpShare: 0.50, resource: 'PETROL' },
    { suffixId: 'GNJ', name: 'Gence', lon: 46.36, lat: 40.68, gdpShare: 0.28, resource: 'DOGALGAZ' },
    { suffixId: 'SKX', name: 'Şuşa', lon: 46.75, lat: 39.76, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
  ],
  // İran (7 Şehir)
  '364': [
    { suffixId: 'THR', name: 'Tahran', lon: 51.38, lat: 35.68, isCapital: true, gdpShare: 0.22, resource: 'FINANS_MERKEZI' },
    { suffixId: 'TBZ', name: 'Tebriz', lon: 46.29, lat: 38.08, gdpShare: 0.16, resource: 'DOGALGAZ' },
    { suffixId: 'ISF', name: 'İsfahan', lon: 51.67, lat: 32.65, gdpShare: 0.16, resource: 'DEMIR_CELIK' },
    { suffixId: 'AWZ', name: 'Ahvaz', lon: 48.67, lat: 31.32, gdpShare: 0.15, resource: 'PETROL' },
    { suffixId: 'SYZ', name: 'Şiraz', lon: 52.53, lat: 29.59, gdpShare: 0.11, resource: 'TICARET_BOGAZI' },
    { suffixId: 'KER', name: 'Kirman', lon: 57.08, lat: 30.28, gdpShare: 0.09, resource: 'NADIR_TOPRAK' },
    { suffixId: 'MHD', name: 'Meşhed', lon: 59.60, lat: 36.29, gdpShare: 0.11, resource: 'DEMIR_CELIK' },
  ],
  // Almanya (11 Şehir)
  '276': [
    { suffixId: 'BER', name: 'Berlin', lon: 13.40, lat: 52.52, isCapital: true, gdpShare: 0.12, historicName: 'Cölln', resource: 'YARI_ILETKEN' },
    { suffixId: 'MUC', name: 'Münih', lon: 11.58, lat: 48.13, gdpShare: 0.12, resource: 'YARI_ILETKEN' },
    { suffixId: 'STR', name: 'Stuttgart', lon: 9.18, lat: 48.78, gdpShare: 0.09, resource: 'YARI_ILETKEN' },
    { suffixId: 'FRA', name: 'Frankfurt', lon: 8.68, lat: 50.11, gdpShare: 0.12, resource: 'FINANS_MERKEZI' },
    { suffixId: 'HAM', name: 'Hamburg', lon: 9.99, lat: 53.55, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DRS', name: 'Dresden', lon: 13.73, lat: 51.05, gdpShare: 0.08, resource: 'DEMIR_CELIK' },
    { suffixId: 'CGN', name: 'Köln', lon: 6.96, lat: 50.94, gdpShare: 0.10, resource: 'FINANS_MERKEZI' },
    { suffixId: 'NUE', name: 'Nürnberg', lon: 11.08, lat: 49.45, gdpShare: 0.08, resource: 'DEMIR_CELIK' },
    { suffixId: 'HAJ', name: 'Hannover', lon: 9.73, lat: 52.37, gdpShare: 0.07, resource: 'TAHIL' },
    { suffixId: 'RLG', name: 'Lübeck', lon: 12.10, lat: 54.09, gdpShare: 0.07, resource: 'TICARET_BOGAZI' },
    { suffixId: 'AGB', name: 'Augsburg', lon: 10.40, lat: 48.37, gdpShare: 0.06, resource: 'FINANS_MERKEZI' },
  ],
  // Fransa (10 Şehir)
  '250': [
    { suffixId: 'PAR', name: 'Paris', lon: 2.35, lat: 48.85, isCapital: true, gdpShare: 0.18, resource: 'FINANS_MERKEZI' },
    { suffixId: 'LYO', name: 'Lyon', lon: 4.83, lat: 45.76, gdpShare: 0.12, resource: 'YARI_ILETKEN' },
    { suffixId: 'MRS', name: 'Marsilya', lon: 5.36, lat: 43.29, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'TLS', name: 'Toulouse', lon: 1.44, lat: 43.60, gdpShare: 0.09, resource: 'TAHIL' },
    { suffixId: 'BDX', name: 'Bordeaux', lon: -0.57, lat: 44.83, gdpShare: 0.10, resource: 'TAHIL' },
    { suffixId: 'NTE', name: 'Nantes', lon: -1.55, lat: 47.22, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'URO', name: 'Rouen', lon: 1.09, lat: 49.44, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DIJ', name: 'Dijon', lon: 5.04, lat: 47.32, gdpShare: 0.08, resource: 'TAHIL' },
    { suffixId: 'RNS', name: 'Reims', lon: 4.03, lat: 49.26, gdpShare: 0.08, resource: 'TAHIL' },
    { suffixId: 'ORY', name: 'Orléans', lon: 1.90, lat: 47.40, gdpShare: 0.07, resource: 'TAHIL' },
  ],
  // Birleşik Krallık (8 Şehir: 6 İngiltere/Galler + 2 İskoçya)
  '826': [
    { suffixId: 'LON', name: 'Londra', lon: -0.12, lat: 51.50, isCapital: true, gdpShare: 0.25, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MAN', name: 'Manchester', lon: -2.24, lat: 53.48, gdpShare: 0.14, resource: 'DEMIR_CELIK' },
    { suffixId: 'CWL', name: 'Cardiff', lon: -3.18, lat: 51.48, gdpShare: 0.09, resource: 'DEMIR_CELIK' },
    { suffixId: 'EDI', name: 'Edinburgh', lon: -3.18, lat: 55.95, gdpShare: 0.12, resource: 'PETROL' },
    { suffixId: 'BRS', name: 'Bristol', lon: -2.59, lat: 51.15, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'NWI', name: 'Norwich', lon: 1.10, lat: 52.63, gdpShare: 0.10, resource: 'TAHIL' },
    { suffixId: 'NCL', name: 'Newcastle', lon: -1.61, lat: 54.97, gdpShare: 0.10, resource: 'DEMIR_CELIK' },
    { suffixId: 'GLA', name: 'Glasgow', lon: -4.25, lat: 55.86, gdpShare: 0.10, resource: 'KERESTE' },
  ],
  // İtalya (9 Şehir)
  '380': [
    { suffixId: 'ROM', name: 'Roma', lon: 12.49, lat: 41.90, isCapital: true, gdpShare: 0.16, resource: 'FINANS_MERKEZI' },
    { suffixId: 'FLR', name: 'Floransa', lon: 11.25, lat: 43.77, gdpShare: 0.11, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MIL', name: 'Milano', lon: 9.19, lat: 45.46, gdpShare: 0.16, resource: 'YARI_ILETKEN' },
    { suffixId: 'VCE', name: 'Venedik', lon: 12.31, lat: 45.44, gdpShare: 0.12, resource: 'TICARET_BOGAZI' },
    { suffixId: 'NAP', name: 'Napoli', lon: 14.26, lat: 40.85, gdpShare: 0.11, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PMO', name: 'Palermo', lon: 13.36, lat: 38.05, gdpShare: 0.08, resource: 'TICARET_BOGAZI' },
    { suffixId: 'GOA', name: 'Cenova', lon: 8.93, lat: 44.41, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'TRN', name: 'Torino', lon: 7.50, lat: 45.10, gdpShare: 0.09, resource: 'DEMIR_CELIK' },
    { suffixId: 'BRI', name: 'Bari', lon: 16.87, lat: 41.12, gdpShare: 0.07, resource: 'TAHIL' },
  ],
  // İspanya (9 Şehir)
  '724': [
    { suffixId: 'MAD', name: 'Madrid', lon: -3.70, lat: 40.41, isCapital: true, gdpShare: 0.18, resource: 'FINANS_MERKEZI' },
    { suffixId: 'BCN', name: 'Barselona', lon: 2.17, lat: 41.38, gdpShare: 0.15, resource: 'TICARET_BOGAZI' },
    { suffixId: 'VLC', name: 'Valensiya', lon: -0.38, lat: 39.47, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SEV', name: 'Sevilla', lon: -5.98, lat: 37.38, gdpShare: 0.11, resource: 'TAHIL' },
    { suffixId: 'GRX', name: 'Granada', lon: -3.60, lat: 37.18, gdpShare: 0.08, resource: 'TAHIL' },
    { suffixId: 'BIO', name: 'Bilbao', lon: -2.93, lat: 43.26, gdpShare: 0.10, resource: 'DEMIR_CELIK' },
    { suffixId: 'ZAZ', name: 'Zaragoza', lon: -0.89, lat: 41.65, gdpShare: 0.10, resource: 'TAHIL' },
    { suffixId: 'VLL', name: 'Valladolid', lon: -4.72, lat: 41.90, gdpShare: 0.10, resource: 'TAHIL' },
    { suffixId: 'MJV', name: 'Murcia', lon: -1.40, lat: 37.99, gdpShare: 0.08, resource: 'PAMUK' },
  ],
  // Portekiz (3 Şehir)
  '620': [
    { suffixId: 'LIS', name: 'Lizbon', lon: -9.13, lat: 38.72, isCapital: true, gdpShare: 0.46, resource: 'TICARET_BOGAZI' },
    { suffixId: 'OPO', name: 'Porto', lon: -8.62, lat: 41.15, gdpShare: 0.32, resource: 'FINANS_MERKEZI' },
    { suffixId: 'FAO', name: 'Faro', lon: -7.93, lat: 37.30, gdpShare: 0.22, resource: 'TICARET_BOGAZI' },
  ],
  // Ukrayna (4 Şehir)
  '804': [
    { suffixId: 'KYV', name: 'Kiev', lon: 30.52, lat: 50.45, isCapital: true, gdpShare: 0.32, historicName: 'Kiev', resource: 'TAHIL' },
    { suffixId: 'LVV', name: 'Lviv', lon: 24.03, lat: 49.84, gdpShare: 0.22, resource: 'TAHIL' },
    { suffixId: 'ODS', name: 'Odessa', lon: 30.72, lat: 46.48, gdpShare: 0.24, resource: 'TICARET_BOGAZI' },
    { suffixId: 'HRK', name: 'Harkiv', lon: 36.23, lat: 49.00, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
  ],
  // Polonya (6 Şehir)
  '616': [
    { suffixId: 'WAW', name: 'Varşova', lon: 21.01, lat: 52.23, isCapital: true, gdpShare: 0.24, historicName: 'Warszawa', resource: 'FINANS_MERKEZI' },
    { suffixId: 'POZ', name: 'Poznań', lon: 16.92, lat: 52.40, gdpShare: 0.15, resource: 'TAHIL' },
    { suffixId: 'KRK', name: 'Krakow', lon: 19.94, lat: 50.06, gdpShare: 0.19, historicName: 'Kraków', resource: 'DEMIR_CELIK' },
    { suffixId: 'GDN', name: 'Gdansk', lon: 18.64, lat: 54.35, gdpShare: 0.15, historicName: 'Danzig', resource: 'TICARET_BOGAZI' },
    { suffixId: 'LUZ', name: 'Lublin', lon: 22.57, lat: 51.25, gdpShare: 0.13, resource: 'TAHIL' },
    { suffixId: 'WRO', name: 'Wrocław', lon: 17.03, lat: 51.11, gdpShare: 0.14, resource: 'DEMIR_CELIK' },
  ],
  // Belarus (2 Şehir)
  '112': [
    { suffixId: 'MSQ', name: 'Minsk', lon: 27.56, lat: 53.90, isCapital: true, gdpShare: 0.58, resource: 'TAHIL' },
    { suffixId: 'BQT', name: 'Brest', lon: 23.68, lat: 52.09, gdpShare: 0.42, resource: 'DEMIR_CELIK' },
  ],
  // Litvanya (2 Şehir)
  '440': [
    { suffixId: 'VNO', name: 'Vilnius', lon: 25.27, lat: 54.68, isCapital: true, gdpShare: 0.58, resource: 'TAHIL' },
    { suffixId: 'KUN', name: 'Kaunas', lon: 23.90, lat: 54.89, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // İsveç (3 Şehir)
  '752': [
    { suffixId: 'STO', name: 'Stokholm', lon: 18.06, lat: 59.32, isCapital: true, gdpShare: 0.45, resource: 'YARI_ILETKEN' },
    { suffixId: 'GOT', name: 'Göteborg', lon: 11.97, lat: 57.70, gdpShare: 0.33, resource: 'TICARET_BOGAZI' },
    { suffixId: 'KIR', name: 'Kiruna', lon: 20.22, lat: 67.85, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
  ],
  // Norveç (3 Şehir)
  '578': [
    { suffixId: 'OSL', name: 'Oslo', lon: 10.75, lat: 59.91, isCapital: true, gdpShare: 0.46, resource: 'FINANS_MERKEZI' },
    { suffixId: 'BGO', name: 'Bergen', lon: 5.32, lat: 60.39, gdpShare: 0.34, resource: 'DOGALGAZ' },
    { suffixId: 'TOS', name: 'Tromsø', lon: 18.95, lat: 69.64, gdpShare: 0.20, resource: 'PETROL' },
  ],
  // Finlandiya (2 Şehir)
  '246': [
    { suffixId: 'HEL', name: 'Helsinki', lon: 24.93, lat: 60.16, isCapital: true, gdpShare: 0.64, resource: 'YARI_ILETKEN' },
    { suffixId: 'OUL', name: 'Oulu', lon: 25.46, lat: 65.01, gdpShare: 0.36, resource: 'DEMIR_CELIK' },
  ],
  // Rusya (18 Şehir)
  '643': [
    { suffixId: 'MOW', name: 'Moskova', lon: 37.61, lat: 55.75, isCapital: true, gdpShare: 0.14, historicName: 'Moskva', resource: 'FINANS_MERKEZI' },
    { suffixId: 'LED', name: 'St. Petersburg', lon: 30.33, lat: 59.93, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SMO', name: 'Smolensk', lon: 32.04, lat: 54.78, gdpShare: 0.05, resource: 'KERESTE' },
    { suffixId: 'GOJ', name: 'Nijni Novgorod', lon: 44.00, lat: 56.32, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'KRR', name: 'Krasnodar', lon: 39.00, lat: 45.03, gdpShare: 0.06, resource: 'TAHIL' },
    { suffixId: 'ROV', name: 'Rostov-na-Donu', lon: 39.70, lat: 47.23, gdpShare: 0.05, historicName: 'Azak', resource: 'TAHIL' },
    { suffixId: 'VOG', name: 'Volgograd', lon: 44.51, lat: 48.70, gdpShare: 0.05, historicName: 'Saray', resource: 'DEMIR_CELIK' },
    { suffixId: 'ASF', name: 'Astrahan', lon: 48.03, lat: 46.34, gdpShare: 0.05, historicName: 'Hacı Tarhan', resource: 'PETROL' },
    { suffixId: 'KZN', name: 'Kazan', lon: 49.10, lat: 55.79, gdpShare: 0.06, historicName: 'Kazan', resource: 'DOGALGAZ' },
    { suffixId: 'KUF', name: 'Samara', lon: 50.15, lat: 53.20, gdpShare: 0.05, resource: 'PETROL' },
    { suffixId: 'ARH', name: 'Arhangelsk', lon: 40.54, lat: 64.54, gdpShare: 0.04, resource: 'KERESTE' },
    { suffixId: 'SVX', name: 'Yekaterinburg', lon: 60.60, lat: 56.83, gdpShare: 0.06, historicName: 'Kamenny Poyas', resource: 'DEMIR_CELIK' },
    { suffixId: 'OMS', name: 'Omsk', lon: 73.36, lat: 54.99, gdpShare: 0.04, resource: 'TAHIL' },
    { suffixId: 'OVB', name: 'Novosibirsk', lon: 82.92, lat: 55.00, gdpShare: 0.05, resource: 'DOGALGAZ' },
    { suffixId: 'KJA', name: 'Krasnoyarsk', lon: 92.86, lat: 56.01, gdpShare: 0.04, resource: 'ALTIN' },
    { suffixId: 'IKT', name: 'İrkutsk', lon: 104.30, lat: 52.28, gdpShare: 0.04, resource: 'NADIR_TOPRAK' },
    { suffixId: 'KHV', name: 'Habarovsk', lon: 135.08, lat: 48.48, gdpShare: 0.03, resource: 'KERESTE' },
    { suffixId: 'VVO', name: 'Vladivostok', lon: 131.89, lat: 43.12, gdpShare: 0.04, resource: 'TICARET_BOGAZI' },
  ],
  // Kazakistan (4 Şehir)
  '398': [
    { suffixId: 'NQZ', name: 'Astana', lon: 71.44, lat: 51.16, isCapital: true, gdpShare: 0.32, resource: 'DEMIR_CELIK' },
    { suffixId: 'ALA', name: 'Almatı', lon: 76.88, lat: 43.23, gdpShare: 0.28, resource: 'FINANS_MERKEZI' },
    { suffixId: 'SCO', name: 'Aktau', lon: 51.19, lat: 43.65, gdpShare: 0.22, resource: 'PETROL' },
    { suffixId: 'CIT', name: 'Çimkent', lon: 68.50, lat: 42.90, gdpShare: 0.18, resource: 'TAHIL' },
  ],
  // Özbekistan (3 Şehir)
  '860': [
    { suffixId: 'TAS', name: 'Taşkent', lon: 69.24, lat: 41.29, isCapital: true, gdpShare: 0.42, resource: 'TAHIL' },
    { suffixId: 'SKD', name: 'Semerkant', lon: 66.95, lat: 39.65, gdpShare: 0.36, resource: 'FINANS_MERKEZI' },
    { suffixId: 'UGC', name: 'Hive', lon: 60.63, lat: 41.55, gdpShare: 0.22, resource: 'DOGALGAZ' },
  ],
  // Türkmenistan (2 Şehir)
  '795': [
    { suffixId: 'ASB', name: 'Aşkabat', lon: 58.38, lat: 37.96, isCapital: true, gdpShare: 0.58, resource: 'DOGALGAZ' },
    { suffixId: 'KRW', name: 'Türkmenbaşı', lon: 53.00, lat: 40.02, gdpShare: 0.42, resource: 'PETROL' },
  ],
  // Afganistan (3 Şehir)
  '004': [
    { suffixId: 'KBL', name: 'Kabil', lon: 69.17, lat: 34.52, isCapital: true, gdpShare: 0.42, resource: 'NADIR_TOPRAK' },
    { suffixId: 'HEA', name: 'Herat', lon: 62.20, lat: 34.35, gdpShare: 0.32, resource: 'TAHIL' },
    { suffixId: 'KDH', name: 'Kandahar', lon: 65.73, lat: 31.62, gdpShare: 0.26, resource: 'DEMIR_CELIK' },
  ],
  // ABD (16 Şehir)
  '840': [
    { suffixId: 'WAS', name: 'Washington', lon: -77.50, lat: 38.40, isCapital: true, gdpShare: 0.09, historicName: 'Potomac', resource: 'FINANS_MERKEZI' },
    { suffixId: 'NYC', name: 'New York', lon: -73.80, lat: 41.50, gdpShare: 0.11, historicName: 'Lenape', resource: 'FINANS_MERKEZI' },
    { suffixId: 'BOS', name: 'Boston', lon: -71.06, lat: 42.36, gdpShare: 0.06, historicName: 'Shawmut', resource: 'YARI_ILETKEN' },
    { suffixId: 'PHI', name: 'Philadelphia', lon: -75.16, lat: 39.95, gdpShare: 0.05, resource: 'DEMIR_CELIK' },
    { suffixId: 'CHI', name: 'Şikago', lon: -87.62, lat: 41.87, gdpShare: 0.08, historicName: 'Mishigami', resource: 'TAHIL' },
    { suffixId: 'DET', name: 'Detroit', lon: -83.04, lat: 42.33, gdpShare: 0.05, resource: 'DEMIR_CELIK' },
    { suffixId: 'MSP', name: 'Minneapolis', lon: -93.26, lat: 44.97, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'ATL', name: 'Atlanta', lon: -84.38, lat: 33.74, gdpShare: 0.06, resource: 'PAMUK' },
    { suffixId: 'MIA', name: 'Miami', lon: -81.50, lat: 27.60, gdpShare: 0.05, historicName: 'Tequesta', resource: 'TICARET_BOGAZI' },
    { suffixId: 'HOU', name: 'Houston', lon: -95.36, lat: 29.76, gdpShare: 0.07, resource: 'PETROL' },
    { suffixId: 'DAL', name: 'Dallas', lon: -96.79, lat: 32.77, gdpShare: 0.06, resource: 'DOGALGAZ' },
    { suffixId: 'DEN', name: 'Denver', lon: -104.99, lat: 39.73, gdpShare: 0.05, resource: 'ALTIN' },
    { suffixId: 'PHX', name: 'Phoenix', lon: -112.07, lat: 33.44, gdpShare: 0.05, resource: 'NADIR_TOPRAK' },
    { suffixId: 'LAX', name: 'Los Angeles', lon: -118.24, lat: 34.05, gdpShare: 0.07, historicName: 'Yangna', resource: 'YARI_ILETKEN' },
    { suffixId: 'SFO', name: 'San Francisco', lon: -122.41, lat: 37.77, gdpShare: 0.05, historicName: 'Yerba Buena', resource: 'YARI_ILETKEN' },
    { suffixId: 'SEA', name: 'Seattle', lon: -122.33, lat: 47.60, gdpShare: 0.05, historicName: 'Duwamish', resource: 'KERESTE' },
  ],
  // Kanada (6 Şehir)
  '124': [
    { suffixId: 'YOW', name: 'Ottawa', lon: -75.69, lat: 45.42, isCapital: true, gdpShare: 0.22, historicName: 'Odawa', resource: 'FINANS_MERKEZI' },
    { suffixId: 'YYZ', name: 'Toronto', lon: -79.38, lat: 43.65, gdpShare: 0.20, historicName: 'Taronto', resource: 'DEMIR_CELIK' },
    { suffixId: 'YUL', name: 'Montreal', lon: -73.57, lat: 45.50, gdpShare: 0.16, historicName: 'Hochelaga', resource: 'KERESTE' },
    { suffixId: 'YWG', name: 'Winnipeg', lon: -97.13, lat: 49.89, gdpShare: 0.12, resource: 'TAHIL' },
    { suffixId: 'YYC', name: 'Calgary', lon: -114.07, lat: 51.04, gdpShare: 0.15, resource: 'PETROL' },
    { suffixId: 'YVR', name: 'Vancouver', lon: -123.12, lat: 49.28, gdpShare: 0.15, resource: 'TICARET_BOGAZI' },
  ],
  // Meksika (3 Şehir)
  '484': [
    { suffixId: 'MEX', name: 'Meksiko', lon: -99.13, lat: 19.43, isCapital: true, gdpShare: 0.44, historicName: 'Tenochtitlan', resource: 'FINANS_MERKEZI' },
    { suffixId: 'MTY', name: 'Monterrey', lon: -100.31, lat: 25.68, gdpShare: 0.32, resource: 'DEMIR_CELIK' },
    { suffixId: 'GDL', name: 'Guadalajara', lon: -103.34, lat: 20.65, gdpShare: 0.24, resource: 'PETROL' },
  ],
  // Çin (15 Şehir)
  '156': [
    { suffixId: 'BJS', name: 'Pekin', lon: 116.40, lat: 39.90, isCapital: true, gdpShare: 0.11, resource: 'DEMIR_CELIK' },
    { suffixId: 'SHA', name: 'Şanghay', lon: 121.47, lat: 31.23, gdpShare: 0.12, historicName: 'Songjiang', resource: 'YARI_ILETKEN' },
    { suffixId: 'CAN', name: 'Kanton', lon: 113.45, lat: 23.22, gdpShare: 0.10, historicName: 'Guangzhou', resource: 'TICARET_BOGAZI' },
    { suffixId: 'FOC', name: 'Fuzhou', lon: 119.30, lat: 26.07, gdpShare: 0.06, resource: 'YARI_ILETKEN' },
    { suffixId: 'TAO', name: 'Çingdao', lon: 120.38, lat: 36.06, gdpShare: 0.06, historicName: 'Jiaozhou', resource: 'TICARET_BOGAZI' },
    { suffixId: 'WUH', name: 'Vuhan', lon: 114.30, lat: 30.59, gdpShare: 0.07, historicName: 'Wuchang', resource: 'DEMIR_CELIK' },
    { suffixId: 'CKG', name: 'Çongçing', lon: 106.55, lat: 29.56, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'SIA', name: 'Xi\'an', lon: 108.94, lat: 34.26, gdpShare: 0.06, historicName: "Chang'an", resource: 'TAHIL' },
    { suffixId: 'SHE', name: 'Şenyang', lon: 123.43, lat: 41.80, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'HRB', name: 'Harbin', lon: 126.53, lat: 45.80, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'CTU', name: 'Çengdu', lon: 104.06, lat: 30.67, gdpShare: 0.06, historicName: 'Chengdu', resource: 'NADIR_TOPRAK' },
    { suffixId: 'KMG', name: 'Kunming', lon: 102.83, lat: 24.88, gdpShare: 0.05, resource: 'PAMUK' },
    { suffixId: 'LHW', name: 'Lanzhou', lon: 103.83, lat: 36.06, gdpShare: 0.05, resource: 'ALTIN' },
    { suffixId: 'LXA', name: 'Lhasa', lon: 91.11, lat: 29.65, gdpShare: 0.04, resource: 'NADIR_TOPRAK' },
    { suffixId: 'URC', name: 'Urumçi', lon: 85.61, lat: 41.50, gdpShare: 0.05, resource: 'PETROL' },
  ],
  // Moğolistan (2 Şehir)
  '496': [
    { suffixId: 'ULN', name: 'Ulanbator', lon: 106.90, lat: 47.88, isCapital: true, gdpShare: 0.58, resource: 'DEMIR_CELIK' },
    { suffixId: 'Kov', name: 'Karakurum', lon: 95.50, lat: 47.50, gdpShare: 0.42, resource: 'NADIR_TOPRAK' },
  ],
  // Mısır (4 Şehir)
  '818': [
    { suffixId: 'CAI', name: 'Kahire', lon: 31.23, lat: 30.04, isCapital: true, gdpShare: 0.38, historicName: 'Kahire', resource: 'TAHIL' },
    { suffixId: 'ALY', name: 'İskenderiye', lon: 29.91, lat: 31.20, gdpShare: 0.24, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SUZ', name: 'Süveyş', lon: 33.20, lat: 29.50, gdpShare: 0.20, resource: 'TICARET_BOGAZI' },
    { suffixId: 'ASW', name: 'Asvan', lon: 31.50, lat: 25.00, gdpShare: 0.18, resource: 'PETROL' },
  ],
  // Libya (2 Şehir)
  '434': [
    { suffixId: 'TIP', name: 'Trablus', lon: 13.19, lat: 32.88, isCapital: true, gdpShare: 0.56, resource: 'PETROL' },
    { suffixId: 'BEN', name: 'Bingazi', lon: 20.06, lat: 32.11, gdpShare: 0.44, resource: 'PETROL' },
  ],
  // Tunus (2 Şehir)
  '788': [
    { suffixId: 'TUN', name: 'Tunus', lon: 10.18, lat: 36.80, isCapital: true, gdpShare: 0.60, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SFA', name: 'Kayrevan', lon: 10.10, lat: 34.74, gdpShare: 0.40, resource: 'PETROL' },
  ],
  // Cezayir (3 Şehir)
  '012': [
    { suffixId: 'ALG', name: 'Cezayir', lon: 3.05, lat: 36.75, isCapital: true, gdpShare: 0.46, resource: 'DOGALGAZ' },
    { suffixId: 'ORN', name: 'Oran', lon: -0.63, lat: 35.69, gdpShare: 0.32, resource: 'TICARET_BOGAZI' },
    { suffixId: 'HME', name: 'Tamanrasset', lon: 4.00, lat: 29.00, gdpShare: 0.22, resource: 'PETROL' },
  ],
  // Fas (3 Şehir)
  '504': [
    { suffixId: 'RBA', name: 'Rabat', lon: -6.84, lat: 34.02, isCapital: true, gdpShare: 0.44, resource: 'TICARET_BOGAZI' },
    { suffixId: 'FEZ', name: 'Fes', lon: -5.00, lat: 35.10, gdpShare: 0.28, resource: 'TICARET_BOGAZI' },
    { suffixId: 'RAK', name: 'Marakeş', lon: -7.98, lat: 31.62, gdpShare: 0.28, resource: 'NADIR_TOPRAK' },
  ],
  // Suudi Arabistan (4 Şehir)
  '682': [
    { suffixId: 'RUH', name: 'Riyad', lon: 46.71, lat: 24.71, isCapital: true, gdpShare: 0.32, resource: 'PETROL' },
    { suffixId: 'JED', name: 'Mekke', lon: 39.19, lat: 21.48, gdpShare: 0.24, resource: 'TICARET_BOGAZI' },
    { suffixId: 'MED', name: 'Medine', lon: 38.50, lat: 25.50, gdpShare: 0.18, resource: 'TAHIL' },
    { suffixId: 'DMM', name: 'Dammam', lon: 50.10, lat: 26.42, gdpShare: 0.26, resource: 'PETROL' },
  ],
  // Yemen (2 Şehir)
  '887': [
    { suffixId: 'SAH', name: 'Sana', lon: 44.20, lat: 15.35, isCapital: true, gdpShare: 0.54, resource: 'TAHIL' },
    { suffixId: 'ADE', name: 'Aden', lon: 45.03, lat: 12.78, gdpShare: 0.46, resource: 'TICARET_BOGAZI' },
  ],
  // Etiyopya (2 Şehir)
  '231': [
    { suffixId: 'ADD', name: 'Addis Ababa', lon: 38.74, lat: 9.03, isCapital: true, gdpShare: 0.62, resource: 'TAHIL' },
    { suffixId: 'DIR', name: 'Harar', lon: 42.12, lat: 9.31, gdpShare: 0.38, resource: 'DEMIR_CELIK' },
  ],
  // Nijerya (2 Şehir)
  '566': [
    { suffixId: 'ABV', name: 'Abuja', lon: 7.49, lat: 9.07, isCapital: true, gdpShare: 0.48, historicName: 'Abuja', resource: 'TAHIL' },
    { suffixId: 'LOS', name: 'Lagos', lon: 3.37, lat: 6.52, gdpShare: 0.52, historicName: 'Eko', resource: 'PETROL' },
  ],
  // Güney Afrika (2 Şehir)
  '710': [
    { suffixId: 'JNB', name: 'Pretoria', lon: 28.50, lat: -25.10, isCapital: true, gdpShare: 0.58, historicName: 'Tshwane', resource: 'NADIR_TOPRAK' },
    { suffixId: 'CPT', name: 'Cape Town', lon: 18.42, lat: -33.92, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // Pakistan (3 Şehir)
  '586': [
    { suffixId: 'ISB', name: 'İslamabad', lon: 73.04, lat: 33.68, isCapital: true, gdpShare: 0.44, resource: 'TAHIL' },
    { suffixId: 'KHI', name: 'Karaçi', lon: 67.00, lat: 24.86, gdpShare: 0.36, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PEW', name: 'Peşaver', lon: 71.52, lat: 34.01, gdpShare: 0.20, resource: 'DEMIR_CELIK' },
  ],
  // Hindistan (10 Şehir)
  '356': [
    { suffixId: 'DEL', name: 'Yeni Delhi', lon: 77.20, lat: 28.61, isCapital: true, gdpShare: 0.15, historicName: 'Dehli', resource: 'TAHIL' },
    { suffixId: 'JAI', name: 'Jaipur', lon: 75.78, lat: 26.91, gdpShare: 0.08, historicName: 'Amber', resource: 'PAMUK' },
    { suffixId: 'LKO', name: 'Luknov', lon: 80.94, lat: 26.84, gdpShare: 0.08, historicName: 'Lakhnau', resource: 'TAHIL' },
    { suffixId: 'AMD', name: 'Ahmedabad', lon: 72.57, lat: 23.02, gdpShare: 0.10, historicName: 'Karnavati', resource: 'TICARET_BOGAZI' },
    { suffixId: 'BOM', name: 'Mumbai', lon: 73.50, lat: 18.80, gdpShare: 0.14, historicName: 'Bombay', resource: 'FINANS_MERKEZI' },
    { suffixId: 'HYD', name: 'Haydarabad', lon: 78.48, lat: 17.38, gdpShare: 0.10, historicName: 'Golconda', resource: 'DEMIR_CELIK' },
    { suffixId: 'BLR', name: 'Bangalore', lon: 77.59, lat: 12.97, gdpShare: 0.10, historicName: 'Bengaluru', resource: 'YARI_ILETKEN' },
    { suffixId: 'MAA', name: 'Madras', lon: 80.27, lat: 13.08, gdpShare: 0.09, historicName: 'Madraspatnam', resource: 'TICARET_BOGAZI' },
    { suffixId: 'PAT', name: 'Patna', lon: 84.80, lat: 25.60, gdpShare: 0.07, historicName: 'Pataliputra', resource: 'TAHIL' },
    { suffixId: 'CCU', name: 'Kalküta', lon: 88.36, lat: 22.57, gdpShare: 0.09, historicName: 'Kalikata', resource: 'TICARET_BOGAZI' },
  ],
  // Endonezya (3 Şehir)
  '360': [
    { suffixId: 'JKT', name: 'Cakarta', lon: 106.84, lat: -6.20, isCapital: true, gdpShare: 0.48, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MES', name: 'Medan', lon: 98.67, lat: 3.59, gdpShare: 0.28, resource: 'PETROL' },
    { suffixId: 'BPN', name: 'Balikpapan', lon: 116.83, lat: -1.26, gdpShare: 0.24, resource: 'NADIR_TOPRAK' },
  ],
  // Güney Kore (3 Şehir)
  '410': [
    { suffixId: 'SEL', name: 'Seul', lon: 126.97, lat: 37.56, isCapital: true, gdpShare: 0.48, resource: 'YARI_ILETKEN' },
    { suffixId: 'PUS', name: 'Busan', lon: 129.07, lat: 35.17, gdpShare: 0.30, resource: 'TICARET_BOGAZI' },
    { suffixId: 'KUV', name: 'Gwangju', lon: 126.90, lat: 35.45, gdpShare: 0.22, resource: 'TAHIL' },
  ],
  // Japonya (7 Şehir)
  '392': [
    { suffixId: 'TYO', name: 'Tokyo', lon: 139.69, lat: 35.68, isCapital: true, gdpShare: 0.26, historicName: 'Edo', resource: 'YARI_ILETKEN' },
    { suffixId: 'OSA', name: 'Osaka', lon: 135.50, lat: 34.69, gdpShare: 0.20, resource: 'FINANS_MERKEZI' },
    { suffixId: 'SPK', name: 'Sapporo', lon: 141.35, lat: 42.85, gdpShare: 0.12, historicName: 'Ishikari', resource: 'TICARET_BOGAZI' },
    { suffixId: 'FUK', name: 'Fukuoka', lon: 130.60, lat: 33.20, gdpShare: 0.12, historicName: 'Hakata', resource: 'TICARET_BOGAZI' },
    { suffixId: 'HIJ', name: 'Hiroşima', lon: 132.45, lat: 34.45, gdpShare: 0.10, historicName: 'Aki', resource: 'DEMIR_CELIK' },
    { suffixId: 'NGO', name: 'Nagoya', lon: 137.10, lat: 35.60, gdpShare: 0.11, historicName: 'Nagoya', resource: 'DEMIR_CELIK' },
    { suffixId: 'SDJ', name: 'Sendai', lon: 140.70, lat: 38.40, gdpShare: 0.09, historicName: 'Sendai', resource: 'TAHIL' },
  ],
  // Brezilya (6 Şehir)
  '076': [
    { suffixId: 'BSB', name: 'Brasilia', lon: -47.88, lat: -15.79, isCapital: true, gdpShare: 0.20, resource: 'TAHIL' },
    { suffixId: 'GRU', name: 'Sao Paulo', lon: -46.63, lat: -23.55, gdpShare: 0.25, historicName: 'Piratininga', resource: 'FINANS_MERKEZI' },
    { suffixId: 'GIG', name: 'Rio de Janeiro', lon: -43.17, lat: -22.90, gdpShare: 0.18, historicName: 'Guanabara', resource: 'PETROL' },
    { suffixId: 'SSA', name: 'Salvador', lon: -38.50, lat: -12.97, gdpShare: 0.12, historicName: 'São Salvador', resource: 'PAMUK' },
    { suffixId: 'REC', name: 'Recife', lon: -34.87, lat: -8.04, gdpShare: 0.11, historicName: 'Pernambuco', resource: 'TICARET_BOGAZI' },
    { suffixId: 'MAO', name: 'Manaus', lon: -60.02, lat: -4.00, gdpShare: 0.14, resource: 'NADIR_TOPRAK' },
  ],
  // Arjantin (3 Şehir)
  '032': [
    { suffixId: 'BUE', name: 'Buenos Aires', lon: -58.38, lat: -34.60, isCapital: true, gdpShare: 0.50, historicName: 'Quilmes', resource: 'TAHIL' },
    { suffixId: 'COR', name: 'Córdoba', lon: -64.18, lat: -31.42, gdpShare: 0.28, resource: 'DEMIR_CELIK' },
    { suffixId: 'USH', name: 'Ushuaia', lon: -68.50, lat: -45.80, gdpShare: 0.22, resource: 'DOGALGAZ' },
  ],
  // Avustralya (3 Şehir)
  '036': [
    { suffixId: 'SYD', name: 'Kanberra', lon: 149.13, lat: -35.28, isCapital: true, gdpShare: 0.44, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MEL', name: 'Melbourne', lon: 144.96, lat: -37.81, gdpShare: 0.30, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PER', name: 'Perth', lon: 115.86, lat: -31.95, gdpShare: 0.26, resource: 'NADIR_TOPRAK' },
  ],
  // Vietnam (3 Şehir)
  '704': [
    { suffixId: 'HAN', name: 'Hanoi', lon: 105.83, lat: 21.02, isCapital: true, gdpShare: 0.38, resource: 'DEMIR_CELIK' },
    { suffixId: 'DAD', name: 'Da Nang', lon: 108.20, lat: 16.05, gdpShare: 0.24, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SGN', name: 'Saygon', lon: 106.66, lat: 10.82, gdpShare: 0.38, resource: 'PAMUK' },
  ],
  // Tayland (3 Şehir)
  '764': [
    { suffixId: 'BKK', name: 'Bangkok', lon: 100.50, lat: 13.75, isCapital: true, gdpShare: 0.48, resource: 'FINANS_MERKEZI' },
    { suffixId: 'CNX', name: 'Chiang Mai', lon: 98.98, lat: 18.78, gdpShare: 0.26, resource: 'KERESTE' },
    { suffixId: 'HDY', name: 'Songkhla', lon: 100.47, lat: 7.19, gdpShare: 0.26, resource: 'TICARET_BOGAZI' },
  ],
  // Myanmar (3 Şehir)
  '104': [
    { suffixId: 'RGN', name: 'Yangon', lon: 96.15, lat: 16.84, isCapital: true, gdpShare: 0.42, resource: 'TAHIL' },
    { suffixId: 'MDL', name: 'Mandalay', lon: 96.08, lat: 21.95, gdpShare: 0.34, resource: 'KERESTE' },
    { suffixId: 'MYT', name: 'Myitkyina', lon: 97.39, lat: 25.38, gdpShare: 0.24, resource: 'ALTIN' },
  ],
  // Filipinler (3 Şehir)
  '608': [
    { suffixId: 'MNL', name: 'Manila', lon: 120.98, lat: 14.59, isCapital: true, gdpShare: 0.48, resource: 'FINANS_MERKEZI' },
    { suffixId: 'CEB', name: 'Cebu', lon: 123.88, lat: 10.31, gdpShare: 0.28, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DVO', name: 'Davao', lon: 125.61, lat: 7.07, gdpShare: 0.24, resource: 'KERESTE' },
  ],
  // Bangladeş (2 Şehir)
  '050': [
    { suffixId: 'DAC', name: 'Dakka', lon: 90.41, lat: 23.81, isCapital: true, gdpShare: 0.60, resource: 'PAMUK' },
    { suffixId: 'CGP', name: 'Chittagong', lon: 91.78, lat: 22.35, gdpShare: 0.40, resource: 'TICARET_BOGAZI' },
  ],
  // Malezya (2 Şehir)
  '458': [
    { suffixId: 'KUL', name: 'Kuala Lumpur', lon: 101.68, lat: 3.13, isCapital: true, gdpShare: 0.62, resource: 'TICARET_BOGAZI' },
    { suffixId: 'KCH', name: 'Kuching', lon: 110.35, lat: 1.55, gdpShare: 0.38, resource: 'PETROL' },
  ],
  // Kamboçya (2 Şehir)
  '116': [
    { suffixId: 'PNH', name: 'Phnom Penh', lon: 104.92, lat: 11.55, isCapital: true, gdpShare: 0.58, resource: 'TAHIL' },
    { suffixId: 'REP', name: 'Angkor', lon: 103.85, lat: 13.36, gdpShare: 0.42, resource: 'KERESTE' },
  ],
  // Sri Lanka (2 Şehir)
  '144': [
    { suffixId: 'CMB', name: 'Kolombo', lon: 79.86, lat: 6.92, isCapital: true, gdpShare: 0.60, resource: 'TICARET_BOGAZI' },
    { suffixId: 'KDY', name: 'Kandy', lon: 80.63, lat: 7.29, gdpShare: 0.40, resource: 'PAMUK' },
  ],
  // Kolombiya (3 Şehir)
  '170': [
    { suffixId: 'BOG', name: 'Bogota', lon: -74.07, lat: 4.71, isCapital: true, gdpShare: 0.44, historicName: 'Bacatá', resource: 'FINANS_MERKEZI' },
    { suffixId: 'MDE', name: 'Medellin', lon: -75.56, lat: 6.24, gdpShare: 0.28, resource: 'ALTIN' },
    { suffixId: 'CTG', name: 'Cartagena', lon: -75.51, lat: 10.39, gdpShare: 0.28, resource: 'PETROL' },
  ],
  // Peru (3 Şehir)
  '604': [
    { suffixId: 'LIM', name: 'Lima', lon: -77.04, lat: -12.04, isCapital: true, gdpShare: 0.46, historicName: 'Pachacamac', resource: 'TICARET_BOGAZI' },
    { suffixId: 'CUZ', name: 'Cusco', lon: -71.96, lat: -13.53, gdpShare: 0.32, historicName: 'Qusqu', resource: 'ALTIN' },
    { suffixId: 'IQT', name: 'Iquitos', lon: -73.25, lat: -3.74, gdpShare: 0.22, resource: 'KERESTE' },
  ],
  // Venezuela (3 Şehir)
  '862': [
    { suffixId: 'CCS', name: 'Karakas', lon: -66.90, lat: 10.48, isCapital: true, gdpShare: 0.44, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MAR', name: 'Maracaibo', lon: -71.61, lat: 10.64, gdpShare: 0.34, resource: 'PETROL' },
    { suffixId: 'CGU', name: 'Ciudad Guayana', lon: -62.71, lat: 8.35, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
  ],
  // Şili (3 Şehir)
  '152': [
    { suffixId: 'SCL', name: 'Santiago', lon: -70.66, lat: -33.44, isCapital: true, gdpShare: 0.48, historicName: 'Mapocho', resource: 'FINANS_MERKEZI' },
    { suffixId: 'ANF', name: 'Antofagasta', lon: -70.39, lat: -23.65, gdpShare: 0.30, resource: 'NADIR_TOPRAK' },
    { suffixId: 'PUQ', name: 'Valdivia', lon: -73.24, lat: -39.81, gdpShare: 0.22, resource: 'KERESTE' },
  ],
  // Bolivya (2 Şehir)
  '068': [
    { suffixId: 'LPB', name: 'La Paz', lon: -68.11, lat: -16.48, isCapital: true, gdpShare: 0.54, historicName: 'Chuquiago', resource: 'ALTIN' },
    { suffixId: 'SRZ', name: 'Santa Cruz', lon: -63.18, lat: -17.78, gdpShare: 0.46, resource: 'DOGALGAZ' },
  ],
  // Ekvador (2 Şehir)
  '218': [
    { suffixId: 'UIO', name: 'Quito', lon: -78.46, lat: -0.18, isCapital: true, gdpShare: 0.52, historicName: 'Quito', resource: 'PETROL' },
    { suffixId: 'GYE', name: 'Guayaquil', lon: -79.88, lat: -2.18, gdpShare: 0.48, resource: 'TICARET_BOGAZI' },
  ],
  // Paraguay (2 Şehir)
  '600': [
    { suffixId: 'ASU', name: 'Asuncion', lon: -57.57, lat: -25.26, isCapital: true, gdpShare: 0.60, resource: 'SIGIR' },
    { suffixId: 'ENC', name: 'Concepcion', lon: -57.43, lat: -23.40, gdpShare: 0.40, resource: 'TAHIL' },
  ],
  // Küba (2 Şehir)
  '192': [
    { suffixId: 'HAV', name: 'Havana', lon: -82.36, lat: 23.11, isCapital: true, gdpShare: 0.58, historicName: 'Habana', resource: 'TICARET_BOGAZI' },
    { suffixId: 'SCU', name: 'Santiago', lon: -75.82, lat: 20.02, gdpShare: 0.42, resource: 'PAMUK' },
  ],
  // Kongo DC (4 Şehir)
  '180': [
    { suffixId: 'FIH', name: 'Kinşasa', lon: 15.26, lat: -4.44, isCapital: true, gdpShare: 0.34, resource: 'KERESTE' },
    { suffixId: 'FBM', name: 'Lubumbashi', lon: 27.47, lat: -11.66, gdpShare: 0.26, resource: 'NADIR_TOPRAK' },
    { suffixId: 'FKI', name: 'Kisangani', lon: 25.19, lat: 0.51, gdpShare: 0.22, resource: 'ALTIN' },
    { suffixId: 'GOM', name: 'Goma', lon: 29.22, lat: -1.65, gdpShare: 0.18, resource: 'DEMIR_CELIK' },
  ],
  // Angola (3 Şehir)
  '024': [
    { suffixId: 'LAD', name: 'Luanda', lon: 13.23, lat: -8.83, isCapital: true, gdpShare: 0.46, resource: 'PETROL' },
    { suffixId: 'NOV', name: 'Huambo', lon: 15.73, lat: -12.77, gdpShare: 0.28, resource: 'TAHIL' },
    { suffixId: 'SDD', name: 'Lubango', lon: 13.49, lat: -14.91, gdpShare: 0.26, resource: 'ALTIN' },
  ],
  // Tanzanya (3 Şehir)
  '834': [
    { suffixId: 'DOD', name: 'Dodoma', lon: 35.75, lat: -6.16, isCapital: true, gdpShare: 0.34, resource: 'TAHIL' },
    { suffixId: 'DAR', name: 'Darüsselam', lon: 39.20, lat: -6.79, gdpShare: 0.40, resource: 'TICARET_BOGAZI' },
    { suffixId: 'MWZ', name: 'Mwanza', lon: 32.90, lat: -2.51, gdpShare: 0.26, resource: 'ALTIN' },
  ],
  // Sudan (3 Şehir)
  '729': [
    { suffixId: 'KRT', name: 'Hartum', lon: 32.55, lat: 15.50, isCapital: true, gdpShare: 0.44, resource: 'PAMUK' },
    { suffixId: 'PZU', name: 'Port Sudan', lon: 37.21, lat: 19.61, gdpShare: 0.30, resource: 'TICARET_BOGAZI' },
    { suffixId: 'ELF', name: 'El Faşir', lon: 25.35, lat: 13.62, gdpShare: 0.26, resource: 'SIGIR' },
  ],
  // Kenya (2 Şehir)
  '404': [
    { suffixId: 'NBO', name: 'Nairobi', lon: 36.82, lat: -1.29, isCapital: true, gdpShare: 0.58, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MBA', name: 'Mombasa', lon: 39.66, lat: -4.04, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // Mali (2 Şehir)
  '466': [
    { suffixId: 'BKO', name: 'Bamako', lon: -8.00, lat: 12.63, isCapital: true, gdpShare: 0.56, resource: 'ALTIN' },
    { suffixId: 'TOM', name: 'Timbuktu', lon: -3.00, lat: 16.76, gdpShare: 0.44, resource: 'TAHIL' },
  ],
  // Çad (2 Şehir)
  '148': [
    { suffixId: 'NDJ', name: 'Encemine', lon: 15.05, lat: 12.13, isCapital: true, gdpShare: 0.58, resource: 'PETROL' },
    { suffixId: 'AEH', name: 'Abeche', lon: 20.83, lat: 13.82, gdpShare: 0.42, resource: 'SIGIR' },
  ],
  // Nijer (2 Şehir)
  '562': [
    { suffixId: 'NIM', name: 'Niamey', lon: 2.12, lat: 13.51, isCapital: true, gdpShare: 0.56, resource: 'TAHIL' },
    { suffixId: 'AJY', name: 'Agadez', lon: 7.99, lat: 16.97, gdpShare: 0.44, resource: 'NADIR_TOPRAK' },
  ],
  // Namibya (2 Şehir)
  '516': [
    { suffixId: 'WDH', name: 'Windhoek', lon: 17.08, lat: -22.56, isCapital: true, gdpShare: 0.58, resource: 'ALTIN' },
    { suffixId: 'WVB', name: 'Walvis Bay', lon: 14.50, lat: -22.95, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // Zambiya (2 Şehir)
  '894': [
    { suffixId: 'LUN', name: 'Lusaka', lon: 28.28, lat: -15.38, isCapital: true, gdpShare: 0.56, resource: 'DEMIR_CELIK' },
    { suffixId: 'NLA', name: 'Ndola', lon: 28.63, lat: -12.95, gdpShare: 0.44, resource: 'NADIR_TOPRAK' },
  ],
  // Zimbabve (2 Şehir)
  '716': [
    { suffixId: 'HRE', name: 'Harare', lon: 31.05, lat: -17.82, isCapital: true, gdpShare: 0.56, resource: 'ALTIN' },
    { suffixId: 'BUQ', name: 'Bulawayo', lon: 28.58, lat: -20.13, gdpShare: 0.44, resource: 'DEMIR_CELIK' },
  ],
  // Madagaskar (2 Şehir)
  '450': [
    { suffixId: 'TNR', name: 'Antananarivo', lon: 47.50, lat: -18.87, isCapital: true, gdpShare: 0.58, resource: 'KERESTE' },
    { suffixId: 'TMM', name: 'Toamasina', lon: 49.40, lat: -18.14, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
  ],
  // Kamerun (2 Şehir)
  '120': [
    { suffixId: 'YAO', name: 'Yaounde', lon: 11.50, lat: 3.84, isCapital: true, gdpShare: 0.52, resource: 'KERESTE' },
    { suffixId: 'DLA', name: 'Douala', lon: 9.70, lat: 4.05, gdpShare: 0.48, resource: 'PETROL' },
  ],
  // Gana (2 Şehir)
  '288': [
    { suffixId: 'ACC', name: 'Akra', lon: -0.18, lat: 5.60, isCapital: true, gdpShare: 0.56, historicName: 'Nkran', resource: 'ALTIN' },
    { suffixId: 'KMS', name: 'Kumasi', lon: -1.62, lat: 6.68, gdpShare: 0.44, resource: 'PAMUK' },
  ],
  // Hollanda (2 Şehir)
  '528': [
    { suffixId: 'AMS', name: 'Amsterdam', lon: 4.90, lat: 52.36, isCapital: true, gdpShare: 0.56, historicName: 'Amstelredamme', resource: 'FINANS_MERKEZI' },
    { suffixId: 'RTM', name: 'Rotterdam', lon: 4.47, lat: 51.92, gdpShare: 0.44, resource: 'TICARET_BOGAZI' },
  ],
  // Belçika (2 Şehir)
  '056': [
    { suffixId: 'BRU', name: 'Brüksel', lon: 4.35, lat: 50.85, isCapital: true, gdpShare: 0.56, resource: 'FINANS_MERKEZI' },
    { suffixId: 'ANR', name: 'Anvers', lon: 4.40, lat: 51.21, gdpShare: 0.44, resource: 'TICARET_BOGAZI' },
  ],
  // İsviçre (2 Şehir)
  '756': [
    { suffixId: 'BRN', name: 'Bern', lon: 7.44, lat: 46.94, isCapital: true, gdpShare: 0.46, resource: 'DEMIR_CELIK' },
    { suffixId: 'ZRH', name: 'Zürih', lon: 8.54, lat: 47.37, gdpShare: 0.54, resource: 'FINANS_MERKEZI' },
  ],
  // Danimarka (2 Şehir)
  '208': [
    { suffixId: 'CPH', name: 'Kopenhag', lon: 12.56, lat: 55.67, isCapital: true, gdpShare: 0.60, resource: 'TICARET_BOGAZI' },
    { suffixId: 'AAR', name: 'Aarhus', lon: 10.20, lat: 56.16, gdpShare: 0.40, resource: 'SIGIR' },
  ],
  // İrlanda (2 Şehir)
  '372': [
    { suffixId: 'DUB', name: 'Dublin', lon: -6.26, lat: 53.34, isCapital: true, gdpShare: 0.60, resource: 'FINANS_MERKEZI' },
    { suffixId: 'ORK', name: 'Cork', lon: -8.47, lat: 51.89, gdpShare: 0.40, resource: 'SIGIR' },
  ],
  // Slovakya (2 Şehir)
  '703': [
    { suffixId: 'BTS', name: 'Bratislava', lon: 17.10, lat: 48.14, isCapital: true, gdpShare: 0.58, resource: 'DEMIR_CELIK' },
    { suffixId: 'KSC', name: 'Kösice', lon: 21.26, lat: 48.71, gdpShare: 0.42, resource: 'TAHIL' },
  ],
  // Kırgızistan (2 Şehir)
  '417': [
    { suffixId: 'FRU', name: 'Bişkek', lon: 74.56, lat: 42.87, isCapital: true, gdpShare: 0.58, resource: 'ALTIN' },
    { suffixId: 'OSS', name: 'Oş', lon: 72.79, lat: 40.51, gdpShare: 0.42, resource: 'SIGIR' },
  ],
  // Tacikistan (2 Şehir)
  '762': [
    { suffixId: 'DYU', name: 'Duşanbe', lon: 68.78, lat: 38.55, isCapital: true, gdpShare: 0.58, resource: 'ALTIN' },
    { suffixId: 'LBD', name: 'Hucend', lon: 69.62, lat: 40.28, gdpShare: 0.42, resource: 'PAMUK' },
  ],
  // Arnavutluk (2 Şehir)
  '008': [
    { suffixId: 'TIA', name: 'Tiran', lon: 19.81, lat: 41.32, isCapital: true, gdpShare: 0.58, resource: 'TAHIL' },
    { suffixId: 'SHK', name: 'İşkodra', lon: 19.51, lat: 42.06, gdpShare: 0.42, resource: 'KERESTE' },
  ],
};

/**
 * Merges curated (original 448 map) seeds with the global district expansion.
 * Existing seeds are never removed or reordered, so legacy province IDs
 * (`countryId`, `countryId_SUFFIX`) remain stable across saves and scenarios.
 */
function mergeProvinceSeeds(
  base: Record<string, ProvinceSubSeed[]>,
  expansion: Record<string, ProvinceSubSeed[]>
): Record<string, ProvinceSubSeed[]> {
  const merged: Record<string, ProvinceSubSeed[]> = {};
  Object.keys(base).forEach((countryId) => {
    merged[countryId] = [...base[countryId]];
  });
  Object.entries(expansion).forEach(([countryId, seeds]) => {
    const existing = merged[countryId] ?? [];
    const usedSuffixes = new Set(existing.map((s) => s.suffixId));
    const usedCandidates = new Set(
      existing.map((s) => `${s.lon.toFixed(2)},${s.lat.toFixed(2)}`)
    );
    seeds.forEach((seed) => {
      // Never duplicate an ID or an exact coordinate (zero-area cell).
      if (usedSuffixes.has(seed.suffixId)) return;
      // A capital seed is only accepted when the country has no curated
      // seed set yet (single-province country being expanded). Existing
      // capital slots always stay owned by the original 448-map seed.
      if (seed.isCapital && existing.length > 0) return;
      if (existing.some((s) => s.isCapital) && seed.isCapital) return;
      const coordKey = `${seed.lon.toFixed(2)},${seed.lat.toFixed(2)}`;
      if (usedCandidates.has(coordKey)) return;
      usedSuffixes.add(seed.suffixId);
      usedCandidates.add(coordKey);
      existing.push(seed);
    });
    merged[countryId] = existing;
  });
  return merged;
}

/** Global seed table: original 448-map seeds + ~440 district/sancak seeds worldwide. */
export const COUNTRY_PROVINCE_SEEDS: Record<string, ProvinceSubSeed[]> =
  mergeProvinceSeeds(CURATED_PROVINCE_SEEDS, DISTRICT_PROVINCE_SEEDS);

/**
 * Normalizes a country's per-province shares so population, GDP and starting
 * army always add up to exactly 1.00 for the country, no matter how many
 * districts were added. Keeps the global power balance intact.
 */
export function getNormalizedProvinceShares(
  seeds: ProvinceSubSeed[]
): number[] {
  if (seeds.length === 0) return [];
  const raw = seeds.map((s) =>
    Number.isFinite(s.gdpShare) && s.gdpShare > 0 ? s.gdpShare : 0
  );
  const total = raw.reduce((sum, v) => sum + v, 0);
  if (total <= 0) {
    return seeds.map(() => 1 / seeds.length);
  }
  return raw.map((v) => v / total);
}

/**
 * Province-ID → period name map used by the 1444 scenario. Only seeds that
 * actually carry a `historicName` are included, so explicit scenario renames
 * (e.g. "★ Edirne") still win over the data-driven period names.
 */
export function getHistoricProvinceNames(
  seedsByCountry: Record<string, ProvinceSubSeed[]> = COUNTRY_PROVINCE_SEEDS
): Record<string, string> {
  const map: Record<string, string> = {};
  Object.entries(seedsByCountry).forEach(([countryId, seeds]) => {
    seeds.forEach((seed) => {
      if (!seed.historicName) return;
      const provinceId = seed.isCapital
        ? countryId
        : `${countryId}_${seed.suffixId}`;
      map[provinceId] = seed.historicName;
    });
  });
  return map;
}

// Unwraps ±180° antimeridian wrap vertices (such as Russia's Chukotka tip at -175° lon or Fiji)
// into continuous coordinates and clips cleanly at ±179.92° so rings never invert and never
// collapse into vertical collinear accordions along the dateline.
function clipAntimeridianRing(ring: Position[]): Position[][] {
  if (ring.length < 4) return [];

  let hasJump = false;
  let eastCount = 0;
  let westCount = 0;

  for (let i = 0; i < ring.length; i++) {
    const lon = ring[i][0];
    if (lon >= 0) eastCount++;
    else westCount++;
    if (i < ring.length - 1 && Math.abs(ring[i][0] - ring[i + 1][0]) > 140) {
      hasJump = true;
    }
  }

  if (!hasJump) return [ring];

  const isMostlyEast = eastCount >= westCount;
  if (isMostlyEast) {
    const unwrapped = ring.map((pt) =>
      pt[0] < -90 ? [pt[0] + 360, pt[1]] : [pt[0], pt[1]]
    );
    return clipRingWithHalfPlaneSplit(unwrapped, 1, 0, 179.92);
  }
  const unwrapped = ring.map((pt) =>
    pt[0] > 90 ? [pt[0] - 360, pt[1]] : [pt[0], pt[1]]
  );
  return clipRingWithHalfPlaneSplit(unwrapped, -1, 0, 179.92);
}

function normalizeSingleRing(rawRing: Position[]): Position[] | null {
  if (rawRing.length < 4) return null;

  // Deduplicate consecutive identical points
  const candidate: Position[] = [];
  for (let i = 0; i < rawRing.length; i++) {
    const pt = rawRing[i];
    const prev = candidate[candidate.length - 1];
    if (
      !prev ||
      Math.abs(pt[0] - prev[0]) > 1e-6 ||
      Math.abs(pt[1] - prev[1]) > 1e-6
    ) {
      candidate.push([pt[0], pt[1]]);
    }
  }

  // Prune raw world-atlas zero-width hairpin spikes (e.g. Sudan border 180° foldbacks)
  let pruned = true;
  while (pruned && candidate.length >= 4) {
    pruned = false;
    const len = candidate.length;
    for (let i = 0; i < len; i++) {
      const prev = candidate[(i - 1 + len) % len];
      const curr = candidate[i];
      const next = candidate[(i + 1) % len];
      const v1x = curr[0] - prev[0];
      const v1y = curr[1] - prev[1];
      const v2x = next[0] - curr[0];
      const v2y = next[1] - curr[1];
      const l1 = Math.hypot(v1x, v1y);
      const l2 = Math.hypot(v2x, v2y);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
      if (dot < -0.996) {
        // Compute perpendicular distance of the shorter leg's endpoint onto the longer leg
        const cross = Math.abs(v1x * v2y - v1y * v2x);
        const perp = cross / Math.max(l1, l2);
        if (perp < 0.04) {
          candidate.splice(i, 1);
          pruned = true;
          break;
        }
      }
    }
  }

  if (candidate.length < 3) return null;

  // Ensure closed ring
  const first = candidate[0];
  const last = candidate[candidate.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    candidate.push([first[0], first[1]]);
  }

  if (candidate.length < 4) return null;

  const testFeature: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [candidate],
    },
  };

  let area = geoArea(testFeature);
  if (!Number.isFinite(area)) return null;

  // A hemisphere is 2*PI (~6.28) steradians. If area > PI, the ring is wound backwards
  // on the sphere, which makes d3-geo fill the entire ocean instead of the land polygon!
  if (area > Math.PI) {
    candidate.reverse();
    testFeature.geometry.coordinates = [candidate];
    area = geoArea(testFeature);
  }

  if (!Number.isFinite(area) || area <= 1e-9 || area > 1.8) {
    return null;
  }

  return candidate;
}

function normalizeSphericalRing(rawRing: Position[]): Position[] | null {
  const split = clipAntimeridianRing(rawRing);
  let best: Position[] | null = null;
  let bestArea = 0;
  for (const r of split) {
    const norm = normalizeSingleRing(r);
    if (!norm) continue;
    const area = geoArea({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [norm] },
    });
    if (area > bestArea) {
      bestArea = area;
      best = norm;
    }
  }
  return best;
}

function normalizeSphericalRings(rawRing: Position[]): Position[][] {
  const out: Position[][] = [];
  for (const r of clipAntimeridianRing(rawRing)) {
    const norm = normalizeSingleRing(r);
    if (norm) out.push(norm);
  }
  return out;
}

// Sanitize any Polygon or MultiPolygon so no ring can ever invert to fill the ocean
export function sanitizeGeoGeometry(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    const outers = geometry.coordinates[0]
      ? normalizeSphericalRings(geometry.coordinates[0])
      : [];
    if (outers.length === 1) {
      return { type: 'Polygon', coordinates: [outers[0]] };
    }
    if (outers.length > 1) {
      return { type: 'MultiPolygon', coordinates: outers.map((r) => [r]) };
    }
    return geometry;
  }

  if (geometry.type === 'MultiPolygon') {
    const validPolygons: Position[][][] = [];
    geometry.coordinates.forEach((poly) => {
      if (!poly[0]) return;
      for (const outer of normalizeSphericalRings(poly[0])) {
        validPolygons.push([outer]);
      }
    });
    if (validPolygons.length === 1) {
      return { type: 'Polygon', coordinates: validPolygons[0] };
    }
    if (validPolygons.length > 1) {
      return { type: 'MultiPolygon', coordinates: validPolygons };
    }
  }

  return geometry;
}

// Deduplicate consecutive coincident vertices on a ring
function dedupeRingPoints(pts: Position[]): Position[] {
  const clean: Position[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = clean[clean.length - 1];
    if (
      !prev ||
      Math.abs(p[0] - prev[0]) > 1e-9 ||
      Math.abs(p[1] - prev[1]) > 1e-9
    ) {
      clean.push(p);
    }
  }
  if (
    clean.length > 1 &&
    Math.abs(clean[0][0] - clean[clean.length - 1][0]) <= 1e-9 &&
    Math.abs(clean[0][1] - clean[clean.length - 1][1]) <= 1e-9
  ) {
    clean.pop();
  }
  return clean;
}

// Exact Concave Half-Plane Splitting for a closed GeoJSON ring:
// Keeps regions where a * lon + b * lat <= c, splitting into disjoint closed
// rings whenever the plane cuts across a bay, gulf, or concave boundary
// instead of leaving zero-width collinear bridge edges.
function clipRingWithHalfPlaneSplit(
  ring: Position[],
  a: number,
  b: number,
  c: number
): Position[][] {
  if (ring.length < 3) return [];
  const pts =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  const n = pts.length;
  if (n < 3) return [];

  // Symbolic tie-breaker when a vertex sits exactly on a*x + b*y = c so adjacent
  // Voronoi cells stay watertight without zero-length crossings.
  const tieVal = a > 0 || (a === 0 && b >= 0) ? -1e-11 : 1e-11;
  const vals = new Float64Array(n);
  const inV = new Uint8Array(n);
  let insideCount = 0;

  for (let i = 0; i < n; i++) {
    let v = a * pts[i][0] + b * pts[i][1] - c;
    if (v === 0) v = tieVal;
    vals[i] = v;
    if (v < 0) {
      inV[i] = 1;
      insideCount++;
    }
  }

  if (insideCount === n) return [ring];
  if (insideCount === 0) return [];

  // Start on an ENTRY edge (outside -> inside) so every inside arc is closed cleanly
  let startEdge = -1;
  for (let i = 0; i < n; i++) {
    if (!inV[i] && inV[(i + 1) % n]) {
      startEdge = i;
      break;
    }
  }
  if (startEdge === -1) return [];

  interface InsideArc {
    entryPt: Position;
    pts: Position[];
    exitPt: Position;
  }
  const arcs: InsideArc[] = [];
  let current: InsideArc | null = null;

  for (let k = 0; k < n; k++) {
    const i = (startEdge + k) % n;
    const j = (i + 1) % n;
    const P = pts[i];
    const Q = pts[j];
    const pIn = inV[i] === 1;
    const qIn = inV[j] === 1;

    if (!pIn && qIn) {
      const denom = vals[j] - vals[i];
      const t =
        Math.abs(denom) > 1e-18
          ? Math.max(0, Math.min(1, -vals[i] / denom))
          : 0.5;
      const entryPt: Position = [
        P[0] + (Q[0] - P[0]) * t,
        P[1] + (Q[1] - P[1]) * t,
      ];
      current = { entryPt, pts: [Q], exitPt: entryPt };
    } else if (pIn && qIn) {
      current!.pts.push(Q);
    } else if (pIn && !qIn) {
      const denom = vals[j] - vals[i];
      const t =
        Math.abs(denom) > 1e-18
          ? Math.max(0, Math.min(1, -vals[i] / denom))
          : 0.5;
      const exitPt: Position = [
        P[0] + (Q[0] - P[0]) * t,
        P[1] + (Q[1] - P[1]) * t,
      ];
      current!.exitPt = exitPt;
      arcs.push(current!);
      current = null;
    }
  }

  const m = arcs.length;
  if (m === 0) return [];

  if (m === 1) {
    const clean = dedupeRingPoints([
      arcs[0].entryPt,
      ...arcs[0].pts,
      arcs[0].exitPt,
    ]);
    if (clean.length < 3) return [];
    clean.push([clean[0][0], clean[0][1]]);
    return [clean];
  }

  interface CrossingNode {
    kind: 'entry' | 'exit';
    arcIdx: number;
    s: number;
  }
  const nodes: CrossingNode[] = [];
  for (let idx = 0; idx < m; idx++) {
    const ep = arcs[idx].entryPt;
    const xp = arcs[idx].exitPt;
    nodes.push({ kind: 'entry', arcIdx: idx, s: -b * ep[0] + a * ep[1] });
    nodes.push({ kind: 'exit', arcIdx: idx, s: -b * xp[0] + a * xp[1] });
  }
  nodes.sort((u, v) => u.s - v.s);

  const nextArc = new Int32Array(m).fill(-1);
  let pairsClean = true;
  for (let k = 0; k < m; k++) {
    const u = nodes[2 * k];
    const v = nodes[2 * k + 1];
    if (u.kind === 'exit' && v.kind === 'entry') {
      nextArc[u.arcIdx] = v.arcIdx;
    } else if (u.kind === 'entry' && v.kind === 'exit') {
      nextArc[v.arcIdx] = u.arcIdx;
    } else {
      pairsClean = false;
      break;
    }
  }

  // Fallback for rare self-intersecting raw world-atlas rings
  if (!pairsClean) {
    nextArc.fill(-1);
    const usedEntry = new Uint8Array(m);
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].kind !== 'exit') continue;
      let bestEntryIdx = -1;
      let bestDist = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        if (nodes[j].kind !== 'entry' || usedEntry[nodes[j].arcIdx]) continue;
        const d = Math.abs(nodes[j].s - nodes[i].s);
        if (d < bestDist) {
          bestDist = d;
          bestEntryIdx = nodes[j].arcIdx;
        }
      }
      if (bestEntryIdx !== -1) {
        nextArc[nodes[i].arcIdx] = bestEntryIdx;
        usedEntry[bestEntryIdx] = 1;
      }
    }
  }

  const visited = new Uint8Array(m);
  const resultRings: Position[][] = [];

  for (let start = 0; start < m; start++) {
    if (visited[start]) continue;
    const combined: Position[] = [];
    let cur = start;
    let guard = 0;
    while (cur !== -1 && !visited[cur] && guard < m + 1) {
      visited[cur] = 1;
      combined.push(arcs[cur].entryPt, ...arcs[cur].pts, arcs[cur].exitPt);
      cur = nextArc[cur];
      guard++;
    }
    const clean = dedupeRingPoints(combined);
    if (clean.length >= 3) {
      clean.push([clean[0][0], clean[0][1]]);
      resultRings.push(clean);
    }
  }

  return resultRings;
}

function extractOuterRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] ? [geometry.coordinates[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((poly) => poly[0])
      .filter((ring): ring is Position[] => Boolean(ring));
  }
  return [];
}

function pointInRing(lon: number, lat: number, ring: Position[]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
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

interface NearestRingPoint {
  lon: number;
  lat: number;
  dist: number;
  ring: Position[];
  nx: number;
  ny: number;
}

function nearestPointOnRings(
  lon: number,
  lat: number,
  rings: Position[][]
): NearestRingPoint | null {
  let best: NearestRingPoint | null = null;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const ax = ring[i][0];
      const ay = ring[i][1];
      const bx = ring[(i + 1) % n][0];
      const by = ring[(i + 1) % n][1];
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 1e-12) {
        t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / lenSq));
      }
      const px = ax + dx * t;
      const py = ay + dy * t;
      const dist = Math.hypot(px - lon, py - lat);
      if (!best || dist < best.dist) {
        const edgeLen = Math.sqrt(lenSq) || 1;
        best = { lon: px, lat: py, dist, ring, nx: -dy / edgeLen, ny: dx / edgeLen };
      }
    }
  }
  return best;
}

/**
 * Locks every seed to the country's main landmass before Voronoi clipping:
 * seeds already inside a polygon ring are untouched; stray seeds are snapped to
 * the nearest coastline/ring vertex and nudged inland so no province can be
 * empty and no label can drift into the ocean.
 */
export function snapSeedsIntoGeometry(
  geometry: Geometry,
  seeds: ProvinceSubSeed[]
): ProvinceSubSeed[] {
  const rings = extractOuterRings(geometry);
  if (rings.length === 0 || seeds.length <= 1) return seeds;

  const usedCoords = new Set<string>();
  return seeds.map((seed) => {
    let lon = seed.lon;
    let lat = seed.lat;
    const inside = rings.some((ring) => pointInRing(lon, lat, ring));
    if (!inside) {
      const nearest = nearestPointOnRings(lon, lat, rings);
      if (nearest) {
        const centerLon =
          nearest.ring.reduce((sum, p) => sum + p[0], 0) / nearest.ring.length;
        const centerLat =
          nearest.ring.reduce((sum, p) => sum + p[1], 0) / nearest.ring.length;
        const cDx = centerLon - nearest.lon;
        const cDy = centerLat - nearest.lat;
        const cLen = Math.hypot(cDx, cDy) || 1;

        const dirs: [number, number][] = [
          [nearest.nx, nearest.ny],
          [-nearest.nx, -nearest.ny],
          [cDx / cLen, cDy / cLen],
        ];
        let placed = false;
        for (const step of [0.12, 0.04, 0.25]) {
          for (const [ux, uy] of dirs) {
            const candLon = nearest.lon + ux * step;
            const candLat = nearest.lat + uy * step;
            if (pointInRing(candLon, candLat, nearest.ring)) {
              lon = candLon;
              lat = candLat;
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (!placed) {
          lon = nearest.lon + (cDx / cLen) * 0.12;
          lat = nearest.lat + (cDy / cLen) * 0.12;
        }
      }
    }

    let key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
    let guard = 0;
    while (usedCoords.has(key) && guard < 12) {
      lon += 0.09;
      lat += 0.05;
      key = `${lon.toFixed(3)},${lat.toFixed(3)}`;
      guard++;
    }
    usedCoords.add(key);

    if (lon === seed.lon && lat === seed.lat) return seed;
    return { ...seed, lon, lat };
  });
}

function clipRingWithBox(
  ring: Position[],
  lon: number,
  lat: number,
  radius: number
): Position[][] {
  let current = [ring];
  const planes: [number, number, number][] = [
    [-1, 0, -(lon - radius)], // x >= lon - radius
    [1, 0, lon + radius], // x <= lon + radius
    [0, -1, -(lat - radius)], // y >= lat - radius
    [0, 1, lat + radius], // y <= lat + radius
  ];
  for (const [a, b, c] of planes) {
    const next: Position[][] = [];
    for (const r of current) {
      next.push(...clipRingWithHalfPlaneSplit(r, a, b, c));
    }
    current = next;
    if (current.length === 0) return [];
  }
  return current;
}

/** Fallback cell for a pathological seed so no district ever disappears. */
function buildFallbackCell(
  outerRings: Position[][],
  seed: ProvinceSubSeed
): Geometry | null {
  for (const radius of [0.75, 1.5, 3]) {
    const rings: Position[][] = [];
    outerRings.forEach((ring) => {
      const clippedList = clipRingWithBox(ring, seed.lon, seed.lat, radius);
      for (const clipped of clippedList) {
        const normalized = clipped.length >= 4 ? normalizeSphericalRing(clipped) : null;
        if (normalized) rings.push(normalized);
      }
    });
    if (rings.length === 1) {
      return { type: 'Polygon', coordinates: [rings[0]] };
    }
    if (rings.length > 1) {
      return {
        type: 'MultiPolygon',
        coordinates: rings.map((r) => [r]),
      };
    }
  }
  return null;
}

export function subdivideCountryGeometry(
  geometry: Geometry,
  seeds: ProvinceSubSeed[]
): { seed: ProvinceSubSeed; geometry: Geometry }[] {
  const safeBaseGeometry = sanitizeGeoGeometry(geometry);

  // Extract outer polygon rings from Polygon or MultiPolygon
  const outerRings: Position[][] = [];
  if (safeBaseGeometry.type === 'Polygon') {
    if (safeBaseGeometry.coordinates[0]) {
      outerRings.push(safeBaseGeometry.coordinates[0]);
    }
  } else if (safeBaseGeometry.type === 'MultiPolygon') {
    safeBaseGeometry.coordinates.forEach((poly) => {
      if (poly[0]) outerRings.push(poly[0]);
    });
  }

  // Lock every seed onto the country's main landmass (centroid/mainland snap)
  // so no district can be empty and no label can end up in the ocean.
  const snappedSeeds = snapSeedsIntoGeometry(safeBaseGeometry, seeds);

  // Filter out tiny opposite-hemisphere island rings when subdividing (e.g., Russia's -175° Wrangel Island when main continent is clamped to +19°..+179.92°)
  const avgSeedLon =
    snappedSeeds.reduce((acc, s) => acc + s.lon, 0) /
    Math.max(1, snappedSeeds.length);
  const filteredOuterRings = outerRings.filter((ring) => {
    const sampleLon = ring[0]?.[0] ?? 0;
    return Math.abs(sampleLon - avgSeedLon) < 155;
  });

  const activeOuterRings =
    filteredOuterRings.length > 0 ? filteredOuterRings : outerRings;

  if (activeOuterRings.length === 0 || snappedSeeds.length <= 1) {
    return snappedSeeds.map((s) => ({ seed: s, geometry: safeBaseGeometry }));
  }

  return snappedSeeds.map((seedI, i) => {
    let currentRings = activeOuterRings.map((r) => [...r]);

    snappedSeeds.forEach((seedJ, j) => {
      if (i === j) return;
      const a = 2 * (seedJ.lon - seedI.lon);
      const b = 2 * (seedJ.lat - seedI.lat);
      const c =
        seedJ.lon * seedJ.lon +
        seedJ.lat * seedJ.lat -
        (seedI.lon * seedI.lon + seedI.lat * seedI.lat);

      const nextRings: Position[][] = [];
      currentRings.forEach((ring) => {
        const clippedList = clipRingWithHalfPlaneSplit(ring, a, b, c);
        for (const clipped of clippedList) {
          if (clipped.length >= 4) {
            nextRings.push(clipped);
          }
        }
      });
      currentRings = nextRings;
    });

    // Normalize spherical winding order on every clipped ring so d3-geo never inverts the polygon to fill the ocean
    const normalizedRings = currentRings
      .map((r) => normalizeSphericalRing(r))
      .filter((r): r is Position[] => Boolean(r));

    const clippedGeom: Geometry =
      normalizedRings.length === 1
        ? { type: 'Polygon', coordinates: [normalizedRings[0]] }
        : {
            type: 'MultiPolygon',
            coordinates: normalizedRings.map((r) => [r]),
          };

    const fallbackGeom =
      normalizedRings.length > 0
        ? clippedGeom
        : buildFallbackCell(activeOuterRings, seedI) ?? safeBaseGeometry;

    return {
      seed: seedI,
      geometry: fallbackGeom,
    };
  });
}
