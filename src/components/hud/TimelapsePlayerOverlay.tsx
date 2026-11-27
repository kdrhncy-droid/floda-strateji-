import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  Swords,
} from 'lucide-react';
import {
  CampaignTimelapse,
  TimelapseDeltaFrame,
  TimelapseMilestone,
  TimelapseMilestoneType,
} from '../../types/game';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';

export type TimelapsePlaybackSpeed = 1 | 2 | 4;

interface TimelapsePlayerOverlayProps {
  timelapse: CampaignTimelapse;
  title?: string;
  frameIndex: number;
  currentFrame: TimelapseDeltaFrame;
  latestMilestone: TimelapseMilestone | null;
  activeMilestones: TimelapseMilestone[];
  isPlaying: boolean;
  playbackSpeed: TimelapsePlaybackSpeed;
  exitLabel: string;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSetSpeed: (speed: TimelapsePlaybackSpeed) => void;
  onSeekFrame: (index: number) => void;
  onClose: () => void;
}

function getMilestoneBadgeMeta(type: TimelapseMilestoneType): {
  label: string;
  colorClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (type) {
    case 'WAR':
      return {
        label: 'Savaş',
        colorClass: 'bg-rose-950/85 border-rose-500/50 text-rose-200',
        Icon: Swords,
      };
    case 'PEACE':
      return {
        label: 'Barış',
        colorClass: 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200',
        Icon: ScrollText,
      };
    case 'EMPIRE':
      return {
        label: 'İmparatorluk',
        colorClass: 'bg-amber-950/85 border-[#e0bc78]/60 text-[#f8df9b]',
        Icon: Crown,
      };
    case 'COALITION':
      return {
        label: 'Koalisyon',
        colorClass: 'bg-orange-950/85 border-orange-500/50 text-orange-200',
        Icon: ShieldAlert,
      };
    case 'REBELLION':
      return {
        label: 'İsyan',
        colorClass: 'bg-red-950/85 border-red-500/50 text-red-200',
        Icon: Flame,
      };
    case 'SUCCESSION':
      return {
        label: 'Cülus',
        colorClass: 'bg-[#282017]/90 border-[#c89d54]/55 text-[#f0ddb0]',
        Icon: Crown,
      };
    default:
      return {
        label: 'Başlangıç',
        colorClass: 'bg-[#211c16]/90 border-[#c89d54]/45 text-[#e0bc78]',
        Icon: ScrollText,
      };
  }
}

export const TimelapsePlayerOverlay: React.FC<TimelapsePlayerOverlayProps> = ({
  timelapse,
  title,
  frameIndex,
  currentFrame,
  latestMilestone,
  isPlaying,
  playbackSpeed,
  exitLabel,
  onTogglePlay,
  onRestart,
  onSetSpeed,
  onSeekFrame,
  onClose,
}) => {
  const totalFrames = timelapse.frames.length;
  const maxIndex = Math.max(0, totalFrames - 1);
  const playerSnap = timelapse.nationSnapshots[timelapse.playerNationId];
  const displayTitle =
    title || cleanNationName(timelapse.playerNationName);
  const topLeaderSnap = currentFrame.topNationId
    ? timelapse.nationSnapshots[currentFrame.topNationId]
    : undefined;

  const milestones = timelapse.milestones || [];
  const currentMsPos = latestMilestone
    ? milestones.findIndex((m) => m.id === latestMilestone.id)
    : -1;

  const jumpToMilestone = (direction: -1 | 1) => {
    if (milestones.length === 0) return;
    const nextPos = Math.max(
      0,
      Math.min(
        milestones.length - 1,
        (currentMsPos >= 0 ? currentMsPos : 0) + direction
      )
    );
    const targetTick = milestones[nextPos].tick;
    let bestFrameIdx = 0;
    for (let i = 0; i < timelapse.frames.length; i++) {
      if (timelapse.frames[i].tick <= targetTick) {
        bestFrameIdx = i;
      } else {
        break;
      }
    }
    onSeekFrame(bestFrameIdx);
  };

  const msMeta = latestMilestone
    ? getMilestoneBadgeMeta(latestMilestone.type)
    : null;

  return (
    <div
      data-testid="timelapse-player-overlay"
      className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 pt-[max(0.65rem,env(safe-area-inset-top,0px))] pb-[max(0.65rem,env(safe-area-inset-bottom,0px))]"
    >
      {/* Top Floating Banner */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto aoh3-menu-panel rounded-xl px-3 py-2 flex items-center gap-3 max-w-full shadow-2xl">
          <NationFlagCanvasBadge
            nationId={timelapse.playerNationId}
            flagCode={playerSnap?.flagCode || 'TR'}
            color={playerSnap?.color || '#C89D54'}
            width={40}
            height={28}
          />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[#f0e6d2] truncate">
              {displayTitle}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#cfc3ae]">
              <span className="font-mono-num tabular-nums text-[#6eb887] font-semibold">
                {currentFrame.playerProvinceCount} Eyalet
              </span>
              {topLeaderSnap && currentFrame.topNationProvinceCount ? (
                <span className="hidden sm:inline text-[#9e927d] truncate">
                  · Lider: {cleanNationName(topLeaderSnap.name)} (
                  {currentFrame.topNationProvinceCount})
                </span>
              ) : null}
            </div>
          </div>

          <div className="pl-2.5 ml-1 border-l border-[#c89d54]/30 text-right shrink-0">
            <div
              data-testid="timelapse-current-year"
              className="font-display text-lg sm:text-2xl font-extrabold text-[#e0bc78] leading-none font-mono-num tabular-nums"
            >
              {currentFrame.year}
            </div>
            <div className="text-[10px] text-[#b2a58f] font-mono-num mt-0.5">
              {currentFrame.dateStr}
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="timelapse-exit-btn"
          onClick={onClose}
          className="pointer-events-auto aoh3-menu-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#f0e6d2] flex items-center gap-2 shadow-2xl cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#e0bc78]" />
          <span>{exitLabel}</span>
        </button>
      </header>

      {/* Bottom Floating Controls & Milestone Ticker */}
      <footer className="max-w-3xl w-full mx-auto space-y-2">
        {latestMilestone && msMeta && (
          <div className="pointer-events-auto aoh3-menu-panel rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-xl">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 ${msMeta.colorClass}`}
              >
                <msMeta.Icon className="w-3 h-3" />
                <span>{msMeta.label}</span>
              </span>
              <span className="text-[11px] font-mono-num text-[#e0bc78] shrink-0">
                {latestMilestone.year}
              </span>
              <span
                data-testid="timelapse-milestone-title"
                className="text-xs font-semibold text-[#f0e6d2] truncate"
              >
                {latestMilestone.title}
              </span>
            </div>

            {milestones.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => jumpToMilestone(-1)}
                  disabled={currentMsPos <= 0}
                  aria-label="Önceki tarihî olay"
                  className="min-w-[32px] min-h-[32px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] disabled:opacity-40 border border-[#3a3228] flex items-center justify-center text-[#cfc3ae] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => jumpToMilestone(1)}
                  disabled={currentMsPos >= milestones.length - 1}
                  aria-label="Sonraki tarihî olay"
                  className="min-w-[32px] min-h-[32px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] disabled:opacity-40 border border-[#3a3228] flex items-center justify-center text-[#cfc3ae] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-auto aoh3-menu-panel rounded-xl px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2.5 shadow-2xl">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="timelapse-restart-btn"
              onClick={onRestart}
              aria-label="Timelapse başa sar"
              title="Başa Sar"
              className="min-w-[42px] min-h-[42px] rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#3a3228] flex items-center justify-center text-[#cfc3ae] hover:text-[#f0e6d2] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="timelapse-play-pause-btn"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Oynatmayı duraklat' : 'Timelapse oynat'}
              className="aoh3-menu-btn-primary min-w-[44px] min-h-[42px] px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Duraklat</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Oynat</span>
                </>
              )}
            </button>
          </div>

          <div className="flex-1 min-w-[140px] flex items-center gap-2">
            <input
              type="range"
              aria-label="Timelapse zaman çizelgesi"
              min={0}
              max={maxIndex}
              value={frameIndex}
              disabled={maxIndex === 0}
              onChange={(e) => onSeekFrame(Number(e.target.value))}
              className="w-full accent-[#c89d54] cursor-pointer h-2"
            />
            <span className="text-[11px] font-mono-num tabular-nums text-[#cfc3ae] whitespace-nowrap shrink-0">
              {frameIndex + 1}/{totalFrames}
            </span>
          </div>

          <div
            role="group"
            aria-label="Oynatma hızı"
            className="flex items-center gap-1 bg-[#14110e] p-1 rounded-lg border border-[#3a3228] shrink-0"
          >
            {([1, 2, 4] as TimelapsePlaybackSpeed[]).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSetSpeed(spd)}
                aria-pressed={playbackSpeed === spd}
                className={`min-w-[36px] min-h-[34px] px-2 rounded-md text-xs font-bold font-mono-num transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-[#c89d54] text-[#110f0d]'
                    : 'text-[#b2a58f] hover:text-[#f0e6d2]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
