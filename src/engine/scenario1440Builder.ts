import { DiplomaticRelation, IdeologyId, Nation, Territory } from '../types/game';
import { STRATEGIC_STRAITS } from './straitsAndTradeEngine';
import { GeoCountryFeature, InitialWorldBundle } from './core/worldTypes';
import { relationKey } from './core/diplomacyHelpers';

interface Empire1440Def {
  id: string;
  name: string;
  flagCode: string;
  color: string;
  ideology: IdeologyId;
  capitalName: string;
  capitalTerritoryId?: string;
  treasury: number;
  manpower: number;
  absorbedCountryIds: string[];
  provinceRenames?: Record<string, string>;
}

// 36 Major Historical Empires & Kingdoms of the 1440/1444 World
// Covers every continent with zero missing land gaps and 360+ rich provinces
export const EMPIRES_1440_DEFS: Empire1440Def[] = [
  {
    id: '792',
    name: 'Osmanlı İmparatorluğu',
    flagCode: 'OSM',
    color: '#183222',
    ideology: 'MONARCHY',
    capitalName: '★ Edirne',
    capitalTerritoryId: '792_EDR',
    treasury: 3200,
    manpower: 165000,
    absorbedCountryIds: ['792', '100', '807'],
    provinceRenames: {
      '792': 'Ankara',
      '792_EDR': '★ Edirne',
      '792_GLB': 'Gelibolu',
      '792_IST': '★ İstanbul',
      '792_BUR': 'Bursa',
      '792_IZM': 'İzmir',
      '792_MUG': 'Muğla',
      '792_KUT': 'Kütahya',
      '792_ANT': 'Antalya',
      '792_KNY': 'Konya',
      '792_KYS': 'Sivas',
      '792_KST': 'Kastamonu',
      '792_SAM': 'Amasya',
      '792_ADA': 'Adana',
      '792_GZP': 'Maraş',
      '792_MLT': 'Malatya',
      '792_TRB': 'Trabzon',
      '792_ERZ': 'Erzurum',
      '792_DYB': 'Diyarbakır',
      '792_VAN': 'Van',
      '100': 'Sofya',
      '100_PDV': 'Filibe',
      '100_VAR': 'Varna',
      '807': 'Üsküp',
      '008': 'Avlonya',
    },
  },
  {
    id: '300',
    name: 'Bizans & Mora Despotluğu',
    flagCode: 'BİZ',
    color: '#78357A',
    ideology: 'MONARCHY',
    capitalName: '★ İstanbul',
    capitalTerritoryId: '792_IST',
    treasury: 1950,
    manpower: 75000,
    absorbedCountryIds: ['300'],
    provinceRenames: {
      '300': 'Atina',
      '300_SKG': 'Selanik',
      '300_IOA': 'Yanya',
      '300_CRT': 'Girit',
    },
  },
  {
    id: '818',
    name: 'Memlük Sultanlığı',
    flagCode: 'MEM',
    color: '#C88A32',
    ideology: 'MONARCHY',
    capitalName: '★ Kahire',
    treasury: 2800,
    manpower: 140000,
    absorbedCountryIds: ['818', '760', '400', '376', '275', '422', '682', '434'],
    provinceRenames: {
      '818': '★ Kahire',
      '818_ALY': 'İskenderiye',
      '818_SUZ': 'Süveyş',
      '818_ASW': 'Asvan',
      '760': 'Şam',
      '760_ALP': 'Halep',
      '760_LTK': 'Lazkiye',
      '760_DEZ': 'Rakka',
      '400': 'Kerek',
      '376': 'Kudüs',
      '682': 'Riyad',
      '682_JED': 'Mekke',
      '682_MED': 'Medine',
      '682_DMM': 'Lahsa',
      '434': 'Trablus',
      '434_BEN': 'Bingazi',
    },
  },
  {
    id: '887',
    name: 'Yemen Resûlî Sultanlığı',
    flagCode: 'YEM',
    color: '#9A3B2E',
    ideology: 'MONARCHY',
    capitalName: '★ Sana',
    treasury: 1450,
    manpower: 52000,
    absorbedCountryIds: ['887'],
    provinceRenames: {
      '887': '★ Sana',
      '887_ADE': 'Aden',
    },
  },
  {
    id: '729',
    name: 'Funj & Nubya Sultanlığı',
    flagCode: 'NUB',
    color: '#A86D3A',
    ideology: 'MONARCHY',
    capitalName: '★ Hartum',
    treasury: 1400,
    manpower: 58000,
    absorbedCountryIds: ['729'],
    provinceRenames: {
      '729': '★ Hartum',
      '729_PZU': 'Sevakin',
      '729_ELF': 'Darfur',
    },
  },
  {
    id: '031',
    name: 'Karakoyunlu & Akkoyunlu',
    flagCode: 'AKK',
    color: '#2A7B9B',
    ideology: 'MONARCHY',
    capitalName: '★ Bakü',
    treasury: 2350,
    manpower: 118000,
    absorbedCountryIds: ['031', '368'],
    provinceRenames: {
      '031': '★ Bakü',
      '031_GNJ': 'Gence',
      '031_SKX': 'Şuşa',
      '368': 'Bağdat',
      '368_BSR': 'Basra',
      '368_EBL': 'Musul',
      '368_KIK': 'Kerkük',
    },
  },
  {
    id: '268',
    name: 'Gürcistan Krallığı',
    flagCode: 'GUR',
    color: '#A64D6B',
    ideology: 'MONARCHY',
    capitalName: '★ Tiflis',
    treasury: 1450,
    manpower: 54000,
    absorbedCountryIds: ['268', '051'],
    provinceRenames: {
      '268': '★ Tiflis',
      '268_BUS': 'Batum',
      '051': 'Erivan',
    },
  },
  {
    id: '364',
    name: 'Timur İmparatorluğu',
    flagCode: 'TİM',
    color: '#8E2430',
    ideology: 'MONARCHY',
    capitalName: '★ Semerkant',
    treasury: 2950,
    manpower: 160000,
    absorbedCountryIds: ['364', '795', '004'],
    provinceRenames: {
      '364': '★ Tahran',
      '364_ISF': 'İsfahan',
      '364_TBZ': 'Tebriz',
      '364_AWZ': 'Ahvaz',
      '364_SYZ': 'Şiraz',
      '364_KER': 'Kirman',
      '364_MHD': 'Meşhed',
      '795': 'Merv',
      '795_KRW': 'Türkmenbaşı',
      '004': 'Kabil',
      '004_HEA': 'Herat',
      '004_KDH': 'Kandahar',
    },
  },
  {
    id: '860',
    name: 'Özbek & Çağatay Hanlığı',
    flagCode: 'ÖZB',
    color: '#2A9D8F',
    ideology: 'MONARCHY',
    capitalName: '★ Semerkant',
    treasury: 1950,
    manpower: 92000,
    absorbedCountryIds: ['860', '417', '762'],
    provinceRenames: {
      '860': '★ Taşkent',
      '860_SKD': 'Semerkant',
      '860_UGC': 'Hive',
    },
  },
  {
    id: '643',
    name: 'Altın Orda & Moskova',
    flagCode: 'ORD',
    color: '#2E6F40',
    ideology: 'MONARCHY',
    capitalName: '★ Moskova',
    treasury: 2650,
    manpower: 175000,
    absorbedCountryIds: ['643'],
    provinceRenames: {
      '643': '★ Moskova',
      '643_LED': 'Novgorod',
      '643_SMO': 'Smolensk',
      '643_GOJ': 'Nijni Novgorod',
      '643_KRR': 'Kırım',
      '643_ROV': 'Azak',
      '643_VOG': 'Saray',
      '643_ASF': 'Astrahan',
      '643_KZN': 'Kazan',
      '643_KUF': 'Samara',
      '643_ARH': 'Arhangelsk',
      '643_SVX': 'Perm',
      '643_OMS': 'Sibir',
      '643_OVB': 'Tümen',
      '643_KJA': 'Yenisey',
      '643_IKT': 'İrkutsk',
      '643_KHV': 'Amur',
      '643_VVO': 'Vladivostok',
    },
  },
  {
    id: '804',
    name: 'Kırım & Kiev Hanlığı',
    flagCode: 'KIR',
    color: '#248277',
    ideology: 'MONARCHY',
    capitalName: '★ Kefe',
    treasury: 1850,
    manpower: 88000,
    absorbedCountryIds: ['804'],
    provinceRenames: {
      '804': '★ Kiev',
      '804_LVV': 'Lviv',
      '804_ODS': 'Kefe',
      '804_HRK': 'Harkiv',
    },
  },
  {
    id: '398',
    name: 'Kazak & Deşt-i Kıpçak Hanlığı',
    flagCode: 'KAZ',
    color: '#2C8CB8',
    ideology: 'MONARCHY',
    capitalName: '★ Türkistan',
    treasury: 1750,
    manpower: 86000,
    absorbedCountryIds: ['398'],
    provinceRenames: {
      '398': '★ Astana',
      '398_ALA': 'Almatı',
      '398_SCO': 'Aktau',
      '398_CIT': 'Türkistan',
    },
  },
  {
    id: '348',
    name: 'Macaristan Krallığı',
    flagCode: 'MAC',
    color: '#4A7C59',
    ideology: 'MONARCHY',
    capitalName: '★ Budin',
    treasury: 2350,
    manpower: 112000,
    absorbedCountryIds: ['348', '703'],
    provinceRenames: {
      '348': '★ Budin',
      '348_DEB': 'Debrecen',
      '348_PEC': 'Peçuy',
      '703': 'Estergon',
    },
  },
  {
    id: '191',
    name: 'Hırvatistan Banlığı',
    flagCode: 'HIR',
    color: '#C4496A',
    ideology: 'MONARCHY',
    capitalName: '★ Zagreb',
    treasury: 1400,
    manpower: 48000,
    absorbedCountryIds: ['191'],
    provinceRenames: {
      '191': '★ Zagreb',
      '191_SPU': 'Dubrovnik',
    },
  },
  {
    id: '642',
    name: 'Eflak Voyvodalığı',
    flagCode: 'EFL',
    color: '#9C6B30',
    ideology: 'MONARCHY',
    capitalName: '★ Bükreş',
    treasury: 1750,
    manpower: 72000,
    absorbedCountryIds: ['642'],
    provinceRenames: {
      '642': '★ Bükreş',
      '642_CLJ': 'Kaloşvar',
      '642_TSR': 'Temeşvar',
      '642_IAS': 'Yaş',
      '642_CND': 'Köstence',
    },
  },
  {
    id: '498',
    name: 'Boğdan Voyvodalığı',
    flagCode: 'BOG',
    color: '#648244',
    ideology: 'MONARCHY',
    capitalName: '★ Suceava',
    treasury: 1350,
    manpower: 46000,
    absorbedCountryIds: ['498'],
    provinceRenames: {
      '498': '★ Suceava',
    },
  },
  {
    id: '688',
    name: 'Sırbistan Despotluğu',
    flagCode: 'SIR',
    color: '#7A3E3E',
    ideology: 'MONARCHY',
    capitalName: '★ Belgrad',
    treasury: 1650,
    manpower: 62000,
    absorbedCountryIds: ['688'],
    provinceRenames: {
      '688': '★ Belgrad',
      '688_NIS': 'Semendire',
    },
  },
  {
    id: '070',
    name: 'Bosna Krallığı',
    flagCode: 'BOS',
    color: '#3A6F94',
    ideology: 'MONARCHY',
    capitalName: '★ Saraybosna',
    treasury: 1450,
    manpower: 52000,
    absorbedCountryIds: ['070', '499'],
    provinceRenames: {
      '070': '★ Saraybosna',
      '070_OMO': 'Mostar',
    },
  },
  {
    id: '276',
    name: 'Kutsal Roma İmparatorluğu',
    flagCode: 'KRI',
    color: '#C6922C',
    ideology: 'MONARCHY',
    capitalName: '★ Frankfurt',
    treasury: 3250,
    manpower: 150000,
    absorbedCountryIds: ['276'],
    provinceRenames: {
      '276': '★ Berlin',
      '276_MUC': 'Münih',
      '276_STR': 'Stuttgart',
      '276_FRA': 'Frankfurt',
      '276_HAM': 'Hamburg',
      '276_DRS': 'Dresden',
    },
  },
  {
    id: '756',
    name: 'İsviçre Konfederasyonu',
    flagCode: 'ISV',
    color: '#C83E3B',
    ideology: 'DEMOCRACY',
    capitalName: '★ Bern',
    treasury: 1650,
    manpower: 52000,
    absorbedCountryIds: ['756'],
    provinceRenames: {
      '756': '★ Bern',
      '756_ZRH': 'Zürih',
    },
  },
  {
    id: '528',
    name: 'Burgonya & Felemenk Dükalığı',
    flagCode: 'BRG',
    color: '#7C1D3E',
    ideology: 'MONARCHY',
    capitalName: '★ Amsterdam',
    treasury: 2450,
    manpower: 88000,
    absorbedCountryIds: ['528', '056', '442'],
    provinceRenames: {
      '528': '★ Amsterdam',
      '528_RTM': 'Rotterdam',
      '056': 'Brüksel',
      '056_ANR': 'Anvers',
    },
  },
  {
    id: '040',
    name: 'Avusturya Arşidüklüğü',
    flagCode: 'AVU',
    color: '#CFC5B4',
    ideology: 'MONARCHY',
    capitalName: '★ Viyana',
    treasury: 2250,
    manpower: 90000,
    absorbedCountryIds: ['040'],
    provinceRenames: {
      '040': '★ Viyana',
      '040_GRZ': 'Graz',
      '040_INN': 'Innsbruck',
    },
  },
  {
    id: '203',
    name: 'Bohemya Krallığı',
    flagCode: 'BOH',
    color: '#A86434',
    ideology: 'MONARCHY',
    capitalName: '★ Prag',
    treasury: 1850,
    manpower: 68000,
    absorbedCountryIds: ['203'],
    provinceRenames: {
      '203': '★ Prag',
      '203_BRQ': 'Brno',
    },
  },
  {
    id: '380',
    name: 'Venedik & İtalya Devletleri',
    flagCode: 'VEN',
    color: '#2E778D',
    ideology: 'DEMOCRACY',
    capitalName: '★ Venedik',
    treasury: 3100,
    manpower: 120000,
    absorbedCountryIds: ['380', '705'],
    provinceRenames: {
      '380': '★ Roma',
      '380_FLR': 'Floransa',
      '380_MIL': 'Milano',
      '380_VCE': 'Venedik',
      '380_NAP': 'Napoli',
      '380_PMO': 'Palermo',
      '705': 'Ljubljana',
    },
  },
  {
    id: '196',
    name: 'Kıbrıs Lüzinyan Krallığı',
    flagCode: 'KIB',
    color: '#D4A843',
    ideology: 'MONARCHY',
    capitalName: '★ Lefkoşa',
    treasury: 1350,
    manpower: 38000,
    absorbedCountryIds: ['196'],
    provinceRenames: {
      '196': '★ Lefkoşa',
    },
  },
  {
    id: '616',
    name: 'Lehistan Krallığı',
    flagCode: 'LEH',
    color: '#D1495B',
    ideology: 'MONARCHY',
    capitalName: '★ Krakow',
    treasury: 2450,
    manpower: 115000,
    absorbedCountryIds: ['616'],
    provinceRenames: {
      '616': '★ Varşova',
      '616_POZ': 'Poznań',
      '616_KRK': 'Krakow',
      '616_GDN': 'Gdansk',
    },
  },
  {
    id: '440',
    name: 'Litvanya Büyük Dükalığı',
    flagCode: 'LİT',
    color: '#6D2E46',
    ideology: 'MONARCHY',
    capitalName: '★ Vilnius',
    treasury: 2100,
    manpower: 94000,
    absorbedCountryIds: ['440', '112'],
    provinceRenames: {
      '440': '★ Vilnius',
      '440_KUN': 'Kaunas',
      '112': 'Minsk',
      '112_BQT': 'Brest',
    },
  },
  {
    id: '428',
    name: 'Livonya & Töton Şövalyeleri',
    flagCode: 'TOT',
    color: '#5C6773',
    ideology: 'MONARCHY',
    capitalName: '★ Riga',
    treasury: 1650,
    manpower: 64000,
    absorbedCountryIds: ['428', '233'],
    provinceRenames: {
      '428': '★ Riga',
      '233': 'Reval',
    },
  },
  {
    id: '250',
    name: 'Fransa Krallığı',
    flagCode: 'FRA',
    color: '#2B5B84',
    ideology: 'MONARCHY',
    capitalName: '★ Paris',
    treasury: 3000,
    manpower: 155000,
    absorbedCountryIds: ['250'],
    provinceRenames: {
      '250': '★ Paris',
      '250_LYO': 'Lyon',
      '250_MRS': 'Marsilya',
      '250_TLS': 'Toulouse',
      '250_BDX': 'Bordeaux',
      '250_NTE': 'Nantes',
    },
  },
  {
    id: '826',
    name: 'İngiltere Krallığı',
    flagCode: 'İNG',
    color: '#A63A3A',
    ideology: 'MONARCHY',
    capitalName: '★ Londra',
    treasury: 2900,
    manpower: 130000,
    absorbedCountryIds: ['826'],
    provinceRenames: {
      '826': '★ Londra',
      '826_MAN': 'York',
      '826_CWL': 'Cardiff',
      '826_EDI': 'Edinburgh',
    },
  },
  {
    id: '372',
    name: 'İskoçya & İrlanda Krallığı',
    flagCode: 'İSK',
    color: '#2D6A7E',
    ideology: 'MONARCHY',
    capitalName: '★ Dublin',
    treasury: 1750,
    manpower: 68000,
    absorbedCountryIds: ['372', '352'],
    provinceRenames: {
      '372': '★ Dublin',
    },
  },
  {
    id: '724',
    name: 'Kastilya & Aragon Krallığı',
    flagCode: 'KAS',
    color: '#D4A024',
    ideology: 'MONARCHY',
    capitalName: '★ Toledo',
    treasury: 2700,
    manpower: 125000,
    absorbedCountryIds: ['724'],
    provinceRenames: {
      '724': '★ Toledo',
      '724_BCN': 'Barselona',
      '724_VLC': 'Valensiya',
      '724_SEV': 'Sevilla',
      '724_GRX': 'Gırnata',
      '724_BIO': 'Bilbao',
    },
  },
  {
    id: '620',
    name: 'Portekiz Krallığı',
    flagCode: 'POR',
    color: '#2B7A4B',
    ideology: 'MONARCHY',
    capitalName: '★ Lizbon',
    treasury: 2150,
    manpower: 76000,
    absorbedCountryIds: ['620'],
    provinceRenames: {
      '620': '★ Lizbon',
      '620_OPO': 'Porto',
    },
  },
  {
    id: '012',
    name: 'Tilimsan & Cezayir Sultanlığı',
    flagCode: 'CEZ',
    color: '#2E7052',
    ideology: 'MONARCHY',
    capitalName: '★ Tilimsan',
    treasury: 1950,
    manpower: 88000,
    absorbedCountryIds: ['012'],
    provinceRenames: {
      '012': '★ Cezayir',
      '012_ORN': 'Tilimsan',
      '012_HME': 'Tamanrasset',
    },
  },
  {
    id: '504',
    name: 'Merînî Fas Sultanlığı',
    flagCode: 'FAS',
    color: '#8E3535',
    ideology: 'MONARCHY',
    capitalName: '★ Fes',
    treasury: 2050,
    manpower: 92000,
    absorbedCountryIds: ['504', '732', '478'],
    provinceRenames: {
      '504': '★ Rabat',
      '504_FEZ': 'Fes',
      '504_RAK': 'Marakeş',
    },
  },
  {
    id: '788',
    name: 'Tunus Hafsî Sultanlığı',
    flagCode: 'TUN',
    color: '#A8732A',
    ideology: 'MONARCHY',
    capitalName: '★ Tunus',
    treasury: 1900,
    manpower: 78000,
    absorbedCountryIds: ['788'],
    provinceRenames: {
      '788': '★ Tunus',
      '788_SFA': 'Kayrevan',
    },
  },
  {
    id: '752',
    name: 'İsveç & Finlandiya Birliği',
    flagCode: 'KAL',
    color: '#2F6690',
    ideology: 'MONARCHY',
    capitalName: '★ Stokholm',
    treasury: 2050,
    manpower: 88000,
    absorbedCountryIds: ['752', '246'],
    provinceRenames: {
      '752': '★ Stokholm',
      '752_GOT': 'Göteborg',
      '752_KIR': 'Kiruna',
      '246': 'Turku',
      '246_OUL': 'Oulu',
    },
  },
  {
    id: '208',
    name: 'Danimarka Krallığı',
    flagCode: 'DAN',
    color: '#B8333A',
    ideology: 'MONARCHY',
    capitalName: '★ Kopenhag',
    treasury: 1850,
    manpower: 68000,
    absorbedCountryIds: ['208'],
    provinceRenames: {
      '208': '★ Kopenhag',
      '208_AAR': 'Aarhus',
    },
  },
  {
    id: '578',
    name: 'Norveç Krallığı',
    flagCode: 'NOR',
    color: '#6E5A8A',
    ideology: 'MONARCHY',
    capitalName: '★ Oslo',
    treasury: 1650,
    manpower: 58000,
    absorbedCountryIds: ['578', '304'],
    provinceRenames: {
      '578': '★ Oslo',
      '578_BGO': 'Bergen',
      '578_TOS': 'Tromsø',
    },
  },
  {
    id: '231',
    name: 'Habeşistan İmparatorluğu',
    flagCode: 'HAB',
    color: '#A67628',
    ideology: 'MONARCHY',
    capitalName: '★ Gondar',
    treasury: 1750,
    manpower: 82000,
    absorbedCountryIds: ['231', '404', '800', '728'],
    provinceRenames: {
      '231': '★ Gondar',
      '231_DIR': 'Harar',
      '404': 'Mombasa',
    },
  },
  {
    id: '706',
    name: 'Adal Sultanlığı',
    flagCode: 'ADL',
    color: '#3A7D5C',
    ideology: 'MONARCHY',
    capitalName: '★ Mogadişu',
    treasury: 1450,
    manpower: 54000,
    absorbedCountryIds: ['706', '232', '262'],
    provinceRenames: {
      '706': '★ Mogadişu',
    },
  },
  {
    id: '566',
    name: 'Songhay & Bornu İmparatorluğu',
    flagCode: 'MAL',
    color: '#8C5A2B',
    ideology: 'MONARCHY',
    capitalName: '★ Kano',
    treasury: 2050,
    manpower: 92000,
    absorbedCountryIds: ['566', '562', '148', '120', '204', '768'],
    provinceRenames: {
      '566': '★ Kano',
      '566_LOS': 'Benin',
      '562': 'Gao',
      '148': 'Bornu',
    },
  },
  {
    id: '466',
    name: 'Mali İmparatorluğu',
    flagCode: 'MLI',
    color: '#C89B2B',
    ideology: 'MONARCHY',
    capitalName: '★ Timbuktu',
    treasury: 2250,
    manpower: 96000,
    absorbedCountryIds: [
      '466', '686', '288', '384', '324', '694', '430', '270', '624', '854',
    ],
    provinceRenames: {
      '466': '★ Bamako',
      '466_TOM': 'Timbuktu',
    },
  },
  {
    id: '710',
    name: 'Büyük Zimbabve & Mutapa',
    flagCode: 'ZİM',
    color: '#356B43',
    ideology: 'MONARCHY',
    capitalName: '★ Zimbabve',
    treasury: 1750,
    manpower: 78000,
    absorbedCountryIds: ['710', '716', '894', '454', '516', '072'],
    provinceRenames: {
      '710': '★ Mapungubve',
      '710_CPT': 'Ümit Burnu',
      '716': 'Zimbabve',
    },
  },
  {
    id: '834',
    name: 'Kilva Sultanlığı',
    flagCode: 'KLV',
    color: '#2D7A72',
    ideology: 'MONARCHY',
    capitalName: '★ Kilva',
    treasury: 1650,
    manpower: 68000,
    absorbedCountryIds: ['834', '508', '450'],
    provinceRenames: {
      '834': '★ Kilva',
      '450': 'Antananarivo',
    },
  },
  {
    id: '180',
    name: 'Kongo Krallığı',
    flagCode: 'KON',
    color: '#A6523A',
    ideology: 'MONARCHY',
    capitalName: '★ Mbanza',
    treasury: 1650,
    manpower: 74000,
    absorbedCountryIds: ['180', '024', '178', '266'],
    provinceRenames: {
      '180': '★ Mbanza',
    },
  },
  {
    id: '356',
    name: 'Delhi & Behmenî Sultanlığı',
    flagCode: 'DEL',
    color: '#3D7A5A',
    ideology: 'MONARCHY',
    capitalName: '★ Delhi',
    treasury: 3100,
    manpower: 185000,
    absorbedCountryIds: ['356', '586'],
    provinceRenames: {
      '356': '★ Delhi',
      '356_JAI': 'Jaipur',
      '356_LKO': 'Luknov',
      '356_AMD': 'Ahmedabad',
      '356_BOM': 'Mumbai',
      '356_HYD': 'Haydarabad',
      '356_PAT': 'Patna',
      '356_CCU': 'Kalküta',
      '356_BLR': 'Vijayanagara',
      '356_MAA': 'Madras',
      '586': 'Lahor',
      '586_KHI': 'Karaçi',
      '586_PEW': 'Peşaver',
    },
  },
  {
    id: '050',
    name: 'Bengal Sultanlığı',
    flagCode: 'BNG',
    color: '#2A8C6A',
    ideology: 'MONARCHY',
    capitalName: '★ Dakka',
    treasury: 1850,
    manpower: 84000,
    absorbedCountryIds: ['050', '524'],
    provinceRenames: {
      '050': '★ Dakka',
      '050_CGP': 'Çittagong',
    },
  },
  {
    id: '144',
    name: 'Kotte (Seylan) Krallığı',
    flagCode: 'SEY',
    color: '#9E5A3B',
    ideology: 'MONARCHY',
    capitalName: '★ Kolombo',
    treasury: 1350,
    manpower: 42000,
    absorbedCountryIds: ['144'],
    provinceRenames: {
      '144': '★ Kolombo',
      '144_KDY': 'Kandy',
    },
  },
  {
    id: '360',
    name: 'Majapahit İmparatorluğu',
    flagCode: 'MAJ',
    color: '#B85A32',
    ideology: 'MONARCHY',
    capitalName: '★ Cava',
    treasury: 2050,
    manpower: 92000,
    absorbedCountryIds: ['360', '036', '554', '598'],
    provinceRenames: {
      '360': '★ Cakarta',
      '360_MES': 'Açe',
      '360_BPN': 'Brunei',
    },
  },
  {
    id: '458',
    name: 'Malakka Sultanlığı',
    flagCode: 'MLK',
    color: '#287E64',
    ideology: 'MONARCHY',
    capitalName: '★ Malakka',
    treasury: 1750,
    manpower: 56000,
    absorbedCountryIds: ['458'],
    provinceRenames: {
      '458': '★ Malakka',
      '458_KCH': 'Brunei',
    },
  },
  {
    id: '608',
    name: 'Tondo & Sulu Sultanlığı',
    flagCode: 'SUL',
    color: '#3A6EA5',
    ideology: 'MONARCHY',
    capitalName: '★ Manila',
    treasury: 1550,
    manpower: 54000,
    absorbedCountryIds: ['608'],
    provinceRenames: {
      '608': '★ Manila',
      '608_CEB': 'Cebu',
      '608_DVO': 'Sulu',
    },
  },
  {
    id: '764',
    name: 'Ayutthaya Krallığı',
    flagCode: 'AYU',
    color: '#386890',
    ideology: 'MONARCHY',
    capitalName: '★ Ayutthaya',
    treasury: 1850,
    manpower: 76000,
    absorbedCountryIds: ['764'],
    provinceRenames: {
      '764': '★ Ayutthaya',
      '764_CNX': 'Lanna',
      '764_HDY': 'Ligor',
    },
  },
  {
    id: '704',
    name: 'Dai Viet İmparatorluğu',
    flagCode: 'DAI',
    color: '#B8423B',
    ideology: 'MONARCHY',
    capitalName: '★ Hanoi',
    treasury: 1750,
    manpower: 78000,
    absorbedCountryIds: ['704', '418'],
    provinceRenames: {
      '704': '★ Hanoi',
      '704_DAD': 'Hue',
      '704_SGN': 'Çampa',
    },
  },
  {
    id: '104',
    name: 'Ava (Burma) Krallığı',
    flagCode: 'AVA',
    color: '#6B5B95',
    ideology: 'MONARCHY',
    capitalName: '★ Pegu',
    treasury: 1650,
    manpower: 68000,
    absorbedCountryIds: ['104'],
    provinceRenames: {
      '104': '★ Pegu',
      '104_MDL': 'Ava',
    },
  },
  {
    id: '116',
    name: 'Khmer (Angkor) Krallığı',
    flagCode: 'KHM',
    color: '#C47D3B',
    ideology: 'MONARCHY',
    capitalName: '★ Angkor',
    treasury: 1450,
    manpower: 52000,
    absorbedCountryIds: ['116'],
    provinceRenames: {
      '116': '★ Phnom Penh',
      '116_REP': 'Angkor',
    },
  },
  {
    id: '156',
    name: 'Ming Hanedanı (Çin)',
    flagCode: 'MİN',
    color: '#B85D28',
    ideology: 'MONARCHY',
    capitalName: '★ Pekin',
    treasury: 3800,
    manpower: 220000,
    absorbedCountryIds: ['156', '158'],
    provinceRenames: {
      '156': '★ Pekin',
      '156_SHA': 'Nanjing',
      '156_CAN': 'Kanton',
      '156_FOC': 'Fuzhou',
      '156_TAO': 'Çingdao',
      '156_WUH': 'Vuhan',
      '156_CKG': 'Çongçing',
      '156_SIA': 'Xi\'an',
      '156_SHE': 'Şenyang',
      '156_HRB': 'Harbin',
      '156_CTU': 'Çengdu',
      '156_KMG': 'Kunming',
      '156_LHW': 'Lanzhou',
      '156_LXA': 'Lhasa',
      '156_URC': 'Kaşgar',
    },
  },
  {
    id: '496',
    name: 'Oyrat & Moğol Hanlığı',
    flagCode: 'MOG',
    color: '#5C6F82',
    ideology: 'MONARCHY',
    capitalName: '★ Karakurum',
    treasury: 1650,
    manpower: 86000,
    absorbedCountryIds: ['496'],
    provinceRenames: {
      '496': '★ Ulanbator',
      '496_Kov': 'Karakurum',
    },
  },
  {
    id: '410',
    name: 'Joseon Krallığı (Kore)',
    flagCode: 'JOS',
    color: '#435898',
    ideology: 'MONARCHY',
    capitalName: '★ Hanseong',
    treasury: 2050,
    manpower: 88000,
    absorbedCountryIds: ['410', '408'],
    provinceRenames: {
      '410': '★ Hanseong (Seul)',
      '410_PUS': 'Busan',
    },
  },
  {
    id: '392',
    name: 'Ashikaga Şogunluğu (Japonya)',
    flagCode: 'ŞOG',
    color: '#9E3B4B',
    ideology: 'MILITARY_JUNTA',
    capitalName: '★ Kyoto',
    treasury: 2600,
    manpower: 130000,
    absorbedCountryIds: ['392'],
    provinceRenames: {
      '392': '★ Edo',
      '392_OSA': 'Kyoto',
      '392_SPK': 'Sapporo',
    },
  },
  {
    id: '484',
    name: 'Aztek & Maya Konfederasyonu',
    flagCode: 'AZT',
    color: '#2A7A68',
    ideology: 'MONARCHY',
    capitalName: '★ Tenochtitlan',
    treasury: 2150,
    manpower: 110000,
    absorbedCountryIds: ['484', '320', '340', '558', '188', '591', '192', '214', '332'],
    provinceRenames: {
      '484': '★ Tenochtitlan',
      '484_MTY': 'Monterrey',
      '484_GDL': 'Yucatan',
    },
  },
  {
    id: '840',
    name: 'Kuzey Amerika İrokua Konfederasyonu',
    flagCode: 'İRO',
    color: '#6C584C',
    ideology: 'MONARCHY',
    capitalName: '★ Onondaga',
    treasury: 1950,
    manpower: 96000,
    absorbedCountryIds: ['840', '124'],
    provinceRenames: {
      '840': '★ Onondaga',
      '840_NYC': 'Mohawk',
      '840_BOS': 'Massachusett',
      '840_PHI': 'Lenape',
      '840_CHI': 'İllinois',
      '840_DET': 'Huron',
      '840_MSP': 'Dakota',
      '840_ATL': 'Çeroki',
      '840_MIA': 'Seminol',
      '840_HOU': 'Komançi',
      '840_DAL': 'Kiowa',
      '840_DEN': 'Arapaho',
      '840_PHX': 'Apaçi',
      '840_LAX': 'Çumaş',
      '840_SFO': 'Miwok',
      '840_SEA': 'Çinuk',
    },
  },
  {
    id: '076',
    name: 'İnka İmparatorluğu (Tawantinsuyu)',
    flagCode: 'İNK',
    color: '#704A82',
    ideology: 'MONARCHY',
    capitalName: '★ Cusco',
    treasury: 2250,
    manpower: 120000,
    absorbedCountryIds: ['076', '604', '068', '152', '032', '170', '862', '218', '600', '858'],
    provinceRenames: {
      '604': '★ Cusco',
      '068': 'La Paz',
      '218': 'Quito',
      '152': 'Santiago',
      '076': 'Brasilia',
      '076_GRU': 'Sao Paulo',
      '076_MAO': 'Manaus',
      '032': 'Buenos Aires',
    },
  },
];

// Province-level historical corrections for 1444 (applied over country-level absorption)
const PROVINCE_OWNER_OVERRIDES_1440: Record<string, string> = {
  '792_IST': '300', // Constantinople stays Byzantine until 1453
  '792_ERZ': '031',
  '792_VAN': '031',
  '792_DYB': '031',
  '792_MLT': '031',
  '792_TRB': '268', // Trebizond: nearest Christian Caucasian realm
  '792_GZP': '818', // Dulkadir / Maras under Mamluk sphere
  '792_ADA': '818', // Ramazanoglu / Adana under Mamluk sphere
};
const COUNTRY_OWNER_OVERRIDES_1440: Record<string, string> = {
  '008': '380', // Albania: Venice / Italian states coast, not Ottoman in 1444
  '512': '887',
  '784': '887',
  '634': '887',
  '414': '031',
};

export function transformBundleTo1440Scenario(
  baseBundle: InitialWorldBundle
): InitialWorldBundle {
  // Map every absorbed country ID to its 1440 Empire owner ID
  const countryToEmpireId: Record<string, string> = {};
  const empireDefMap: Record<string, Empire1440Def> = {};

  EMPIRES_1440_DEFS.forEach((emp) => {
    empireDefMap[emp.id] = emp;
    emp.absorbedCountryIds.forEach((cId) => {
      countryToEmpireId[cId] = emp.id;
    });
  });

  const allRenames1440: Record<string, string> = {};
  EMPIRES_1440_DEFS.forEach((emp) => Object.assign(allRenames1440, emp.provinceRenames));
  const nations: Record<string, Nation> = {};
  const territories: Record<string, Territory> = {};
  const features: GeoCountryFeature[] = [];

  // 1. Create the 36 Historical Empires & Kingdoms
  EMPIRES_1440_DEFS.forEach((emp) => {
    const baseN = baseBundle.nations[emp.id];
    const isOttoman = emp.id === '792';
    const resolvedCapId =
      emp.capitalTerritoryId && baseBundle.territories[emp.capitalTerritoryId]
        ? emp.capitalTerritoryId
        : emp.id;
    nations[emp.id] = {
      ...(baseN || {
        id: emp.id,
        capitalTerritoryId: resolvedCapId,
        stability: 82,
        inflation: 2.5,
        researchPoints: 135,
        taxRate: 25,
        budget: { military: 35, economy: 30, research: 15, welfare: 20 },
        aggressiveExpansion: 15,
        unlockedTechs: ['eco_1'],
        modernizedArmyTier: 0,
        enactedReforms: [],
        recruitedGeneralIds: [],
        activeGeneralId: null,
        clanInfluence: 160,
        bannerCalledLordIds: [],
        formedEmpireId: null,
        vassalOf: null,
        isEliminated: false,
      }),
      id: emp.id,
      name: emp.name,
      flagCode: emp.flagCode,
      color: emp.color,
      ideology: emp.ideology,
      capitalTerritoryId: resolvedCapId,
      treasury: Math.round(emp.treasury * 0.45),
      manpower: emp.manpower,
      researchPoints: isOttoman ? 65 : 50,
      researchProgressByTech: {},
      unlockedTechs: ['eco_1'],
      modernizedArmyTier: 0,
      recruitedGeneralIds: isOttoman ? ['cmd_candarli'] : [],
      activeGeneralId: isOttoman ? 'cmd_candarli' : null,
      clanInfluence: 110,
      bannerCalledLordIds: [],
    };
  });

  // Precompute empire capital coordinates so any unmapped country joins its closest regional 1440 empire (zero missing land holes!)
  const empireAnchorCoords: { id: string; lon: number; lat: number }[] =
    EMPIRES_1440_DEFS.map((emp) => {
      const capId =
        emp.capitalTerritoryId && baseBundle.territories[emp.capitalTerritoryId]
          ? emp.capitalTerritoryId
          : emp.id;
      const capT = baseBundle.territories[capId] ?? baseBundle.territories[emp.id];
      return {
        id: emp.id,
        lon: capT?.centroid[0] ?? 30,
        lat: capT?.centroid[1] ?? 40,
      };
    });

  // 2. Reassign all world provinces to the 36 Historical Empires so 100% of world landmasses are rendered!
  baseBundle.features.forEach((feat) => {
    const baseCountryId = feat.id.split('_')[0];
    const baseT = baseBundle.territories[feat.id];
    if (!baseT) return;

    let targetEmpireId =
      PROVINCE_OWNER_OVERRIDES_1440[feat.id] ??
      COUNTRY_OWNER_OVERRIDES_1440[baseCountryId] ??
      countryToEmpireId[baseCountryId];
    if (!targetEmpireId) {
      // Find closest regional 1440 empire by centroid so no land polygon is ever dropped
      let bestId = '792';
      let bestDist = Infinity;
      for (const anc of empireAnchorCoords) {
        const d =
          (baseT.centroid[0] - anc.lon) ** 2 +
          (baseT.centroid[1] - anc.lat) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestId = anc.id;
        }
      }
      targetEmpireId = bestId;
    }

    const empDef = empireDefMap[targetEmpireId];
    const renames = { ...allRenames1440, ...(empDef?.provinceRenames || {}) };
    const customName =
      renames[feat.id] ||
      renames[feat.id.toLowerCase()] ||
      renames[feat.id.toUpperCase()] ||
      baseT.name;
    const resolvedCapId =
      empDef?.capitalTerritoryId &&
      baseBundle.territories[empDef.capitalTerritoryId]
        ? empDef.capitalTerritoryId
        : targetEmpireId;
    const isEmpireCapital = feat.id === resolvedCapId;

    features.push({
      ...feat,
      properties: {
        ...feat.properties,
        name: customName,
      },
    });

    territories[feat.id] = {
      ...baseT,
      name: customName,
      ownerId: targetEmpireId,
      coreOwnerId: targetEmpireId,
      isCapital: isEmpireCapital,
      unrest: 4,
    };
  });

  // 2B. Balance 1440 starting armies and GDP historically so major Eurasian powers (Ming, Ottoman, Timurid, Mamluk, HRE) lead the world
  const TARGET_1440_EMPIRE_SCALE: Record<
    string,
    { targetArmy: number; targetGdp: number }
  > = {
    '156': { targetArmy: 235000, targetGdp: 1380 }, // Ming Hanedanı
    '792': { targetArmy: 175000, targetGdp: 1080 }, // Osmanlı Devleti
    '364': { targetArmy: 155000, targetGdp: 980 },  // Timur İmparatorluğu
    '818': { targetArmy: 150000, targetGdp: 980 },  // Memlük Sultanlığı
    '276': { targetArmy: 138000, targetGdp: 960 },  // Kutsal Roma İmparatorluğu
    '643': { targetArmy: 135000, targetGdp: 840 },  // Altın Orda & Moskova
    '356': { targetArmy: 130000, targetGdp: 920 },  // Delhi & Behmenî
    '250': { targetArmy: 95000, targetGdp: 740 },   // Fransa Krallığı
    '392': { targetArmy: 92000, targetGdp: 680 },   // Ashikaga Şogunluğu
    '348': { targetArmy: 88000, targetGdp: 620 },   // Macaristan Krallığı
    '616': { targetArmy: 84000, targetGdp: 590 },   // Lehistan Krallığı
    '031': { targetArmy: 85000, targetGdp: 560 },   // Karakoyunlu & Akkoyunlu
    '724': { targetArmy: 82000, targetGdp: 610 },   // Kastilya & Aragon
    '826': { targetArmy: 80000, targetGdp: 610 },   // İngiltere Krallığı
    '040': { targetArmy: 74000, targetGdp: 540 },   // Avusturya & Bohemya
    '380': { targetArmy: 72000, targetGdp: 690 },   // Venedik & İtalya
    '076': { targetArmy: 72000, targetGdp: 590 },   // İnka İmparatorluğu
    '440': { targetArmy: 70000, targetGdp: 510 },   // Litvanya Büyük Dükalığı
    '860': { targetArmy: 68000, targetGdp: 490 },   // Özbek & Çağatay Hanlığı
    '566': { targetArmy: 68000, targetGdp: 580 },   // Mali & Songhay
    '840': { targetArmy: 66000, targetGdp: 520 },   // Kuzey Amerika İrokua
    '484': { targetArmy: 65000, targetGdp: 520 },   // Aztek & Maya
    '752': { targetArmy: 64000, targetGdp: 520 },   // Kalmar Birliği
    '764': { targetArmy: 62000, targetGdp: 480 },   // Ayutthaya & Dai Viet
    '360': { targetArmy: 60000, targetGdp: 490 },   // Majapahit & Malakka
    '410': { targetArmy: 58000, targetGdp: 460 },   // Joseon Krallığı (Kore)
    '231': { targetArmy: 58000, targetGdp: 460 },   // Habeşistan & Adal
    '620': { targetArmy: 54000, targetGdp: 450 },   // Portekiz Krallığı
    '504': { targetArmy: 54000, targetGdp: 430 },   // Merînî Fas Sultanlığı
    '642': { targetArmy: 52000, targetGdp: 410 },   // Eflak & Boğdan
    '710': { targetArmy: 52000, targetGdp: 440 },   // Kilva & Büyük Zimbabve
    '012': { targetArmy: 50000, targetGdp: 400 },   // Tilimsan & Cezayir
    '688': { targetArmy: 48000, targetGdp: 390 },   // Sırbistan & Bosna
    '788': { targetArmy: 46000, targetGdp: 380 },   // Tunus Hafsî Sultanlığı
    '372': { targetArmy: 44000, targetGdp: 360 },   // İskoçya & İrlanda
    '300': { targetArmy: 42000, targetGdp: 320 },   // Bizans & Mora
    // Newly split 1440 historical realms (historically balanced below great powers)
    '528': { targetArmy: 62000, targetGdp: 540 },   // Burgonya & Felemenk Dükalığı
    '804': { targetArmy: 58000, targetGdp: 420 },   // Kırım & Kiev Hanlığı
    '398': { targetArmy: 56000, targetGdp: 390 },   // Kazak & Deşt-i Kıpçak Hanlığı
    '466': { targetArmy: 54000, targetGdp: 450 },   // Mali İmparatorluğu
    '050': { targetArmy: 52000, targetGdp: 430 },   // Bengal Sultanlığı
    '704': { targetArmy: 50000, targetGdp: 410 },   // Dai Viet İmparatorluğu
    '208': { targetArmy: 48000, targetGdp: 420 },   // Danimarka Krallığı
    '203': { targetArmy: 48000, targetGdp: 410 },   // Bohemya Krallığı
    '496': { targetArmy: 48000, targetGdp: 340 },   // Oyrat & Moğol Hanlığı
    '104': { targetArmy: 46000, targetGdp: 370 },   // Ava (Burma) Krallığı
    '180': { targetArmy: 44000, targetGdp: 350 },   // Kongo Krallığı
    '834': { targetArmy: 42000, targetGdp: 360 },   // Kilva Sultanlığı
    '428': { targetArmy: 42000, targetGdp: 350 },   // Livonya & Töton Şövalyeleri
    '458': { targetArmy: 40000, targetGdp: 390 },   // Malakka Sultanlığı
    '578': { targetArmy: 40000, targetGdp: 350 },   // Norveç Krallığı
    '756': { targetArmy: 38000, targetGdp: 380 },   // İsviçre Konfederasyonu
    '268': { targetArmy: 38000, targetGdp: 330 },   // Gürcistan Krallığı
    '070': { targetArmy: 36000, targetGdp: 310 },   // Bosna Krallığı
    '706': { targetArmy: 36000, targetGdp: 310 },   // Adal Sultanlığı
    '608': { targetArmy: 36000, targetGdp: 320 },   // Tondo & Sulu Sultanlığı
    '116': { targetArmy: 36000, targetGdp: 310 },   // Khmer (Angkor) Krallığı
    '729': { targetArmy: 35000, targetGdp: 300 },   // Funj & Nubya Sultanlığı
    '887': { targetArmy: 34000, targetGdp: 310 },   // Yemen Resûlî Sultanlığı
    '191': { targetArmy: 34000, targetGdp: 310 },   // Hırvatistan Banlığı
    '498': { targetArmy: 32000, targetGdp: 290 },   // Boğdan Voyvodalığı
    '144': { targetArmy: 30000, targetGdp: 280 },   // Kotte (Seylan) Krallığı
    '196': { targetArmy: 26000, targetGdp: 260 },   // Kıbrıs Lüzinyan Krallığı
  };

  const provsByEmpire: Record<string, Territory[]> = {};
  Object.values(territories).forEach((t) => {
    if (!provsByEmpire[t.ownerId]) provsByEmpire[t.ownerId] = [];
    provsByEmpire[t.ownerId].push(t);
  });

  Object.entries(provsByEmpire).forEach(([empId, provs]) => {
    const scaleTarget = TARGET_1440_EMPIRE_SCALE[empId];
    if (!scaleTarget || provs.length === 0) return;

    const currentArmy = provs.reduce((s, p) => s + p.garrison, 0) || 1;
    const currentGdp = provs.reduce((s, p) => s + p.baseGdp, 0) || 1;
    const armyFactor = scaleTarget.targetArmy / currentArmy;
    const gdpFactor = scaleTarget.targetGdp / currentGdp;

    provs.forEach((p) => {
      const nextGarrison = Math.max(
        p.isCapital ? 6500 : 2800,
        Math.round(p.garrison * armyFactor)
      );
      const armor = Math.round(nextGarrison * 0.18);
      const airDrone = Math.round(nextGarrison * 0.08);
      const infantry = Math.max(1000, nextGarrison - armor - airDrone);
      p.garrison = infantry + armor + airDrone;
      p.units = { infantry, armor, airDrone };
      p.baseGdp = Math.max(
        p.isCapital ? 55 : 22,
        Math.round(p.baseGdp * gdpFactor)
      );
    });
  });

  // 3. Clean up neighbor links and ensure every province has >=2 neighbors
  const validProvIds = Object.keys(territories);
  const validSet = new Set(validProvIds);

  validProvIds.forEach((pId) => {
    territories[pId].neighbors = territories[pId].neighbors.filter((nId) =>
      validSet.has(nId)
    );
  });

  const link1440 = (a: string, b: string) => {
    if (!a || !b || a === b || !territories[a] || !territories[b]) return;
    if (!territories[a].neighbors.includes(b)) {
      territories[a].neighbors.push(b);
    }
    if (!territories[b].neighbors.includes(a)) {
      territories[b].neighbors.push(a);
    }
  };

  // Connect key 1440 historical straits & borders (Balkans, Bosphorus, Gibraltar, Suez, Hormuz, Danish Sund, Tsushima, Channel)
  link1440('792_EDR', '792_IST');
  link1440('792_EDR', '100');
  link1440('792_EDR', '300_SKG');
  link1440('792_IST', '792_BUR');
  link1440('792_IZM', '300_CRT');
  link1440('792', '300');
  link1440('792', '100');
  link1440('100', '642');
  link1440('100', '688');
  link1440('688', '348');
  link1440('348', '040');
  link1440('792_ADA', '760_ALP');
  link1440('792_DYB', '368_EBL');
  link1440('792_ERZ', '031_GNJ');
  link1440('792_ERZ', '364_TBZ');
  STRATEGIC_STRAITS.forEach((st) => {
    st.crossingEdges.forEach(([a, b]) => link1440(a, b));
  });

  validProvIds.forEach((pId) => {
    if (territories[pId].neighbors.length < 2) {
      const cA = territories[pId].centroid;
      validProvIds
        .filter((otherId) => otherId !== pId)
        .map((otherId) => {
          const cB = territories[otherId].centroid;
          return {
            otherId,
            distSq: (cA[0] - cB[0]) ** 2 + (cA[1] - cB[1]) ** 2,
          };
        })
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, 3)
        .forEach((item) => link1440(pId, item.otherId));
    }
  });

  // 4. Historical 1440 Diplomatic Relations
  const relations: Record<string, DiplomaticRelation> = {};
  const setRel = (
    a: string,
    b: string,
    partial: Partial<DiplomaticRelation>
  ) => {
    if (!nations[a] || !nations[b]) return;
    const key = relationKey(a, b);
    const nationA = a < b ? a : b;
    const nationB = a < b ? b : a;
    const embargoingNationIds =
      partial.embargoingNationIds ??
      (partial.hasEmbargo ? [nationA] : []);
    relations[key] = {
      nationA,
      nationB,
      score: partial.score ?? 0,
      isAllied: partial.isAllied ?? false,
      allianceType:
        partial.allianceType ?? (partial.isAllied ? 'OFFENSIVE' : null),
      hasNonAggression: partial.hasNonAggression ?? false,
      hasTradeAgreement: partial.hasTradeAgreement ?? false,
      hasEmbargo: embargoingNationIds.length > 0,
      embargoingNationIds,
      hasMilitaryAccess: partial.hasMilitaryAccess ?? false,
      truceUntilTick: 0,
    };
  };

  // Ottoman - Byzantium, Hungary & Venice rivalry (1440-1453 Varna & Constantinople era)
  setRel('792', '300', { score: -70 });
  setRel('792', '348', { score: -55 });
  setRel('792', '380', { score: -40 });
  // Hungary - Poland personal union / alliance
  setRel('348', '616', {
    score: 85,
    isAllied: true,
    allianceType: 'OFFENSIVE',
    hasMilitaryAccess: true,
  });
  // France - England Hundred Years' War tension
  setRel('250', '826', { score: -65 });
  // Ottoman - Mamluk & Karakoyunlu/Timurid balance
  setRel('792', '818', { score: 25, hasTradeAgreement: true });
  setRel('792', '031', { score: 35, hasTradeAgreement: true });
  setRel('792', '364', { score: -20 });

  return {
    features,
    nations,
    territories,
    relations,
  };
}
