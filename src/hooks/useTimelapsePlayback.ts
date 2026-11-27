import { useEffect, useMemo, useState } from 'react';
import {
  CampaignTimelapse,
  GameModeId,
  GameScreenState,
  Nation,
  SpeedLevel,
  Territory,
} from '../types/game';
import { GeoCountryFeature, initializeWorld2026 } from '../engine/worldBuilder';
import { projectTimelapseToWorldState } from '../engine/timelapseEngine';
import { TimelapsePlaybackSpeed } from '../components/hud/TimelapsePlayerOverlay';

interface UseTimelapsePlaybackParams {
  screenState: GameScreenState;
  gameMode: GameModeId;
  speed: SpeedLevel;
  features: GeoCountryFeature[];
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  setSpeed: (speed: SpeedLevel) => void;
  showToast: (msg: string | null) => void;
  clearInspectedNation: () => void;
}

export interface ActiveTimelapsePlayback {
  timelapse: CampaignTimelapse;
  title?: string;
  source: 'TITLE_MENU' | 'PLAYING' | 'VICTORY_SUMMARY';
}

export function useTimelapsePlayback({
  screenState,
  gameMode,
  speed,
  features,
  nations,
  territories,
  setSpeed,
  showToast,
  clearInspectedNation,
}: UseTimelapsePlaybackParams) {
  const [activeTimelapsePlayback, setActiveTimelapsePlayback] =
    useState<ActiveTimelapsePlayback | null>(null);
  const [timelapseFrameIndex, setTimelapseFrameIndex] = useState<number>(0);
  const [timelapsePlaying, setTimelapsePlaying] = useState<boolean>(false);
  const [timelapseSpeed, setTimelapseSpeed] = useState<TimelapsePlaybackSpeed>(1);
  const [showTimelapseArchiveModal, setShowTimelapseArchiveModal] = useState<boolean>(false);

  const startTimelapsePlayback = (timelapse: CampaignTimelapse, title?: string) => {
    if (!timelapse || !timelapse.frames || timelapse.frames.length === 0) {
      showToast('Bu sefer için henüz görüntülenecek zaman çizelgesi karesi oluşmadı.');
      return;
    }
    if (speed !== 0) {
      setSpeed(0);
    }
    clearInspectedNation();
    setShowTimelapseArchiveModal(false);
    setTimelapseFrameIndex(0);
    setTimelapseSpeed(1);
    setTimelapsePlaying(timelapse.frames.length > 1);
    setActiveTimelapsePlayback({
      timelapse,
      title,
      source: screenState,
    });
  };

  // Timelapse frame playback timer
  useEffect(() => {
    if (!activeTimelapsePlayback || !timelapsePlaying) return;
    const totalFrames = activeTimelapsePlayback.timelapse.frames.length;
    if (totalFrames <= 1) {
      setTimelapsePlaying(false);
      return;
    }
    if (timelapseFrameIndex >= totalFrames - 1) {
      setTimelapsePlaying(false);
      return;
    }
    const delayMs = Math.round(900 / timelapseSpeed);
    const timer = setTimeout(() => {
      setTimelapseFrameIndex((prev) => {
        const next = Math.min(totalFrames - 1, prev + 1);
        if (next >= totalFrames - 1) {
          setTimelapsePlaying(false);
        }
        return next;
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [activeTimelapsePlayback, timelapsePlaying, timelapseFrameIndex, timelapseSpeed]);

  // Keyboard shortcuts during Timelapse playback (Escape exits, Space toggles play/pause)
  useEffect(() => {
    if (!activeTimelapsePlayback) return;
    const onTimelapseKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('input, textarea, select')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setTimelapsePlaying(false);
        setActiveTimelapsePlayback(null);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setTimelapsePlaying((prev) => {
          const total = activeTimelapsePlayback.timelapse.frames.length;
          if (!prev && timelapseFrameIndex >= total - 1) {
            setTimelapseFrameIndex(0);
          }
          return !prev;
        });
      }
    };
    window.addEventListener('keydown', onTimelapseKeyDown);
    return () => window.removeEventListener('keydown', onTimelapseKeyDown);
  }, [activeTimelapsePlayback, timelapseFrameIndex]);

  const timelapseScenarioMode = activeTimelapsePlayback?.timelapse.gameMode ?? null;
  const timelapseBaselineBundle = useMemo(() => {
    if (!timelapseScenarioMode) return null;
    if (timelapseScenarioMode === gameMode) {
      return { features, nations, territories };
    }
    const world = initializeWorld2026(timelapseScenarioMode);
    return {
      features: world.features,
      nations: world.nations,
      territories: world.territories,
    };
  }, [timelapseScenarioMode, gameMode, features, nations, territories]);

  const projectedTimelapseState = useMemo(() => {
    if (!activeTimelapsePlayback || !timelapseBaselineBundle) return null;
    return projectTimelapseToWorldState(
      activeTimelapsePlayback.timelapse,
      timelapseFrameIndex,
      timelapseBaselineBundle.territories,
      timelapseBaselineBundle.nations
    );
  }, [activeTimelapsePlayback, timelapseFrameIndex, timelapseBaselineBundle]);

  const toggleTimelapsePlay = () => {
    if (!activeTimelapsePlayback) return;
    setTimelapsePlaying((prev) => {
      const total = activeTimelapsePlayback.timelapse.frames.length;
      if (!prev && timelapseFrameIndex >= total - 1) {
        setTimelapseFrameIndex(0);
      }
      return !prev;
    });
  };

  const restartTimelapsePlayback = () => {
    if (!activeTimelapsePlayback) return;
    setTimelapseFrameIndex(0);
    setTimelapsePlaying(activeTimelapsePlayback.timelapse.frames.length > 1);
  };

  const seekTimelapseFrame = (idx: number) => {
    setTimelapsePlaying(false);
    setTimelapseFrameIndex(idx);
  };

  const closeTimelapsePlayback = () => {
    setTimelapsePlaying(false);
    setActiveTimelapsePlayback(null);
  };

  return {
    activeTimelapsePlayback,
    isTimelapseActive: Boolean(activeTimelapsePlayback),
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
  };
}
