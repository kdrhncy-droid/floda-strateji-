import { ArmyMovement, GameModeId, Nation, Territory } from '../types/game';
import { computeNationTechMetrics } from '../data/world2026Data';
import { computeNationEconomySummary } from './simulationEngine';

export interface NationPowerRankingEntry {
  nation: Nation;
  ownedCount: number;
  army: number;
  gdp: number;
  totalEconomy: number;
  techLevel: number;
  maxTechLevel: number;
  capitalLevel: number;
  prestige: number;
  score: number;
}

export type PowerRankingSortKey =
  | 'SCORE'
  | 'GDP'
  | 'ARMY'
  | 'TECH'
  | 'PRESTIGE'
  | 'CAPITAL';

/**
 * Single source of truth for Global Power Rankings used by both the
 * top-left flag star badge and the World Power Rankings screen.
 */
export function computeWorldPowerRankings(
  nations: Record<string, Nation>,
  territories: Record<string, Territory>,
  movements: ArmyMovement[],
  gameMode: GameModeId,
  sortBy: PowerRankingSortKey = 'SCORE'
): NationPowerRankingEntry[] {
  const statsByNation = new Map<
    string,
    { ownedCount: number; army: number; gdp: number }
  >();

  for (const t of Object.values(territories)) {
    if (!t) continue;
    const prev = statsByNation.get(t.ownerId) || {
      ownedCount: 0,
      army: 0,
      gdp: 0,
    };
    prev.ownedCount += 1;
    prev.army += t.garrison || 0;
    prev.gdp +=
      t.baseGdp *
      (1 +
        (t.buildings.factory || 0) * 0.25 +
        (t.buildings.capitalPalace || 0) * 0.15);
    statsByNation.set(t.ownerId, prev);
  }

  for (const mv of movements) {
    if (!mv) continue;
    const prev = statsByNation.get(mv.ownerId) || {
      ownedCount: 0,
      army: 0,
      gdp: 0,
    };
    prev.army += mv.troops || 0;
    statsByNation.set(mv.ownerId, prev);
  }

  return Object.values(nations)
    .filter((n) => !n.isEliminated)
    .map((n) => {
      const st = statsByNation.get(n.id) || {
        ownedCount: 0,
        army: 0,
        gdp: 0,
      };
      const metrics = computeNationTechMetrics(n, territories, gameMode);
      const econSum = computeNationEconomySummary(n, territories);
      const economyScore = Math.round(
        econSum.totalEconomy * 1.9 + n.treasury * 0.08
      );
      const armyScore = Math.round(st.army / 180);
      const techScore = Math.round(metrics.techLevel * 120);
      const prestigeScore = Math.round(metrics.prestige * 1.15);
      const capitalTerritoryScore = Math.round(
        metrics.capitalLevel * 95 + st.ownedCount * 48
      );
      const score =
        economyScore +
        armyScore +
        techScore +
        prestigeScore +
        capitalTerritoryScore;
      return {
        nation: n,
        ownedCount: st.ownedCount,
        army: st.army,
        gdp: st.gdp,
        totalEconomy: econSum.totalEconomy,
        techLevel: metrics.techLevel,
        maxTechLevel: metrics.maxTechLevel,
        capitalLevel: metrics.capitalLevel,
        prestige: metrics.prestige,
        score,
      };
    })
    .sort((a, b) => {
      if (sortBy === 'GDP')
        return b.totalEconomy - a.totalEconomy || b.score - a.score;
      if (sortBy === 'ARMY') return b.army - a.army;
      if (sortBy === 'TECH')
        return b.techLevel - a.techLevel || b.score - a.score;
      if (sortBy === 'PRESTIGE')
        return b.prestige - a.prestige || b.score - a.score;
      if (sortBy === 'CAPITAL')
        return (
          b.capitalLevel * 10 +
            b.ownedCount -
            (a.capitalLevel * 10 + a.ownedCount) || b.score - a.score
        );
      return b.score - a.score;
    });
}
