import { IdeologyId, ResourceType } from '../types/game';
import countries2026Data from './json/countries2026.json';
import { getNationTag } from './nationTagRegistry';

export interface PresetCountrySeed {
  isoNumeric: string;
  tag?: string;
  name: string;
  flagCode: string;
  color: string;
  ideology: IdeologyId;
  population: number; // in thousands
  baseGdp: number;
  treasury: number;
  manpower: number;
  garrison: number;
  resource: ResourceType;
}

export const PRESET_COUNTRIES_2026: Record<string, PresetCountrySeed> = Object.fromEntries(
  Object.values(
    countries2026Data.presetCountriesByTag as Record<string, PresetCountrySeed>
  ).map((seed) => [seed.isoNumeric, seed])
);

export const TURKISH_COUNTRY_NAMES: Record<string, string> =
  countries2026Data.turkishCountryNames;

export const PALETTE_COLORS: string[] = countries2026Data.paletteColors;

const RESOURCE_LIST: ResourceType[] = [
  'KERESTE',
  'SIGIR',
  'PAMUK',
  'TAHIL',
  'DEMIR_CELIK',
  'ALTIN',
  'PETROL',
  'DOGALGAZ',
  'NADIR_TOPRAK',
  'TICARET_BOGAZI',
  'YARI_ILETKEN',
  'FINANS_MERKEZI',
];

const IDEOLOGY_LIST: IdeologyId[] = [
  'DEMOCRACY',
  'AUTHORITARIAN',
  'MONARCHY',
  'SOCIALIST',
  'MILITARY_JUNTA',
  'TECHNO_CORPORATISM',
];

export function buildSeedForFeature(
  isoId: string,
  rawName: string,
  index: number
): PresetCountrySeed {
  const paddedId = isoId.padStart(3, '0');
  if (PRESET_COUNTRIES_2026[paddedId]) {
    return PRESET_COUNTRIES_2026[paddedId];
  }
  if (PRESET_COUNTRIES_2026[isoId]) {
    return PRESET_COUNTRIES_2026[isoId];
  }

  const trName = TURKISH_COUNTRY_NAMES[rawName] || rawName || `Bölge-${isoId}`;
  const hash = (parseInt(isoId, 10) || index * 31) + rawName.length * 17;

  return {
    isoNumeric: paddedId,
    tag: getNationTag(paddedId, '2026'),
    name: trName,
    flagCode: trName.slice(0, 2).toUpperCase(),
    color: PALETTE_COLORS[hash % PALETTE_COLORS.length],
    ideology: IDEOLOGY_LIST[hash % IDEOLOGY_LIST.length],
    population: 8500 + (hash % 32) * 1400,
    baseGdp: 65 + (hash % 75),
    treasury: 1200 + (hash % 15) * 110,
    manpower: 28000 + (hash % 25) * 1200,
    garrison: 14000 + (hash % 14) * 900,
    resource: RESOURCE_LIST[hash % RESOURCE_LIST.length],
  };
}
