import {
  ActiveWar,
  ArmyMovement,
  CrisisEventDefinition,
  DiplomaticRelation,
  Nation,
  PendingWarMoveRequest,
  SeaArmy,
  SpeedLevel,
  Territory,
  WorldNewsEvent,
} from '../../types/game';

export interface EmpireActionPatch {
  nations?: Record<string, Nation>;
  relations?: Record<string, DiplomaticRelation>;
  territories?: Record<string, Territory>;
  wars?: ActiveWar[];
  movements?: ArmyMovement[];
  seaArmies?: SeaArmy[];
  newsEvents?: WorldNewsEvent[];
  activeCrisis?: CrisisEventDefinition | null;
  armyOrderSourceId?: string | null;
  selectedSeaArmyId?: string | null;
  seaArmyOrderSourceId?: string | null;
  pendingWarMove?: PendingWarMoveRequest | null;
  speed?: SpeedLevel;
  toastMessage?: string;
}
