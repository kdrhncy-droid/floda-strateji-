import nationTagsData from './json/nationTags.json';
import { GameModeId } from '../types/game';

export interface NationTagEntry {
  id: string;
  name: string;
  flagCode: string;
}

export type NationEra = '1440' | '2026';

export const NATION_TAGS_1440: Record<string, NationTagEntry> = nationTagsData.tags1440;
export const NATION_TAGS_2026: Record<string, NationTagEntry> = nationTagsData.tags2026;

export const TAG_TO_1440_ID: Record<string, string> = {};
export const ID_TO_1440_TAG: Record<string, string> = {};

for (const [tag, info] of Object.entries(NATION_TAGS_1440)) {
  TAG_TO_1440_ID[tag.toUpperCase()] = info.id;
  ID_TO_1440_TAG[info.id] = tag.toUpperCase();
}

export const TAG_TO_2026_ID: Record<string, string> = {};
export const ID_TO_2026_TAG: Record<string, string> = {};

for (const [tag, info] of Object.entries(NATION_TAGS_2026)) {
  TAG_TO_2026_ID[tag.toUpperCase()] = info.id;
  ID_TO_2026_TAG[info.id] = tag.toUpperCase();
}

/**
 * Resolves either a readable Paradox-style country tag (e.g. "OTT", "BYZ", "TUR")
 * or a numeric ISO runtime ID (e.g. "792", "300") into its canonical runtime ID.
 */
export function resolveNationRuntimeId(idOrTag: string, era: NationEra = '1440'): string {
  const trimmed = String(idOrTag || '').trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  if (era === '1440') {
    return TAG_TO_1440_ID[upper] ?? TAG_TO_2026_ID[upper] ?? trimmed;
  }
  return TAG_TO_2026_ID[upper] ?? TAG_TO_1440_ID[upper] ?? trimmed;
}

/**
 * Returns the canonical readable tag for a nation ID or tag in a given era
 * (e.g. "792" -> "OTT" in 1440, "TUR" in 2026).
 */
export function getNationTag(idOrTag: string, era: NationEra = '1440'): string {
  const trimmed = String(idOrTag || '').trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (era === '1440') {
    if (TAG_TO_1440_ID[upper]) return upper;
    if (ID_TO_1440_TAG[trimmed]) return ID_TO_1440_TAG[trimmed];
  } else {
    if (TAG_TO_2026_ID[upper]) return upper;
    if (ID_TO_2026_TAG[trimmed]) return ID_TO_2026_TAG[trimmed];
  }
  return ID_TO_1440_TAG[trimmed] ?? ID_TO_2026_TAG[trimmed] ?? upper;
}

export function getNationTagForMode(idOrTag: string, gameMode: GameModeId): string {
  return getNationTag(idOrTag, gameMode === 'EMPIRES_1440' ? '1440' : '2026');
}

/**
 * Expands a dictionary keyed by readable tags (e.g. "OTT", "TUR") so lookups work
 * seamlessly whether callers pass a runtime ID ("792") or a readable tag ("OTT").
 */
export function buildDualKeyLookup<T>(
  recordByTagOrId: Record<string, T>,
  era: NationEra
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(recordByTagOrId)) {
    const runtimeId = resolveNationRuntimeId(key, era);
    const tag = getNationTag(runtimeId, era);
    out[runtimeId] = value;
    if (tag) {
      out[tag] = value;
    }
  }
  return out;
}
