import React from 'react';
import {
  Coins,
  Flag,
  FlaskConical,
  Minus,
  Pause,
  Play,
  Plus,
  Shield,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import {
  BottomDrawerTab,
  GameModeId,
  Nation,
  SpeedLevel,
} from '../../types/game';
import { formatGameDate, NationEconomyBreakdown } from '../../engine/simulationEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import { AoH3TopMenu } from './AoH3TopMenu';

interface TopHudBarProps {
  playerNation: Nation;
  playerEconomy: NationEconomyBreakdown;
  playerManpowerCap?: number;
  activeTab: BottomDrawerTab;
  tick: number;
  hour?: number;
  speed: SpeedLevel;
  gameMode: GameModeId;
  newsCount: number;
  isMusicPlaying: boolean;
  /** AoH3 top-right zoom plaque. */
  showZoomControls?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onSetSpeed: (speed: SpeedLevel) => void;
  onTogglePause: () => void;
  onOpenSystemModal: () => void;
  onOpenNewsDrawer: () => void;
  onFocusCapital?: () => void;
  onInspectNation?: (nationId: string) => void;
}

const signed = (value: number, digits = 0) => {
  const rounded =
    digits > 0 ? Number(value.toFixed(digits)) : Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded.toLocaleString('tr-TR')}`;
};

/**
 * AoH3-style top chrome.
 *
 * The reference bar carries no labels: an imperial flag plate with two tiny
 * counters underneath, a continuous strip of icon + value + sub-value cells,
 * and — on the right — the hamburger, the zoom plaque and a bold date.
 * Everything that used to need explanatory text lives in the Divan menu.
 */
export const TopHudBar: React.FC<TopHudBarProps> = ({
  playerNation,
  playerEconomy,
  playerManpowerCap,
  activeTab,
  tick,
  hour = 8,
  speed,
  gameMode,
  newsCount,
  isMusicPlaying,
  showZoomControls = false,
  onZoomIn,
  onZoomOut,
  onSetActiveTab,
  onSetSpeed,
  onTogglePause,
  onOpenSystemModal,
  onOpenNewsDrawer,
  onFocusCapital,
  onInspectNation,
}) => {
  const nationTitle = cleanNationName(playerNation.name);
  const dateLabel = formatGameDate(tick, gameMode);
  const hourLabel = `${String(hour % 24).padStart(2, '0')}:00`;
  const isManpowerFull =
    typeof playerManpowerCap === 'number' &&
    playerNation.manpower >= playerManpowerCap;

  const researchPct = playerNation.activeResearch
    ? Math.min(
        100,
        Math.round(
          (playerNation.activeResearch.progress /
            playerNation.activeResearch.totalCost) *
            100
        )
      )
    : 0;
  const researchDays = playerNation.activeResearch
    ? Math.max(
        1,
        Math.ceil(
          (playerNation.activeResearch.totalCost -
            playerNation.activeResearch.progress) /
            Math.max(0.4, playerEconomy.dailyResearch)
        )
      )
    : 0;

  const populationLabel =
    playerEconomy.totalPopulation >= 1000
      ? `${(playerEconomy.totalPopulation / 1000).toFixed(1)}M`
      : `${Math.round(playerEconomy.totalPopulation)}B`;
  const armyLabel = (playerEconomy.totalGarrison / 1000).toFixed(0);
  const manpowerLabel = (playerNation.manpower / 1000).toFixed(1);
  const manpowerGrowthLabel =
    playerEconomy.dailyManpower >= 1000
      ? `${(playerEconomy.dailyManpower / 1000).toFixed(1)}B`
      : `${Math.round(playerEconomy.dailyManpower)}`;

  const cellClass = (tab: BottomDrawerTab) =>
    `aoh3-stat ${activeTab === tab ? 'is-active' : ''}`;

  return (
    <header className="hud-header aoh3-topbar hud-surface px-2 sm:px-3 py-1.5 sm:py-0 sm:h-14 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 z-30 shrink-0">
      <div className="flex items-center justify-between gap-2 w-full sm:contents">
        {/* Imperial flag plate + two counters, exactly like the reference corner */}
        <div className="flex items-center gap-2 min-w-0 order-1">
          <button
            onClick={() => {
              sound.playClick();
              if (onInspectNation) {
                onInspectNation(playerNation.id);
              } else {
                onSetActiveTab(
                  activeTab === 'GOVERNMENT' ? 'NONE' : 'GOVERNMENT'
                );
              }
            }}
            aria-label="Ülke diplomasisi ve ittifak özetini aç"
            title={`${nationTitle} · İstikrar %${Math.round(
              playerNation.stability
            )} · ${playerEconomy.territoryCount} eyalet`}
            className="flex flex-col items-center shrink-0 rounded-[3px] transition-colors hover:brightness-110"
          >
            <span className="aoh3-crest block">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={38}
                height={26}
              />
            </span>
            <span className="aoh3-crest-ribbon">
              <Star className="h-2 w-2 fill-[#e0b86e] text-[#e0b86e]" />
              {Math.round(playerNation.stability)}
              <span className="aoh3-crest-ribbon-sep" />
              <Flag className="h-2 w-2 text-[#d8b471]" />
              {playerEconomy.territoryCount}
            </span>
          </button>
        </div>

        {/* Right cluster: quiet pause, Divan menu, zoom plaque, bold date */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 order-3 sm:ml-auto">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onTogglePause();
            }}
            title={`${speed === 0 ? 'Devam et' : 'Duraklat'} (Boşluk) · ${hourLabel}`}
            aria-label={speed === 0 ? 'Oyunu devam ettir' : 'Oyunu duraklat'}
            className={`aoh3-topbtn ${speed === 0 ? 'is-paused' : ''}`}
          >
            {speed === 0 ? (
              <Play className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>

          <AoH3TopMenu
            speed={speed}
            isMusicPlaying={isMusicPlaying}
            newsCount={newsCount}
            onSetSpeed={onSetSpeed}
            onTogglePause={onTogglePause}
            onOpenNewsDrawer={onOpenNewsDrawer}
            onOpenSystemModal={onOpenSystemModal}
            onFocusCapital={onFocusCapital}
          />

          {showZoomControls && (
            <div
              className="hidden sm:flex items-center gap-0.5 shrink-0"
              aria-label="Harita yakınlaştırma"
            >
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onZoomOut?.();
                }}
                title="Haritayı uzaklaştır"
                aria-label="Haritayı uzaklaştır"
                className="aoh3-topbtn"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onZoomIn?.();
                }}
                title="Haritayı yakınlaştır"
                aria-label="Haritayı yakınlaştır"
                className="aoh3-topbtn"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <span
            className="aoh3-datenow"
            title={`${dateLabel} · ${hourLabel}`}
          >
            {dateLabel}
          </span>
        </div>
      </div>

      {/* Continuous brass stat strip: icon + value + sub-value, no labels */}
      <div className="aoh3-stat-strip order-2 w-full sm:w-auto min-w-0">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onSetActiveTab(activeTab === 'ECONOMY' ? 'NONE' : 'ECONOMY');
          }}
          title={`Hazine: ${playerNation.treasury.toLocaleString(
            'tr-TR'
          )} altın · Günlük net ${signed(playerEconomy.netDailyGold, 1)}`}
          className={cellClass('ECONOMY')}
        >
          <Coins className="aoh3-stat-icon" />
          <span className="aoh3-stat-body">
            <span className="aoh3-stat-value">
              {playerNation.treasury.toLocaleString('tr-TR')}
            </span>
            <span
              className={`aoh3-stat-sub ${
                playerEconomy.netDailyGold >= 0 ? 'is-up' : 'is-down'
              }`}
            >
              {signed(playerEconomy.netDailyGold, 1)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onSetActiveTab(activeTab === 'ECONOMY' ? 'NONE' : 'ECONOMY');
          }}
          title={`Nüfus: ${Math.round(
            playerEconomy.totalPopulation
          ).toLocaleString('tr-TR')} bin · Günlük vergi ${signed(
            playerEconomy.taxIncome,
            1
          )}`}
          className={cellClass('ECONOMY')}
        >
          <Users className="aoh3-stat-icon" />
          <span className="aoh3-stat-body">
            <span className="aoh3-stat-value">{populationLabel}</span>
            <span className="aoh3-stat-sub is-up">
              {signed(playerEconomy.taxIncome, 1)}
            </span>
          </span>
        </button>

        <button
          type="button"
          data-testid="hud-research-btn"
          onClick={() => {
            sound.playClick();
            onSetActiveTab(activeTab === 'GOVERNMENT' ? 'NONE' : 'GOVERNMENT');
          }}
          title={
            playerNation.activeResearch
              ? `Araştırma %${researchPct} · ${researchDays} gün kaldı`
              : 'Bilim boşta · Araştırma başlatmak için dokun'
          }
          className={cellClass('GOVERNMENT')}
        >
          <FlaskConical className="aoh3-stat-icon" />
          <span className="aoh3-stat-body">
            <span className="aoh3-stat-value">
              %{playerNation.activeResearch ? researchPct : 0}
            </span>
            <span
              className={`aoh3-stat-sub ${
                playerNation.activeResearch ? 'text-[#d8b471]' : 'is-muted'
              }`}
            >
              {playerNation.activeResearch ? researchDays : '—'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onSetActiveTab(activeTab === 'MILITARY' ? 'NONE' : 'MILITARY');
          }}
          title={`Ordu: ${Math.round(
            playerEconomy.totalGarrison
          ).toLocaleString('tr-TR')} asker · Günlük bakım ${signed(
            -playerEconomy.militaryUpkeep,
            1
          )}`}
          className={cellClass('MILITARY')}
        >
          <Shield className="aoh3-stat-icon" />
          <span className="aoh3-stat-body">
            <span className="aoh3-stat-value">{armyLabel}</span>
            <span className="aoh3-stat-sub is-down">
              {signed(-playerEconomy.militaryUpkeep, 1)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onSetActiveTab(activeTab === 'MILITARY' ? 'NONE' : 'MILITARY');
          }}
          title={
            typeof playerManpowerCap === 'number'
              ? `İnsan Gücü: ${Math.round(
                  playerNation.manpower
                ).toLocaleString('tr-TR')} / ${playerManpowerCap.toLocaleString(
                  'tr-TR'
                )}`
              : `İnsan Gücü: ${Math.round(playerNation.manpower).toLocaleString(
                  'tr-TR'
                )}`
          }
          className={cellClass('MILITARY')}
        >
          <UserRound className="aoh3-stat-icon" />
          <span className="aoh3-stat-body">
            <span className="aoh3-stat-value">{manpowerLabel}</span>
            <span
              className={`aoh3-stat-sub ${
                isManpowerFull ? 'text-[#d8b471]' : 'is-up'
              }`}
            >
              {isManpowerFull ? 'MAX' : `+${manpowerGrowthLabel}`}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
};
