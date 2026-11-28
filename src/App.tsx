/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from './store/useGameStore';
import {
  calculateNationEconomy,
  computeNationManpowerCap,
} from './engine/simulationEngine';
import { BatchRecruitUnitMode } from './engine/empireAndArmyActions';
import {
  getMostRecentSaveRecord,
  initSaveStorage,
} from './engine/saveManager';
import { initTimelapseArchiveStorage } from './engine/timelapseArchive';
import { music } from './engine/musicEngine';
import { sound } from './utils/soundEngine';
import { TopHudBar } from './components/hud/TopHudBar';
import { computeWorldPowerRankings } from './engine/worldRankings';
import { countUnreadNewsEvents } from './engine/newsNotifications';
import { AoH3ChronicleLog } from './components/hud/AoH3ChronicleLog';
import { AoH3SelectionChips } from './components/hud/AoH3SelectionChips';
import { DiplomaticOfferBanner } from './components/hud/DiplomaticOfferBanner';
import { MapMacroMode, MapModePillBar } from './components/hud/MapModePillBar';
import { SelectedProvinceBar } from './components/hud/SelectedProvinceBar';
import { SelectedSeaArmyBar } from './components/hud/SelectedSeaArmyBar';
import { BottomNavBar, OfflineStatusBanner } from './components/hud/BottomNavBar';
import { LiveWarHudBadges } from './components/hud/AoH3OutlinerWidget';
import { EnvoyHudOverlay } from './components/hud/EnvoyHudOverlay';
import { ProductionQueueHudWidget } from './components/hud/ProductionQueueHudWidget';
import { WarAnnouncementBanner } from './components/hud/WarAnnouncementBanner';
import { MehterhaneDock } from './components/hud/MehterhaneDock';
import { QuickOnboardingOverlay } from './components/hud/QuickOnboardingOverlay';
import { TitleMenuModal } from './components/TitleMenuModal';
import { WorldMapCanvas } from './components/WorldMapCanvas';
import { TimelapsePlayerOverlay } from './components/hud/TimelapsePlayerOverlay';
import { GameErrorBoundary } from './components/GameErrorBoundary';
import { WarMoveConfirmationModal } from './components/modals/WarMoveConfirmationModal';
import { getClockSpeedProfile } from './engine/gameSettings';
import { useTimelapsePlayback } from './hooks/useTimelapsePlayback';
import { useGameKeyboardShortcuts } from './hooks/useGameKeyboardShortcuts';

const CommandDrawers = lazy(() =>
  import('./components/CommandDrawers').then((m) => ({ default: m.CommandDrawers }))
);
const CrisisAndNewsModal = lazy(() =>
  import('./components/CrisisAndNewsModal').then((m) => ({ default: m.CrisisAndNewsModal }))
);
const SystemAndSaveModal = lazy(() =>
  import('./components/SystemAndSaveModal').then((m) => ({ default: m.SystemAndSaveModal }))
);
const AoH3BattleOverviewModal = lazy(() =>
  import('./components/AoH3BattleOverviewModal').then((m) => ({
    default: m.AoH3BattleOverviewModal,
  }))
);
const UnifiedWarAndPeaceModal = lazy(() =>
  import('./components/AoH3BattleOverviewModal').then((m) => ({
    default: m.UnifiedWarAndPeaceModal,
  }))
);
const CampaignOutcomeModal = lazy(() =>
  import('./components/modals/CampaignOutcomeModal').then((m) => ({
    default: m.CampaignOutcomeModal,
  }))
);
const NationDiplomacyModal = lazy(() =>
  import('./components/modals/NationDiplomacyModal').then((m) => ({
    default: m.NationDiplomacyModal,
  }))
);
const WarDeclarationModal = lazy(() =>
  import('./components/modals/WarDeclarationModal').then((m) => ({
    default: m.WarDeclarationModal,
  }))
);
const SuccessionModal = lazy(() =>
  import('./components/modals/SuccessionModal').then((m) => ({
    default: m.SuccessionModal,
  }))
);
const TimelapseArchiveModal = lazy(() =>
  import('./components/modals/TimelapseArchiveModal').then((m) => ({
    default: m.TimelapseArchiveModal,
  }))
);
import { WorldEventToastStack } from './components/hud/WorldEventToastStack';
import { FullTextTooltipOverlay } from './components/hud/FullTextTooltipOverlay';
import { LoadingSplashScreen } from './components/LoadingSplashScreen';
import { performanceTelemetry } from './utils/performanceTelemetry';

function GameAppInner() {
  const store = useGameStore();
  const {
    screenState,
    gameMode,
    playerNationId,
    features,
    nations,
    territories,
    relations,
    wars,
    battles,
    movements,
    seaArmies,
    newsEvents,
    lastSeenNewsId,
    tick,
    hour,
    speed,
    mapMode,
    activeTab,
    selectedTerritoryId,
    selectedSeaArmyId,
    armyOrderSourceId,
    seaArmyOrderSourceId,
    moveRatio,
    soundEnabled,
    settings,
    toastMessage,
    activeCrisis,
    activeSuccession,
    incomingDiplomaticOffer,
    activeBattleOverviewTerritoryId,
    activeWarModalId,
    pendingWarMove,
    pendingWarDeclarationTargetId,
    diplomaticEnvoys,
    activeWarAnnouncement,
    recentRecruitFeedback,
    showNewsDrawer,
    showSystemModal,
    campaignOutcome,
  } = store;

  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(
    music.isPlaying
  );
  const [idbReadyVersion, setIdbReadyVersion] = useState<number>(0);
  const [openRankingsSignal, setOpenRankingsSignal] = useState<number>(0);
  const [showBootSplash, setShowBootSplash] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') !== '1';
  });
  const [macroMode, setMacroMode] = useState<MapMacroMode>('NONE');
  // AoH3 top-bar `-` / `+` plaque -> imperative zoom command for the world map.
  const [zoomCommand, setZoomCommand] = useState<{
    factor: number;
    seq: number;
  } | null>(null);
  const handleMapZoom = (factor: number) =>
    setZoomCommand((prev) => ({ factor, seq: (prev?.seq ?? 0) + 1 }));
  const [macroRecruitUnitMode, setMacroRecruitUnitMode] =
    useState<BatchRecruitUnitMode>('infantry');
  const [batchMarchSourceIds, setBatchMarchSourceIds] = useState<string[]>([]);
  const [batchMarchTargetPicking, setBatchMarchTargetPicking] = useState<boolean>(false);
  const [batchMarchRatio, setBatchMarchRatio] = useState<number>(1);
  const [focusCapitalSignal, setFocusCapitalSignal] = useState<number>(0);
  const [focusCoordsSignal, setFocusCoordsSignal] = useState<{
    coords: [number, number];
    seq: number;
  } | null>(null);
  const [inspectedNationId, setInspectedNationId] = useState<string | null>(
    null
  );
  const inspectedNationIdRef = useRef<string | null>(null);
  inspectedNationIdRef.current = inspectedNationId;

  const {
    activeTimelapsePlayback,
    isTimelapseActive,
    timelapsePlaying,
    timelapseSpeed,
    showTimelapseArchiveModal,
    setShowTimelapseArchiveModal,
    setTimelapseSpeed,
    startTimelapsePlayback,
    toggleTimelapsePlay,
    restartTimelapsePlayback,
    seekTimelapseFrame,
    closeTimelapsePlayback,
    timelapseBaselineBundle,
    projectedTimelapseState,
  } = useTimelapsePlayback({
    screenState,
    gameMode,
    speed,
    features,
    nations,
    territories,
    setSpeed: store.setSpeed,
    showToast: store.showToast,
    clearInspectedNation: () => setInspectedNationId(null),
  });

  const toggleBatchCity = (territoryId: string) => {
    setBatchMarchSourceIds((prev) =>
      prev.includes(territoryId)
        ? prev.filter((id) => id !== territoryId)
        : [...prev, territoryId]
    );
  };

  const selectReadyBatchCities = () => {
    const ids = Object.values(territories)
      .filter((t) => t.ownerId === playerNationId && t.garrison >= 1500)
      .map((t) => t.id);
    setBatchMarchSourceIds(ids);
  };

  const selectBorderBatchCities = () => {
    const ids = Object.values(territories)
      .filter((t) => {
        if (t.ownerId !== playerNationId || t.garrison < 1500) return false;
        return t.neighbors.some((nId) => {
          const nb = territories[nId];
          return Boolean(nb && nb.ownerId !== playerNationId);
        });
      })
      .map((t) => t.id);
    setBatchMarchSourceIds(ids);
  };

  const multiSelectedIds = useMemo(() => {
    if (macroMode === 'BATCH_MARCH') return batchMarchSourceIds;
    return undefined;
  }, [macroMode, batchMarchSourceIds]);

  const unreadNewsCount = useMemo(
    () => countUnreadNewsEvents(newsEvents, lastSeenNewsId),
    [newsEvents, lastSeenNewsId]
  );

  // Warm up IndexedDB (idb-keyval) save payloads & timelapse archives once on boot
  useEffect(() => {
    Promise.all([initSaveStorage(), initTimelapseArchiveStorage()]).then(() => {
      setIdbReadyVersion((v) => v + 1);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      useGameStore.getState().startNewGame();
    }
  }, []);

  // Sync game state machine to document.body.dataset.state
  useEffect(() => {
    if (screenState === 'TITLE_MENU') {
      document.body.dataset.state = 'title';
    } else if (speed === 0) {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [screenState, speed]);

  useEffect(() => {
    return music.subscribe(() => {
      setIsMusicPlaying(music.isPlaying);
    });
  }, []);

  // Ensure NationDiplomacyModal yields cleanly when WarDeclarationModal opens
  useEffect(() => {
    if (pendingWarDeclarationTargetId) {
      setInspectedNationId(null);
    }
  }, [pendingWarDeclarationTargetId]);

  // Auto-dismiss floating toast banner in ~3.4s (AoH3 brisk notification style)
  useEffect(() => {
    if (!toastMessage) return;
    const durationMs = Math.min(5_200, Math.max(3_200, toastMessage.length * 36));
    const t = setTimeout(() => store.showToast(null), durationMs);
    return () => clearTimeout(t);
  }, [toastMessage, store.showToast]);

  // Automatic Save to IndexedDB at user-configured interval (only once when day tick changes)
  useEffect(() => {
    if (
      screenState === 'PLAYING' &&
      settings.autoSaveIntervalDays > 0 &&
      tick > 0 &&
      tick % settings.autoSaveIntervalDays === 0
    ) {
      store.saveToSlot('AUTOSAVE');
    }
  }, [screenState, tick, settings.autoSaveIntervalDays, store.saveToSlot]);

  useEffect(() => {
    sound.setVolumes(settings.masterVolume, settings.sfxVolume);
    music.setVolumes(settings.masterVolume, settings.musicVolume);
  }, [settings.masterVolume, settings.musicVolume, settings.sfxVolume]);

  useEffect(() => {
    const dynamicEnabled = settings.dynamicWarMusic ?? true;
    music.setDynamicMoodEnabled(dynamicEnabled);
    const playerInWar = wars.some(
      (w) =>
        w.attackers.includes(playerNationId) ||
        w.defenders.includes(playerNationId)
    );
    music.syncCampaignMood({
      isAtWar: playerInWar,
      gameMode,
      screenState,
    });
  }, [screenState, gameMode, wars, playerNationId, settings.dynamicWarMusic]);

  useGameKeyboardShortcuts({
    screenState,
    showSystemModal,
    activeCrisis,
    activeSuccession,
    pendingWarMove,
    pendingWarDeclarationTargetId,
    activeWarModalId,
    inspectedNationId,
    inspectedNationIdRef,
    showNewsDrawer,
    activeBattleOverviewTerritoryId,
    macroMode,
    armyOrderSourceId,
    seaArmyOrderSourceId,
    activeTab,
    selectedTerritoryId,
    selectedSeaArmyId,
    setMacroMode,
    setBatchMarchTargetPicking,
    setFocusCapitalSignal,
    setInspectedNationId,
    togglePause: store.togglePause,
    setSpeed: store.setSpeed,
    setMapMode: store.setMapMode,
    setArmyOrderSourceId: store.setArmyOrderSourceId,
    setSeaArmyOrderSourceId: store.setSeaArmyOrderSourceId,
    setActiveTab: store.setActiveTab,
    selectTerritoryOnMap: store.selectTerritoryOnMap,
    setSelectedSeaArmyId: store.setSelectedSeaArmyId,
  });

  // Atomic Real-Time with Pause Simulation Loop (advances by hours every step!)
  useEffect(() => {
    if (
      screenState !== 'PLAYING' ||
      speed === 0 ||
      activeCrisis ||
      activeSuccession ||
      pendingWarMove
    ) {
      return;
    }

    const { intervalMs } = getClockSpeedProfile(speed);
    if (intervalMs <= 0) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      timerId = setTimeout(() => {
        if (cancelled) return;
        const startedAt = performance.now();
        performanceTelemetry.recordSimulationTick();
        useGameStore.getState().advanceGameTick();
        const elapsed = performance.now() - startedAt;
        // Guarantee at least one animation frame (16ms) of browser headroom at 5x speed
        scheduleNext(Math.max(16, intervalMs - elapsed));
      }, delayMs);
    };

    scheduleNext(intervalMs);

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [screenState, speed, activeCrisis, activeSuccession, pendingWarMove]);



  const mostRecentSaveMeta = useMemo(() => {
    return getMostRecentSaveRecord()?.metadata ?? null;
  }, [screenState, showSystemModal, idbReadyVersion, showBootSplash]);
  const hasSavedGame = Boolean(mostRecentSaveMeta);

  const playerNation = nations[playerNationId] || Object.values(nations)[0];

  const playerEconomy = useMemo(
    () =>
      calculateNationEconomy(
        playerNation,
        territories,
        nations,
        relations,
        movements,
        wars,
        gameMode,
        seaArmies
      ),
    [playerNation, territories, nations, relations, movements, wars, gameMode, seaArmies]
  );

  const playerManpowerCap = useMemo(
    () => computeNationManpowerCap(playerNation, territories),
    [playerNation, territories]
  );

  const playerWorldRank = useMemo(() => {
    const list = computeWorldPowerRankings(
      nations,
      territories,
      movements,
      gameMode,
      'SCORE'
    );
    const idx = list.findIndex((r) => r.nation.id === playerNation.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [nations, territories, movements, gameMode, playerNation.id]);

  const selectedTerritory = selectedTerritoryId
    ? territories[selectedTerritoryId] || null
    : null;

  const selectedSeaArmy = useMemo(
    () =>
      selectedSeaArmyId
        ? seaArmies.find((s) => s.id === selectedSeaArmyId) || null
        : null,
    [seaArmies, selectedSeaArmyId]
  );



  const handleMapSelectTerritory = (terrId: string | null) => {
    if (!terrId) {
      store.selectTerritoryOnMap(null);
      return;
    }
    const terr = territories[terrId];
    if (screenState === 'TITLE_MENU') {
      if (terr && nations[terr.ownerId]) {
        store.selectPlayerNation(terr.ownerId);
        store.selectTerritory(terrId);
      }
      return;
    }
    if (macroMode !== 'NONE' && terr) {
      if (macroMode === 'BATCH_MARCH') {
        if (batchMarchTargetPicking && batchMarchSourceIds.length > 0) {
          const prevMovementsCount = useGameStore.getState().movements.length;
          store.executeBatchArmyMove(
            batchMarchSourceIds,
            terrId,
            batchMarchRatio
          );
          const nextState = useGameStore.getState();
          if (
            nextState.movements.length > prevMovementsCount ||
            Boolean(nextState.pendingWarMove)
          ) {
            setBatchMarchTargetPicking(false);
            setBatchMarchSourceIds([]);
            setMacroMode('NONE');
          }
          return;
        }
        if (terr.ownerId !== playerNationId) {
          store.showToast('Kaynak ordu olarak yalnızca kendi şehirlerinizi seçebilirsiniz.');
          return;
        }
        store.selectTerritoryOnMap(null);
        toggleBatchCity(terrId);
        return;
      }

      if (terr.ownerId !== playerNationId) {
        store.showToast('Makro işlem yalnızca kendi şehirlerimizde kullanılabilir.');
        return;
      }
      if (macroMode === 'RECRUIT_INFANTRY') {
        store.selectTerritoryOnMap(null);
        if (macroRecruitUnitMode === 'MIXED') {
          store.batchRecruitUnits('SINGLE_MAX', 'MIXED', terrId, 1);
        } else if (macroRecruitUnitMode === 'armor') {
          store.recruitUnit(terrId, 'armor', 1000, 440);
        } else if (macroRecruitUnitMode === 'airDrone') {
          store.recruitUnit(terrId, 'airDrone', 1000, 760);
        } else {
          store.recruitUnit(terrId, 'infantry', 1000, 280);
        }
      }
      return;
    }
    store.selectTerritoryOnMap(terrId);
  };

  return (
    <div
      data-ui-scale={settings.uiScale || 'STANDARD'}
      className="relative w-screen h-[100dvh] overflow-hidden bg-[#060B16] select-none flex flex-col"
    >
      {showBootSplash && (
        <LoadingSplashScreen
          features={features}
          nations={nations}
          onComplete={() => {
            setIdbReadyVersion((v) => v + 1);
            setShowBootSplash(false);
          }}
        />
      )}

      {!showBootSplash && !isTimelapseActive && screenState === 'TITLE_MENU' && (
        <TitleMenuModal
          nations={nations}
          territories={territories}
          selectedMode={gameMode}
          selectedNationId={playerNationId}
          hasSavedGame={hasSavedGame}
          mostRecentSaveMeta={mostRecentSaveMeta}
          settings={settings}
          onUpdateSettings={store.updateSettings}
          onSelectMode={store.selectScenarioMode}
          onSelectNation={store.selectPlayerNation}
          onStartNewGame={store.startNewGame}
          onLoadSavedGame={store.loadMostRecentSave}
          onLoadSaveRecord={store.loadRecord}
          onPlayTimelapse={startTimelapsePlayback}
          onShowToast={store.showToast}
        />
      )}

      <Suspense fallback={null}>
        {!isTimelapseActive &&
          screenState === 'VICTORY_SUMMARY' &&
          campaignOutcome &&
          playerNation && (
            <CampaignOutcomeModal
              outcome={campaignOutcome}
              playerNation={playerNation}
              territories={territories}
              tick={tick}
              gameMode={gameMode}
              onContinueAfterVictory={store.continueAfterVictory}
              onRestartCampaign={store.startNewGame}
              onWatchTimelapse={() =>
                startTimelapsePlayback(store.getLiveTimelapseSnapshot())
              }
              onReturnToTitleMenu={() => {
                store.setSpeed(0);
                setInspectedNationId(null);
                setShowTimelapseArchiveModal(false);
                store.setScreenState('TITLE_MENU');
              }}
            />
          )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && (activeCrisis || showNewsDrawer) && (
          <CrisisAndNewsModal
            activeCrisis={activeCrisis}
            onResolveCrisis={store.resolveCrisis}
            showNewsDrawer={showNewsDrawer}
            onCloseNewsDrawer={() => store.setShowNewsDrawer(false)}
            newsEvents={newsEvents}
            gameMode={gameMode}
          />
        )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && activeSuccession && (
          <SuccessionModal
            activeSuccession={activeSuccession}
            playerNation={playerNation}
            playerTreasury={playerNation?.treasury ?? 0}
            gameMode={gameMode}
            onResolveChoice={store.resolveSuccessionChoice}
          />
        )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && showSystemModal && (
          <SystemAndSaveModal
            isOpen={showSystemModal}
            onClose={() => store.setShowSystemModal(false)}
            settings={settings}
            onUpdateSettings={store.updateSettings}
            soundEnabled={soundEnabled}
            onToggleSound={store.toggleSound}
            onReturnToTitleMenu={() => {
              store.setSpeed(0);
              setInspectedNationId(null);
              setShowTimelapseArchiveModal(false);
              store.setScreenState('TITLE_MENU');
            }}
            onSaveToSlot={store.saveToSlot}
            onLoadRecord={store.loadRecord}
            onWatchCurrentTimelapse={() =>
              startTimelapsePlayback(store.getLiveTimelapseSnapshot())
            }
            onOpenTimelapseArchive={() => setShowTimelapseArchiveModal(true)}
            onPlayTimelapse={startTimelapsePlayback}
            onShowToast={store.showToast}
          />
        )}

        {!showBootSplash && !isTimelapseActive && showTimelapseArchiveModal && (
          <TimelapseArchiveModal
            isOpen={showTimelapseArchiveModal}
            onClose={() => setShowTimelapseArchiveModal(false)}
            onPlayTimelapse={startTimelapsePlayback}
            currentCampaignTimelapse={store.getLiveTimelapseSnapshot()}
            currentCampaignHasLiveSession={screenState !== 'TITLE_MENU'}
            onShowToast={store.showToast}
          />
        )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && inspectedNationId && (
          <NationDiplomacyModal
            isOpen={Boolean(inspectedNationId)}
            inspectedNationId={inspectedNationId}
            playerNationId={playerNationId}
            nations={nations}
            territories={territories}
            relations={relations}
            wars={wars}
            movements={movements}
            tick={tick}
            gameMode={gameMode}
            aiCommanderEnabled={store.aiCommanderEnabled}
            aiCommanderStance={store.aiCommanderStance}
            isPlayerAtWar={wars.some(
              (w) =>
                w.attackerId === playerNationId ||
                w.defenderId === playerNationId ||
                w.attackers.includes(playerNationId) ||
                w.defenders.includes(playerNationId)
            )}
            onToggleAiCommander={store.toggleAiCommander}
            onSetAiCommanderStance={store.setAiCommanderStance}
            onClose={() => setInspectedNationId(null)}
            onSelectInspectedNation={(nId) => setInspectedNationId(nId)}
            onSelectTerritory={store.selectTerritory}
            onSetActiveTab={store.setActiveTab}
            onDiplomaticAction={store.diplomaticAction}
            onPeaceDeal={store.peaceDeal}
            onOpenWarModal={(warId) => store.setActiveWarModalId(warId)}
            seaArmies={seaArmies}
          />
        )}

        {!showBootSplash &&
          !isTimelapseActive &&
          screenState !== 'TITLE_MENU' &&
          activeWarModalId &&
          wars.some((w) => w.id === activeWarModalId) && (
            <UnifiedWarAndPeaceModal
              key={activeWarModalId}
              war={wars.find((w) => w.id === activeWarModalId)!}
              playerWars={wars.filter(
                (w) =>
                  w.attackerId === playerNationId ||
                  w.defenderId === playerNationId ||
                  w.attackers.includes(playerNationId) ||
                  w.defenders.includes(playerNationId)
              )}
              playerNationId={playerNationId}
              nations={nations}
              territories={territories}
              relations={relations}
              movements={movements}
              tick={tick}
              onSelectWar={(warId) => store.setActiveWarModalId(warId)}
              onClose={() => store.setActiveWarModalId(null)}
              onCallAllyToWar={store.callAllyToWar}
              onResolvePeaceConference={store.resolvePeaceConference}
            />
          )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && pendingWarDeclarationTargetId && (
          <WarDeclarationModal
            targetNationId={pendingWarDeclarationTargetId}
            playerNationId={playerNationId}
            nations={nations}
            territories={territories}
            relations={relations}
            wars={wars}
            tick={tick}
            onClose={() => store.openWarDeclarationModal(null)}
            onConfirmWar={store.confirmWarDeclaration}
            onQuickAction={store.diplomaticAction}
          />
        )}
      </Suspense>

      {!showBootSplash && !isTimelapseActive && screenState === 'PLAYING' && (
        <WarAnnouncementBanner
          announcement={activeWarAnnouncement}
          playerNationId={playerNationId}
          nations={nations}
          onDismiss={store.dismissWarAnnouncement}
        />
      )}

      {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && (
        <WarMoveConfirmationModal
          pendingWarMove={pendingWarMove}
          nations={nations}
          territories={territories}
          seaArmies={seaArmies}
          hidden={isTimelapseActive}
          onConfirmWarMove={store.confirmPendingWarMove}
          onRequestMilitaryAccess={store.diplomaticAction}
          onDismiss={() => store.setPendingWarMove(null)}
        />
      )}

      {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && (
        <TopHudBar
          playerNation={playerNation}
          playerEconomy={playerEconomy}
          playerManpowerCap={playerManpowerCap}
          recentRecruitFeedback={recentRecruitFeedback}
          activeTab={activeTab}
          tick={tick}
          hour={hour}
          speed={speed}
          gameMode={gameMode}
          newsCount={unreadNewsCount}
          isMusicPlaying={isMusicPlaying}
          onSetActiveTab={store.setActiveTab}
          onSetSpeed={store.setSpeed}
          onTogglePause={store.togglePause}
          onOpenSystemModal={() => store.setShowSystemModal(true)}
          onOpenNewsDrawer={() => store.setShowNewsDrawer(true)}
          onFocusCapital={() => setFocusCapitalSignal((v) => v + 1)}
          onInspectNation={(nId) => setInspectedNationId(nId)}
          playerWorldRank={playerWorldRank}
          onOpenWorldRankings={() => {
            setOpenRankingsSignal((v) => v + 1);
            store.setActiveTab('MILITARY');
          }}
          showZoomControls={settings.showZoomControls}
          onZoomIn={() => handleMapZoom(1.3)}
          onZoomOut={() => handleMapZoom(0.77)}
        />
      )}

      <div className="relative flex-1 w-full overflow-hidden">
        {!showBootSplash &&
          (isTimelapseActive && projectedTimelapseState && timelapseBaselineBundle && activeTimelapsePlayback ? (
            <WorldMapCanvas
              features={timelapseBaselineBundle.features}
              territories={projectedTimelapseState.territories}
              nations={projectedTimelapseState.nations}
              relations={{}}
              wars={[]}
              battles={[]}
              movements={[]}
              seaArmies={[]}
              playerNationId={activeTimelapsePlayback.timelapse.playerNationId}
              selectedTerritoryId={null}
              selectedSeaArmyId={null}
              armyOrderSourceId={null}
              seaArmyOrderSourceId={null}
              mapMode="POLITICAL"
              mapLabelDensity={settings.mapLabelDensity}
              zoomCommand={zoomCommand}
              fogOfWarEnabled={false}
              graphicsQuality={settings.graphicsQuality}
              smoothArmyAnimations={false}
              borderThickness={settings.borderThickness}
              mapLabelScale={settings.mapLabelScale}
              speed={0}
              tick={projectedTimelapseState.frame.tick}
              gameMode={activeTimelapsePlayback.timelapse.gameMode}
              focusCapitalSignal={focusCapitalSignal}
              focusCoordsSignal={focusCoordsSignal}
              showMinimap={false}
              timelapseMode={true}
              onSelectTerritory={() => {}}
              onExecuteArmyMove={() => {}}
              onCancelArmyOrder={() => {}}
            />
          ) : (
            <WorldMapCanvas
              features={features}
              territories={territories}
              nations={nations}
              relations={relations}
              wars={wars}
              battles={battles}
              movements={movements}
              seaArmies={seaArmies}
              playerNationId={playerNationId}
              selectedTerritoryId={selectedTerritoryId}
              selectedSeaArmyId={selectedSeaArmyId}
              multiSelectedTerritoryIds={multiSelectedIds}
              armyOrderSourceId={armyOrderSourceId}
              seaArmyOrderSourceId={seaArmyOrderSourceId}
              mapMode={mapMode}
              mapLabelDensity={settings.mapLabelDensity}
              zoomCommand={zoomCommand}
              fogOfWarEnabled={settings.fogOfWarEnabled}
              graphicsQuality={settings.graphicsQuality}
              smoothArmyAnimations={settings.smoothArmyAnimations}
              borderThickness={settings.borderThickness}
              mapLabelScale={settings.mapLabelScale}
              speed={speed}
              tick={tick}
              gameMode={gameMode}
              focusCapitalSignal={focusCapitalSignal}
              focusCoordsSignal={focusCoordsSignal}
              onSetMapMode={store.setMapMode}
              showMinimap={screenState !== 'TITLE_MENU'}
              minimapTopSlot={
                screenState !== 'TITLE_MENU' ? (
                  <>
                    <AoH3ChronicleLog
                      newsEvents={newsEvents}
                      unreadCount={unreadNewsCount}
                      onOpenNewsFeed={() => store.setShowNewsDrawer(true)}
                      hidden={activeTab !== 'NONE'}
                    />
                    <WorldEventToastStack
                      newsEvents={newsEvents}
                      toastMessage={toastMessage}
                      isDrawerOpen={activeTab !== 'NONE'}
                      onDismissToast={() => store.showToast(null)}
                      onOpenNewsFeed={() => store.setShowNewsDrawer(true)}
                    />
                  </>
                ) : null
              }
              onSelectTerritory={handleMapSelectTerritory}
              onSelectSeaArmy={(id) => store.setSelectedSeaArmyId(id)}
              onExecuteArmyMove={store.executeArmyMove}
              onEmbarkToSea={store.executeEmbarkToSea}
              onDisembarkFromSea={store.executeDisembarkFromSea}
              onCancelArmyOrder={() => {
                store.setArmyOrderSourceId(null);
                store.setSeaArmyOrderSourceId(null);
              }}
            />
          ))}

        {isTimelapseActive && projectedTimelapseState && activeTimelapsePlayback && (
          <TimelapsePlayerOverlay
            timelapse={activeTimelapsePlayback.timelapse}
            title={activeTimelapsePlayback.title}
            frameIndex={projectedTimelapseState.frameIndex}
            currentFrame={projectedTimelapseState.frame}
            latestMilestone={projectedTimelapseState.latestMilestone}
            activeMilestones={projectedTimelapseState.activeMilestones}
            isPlaying={timelapsePlaying}
            playbackSpeed={timelapseSpeed}
            exitLabel={
              activeTimelapsePlayback.source === 'TITLE_MENU'
                ? 'Ana Menüye Dön'
                : 'Oyuna Dön'
            }
            onTogglePlay={toggleTimelapsePlay}
            onRestart={restartTimelapsePlayback}
            onSetSpeed={setTimelapseSpeed}
            onSeekFrame={seekTimelapseFrame}
            onClose={closeTimelapsePlayback}
          />
        )}

        {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && (
          <>
            <EnvoyHudOverlay
              envoys={diplomaticEnvoys}
              playerNationId={playerNationId}
              nations={nations}
              relations={relations}
              hasActiveToast={false}
              hidden={Boolean(
                screenState !== 'PLAYING' ||
                  activeTab !== 'NONE' ||
                  activeCrisis ||
                  activeSuccession ||
                  showSystemModal ||
                  activeWarModalId ||
                  inspectedNationId ||
                  pendingWarMove ||
                  pendingWarDeclarationTargetId
              )}
              onCancelEnvoy={store.cancelDiplomaticEnvoy}
              onInspectNation={(nId) => setInspectedNationId(nId)}
            />

            <DiplomaticOfferBanner
              offer={incomingDiplomaticOffer}
              nations={nations}
              territories={territories}
              tick={tick}
              hidden={Boolean(
                screenState !== 'PLAYING' ||
                  activeTab !== 'NONE' ||
                  activeCrisis ||
                  activeSuccession ||
                  showSystemModal ||
                  activeWarModalId ||
                  inspectedNationId ||
                  pendingWarMove ||
                  pendingWarDeclarationTargetId
              )}
              onRespond={store.respondToDiplomaticOffer}
            />

            <MapModePillBar
          mapMode={mapMode}
          macroMode={macroMode}
          macroRecruitUnitMode={macroRecruitUnitMode}
          toastMessage={toastMessage}
          batchMarchSourceIds={batchMarchSourceIds}
          batchMarchTargetPicking={batchMarchTargetPicking}
          batchMarchRatio={batchMarchRatio}
          territories={territories}
          hasBottomCard={Boolean(
            (selectedTerritory || selectedSeaArmy) &&
              activeTab === 'NONE' &&
              macroMode === 'NONE'
          )}
          hideWhenDrawerOpen={activeTab !== 'NONE'}
          selectionChipsSlot={
            screenState === 'PLAYING' && multiSelectedIds && multiSelectedIds.length > 0 ? (
              <AoH3SelectionChips
                territoryIds={multiSelectedIds}
                territories={territories}
                nations={nations}
                playerNationId={playerNationId}
                label="SEVK"
                onRemove={(id) => toggleBatchCity(id)}
                onClear={() => setBatchMarchSourceIds([])}
              />
            ) : null
          }
          belowTraySlot={
            screenState === 'PLAYING' ? (
              <div className="flex flex-col items-start gap-1.5 pointer-events-none max-w-full">
                <LiveWarHudBadges
                  playerNationId={playerNationId}
                  nations={nations}
                  territories={territories}
                  wars={wars}
                  onSetActiveTab={store.setActiveTab}
                  onOpenWarModal={(warId) => store.setActiveWarModalId(warId)}
                />
                <ProductionQueueHudWidget
                  playerNationId={playerNationId}
                  territories={territories}
                  gameMode={gameMode}
                  onSelectTerritory={(id) => {
                    store.selectTerritoryOnMap(id);
                  }}
                />
              </div>
            ) : null
          }
          onSetMapMode={store.setMapMode}
          onSetMacroMode={(nextMode) => {
            setMacroMode(nextMode);
            if (nextMode !== 'BATCH_MARCH') {
              setBatchMarchTargetPicking(false);
            }
            if (nextMode !== 'NONE') {
              if (
                nextMode === 'BATCH_MARCH' &&
                batchMarchSourceIds.length === 0 &&
                selectedTerritory &&
                selectedTerritory.ownerId === playerNationId
              ) {
                setBatchMarchSourceIds([selectedTerritory.id]);
              }
              store.selectTerritoryOnMap(null);
            }
          }}
          onSetMacroRecruitUnitMode={setMacroRecruitUnitMode}
          onBatchRecruitUnits={store.batchRecruitUnits}
          onToggleBatchCity={toggleBatchCity}
          onSelectReadyBatchCities={selectReadyBatchCities}
          onSelectBorderBatchCities={selectBorderBatchCities}
          onClearBatchCities={() => {
            setBatchMarchSourceIds([]);
            setBatchMarchTargetPicking(false);
          }}
          onSetBatchTargetPicking={setBatchMarchTargetPicking}
          onSetBatchMarchRatio={setBatchMarchRatio}
          onDismissToast={() => store.showToast(null)}
        />

        {selectedTerritory && activeTab === 'NONE' && macroMode === 'NONE' && (
          <SelectedProvinceBar
            territory={selectedTerritory}
            playerNationId={playerNationId}
            nations={nations}
            territories={territories}
            relations={relations}
            wars={wars}
            battles={battles}
            tick={tick}
            gameMode={gameMode}
            fogOfWarEnabled={settings.fogOfWarEnabled}
            armyOrderSourceId={armyOrderSourceId}
            moveRatio={moveRatio}
            onSetMoveRatio={store.setMoveRatio}
            onStartArmyOrder={store.setArmyOrderSourceId}
            onQuickRecruitInfantry={(tId) =>
              store.recruitUnit(tId, 'infantry', 1000, 280)
            }
            onRecruitUnit={store.recruitUnit}
            onBatchRecruitUnits={store.batchRecruitUnits}
            onAssimilateTerritory={store.assimilateTerritory}
            onMergeArmies={store.mergeNeighborArmies}
            onDisbandArmy={store.disbandArmy}
            onLaunchNuclearStrike={store.launchNuclearStrike}
            onSelectTerritory={store.selectTerritory}
            onOpenFullDrawer={() => store.setActiveTab('TERRITORY')}
            onInspectNation={(nId) => setInspectedNationId(nId)}
            onOpenBattleOverview={() =>
              store.setActiveBattleOverviewTerritoryId(selectedTerritory.id)
            }
            onClear={() => store.selectTerritoryOnMap(null)}
          />
        )}

        {!selectedTerritory &&
          selectedSeaArmy &&
          activeTab === 'NONE' &&
          macroMode === 'NONE' && (
            <SelectedSeaArmyBar
              seaArmy={selectedSeaArmy}
              playerNationId={playerNationId}
              nations={nations}
              gameMode={gameMode}
              seaArmyOrderSourceId={seaArmyOrderSourceId}
              moveRatio={moveRatio}
              onSetMoveRatio={store.setMoveRatio}
              onStartSeaArmyOrder={store.setSeaArmyOrderSourceId}
              onDisbandSeaArmy={store.disbandSeaArmy}
              onClear={() => store.setSelectedSeaArmyId(null)}
            />
          )}

        <Suspense fallback={null}>
          {activeBattleOverviewTerritoryId &&
            territories[activeBattleOverviewTerritoryId] && (
              <AoH3BattleOverviewModal
                battle={battles.find(
                  (b) => b.territoryId === activeBattleOverviewTerritoryId
                )}
                siege={territories[activeBattleOverviewTerritoryId]?.siege}
                territory={territories[activeBattleOverviewTerritoryId]}
                playerNationId={playerNationId}
                nations={nations}
                tick={tick}
                gameMode={gameMode}
                onClose={() => store.setActiveBattleOverviewTerritoryId(null)}
                onApplyTacticalOrder={(tactic) =>
                  store.applyTacticalOrder(activeBattleOverviewTerritoryId, tactic)
                }
              />
            )}

          {activeTab !== 'NONE' && (
            <CommandDrawers
              activeTab={activeTab}
              onClose={() => store.setActiveTab('NONE')}
              openRankingsSignal={openRankingsSignal}
              playerNation={playerNation}
              playerEconomy={playerEconomy}
              selectedTerritory={selectedTerritory}
              territories={territories}
              nations={nations}
              relations={relations}
              wars={wars}
              battles={battles}
              movements={movements}
              seaArmies={seaArmies}
              selectedSeaArmyId={selectedSeaArmyId}
              aiCommanderEnabled={store.aiCommanderEnabled}
              aiCommanderStance={store.aiCommanderStance}
              moveRatio={moveRatio}
              onSetMoveRatio={store.setMoveRatio}
              onStartArmyOrderMode={store.setArmyOrderSourceId}
              onSelectSeaArmy={(id) => {
                store.setSelectedSeaArmyId(id);
                const fleet = seaArmies.find((s) => s.id === id);
                if (fleet) {
                  setFocusCoordsSignal((prev) => ({
                    coords: fleet.coords,
                    seq: (prev?.seq ?? 0) + 1,
                  }));
                }
              }}
              onStartSeaArmyOrder={(id) => {
                store.setSelectedSeaArmyId(id);
                store.setSeaArmyOrderSourceId(id);
                const fleet = seaArmies.find((s) => s.id === id);
                if (fleet) {
                  setFocusCoordsSignal((prev) => ({
                    coords: fleet.coords,
                    seq: (prev?.seq ?? 0) + 1,
                  }));
                }
              }}
              onStartBatchMarch={() => {
                setMacroMode('BATCH_MARCH');
                setBatchMarchTargetPicking(false);
                if (
                  batchMarchSourceIds.length === 0 &&
                  selectedTerritory &&
                  selectedTerritory.ownerId === playerNationId
                ) {
                  setBatchMarchSourceIds([selectedTerritory.id]);
                }
                store.selectTerritoryOnMap(null);
              }}
              onToggleAiCommander={store.toggleAiCommander}
              onSetAiCommanderStance={store.setAiCommanderStance}
              onExecuteArmyMove={store.executeArmyMove}
              onRecruitUnit={store.recruitUnit}
              onBatchRecruitUnits={store.batchRecruitUnits}
              onHireMercenary={store.hireMercenary}
              onRecruitOrAssignGeneral={store.recruitOrAssignGeneral}
              onUpgradeBuilding={store.upgradeBuilding}
              onInvestSpecialtyProduction={store.investSpecialtyProduction}
              onAssimilateTerritory={store.assimilateTerritory}
              onBatchAssimilate={store.batchAssimilate}
              onBatchStabilityFestival={store.batchStabilityFestival}
              onBatchUpgradeBuilding={store.batchUpgradeBuilding}
              onBatchBorderMobilization={store.batchBorderMobilization}
              onStartMissionary={store.startMissionary}
              onFormEmpire={store.formEmpire}
              onUpdateTaxRate={store.updateTaxRate}
              onUpdateBudget={store.updateBudget}
              onCentralBankIntervention={store.centralBankIntervention}
              onIssueWarBonds={store.issueWarBonds}
              onChangeIdeology={store.changeIdeology}
              onStartResearch={store.startResearch}
              onCancelResearch={store.cancelResearch}
              onBoostResearch={store.boostResearch}
              onToggleAutoResearch={store.toggleAutoResearch}
              onUnlockTech={store.unlockTech}
              onEnactReform={store.enactReform}
              onDiplomaticAction={store.diplomaticAction}
              onOfferLandPurchase={store.offerLandPurchase}
              onIssueProvinceUltimatum={store.issueProvinceUltimatum}
              onPeaceDeal={store.peaceDeal}
              onSelectTerritory={store.selectTerritory}
              onInspectNation={(nId) => setInspectedNationId(nId)}
              onOpenWarModal={(warId) => store.setActiveWarModalId(warId)}
              onCallAllyToWar={store.callAllyToWar}
              fogOfWarEnabled={settings.fogOfWarEnabled}
              onModernizeNationalArmy={store.modernizeNationalArmy}
              onAssignFiefLord={store.assignFiefLord}
              onBestowFavorOnLord={store.bestowFavorOnLord}
              onToggleCallLordToBanner={store.toggleCallLordToBanner}
              onRaidEnemyTradeRoutes={store.raidEnemyTradeRoutes}
              onSiegeBombardment={store.siegeBombardment}
              onLaunchNuclearStrike={store.launchNuclearStrike}
              tick={tick}
              gameMode={gameMode}
            />
          )}
          </Suspense>
          </>
        )}
      </div>

      {!showBootSplash && !isTimelapseActive && screenState !== 'TITLE_MENU' && (
        <>
          <MehterhaneDock
            hideCompactOnMobile={Boolean(
              activeTab !== 'NONE' ||
                (selectedTerritory && activeTab === 'NONE' && macroMode === 'NONE') ||
                macroMode !== 'NONE'
            )}
            dynamicWarMusic={settings.dynamicWarMusic ?? true}
            onToggleDynamicWarMusic={() => {
              const next = !(settings.dynamicWarMusic ?? true);
              store.updateSettings({ dynamicWarMusic: next });
            }}
          />

          <QuickOnboardingOverlay
            visible={
              screenState === 'PLAYING' &&
              activeTab === 'NONE' &&
              macroMode === 'NONE' &&
              !selectedTerritory &&
              !showSystemModal &&
              !activeCrisis &&
              !activeSuccession &&
              !pendingWarMove
            }
          />

          <OfflineStatusBanner
            liftAboveBottomCard={Boolean(
              selectedTerritory && activeTab === 'NONE' && macroMode === 'NONE'
            )}
          />

          <BottomNavBar
            activeTab={activeTab}
            activeWarCount={wars.length}
            onSetActiveTab={store.setActiveTab}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameErrorBoundary>
      <GameAppInner />
      <FullTextTooltipOverlay />
    </GameErrorBoundary>
  );
}
