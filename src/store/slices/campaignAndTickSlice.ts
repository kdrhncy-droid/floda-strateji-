import {
  BottomDrawerTab,
  DiplomaticRelation,
  GameScreenState,
  Nation,
  SpeedLevel,
} from '../../types/game';
import { getCommandersForMode } from '../../data/world2026Data';
import { initializeWorld2026 } from '../../engine/worldBuilder';
import { formatGameDate } from '../../engine/simulationEngine';
import { DEFAULT_LORD_LOYALTY } from '../../engine/pashaAndFiefEngine';
import {
  getMostRecentSaveRecord,
  hydrateSavedPayload,
  saveGameToSlot,
} from '../../engine/saveManager';
import { loadGameSettings, saveGameSettings } from '../../engine/gameSettings';
import { computeGameTick } from '../../engine/tickEngine';
import { getClockSpeedProfile } from '../../engine/gameSettings';
import { pickNextAutoResearchTech } from '../../engine/empireAndArmyActions';
import { seededHash } from '../../engine/aiAndRebellionEngine';
import { music } from '../../engine/musicEngine';
import { ensureAllNationsHaveRulers } from '../../engine/dynastyAndSuccessionEngine';
import {
  buildLivePlaybackTimelapse,
  createInitialTimelapse,
  recordTimelapseProgress,
} from '../../engine/timelapseEngine';
import { sound } from '../../utils/soundEngine';
import {
  evaluateCampaignOutcome,
  GameStoreSlice,
  GameStoreState,
  generateWorldSeed,
} from '../storeTypes';

const initialBundle = initializeWorld2026('EMPIRES_1440');

type CampaignAndTickSliceKeys =
  | 'screenState'
  | 'gameMode'
  | 'playerNationId'
  | 'features'
  | 'nations'
  | 'territories'
  | 'relations'
  | 'wars'
  | 'worldSeed'
  | 'battles'
  | 'movements'
  | 'seaArmies'
  | 'newsEvents'
  | 'tick'
  | 'hour'
  | 'speed'
  | 'mapMode'
  | 'activeTab'
  | 'selectedTerritoryId'
  | 'selectedSeaArmyId'
  | 'armyOrderSourceId'
  | 'seaArmyOrderSourceId'
  | 'moveRatio'
  | 'soundEnabled'
  | 'settings'
  | 'toastMessage'
  | 'activeBattleOverviewTerritoryId'
  | 'activeWarModalId'
  | 'showNewsDrawer'
  | 'showSystemModal'
  | 'campaignOutcome'
  | 'dismissedVictoryBanner'
  | 'timelapse'
  | 'setScreenState'
  | 'continueAfterVictory'
  | 'setSpeed'
  | 'togglePause'
  | 'setMapMode'
  | 'setActiveTab'
  | 'setSelectedTerritoryId'
  | 'setSelectedSeaArmyId'
  | 'setArmyOrderSourceId'
  | 'setSeaArmyOrderSourceId'
  | 'setMoveRatio'
  | 'toggleSound'
  | 'updateSettings'
  | 'showToast'
  | 'setShowNewsDrawer'
  | 'setShowSystemModal'
  | 'setActiveBattleOverviewTerritoryId'
  | 'setActiveWarModalId'
  | 'selectScenarioMode'
  | 'selectPlayerNation'
  | 'startNewGame'
  | 'getLiveTimelapseSnapshot'
  | 'saveToSlot'
  | 'loadRecord'
  | 'loadMostRecentSave'
  | 'advanceGameTick'
  | 'selectTerritory'
  | 'selectTerritoryOnMap';

export const createCampaignAndTickSlice: GameStoreSlice<
  Pick<GameStoreState, CampaignAndTickSliceKeys>
> = (set, get) => ({
  screenState: 'TITLE_MENU',
  gameMode: 'EMPIRES_1440',
  playerNationId: '792',
  features: initialBundle.features,
  nations: initialBundle.nations,
  territories: initialBundle.territories,
  relations: initialBundle.relations,
  wars: [],
  worldSeed: generateWorldSeed(),
  battles: [],
  movements: [],
  seaArmies: [],
  newsEvents: [],
  tick: 0,
  hour: 8,
  speed: 0,

  mapMode: 'POLITICAL',
  activeTab: 'NONE',
  selectedTerritoryId: '792',
  selectedSeaArmyId: null,
  armyOrderSourceId: null,
  seaArmyOrderSourceId: null,
  moveRatio: 1,
  soundEnabled: true,
  settings: loadGameSettings(),
  toastMessage: null,
  activeBattleOverviewTerritoryId: null,
  activeWarModalId: null,
  showNewsDrawer: false,
  showSystemModal: false,
  campaignOutcome: null,
  dismissedVictoryBanner: false,
  timelapse: null,

  setScreenState: (screenState) => set({ screenState }),
  continueAfterVictory: () =>
    set({
      dismissedVictoryBanner: true,
      campaignOutcome: null,
      screenState: 'PLAYING',
    }),
  setSpeed: (speed) => set({ speed }),
  togglePause: () =>
    set((s) => ({ speed: (s.speed === 0 ? 1 : 0) as SpeedLevel })),
  setMapMode: (mapMode) => set({ mapMode }),
  setActiveTab: (activeTab) =>
    set((s) => {
      if (activeTab === 'TERRITORY' && !s.selectedTerritoryId) {
        const capId =
          s.nations[s.playerNationId]?.capitalTerritoryId || s.playerNationId;
        return { activeTab, selectedTerritoryId: capId };
      }
      return { activeTab };
    }),
  setSelectedTerritoryId: (selectedTerritoryId) =>
    set({
      selectedTerritoryId,
      ...(selectedTerritoryId ? { selectedSeaArmyId: null } : {}),
    }),
  setSelectedSeaArmyId: (selectedSeaArmyId) =>
    set({
      selectedSeaArmyId,
      ...(selectedSeaArmyId
        ? {
            selectedTerritoryId: null,
            armyOrderSourceId: null,
            activeTab: 'NONE' as BottomDrawerTab,
          }
        : { seaArmyOrderSourceId: null }),
    }),
  setArmyOrderSourceId: (armyOrderSourceId) =>
    set({
      armyOrderSourceId,
      ...(armyOrderSourceId ? { seaArmyOrderSourceId: null } : {}),
    }),
  setSeaArmyOrderSourceId: (seaArmyOrderSourceId) =>
    set({
      seaArmyOrderSourceId,
      ...(seaArmyOrderSourceId ? { armyOrderSourceId: null } : {}),
    }),
  setMoveRatio: (moveRatio) => set({ moveRatio }),
  toggleSound: () =>
    set((s) => {
      const next = !s.soundEnabled;
      sound.enabled = next;
      return { soundEnabled: next };
    }),
  updateSettings: (partial) =>
    set((s) => {
      const next = { ...s.settings, ...partial };
      saveGameSettings(next);
      return { settings: next };
    }),
  showToast: (toastMessage) => set({ toastMessage }),
  setShowNewsDrawer: (showNewsDrawer) => set({ showNewsDrawer }),
  setShowSystemModal: (showSystemModal) => set({ showSystemModal }),
  setActiveBattleOverviewTerritoryId: (activeBattleOverviewTerritoryId) =>
    set({ activeBattleOverviewTerritoryId }),
  setActiveWarModalId: (activeWarModalId) => set({ activeWarModalId }),

  selectScenarioMode: (nextMode) => {
    const bundle = initializeWorld2026(nextMode);
    const { playerNationId } = get();
    const nextNationId = bundle.nations[playerNationId] ? playerNationId : '792';
    set({
      gameMode: nextMode,
      features: bundle.features,
      nations: bundle.nations,
      territories: bundle.territories,
      relations: bundle.relations,
      playerNationId: nextNationId,
      selectedTerritoryId: nextNationId,
      seaArmies: [],
      selectedSeaArmyId: null,
      seaArmyOrderSourceId: null,
      campaignOutcome: null,
      dismissedVictoryBanner: false,
    });
  },

  selectPlayerNation: (nationId) =>
    set({ playerNationId: nationId, selectedTerritoryId: nationId }),

  startNewGame: () => {
    const { gameMode, playerNationId, soundEnabled } = get();
    const bundle = initializeWorld2026(gameMode);
    const freshSeed = generateWorldSeed();
    const validPlayerId = bundle.nations[playerNationId] ? playerNationId : '792';
    const starterCmds = getCommandersForMode(gameMode)
      .slice(0, 2)
      .map((c) => c.id);
    const currentPlayerNation = bundle.nations[validPlayerId];
    const finalGeneralIds =
      currentPlayerNation.recruitedGeneralIds &&
      currentPlayerNation.recruitedGeneralIds.length > 0
        ? currentPlayerNation.recruitedGeneralIds
        : starterCmds;
    const starterLoyalties: Record<string, number> = {};
    finalGeneralIds.forEach((gId) => {
      starterLoyalties[gId] = DEFAULT_LORD_LOYALTY + 4;
    });

    const starterTech = pickNextAutoResearchTech(currentPlayerNation, gameMode);
    const starterActiveResearch = starterTech
      ? {
          techId: starterTech.id,
          progress: 0,
          totalCost: starterTech.cost,
          startedTick: 0,
        }
      : null;

    const nextNations: Record<string, Nation> = {
      ...bundle.nations,
      [validPlayerId]: {
        ...currentPlayerNation,
        recruitedGeneralIds: finalGeneralIds,
        activeGeneralId:
          currentPlayerNation.activeGeneralId || finalGeneralIds[0] || null,
        lordLoyalties: starterLoyalties,
        autoResearch: true,
        activeResearch: starterActiveResearch,
        researchProgressByTech: starterTech
          ? {
              ...(currentPlayerNation.researchProgressByTech ?? {}),
              [starterTech.id]: 0,
            }
          : currentPlayerNation.researchProgressByTech,
      },
    };

    const seededRelations: Record<string, DiplomaticRelation> = {};
    for (const [rKey, rel] of Object.entries(bundle.relations)) {
      if (rel.isAllied || rel.allianceType || rel.score <= -75) {
        seededRelations[rKey] = rel;
      } else {
        const delta = Math.round(
          (seededHash(freshSeed, `init_rel_${rKey}`) - 0.5) * 20
        );
        seededRelations[rKey] = {
          ...rel,
          score: Math.max(-85, Math.min(85, rel.score + delta)),
        };
      }
    }

    if (soundEnabled && !music.isPlaying) {
      music.setTrack(
        gameMode === 'EMPIRES_1440'
          ? 'OSS_WESNOTH_LOYALISTS'
          : 'OSS_WESNOTH_KINGDOM'
      );
      music.play();
    }

    set({
      features: bundle.features,
      nations: nextNations,
      territories: bundle.territories,
      relations: seededRelations,
      playerNationId: validPlayerId,
      worldSeed: freshSeed,
      wars: [],
      battles: [],
      movements: [],
      seaArmies: [],
      tick: 0,
      hour: 8,
      speed: 1,
      selectedTerritoryId: null,
      selectedSeaArmyId: null,
      armyOrderSourceId: null,
      seaArmyOrderSourceId: null,
      pendingWarMove: null,
      moveRatio: 1,
      aiCommanderEnabled: false,
      activeTab: 'NONE',
      activeCrisis: null,
      activeSuccession: null,
      incomingDiplomaticOffer: null,
      activeTacticalBattle: null,
      pendingWarDeclarationTargetId: null,
      diplomaticEnvoys: [],
      activeWarAnnouncement: null,
      recentRecruitFeedback: null,
      campaignOutcome: null,
      dismissedVictoryBanner: false,
      timelapse: createInitialTimelapse({
        gameMode,
        playerNationId: validPlayerId,
        nations: nextNations,
        territories: bundle.territories,
        tick: 0,
      }),
      screenState: 'PLAYING',
      newsEvents: [
        {
          id: 'init_1',
          tick: 0,
          dateStr: formatGameDate(0, gameMode, 8),
          title: `${nextNations[validPlayerId]?.name} Yönetimi Başladı`,
          description:
            gameMode === 'EMPIRES_1440'
              ? '1440 İmparatorluklar Çağı senaryosu aktif (16 Büyük İmparatorluk, Teknolojiye Dayalı Ordu Modernizasyonu ve Tımar Paşaları).'
              : 'Çoklu eyalet strateji haritası, Teknolojiye Dayalı Ordu Modernizasyonu ve Sancak Komutanları aktif.',
          type: 'ECONOMY',
        },
      ],
    });
  },

  getLiveTimelapseSnapshot: () => {
    const s = get();
    return buildLivePlaybackTimelapse(s.timelapse, {
      tick: s.tick,
      gameMode: s.gameMode,
      playerNationId: s.playerNationId,
      nations: s.nations,
      territories: s.territories,
      newsEvents: s.newsEvents,
    });
  },

  saveToSlot: (slotId) => {
    const s = get();
    const embeddedTimelapse = buildLivePlaybackTimelapse(s.timelapse, {
      tick: s.tick,
      gameMode: s.gameMode,
      playerNationId: s.playerNationId,
      nations: s.nations,
      territories: s.territories,
      newsEvents: s.newsEvents,
    });
    return saveGameToSlot(slotId, {
      gameMode: s.gameMode,
      playerNationId: s.playerNationId,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      battles: s.battles,
      movements: s.movements,
      seaArmies: s.seaArmies,
      diplomaticEnvoys: s.diplomaticEnvoys,
      newsEvents: s.newsEvents,
      tick: s.tick,
      hour: s.hour,
      worldSeed: s.worldSeed,
      timelapse: embeddedTimelapse,
    });
  },

  loadRecord: (record) => {
    const targetMode = record.payload.gameMode || 'EMPIRES_1440';
    const modeBundle = initializeWorld2026(targetMode);
    const hydrated = hydrateSavedPayload(
      record.payload,
      modeBundle.nations,
      modeBundle.territories
    );
    const playerCapId = hydrated.nations[hydrated.playerNationId]?.capitalTerritoryId;
    const validSelectedTerritoryId =
      playerCapId && hydrated.territories[playerCapId]
        ? playerCapId
        : Object.values(hydrated.territories).find(
            (t) => t.ownerId === hydrated.playerNationId
          )?.id ?? null;

    const hydratedNationsWithRulers = ensureAllNationsHaveRulers(
      hydrated.nations,
      hydrated.gameMode,
      hydrated.tick,
      hydrated.worldSeed ?? 1440
    );

    set({
      features: modeBundle.features,
      gameMode: hydrated.gameMode,
      playerNationId: hydrated.playerNationId,
      nations: hydratedNationsWithRulers,
      territories: hydrated.territories,
      relations: hydrated.relations,
      wars: hydrated.wars,
      battles: hydrated.battles,
      movements: hydrated.movements,
      seaArmies: hydrated.seaArmies || [],
      diplomaticEnvoys: hydrated.diplomaticEnvoys || [],
      newsEvents: hydrated.newsEvents,
      tick: hydrated.tick,
      hour: hydrated.hour ?? 8,
      worldSeed: hydrated.worldSeed ?? generateWorldSeed(),
      selectedTerritoryId: validSelectedTerritoryId,
      selectedSeaArmyId: null,
      armyOrderSourceId: null,
      seaArmyOrderSourceId: null,
      pendingWarMove: null,
      pendingWarDeclarationTargetId: null,
      activeWarAnnouncement: null,
      recentRecruitFeedback: null,
      activeCrisis: null,
      activeSuccession: null,
      activeTacticalBattle: null,
      activeWarModalId: null,
      moveRatio: 1,
      aiCommanderEnabled: false,
      activeTab: 'NONE',
      incomingDiplomaticOffer: null,
      speed: 0,
      campaignOutcome: null,
      dismissedVictoryBanner: false,
      timelapse:
        hydrated.timelapse ||
        createInitialTimelapse({
          gameMode: hydrated.gameMode,
          playerNationId: hydrated.playerNationId,
          nations: hydratedNationsWithRulers,
          territories: hydrated.territories,
          tick: hydrated.tick,
        }),
      screenState: 'PLAYING',
      toastMessage: `${record.metadata.nationName} (${record.metadata.gameDateStr}) kaydı yüklendi.`,
    });
  },

  loadMostRecentSave: () => {
    const latest = getMostRecentSaveRecord();
    if (!latest) {
      set({ toastMessage: 'Kayıtlı sefer bulunamadı.' });
      return;
    }
    get().loadRecord(latest);
  },

  advanceGameTick: () => {
    const s = get();
    if (
      s.screenState !== 'PLAYING' ||
      s.speed === 0 ||
      s.activeCrisis ||
      s.activeSuccession ||
      s.activeTacticalBattle ||
      s.pendingWarMove
    ) {
      return;
    }

    const { hoursStep } = getClockSpeedProfile(s.speed);
    if (hoursStep <= 0) return;

    const out = computeGameTick({
      tick: s.tick,
      hour: s.hour,
      hoursStep,
      speed: s.speed,
      gameMode: s.gameMode,
      playerNationId: s.playerNationId,
      nations: s.nations,
      territories: s.territories,
      relations: s.relations,
      wars: s.wars,
      battles: s.battles,
      movements: s.movements,
      seaArmies: s.seaArmies,
      newsEvents: s.newsEvents,
      settings: s.settings,
      aiCommanderEnabled: s.aiCommanderEnabled,
      aiCommanderStance: s.aiCommanderStance,
      activeIncomingOffer: s.incomingDiplomaticOffer,
      diplomaticEnvoys: s.diplomaticEnvoys,
      worldSeed: s.worldSeed,
    });

    sound.playTickCues(out.sounds, s.speed);

    const outcome = evaluateCampaignOutcome(
      out.territories,
      s.playerNationId,
      s.dismissedVictoryBanner
    );

    const stillSelectedSea =
      s.selectedSeaArmyId &&
      out.seaArmies.some((sa) => sa.id === s.selectedSeaArmyId)
        ? s.selectedSeaArmyId
        : null;

    const nextTimelapse = out.dayWrapped
      ? recordTimelapseProgress(s.timelapse, {
          nextTick: out.nextTick,
          gameMode: s.gameMode,
          playerNationId: s.playerNationId,
          nations: out.nations,
          territories: out.territories,
          newsEvents: out.newsEvents,
        })
      : s.timelapse;

    set({
      tick: out.nextTick,
      hour: out.nextHour,
      nations: out.nations,
      territories: out.territories,
      relations: out.relations,
      wars: out.wars,
      battles: out.battles,
      movements: out.movements,
      seaArmies: out.seaArmies,
      selectedSeaArmyId: stillSelectedSea,
      newsEvents: out.newsEvents,
      timelapse: nextTimelapse,
      ...(out.diplomaticEnvoys !== undefined
        ? { diplomaticEnvoys: out.diplomaticEnvoys }
        : {}),
      ...(out.warAnnouncements && out.warAnnouncements.length > 0
        ? { activeWarAnnouncement: out.warAnnouncements[0] }
        : {}),
      ...(out.shouldPause || outcome ? { speed: 0 as SpeedLevel } : {}),
      ...(outcome
        ? {
            campaignOutcome: outcome,
            screenState: 'VICTORY_SUMMARY' as GameScreenState,
          }
        : {}),
      ...(out.triggeredTacticalBattle
        ? { activeTacticalBattle: out.triggeredTacticalBattle }
        : {}),
      ...(out.triggeredCrisis ? { activeCrisis: out.triggeredCrisis } : {}),
      ...(out.triggeredSuccession
        ? { activeSuccession: out.triggeredSuccession }
        : {}),
      ...(out.incomingDiplomaticOffer !== undefined
        ? { incomingDiplomaticOffer: out.incomingDiplomaticOffer }
        : out.clearIncomingOffer
        ? { incomingDiplomaticOffer: null }
        : {}),
      ...(out.toasts.length > 0
        ? { toastMessage: out.toasts[out.toasts.length - 1] }
        : {}),
    });
  },

  selectTerritory: (territoryId) => {
    sound.playSelectTerritory();
    set({
      selectedTerritoryId: territoryId,
      selectedSeaArmyId: null,
      seaArmyOrderSourceId: null,
      activeTab: 'TERRITORY',
    });
  },

  selectTerritoryOnMap: (territoryId) => {
    if (!territoryId) {
      set({
        selectedTerritoryId: null,
        selectedSeaArmyId: null,
        armyOrderSourceId: null,
        seaArmyOrderSourceId: null,
        activeTab: 'NONE',
      });
      return;
    }
    sound.playSelectTerritory();
    set({
      selectedTerritoryId: territoryId,
      selectedSeaArmyId: null,
      seaArmyOrderSourceId: null,
      activeTab: 'NONE',
    });
  },
});
