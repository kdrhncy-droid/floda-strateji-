import {
  CultureId,
  GameModeId,
  IdeologyId,
  ReligionId,
} from '../../types/game';
import ottomanSultanPortrait from '../../assets/images/ottoman_sultan_portrait_1795804192269.jpg';
import ottomanConquerorPortrait from '../../assets/images/ottoman_conqueror_portrait_1795804983781.jpg';
import europeanMonarchPortrait from '../../assets/images/european_monarch_portrait_1795804985333.jpg';
import slavicTsarPortrait from '../../assets/images/slavic_tsar_portrait_1795804988141.jpg';
import easternIslamicShahPortrait from '../../assets/images/eastern_islamic_shah_portrait_1795804990214.jpg';
import eastAsianEmperorPortrait from '../../assets/images/east_asian_emperor_portrait_1795804989225.jpg';
import modernStatesmanPortrait from '../../assets/images/modern_statesman_portrait_1795804990800.jpg';

export type RulerPortraitArchetypeId =
  | 'OTTOMAN_SULTAN'
  | 'OTTOMAN_CONQUEROR'
  | 'EUROPEAN_MONARCH'
  | 'SLAVIC_TSAR'
  | 'EASTERN_ISLAMIC_SHAH'
  | 'EAST_ASIAN_EMPEROR'
  | 'MODERN_STATESMAN';

export interface RulerPortraitAsset {
  id: RulerPortraitArchetypeId;
  src: string;
  objectPosition: string;
  imageClassName?: string;
  caption: string;
}

const PORTRAIT_ASSETS: Record<RulerPortraitArchetypeId, RulerPortraitAsset> = {
  OTTOMAN_SULTAN: {
    id: 'OTTOMAN_SULTAN',
    src: ottomanSultanPortrait,
    objectPosition: '50% 18%',
    caption: 'Osmanlı Padişahı',
  },
  OTTOMAN_CONQUEROR: {
    id: 'OTTOMAN_CONQUEROR',
    src: ottomanConquerorPortrait,
    objectPosition: '50% 17%',
    caption: 'Fatih / Cihangir Padişah',
  },
  EUROPEAN_MONARCH: {
    id: 'EUROPEAN_MONARCH',
    src: europeanMonarchPortrait,
    objectPosition: '50% 18%',
    caption: 'Avrupa Hükümdarı',
  },
  SLAVIC_TSAR: {
    id: 'SLAVIC_TSAR',
    src: slavicTsarPortrait,
    objectPosition: '50% 18%',
    caption: 'Çar & Büyük Knez',
  },
  EASTERN_ISLAMIC_SHAH: {
    id: 'EASTERN_ISLAMIC_SHAH',
    src: easternIslamicShahPortrait,
    objectPosition: '50% 18%',
    caption: 'Doğu & İslam Hükümdarı',
  },
  EAST_ASIAN_EMPEROR: {
    id: 'EAST_ASIAN_EMPEROR',
    src: eastAsianEmperorPortrait,
    objectPosition: '50% 20%',
    imageClassName: 'scale-[1.1]',
    caption: 'Doğu Asya İmparatoru',
  },
  MODERN_STATESMAN: {
    id: 'MODERN_STATESMAN',
    src: modernStatesmanPortrait,
    objectPosition: '50% 23%',
    imageClassName: 'scale-[1.2]',
    caption: 'Modern Devlet Lideri',
  },
};

const OTTOMAN_CONQUEROR_NAMES = [
  'fatih',
  'yavuz',
  'kanuni',
  'genç osman',
  'iv. murad',
];

const EUROPEAN_1440_IDS = new Set([
  '250', // Fransa
  '826', // İngiltere
  '724', // Kastilya / İspanya
  '620', // Portekiz
  '276', // Kutsal Roma / Almanya
  '040', // Avusturya
  '380', // Venedik
  '752', // Kalmar / İsveç
  '208', // Danimarka
  '578', // Norveç
  '348', // Macaristan
  '616', // Lehistan
  '440', // Litvanya
  '905', // İskoçya
  '428', // Töton Tarikatı
  '300', // Bizans
  '528', // Hollanda / Burgundiya
  '756', // İsviçre
  '203', // Bohemya
]);

const ISLAMIC_EAST_1440_IDS = new Set([
  '818', // Memlük
  '364', // Timur / İran
  '356', // Delhi / Babür
  '050', // Bengal
  '012', // Mağrip
  '504', // Fas / Merînî
  '788', // Tunus
  '682', // Necid & Hürmüz
  '887', // Yemen
  '904', // Vijayanagara
]);

export interface ResolvePortraitParams {
  nationId: string;
  dynastyName?: string;
  rulerName?: string;
  rulerTitle?: string;
  isElected?: boolean;
  primaryCulture?: CultureId;
  stateReligion?: ReligionId;
  ideology?: IdeologyId;
  gameMode: GameModeId;
}

/**
 * Resolves a historical or era-appropriate oil-painting portrait for any 1440 or 2026 ruler.
 * Returns null only when no culturally appropriate portrait exists (e.g. 1440 Pre-Columbian Americas).
 */
export function getRulerPortraitAsset(
  params: ResolvePortraitParams
): RulerPortraitAsset | null {
  const {
    nationId,
    dynastyName,
    rulerName = '',
    rulerTitle = '',
    isElected,
    primaryCulture,
    stateReligion,
    ideology,
    gameMode,
  } = params;

  // 1. 2026 & Modern Scenarios
  if (gameMode !== 'EMPIRES_1440') {
    if (ideology === 'MONARCHY' && !isElected) {
      if (
        primaryCulture === 'ARABIC_LEVANT' ||
        primaryCulture === 'PERSIAN_IRANIC' ||
        nationId === '682'
      ) {
        return PORTRAIT_ASSETS.EASTERN_ISLAMIC_SHAH;
      }
      if (
        primaryCulture === 'SINIC_HAN' ||
        primaryCulture === 'JAPANESE_YAMATO'
      ) {
        return PORTRAIT_ASSETS.EAST_ASIAN_EMPEROR;
      }
    }
    return PORTRAIT_ASSETS.MODERN_STATESMAN;
  }

  // 2. 1440 Historical Scenario
  const lowerName = rulerName.toLowerCase();
  const lowerTitle = rulerTitle.toLowerCase();

  // 2a. Ottoman Empire — distinct conqueror portrait for Fatih, Yavuz, Kanuni, Genç Osman, IV. Murad
  if (nationId === '792' || dynastyName === 'Osmanoğulları') {
    const isConquerorSultan = OTTOMAN_CONQUEROR_NAMES.some((key) =>
      lowerName.includes(key)
    );
    return isConquerorSultan
      ? PORTRAIT_ASSETS.OTTOMAN_CONQUEROR
      : PORTRAIT_ASSETS.OTTOMAN_SULTAN;
  }

  // 2b. Pre-Columbian Americas: keep clean typographic card instead of mismatched Old World attire
  if (
    primaryCulture === 'AMERINDIAN' ||
    stateReligion === 'INDIGENOUS_AMERICAN' ||
    nationId === '076' ||
    nationId === '484'
  ) {
    return null;
  }

  // 2c. East Asia (Ming, Japan, Joseon)
  if (
    nationId === '156' ||
    nationId === '392' ||
    nationId === '410' ||
    primaryCulture === 'SINIC_HAN' ||
    primaryCulture === 'JAPANESE_YAMATO' ||
    stateReligion === 'BUDDHISM_EAST'
  ) {
    return PORTRAIT_ASSETS.EAST_ASIAN_EMPEROR;
  }

  // 2d. Muscovy / Russia & Orthodox Slavic Principalities
  if (
    nationId === '643' ||
    (primaryCulture === 'SLAVIC_EAST_SOUTH' &&
      stateReligion === 'CHRISTIAN_ORTHODOX') ||
    lowerTitle.includes('çar') ||
    lowerTitle.includes('knez')
  ) {
    return PORTRAIT_ASSETS.SLAVIC_TSAR;
  }

  // 2e. Karakoyunlu / Akkoyunlu -> Safavid transition
  if (nationId === '031') {
    return lowerTitle.includes('şah')
      ? PORTRAIT_ASSETS.EASTERN_ISLAMIC_SHAH
      : PORTRAIT_ASSETS.OTTOMAN_SULTAN;
  }

  // 2f. European & Byzantine Kingdoms / Duchies / Republics
  if (
    EUROPEAN_1440_IDS.has(nationId) ||
    primaryCulture === 'ROMANCE_LATIN' ||
    primaryCulture === 'GERMANIC_CENTRAL' ||
    primaryCulture === 'GREEK_BYZANTINE' ||
    primaryCulture === 'SLAVIC_EAST_SOUTH' ||
    stateReligion === 'CHRISTIAN_CATHOLIC' ||
    stateReligion === 'CHRISTIAN_ORTHODOX'
  ) {
    return PORTRAIT_ASSETS.EUROPEAN_MONARCH;
  }

  // 2g. Steppe Turco-Mongol Khanates (Crimea, Golden Horde, Uzbek, Sibir)
  if (
    primaryCulture === 'MONGOL_STEPPE' ||
    nationId === '804' ||
    nationId === '902' ||
    nationId === '860' ||
    nationId === '903'
  ) {
    return PORTRAIT_ASSETS.OTTOMAN_SULTAN;
  }

  // 2h. Middle Eastern, Persian, North African & South Asian Courts
  if (
    ISLAMIC_EAST_1440_IDS.has(nationId) ||
    primaryCulture === 'ARABIC_LEVANT' ||
    primaryCulture === 'PERSIAN_IRANIC' ||
    stateReligion === 'ISLAM_SHIA' ||
    stateReligion === 'ISLAM_SUNNI' ||
    stateReligion === 'HINDUISM_VEDIC'
  ) {
    return PORTRAIT_ASSETS.EASTERN_ISLAMIC_SHAH;
  }

  // 2i. Remaining Turkmen/Oghuz minor realms
  if (primaryCulture === 'TURKIC_OGHUZ') {
    return PORTRAIT_ASSETS.OTTOMAN_SULTAN;
  }

  return PORTRAIT_ASSETS.EUROPEAN_MONARCH;
}

// Eagerly decode local portrait artwork so iOS Safari paints immediately inside modals/drawers.
const preloadedPortraits: HTMLImageElement[] = [];
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  Object.values(PORTRAIT_ASSETS).forEach((asset) => {
    const img = new Image();
    img.decoding = 'sync';
    img.src = asset.src;
    preloadedPortraits.push(img);
    img.decode?.().catch(() => undefined);
  });
}
