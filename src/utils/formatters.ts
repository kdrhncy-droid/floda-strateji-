/**
 * Shared pure formatting & normalization helpers used across HUD, drawers, modals, and map rendering.
 */

export function cleanNationName(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/\s*\((1440|2026)\)\s*$/g, '').trim();
}

export function cleanProvinceName(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/^★\s*/, '').trim();
}

export function formatTroopsShort(amount: number, decimals = 1): string {
  const val = Math.max(0, amount || 0);
  if (val >= 1000) {
    return `${(val / 1000).toFixed(decimals)}B`;
  }
  return `${Math.round(val)}`;
}

/**
 * Normalizes a nation's 2–3 letter flagCode to ASCII uppercase so Turkish locale
 * differences ('i' -> 'İ' vs 'I', 'ş' -> 'Ş', 'ğ' -> 'Ğ') never cause missed flag matches.
 */
export function normalizeFlagCode(flagCode: string | undefined | null): string {
  if (!flagCode) return '';
  return flagCode
    .trim()
    .replace(/i/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'I')
    .replace(/[şŞ]/g, 'S')
    .replace(/[ğĞ]/g, 'G')
    .replace(/[üÜ]/g, 'U')
    .replace(/[öÖ]/g, 'O')
    .replace(/[çÇ]/g, 'C')
    .toUpperCase();
}
