/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Compass, ShieldAlert, Swords, X } from 'lucide-react';
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
import { music } from './engine/musicEngine';
import { sound } from './utils/soundEngine';
import { TopHudBar } from './components/hud/TopHudBar';
import { AoH3ChronicleLog } from './components/hud/AoH3ChronicleLog';
import { AoH3SelectionChips } from './components/hud/AoH3SelectionChips';
import { DiplomaticOfferBanner } from './components/hud/DiplomaticOfferBanner';
import { MapMacroMode, MapModePillBar } from './components/hud/MapModePillBar';
import { SelectedProvinceBar } from './components/hud/SelectedProvinceBar';
import { SelectedSeaArmyBar } from './components/hud/SelectedSeaArmyBar';
import { BottomNavBar, OfflineStatusBanner } from './components/hud/BottomNavBar';
import {
  AoH3OutlinerWidget,
  LiveWarHudBadges,
} from './components/hud/AoH3OutlinerWidget';
import { MehterhaneDock } from './components/hud/MehterhaneDock';
import { QuickOnboardingOverlay } from './components/hud/QuickOnboardingOverlay';
import { TitleMenuModal } from './components/TitleMenuModal';
import { WorldMapCanvas } from './components/WorldMapCanvas';
import { CommandDrawers } from './components/CommandDrawers';
import { CrisisAndNewsModal } from './components/CrisisAndNewsModal';
import { SystemAndSaveModal } from './components/SystemAndSaveModal';
import {
  AoH3BattleOverviewModal,
  UnifiedWarAndPeaceModal,
} from './components/AoH3BattleOverviewModal';
import { CampaignOutcomeModal } from './components/modals/CampaignOutcomeModal';
import { NationDiplomacyModal } from './components/modals/NationDiplomacyModal';
import { getClockSpeedProfile } from './engine/gameSettings';
import { WorldEventToastStack } from './components/hud/WorldEventToastStack';
import { FullTextTooltipOverlay } from './components/hud/FullTextTooltipOverlay';
import { LoadingSplashScreen } from './components/LoadingSplashScreen';
import { NationFlagCanvasBadge } from './map/nationFlagRenderer';
import { cleanNationName, cleanProvinceName } from './utils/formatters';
import { performanceTelemetry } from './utils/performanceTelemetry';
import { useAccessibleDialog } from './hooks/useAccessibleDialog';

class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMsg: error instanceof Error ? error.message : 'Bilinmeyen çalışma zamanı hatası',
    };
  }

  handleRecover = () => {
    try {
      const st = useGameStore.getState();
      st.setSpeed(0);
      st.setActiveTab('NONE');
      st.setPendingWarMove(null);
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMsg: '' });
  };

  handleResetToMenu = () => {
    try {
      const st = useGameStore.getState();
      st.setSpeed(0);
      st.startNewGame();
      st.setScreenState('TITLE_MENU');
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMsg: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
              <div>
                <h2 className="font-display font-bold text-base text-white">
                  Oyun Oturumu Koruma Kalkanı
                </h2>
                <p className="text-xs text-slate-400">
                  Sefer sırasında beklenmeyen bir veri uyuşmazlığı yakalandı ve otomatik duraklatıldı.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-rose-300 break-words">
              {this.state.errorMsg}
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Seferi Onar ve Devam Et
              </button>
              <button
                onClick={this.handleResetToMenu}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Ana Menüye Dön
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    incomingDiplomaticOffer,
    activeBattleOverviewTerritoryId,
    activeWarModalId,
    pendingWarMove,
    showNewsDrawer,
    showSystemModal,
    campaignOutcome,
  } = store;

  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(
    music.isPlaying
  );
  const [idbReadyVersion, setIdbReadyVersion] = useState<number>(0);
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
  const [economySelectedIds, setEconomySelectedIds] = useState<string[]>([]);
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
  const historyGuardPushedRef = useRef<boolean>(false);

  const toggleEconomyCity = (territoryId: string) => {
    setEconomySelectedIds((prev) =>
      prev.includes(territoryId)
        ? prev.filter((id) => id !== territoryId)
        : [...prev, territoryId]
    );
  };

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
    if (macroMode === 'BUILD_ECONOMY') return economySelectedIds;
    if (macroMode === 'BATCH_MARCH') return batchMarchSourceIds;
    return undefined;
  }, [macroMode, economySelectedIds, batchMarchSourceIds]);

  // Warm up IndexedDB (idb-keyval) save payloads & migrate legacy localStorage slots once on boot
  useEffect(() => {
    initSaveStorage().then(() => {
      setIdbReadyVersion((v) => v + 1);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      useGameStore.getState().startNewGame();
    }
  }, []);

  // Dünya Gazetesi lifecycle: a fresh headline pops the chronicle open and it
  // folds itself away again after a short read window, so the bottom-right
  // corner does not stay buried under the minimap for a whole campaign.
  const latestNewsId = newsEvents[0]?.id ?? null;
  const [chronicleOpen, setChronicleOpen] = useState(true);
  useEffect(() => {
    if (!latestNewsId) return;
    setChronicleOpen(true);
    const closeTimer = window.setTimeout(() => setChronicleOpen(false), 15000);
    return () => window.clearTimeout(closeTimer);
  }, [latestNewsId]);

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

  // Smart Keyboard Shortcuts (Space, 1-4, H/Home, Q/W/E/R/T, M, B, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screenState !== 'PLAYING') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      const hasBlockingModal = Boolean(
        showSystemModal ||
          activeCrisis ||
          pendingWarMove ||
          activeWarModalId ||
          inspectedNationId ||
          showNewsDrawer ||
          activeBattleOverviewTerritoryId
      );

      if (e.code === 'Space') {
        if (
          hasBlockingModal ||
          target?.closest('button, a[href], [role="button"], [role="link"], [role="checkbox"], [role="switch"]')
        ) {
          return;
        }
        e.preventDefault();
        store.togglePause();
        return;
      }

      if (hasBlockingModal) return;

      if (e.key === 'Escape') {
        if (macroMode !== 'NONE') {
          e.preventDefault();
          setMacroMode('NONE');
          setBatchMarchTargetPicking(false);
          return;
        }
        if (armyOrderSourceId || seaArmyOrderSourceId) {
          e.preventDefault();
          store.setArmyOrderSourceId(null);
          store.setSeaArmyOrderSourceId(null);
          return;
        }
        if (activeTab !== 'NONE') {
          e.preventDefault();
          store.setActiveTab('NONE');
          return;
        }
        if (selectedTerritoryId || selectedSeaArmyId) {
          e.preventDefault();
          store.selectTerritoryOnMap(null);
          store.setSelectedSeaArmyId(null);
          return;
        }
        return;
      }

      if (e.key === '1' || e.code === 'Digit1') {
        e.preventDefault();
        sound.playClick();
        store.setSpeed(1);
        return;
      }
      if (e.key === '2' || e.code === 'Digit2') {
        e.preventDefault();
        sound.playClick();
        store.setSpeed(2);
        return;
      }
      if (e.key === '3' || e.code === 'Digit3') {
        e.preventDefault();
        sound.playClick();
        store.setSpeed(3);
        return;
      }
      if (e.key === '4' || e.code === 'Digit4') {
        e.preventDefault();
        sound.playClick();
        store.setSpeed(4);
        return;
      }
      if (e.key === '5' || e.code === 'Digit5') {
        e.preventDefault();
        sound.playClick();
        store.setSpeed(5);
        return;
      }

      if (e.code === 'KeyH' || e.key === 'Home') {
        e.preventDefault();
        sound.playClick();
        setFocusCapitalSignal((v) => v + 1);
        return;
      }

      if (e.code === 'KeyQ') {
        e.preventDefault();
        sound.playClick();
        store.setMapMode('POLITICAL');
        return;
      }
      if (e.code === 'KeyW') {
        e.preventDefault();
        sound.playClick();
        store.setMapMode('ECONOMIC');
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        sound.playClick();
        store.setMapMode('RESOURCES');
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        sound.playClick();
        store.setMapMode('DIPLOMATIC');
        return;
      }
      if (e.code === 'KeyT') {
        e.preventDefault();
        sound.playClick();
        store.setMapMode('TERRAIN');
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        if (armyOrderSourceId) {
          sound.playClick();
          store.setArmyOrderSourceId(null);
          return;
        }
        const st = useGameStore.getState();
        const sel = st.selectedTerritoryId
          ? st.territories[st.selectedTerritoryId]
          : null;
        if (sel && sel.ownerId === st.playerNationId) {
          sound.playClick();
          st.setActiveTab('NONE');
          st.setArmyOrderSourceId(sel.id);
        }
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        sound.playClick();
        if (macroMode !== 'NONE') {
          setMacroMode('NONE');
          setBatchMarchTargetPicking(false);
        } else {
          const st = useGameStore.getState();
          const sel = st.selectedTerritoryId
            ? st.territories[st.selectedTerritoryId]
            : null;
          if (
            economySelectedIds.length === 0 &&
            sel &&
            sel.ownerId === st.playerNationId
          ) {
            setEconomySelectedIds([sel.id]);
          }
          st.setActiveTab('NONE');
          st.selectTerritoryOnMap(null);
          setMacroMode('BUILD_ECONOMY');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screenState,
    showSystemModal,
    activeCrisis,
    pendingWarMove,
    activeWarModalId,
    inspectedNationId,
    showNewsDrawer,
    activeBattleOverviewTerritoryId,
    macroMode,
    armyOrderSourceId,
    seaArmyOrderSourceId,
    activeTab,
    selectedTerritoryId,
    selectedSeaArmyId,
    economySelectedIds.length,
    store.togglePause,
    store.setSpeed,
    store.setMapMode,
    store.setArmyOrderSourceId,
    store.setSeaArmyOrderSourceId,
    store.setActiveTab,
    store.selectTerritoryOnMap,
    store.setSelectedSeaArmyId,
  ]);

  // Android hardware back button / browser back: close topmost drawer/modal instead of exiting PWA
  const hasDismissibleOverlay =
    screenState === 'PLAYING' &&
    (Boolean(pendingWarMove) ||
      Boolean(activeWarModalId) ||
      Boolean(inspectedNationId) ||
      showSystemModal ||
      showNewsDrawer ||
      Boolean(activeBattleOverviewTerritoryId) ||
      activeTab !== 'NONE' ||
      Boolean(selectedTerritoryId));

  useEffect(() => {
    if (hasDismissibleOverlay && !historyGuardPushedRef.current) {
      try {
        window.history.pushState({ imperiumOverlay: true }, '');
        historyGuardPushedRef.current = true;
      } catch {
        // ignore history push errors in restricted iframes
      }
    } else if (!hasDismissibleOverlay) {
      historyGuardPushedRef.current = false;
    }
  }, [hasDismissibleOverlay]);

  useEffect(() => {
    const handlePopState = () => {
      const st = useGameStore.getState();
      if (st.screenState !== 'PLAYING') return;

      let closedSomething = false;
      if (st.pendingWarMove) {
        st.setPendingWarMove(null);
        closedSomething = true;
      } else if (st.activeWarModalId) {
        st.setActiveWarModalId(null);
        closedSomething = true;
      } else if (inspectedNationIdRef.current) {
        setInspectedNationId(null);
        closedSomething = true;
      } else if (st.showSystemModal) {
        st.setShowSystemModal(false);
        closedSomething = true;
      } else if (st.showNewsDrawer) {
        st.setShowNewsDrawer(false);
        closedSomething = true;
      } else if (st.activeBattleOverviewTerritoryId) {
        st.setActiveBattleOverviewTerritoryId(null);
        closedSomething = true;
      } else if (st.activeTab !== 'NONE') {
        st.setActiveTab('NONE');
        closedSomething = true;
      } else if (st.selectedTerritoryId) {
        st.selectTerritoryOnMap(null);
        closedSomething = true;
      }

      if (closedSomething) {
        historyGuardPushedRef.current = false;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Atomic Real-Time with Pause Simulation Loop (advances by hours every step!)
  useEffect(() => {
    if (
      screenState !== 'PLAYING' ||
      speed === 0 ||
      activeCrisis ||
      pendingWarMove
    ) {
      return;
    }

    const { intervalMs } = getClockSpeedProfile(speed);
    if (intervalMs <= 0) return;

    const timer = setInterval(() => {
      performanceTelemetry.recordSimulationTick();
      useGameStore.getState().advanceGameTick();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [screenState, speed, activeCrisis, pendingWarMove]);

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

  const pendingTargetNation = pendingWarMove
    ? nations[pendingWarMove.targetNationId]
    : null;
  const pendingFromTerritory = pendingWarMove
    ? territories[pendingWarMove.fromId]
    : null;
  const pendingSourceSeaArmy = pendingWarMove?.sourceSeaArmyId
    ? seaArmies.find((s) => s.id === pendingWarMove.sourceSeaArmyId) || null
    : null;
  const pendingToTerritory = pendingWarMove
    ? territories[pendingWarMove.toId]
    : null;
  const warConfirmationOpen = Boolean(
    pendingWarMove &&
      pendingTargetNation &&
      (pendingFromTerritory || pendingSourceSeaArmy) &&
      pendingToTerritory
  );
  const warConfirmationRef = useAccessibleDialog(warConfirmationOpen, () =>
    store.setPendingWarMove(null)
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
          store.recruitUnit(terrId, 'armor', 1000, 180);
        } else if (macroRecruitUnitMode === 'airDrone') {
          store.recruitUnit(terrId, 'airDrone', 1000, 500);
        } else {
          store.recruitUnit(terrId, 'infantry', 1000, 120);
        }
      } else if (macroMode === 'BUILD_ECONOMY') {
        store.selectTerritoryOnMap(null);
        toggleEconomyCity(terrId);
      } else if (macroMode === 'BUILD_FORT') {
        store.selectTerritoryOnMap(null);
        store.upgradeBuilding(terrId, 'fortress');
      }
      return;
    }
    if (battles.some((b) => b.territoryId === terrId) || Boolean(terr?.siege)) {
      store.setActiveBattleOverviewTerritoryId(terrId);
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

      {!showBootSplash && screenState === 'TITLE_MENU' && (
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
          onShowToast={store.showToast}
        />
      )}

      {screenState === 'VICTORY_SUMMARY' && campaignOutcome && playerNation && (
        <CampaignOutcomeModal
          outcome={campaignOutcome}
          playerNation={playerNation}
          territories={territories}
          tick={tick}
          gameMode={gameMode}
          onContinueAfterVictory={store.continueAfterVictory}
          onRestartCampaign={store.startNewGame}
          onReturnToTitleMenu={() => {
            store.setSpeed(0);
            store.setScreenState('TITLE_MENU');
          }}
        />
      )}

      {(activeCrisis || showNewsDrawer) && (
        <CrisisAndNewsModal
          activeCrisis={activeCrisis}
          onResolveCrisis={store.resolveCrisis}
          showNewsDrawer={showNewsDrawer}
          onCloseNewsDrawer={() => store.setShowNewsDrawer(false)}
          newsEvents={newsEvents}
        />
      )}

      {showSystemModal && (
        <SystemAndSaveModal
          isOpen={showSystemModal}
          onClose={() => store.setShowSystemModal(false)}
          settings={settings}
          onUpdateSettings={store.updateSettings}
          soundEnabled={soundEnabled}
          onToggleSound={store.toggleSound}
          onReturnToTitleMenu={() => {
            store.setSpeed(0);
            store.setScreenState('TITLE_MENU');
          }}
          onSaveToSlot={store.saveToSlot}
          onLoadRecord={store.loadRecord}
          onShowToast={store.showToast}
        />
      )}

      {inspectedNationId && (
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

      {activeWarModalId &&
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

      {/* AoH3-Style Border Violation & War Declaration Confirmation Modal */}
      {pendingWarMove &&
        pendingTargetNation &&
        (pendingFromTerritory || pendingSourceSeaArmy) &&
        pendingToTerritory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-[2px]">
          <div
            ref={warConfirmationRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="war-confirmation-title"
            aria-describedby="war-confirmation-description"
            tabIndex={-1}
            className="w-full max-w-md bg-[#14100c] border border-rose-500/60 rounded-2xl shadow-2xl overflow-hidden text-[#f3ead7]"
          >
            <div className="px-4 py-3 bg-gradient-to-r from-[#281214] via-[#1b1510] to-[#14100c] border-b border-rose-500/35 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-900/70 border border-rose-500/50 flex items-center justify-center shadow">
                  <ShieldAlert className="w-5 h-5 text-rose-200" />
                </div>
                <div>
                  <h3 id="war-confirmation-title" className="font-display font-bold text-sm sm:text-base text-[#f3ead7]">
                    Sınır İhlali & Savaş İlanı Onayı
                  </h3>
                  <p className="text-[11px] text-rose-300">
                    Diplomatik Kural: Tarafsız Ülke Toprağı
                  </p>
                </div>
              </div>
              <button
                onClick={() => store.setPendingWarMove(null)}
                aria-label="Savaş ilanı onayını kapat"
                className="w-7 h-7 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/25 flex items-center justify-center text-[#9d8f76] hover:text-[#f3ead7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f0c09] border border-[#caa15a]/25">
                <div className="flex items-center gap-2.5">
                  <NationFlagCanvasBadge
                    nationId={pendingTargetNation.id}
                    flagCode={pendingTargetNation.flagCode}
                    color={pendingTargetNation.color}
                    width={38}
                    height={26}
                  />
                  <div>
                    <div className="font-bold text-[#f3ead7] text-sm">
                      {cleanNationName(pendingTargetNation.name)}
                    </div>
                    <div className="text-[11px] text-[#9d8f76]">
                      Hedef Eyalet: <strong className="text-[#e0b86e]">{cleanProvinceName(pendingToTerritory.name)}</strong> ({(pendingToTerritory.garrison / 1000).toFixed(1)}B Garnizon)
                    </div>
                  </div>
                </div>
              </div>

              <p id="war-confirmation-description" className="text-[#d4c8b4] leading-relaxed">
                {pendingSourceSeaArmy ? (
                  <>
                    <strong>{pendingSourceSeaArmy.name}</strong> donanmanızdaki{' '}
                    {(pendingSourceSeaArmy.troops / 1000).toFixed(1)}B askeri amfibi çıkarma ile{' '}
                  </>
                ) : pendingWarMove.sourceTerritoryIds &&
                  pendingWarMove.sourceTerritoryIds.length > 1 ? (
                  <>
                    <strong>{pendingWarMove.sourceTerritoryIds.length} eyaletinizdeki</strong> (
                    {pendingWarMove.sourceTerritoryIds
                      .slice(0, 3)
                      .map((id) => cleanProvinceName(territories[id]?.name || id))
                      .join(', ')}
                    {pendingWarMove.sourceTerritoryIds.length > 3
                      ? ` +${pendingWarMove.sourceTerritoryIds.length - 3}`
                      : ''}
                    ) ordularınızı{' '}
                  </>
                ) : (
                  <>
                    <strong>{cleanProvinceName(pendingFromTerritory?.name || '')}</strong> eyaletindeki ordunuzu{' '}
                  </>
                )}
                <strong>{cleanNationName(pendingTargetNation.name)}</strong> egemenliğindeki{' '}
                <strong>{cleanProvinceName(pendingToTerritory.name)}</strong> toprağına yürütmek üzeresiniz. Aranızda resmi bir savaş veya askeri geçiş antlaşması bulunmuyor.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => store.confirmPendingWarMove()}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-900/70 hover:bg-rose-800/80 border border-rose-500/50 text-rose-100 font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  <span>Resmen Savaş İlan Et ve Taarruza Geç</span>
                </button>

                <button
                  onClick={() => {
                    store.diplomaticAction(
                      pendingWarMove.targetNationId,
                      'MILITARY_ACCESS'
                    );
                    store.setPendingWarMove(null);
                  }}
                  className="w-full py-2 px-4 rounded-xl bg-[#caa15a]/15 hover:bg-[#caa15a]/25 border border-[#caa15a]/40 text-[#e0b86e] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-[#e0b86e]" />
                  <span>Savaşmadan Askeri Geçiş İzni İste (120 Altın)</span>
                </button>

                <button
                  onClick={() => store.setPendingWarMove(null)}
                  className="w-full py-2 px-4 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/20 text-[#9d8f76] hover:text-[#f3ead7] font-semibold text-xs cursor-pointer"
                >
                  Hareket Emrini İptal Et
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TopHudBar
        playerNation={playerNation}
        playerEconomy={playerEconomy}
        playerManpowerCap={playerManpowerCap}
        activeTab={activeTab}
        tick={tick}
        hour={hour}
        speed={speed}
        gameMode={gameMode}
        newsCount={newsEvents.length}
        isMusicPlaying={isMusicPlaying}
        onSetActiveTab={store.setActiveTab}
        onSetSpeed={store.setSpeed}
        onTogglePause={store.togglePause}
        onOpenSystemModal={() => store.setShowSystemModal(true)}
        onOpenNewsDrawer={() => store.setShowNewsDrawer(true)}
        onFocusCapital={() => setFocusCapitalSignal((v) => v + 1)}
        onInspectNation={(nId) => setInspectedNationId(nId)}
        showZoomControls={settings.showZoomControls}
        onZoomIn={() => handleMapZoom(1.3)}
        onZoomOut={() => handleMapZoom(0.77)}
      />

      <div className="relative flex-1 w-full overflow-hidden">
        {!showBootSplash && (
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
            onSetMapMode={store.setMapMode}
            mapLabelDensity={settings.mapLabelDensity}
            zoomCommand={zoomCommand}
            fogOfWarEnabled={settings.fogOfWarEnabled}
            graphicsQuality={settings.graphicsQuality}
            smoothArmyAnimations={settings.smoothArmyAnimations}
            borderThickness={settings.borderThickness}
            mapLabelScale={settings.mapLabelScale}
            speed={speed}
            focusCapitalSignal={focusCapitalSignal}
            focusCoordsSignal={focusCoordsSignal}
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
        )}

        {chronicleOpen && (
          <div className="absolute bottom-[11.6rem] right-2.5 z-10 pointer-events-none">
            <AoH3ChronicleLog
              newsEvents={newsEvents}
              onOpenNewsFeed={() => store.setShowNewsDrawer(true)}
              onClose={() => setChronicleOpen(false)}
              hidden={activeTab !== 'NONE'}
            />
          </div>
        )}

        <WorldEventToastStack
          newsEvents={newsEvents}
          toastMessage={toastMessage}
          isDrawerOpen={activeTab !== 'NONE'}
          onDismissToast={() => store.showToast(null)}
          onOpenNewsFeed={() => store.setShowNewsDrawer(true)}
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
              showSystemModal ||
              activeWarModalId ||
              inspectedNationId ||
              pendingWarMove
          )}
          onRespond={store.respondToDiplomaticOffer}
        />

        <MapModePillBar
          mapMode={mapMode}
          macroMode={macroMode}
          macroRecruitUnitMode={macroRecruitUnitMode}
          toastMessage={toastMessage}
          economySelectedIds={economySelectedIds}
          batchMarchSourceIds={batchMarchSourceIds}
          batchMarchTargetPicking={batchMarchTargetPicking}
          batchMarchRatio={batchMarchRatio}
          territories={territories}
          playerTreasury={playerNation?.treasury ?? 0}
          hasBottomCard={Boolean(
            (selectedTerritory || selectedSeaArmy) &&
              activeTab === 'NONE' &&
              macroMode === 'NONE'
          )}
          hideWhenDrawerOpen={activeTab !== 'NONE'}
          outlinerSlot={
            screenState === 'PLAYING' ? (
              <AoH3OutlinerWidget
                playerNationId={playerNationId}
                nations={nations}
                territories={territories}
                wars={wars}
                battles={battles}
                movements={movements}
                seaArmies={seaArmies}
                selectedTerritoryId={selectedTerritoryId}
                selectedSeaArmyId={selectedSeaArmyId}
                aiCommanderEnabled={store.aiCommanderEnabled}
                aiCommanderStance={store.aiCommanderStance}
                onSelectTerritory={store.selectTerritoryOnMap}
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
                onSetActiveTab={store.setActiveTab}
                onStartArmyOrder={store.setArmyOrderSourceId}
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
                onOpenWarModal={(warId) => store.setActiveWarModalId(warId)}
              />
            ) : null
          }
          selectionChipsSlot={
            screenState === 'PLAYING' && multiSelectedIds && multiSelectedIds.length > 0 ? (
              <AoH3SelectionChips
                territoryIds={multiSelectedIds}
                territories={territories}
                nations={nations}
                playerNationId={playerNationId}
                label={macroMode === 'BUILD_ECONOMY' ? 'EKONOMİ' : 'SEVK'}
                onRemove={(id) =>
                  macroMode === 'BUILD_ECONOMY'
                    ? toggleEconomyCity(id)
                    : toggleBatchCity(id)
                }
                onClear={() =>
                  macroMode === 'BUILD_ECONOMY'
                    ? setEconomySelectedIds([])
                    : setBatchMarchSourceIds([])
                }
              />
            ) : null
          }
          belowTraySlot={
            screenState === 'PLAYING' ? (
              <LiveWarHudBadges
                playerNationId={playerNationId}
                nations={nations}
                territories={territories}
                wars={wars}
                onSetActiveTab={store.setActiveTab}
                onOpenWarModal={(warId) => store.setActiveWarModalId(warId)}
              />
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
                nextMode === 'BUILD_ECONOMY' &&
                economySelectedIds.length === 0 &&
                selectedTerritory &&
                selectedTerritory.ownerId === playerNationId
              ) {
                setEconomySelectedIds([selectedTerritory.id]);
              }
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
          onToggleEconomyCity={toggleEconomyCity}
          onClearEconomyCities={() => setEconomySelectedIds([])}
          onToggleBatchCity={toggleBatchCity}
          onSelectReadyBatchCities={selectReadyBatchCities}
          onSelectBorderBatchCities={selectBorderBatchCities}
          onClearBatchCities={() => {
            setBatchMarchSourceIds([]);
            setBatchMarchTargetPicking(false);
          }}
          onSetBatchTargetPicking={setBatchMarchTargetPicking}
          onSetBatchMarchRatio={setBatchMarchRatio}
          onInvestSpecialtyProduction={store.investSpecialtyProduction}
          onUpgradeBuildingBatch={store.batchUpgradeBuilding}
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
              store.recruitUnit(tId, 'infantry', 1000, 120)
            }
            onRecruitUnit={store.recruitUnit}
            onBatchRecruitUnits={store.batchRecruitUnits}
            onAssimilateTerritory={store.assimilateTerritory}
            onMergeArmies={store.mergeNeighborArmies}
            onDisbandArmy={store.disbandArmy}
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
            playerNation={playerNation}
            playerEconomy={playerEconomy}
            selectedTerritory={selectedTerritory}
            territories={territories}
            nations={nations}
            relations={relations}
            wars={wars}
            movements={movements}
            moveRatio={moveRatio}
            onSetMoveRatio={store.setMoveRatio}
            onStartArmyOrderMode={store.setArmyOrderSourceId}
            onExecuteArmyMove={store.executeArmyMove}
            onRecruitUnit={store.recruitUnit}
            onBatchRecruitUnits={store.batchRecruitUnits}
            onHireMercenary={store.hireMercenary}
            onRecruitOrAssignGeneral={store.recruitOrAssignGeneral}
            onUpgradeBuilding={store.upgradeBuilding}
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
            tick={tick}
            gameMode={gameMode}
          />
        )}
      </div>

      <MehterhaneDock
        hideCompactOnMobile={Boolean(
          activeTab !== 'NONE' ||
            (selectedTerritory && activeTab === 'NONE' && macroMode === 'NONE') ||
            macroMode !== 'NONE'
        )}
      />

      <QuickOnboardingOverlay
        visible={
          screenState === 'PLAYING' &&
          activeTab === 'NONE' &&
          macroMode === 'NONE' &&
          !selectedTerritory &&
          !showSystemModal &&
          !activeCrisis &&
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
