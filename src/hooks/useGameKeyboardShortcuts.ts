import { MutableRefObject, useEffect, useRef } from 'react';
import {
  BottomDrawerTab,
  CrisisEventDefinition,
  GameScreenState,
  MapMode,
  PendingWarMoveRequest,
  SpeedLevel,
  SuccessionEvent,
} from '../types/game';
import { MapMacroMode } from '../components/hud/MapModePillBar';
import { useGameStore } from '../store/useGameStore';
import { sound } from '../utils/soundEngine';

interface UseGameKeyboardShortcutsParams {
  screenState: GameScreenState;
  showSystemModal: boolean;
  activeCrisis: CrisisEventDefinition | null;
  activeSuccession: SuccessionEvent | null;
  pendingWarMove: PendingWarMoveRequest | null;
  pendingWarDeclarationTargetId: string | null;
  activeWarModalId: string | null;
  inspectedNationId: string | null;
  inspectedNationIdRef: MutableRefObject<string | null>;
  showNewsDrawer: boolean;
  activeBattleOverviewTerritoryId: string | null;
  macroMode: MapMacroMode;
  armyOrderSourceId: string | null;
  seaArmyOrderSourceId: string | null;
  activeTab: BottomDrawerTab;
  selectedTerritoryId: string | null;
  selectedSeaArmyId: string | null;
  setMacroMode: (mode: MapMacroMode) => void;
  setBatchMarchTargetPicking: (picking: boolean) => void;
  setFocusCapitalSignal: (updater: (v: number) => number) => void;
  setInspectedNationId: (nationId: string | null) => void;
  togglePause: () => void;
  setSpeed: (speed: SpeedLevel) => void;
  setMapMode: (mode: MapMode) => void;
  setArmyOrderSourceId: (id: string | null) => void;
  setSeaArmyOrderSourceId: (id: string | null) => void;
  setActiveTab: (tab: BottomDrawerTab) => void;
  selectTerritoryOnMap: (id: string | null) => void;
  setSelectedSeaArmyId: (id: string | null) => void;
}

export function useGameKeyboardShortcuts({
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
  togglePause,
  setSpeed,
  setMapMode,
  setArmyOrderSourceId,
  setSeaArmyOrderSourceId,
  setActiveTab,
  selectTerritoryOnMap,
  setSelectedSeaArmyId,
}: UseGameKeyboardShortcutsParams) {
  const historyGuardPushedRef = useRef<boolean>(false);

  // Smart Keyboard Shortcuts (Space, 1-5, H/Home, Q/W/E/R/T, M, Esc)
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
          activeSuccession ||
          pendingWarMove ||
          pendingWarDeclarationTargetId ||
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
        togglePause();
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
          setArmyOrderSourceId(null);
          setSeaArmyOrderSourceId(null);
          return;
        }
        if (activeTab !== 'NONE') {
          e.preventDefault();
          setActiveTab('NONE');
          return;
        }
        if (selectedTerritoryId || selectedSeaArmyId) {
          e.preventDefault();
          selectTerritoryOnMap(null);
          setSelectedSeaArmyId(null);
          return;
        }
        return;
      }

      if (e.key === '1' || e.code === 'Digit1') {
        e.preventDefault();
        sound.playClick();
        setSpeed(1);
        return;
      }
      if (e.key === '2' || e.code === 'Digit2') {
        e.preventDefault();
        sound.playClick();
        setSpeed(2);
        return;
      }
      if (e.key === '3' || e.code === 'Digit3') {
        e.preventDefault();
        sound.playClick();
        setSpeed(3);
        return;
      }
      if (e.key === '4' || e.code === 'Digit4') {
        e.preventDefault();
        sound.playClick();
        setSpeed(4);
        return;
      }
      if (e.key === '5' || e.code === 'Digit5') {
        e.preventDefault();
        sound.playClick();
        setSpeed(5);
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
        setMapMode('POLITICAL');
        return;
      }
      if (e.code === 'KeyW') {
        e.preventDefault();
        sound.playClick();
        setMapMode('ECONOMIC');
        return;
      }
      if (e.code === 'KeyE') {
        e.preventDefault();
        sound.playClick();
        setMapMode('RESOURCES');
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        sound.playClick();
        setMapMode('DIPLOMATIC');
        return;
      }
      if (e.code === 'KeyT') {
        e.preventDefault();
        sound.playClick();
        setMapMode('TERRAIN');
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        if (armyOrderSourceId) {
          sound.playClick();
          setArmyOrderSourceId(null);
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screenState,
    showSystemModal,
    activeCrisis,
    activeSuccession,
    pendingWarMove,
    pendingWarDeclarationTargetId,
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
    togglePause,
    setSpeed,
    setMapMode,
    setArmyOrderSourceId,
    setSeaArmyOrderSourceId,
    setActiveTab,
    selectTerritoryOnMap,
    setSelectedSeaArmyId,
    setMacroMode,
    setBatchMarchTargetPicking,
    setFocusCapitalSignal,
  ]);

  // Android hardware back button / browser back: close topmost drawer/modal instead of exiting PWA
  const hasDismissibleOverlay =
    screenState === 'PLAYING' &&
    (Boolean(pendingWarMove) ||
      Boolean(pendingWarDeclarationTargetId) ||
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
  }, [inspectedNationIdRef, setInspectedNationId]);
}
