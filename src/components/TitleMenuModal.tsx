import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Coins,
  Film,
  FolderOpen,
  Globe,
  MapPin,
  MessageSquareWarning,
  Play,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Swords,
  Users,
} from 'lucide-react';
import {
  GAME_MODES,
  IDEOLOGIES,
  PRESET_COUNTRIES_2026,
  RESOURCE_INFO,
} from '../data/world2026Data';
import { CampaignTimelapse, GameModeId, Nation, Territory } from '../types/game';
import { GameSettings } from '../engine/gameSettings';
import { SaveSlotMetadata, SaveSlotRecord } from '../engine/saveManager';
import { NationFlagCanvasBadge } from '../map/nationFlagRenderer';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { sound } from '../utils/soundEngine';
import { PWAInstallButton } from './PWAInstallButton';
import { TerrainPanoramaSvg } from './illustrations/AoH3Illustrations';

const FeedbackModal = lazy(() =>
  import('./modals/FeedbackModal').then((m) => ({ default: m.FeedbackModal }))
);
const SaveManagerModal = lazy(() =>
  import('./modals/SaveManagerModal').then((m) => ({ default: m.SaveManagerModal }))
);
const StrategyTipsModal = lazy(() =>
  import('./modals/StrategyTipsModal').then((m) => ({ default: m.StrategyTipsModal }))
);
const MainMenuSettingsModal = lazy(() =>
  import('./modals/MainMenuSettingsModal').then((m) => ({
    default: m.MainMenuSettingsModal,
  }))
);
const TimelapseArchiveModal = lazy(() =>
  import('./modals/TimelapseArchiveModal').then((m) => ({
    default: m.TimelapseArchiveModal,
  }))
);

import menuLandscapeArt from '../assets/images/floda_menu_landscape_1795461163428.jpg';
import menuPortraitArt from '../assets/images/floda_menu_portrait_1795461162475.jpg';
import warRoomArt from '../assets/images/floda_main_menu_war_room_1795459892773.jpg';

type TitleMenuView = 'HOME' | 'NEW_GAME' | 'MAP_PICKER';

interface TitleMenuModalProps {
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  selectedMode: GameModeId;
  selectedNationId: string;
  hasSavedGame: boolean;
  mostRecentSaveMeta?: SaveSlotMetadata | null;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onSelectMode: (mode: GameModeId) => void;
  onSelectNation: (nationId: string) => void;
  onStartNewGame: () => void;
  onLoadSavedGame: () => void;
  onLoadSaveRecord?: (record: SaveSlotRecord) => void;
  onPlayTimelapse?: (timelapse: CampaignTimelapse, title?: string) => void;
  onShowToast?: (msg: string) => void;
}

export const TitleMenuModal: React.FC<TitleMenuModalProps> = ({
  nations,
  territories,
  selectedMode,
  selectedNationId,
  hasSavedGame,
  mostRecentSaveMeta = null,
  settings,
  onUpdateSettings,
  onSelectMode,
  onSelectNation,
  onStartNewGame,
  onLoadSavedGame,
  onLoadSaveRecord,
  onPlayTimelapse,
  onShowToast,
}) => {
  const [menuView, setMenuView] = useState<TitleMenuView>('HOME');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'MAJOR' | 'ALL'>('MAJOR');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSaveManager, setShowSaveManager] = useState(false);
  const [showTimelapseArchive, setShowTimelapseArchive] = useState(false);
  const [backdropBroken, setBackdropBroken] = useState(false);

  const nationStatsMap = useMemo(() => {
    const stats: Record<
      string,
      { provinces: number; totalGarrison: number; totalGdp: number }
    > = {};
    for (const nId of Object.keys(nations)) {
      stats[nId] = { provinces: 0, totalGarrison: 0, totalGdp: 0 };
    }
    for (const terr of Object.values(territories)) {
      if (!stats[terr.ownerId]) {
        stats[terr.ownerId] = { provinces: 0, totalGarrison: 0, totalGdp: 0 };
      }
      stats[terr.ownerId].provinces += 1;
      stats[terr.ownerId].totalGarrison += terr.garrison;
      stats[terr.ownerId].totalGdp += terr.baseGdp;
    }
    return stats;
  }, [nations, territories]);

  const nationList = useMemo(() => {
    const list = Object.values(nations).sort((a, b) => {
      const gdpA = nationStatsMap[a.id]?.totalGdp || 0;
      const gdpB = nationStatsMap[b.id]?.totalGdp || 0;
      return gdpB - gdpA;
    });

    return list.filter((n) => {
      if (
        filterTab === 'MAJOR' &&
        selectedMode !== 'EMPIRES_1440' &&
        !PRESET_COUNTRIES_2026[n.id]
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        return n.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [nations, nationStatsMap, filterTab, searchQuery, selectedMode]);

  const activeNation = nations[selectedNationId];
  const activeCapId = activeNation?.capitalTerritoryId || selectedNationId;
  const activeTerritory =
    territories[activeCapId] || territories[selectedNationId];
  const activeStats = nationStatsMap[selectedNationId] || {
    provinces: 1,
    totalGarrison: activeTerritory?.garrison || 15000,
    totalGdp: activeTerritory?.baseGdp || 80,
  };
  const activeIdeology = activeNation ? IDEOLOGIES[activeNation.ideology] : null;
  const activeResource = activeTerritory
    ? RESOURCE_INFO[activeTerritory.resource]
    : null;
  const activeScenarioDef =
    GAME_MODES.find((m) => m.id === selectedMode) || GAME_MODES[0];

  const anySubModalOpen =
    showFeedbackModal ||
    showSaveManager ||
    showSettingsModal ||
    showTipsModal ||
    showTimelapseArchive;

  const dialogRef = useAccessibleDialog(
    menuView !== 'MAP_PICKER' && !anySubModalOpen,
    () => undefined,
    { closeOnEscape: false }
  );

  return (
    <div
      ref={dialogRef}
      role={menuView === 'MAP_PICKER' ? undefined : 'dialog'}
      aria-modal={menuView === 'MAP_PICKER' ? undefined : 'true'}
      aria-labelledby={
        menuView === 'MAP_PICKER' ? undefined : 'title-menu-heading'
      }
      tabIndex={menuView === 'MAP_PICKER' ? undefined : -1}
      className={`fixed inset-0 z-40 flex flex-col text-[#f0e6d2] ${
        menuView === 'MAP_PICKER'
          ? 'pointer-events-none bg-transparent'
          : 'bg-[#110f0d] overflow-hidden'
      }`}
    >
      {/* ====================================================================
          STAGE 1: AGE OF HISTORY 3 INSPIRED DUAL-ORIENTATION MAIN MENU
         ==================================================================== */}
      {menuView === 'HOME' && (
        <div
          data-testid="aoh3-home-menu"
          className="relative flex-1 w-full h-full overflow-hidden flex flex-col landscape:flex-row landscape:items-stretch portrait:justify-between"
        >
          {/* Dedicated Orientation-Aware Classical Historical Oil Paintings */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {!backdropBroken ? (
              <picture className="block w-full h-full">
                <source
                  media="(orientation: portrait)"
                  srcSet={menuPortraitArt}
                />
                <img
                  src={menuLandscapeArt}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setBackdropBroken(true)}
                  className="w-full h-full object-cover object-center"
                />
              </picture>
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background:
                    'radial-gradient(circle at 65% 35%, #3a2d1c 0%, #1d1812 52%, #110f0d 100%)',
                }}
              />
            )}

            {/* Landscape Scrim: Keeps right 65% of painting bright & atmospheric */}
            <div className="hidden landscape:block absolute inset-0 bg-gradient-to-r from-[#110f0d]/92 via-[#110f0d]/38 to-[#110f0d]/15" />
            <div className="hidden landscape:block absolute inset-0 bg-gradient-to-t from-[#110f0d]/65 via-transparent to-[#110f0d]/35" />

            {/* Portrait Scrim: Showcases soaring citadel & commander while ensuring bottom button contrast */}
            <div className="hidden portrait:block absolute inset-0 bg-gradient-to-b from-[#110f0d]/72 via-transparent via-45% to-[#110f0d]/95" />
          </div>

          {/* Portrait Top Brand Emblem (Only visible in vertical orientation) */}
          <div className="hidden portrait:flex relative z-10 flex-col items-center text-center px-6 pt-[max(1.75rem,env(safe-area-inset-top,0px))] pb-2 pointer-events-none">
            <h1
              id="title-menu-heading"
              className="font-display text-3xl sm:text-4xl font-extrabold tracking-[0.14em] text-[#f5ecd9] drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]"
            >
              FLODA
            </h1>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.26em] text-[#e0bc78] uppercase drop-shadow">
              <span className="w-8 h-px bg-[#c89d54]/70" />
              <span>Strateji Oyunu</span>
              <span className="w-8 h-px bg-[#c89d54]/70" />
            </div>
          </div>

          {/* AoH3 Framed Vertical Menu Rail (Left side on Landscape, Bottom-centered on Portrait) */}
          <aside className="relative z-10 w-full landscape:w-[300px] sm:landscape:w-[345px] lg:landscape:w-[385px] landscape:h-full portrait:mt-auto portrait:max-w-md portrait:mx-auto p-3 sm:p-5 landscape:p-4 lg:landscape:p-7 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))] flex flex-col justify-center">
            <div className="aoh3-menu-panel rounded-xl px-4 py-4 sm:px-6 sm:py-6 landscape:max-h-full landscape:overflow-y-auto no-scrollbar flex flex-col gap-3 sm:gap-4">
              {/* Landscape Brand Plaque (Hidden on portrait where top emblem shows) */}
              <div className="hidden landscape:block text-center pb-2.5 border-b border-[#c89d54]/30">
                <h1
                  id="title-menu-heading"
                  className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-[0.14em] text-[#f5ecd9] drop-shadow"
                >
                  FLODA
                </h1>
                <div className="mt-1 flex items-center justify-center gap-2.5 text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] text-[#d8b26e] uppercase">
                  <span className="w-6 h-px bg-[#c89d54]/60" />
                  <span>Strateji Oyunu</span>
                  <span className="w-6 h-px bg-[#c89d54]/60" />
                </div>
              </div>

              {/* AoH3 Classic Vertical Command Button Stack */}
              <nav
                aria-label="Ana menü seçenekleri"
                className="flex flex-col gap-2"
              >
                {hasSavedGame && mostRecentSaveMeta && (
                  <button
                    type="button"
                    data-testid="menu-continue-btn"
                    onClick={() => {
                      sound.playClick();
                      onLoadSavedGame();
                    }}
                    className="aoh3-menu-btn-primary w-full min-h-[48px] px-4 py-2.5 rounded-lg flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-display text-sm font-bold tracking-wide leading-tight">
                          Devam Et
                        </span>
                        <span className="block text-[11px] font-medium text-[#2c2112] truncate">
                          {mostRecentSaveMeta.nationName} ·{' '}
                          {mostRecentSaveMeta.gameDateStr}
                        </span>
                      </span>
                    </span>
                    <Play className="w-4 h-4 fill-current shrink-0" />
                  </button>
                )}

                <button
                  type="button"
                  data-testid="menu-new-game-btn"
                  onClick={() => {
                    sound.playClick();
                    setMenuView('NEW_GAME');
                  }}
                  className={`${
                    hasSavedGame ? 'aoh3-menu-btn' : 'aoh3-menu-btn-primary'
                  } w-full min-h-[46px] px-4 py-2.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer`}
                >
                  <span className="flex items-center gap-2.5">
                    <Swords
                      className={`w-4 h-4 shrink-0 ${
                        hasSavedGame ? 'text-[#c89d54]' : 'text-[#15110c]'
                      }`}
                    />
                    <span className="font-display text-sm font-bold tracking-wide">
                      Yeni Oyun
                    </span>
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      hasSavedGame ? 'text-[#b2a58f]' : 'text-[#2c2112]'
                    }`}
                  >
                    {activeScenarioDef.id === 'EMPIRES_1440' ? '1440' : '2026'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="menu-load-game-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowSaveManager(true);
                  }}
                  className="aoh3-menu-btn w-full min-h-[44px] px-4 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <FolderOpen className="w-4 h-4 text-[#c89d54] shrink-0" />
                    <span className="text-sm font-semibold">Oyun Yükle</span>
                  </span>
                  <span className="text-[11px] text-[#9e927d]">Kayıtlar</span>
                </button>

                <button
                  type="button"
                  data-testid="menu-map-picker-btn"
                  onClick={() => {
                    sound.playClick();
                    setMenuView('MAP_PICKER');
                  }}
                  className="aoh3-menu-btn w-full min-h-[44px] px-4 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-[#c89d54] shrink-0" />
                    <span className="text-sm font-semibold">Haritadan Seç</span>
                  </span>
                  <span className="text-[11px] text-[#9e927d]">Canlı Harita</span>
                </button>

                <button
                  type="button"
                  data-testid="menu-timelapse-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowTimelapseArchive(true);
                  }}
                  className="aoh3-menu-btn w-full min-h-[44px] px-4 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Film className="w-4 h-4 text-[#c89d54] shrink-0" />
                    <span className="text-sm font-semibold">Timelapse Arşivi</span>
                  </span>
                  <span className="text-[11px] text-[#9e927d]">Çevrimdışı</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="menu-settings-btn"
                    onClick={() => {
                      sound.playClick();
                      setShowSettingsModal(true);
                    }}
                    className="aoh3-menu-btn min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-[#c89d54] shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                      Ayarlar
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="menu-tips-btn"
                    onClick={() => {
                      sound.playClick();
                      setShowTipsModal(true);
                    }}
                    className="aoh3-menu-btn min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-[#c89d54] shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                      İpuçları
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="open-feedback-btn"
                  onClick={() => {
                    sound.playClick();
                    setShowFeedbackModal(true);
                  }}
                  className="aoh3-menu-btn w-full min-h-[42px] px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquareWarning className="w-4 h-4 text-[#c89d54] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold">
                    Öneri ve Şikayet
                  </span>
                </button>
              </nav>

              {/* Quiet Utility Footer */}
              <div className="pt-2 border-t border-[#c89d54]/20 flex items-center justify-between gap-2 text-[11px] text-[#9e927d]">
                <span className="truncate">
                  {activeNation?.name || 'Osmanlı Devleti'}
                </span>
                <PWAInstallButton compact />
              </div>
            </div>
          </aside>

          {/* Landscape Bottom-Right Subtle Historical Caption */}
          <div className="hidden lg:landscape:flex relative z-10 mt-auto ml-auto p-7 flex-col items-end text-right pointer-events-none">
            <div className="font-display text-sm font-bold tracking-wider text-[#f0e6d2]/90 drop-shadow">
              {activeScenarioDef.name}
            </div>
            <div className="text-xs text-[#d6cbb8]/80 drop-shadow">
              {activeScenarioDef.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          STAGE 2: LIVE MAP PICKER OVERLAY (AoH3 Warm Bronze Theme)
         ==================================================================== */}
      {menuView === 'MAP_PICKER' && (
        <div className="flex-1 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setMenuView('HOME');
              }}
              className="aoh3-menu-btn min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#c89d54]" />
              <span>Ana Menü</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5 bg-[#191612]/95 border border-[#c89d54]/40 rounded-xl p-1.5 shadow-2xl">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onSelectMode(mode.id);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedMode === mode.id
                      ? 'bg-[#c89d54] text-[#110f0d]'
                      : 'bg-[#231f1a] text-[#cfc3ae] hover:text-[#f0e6d2]'
                  }`}
                >
                  {mode.name}
                </button>
              ))}
            </div>
          </div>

          {activeNation && activeTerritory && (
            <div className="pointer-events-auto max-w-xl w-full mx-auto aoh3-menu-panel rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <NationFlagCanvasBadge
                    nationId={activeNation.id}
                    flagCode={activeNation.flagCode}
                    color={activeNation.color}
                    width={46}
                    height={32}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#e0bc78]">
                      Haritadan Seçilen Devlet · {activeStats.provinces} Eyalet
                    </div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate">
                      {activeNation.name}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    sound.playClick();
                    onStartNewGame();
                  }}
                  className="aoh3-menu-btn-primary min-h-[42px] px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Seferi Başlat</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[#14110e] border border-[#3a3228]">
                  <div className="text-[10px] text-[#9e927d]">Hazine</div>
                  <div className="font-mono-num tabular-nums text-xs sm:text-sm font-bold text-[#e0bc78]">
                    {activeNation.treasury.toLocaleString('tr-TR')} Altın
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#14110e] border border-[#3a3228]">
                  <div className="text-[10px] text-[#9e927d]">Toplam Ordu</div>
                  <div className="font-mono-num tabular-nums text-xs sm:text-sm font-bold text-[#d47272]">
                    {(activeStats.totalGarrison / 1000).toFixed(1)}B
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-[#14110e] border border-[#3a3228]">
                  <div className="text-[10px] text-[#9e927d]">Ekonomi</div>
                  <div className="font-mono-num tabular-nums text-xs sm:text-sm font-bold text-[#7ab3cf]">
                    {activeStats.totalGdp} GSYİH
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          STAGE 3: NEW GAME — SCENARIO & NATION SETUP (AoH3 Warm Bronze Theme)
         ==================================================================== */}
      {menuView === 'NEW_GAME' && (
        <div
          data-testid="aoh3-new-game-setup"
          className="relative flex-1 flex flex-col overflow-y-auto"
        >
          {/* Subtle War Room Historical Backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
          >
            {!backdropBroken && (
              <img
                src={warRoomArt}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBackdropBroken(true)}
                className="w-full h-full object-cover opacity-35"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#110f0d]/92 via-[#15120f]/82 to-[#110f0d]/96" />
          </div>

          {/* Clean 3-Zone Setup Header */}
          <header className="title-menu-header sticky top-0 z-20 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-[#c89d54]/35 bg-[#13110e]/95 backdrop-blur-md shadow-xl shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                data-testid="back-to-home-btn"
                onClick={() => {
                  sound.playClick();
                  setMenuView('HOME');
                }}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 text-xs font-semibold text-[#e0bc78] flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ana Menü</span>
              </button>
              <span className="title-menu-brand font-display text-xs sm:text-lg font-bold tracking-wider text-[#f0e6d2] whitespace-nowrap truncate">
                YENİ SEFER KURULUMU
              </span>
            </div>

            <nav
              aria-label="Sefer kurulumu bağlantıları"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-[#cfc3ae]"
            >
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setMenuView('MAP_PICKER');
                }}
                className="hover:text-[#e0bc78] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Haritadan Seç
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setShowSettingsModal(true);
                }}
                className="hover:text-[#e0bc78] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ayarlar
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setShowSaveManager(true);
                }}
                className="hover:text-[#e0bc78] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Oyun Yükle
              </button>
            </nav>

            <div className="title-menu-primary flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  sound.playClick();
                  onStartNewGame();
                }}
                className="aoh3-menu-btn-primary px-3.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] sm:min-h-[42px] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Seferi Başlat</span>
              </button>
            </div>
          </header>

          {/* Setup Content Grid */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Column: Scenario & Nation Dossier */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <section className="aoh3-menu-panel rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
                  <div>
                    <h1
                      id="title-menu-heading"
                      className="font-display text-lg sm:text-xl font-bold text-[#f0e6d2]"
                      style={{ textWrap: 'balance' }}
                    >
                      01. Senaryo ve Dönem Seçimi
                    </h1>
                    <p className="text-xs text-[#b2a58f] mt-0.5">
                      1440 İmparatorluklar Çağı veya 2026 Modern Dünya senaryosunu seçin.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {GAME_MODES.map((mode) => {
                      const isSelected = selectedMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onSelectMode(mode.id);
                          }}
                          className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'bg-[#c89d54]/18 border-[#e0bc78] text-[#f5ecd9] shadow-md'
                              : 'bg-[#15120f]/90 border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                          }`}
                        >
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-[#f0e6d2]">
                              {mode.name}
                            </div>
                            <div className="text-[11px] text-[#e0bc78] mt-0.5">
                              {mode.subtitle}
                            </div>
                          </div>
                          <p className="text-[10px] text-[#a89b86] mt-1 line-clamp-2">
                            {mode.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Selected Nation Dossier Card */}
                {activeNation && activeTerritory && (
                  <section className="aoh3-menu-panel rounded-xl overflow-hidden flex-1 flex flex-col justify-between">
                    <div>
                      <div className="relative h-24 w-full border-b border-[#c89d54]/30">
                        <TerrainPanoramaSvg
                          terrain={activeTerritory.terrain || 'METROPOL'}
                          fortLevel={activeTerritory.buildings.fortress}
                          isCapital
                          className="w-full h-full"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#191612] via-[#191612]/45 to-transparent" />
                        <div className="absolute bottom-2 left-4 right-4 flex items-end justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <NationFlagCanvasBadge
                              nationId={activeNation.id}
                              flagCode={activeNation.flagCode}
                              color={activeNation.color}
                              width={46}
                              height={32}
                            />
                            <div className="min-w-0">
                              <h2 className="font-display text-lg sm:text-xl font-bold text-[#f0e6d2] truncate">
                                {activeNation.name}
                              </h2>
                              <div className="flex items-center gap-2 text-xs text-[#e0bc78] truncate">
                                <span>{activeIdeology?.name}</span>
                                <span aria-hidden="true">·</span>
                                <span>{activeStats.provinces} Eyalet</span>
                                <span aria-hidden="true">·</span>
                                <span>{activeResource?.name}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-xs text-[#cfc3ae] leading-relaxed">
                          {activeIdeology?.description}
                        </p>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#9e927d]">
                              <Coins className="w-3.5 h-3.5 text-[#c89d54]" />
                              <span>Başlangıç Hazinesi</span>
                            </div>
                            <div className="font-mono-num tabular-nums text-base font-bold text-[#e0bc78] mt-0.5">
                              {activeNation.treasury.toLocaleString('tr-TR')} Altın
                            </div>
                          </div>

                          <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#9e927d]">
                              <Shield className="w-3.5 h-3.5 text-[#c95858]" />
                              <span>Toplam Ordu</span>
                            </div>
                            <div className="font-mono-num tabular-nums text-base font-bold text-[#d47272] mt-0.5">
                              {activeStats.totalGarrison.toLocaleString('tr-TR')}{' '}
                              Asker
                            </div>
                          </div>

                          <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#9e927d]">
                              <Users className="w-3.5 h-3.5 text-[#59a373]" />
                              <span>İnsan Gücü</span>
                            </div>
                            <div className="font-mono-num tabular-nums text-base font-bold text-[#6eb887] mt-0.5">
                              {activeNation.manpower.toLocaleString('tr-TR')}
                            </div>
                          </div>

                          <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#9e927d]">
                              <Globe className="w-3.5 h-3.5 text-[#6fa3bd]" />
                              <span>Toplam Ekonomi</span>
                            </div>
                            <div className="font-mono-num tabular-nums text-base font-bold text-[#7ab3cf] mt-0.5">
                              {activeStats.totalGdp} GSYİH
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        type="button"
                        data-start="true"
                        onClick={() => {
                          sound.playClick();
                          onStartNewGame();
                        }}
                        className="aoh3-menu-btn-primary w-full h-12 rounded-lg font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{activeNation.name} İle Seferi Başlat</span>
                      </button>
                    </div>
                  </section>
                )}
              </div>

              {/* Right Column: Nation Roster */}
              <section className="lg:col-span-7 aoh3-menu-panel rounded-xl p-4 sm:p-5 flex flex-col gap-3.5 max-h-[75vh] lg:max-h-none lg:h-0 lg:min-h-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-[#f0e6d2]">
                      02. Medeniyet ve Devlet Seçimi
                    </h2>
                    <p className="text-xs text-[#b2a58f] mt-0.5">
                      Listeden seçin veya doğrudan canlı haritadan devletinizi belirleyin.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#14110e] rounded-lg border border-[#3a3228] self-start">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setFilterTab('MAJOR');
                      }}
                      className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        filterTab === 'MAJOR'
                          ? 'bg-[#c89d54] text-[#110f0d] font-bold'
                          : 'text-[#b2a58f] hover:text-[#f0e6d2]'
                      }`}
                    >
                      Öne Çıkan Güçler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setFilterTab('ALL');
                      }}
                      className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        filterTab === 'ALL'
                          ? 'bg-[#c89d54] text-[#110f0d] font-bold'
                          : 'text-[#b2a58f] hover:text-[#f0e6d2]'
                      }`}
                    >
                      Tüm Devletler ({Object.keys(nations).length})
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-[#9e927d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Medeniyet veya ülke ara"
                    placeholder="Medeniyet veya ülke ara (örn. Osmanlı, Bizans, Memlük, Macaristan, Türkiye)..."
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#14110e] border border-[#3a3228] text-sm text-[#f0e6d2] placeholder:text-[#7f7463] focus:outline-none focus:border-[#c89d54]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 flex-1 min-h-0 max-h-[480px] lg:max-h-none content-start">
                  {nationList.map((nation) => {
                    const nStats = nationStatsMap[nation.id] || {
                      provinces: 1,
                      totalGarrison: 15000,
                      totalGdp: 70,
                    };
                    const isSelected = nation.id === selectedNationId;
                    const ideo = IDEOLOGIES[nation.ideology];
                    return (
                      <button
                        key={nation.id}
                        type="button"
                        onClick={() => {
                          sound.playSelectTerritory();
                          onSelectNation(nation.id);
                        }}
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-all min-h-[64px] cursor-pointer ${
                          isSelected
                            ? 'bg-[#c89d54]/18 border-[#e0bc78] text-[#f5ecd9] shadow-md'
                            : 'bg-[#15120f]/90 border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <NationFlagCanvasBadge
                            nationId={nation.id}
                            flagCode={nation.flagCode}
                            color={nation.color}
                            width={38}
                            height={26}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#f0e6d2] truncate">
                              {nation.name}
                            </div>
                            <div className="text-[11px] text-[#a89b86] truncate">
                              {ideo.name} · {nStats.provinces} Eyalet
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono-num tabular-nums text-xs font-semibold text-[#e0bc78]">
                            {nStats.totalGdp} GSYİH
                          </div>
                          <div className="font-mono-num tabular-nums text-[11px] text-[#6eb887]">
                            {(nStats.totalGarrison / 1000).toFixed(1)}B Asker
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </main>
        </div>
      )}

      <Suspense fallback={null}>
        {showSettingsModal && (
          <MainMenuSettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {showTipsModal && (
          <StrategyTipsModal
            isOpen={showTipsModal}
            onClose={() => setShowTipsModal(false)}
          />
        )}

        {showFeedbackModal && (
          <FeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            activeScenarioName={activeScenarioDef.name}
            uiScale={settings.uiScale || 'STANDARD'}
          />
        )}

        {showSaveManager && (
          <SaveManagerModal
            isOpen={showSaveManager}
            onClose={() => setShowSaveManager(false)}
            onLoadRecord={(rec) => {
              if (onLoadSaveRecord) {
                onLoadSaveRecord(rec);
              } else {
                onLoadSavedGame();
              }
            }}
            onPlayTimelapse={onPlayTimelapse}
            onShowToast={onShowToast}
          />
        )}

        {showTimelapseArchive && (
          <TimelapseArchiveModal
            isOpen={showTimelapseArchive}
            onClose={() => setShowTimelapseArchive(false)}
            onPlayTimelapse={(tl, title) => {
              onPlayTimelapse?.(tl, title);
            }}
            onShowToast={onShowToast}
          />
        )}
      </Suspense>
    </div>
  );
};
