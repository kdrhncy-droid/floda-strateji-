import {
  ActiveWar,
  ArmyMovement,
  DiplomaticActionType,
  DiplomaticEnvoy,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  WarAnnouncement,
  WorldNewsEvent,
} from '../../types/game';
import { formatGameDate } from '../simulationEngine';

export interface DomainActionPatch {
  nations?: Record<string, Nation>;
  territories?: Record<string, Territory>;
  relations?: Record<string, DiplomaticRelation>;
  wars?: ActiveWar[];
  movements?: ArmyMovement[];
  newsEvents?: WorldNewsEvent[];
  startEnvoy?: Omit<DiplomaticEnvoy, 'id' | 'startedTick'>;
  warAnnouncement?: WarAnnouncement;
  toast?: string;
}

export const DIPLOMACY_POINT_COSTS: Partial<Record<DiplomaticActionType, number>> = {
  IMPROVE: 5,
  DAMAGE: 5,
  INSULT: 10,
  NON_AGGRESSION: 20,
  MILITARY_ACCESS: 10,
  TRADE: 10,
  DEFENSIVE_PACT: 30,
  OFFENSIVE_PACT: 50,
  EMBARGO: 15,
  DECLARE_WAR: 10,
  ESPIONAGE_SABOTAGE_FORT: 25,
  ESPIONAGE_INCITE_REVOLT: 30,
  ESPIONAGE_SIPHON_TREASURY: 20,
};

export function spendDiplomacyPoints(
  nation: Nation,
  cost: number
): { nation: Nation } | { error: string } {
  const current = nation.diplomacyPoints ?? 100;
  if (current < cost) {
    return {
      error: `Yetersiz diplomasi puanı: ${cost} gerekli, mevcut ${current.toFixed(0)}.`,
    };
  }
  return { nation: { ...nation, diplomacyPoints: current - cost } };
}

export function prependNews(
  newsEvents: WorldNewsEvent[],
  tick: number,
  gameMode: GameModeId,
  title: string,
  description: string,
  type: WorldNewsEvent['type']
): WorldNewsEvent[] {
  return [
    {
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tick,
      dateStr: formatGameDate(tick, gameMode),
      title,
      description,
      type,
    },
    ...newsEvents.slice(0, 39),
  ];
}
