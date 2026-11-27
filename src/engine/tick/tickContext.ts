import {
  ActiveBattle,
  ActiveWar,
  AiCommanderStance,
  ArmyMovement,
  CrisisEventDefinition,
  DiplomaticEnvoy,
  DiplomaticRelation,
  GameModeId,
  IncomingDiplomaticOffer,
  Nation,
  SeaArmy,
  SpeedLevel,
  TacticalBattleState,
  Territory,
  UnitComposition,
  WarAnnouncement,
  WorldNewsEvent,
} from '../../types/game';
import {
  CRISIS_EVENTS,
  getNationModernizedTier,
} from '../../data/world2026Data';
import {
  formatGameDate,
  getOrCreateRelation,
  isAtWar,
} from '../simulationEngine';
import { GameSettings } from '../gameSettings';

export type TickSoundCue =
  | 'SELECT_TERRITORY'
  | 'MARCH'
  | 'TREATY'
  | 'WAR_HORN';

export interface GameTickInput {
  tick: number;
  hour?: number;
  hoursStep?: number;
  speed: SpeedLevel;
  gameMode: GameModeId;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies?: SeaArmy[];
  newsEvents: WorldNewsEvent[];
  settings: GameSettings;
  aiCommanderEnabled?: boolean;
  aiCommanderStance?: AiCommanderStance;
  activeIncomingOffer?: IncomingDiplomaticOffer | null;
  diplomaticEnvoys?: DiplomaticEnvoy[];
  worldSeed?: number;
}

export interface GameTickOutput {
  nextTick: number;
  nextHour: number;
  dayWrapped: boolean;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  newsEvents: WorldNewsEvent[];
  triggeredTacticalBattle: TacticalBattleState | null;
  triggeredCrisis: CrisisEventDefinition | null;
  incomingDiplomaticOffer?: IncomingDiplomaticOffer | null;
  clearIncomingOffer?: boolean;
  diplomaticEnvoys?: DiplomaticEnvoy[];
  warAnnouncements?: WarAnnouncement[];
  shouldPause: boolean;
  toasts: string[];
  sounds: TickSoundCue[];
}

export function computeUnitWeightedPower(
  units: UnitComposition | undefined,
  totalTroops: number,
  nation: Nation | undefined
): number {
  const inf = units?.infantry ?? totalTroops;
  const arm = units?.armor ?? 0;
  const air = units?.airDrone ?? 0;
  const sumUnits = inf + arm + air;
  const baseWeighted =
    sumUnits > 0
      ? inf * 1.0 + arm * 1.45 + air * 1.65
      : Math.max(100, totalTroops);
  const scaleFactor = sumUnits > 0 ? totalTroops / sumUnits : 1;
  const tierBonus = 1 + getNationModernizedTier(nation) * 0.12;
  return Math.max(100, baseWeighted * scaleFactor * tierBonus);
}

/**
 * Checks whether a conquered territory is the core homeland of an active ally / war co-belligerent
 * fighting on the same side as `conquerorId` against `previousOwnerId`.
 * If so, returns that ally's nationId so the liberated land immediately returns to the ally's color!
 */
export function findAlliedLiberationBeneficiary(params: {
  target: Territory;
  conquerorId: string;
  previousOwnerId: string;
  wars: ActiveWar[];
  relations: Record<string, DiplomaticRelation>;
  nations: Record<string, Nation>;
}): string | null {
  const { target, conquerorId, previousOwnerId, wars, relations, nations } = params;
  const coreId = target.coreOwnerId;
  if (!coreId || coreId === conquerorId || coreId === previousOwnerId) return null;
  if (!nations[coreId]) return null;
  if (isAtWar(wars, conquerorId, coreId)) return null;

  const sameWarSide = wars.some(
    (w) =>
      (w.attackers.includes(conquerorId) &&
        w.attackers.includes(coreId) &&
        w.defenders.includes(previousOwnerId)) ||
      (w.defenders.includes(conquerorId) &&
        w.defenders.includes(coreId) &&
        w.attackers.includes(previousOwnerId))
  );
  if (sameWarSide) return coreId;

  const rel = getOrCreateRelation(relations, conquerorId, coreId);
  const coreNat = nations[coreId];
  const conqNat = nations[conquerorId];
  if (
    rel.isAllied ||
    Boolean(rel.allianceType) ||
    coreNat?.vassalOf === conquerorId ||
    conqNat?.vassalOf === coreId
  ) {
    return coreId;
  }

  return null;
}

export function pickEligibleCrisisEvent(
  gameMode: GameModeId
): CrisisEventDefinition {
  const is1440 = gameMode === 'EMPIRES_1440';
  const isHistoricalId = (id: string) =>
    id.startsWith('crisis_1440_') ||
    id.startsWith('crisis_yeniceri') ||
    id.startsWith('crisis_silk_road') ||
    id.startsWith('crisis_sahi') ||
    id.startsWith('crisis_timar');

  const eligibleEvents = CRISIS_EVENTS.filter((ev) =>
    is1440 ? isHistoricalId(ev.id) : !isHistoricalId(ev.id)
  );
  const pool = eligibleEvents.length > 0 ? eligibleEvents : CRISIS_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface TickContext {
  readonly input: GameTickInput;
  readonly isSubDayMode: boolean;
  readonly hoursStep: number;
  readonly prevHour: number;
  readonly nextHour: number;
  readonly dayWrapped: boolean;
  readonly nextTick: number;
  readonly gameMode: GameModeId;
  readonly playerNationId: string;
  readonly relations: Record<string, DiplomaticRelation>;
  readonly settings: GameSettings;

  nationsCloned: boolean;
  territoriesCloned: boolean;
  nextNations: Record<string, Nation>;
  nextTerritories: Record<string, Territory>;
  nextRelations: Record<string, DiplomaticRelation>;
  nextWars: ActiveWar[];
  nextMovements: ArmyMovement[];
  nextSeaArmies: SeaArmy[];
  nextNewsEvents: WorldNewsEvent[];
  nextBattles: ActiveBattle[];
  nextEnvoys: DiplomaticEnvoy[] | undefined;

  readonly warAnnouncements: WarAnnouncement[];
  readonly toasts: string[];
  readonly sounds: TickSoundCue[];
  readonly triggeredTacticalBattle: TacticalBattleState | null;
  triggeredCrisis: CrisisEventDefinition | null;
  incomingDiplomaticOffer: IncomingDiplomaticOffer | null | undefined;
  clearIncomingOffer: boolean;
  shouldPause: boolean;

  writeNation(id: string, nat: Nation): void;
  writeTerritory(id: string, terr: Territory): void;
  appendNews(
    title: string,
    description: string,
    type: WorldNewsEvent['type']
  ): void;
  applyTerritoryCaptureOrLiberation(args: {
    target: Territory;
    conquerorId: string;
    survivors: number;
    survivingUnits: UnitComposition;
    originTerritoryId?: string;
    unrestSpike: number;
    wallHp?: number;
    clearSiege?: boolean;
  }): { liberatedAllyId: string | null; returnProvName: string | null };
  returnAttackerTroopsHome(args: {
    attackerId: string;
    troops: number;
    units: UnitComposition | undefined;
    fromTerritoryId?: string;
  }): void;
}

export function createTickContext(input: GameTickInput): TickContext {
  const isSubDayMode =
    typeof input.hoursStep === 'number' && input.hoursStep < 24;
  const hoursStep = input.hoursStep ?? 24;
  const prevHour = input.hour ?? 8;
  const totalHours = prevHour + hoursStep;
  const dayWrapped = !isSubDayMode || totalHours >= 24;
  const nextHour = isSubDayMode ? ((totalHours % 24) + 24) % 24 : prevHour;
  const nextTick = dayWrapped ? input.tick + 1 : input.tick;

  const ctx: TickContext = {
    input,
    isSubDayMode,
    hoursStep,
    prevHour,
    nextHour,
    dayWrapped,
    nextTick,
    gameMode: input.gameMode,
    playerNationId: input.playerNationId,
    relations: input.relations,
    settings: input.settings,

    nationsCloned: false,
    territoriesCloned: false,
    nextNations: input.nations,
    nextTerritories: input.territories,
    nextRelations: input.relations,
    nextWars: input.wars,
    nextMovements: [],
    nextSeaArmies: input.seaArmies ? [...input.seaArmies] : [],
    nextNewsEvents: input.newsEvents,
    nextBattles: [...input.battles],
    nextEnvoys: input.diplomaticEnvoys ? [...input.diplomaticEnvoys] : undefined,

    warAnnouncements: [],
    toasts: [],
    sounds: [],
    triggeredTacticalBattle: null,
    triggeredCrisis: null,
    incomingDiplomaticOffer: undefined,
    clearIncomingOffer: false,
    shouldPause: false,

    writeNation(id: string, nat: Nation) {
      if (!ctx.nationsCloned) {
        ctx.nextNations = { ...ctx.nextNations };
        ctx.nationsCloned = true;
      }
      ctx.nextNations[id] = nat;
    },

    writeTerritory(id: string, terr: Territory) {
      if (!ctx.territoriesCloned) {
        ctx.nextTerritories = { ...ctx.nextTerritories };
        ctx.territoriesCloned = true;
      }
      ctx.nextTerritories[id] = terr;
    },

    appendNews(
      title: string,
      description: string,
      type: WorldNewsEvent['type']
    ) {
      ctx.nextNewsEvents = [
        {
          id: `news_${ctx.nextTick}_${Math.random().toString(36).slice(2, 8)}`,
          tick: ctx.nextTick,
          dateStr: formatGameDate(ctx.nextTick, ctx.gameMode),
          title,
          description,
          type,
        },
        ...ctx.nextNewsEvents.slice(0, 39),
      ];
    },

    applyTerritoryCaptureOrLiberation(args) {
      const {
        target,
        conquerorId,
        survivors,
        survivingUnits,
        originTerritoryId,
        unrestSpike,
        wallHp,
        clearSiege,
      } = args;

      const previousOwnerId = target.ownerId;
      const liberatedAllyId = findAlliedLiberationBeneficiary({
        target,
        conquerorId,
        previousOwnerId,
        wars: ctx.nextWars,
        relations: ctx.nextRelations,
        nations: ctx.nextNations,
      });

      if (liberatedAllyId) {
        const allyNation = ctx.nextNations[liberatedAllyId];
        const localMilitia = Math.max(
          600,
          Math.min(1500, Math.round(survivors * 0.15))
        );
        const wasEliminated = Boolean(allyNation?.isEliminated);

        ctx.writeTerritory(target.id, {
          ...target,
          ownerId: liberatedAllyId,
          isCapital: wasEliminated ? true : target.isCapital,
          garrison: localMilitia,
          units: { infantry: localMilitia, armor: 0, airDrone: 0 },
          unrest: Math.max(0, target.unrest - 15),
          assimilation: 100,
          isAssimilating: false,
          isOccupied: false,
          occupiedById: undefined,
          ...(typeof wallHp === 'number' ? { castleWallHp: wallHp } : {}),
          ...(clearSiege ? { siege: null } : {}),
        });

        if (allyNation && wasEliminated) {
          ctx.writeNation(liberatedAllyId, {
            ...allyNation,
            isEliminated: false,
            capitalTerritoryId: target.id,
          });
        }

        // Return conqueror's surviving army intact to origin, adjacent friendly province, or capital
        const originTerr = originTerritoryId
          ? ctx.nextTerritories[originTerritoryId]
          : undefined;
        const adjacentOwned = target.neighbors
          .map((nId) => ctx.nextTerritories[nId])
          .find((t) => t && t.ownerId === conquerorId);
        const conqNation = ctx.nextNations[conquerorId];
        const capTerr = conqNation?.capitalTerritoryId
          ? ctx.nextTerritories[conqNation.capitalTerritoryId]
          : undefined;
        const fallbackOwned =
          (originTerr && originTerr.ownerId === conquerorId && originTerr) ||
          adjacentOwned ||
          (capTerr && capTerr.ownerId === conquerorId && capTerr) ||
          Object.values(ctx.nextTerritories).find(
            (t) => t && t.ownerId === conquerorId
          );

        if (fallbackOwned) {
          ctx.writeTerritory(fallbackOwned.id, {
            ...fallbackOwned,
            garrison: fallbackOwned.garrison + survivors,
            units: {
              infantry:
                (fallbackOwned.units?.infantry || 0) +
                (survivingUnits.infantry || 0),
              armor:
                (fallbackOwned.units?.armor || 0) + (survivingUnits.armor || 0),
              airDrone:
                (fallbackOwned.units?.airDrone || 0) +
                (survivingUnits.airDrone || 0),
            },
          });
        }

        return {
          liberatedAllyId,
          returnProvName: fallbackOwned?.name || null,
        };
      }

      const isCoreForConqueror = target.coreOwnerId === conquerorId;
      ctx.writeTerritory(target.id, {
        ...target,
        ownerId: conquerorId,
        isCapital: false,
        garrison: survivors,
        units: survivingUnits,
        unrest: isCoreForConqueror
          ? Math.max(0, target.unrest - 10)
          : Math.min(80, target.unrest + unrestSpike),
        assimilation: isCoreForConqueror ? 100 : 25,
        isAssimilating: false,
        isOccupied: !isCoreForConqueror,
        occupiedById: isCoreForConqueror ? undefined : conquerorId,
        ...(typeof wallHp === 'number' ? { castleWallHp: wallHp } : {}),
        ...(clearSiege ? { siege: null } : {}),
      });

      return { liberatedAllyId: null, returnProvName: null };
    },

    returnAttackerTroopsHome(args) {
      const { attackerId, troops, units, fromTerritoryId } = args;
      if (troops <= 0) return;
      const attackerNation = ctx.nextNations[attackerId];
      if (!attackerNation) return;

      const returnProv =
        (fromTerritoryId &&
          ctx.nextTerritories[fromTerritoryId]?.ownerId === attackerId &&
          ctx.nextTerritories[fromTerritoryId]) ||
        ctx.nextTerritories[attackerNation.capitalTerritoryId] ||
        Object.values(ctx.nextTerritories).find((t) => t.ownerId === attackerId);

      if (!returnProv) return;
      const prevU = returnProv.units || {
        infantry: returnProv.garrison,
        armor: 0,
        airDrone: 0,
      };
      const retU = units || {
        infantry: troops,
        armor: 0,
        airDrone: 0,
      };
      ctx.writeTerritory(returnProv.id, {
        ...returnProv,
        garrison: returnProv.garrison + troops,
        units: {
          infantry: prevU.infantry + (retU.infantry || 0),
          armor: prevU.armor + (retU.armor || 0),
          airDrone: prevU.airDrone + (retU.airDrone || 0),
        },
      });
    },
  };

  return ctx;
}

export function finalizeTickOutput(ctx: TickContext): GameTickOutput {
  return {
    nextTick: ctx.nextTick,
    nextHour: ctx.nextHour,
    dayWrapped: ctx.dayWrapped,
    nations: ctx.nextNations,
    territories: ctx.nextTerritories,
    relations: ctx.nextRelations,
    wars: ctx.nextWars,
    battles: ctx.nextBattles,
    movements: ctx.nextMovements,
    seaArmies: ctx.nextSeaArmies,
    newsEvents: ctx.nextNewsEvents,
    triggeredTacticalBattle: ctx.triggeredTacticalBattle,
    triggeredCrisis: ctx.triggeredCrisis,
    ...(ctx.incomingDiplomaticOffer !== undefined
      ? { incomingDiplomaticOffer: ctx.incomingDiplomaticOffer }
      : {}),
    ...(ctx.clearIncomingOffer ? { clearIncomingOffer: ctx.clearIncomingOffer } : {}),
    ...(ctx.nextEnvoys !== undefined ? { diplomaticEnvoys: ctx.nextEnvoys } : {}),
    ...(ctx.warAnnouncements.length > 0
      ? { warAnnouncements: ctx.warAnnouncements }
      : {}),
    shouldPause: ctx.shouldPause,
    toasts: ctx.toasts,
    sounds: ctx.sounds,
  };
}
