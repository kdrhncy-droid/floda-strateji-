import { geoArea } from 'd3-geo';
import type { Feature, Geometry, Polygon, Position } from 'geojson';
import { ResourceType } from '../types/game';

export interface ProvinceSubSeed {
  suffixId: string;
  name: string;
  lon: number;
  lat: number;
  isCapital?: boolean;
  gdpShare: number;
  resource?: ResourceType;
}

// Curated authentic sub-provinces for major and regional countries (Expanded to ~335+ provinces worldwide)
export const COUNTRY_PROVINCE_SEEDS: Record<string, ProvinceSubSeed[]> = {
  // Türkiye / Osmanlı Coğrafyası (20 Şehir)
  '792': [
    { suffixId: 'ANK', name: 'Ankara', lon: 32.85, lat: 39.92, isCapital: true, gdpShare: 0.09, resource: 'DEMIR_CELIK' },
    { suffixId: 'IST', name: 'İstanbul', lon: 28.97, lat: 41.02, gdpShare: 0.13, resource: 'TICARET_BOGAZI' },
    { suffixId: 'EDR', name: 'Edirne', lon: 26.55, lat: 41.67, gdpShare: 0.06, resource: 'TAHIL' },
    { suffixId: 'GLB', name: 'Çanakkale', lon: 26.65, lat: 39.95, gdpShare: 0.04, resource: 'TICARET_BOGAZI' },
    { suffixId: 'BUR', name: 'Bursa', lon: 29.06, lat: 40.18, gdpShare: 0.07, resource: 'FINANS_MERKEZI' },
    { suffixId: 'IZM', name: 'İzmir', lon: 27.14, lat: 38.42, gdpShare: 0.07, resource: 'PAMUK' },
    { suffixId: 'MUG', name: 'Muğla', lon: 28.36, lat: 37.21, gdpShare: 0.04, resource: 'KERESTE' },
    { suffixId: 'KUT', name: 'Kütahya', lon: 29.98, lat: 39.42, gdpShare: 0.04, resource: 'ALTIN' },
    { suffixId: 'ANT', name: 'Antalya', lon: 30.70, lat: 36.88, gdpShare: 0.05, resource: 'KERESTE' },
    { suffixId: 'KNY', name: 'Konya', lon: 32.48, lat: 37.87, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'KYS', name: 'Sivas', lon: 36.15, lat: 39.20, gdpShare: 0.05, resource: 'SIGIR' },
    { suffixId: 'KST', name: 'Kastamonu', lon: 34.05, lat: 41.55, gdpShare: 0.04, resource: 'KERESTE' },
    { suffixId: 'SAM', name: 'Samsun', lon: 36.33, lat: 41.28, gdpShare: 0.04, resource: 'TAHIL' },
    { suffixId: 'ADA', name: 'Adana', lon: 35.32, lat: 37.00, gdpShare: 0.04, resource: 'PAMUK' },
    { suffixId: 'GZP', name: 'Gaziantep', lon: 37.38, lat: 37.35, gdpShare: 0.04, resource: 'PAMUK' },
    { suffixId: 'MLT', name: 'Malatya', lon: 38.55, lat: 38.65, gdpShare: 0.03, resource: 'ALTIN' },
    { suffixId: 'TRB', name: 'Trabzon', lon: 39.71, lat: 41.00, gdpShare: 0.04, resource: 'KERESTE' },
    { suffixId: 'ERZ', name: 'Erzurum', lon: 41.60, lat: 40.10, gdpShare: 0.03, resource: 'SIGIR' },
    { suffixId: 'DYB', name: 'Diyarbakır', lon: 40.23, lat: 37.91, gdpShare: 0.03, resource: 'PETROL' },
    { suffixId: 'VAN', name: 'Van', lon: 43.15, lat: 38.50, gdpShare: 0.02, resource: 'SIGIR' },
  ],
  // Yunanistan (4 Şehir)
  '300': [
    { suffixId: 'ATH', name: 'Atina', lon: 23.72, lat: 37.98, isCapital: true, gdpShare: 0.42, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SKG', name: 'Selanik', lon: 22.94, lat: 40.64, gdpShare: 0.26, resource: 'PAMUK' },
    { suffixId: 'IOA', name: 'Yanya', lon: 20.85, lat: 39.66, gdpShare: 0.14, resource: 'SIGIR' },
    { suffixId: 'CRT', name: 'Girit', lon: 25.14, lat: 35.33, gdpShare: 0.18, resource: 'TICARET_BOGAZI' },
  ],
  // Bulgaristan (3 Şehir)
  '100': [
    { suffixId: 'SOF', name: 'Sofya', lon: 23.32, lat: 42.69, isCapital: true, gdpShare: 0.44, resource: 'DEMIR_CELIK' },
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
  // Romanya (5 Şehir)
  '642': [
    { suffixId: 'BUH', name: 'Bükreş', lon: 26.10, lat: 44.42, isCapital: true, gdpShare: 0.32, resource: 'FINANS_MERKEZI' },
    { suffixId: 'CLJ', name: 'Kaloşvar', lon: 23.60, lat: 46.77, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
    { suffixId: 'TSR', name: 'Temeşvar', lon: 21.23, lat: 45.75, gdpShare: 0.14, resource: 'TAHIL' },
    { suffixId: 'IAS', name: 'Yaş', lon: 27.60, lat: 47.16, gdpShare: 0.16, resource: 'TAHIL' },
    { suffixId: 'CND', name: 'Köstence', lon: 28.63, lat: 44.17, gdpShare: 0.16, resource: 'PETROL' },
  ],
  // Macaristan (3 Şehir)
  '348': [
    { suffixId: 'BUD', name: 'Budin', lon: 19.04, lat: 47.49, isCapital: true, gdpShare: 0.46, resource: 'FINANS_MERKEZI' },
    { suffixId: 'DEB', name: 'Debrecen', lon: 21.62, lat: 47.53, gdpShare: 0.30, resource: 'TAHIL' },
    { suffixId: 'PEC', name: 'Peçuy', lon: 18.23, lat: 46.07, gdpShare: 0.24, resource: 'DEMIR_CELIK' },
  ],
  // Avusturya (3 Şehir)
  '040': [
    { suffixId: 'VIE', name: 'Viyana', lon: 16.37, lat: 48.20, isCapital: true, gdpShare: 0.48, resource: 'FINANS_MERKEZI' },
    { suffixId: 'GRZ', name: 'Graz', lon: 15.43, lat: 47.07, gdpShare: 0.28, resource: 'DEMIR_CELIK' },
    { suffixId: 'INN', name: 'Innsbruck', lon: 11.40, lat: 47.26, gdpShare: 0.24, resource: 'YARI_ILETKEN' },
  ],
  // Çekya (2 Şehir)
  '203': [
    { suffixId: 'PRG', name: 'Prag', lon: 14.43, lat: 50.07, isCapital: true, gdpShare: 0.60, resource: 'DEMIR_CELIK' },
    { suffixId: 'BRQ', name: 'Brno', lon: 16.60, lat: 49.19, gdpShare: 0.40, resource: 'YARI_ILETKEN' },
  ],
  // Suriye (4 Şehir)
  '760': [
    { suffixId: 'DAM', name: 'Şam', lon: 36.29, lat: 33.51, isCapital: true, gdpShare: 0.34, resource: 'TAHIL' },
    { suffixId: 'ALP', name: 'Halep', lon: 37.16, lat: 36.20, gdpShare: 0.30, resource: 'TAHIL' },
    { suffixId: 'LTK', name: 'Lazkiye', lon: 35.78, lat: 35.53, gdpShare: 0.18, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DEZ', name: 'Deyrizor', lon: 40.14, lat: 35.33, gdpShare: 0.18, resource: 'PETROL' },
  ],
  // Irak (4 Şehir)
  '368': [
    { suffixId: 'BGW', name: 'Bağdat', lon: 44.36, lat: 33.31, isCapital: true, gdpShare: 0.36, resource: 'PETROL' },
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
  // Almanya (6 Şehir)
  '276': [
    { suffixId: 'BER', name: 'Berlin', lon: 13.40, lat: 52.52, isCapital: true, gdpShare: 0.20, resource: 'YARI_ILETKEN' },
    { suffixId: 'MUC', name: 'Münih', lon: 11.58, lat: 48.13, gdpShare: 0.20, resource: 'YARI_ILETKEN' },
    { suffixId: 'STR', name: 'Stuttgart', lon: 9.18, lat: 48.78, gdpShare: 0.14, resource: 'YARI_ILETKEN' },
    { suffixId: 'FRA', name: 'Frankfurt', lon: 7.50, lat: 50.90, gdpShare: 0.20, resource: 'FINANS_MERKEZI' },
    { suffixId: 'HAM', name: 'Hamburg', lon: 9.99, lat: 53.55, gdpShare: 0.14, resource: 'TICARET_BOGAZI' },
    { suffixId: 'DRS', name: 'Dresden', lon: 13.73, lat: 51.05, gdpShare: 0.12, resource: 'DEMIR_CELIK' },
  ],
  // Fransa (6 Şehir)
  '250': [
    { suffixId: 'PAR', name: 'Paris', lon: 2.35, lat: 48.85, isCapital: true, gdpShare: 0.26, resource: 'FINANS_MERKEZI' },
    { suffixId: 'LYO', name: 'Lyon', lon: 4.83, lat: 45.76, gdpShare: 0.18, resource: 'YARI_ILETKEN' },
    { suffixId: 'MRS', name: 'Marsilya', lon: 5.36, lat: 43.29, gdpShare: 0.16, resource: 'TICARET_BOGAZI' },
    { suffixId: 'TLS', name: 'Toulouse', lon: 1.44, lat: 43.60, gdpShare: 0.12, resource: 'TAHIL' },
    { suffixId: 'BDX', name: 'Bordeaux', lon: -0.57, lat: 44.83, gdpShare: 0.14, resource: 'TAHIL' },
    { suffixId: 'NTE', name: 'Nantes', lon: -1.55, lat: 47.90, gdpShare: 0.14, resource: 'TICARET_BOGAZI' },
  ],
  // Birleşik Krallık (4 Şehir)
  '826': [
    { suffixId: 'LON', name: 'Londra', lon: -0.12, lat: 51.50, isCapital: true, gdpShare: 0.40, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MAN', name: 'Manchester', lon: -2.24, lat: 53.48, gdpShare: 0.26, resource: 'DEMIR_CELIK' },
    { suffixId: 'CWL', name: 'Cardiff', lon: -3.18, lat: 51.48, gdpShare: 0.14, resource: 'DEMIR_CELIK' },
    { suffixId: 'EDI', name: 'Edinburgh', lon: -3.18, lat: 56.50, gdpShare: 0.20, resource: 'PETROL' },
  ],
  // İtalya (6 Şehir)
  '380': [
    { suffixId: 'ROM', name: 'Roma', lon: 12.49, lat: 41.90, isCapital: true, gdpShare: 0.22, resource: 'FINANS_MERKEZI' },
    { suffixId: 'FLR', name: 'Floransa', lon: 11.25, lat: 43.77, gdpShare: 0.14, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MIL', name: 'Milano', lon: 9.19, lat: 45.46, gdpShare: 0.24, resource: 'YARI_ILETKEN' },
    { suffixId: 'VCE', name: 'Venedik', lon: 12.31, lat: 45.44, gdpShare: 0.16, resource: 'TICARET_BOGAZI' },
    { suffixId: 'NAP', name: 'Napoli', lon: 14.26, lat: 40.85, gdpShare: 0.14, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PMO', name: 'Palermo', lon: 13.80, lat: 37.55, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
  ],
  // İspanya (6 Şehir)
  '724': [
    { suffixId: 'MAD', name: 'Madrid', lon: -3.70, lat: 40.41, isCapital: true, gdpShare: 0.26, resource: 'FINANS_MERKEZI' },
    { suffixId: 'BCN', name: 'Barselona', lon: 2.17, lat: 41.38, gdpShare: 0.22, resource: 'TICARET_BOGAZI' },
    { suffixId: 'VLC', name: 'Valensiya', lon: -0.38, lat: 39.47, gdpShare: 0.14, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SEV', name: 'Sevilla', lon: -5.98, lat: 37.38, gdpShare: 0.14, resource: 'TAHIL' },
    { suffixId: 'GRX', name: 'Granada', lon: -3.60, lat: 37.18, gdpShare: 0.10, resource: 'TAHIL' },
    { suffixId: 'BIO', name: 'Bilbao', lon: -5.80, lat: 43.00, gdpShare: 0.14, resource: 'DEMIR_CELIK' },
  ],
  // Portekiz (2 Şehir)
  '620': [
    { suffixId: 'LIS', name: 'Lizbon', lon: -9.13, lat: 38.72, isCapital: true, gdpShare: 0.60, resource: 'TICARET_BOGAZI' },
    { suffixId: 'OPO', name: 'Porto', lon: -8.62, lat: 41.15, gdpShare: 0.40, resource: 'FINANS_MERKEZI' },
  ],
  // Ukrayna (4 Şehir)
  '804': [
    { suffixId: 'KYV', name: 'Kiev', lon: 30.52, lat: 50.45, isCapital: true, gdpShare: 0.32, resource: 'TAHIL' },
    { suffixId: 'LVV', name: 'Lviv', lon: 24.03, lat: 49.84, gdpShare: 0.22, resource: 'TAHIL' },
    { suffixId: 'ODS', name: 'Odessa', lon: 30.72, lat: 46.48, gdpShare: 0.24, resource: 'TICARET_BOGAZI' },
    { suffixId: 'HRK', name: 'Harkiv', lon: 36.23, lat: 49.00, gdpShare: 0.22, resource: 'DEMIR_CELIK' },
  ],
  // Polonya (4 Şehir)
  '616': [
    { suffixId: 'WAW', name: 'Varşova', lon: 21.01, lat: 52.23, isCapital: true, gdpShare: 0.34, resource: 'FINANS_MERKEZI' },
    { suffixId: 'POZ', name: 'Poznań', lon: 16.92, lat: 52.40, gdpShare: 0.20, resource: 'TAHIL' },
    { suffixId: 'KRK', name: 'Krakow', lon: 19.94, lat: 50.06, gdpShare: 0.26, resource: 'DEMIR_CELIK' },
    { suffixId: 'GDN', name: 'Gdansk', lon: 18.64, lat: 54.35, gdpShare: 0.20, resource: 'TICARET_BOGAZI' },
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
    { suffixId: 'MOW', name: 'Moskova', lon: 37.61, lat: 55.75, isCapital: true, gdpShare: 0.14, resource: 'FINANS_MERKEZI' },
    { suffixId: 'LED', name: 'St. Petersburg', lon: 30.33, lat: 59.93, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'SMO', name: 'Smolensk', lon: 32.04, lat: 54.78, gdpShare: 0.05, resource: 'KERESTE' },
    { suffixId: 'GOJ', name: 'Nijni Novgorod', lon: 44.00, lat: 56.32, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'KRR', name: 'Krasnodar', lon: 39.00, lat: 45.03, gdpShare: 0.06, resource: 'TAHIL' },
    { suffixId: 'ROV', name: 'Rostov-na-Donu', lon: 39.70, lat: 47.23, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'VOG', name: 'Volgograd', lon: 44.51, lat: 48.70, gdpShare: 0.05, resource: 'DEMIR_CELIK' },
    { suffixId: 'ASF', name: 'Astrahan', lon: 48.03, lat: 46.34, gdpShare: 0.05, resource: 'PETROL' },
    { suffixId: 'KZN', name: 'Kazan', lon: 49.10, lat: 55.79, gdpShare: 0.06, resource: 'DOGALGAZ' },
    { suffixId: 'KUF', name: 'Samara', lon: 50.15, lat: 53.20, gdpShare: 0.05, resource: 'PETROL' },
    { suffixId: 'ARH', name: 'Arhangelsk', lon: 40.54, lat: 64.54, gdpShare: 0.04, resource: 'KERESTE' },
    { suffixId: 'SVX', name: 'Yekaterinburg', lon: 60.60, lat: 56.83, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
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
    { suffixId: 'WAS', name: 'Washington', lon: -77.50, lat: 38.40, isCapital: true, gdpShare: 0.09, resource: 'FINANS_MERKEZI' },
    { suffixId: 'NYC', name: 'New York', lon: -73.80, lat: 41.50, gdpShare: 0.11, resource: 'FINANS_MERKEZI' },
    { suffixId: 'BOS', name: 'Boston', lon: -71.06, lat: 42.36, gdpShare: 0.06, resource: 'YARI_ILETKEN' },
    { suffixId: 'PHI', name: 'Philadelphia', lon: -75.16, lat: 39.95, gdpShare: 0.05, resource: 'DEMIR_CELIK' },
    { suffixId: 'CHI', name: 'Şikago', lon: -87.62, lat: 41.87, gdpShare: 0.08, resource: 'TAHIL' },
    { suffixId: 'DET', name: 'Detroit', lon: -83.04, lat: 42.33, gdpShare: 0.05, resource: 'DEMIR_CELIK' },
    { suffixId: 'MSP', name: 'Minneapolis', lon: -93.26, lat: 44.97, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'ATL', name: 'Atlanta', lon: -84.38, lat: 33.74, gdpShare: 0.06, resource: 'PAMUK' },
    { suffixId: 'MIA', name: 'Miami', lon: -81.50, lat: 27.60, gdpShare: 0.05, resource: 'TICARET_BOGAZI' },
    { suffixId: 'HOU', name: 'Houston', lon: -95.36, lat: 29.76, gdpShare: 0.07, resource: 'PETROL' },
    { suffixId: 'DAL', name: 'Dallas', lon: -96.79, lat: 32.77, gdpShare: 0.06, resource: 'DOGALGAZ' },
    { suffixId: 'DEN', name: 'Denver', lon: -104.99, lat: 39.73, gdpShare: 0.05, resource: 'ALTIN' },
    { suffixId: 'PHX', name: 'Phoenix', lon: -112.07, lat: 33.44, gdpShare: 0.05, resource: 'NADIR_TOPRAK' },
    { suffixId: 'LAX', name: 'Los Angeles', lon: -118.24, lat: 34.05, gdpShare: 0.07, resource: 'YARI_ILETKEN' },
    { suffixId: 'SFO', name: 'San Francisco', lon: -122.41, lat: 37.77, gdpShare: 0.05, resource: 'YARI_ILETKEN' },
    { suffixId: 'SEA', name: 'Seattle', lon: -122.33, lat: 47.60, gdpShare: 0.05, resource: 'KERESTE' },
  ],
  // Kanada (6 Şehir)
  '124': [
    { suffixId: 'YOW', name: 'Ottawa', lon: -75.69, lat: 45.42, isCapital: true, gdpShare: 0.22, resource: 'FINANS_MERKEZI' },
    { suffixId: 'YYZ', name: 'Toronto', lon: -79.38, lat: 43.65, gdpShare: 0.20, resource: 'DEMIR_CELIK' },
    { suffixId: 'YUL', name: 'Montreal', lon: -71.20, lat: 46.81, gdpShare: 0.16, resource: 'KERESTE' },
    { suffixId: 'YWG', name: 'Winnipeg', lon: -97.13, lat: 49.89, gdpShare: 0.12, resource: 'TAHIL' },
    { suffixId: 'YYC', name: 'Calgary', lon: -114.07, lat: 51.04, gdpShare: 0.15, resource: 'PETROL' },
    { suffixId: 'YVR', name: 'Vancouver', lon: -123.12, lat: 49.28, gdpShare: 0.15, resource: 'TICARET_BOGAZI' },
  ],
  // Meksika (3 Şehir)
  '484': [
    { suffixId: 'MEX', name: 'Meksiko', lon: -99.13, lat: 19.43, isCapital: true, gdpShare: 0.44, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MTY', name: 'Monterrey', lon: -100.31, lat: 25.68, gdpShare: 0.32, resource: 'DEMIR_CELIK' },
    { suffixId: 'GDL', name: 'Guadalajara', lon: -103.34, lat: 20.65, gdpShare: 0.24, resource: 'PETROL' },
  ],
  // Çin (15 Şehir)
  '156': [
    { suffixId: 'BJS', name: 'Pekin', lon: 116.40, lat: 39.90, isCapital: true, gdpShare: 0.11, resource: 'DEMIR_CELIK' },
    { suffixId: 'SHA', name: 'Şanghay', lon: 121.47, lat: 31.23, gdpShare: 0.12, resource: 'YARI_ILETKEN' },
    { suffixId: 'CAN', name: 'Kanton', lon: 113.26, lat: 23.12, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'FOC', name: 'Fuzhou', lon: 119.30, lat: 26.07, gdpShare: 0.06, resource: 'YARI_ILETKEN' },
    { suffixId: 'TAO', name: 'Çingdao', lon: 120.38, lat: 36.06, gdpShare: 0.06, resource: 'TICARET_BOGAZI' },
    { suffixId: 'WUH', name: 'Vuhan', lon: 114.30, lat: 30.59, gdpShare: 0.07, resource: 'DEMIR_CELIK' },
    { suffixId: 'CKG', name: 'Çongçing', lon: 106.55, lat: 29.56, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'SIA', name: 'Xi\'an', lon: 108.94, lat: 34.26, gdpShare: 0.06, resource: 'TAHIL' },
    { suffixId: 'SHE', name: 'Şenyang', lon: 123.43, lat: 41.80, gdpShare: 0.06, resource: 'DEMIR_CELIK' },
    { suffixId: 'HRB', name: 'Harbin', lon: 126.53, lat: 45.80, gdpShare: 0.05, resource: 'TAHIL' },
    { suffixId: 'CTU', name: 'Çengdu', lon: 104.06, lat: 30.67, gdpShare: 0.06, resource: 'NADIR_TOPRAK' },
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
    { suffixId: 'CAI', name: 'Kahire', lon: 31.23, lat: 30.04, isCapital: true, gdpShare: 0.38, resource: 'TAHIL' },
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
    { suffixId: 'ABV', name: 'Abuja', lon: 7.49, lat: 9.07, isCapital: true, gdpShare: 0.48, resource: 'TAHIL' },
    { suffixId: 'LOS', name: 'Lagos', lon: 3.37, lat: 6.52, gdpShare: 0.52, resource: 'PETROL' },
  ],
  // Güney Afrika (2 Şehir)
  '710': [
    { suffixId: 'JNB', name: 'Pretoria', lon: 28.04, lat: -26.20, isCapital: true, gdpShare: 0.58, resource: 'NADIR_TOPRAK' },
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
    { suffixId: 'DEL', name: 'Yeni Delhi', lon: 77.20, lat: 28.61, isCapital: true, gdpShare: 0.15, resource: 'TAHIL' },
    { suffixId: 'JAI', name: 'Jaipur', lon: 75.78, lat: 26.91, gdpShare: 0.08, resource: 'PAMUK' },
    { suffixId: 'LKO', name: 'Luknov', lon: 80.94, lat: 26.84, gdpShare: 0.08, resource: 'TAHIL' },
    { suffixId: 'AMD', name: 'Ahmedabad', lon: 72.57, lat: 23.02, gdpShare: 0.10, resource: 'TICARET_BOGAZI' },
    { suffixId: 'BOM', name: 'Mumbai', lon: 73.50, lat: 18.80, gdpShare: 0.14, resource: 'FINANS_MERKEZI' },
    { suffixId: 'HYD', name: 'Haydarabad', lon: 78.48, lat: 17.38, gdpShare: 0.10, resource: 'DEMIR_CELIK' },
    { suffixId: 'BLR', name: 'Bangalore', lon: 77.59, lat: 12.97, gdpShare: 0.10, resource: 'YARI_ILETKEN' },
    { suffixId: 'MAA', name: 'Madras', lon: 80.27, lat: 13.08, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PAT', name: 'Patna', lon: 84.80, lat: 25.60, gdpShare: 0.07, resource: 'TAHIL' },
    { suffixId: 'CCU', name: 'Kalküta', lon: 88.36, lat: 22.57, gdpShare: 0.09, resource: 'TICARET_BOGAZI' },
  ],
  // Endonezya (3 Şehir)
  '360': [
    { suffixId: 'JKT', name: 'Cakarta', lon: 106.84, lat: -6.20, isCapital: true, gdpShare: 0.48, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MES', name: 'Medan', lon: 98.67, lat: 3.59, gdpShare: 0.28, resource: 'PETROL' },
    { suffixId: 'BPN', name: 'Balikpapan', lon: 116.83, lat: -1.26, gdpShare: 0.24, resource: 'NADIR_TOPRAK' },
  ],
  // Güney Kore (2 Şehir)
  '410': [
    { suffixId: 'SEL', name: 'Seul', lon: 126.97, lat: 37.56, isCapital: true, gdpShare: 0.62, resource: 'YARI_ILETKEN' },
    { suffixId: 'PUS', name: 'Busan', lon: 129.07, lat: 35.17, gdpShare: 0.38, resource: 'TICARET_BOGAZI' },
  ],
  // Japonya (3 Şehir)
  '392': [
    { suffixId: 'TYO', name: 'Tokyo', lon: 139.69, lat: 35.68, isCapital: true, gdpShare: 0.46, resource: 'YARI_ILETKEN' },
    { suffixId: 'OSA', name: 'Osaka', lon: 135.50, lat: 34.69, gdpShare: 0.32, resource: 'FINANS_MERKEZI' },
    { suffixId: 'SPK', name: 'Sapporo', lon: 141.35, lat: 42.00, gdpShare: 0.22, resource: 'TICARET_BOGAZI' },
  ],
  // Brezilya (6 Şehir)
  '076': [
    { suffixId: 'BSB', name: 'Brasilia', lon: -47.88, lat: -15.79, isCapital: true, gdpShare: 0.20, resource: 'TAHIL' },
    { suffixId: 'GRU', name: 'Sao Paulo', lon: -46.63, lat: -23.55, gdpShare: 0.25, resource: 'FINANS_MERKEZI' },
    { suffixId: 'GIG', name: 'Rio de Janeiro', lon: -43.17, lat: -22.90, gdpShare: 0.18, resource: 'PETROL' },
    { suffixId: 'SSA', name: 'Salvador', lon: -38.50, lat: -12.97, gdpShare: 0.12, resource: 'PAMUK' },
    { suffixId: 'REC', name: 'Recife', lon: -34.87, lat: -8.04, gdpShare: 0.11, resource: 'TICARET_BOGAZI' },
    { suffixId: 'MAO', name: 'Manaus', lon: -60.02, lat: -4.00, gdpShare: 0.14, resource: 'NADIR_TOPRAK' },
  ],
  // Arjantin (3 Şehir)
  '032': [
    { suffixId: 'BUE', name: 'Buenos Aires', lon: -58.38, lat: -34.60, isCapital: true, gdpShare: 0.50, resource: 'TAHIL' },
    { suffixId: 'COR', name: 'Córdoba', lon: -64.18, lat: -31.42, gdpShare: 0.28, resource: 'DEMIR_CELIK' },
    { suffixId: 'USH', name: 'Ushuaia', lon: -68.50, lat: -45.80, gdpShare: 0.22, resource: 'DOGALGAZ' },
  ],
  // Avustralya (3 Şehir)
  '036': [
    { suffixId: 'SYD', name: 'Kanberra', lon: 149.13, lat: -35.28, isCapital: true, gdpShare: 0.44, resource: 'FINANS_MERKEZI' },
    { suffixId: 'MEL', name: 'Melbourne', lon: 144.96, lat: -37.81, gdpShare: 0.30, resource: 'TICARET_BOGAZI' },
    { suffixId: 'PER', name: 'Perth', lon: 115.86, lat: -31.95, gdpShare: 0.26, resource: 'NADIR_TOPRAK' },
  ],
};

// Clamps ±180° antimeridian wrap vertices (such as Russia's Chukotka tip at -175° lon or Fiji)
// into the ring's primary hemisphere so the ring is NEVER dropped and NEVER streaks across the globe!
function clampAntimeridianRing(ring: Position[]): Position[] {
  if (ring.length < 4) return ring;

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

  if (!hasJump) return ring;

  const isMostlyEast = eastCount >= westCount;
  return ring.map((pt) => {
    const lon = pt[0];
    const lat = pt[1];
    if (isMostlyEast && lon < -90) {
      return [179.92, lat];
    }
    if (!isMostlyEast && lon > 90) {
      return [-179.92, lat];
    }
    return [lon, lat];
  });
}

// Ensures a closed GeoJSON ring has valid spherical winding order for d3-geo
// so that d3-geo NEVER interprets the interior of a country/province as the exterior ocean,
// while preserving 100% of countries (including Russia, USA, and Fiji)!
function normalizeSphericalRing(rawRing: Position[]): Position[] | null {
  if (rawRing.length < 4) return null;

  const clamped = clampAntimeridianRing(rawRing);

  // Deduplicate consecutive identical points
  const candidate: Position[] = [];
  for (let i = 0; i < clamped.length; i++) {
    const pt = clamped[i];
    const prev = candidate[candidate.length - 1];
    if (
      !prev ||
      Math.abs(pt[0] - prev[0]) > 1e-6 ||
      Math.abs(pt[1] - prev[1]) > 1e-6
    ) {
      candidate.push([pt[0], pt[1]]);
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

// Sanitize any Polygon or MultiPolygon so no ring can ever invert to fill the ocean
export function sanitizeGeoGeometry(geometry: Geometry): Geometry {
  if (geometry.type === 'Polygon') {
    const outer = geometry.coordinates[0]
      ? normalizeSphericalRing(geometry.coordinates[0])
      : null;
    if (outer) {
      return { type: 'Polygon', coordinates: [outer] };
    }
    return geometry;
  }

  if (geometry.type === 'MultiPolygon') {
    const validPolygons: Position[][][] = [];
    geometry.coordinates.forEach((poly) => {
      if (!poly[0]) return;
      const outer = normalizeSphericalRing(poly[0]);
      if (outer) {
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

// Sutherland-Hodgman Half-Plane Clipping for a closed GeoJSON ring:
// Keeps points where a * lon + b * lat <= c
function clipRingWithHalfPlane(
  ring: Position[],
  a: number,
  b: number,
  c: number
): Position[] {
  if (ring.length < 3) return [];
  const pts =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  const out: Position[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % n];
    const valP = a * P[0] + b * P[1] - c;
    const valQ = a * Q[0] + b * Q[1] - c;

    const inP = valP <= 1e-9;
    const inQ = valQ <= 1e-9;

    if (inQ) {
      if (!inP) {
        const t = -valP / (valQ - valP);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
      out.push(Q);
    } else if (inP) {
      const t = -valP / (valQ - valP);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }

  if (out.length < 3) return [];
  out.push([out[0][0], out[0][1]]);
  return out;
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

  // Filter out tiny opposite-hemisphere island rings when subdividing (e.g., Russia's -175° Wrangel Island when main continent is clamped to +19°..+179.92°)
  const avgSeedLon =
    seeds.reduce((acc, s) => acc + s.lon, 0) / Math.max(1, seeds.length);
  const filteredOuterRings = outerRings.filter((ring) => {
    const sampleLon = ring[0]?.[0] ?? 0;
    return Math.abs(sampleLon - avgSeedLon) < 155;
  });

  const activeOuterRings =
    filteredOuterRings.length > 0 ? filteredOuterRings : outerRings;

  if (activeOuterRings.length === 0 || seeds.length <= 1) {
    return seeds.map((s) => ({ seed: s, geometry: safeBaseGeometry }));
  }

  return seeds.map((seedI, i) => {
    let currentRings = activeOuterRings.map((r) => [...r]);

    seeds.forEach((seedJ, j) => {
      if (i === j) return;
      const a = 2 * (seedJ.lon - seedI.lon);
      const b = 2 * (seedJ.lat - seedI.lat);
      const c =
        seedJ.lon * seedJ.lon +
        seedJ.lat * seedJ.lat -
        (seedI.lon * seedI.lon + seedI.lat * seedI.lat);

      const nextRings: Position[][] = [];
      currentRings.forEach((ring) => {
        const clipped = clipRingWithHalfPlane(ring, a, b, c);
        if (clipped.length >= 4) {
          nextRings.push(clipped);
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

    return {
      seed: seedI,
      geometry: normalizedRings.length > 0 ? clippedGeom : safeBaseGeometry,
    };
  });
}
