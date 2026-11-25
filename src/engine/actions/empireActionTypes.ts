import {
  ActiveWar,
  ArmyMovement,
  CrisisEventDefinition,
  DiplomaticRelation,
  Nation,
  PendingWarMoveRequest,
  RecruitFeedbackEvent,
  SeaArmy,
  SpeedLevel,
  Territory,
  WarAnnouncement,
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
  recruitFeedback?: RecruitFeedbackEvent;
  warAnnouncement?: WarAnnouncement;
  toastMessage?: string;
}
