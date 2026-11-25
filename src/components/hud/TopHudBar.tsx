import React from 'react';
import {
  Pause,
  Play,
  FastForward,
  Coins,
  Users,
  Shield,
  FlaskConical,
  Menu,
  Newspaper,
  Compass,
  Music,
} from 'lucide-react';
import {
  BottomDrawerTab,
  GameModeId,
  Nation,
  SpeedLevel,
} from '../../types/game';
import { IDEOLOGIES } from '../../data/world2026Data';
import {
  formatGameDate,
  NationEconomyBreakdown,
} from '../../engine/simulationEngine';
import { getGameSeason } from '../../engine/seasonSupplyAndAiProfile';
import { getClockSpeedProfile } from '../../engine/gameSettings';
import { music } from '../../engine/musicEngine';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import { cleanNationName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';

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
  onSetActiveTab: (tab: BottomDrawerTab) => void;
  onSetSpeed: (speed: SpeedLevel) => void;
  onTogglePause: () => void;
  onOpenSystemModal: () => void;
  onOpenNewsDrawer: () => void;
  onFocusCapital?: () => void;
  onInspectNation?: (nationId: string) => void;
}

const SPEED_STEPS: ReadonlyArray<{ level: SpeedLevel; label: string }> = [
  { level: 1, label: '1x' },
  { level: 2, label: '2x' },
  { level: 3, label: '3x' },
  { level: 4, label: '4x' },
  { level: 5, label: '5x' },
];

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
  const seasonInfo = getGameSeason(tick, gameMode);
  const seasonColorClass =
    seasonInfo.id === 'WINTER'
      ? 'text-[#d8cbb5]'
      : seasonInfo.id === 'SPRING'
      ? 'text-[#e0b86e]'
      : seasonInfo.id === 'SUMMER'
      ? 'text-[#f3ead7]'
      : 'text-[#caa15a]';
  const hourLabel = `${String(hour % 24).padStart(2, '0')}:00`;
  const hourlyRateLabel = getClockSpeedProfile(speed).rateLabel;
  const isManpowerFull =
    typeof playerManpowerCap === 'number' &&
    playerNation.manpower >= playerManpowerCap;

  const cycleSpeed = () => {
    sound.playClick();
    const nextSpeed: Record<SpeedLevel, SpeedLevel> = {
      0: 1,
      1: 2,
      2: 3,
      3: 4,
      4: 5,
      5: 1,
    };
    onSetSpeed(nextSpeed[speed]);
  };

  return (
    <header className="hud-header hud-surface px-2 py-1.5 sm:py-0 sm:h-14 sm:px-4 border-b border-amber-500/35 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 z-30 shrink-0">
      {/* Row 1 on Portrait / Left+Right Wrapper on Mobile */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 w-full sm:w-auto sm:justify-start min-w-0">
        {/* Left: Menu + AoH3 Top-Left Imperial Flag Shield & Nation Hub */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <button
            onClick={() => {
              sound.playClick();
              onSetSpeed(0);
              onOpenSystemModal();
            }}
            title="Sistem Menüsü, UI Ölçeği & Kayıt Merkezi"
            className="min-w-[32px] min-h-[34px] sm:min-w-[36px] sm:min-h-[38px] px-1.5 sm:px-2 rounded-xl hud-chip hover:bg-[#231b13] flex items-center justify-center gap-1.5 text-[#f3ead7] shrink-0"
          >
            <Menu className="w-4 h-4 text-[#e0b86e] shrink-0" />
            <span className="hidden lg:inline text-xs font-semibold">Menü</span>
          </button>

          {/* AoH2/AoH3 Top-Left Civilization Flag Shield Button -> Opens Nation Diplomacy Inspector */}
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
            title="Ülke Diplomasisi, Müttefikler, Paktlar ve Savaş Özeti (Bayrak Menüsü)"
            data-full-text={`${nationTitle} — ${IDEOLOGIES[playerNation.ideology]?.name ?? 'Monarşi'} (İstikrar %${Math.round(playerNation.stability)}). Ülke diplomasisi, müttefikler, savunma paktları ve savaş özetini açmak için dokun.`}
            className="flex items-center gap-1.5 sm:gap-2 text-left min-w-0 px-1 sm:px-1.5 py-0.5 rounded-xl hover:bg-[#caa15a]/15 border border-transparent hover:border-[#caa15a]/35 transition-colors"
          >
            <div className="relative shrink-0">
              <NationFlagCanvasBadge
                nationId={playerNation.id}
                flagCode={playerNation.flagCode}
                color={playerNation.color}
                width={34}
                height={24}
              />
              <span className="absolute -bottom-1 -right-1 px-0.5 rounded bg-[#14100c] border border-[#caa15a]/60 text-[8px] font-mono-num text-[#e0b86e]">
                %{Math.round(playerNation.stability)}
              </span>
            </div>
            <div className="hud-narrow-landscape-hide min-w-0 overflow-hidden">
              <div className="font-display text-[11px] sm:text-sm font-bold text-[#f3ead7] truncate max-w-[90px] min-[370px]:max-w-[110px] min-[390px]:max-w-[124px] lg:max-w-[180px]">
                {nationTitle}
              </div>
              <div className="hud-landscape-hide text-[9px] sm:text-[10px] text-[#e0b86e] sm:text-[#b8a990] leading-tight font-mono-num sm:font-sans truncate">
                <span className="sm:hidden font-semibold truncate block">
                  {dateLabel}
                  <span className="hidden min-[370px]:inline"> · {hourLabel}</span>
                </span>
                <span className="hidden sm:inline text-[#caa15a]">
                  {IDEOLOGIES[playerNation.ideology]?.name ?? 'Monarşi'} · Diplomasi
                </span>
              </div>
            </div>
          </button>

          {onFocusCapital && (
            <button
              onClick={() => {
                sound.playClick();
                onFocusCapital();
              }}
              title="Başkente Odakla"
              aria-label="Başkente Odakla"
              className="w-7 h-[32px] sm:w-[34px] sm:h-[34px] rounded-xl bg-[#14100c] hover:bg-[#231b13] border border-[#caa15a]/35 flex items-center justify-center text-[#e0b86e] shrink-0"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Portrait-Only Compact Time & News Controls */}
        <div className="flex sm:hidden items-center gap-1 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              onOpenNewsDrawer();
            }}
            title="Dünya Haberleri & Divan"
            className="min-w-[30px] h-[32px] px-1 rounded-xl bg-[#14100c] border border-[#caa15a]/35 flex items-center justify-center gap-0.5 text-[10px] font-mono-num font-bold text-[#e0b86e]"
          >
            <Newspaper className="w-3 h-3 text-[#e0b86e] shrink-0" />
            <span>{newsCount}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onTogglePause();
            }}
            aria-label={speed === 0 ? 'Oyunu devam ettir' : 'Oyunu duraklat'}
            className={`w-[30px] h-[32px] rounded-xl flex items-center justify-center border transition-colors ${
              speed === 0
                ? 'bg-[#caa15a] text-[#14100c] border-[#e0b86e] font-bold'
                : 'bg-[#14100c] text-[#f3ead7] border-[#caa15a]/35'
            }`}
          >
            {speed === 0 ? (
              <Play className="w-3 h-3 fill-current" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={cycleSpeed}
            aria-label="Zaman hızını değiştir"
            className="min-w-[32px] h-[32px] px-1 rounded-xl bg-[#14100c] border border-[#caa15a]/35 flex items-center justify-center gap-0.5 text-[10px] font-mono-num font-bold text-[#e0b86e]"
          >
            <FastForward className="w-2.5 h-2.5 shrink-0" />
            <span>{speed === 0 ? '1x' : `${speed}x`}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              music.toggle();
            }}
            aria-label="Müziği aç veya kapat"
            className={`w-[28px] h-[32px] rounded-xl border flex items-center justify-center ${
              isMusicPlaying
                ? 'bg-[#caa15a]/20 text-[#e0b86e] border-[#caa15a]/55'
                : 'bg-[#14100c] text-[#9b8d77] border-[#3a2f22]'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center / Row 2 on Portrait: AoH3 Top Resource Strip */}
      <div className="flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 w-full sm:w-auto min-w-0">
        <button
          onClick={() =>
            onSetActiveTab(activeTab === 'ECONOMY' ? 'NONE' : 'ECONOMY')
          }
          title="Hazine ve Günlük Net Gelir"
          className="flex items-center justify-center gap-1 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#14100c] border border-[#caa15a]/40 hover:border-[#e0b86e] shrink-0"
        >
          <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e0b86e] shrink-0" />
          <span className="font-mono-num text-[11px] sm:text-xs font-bold text-[#faf3e3] whitespace-nowrap">
            {playerNation.treasury.toLocaleString('tr-TR')}
          </span>
          <span
            className={`hud-narrow-landscape-hide font-mono-num text-[10px] font-semibold whitespace-nowrap ${
              playerEconomy.netDailyGold >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            ({playerEconomy.netDailyGold >= 0
              ? `+${playerEconomy.netDailyGold}`
              : playerEconomy.netDailyGold})
          </span>
        </button>

        <button
          onClick={() =>
            onSetActiveTab(activeTab === 'MILITARY' ? 'NONE' : 'MILITARY')
          }
          title={
            typeof playerManpowerCap === 'number'
              ? `İnsan Gücü: ${Math.round(playerNation.manpower).toLocaleString('tr-TR')} / ${playerManpowerCap.toLocaleString('tr-TR')} (${isManpowerFull ? 'Kapasite Dolu' : `+${playerEconomy.dailyManpower.toLocaleString('tr-TR')}/gün`})`
              : `İnsan Gücü (+${playerEconomy.dailyManpower.toLocaleString('tr-TR')}/gün)`
          }
          className="flex items-center justify-center gap-1 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#14100c] border border-[#caa15a]/35 hover:border-[#e0b86e] shrink-0"
        >
          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e0b86e] shrink-0" />
          <span className="font-mono-num text-[11px] sm:text-xs font-bold text-[#faf3e3] whitespace-nowrap">
            {(playerNation.manpower / 1000).toFixed(1)}B
          </span>
          <span
            className={`hud-narrow-landscape-hide font-mono-num text-[10px] font-semibold whitespace-nowrap ${
              isManpowerFull ? 'text-[#e0b86e]' : 'text-emerald-400'
            }`}
          >
            (
            {isManpowerFull
              ? 'MAX'
              : playerEconomy.dailyManpower >= 1000
              ? `+${(playerEconomy.dailyManpower / 1000).toFixed(1)}B`
              : `+${playerEconomy.dailyManpower}`}
            )
          </span>
        </button>

        <button
          onClick={() =>
            onSetActiveTab(activeTab === 'MILITARY' ? 'NONE' : 'MILITARY')
          }
          title="Toplam Silah Altındaki Ordu"
          className="flex sm:hidden lg:flex items-center justify-center gap-1 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#14100c] border border-[#caa15a]/35 hover:border-[#e0b86e] shrink-0"
        >
          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e0b86e] shrink-0" />
          <span className="font-mono-num text-[11px] sm:text-xs font-bold text-[#faf3e3] whitespace-nowrap">
            {(playerEconomy.totalGarrison / 1000).toFixed(0)}B
          </span>
        </button>

        {playerNation.activeResearch ? (
          <button
            data-testid="hud-research-btn"
            onClick={() => {
              sound.playClick();
              onSetActiveTab(activeTab === 'GOVERNMENT' ? 'NONE' : 'GOVERNMENT');
            }}
            title="Aktif Teknoloji Araştırması"
            className="relative flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#1b1510] border border-[#caa15a]/55 hover:border-[#e0b86e] shrink-0 shadow-sm"
          >
            <FlaskConical className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e0b86e] shrink-0" />
            <span className="font-mono-num text-[11px] sm:text-xs font-bold text-[#f3ead7] whitespace-nowrap">
              %{Math.min(100, Math.round((playerNation.activeResearch.progress / playerNation.activeResearch.totalCost) * 100))}
            </span>
            <span className="hidden md:inline font-mono-num text-[10px] text-[#caa15a] whitespace-nowrap">
              ({Math.max(1, Math.ceil((playerNation.activeResearch.totalCost - playerNation.activeResearch.progress) / Math.max(0.4, playerEconomy.dailyResearch)))}g)
            </span>
            <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#2a2117] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e0b86e] transition-all"
                style={{
                  width: `${Math.min(100, Math.round((playerNation.activeResearch.progress / playerNation.activeResearch.totalCost) * 100))}%`,
                }}
              />
            </div>
          </button>
        ) : (
          <button
            data-testid="hud-research-btn"
            onClick={() => {
              sound.playClick();
              onSetActiveTab(activeTab === 'GOVERNMENT' ? 'NONE' : 'GOVERNMENT');
            }}
            title="Teknoloji Araştırması Başlat (Bilim Boşta)"
            className="flex items-center justify-center gap-1 px-2 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#261d13] border border-[#caa15a]/50 hover:border-[#e0b86e] shrink-0"
          >
            <FlaskConical className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#e0b86e] shrink-0" />
            <span className="font-mono-num text-[10px] sm:text-[11px] font-extrabold text-[#f3ead7] whitespace-nowrap">
              +Araştır
            </span>
          </button>
        )}
      </div>

      {/* Landscape / Desktop Right: AoH3 Clock & 5-Pip Speed Gauge */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <div className="text-right mr-0.5">
          <div className="font-mono-num text-[11px] sm:text-xs font-bold text-[#e0b86e] leading-tight whitespace-nowrap flex items-center justify-end gap-1">
            <span>{dateLabel}</span>
            <span
              className={`hidden md:inline font-sans text-[10px] font-semibold ${seasonColorClass}`}
              title={`${seasonInfo.name}: ${seasonInfo.summary}`}
              data-testid="hud-season-label"
            >
              · {seasonInfo.name}
            </span>
            <span className="hud-landscape-hide text-[#d8cbb5] text-[10px] font-mono-num">
              · {hourLabel}
            </span>
          </div>
          {/* AoH3 Speed Pips */}
          <div className="hud-landscape-hide flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[9px] text-[#b8a990] whitespace-nowrap">
              {hourlyRateLabel}
            </span>
            <div className="hidden lg:flex items-center gap-0.5 ml-1">
              {SPEED_STEPS.map((st) => {
                const active = speed >= st.level && speed > 0;
                return (
                  <button
                    key={st.level}
                    onClick={() => {
                      sound.playClick();
                      onSetSpeed(st.level);
                    }}
                    title={`Hız: ${st.label}`}
                    className={`w-3.5 h-2 rounded-xs transition-colors ${
                      active
                        ? 'bg-[#e0b86e]'
                        : 'bg-[#2a2117] hover:bg-[#3d3022]'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            onTogglePause();
          }}
          title="Duraklat / Devam Et (Boşluk)"
          className={`min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
            speed === 0
              ? 'bg-[#caa15a] text-[#14100c] border-[#e0b86e] font-bold'
              : 'bg-[#14100c] text-[#f3ead7] border-[#caa15a]/35 hover:bg-[#231b13]'
          }`}
        >
          {speed === 0 ? (
            <Play className="w-4 h-4 fill-current" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={cycleSpeed}
          title="Zaman Hızını Değiştir"
          className="min-w-[40px] min-h-[36px] px-2 rounded-xl bg-[#14100c] hover:bg-[#231b13] border border-[#caa15a]/35 flex items-center justify-center gap-1 text-xs font-mono-num font-bold text-[#e0b86e] shrink-0"
        >
          <FastForward className="w-3.5 h-3.5 shrink-0" />
          <span>{speed === 0 ? '1x' : `${speed}x`}</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            music.toggle();
          }}
          title="Ulusal Marş & Müzik Kutusu"
          aria-label="Ulusal marşı aç veya kapat"
          className={`min-w-[34px] min-h-[36px] px-2 rounded-xl border flex items-center justify-center gap-1 transition-colors shrink-0 ${
            isMusicPlaying
              ? 'bg-[#caa15a]/20 text-[#e0b86e] border-[#caa15a]/55'
              : 'bg-[#14100c] text-[#9b8d77] border-[#3a2f22] hover:text-[#f3ead7]'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenNewsDrawer();
          }}
          title="Canlı Dünya Haber Akışı & Divan"
          className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-[#14100c] hover:bg-[#231b13] border border-[#caa15a]/35 flex items-center justify-center gap-1 text-xs font-semibold text-[#e0b86e] shrink-0"
        >
          <Newspaper className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
          <span className="hidden lg:inline font-mono-num">{newsCount}</span>
        </button>
      </div>
    </header>
  );
};
