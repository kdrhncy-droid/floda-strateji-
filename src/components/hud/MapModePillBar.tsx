import React, { useState } from 'react';
import {
  Crosshair,
  Hammer,
  Navigation,
  ShieldPlus,
  UserPlus,
  MousePointerClick,
  Info,
  Layers3,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { BuildingType, MapMode, Territory } from '../../types/game';
import {
  BatchRecruitScope,
  BatchRecruitUnitMode,
  SPECIALTY_PRODUCTION_OPTIONS,
  SpecialtyProductionId,
  getSpecialtyOptionForResource,
  getSpecialtyTerritoryEligibility,
} from '../../engine/empireAndArmyActions';
import { isTerritoryCoastal } from '../../engine/worldBuilder';
import { sound } from '../../utils/soundEngine';
import { CULTURES, RELIGIONS } from '../../data/religionAndCultureData';
import { BUILDINGS, RESOURCE_INFO } from '../../data/world2026Data';

export type MapMacroMode =
  | 'NONE'
  | 'RECRUIT_INFANTRY'
  | 'BUILD_ECONOMY'
  | 'BUILD_FORT'
  | 'BATCH_MARCH';

interface MapModePillBarProps {
  mapMode: MapMode;
  macroMode?: MapMacroMode;
  macroRecruitUnitMode?: BatchRecruitUnitMode;
  toastMessage: string | null;
  economySelectedIds?: string[];
  batchMarchSourceIds?: string[];
  batchMarchTargetPicking?: boolean;
  batchMarchRatio?: number;
  territories?: Record<string, Territory>;
  playerTreasury?: number;
  hasBottomCard?: boolean;
  hideWhenDrawerOpen?: boolean;
  outlinerSlot?: React.ReactNode;
  belowTraySlot?: React.ReactNode;
  onSetMapMode: (mode: MapMode) => void;
  onSetMacroMode?: (mode: MapMacroMode) => void;
  onSetMacroRecruitUnitMode?: (unitMode: BatchRecruitUnitMode) => void;
  onBatchRecruitUnits?: (
    scope: BatchRecruitScope,
    unitMode?: BatchRecruitUnitMode,
    territoryId?: string,
    roundsPerCity?: number
  ) => void;
  onToggleEconomyCity?: (territoryId: string) => void;
  onClearEconomyCities?: () => void;
  onToggleBatchCity?: (territoryId: string) => void;
  onSelectReadyBatchCities?: () => void;
  onSelectBorderBatchCities?: () => void;
  onClearBatchCities?: () => void;
  onSetBatchTargetPicking?: (picking: boolean) => void;
  onSetBatchMarchRatio?: (ratio: number) => void;
  onInvestSpecialtyProduction?: (
    territoryIds: string[],
    specialtyId: SpecialtyProductionId
  ) => void;
  onUpgradeBuildingBatch?: (
    building: BuildingType,
    territoryIds?: string[]
  ) => void;
  onDismissToast?: () => void;
}

const MAP_MODES: ReadonlyArray<{ id: MapMode; label: string; glyph: string; tone: string }> = [
  { id: 'POLITICAL', label: 'Siyasi', glyph: '◈', tone: 'text-amber-300' },
  { id: 'ECONOMIC', label: 'Ekonomi', glyph: '◉', tone: 'text-emerald-300' },
  { id: 'RESOURCES', label: 'Kaynaklar', glyph: '⛏', tone: 'text-yellow-300' },
  { id: 'DIPLOMATIC', label: 'Diplomasi', glyph: '⚖', tone: 'text-sky-300' },
  { id: 'MILITARY', label: 'Askeri', glyph: '⚔', tone: 'text-rose-300' },
  { id: 'RELIGION', label: 'Din', glyph: '☪', tone: 'text-emerald-300' },
  { id: 'CULTURE', label: 'Kültür', glyph: '🏹', tone: 'text-violet-300' },
  { id: 'ASSIMILATION', label: 'Asimilasyon', glyph: '✦', tone: 'text-orange-300' },
  { id: 'TERRAIN', label: 'Arazi', glyph: '⌁', tone: 'text-lime-300' },
  { id: 'IDEOLOGY', label: 'İdeoloji', glyph: '◆', tone: 'text-fuchsia-300' },
];

export const MapModePillBar: React.FC<MapModePillBarProps> = ({
  mapMode,
  macroMode = 'NONE',
  macroRecruitUnitMode = 'infantry',
  economySelectedIds = [],
  batchMarchSourceIds = [],
  batchMarchTargetPicking = false,
  batchMarchRatio = 1,
  territories = {},
  playerTreasury = 0,
  hasBottomCard = false,
  hideWhenDrawerOpen = false,
  outlinerSlot,
  belowTraySlot,
  onSetMapMode,
  onSetMacroMode,
  onSetMacroRecruitUnitMode,
  onBatchRecruitUnits,
  onToggleEconomyCity,
  onClearEconomyCities,
  onToggleBatchCity,
  onSelectReadyBatchCities,
  onSelectBorderBatchCities,
  onClearBatchCities,
  onSetBatchTargetPicking,
  onSetBatchMarchRatio,
  onInvestSpecialtyProduction,
  onUpgradeBuildingBatch,
}) => {
  const [legendOpen, setLegendOpen] = useState(true);
  const [openTray, setOpenTray] = useState<'NONE' | 'MODES' | 'MACRO'>('NONE');
  const [macroBodyCollapsed, setMacroBodyCollapsed] = useState(false);

  const hasLegend =
    mapMode === 'ECONOMIC' ||
    mapMode === 'RESOURCES' ||
    mapMode === 'RELIGION' ||
    mapMode === 'CULTURE' ||
    mapMode === 'ASSIMILATION';
  const activeModeMeta = MAP_MODES.find((m) => m.id === mapMode) || MAP_MODES[0];
  const showMacroTray = openTray === 'MACRO' || macroMode !== 'NONE';

  return (
    <>
      <div
        className={`hud-top-overlay hud-mapmode-bar absolute top-2 inset-x-2 z-30 flex flex-col gap-1.5 pointer-events-none ${
          hideWhenDrawerOpen ? 'portrait:max-[900px]:hidden' : ''
        }`}
      >
        {/* Unified Non-Overlapping Top Row: [Map Lenses + Macro] on Left, [Ordular] on Right */}
        <div className="flex flex-wrap items-start justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto flex-wrap">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setOpenTray((prev) => (prev === 'MODES' ? 'NONE' : 'MODES'));
              }}
              className={`hud-mapmode-shell hud-surface min-h-[32px] sm:min-h-[34px] flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-[10.5px] sm:text-[11px] font-bold shadow-lg transition-colors whitespace-nowrap shrink-0 ${
                openTray === 'MODES'
                  ? 'border-amber-400 text-amber-200'
                  : 'border-amber-500/35 text-slate-200 hover:border-amber-400/70'
              }`}
              aria-expanded={openTray === 'MODES'}
              aria-label="Harita katmanlarını aç veya kapat"
            >
              <Layers3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="whitespace-nowrap">
                {activeModeMeta.glyph} {activeModeMeta.label}
              </span>
              {openTray === 'MODES' ? (
                <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              )}
            </button>

            {onSetMacroMode && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  if (macroMode !== 'NONE') {
                    onSetMacroMode('NONE');
                    setOpenTray('NONE');
                    setMacroBodyCollapsed(false);
                  } else {
                    setOpenTray((prev) => (prev === 'MACRO' ? 'NONE' : 'MACRO'));
                  }
                }}
                className={`hud-macro-bar hud-surface min-h-[32px] sm:min-h-[34px] flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-[10.5px] sm:text-[11px] font-bold shadow-lg transition-colors whitespace-nowrap shrink-0 ${
                  macroMode !== 'NONE'
                    ? 'border-emerald-400 bg-emerald-950/90 text-emerald-200'
                    : openTray === 'MACRO'
                    ? 'border-sky-400 text-sky-200'
                    : 'border-slate-700/90 text-slate-300 hover:border-slate-500'
                }`}
                aria-expanded={showMacroTray}
                aria-label="Hızlı işlemleri aç veya kapat"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="whitespace-nowrap">
                  {macroMode === 'NONE'
                    ? 'Hızlı İşlem'
                    : macroMode === 'BUILD_ECONOMY'
                    ? `Ekonomi (${economySelectedIds.length}) ✕`
                    : macroMode === 'BATCH_MARCH'
                    ? `Toplu Sevk (${batchMarchSourceIds.length}) ✕`
                    : 'Aktif İşlem ✕'}
                </span>
                {showMacroTray ? (
                  <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                )}
              </button>
            )}
          </div>

          {outlinerSlot}
        </div>

        {/* Expandable Row: AoH3 Map Lenses */}
        {openTray === 'MODES' && (
          <div className="hud-mapmode-shell hud-surface pointer-events-auto rounded-xl border border-amber-500/40 shadow-xl overflow-hidden max-w-full sm:max-w-[640px]">
            <div className="flex flex-nowrap items-center gap-1 p-1 overflow-x-auto no-scrollbar">
              {MAP_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    sound.playClick();
                    onSetMapMode(m.id);
                    setOpenTray('NONE');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 border border-transparent ${
                    mapMode === m.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm border-amber-300'
                      : `text-slate-300 hover:text-white hover:bg-slate-800/80 ${m.tone}`
                  }`}
                >
                  <span aria-hidden="true" className="text-sm leading-none">{m.glyph}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Row: AoH3 Mobile Macro-Builder & Compact Non-Blocking Multi-City Production Builder */}
        {onSetMacroMode && showMacroTray && (
          <div className="hud-macro-bar hud-macro-tray hud-surface pointer-events-auto rounded-xl border border-slate-700/90 shadow-lg overflow-hidden flex flex-col gap-1 p-1.5 max-w-[min(430px,calc(100vw-1rem))] max-h-[calc(100dvh-9.5rem)] overflow-y-auto">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                <button
                  onClick={() => {
                    sound.playClick();
                    onSetMacroMode('NONE');
                    setOpenTray('NONE');
                    setMacroBodyCollapsed(false);
                  }}
                  title="Normal Eyalet Seçim Modu"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'NONE'
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MousePointerClick className="w-3 h-3 shrink-0" />
                  <span>Seçim</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                    onSetMacroMode(
                      macroMode === 'RECRUIT_INFANTRY' ? 'NONE' : 'RECRUIT_INFANTRY'
                    );
                  }}
                  title="AoH3 Asker Bas & Toplu Seferberlik: Birlik sınıfı seçip haritadan şehirlerinize dokunun veya sınırlara/tüm ülkeye toplu asker basın"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'RECRUIT_INFANTRY'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-emerald-300/90 hover:bg-emerald-500/15'
                  }`}
                >
                  <UserPlus className="w-3 h-3 shrink-0" />
                  <span>
                    <span className="lg:hidden">+Asker</span>
                    <span className="hidden lg:inline">+Asker Bas</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                    onSetMacroMode(
                      macroMode === 'BUILD_ECONOMY' ? 'NONE' : 'BUILD_ECONOMY'
                    );
                  }}
                  title="Şehirleri haritadan seçip İnek Çiftliği, Pamuk Tarlası, Kereste Ocağı veya Maden kurun"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'BUILD_ECONOMY'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-amber-300/90 hover:bg-amber-500/15'
                  }`}
                >
                  <Hammer className="w-3 h-3 shrink-0" />
                  <span>
                    <span className="lg:hidden">Ekonomi</span>
                    <span className="hidden lg:inline">Ekonomi Kur</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                    onSetMacroMode(
                      macroMode === 'BUILD_FORT' ? 'NONE' : 'BUILD_FORT'
                    );
                  }}
                  title="AoH3 Makro Tahkimat: Haritada kendi eyaletinize dokunarak Kale/Hisar yükseltin"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'BUILD_FORT'
                      ? 'bg-sky-500 text-slate-950 shadow'
                      : 'text-sky-300/90 hover:bg-sky-500/15'
                  }`}
                >
                  <ShieldPlus className="w-3 h-3 shrink-0" />
                  <span>
                    <span className="lg:hidden">Kale</span>
                    <span className="hidden lg:inline">Kale Kur</span>
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="macro-batch-march-btn"
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                    onSetMacroMode(
                      macroMode === 'BATCH_MARCH' ? 'NONE' : 'BATCH_MARCH'
                    );
                  }}
                  title="Çoklu Şehir Ordu Sevk: Birden fazla şehri seçip aynı hedefe tek komutla yürütün"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'BATCH_MARCH'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-amber-200 hover:bg-amber-500/15'
                  }`}
                >
                  <Navigation className="w-3 h-3 shrink-0" />
                  <span>
                    <span className="lg:hidden">Sevk</span>
                    <span className="hidden lg:inline">Toplu Sevk</span>
                  </span>
                </button>
              </div>
            </div>

            {/* AoH3 Multi-Unit & Batch Recruitment Panel when "+Asker Bas" is active */}
            {macroMode === 'RECRUIT_INFANTRY' && !macroBodyCollapsed && (
              <div
                data-testid="recruit-macro-panel"
                className="rounded-lg bg-[#14110e]/95 border border-emerald-500/50 p-1.5 flex flex-col gap-1.5 shadow-xl"
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-emerald-200 font-bold truncate">
                    ⚔️ Haritadan şehrinize dokunarak asker basın:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setMacroBodyCollapsed(true);
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-emerald-200 font-bold flex items-center gap-0.5 cursor-pointer shrink-0"
                  >
                    <span>Haritayı Gör</span>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>

                {/* Unit Class Selector */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    {
                      id: 'infantry' as const,
                      label: '🛡 Piyade',
                      sub: '120A / 1B',
                      active: 'bg-emerald-500 text-slate-950 border-emerald-300',
                      idle: 'bg-slate-900 text-emerald-200 border-emerald-500/40',
                    },
                    {
                      id: 'armor' as const,
                      label: '🐎 Süvari',
                      sub: '180A / 1B',
                      active: 'bg-amber-500 text-slate-950 border-amber-300',
                      idle: 'bg-slate-900 text-amber-200 border-amber-500/40',
                    },
                    {
                      id: 'airDrone' as const,
                      label: '💣 Topçu',
                      sub: '500A / 1B',
                      active: 'bg-sky-400 text-slate-950 border-sky-200',
                      idle: 'bg-slate-900 text-sky-200 border-sky-500/40',
                    },
                    {
                      id: 'MIXED' as const,
                      label: '⚔️ Karma',
                      sub: '3 Sınıf',
                      active: 'bg-purple-500 text-white border-purple-300',
                      idle: 'bg-slate-900 text-purple-200 border-purple-500/40',
                    },
                  ].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      data-testid={`macro-unit-mode-${u.id}`}
                      onClick={() => {
                        sound.playClick();
                        onSetMacroRecruitUnitMode?.(u.id);
                      }}
                      className={`px-1.5 py-1 rounded-lg border text-center transition-colors cursor-pointer ${
                        macroRecruitUnitMode === u.id ? u.active : u.idle
                      }`}
                    >
                      <div className="text-[10px] font-extrabold truncate">{u.label}</div>
                      <div className="text-[8.5px] font-mono-num opacity-85">{u.sub}</div>
                    </button>
                  ))}
                </div>

                {/* One-Click Batch Recruitment Buttons */}
                {onBatchRecruitUnits && (
                  <div className="grid grid-cols-3 gap-1 pt-0.5 border-t border-slate-800/80">
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-border"
                      onClick={() =>
                        onBatchRecruitUnits('BORDER', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-emerald-600/85 hover:bg-emerald-500 text-white text-[9.5px] font-extrabold text-center cursor-pointer"
                    >
                      🛡 Sınırlara Toplu Bas
                    </button>
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-barracks"
                      onClick={() =>
                        onBatchRecruitUnits('BARRACKS', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9.5px] font-extrabold text-center cursor-pointer"
                    >
                      🏰 Kışlalara Toplu Bas
                    </button>
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-all"
                      onClick={() =>
                        onBatchRecruitUnits('ALL', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-sky-600/85 hover:bg-sky-500 text-white text-[9.5px] font-extrabold text-center cursor-pointer"
                    >
                      🌍 Tüm Ülkeye Toplu Bas
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Collapsed Mini Status Strip (keeps 85%+ of map open for tapping cities!) */}
            {macroBodyCollapsed && (macroMode === 'BUILD_ECONOMY' || macroMode === 'BATCH_MARCH') && (
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/50 border border-slate-800 text-[10px] text-amber-200">
                <span className="truncate font-semibold">
                  {macroMode === 'BUILD_ECONOMY'
                    ? `📍 Haritadan şehir dokunun (${economySelectedIds.length} seçili)`
                    : `🎯 Haritadan ordu şehri dokunun (${batchMarchSourceIds.length} seçili)`}
                </span>
                <button
                  type="button"
                  data-testid="macro-tray-collapse-btn"
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Paneli Aç ({macroMode === 'BUILD_ECONOMY' ? economySelectedIds.length : batchMarchSourceIds.length})</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Multi-City Production & Farm Selector Panel when "Ekonomi Kur" is active */}
            {macroMode === 'BUILD_ECONOMY' && !macroBodyCollapsed && (() => {
              const selectedTerrs = economySelectedIds
                .map((id) => territories[id])
                .filter((t): t is Territory => Boolean(t));
              const matchingByResource: Record<string, Territory[]> = {};
              for (const t of selectedTerrs) {
                if (!matchingByResource[t.resource]) {
                  matchingByResource[t.resource] = [];
                }
                matchingByResource[t.resource].push(t);
              }
              const availableOptions = SPECIALTY_PRODUCTION_OPTIONS.filter(
                (opt) => (matchingByResource[opt.resource]?.length || 0) > 0
              );

              const autoEligiblePairs = selectedTerrs
                .map((t) => ({
                  t,
                  opt: getSpecialtyOptionForResource(t.resource),
                }))
                .filter(({ t, opt }) => getSpecialtyTerritoryEligibility(t, opt).eligible);

              const autoNaturalCost = autoEligiblePairs.reduce(
                (sum, pair) => sum + pair.opt.costGold,
                0
              );
              const canAffordAuto =
                autoEligiblePairs.length > 0 && playerTreasury >= autoNaturalCost;

              const shipyardDef = BUILDINGS.find((b) => b.id === 'shipyard');
              const eligibleShipyardCities = selectedTerrs.filter((t) => {
                if (!isTerritoryCoastal(t)) return false;
                if ((t.buildings?.shipyard || 0) >= (shipyardDef?.maxLevel ?? 5))
                  return false;
                if ((t.constructionQueue || []).some((q) => q.building === 'shipyard'))
                  return false;
                return true;
              });
              const shipyardTotalCost = eligibleShipyardCities.reduce(
                (sum, t) =>
                  sum +
                  Math.round(
                    (shipyardDef?.baseCost ?? 520) *
                      Math.pow(1.35, t.buildings?.shipyard || 0)
                  ),
                0
              );

              return (
                <div
                  data-testid="economy-macro-panel"
                  className="rounded-lg bg-[#14110e]/95 border border-[#caa15a]/50 p-1.5 flex flex-col gap-1.5 shadow-xl"
                >
                  <div className="flex items-center justify-between gap-1.5 text-[10px]">
                    <span className="text-amber-200 font-bold truncate">
                      {selectedTerrs.length === 0
                        ? 'Haritada şehirlerinize dokunun'
                        : `${selectedTerrs.length} şehir · Süreli & Sv.5`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {selectedTerrs.length > 0 && onClearEconomyCities && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onClearEconomyCities();
                          }}
                          className="px-1.5 py-0.5 rounded bg-black/60 hover:bg-black/80 border border-[#caa15a]/30 text-[#d8cbb5] font-semibold cursor-pointer"
                        >
                          Temizle
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="macro-tray-collapse-btn"
                        onClick={() => {
                          sound.playClick();
                          setMacroBodyCollapsed(true);
                        }}
                        title="Haritadan rahat şehir seçmek için menüyü küçült"
                        className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 text-amber-200 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Haritayı Gör</span>
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {selectedTerrs.length > 0 && (
                    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                      {selectedTerrs.map((t) => {
                        const resMeta = RESOURCE_INFO[t.resource];
                        const opt = getSpecialtyOptionForResource(t.resource);
                        const elig = getSpecialtyTerritoryEligibility(t, opt);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onToggleEconomyCity?.(t.id)}
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                              elig.reason === 'MAXED'
                                ? 'bg-slate-900/80 border-slate-700 text-slate-400'
                                : elig.reason === 'IN_PROGRESS'
                                ? 'bg-sky-950/70 border-sky-500/50 text-sky-200'
                                : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-500/50 text-amber-100'
                            }`}
                          >
                            <span>{resMeta?.icon || '🏭'}</span>
                            <span>{t.name.replace(/^★\s*/, '')}</span>
                            <span className="font-mono-num text-[9px] opacity-80">
                              {elig.reason === 'IN_PROGRESS'
                                ? '⏳'
                                : `${elig.currentLvl}/${elig.maxLvl}`}
                            </span>
                            <span className="text-amber-300/80">✕</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedTerrs.length > 0 && (
                    <>
                      {selectedTerrs.length > 1 && availableOptions.length > 1 && (
                        <button
                          type="button"
                          disabled={autoEligiblePairs.length === 0}
                          onClick={() => {
                            onInvestSpecialtyProduction?.(
                              economySelectedIds,
                              'AUTO_NATURAL'
                            );
                          }}
                          className={`w-full px-2 py-1 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            canAffordAuto
                              ? 'bg-gradient-to-r from-amber-600/30 to-emerald-600/25 hover:from-amber-500/40 hover:to-emerald-500/35 border-amber-400/70 text-amber-100'
                              : 'bg-black/45 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs shrink-0">⚡</span>
                            <span className="text-[10px] font-extrabold truncate">
                              {autoEligiblePairs.length > 0
                                ? `Uygun Tesisleri Başlat (${autoEligiblePairs.length}/${selectedTerrs.length} Şehir)`
                                : 'Seçili Şehirlerin Hepsi Azami / İnşada'}
                            </span>
                          </div>
                          {autoEligiblePairs.length > 0 && (
                            <span className="text-[10px] font-mono-num font-extrabold text-amber-300 shrink-0">
                              {autoNaturalCost}A
                            </span>
                          )}
                        </button>
                      )}

                      <div className="grid grid-cols-2 gap-1 max-h-[155px] overflow-y-auto pr-0.5">
                        {availableOptions.map((opt) => {
                          const matchingCities = matchingByResource[opt.resource] || [];
                          const eligResults = matchingCities.map((c) => ({
                            city: c,
                            ...getSpecialtyTerritoryEligibility(c, opt),
                          }));
                          const eligibleCities = eligResults.filter((r) => r.eligible);
                          const maxedCount = eligResults.filter((r) => r.reason === 'MAXED').length;
                          const queuedCount = eligResults.filter((r) => r.reason === 'IN_PROGRESS').length;
                          const matchingIds = eligibleCities.map((r) => r.city.id);
                          const totalCost = opt.costGold * eligibleCities.length;
                          const canAfford = eligibleCities.length > 0 && playerTreasury >= totalCost;
                          const isLocked = eligibleCities.length === 0;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isLocked}
                              onClick={() => {
                                onInvestSpecialtyProduction?.(matchingIds, opt.id);
                              }}
                              title={opt.description}
                              className={`px-2 py-1 rounded-lg border text-left transition-colors flex items-center justify-between gap-1 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
                                isLocked
                                  ? 'bg-slate-950/75 border-slate-800 text-slate-400'
                                  : canAfford
                                  ? 'bg-black/55 hover:bg-amber-500/20 border-[#caa15a]/50 text-amber-100'
                                  : 'bg-black/40 border-rose-500/35 text-rose-300'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs shrink-0">{opt.icon}</span>
                                  <span className="text-[10px] font-bold truncate">
                                    {opt.shortName} ({eligibleCities.length}/{matchingCities.length})
                                  </span>
                                </div>
                                <div className="text-[9px] text-[#c5b79e] truncate font-mono-num">
                                  {isLocked
                                    ? queuedCount > 0
                                      ? '🔨 İnşa Sürüyor'
                                      : '✓ Azami 5/5'
                                    : `⏳ ${opt.buildDays}g · +${opt.gdpBonus} GSYİH`}
                                  {!isLocked && maxedCount > 0 ? ` · ${maxedCount} tam` : ''}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono-num font-bold text-amber-300 shrink-0">
                                {isLocked ? '—' : `${totalCost}A`}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {eligibleShipyardCities.length > 0 && onUpgradeBuildingBatch && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpgradeBuildingBatch(
                              'shipyard',
                              eligibleShipyardCities.map((c) => c.id)
                            )
                          }
                          className={`w-full px-2 py-1 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            playerTreasury >= shipyardTotalCost
                              ? 'bg-sky-950/75 hover:bg-sky-900/80 border-sky-400/55 text-sky-100'
                              : 'bg-black/45 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <span className="text-[10px] font-bold truncate">
                            ⚓ Kıyı Limanı & Tersane ({eligibleShipyardCities.length}/{selectedTerrs.length} Kıyı)
                          </span>
                          <span className="text-[10px] font-mono-num font-bold text-amber-300 shrink-0">
                            {shipyardTotalCost}A
                          </span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Multi-City Batch Army Dispatch Panel when "Toplu Sevk" is active */}
            {macroMode === 'BATCH_MARCH' && !macroBodyCollapsed && (() => {
              const selectedArmies = batchMarchSourceIds
                .map((id) => territories[id])
                .filter((t): t is Territory => Boolean(t));

              const stagedTroops = selectedArmies.reduce((sum, t) => {
                const sendable = Math.max(0, Math.floor(t.garrison - 500));
                const amt = Math.min(sendable, Math.round(sendable * batchMarchRatio));
                return sum + (amt >= 1000 ? amt : 0);
              }, 0);

              const readyCityCount = selectedArmies.filter((t) => {
                const sendable = Math.max(0, Math.floor(t.garrison - 500));
                return Math.min(sendable, Math.round(sendable * batchMarchRatio)) >= 1000;
              }).length;

              return (
                <div
                  data-testid="batch-march-panel"
                  className="rounded-lg bg-[#14110e]/95 border border-sky-400/50 p-1.5 flex flex-col gap-1.5 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <span className="text-sky-200 font-bold truncate">
                      {batchMarchTargetPicking
                        ? '🎯 Haritadan HEDEF şehre dokunun!'
                        : `Kaynak şehir seçin (${selectedArmies.length})`}
                    </span>
                    <div className="flex items-center gap-1">
                      {onSelectReadyBatchCities && (
                        <button
                          type="button"
                          data-testid="batch-select-ready-btn"
                          onClick={() => {
                            sound.playClick();
                            onSelectReadyBatchCities();
                          }}
                          className="px-1.5 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/45 text-emerald-200 font-semibold cursor-pointer"
                        >
                          Hazır
                        </button>
                      )}
                      {onSelectBorderBatchCities && (
                        <button
                          type="button"
                          data-testid="batch-select-border-btn"
                          onClick={() => {
                            sound.playClick();
                            onSelectBorderBatchCities();
                          }}
                          className="px-1.5 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/45 text-amber-200 font-semibold cursor-pointer"
                        >
                          Sınır
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid="macro-tray-collapse-btn"
                        onClick={() => {
                          sound.playClick();
                          setMacroBodyCollapsed(true);
                        }}
                        title="Haritadan rahat şehir seçmek için menüyü küçült"
                        className="px-1.5 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 text-amber-200 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Haritayı Gör</span>
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      {selectedArmies.length > 0 && onClearBatchCities && (
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onClearBatchCities();
                          }}
                          className="px-1.5 py-0.5 rounded bg-black/60 hover:bg-black/80 border border-slate-700 text-[#d8cbb5] font-semibold cursor-pointer"
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedArmies.length > 0 && (
                    <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar pb-0.5">
                      {selectedArmies.map((t) => {
                        const sendable = Math.max(0, Math.floor(t.garrison - 500));
                        const sendAmt = Math.min(
                          sendable,
                          Math.round(sendable * batchMarchRatio)
                        );
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onToggleBatchCity?.(t.id)}
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                              sendAmt >= 1000
                                ? 'bg-sky-500/20 hover:bg-sky-500/35 border-sky-400/55 text-sky-100'
                                : 'bg-rose-950/50 border-rose-500/45 text-rose-200'
                            }`}
                          >
                            <span>{t.name.replace(/^★\s*/, '')}</span>
                            <span className="font-mono-num text-amber-300">
                              {(sendAmt / 1000).toFixed(1)}B
                            </span>
                            <span className="opacity-75">✕</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1">
                      {[0.25, 0.5, 0.75, 1].map((r) => {
                        const active = Math.abs(batchMarchRatio - r) < 0.01;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              sound.playClick();
                              onSetBatchMarchRatio?.(r);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold border cursor-pointer ${
                              active
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            %{Math.round(r * 100)}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      data-testid="batch-pick-target-btn"
                      disabled={readyCityCount === 0}
                      onClick={() => {
                        sound.playClick();
                        onSetBatchTargetPicking?.(!batchMarchTargetPicking);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                        batchMarchTargetPicking
                          ? 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white shadow'
                          : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 border-amber-200 text-slate-950 shadow'
                      }`}
                    >
                      <Crosshair className="w-3 h-3 shrink-0" />
                      <span>
                        {batchMarchTargetPicking
                          ? `Hedefe Tıklayın (${(stagedTroops / 1000).toFixed(1)}B) · İptal`
                          : `Hedef Seç (${readyCityCount}Ş · ${(stagedTroops / 1000).toFixed(1)}B)`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Contextual Below-Tray Slot (Live War Badges etc. — flows below open trays, zero overlap!) */}
        {belowTraySlot}
      </div>

      {/* Floating AoH3 Map Legend Card — shifts cleanly or yields to SelectedProvinceBar on mobile */}
      {hasLegend && !hasBottomCard && (
        <div className="absolute bottom-3 left-2.5 z-20 pointer-events-auto max-w-[min(260px,calc(100vw-1.25rem))] sm:max-w-[290px] bg-[#090e1a]/95 rounded-xl border border-amber-500/35 shadow-2xl backdrop-blur-md overflow-hidden text-slate-200">
          <button
            type="button"
            onClick={() => setLegendOpen(!legendOpen)}
            aria-expanded={legendOpen}
            aria-controls="map-mode-legend-content"
            className="w-full min-h-[38px] flex items-center justify-between px-2.5 py-1.5 bg-slate-900/80 cursor-pointer select-none border-b border-slate-800 text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Info aria-hidden="true" className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {mapMode === 'ECONOMIC' && 'Şehir Gelişim Puanı & Ekonomi'}
                {mapMode === 'RESOURCES' && 'Üretim Kaynakları & Değerleri'}
                {mapMode === 'RELIGION' && 'Din Haritası Lejantı'}
                {mapMode === 'CULTURE' && 'Kültür Haritası Lejantı'}
                {mapMode === 'ASSIMILATION' && 'Asimilasyon (Core) Lejantı'}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-400 hover:text-white p-0.5">
              {legendOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {legendOpen && (
            <div id="map-mode-legend-content" className="p-2 flex flex-col gap-1.5 max-h-[min(175px,calc(100dvh-14rem))] sm:max-h-[min(210px,calc(100dvh-14rem))] overflow-y-auto no-scrollbar text-[11px]">
              {mapMode === 'ECONOMIC' && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-amber-200/90 leading-snug">
                    Bina ve teknoloji yatırımı arttıkça şehrin <strong>Gelişim Puanı (★P)</strong> yükselir ve harita rengi koyu zümrüte döner:
                  </p>
                  {[
                    { color: '#042F2E', title: '88+ Puan · İmparatorluk Metropolü', desc: 'Çok koyu zümrüt — en yüksek üretim ve vergi merkezi' },
                    { color: '#064E3B', title: '70–87 Puan · Kalkınmış Sanayi Şehri', desc: 'Koyu zümrüt — gelişmiş sanayi ve liman yatırımı' },
                    { color: '#047857', title: '54–69 Puan · Gelişen Ticaret Sancağı', desc: 'Derin yeşil — orta-üst ekonomik kapasite' },
                    { color: '#10B981', title: '28–53 Puan · Orta Ölçekli Eyalet', desc: 'Canlı yeşil — yatırıma açık gelişmekte olan şehir' },
                    { color: '#6EE7B7', title: '<28 Puan · Kırsal Taşra', desc: 'Açık nane — henüz bina yatırımı yapılmamış bölge' },
                  ].map((tier) => (
                    <div key={tier.title} className="flex items-center gap-2 p-1 rounded bg-slate-800/50 border border-slate-700/50">
                      <span className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20" style={{ backgroundColor: tier.color }} />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-100 block truncate">{tier.title}</span>
                        <span className="text-[9px] text-slate-400 block truncate">{tier.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mapMode === 'RESOURCES' && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-amber-200/90 leading-snug">
                    Her kaynağın ham taban değeri vardır; ancak <strong>Sanayi, Liman ve Teknoloji yatırımı</strong> yapılan bir Pamuk/Odun şehri, yatırımsız Petrol/Altın şehrini geçer!
                  </p>
                  {Object.entries(RESOURCE_INFO).map(([resId, r]) => (
                    <div
                      key={resId}
                      className="flex items-center justify-between gap-1.5 p-1 rounded bg-slate-800/45 border border-slate-700/40"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                          style={{ backgroundColor: `${r.color}33`, border: `1px solid ${r.color}` }}
                        >
                          {r.icon}
                        </span>
                        <span className="font-bold text-slate-100 truncate">{r.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-num text-amber-300 font-bold shrink-0">
                        Ham {r.baseValue}A
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {mapMode === 'RELIGION' &&
                Object.values(RELIGIONS).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-1.5 p-1 rounded bg-slate-800/40 border border-slate-700/40"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 shadow-sm flex items-center justify-center text-[9px] text-white font-bold"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.symbol}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 truncate">
                          {r.name}
                        </span>
                        <span className="text-[9px] text-emerald-300 font-mono">
                          +{r.moralBonus}% M / +{r.stabilityBonus}% S
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                        {r.description}
                      </p>
                    </div>
                  </div>
                ))}

              {mapMode === 'CULTURE' &&
                Object.values(CULTURES).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-1.5 p-1 rounded bg-slate-800/40 border border-slate-700/40"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-100 block truncate">
                        {c.name}
                      </span>
                      <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                        {c.description}
                      </p>
                    </div>
                  </div>
                ))}

              {mapMode === 'ASSIMILATION' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 p-1.5 rounded bg-emerald-950/40 border border-emerald-500/40">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 shadow" />
                    <div>
                      <span className="font-bold text-emerald-300 block">
                        Öz Vatan (%100 Core)
                      </span>
                      <span className="text-[10px] text-slate-300">
                        Milli vatan toprağı. Tam vergi ve ordu toplama.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-amber-950/40 border border-amber-500/40">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0 shadow animate-pulse" />
                    <div>
                      <span className="font-bold text-amber-300 block">
                        Asimilasyon Sürecinde
                      </span>
                      <span className="text-[10px] text-slate-300">
                        Gün gün idari entegrasyon devam ediyor.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-red-950/40 border border-red-500/40">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0 shadow" />
                    <div>
                      <span className="font-bold text-red-300 block">
                        Yabancı / Entegre Değil
                      </span>
                      <span className="text-[10px] text-slate-300">
                        Yüksek isyan riski ve düşük vergi. Eyalet panelinden
                        Asimile Et seçin.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
