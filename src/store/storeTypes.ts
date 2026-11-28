import { StateCreator } from 'zustand';
import {
  AiCommanderStance,
  ArmyMovement,
  ActiveBattle,
  ActiveWar,
  BottomDrawerTab,
  BuildingType,
  CampaignTimelapse,
  CrisisEventDefinition,
  CrisisEventOption,
  DiplomaticActionType,
  DiplomaticEnvoy,
  DiplomaticRelation,
  GameModeId,
  GameScreenState,
  IdeologyId,
  IncomingDiplomaticOffer,
  MapMode,
  Nation,
  PeaceDealType,
  PendingWarMoveRequest,
  RecruitFeedbackEvent,
  SeaArmy,
  SpeedLevel,
  SuccessionChoiceOption,
  SuccessionEvent,
  TacticalBattleState,
  Territory,
  UnitType,
  WarAnnouncement,
  WorldNewsEvent,
} from '../types/game';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { SaveSlotId, SaveSlotMetadata, SaveSlotRecord } from '../engine/saveManager';
import { GameSettings } from '../engine/gameSettings';
import {
  BatchRecruitScope,
  BatchRecruitUnitMode,
  SpecialtyProductionId,
} from '../engine/empireAndArmyActions';
import { PeaceConferenceRequest } from '../engine/diplomacyAndWarActions';

export interface GameStoreState {
  screenState: GameScreenState;
  gameMode: GameModeId;
  playerNationId: string;
  features: GeoCountryFeature[];
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles: ActiveBattle[];
  movements: ArmyMovement[];
  seaArmies: SeaArmy[];
  newsEvents: WorldNewsEvent[];
  lastSeenNewsId: string | null;
  tick: number;
  hour: number;
  speed: SpeedLevel;
  worldSeed: number;

  mapMode: MapMode;
  activeTab: BottomDrawerTab;
  selectedTerritoryId: string | null;
  selectedSeaArmyId: string | null;
  armyOrderSourceId: string | null;
  seaArmyOrderSourceId: string | null;
  pendingWarMove: PendingWarMoveRequest | null;
  moveRatio: number;
  aiCommanderEnabled: boolean;
  aiCommanderStance: AiCommanderStance;
  soundEnabled: boolean;
  settings: GameSettings;
  toastMessage: string | null;
  activeCrisis: CrisisEventDefinition | null;
  activeSuccession: SuccessionEvent | null;
  incomingDiplomaticOffer: IncomingDiplomaticOffer | null;
  activeTacticalBattle: TacticalBattleState | null;
  activeBattleOverviewTerritoryId: string | null;
  activeWarModalId: string | null;
  pendingWarDeclarationTargetId: string | null;
  diplomaticEnvoys: DiplomaticEnvoy[];
  activeWarAnnouncement: WarAnnouncement | null;
  recentRecruitFeedback: RecruitFeedbackEvent | null;
  showNewsDrawer: boolean;
  showSystemModal: boolean;
  campaignOutcome: 'VICTORY' | 'DEFEAT' | null;
  dismissedVictoryBanner: boolean;
  timelapse: CampaignTimelapse | null;

  setScreenState: (screen: GameScreenState) => void;
  continueAfterVictory: () => void;
  setSpeed: (speed: SpeedLevel) => void;
  togglePause: () => void;
  setMapMode: (mode: MapMode) => void;
  setActiveTab: (tab: BottomDrawerTab) => void;
  setSelectedTerritoryId: (id: string | null) => void;
  setSelectedSeaArmyId: (id: string | null) => void;
  setArmyOrderSourceId: (id: string | null) => void;
  setSeaArmyOrderSourceId: (id: string | null) => void;
  setPendingWarMove: (req: PendingWarMoveRequest | null) => void;
  confirmPendingWarMove: () => void;
  setMoveRatio: (ratio: number) => void;
  toggleAiCommander: () => void;
  setAiCommanderStance: (stance: AiCommanderStance) => void;
  toggleSound: () => void;
  updateSettings: (partial: Partial<GameSettings>) => void;
  showToast: (msg: string | null) => void;
  setShowNewsDrawer: (open: boolean) => void;
  markNewsAsRead: () => void;
  setShowSystemModal: (open: boolean) => void;
  setActiveBattleOverviewTerritoryId: (id: string | null) => void;
  setActiveWarModalId: (id: string | null) => void;
  openWarDeclarationModal: (targetNationId: string | null) => void;
  confirmWarDeclaration: (targetNationId: string, calledAllyIds: string[]) => void;
  cancelDiplomaticEnvoy: (envoyId: string) => void;
  dismissWarAnnouncement: () => void;
  applyTacticalOrder: (
    territoryId: string,
    tactic: 'TURAN' | 'BOMBARD' | 'RETREAT'
  ) => void;

  selectScenarioMode: (nextMode: GameModeId) => void;
  selectPlayerNation: (nationId: string) => void;
  startNewGame: () => void;
  saveToSlot: (slotId: SaveSlotId) => SaveSlotMetadata | null;
  getLiveTimelapseSnapshot: () => CampaignTimelapse;
  loadRecord: (record: SaveSlotRecord) => void;
  loadMostRecentSave: () => void;
  advanceGameTick: () => void;

  selectTerritory: (territoryId: string) => void;
  selectTerritoryOnMap: (territoryId: string | null) => void;
  resolveCrisis: (option: CrisisEventOption) => void;
  resolveSuccessionChoice: (option: SuccessionChoiceOption) => void;
  triggerManualCabinetDecision: () => void;
  recruitUnit: (
    territoryId: string,
    unitType: UnitType,
    amount: number,
    baseGoldCost: number
  ) => void;
  hireMercenary: (territoryId: string, companyId: string) => void;
  recruitOrAssignGeneral: (generalId: string) => void;
  upgradeBuilding: (territoryId: string, building: BuildingType) => void;
  investSpecialtyProduction: (
    territoryIds: string[],
    specialtyId: SpecialtyProductionId
  ) => void;
  assimilateTerritory: (territoryId: string) => void;
  batchAssimilate: () => void;
  batchStabilityFestival: () => void;
  batchUpgradeBuilding: (
    building: BuildingType,
    territoryIds?: string[]
  ) => void;
  batchBorderMobilization: () => void;
  batchRecruitUnits: (
    scope: BatchRecruitScope,
    unitMode?: BatchRecruitUnitMode,
    territoryId?: string,
    roundsPerCity?: number
  ) => void;
  startMissionary: (territoryId: string) => void;
  formEmpire: (empireId: string) => void;
  executeArmyMove: (fromId: string, toId: string) => void;
  executeEmbarkToSea: (
    targetCoords: [number, number],
    targetSeaArmyId?: string | null
  ) => void;
  executeDisembarkFromSea: (
    sourceSeaArmyId: string,
    toTerritoryId: string
  ) => void;
  disbandSeaArmy: (seaArmyId: string, ratio: 0.5 | 1) => void;
  executeBatchArmyMove: (
    sourceIds: string[],
    toId: string,
    ratioOverride?: number
  ) => void;
  mergeNeighborArmies: (targetTerritoryId: string) => void;
  disbandArmy: (territoryId: string, ratio: 0.5 | 1) => void;
  modernizeNationalArmy: () => void;
  assignFiefLord: (territoryId: string, lordId: string | null) => void;
  bestowFavorOnLord: (lordId: string) => void;
  toggleCallLordToBanner: (lordId: string) => void;
  raidEnemyTradeRoutes: () => void;
  siegeBombardment: (
    territoryId: string,
    method: 'ARTILLERY' | 'DRONE_RAID'
  ) => void;
  launchNuclearStrike: (territoryId: string) => void;
  updateTaxRate: (newRate: number) => void;
  updateBudget: (key: keyof Nation['budget'], value: number) => void;
  centralBankIntervention: () => void;
  issueWarBonds: () => void;
  changeIdeology: (newIdeology: IdeologyId) => void;
  startResearch: (techId: string) => void;
  cancelResearch: () => void;
  boostResearch: () => void;
  toggleAutoResearch: () => void;
  unlockTech: (techId: string) => void;
  enactReform: (reformId: string) => void;
  diplomaticAction: (
    targetNationId: string,
    action: DiplomaticActionType
  ) => void;
  respondToDiplomaticOffer: (accept: boolean) => void;
  offerLandPurchase: (territoryId: string) => void;
  issueProvinceUltimatum: (territoryId: string) => void;
  applyBattleOutcome: (finalBattle: TacticalBattleState) => void;
  peaceDeal: (warId: string, dealType: PeaceDealType) => void;
  callAllyToWar: (warId: string, allyNationId: string) => void;
  resolvePeaceConference: (request: PeaceConferenceRequest) => void;
}

export type GameStoreSlice<T> = StateCreator<GameStoreState, [], [], T>;

export function generateWorldSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff)) >>> 0 || 1337;
}

export function evaluateCampaignOutcome(
  territories: Record<string, Territory>,
  playerNationId: string,
  dismissedVictoryBanner: boolean
): 'VICTORY' | 'DEFEAT' | null {
  const all = Object.values(territories);
  if (all.length === 0) return null;
  let ownedCount = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].ownerId === playerNationId) ownedCount++;
  }
  if (ownedCount === 0) return 'DEFEAT';
  if (!dismissedVictoryBanner && ownedCount >= Math.ceil(all.length * 0.45)) {
    return 'VICTORY';
  }
  return null;
}
