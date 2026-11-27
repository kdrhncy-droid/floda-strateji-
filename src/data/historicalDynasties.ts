import { CultureId, RulerDeathCause, RulerTraitId } from '../types/game';
import historicalDynastiesData from './json/historicalDynasties.json';
import { buildDualKeyLookup } from './nationTagRegistry';

export interface RulerTraitDefinition {
  id: RulerTraitId;
  name: string;
  shortEffect: string;
  description: string;
  taxBonusPct?: number;
  tradeBonusPct?: number;
  researchBonusPct?: number;
  manpowerBonusPct?: number;
  attackBonusPct?: number;
  defenseBonusPct?: number;
  siegeSpeedPct?: number;
  aeDecayBonus?: number;
  stabilityBonus?: number;
  coupResistance?: number;
}

export interface HistoricalRulerTemplate {
  name: string;
  title: string;
  dynastyName: string;
  /** Typical age when ascending if they aren't the 1440 starting ruler (realistic dynamic birth year). */
  startAge: number;
  admin: number;
  diplomacy: number;
  military: number;
  traitId: RulerTraitId;
}

export const RULER_TRAITS =
  historicalDynastiesData.rulerTraits as Record<RulerTraitId, RulerTraitDefinition>;

export const DEATH_CAUSE_LABELS =
  historicalDynastiesData.deathCauseLabels as Record<
    RulerDeathCause,
    { label: string; chroniclePhrase: string }
  >;

/**
 * Sequential historical dynasty queues for 1440 major realms.
 * Stored by readable tag in historicalDynasties.json and indexed by both tag ("OTT") and runtime ID ("792").
 */
export const HISTORICAL_DYNASTIES_1440: Record<string, HistoricalRulerTemplate[]> =
  buildDualKeyLookup(
    historicalDynastiesData.dynasties1440ByTag as Record<string, HistoricalRulerTemplate[]>,
    '1440'
  );

export const CULTURAL_RULER_POOLS = historicalDynastiesData.culturePools as Record<
  CultureId,
  {
    monarchyTitle: string;
    republicTitle: string;
    dynastyFallback: string;
    givenNames: string[];
    modernSurnames: string[];
  }
>;

export const MODERN_2026_FIRST_NAMES: Record<
  string,
  { name: string; title: string; age: number }
> = buildDualKeyLookup(
  historicalDynastiesData.modernPresetRulersByTag as Record<
    string,
    { name: string; title: string; age: number }
  >,
  '2026'
);
