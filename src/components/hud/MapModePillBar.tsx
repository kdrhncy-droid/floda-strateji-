import React, { useState } from 'react';
import {
  Crosshair,
  Hammer,
  Navigation,
  ShieldPlus,
  UserPlus,
  MousePointerClick,
  Info,
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
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  ReligionSvg,
  ResourceSvg,
} from '../illustrations/AoH3Illustrations';

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
  /** AoH3 selected-province flag chips, shown directly under the tool row. */
  selectionChipsSlot?: React.ReactNode;
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
  selectionChipsSlot,
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
                    ? 'border-[#e0b86e] bg-[#2a2117] text-[#f3ead7]'
                    : openTray === 'MACRO'
                    ? 'border-[#e0b86e] text-[#e0b86e]'
                    : 'border-[#caa15a]/35 text-[#d8cbb5] hover:border-[#e0b86e]'
                }`}
                aria-expanded={showMacroTray}
                aria-label="Hızlı işlemleri aç veya kapat"
              >
                <MousePointerClick className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                <span className="whitespace-nowrap inline-flex items-center gap-1">
                  {macroMode === 'NONE'
                    ? 'Hızlı İşlem'
                    : macroMode === 'BUILD_ECONOMY'
                    ? `Ekonomi (${economySelectedIds.length})`
                    : macroMode === 'BATCH_MARCH'
                    ? `Toplu Sevk (${batchMarchSourceIds.length})`
                    : 'Aktif İşlem'}
                  {macroMode !== 'NONE' && <X className="w-3 h-3 shrink-0" />}
                </span>
                {showMacroTray ? (
                  <ChevronUp className="w-3 h-3 text-[#b8a990] shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-[#b8a990] shrink-0" />
                )}
              </button>
            )}
          </div>

          {outlinerSlot}
        </div>

        {selectionChipsSlot ? (
          <div className="pointer-events-auto max-w-full">{selectionChipsSlot}</div>
        ) : null}

        {/* Expandable Row: AoH3 Mobile Macro-Builder & Compact Non-Blocking Multi-City Production Builder */}
        {onSetMacroMode && showMacroTray && (
          <div className="hud-macro-bar hud-macro-tray hud-surface pointer-events-auto rounded-xl border border-[#caa15a]/45 shadow-lg overflow-hidden flex flex-col gap-1 p-1.5 max-w-[min(560px,calc(100vw-1rem))] max-h-[calc(100dvh-9.5rem)] overflow-y-auto">
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
                      ? 'bg-[#241c13] text-[#e0b86e] border border-[#caa15a]/45'
                      : 'text-[#b8a990] hover:text-[#f3ead7]'
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
                  title="Asker Bas & Toplu Seferberlik: Birlik sınıfı seçip haritadan şehirlerinize dokunun veya sınırlara/tüm ülkeye toplu asker basın"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'RECRUIT_INFANTRY'
                      ? 'bg-[#caa15a] text-[#14100c] shadow'
                      : 'text-[#d8cbb5] hover:bg-[#caa15a]/15 hover:text-[#f3ead7]'
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
                      ? 'bg-[#caa15a] text-[#14100c] shadow'
                      : 'text-[#d8cbb5] hover:bg-[#caa15a]/15 hover:text-[#f3ead7]'
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
                  title="Makro Tahkimat: Haritada kendi eyaletinize dokunarak Kale/Hisar yükseltin"
                  className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    macroMode === 'BUILD_FORT'
                      ? 'bg-[#caa15a] text-[#14100c] shadow'
                      : 'text-[#d8cbb5] hover:bg-[#caa15a]/15 hover:text-[#f3ead7]'
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
                      ? 'bg-[#caa15a] text-[#14100c] shadow'
                      : 'text-[#d8cbb5] hover:bg-[#caa15a]/15 hover:text-[#f3ead7]'
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
                className="rounded-lg bg-[#14110e]/95 border border-[#caa15a]/50 p-1.5 flex flex-col gap-1.5 shadow-xl"
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-[#e0b86e] font-bold truncate flex items-center gap-1">
                    <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
                    <span className="truncate">Haritadan şehrinize dokunarak asker basın:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setMacroBodyCollapsed(true);
                    }}
                    className="px-1.5 py-0.5 rounded bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/40 text-[#e0b86e] font-bold flex items-center gap-0.5 cursor-pointer shrink-0"
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
                      glyph: 'shield' as const,
                      label: 'Piyade',
                      sub: '120A / 1B',
                    },
                    {
                      id: 'armor' as const,
                      glyph: 'cavalry' as const,
                      label: 'Süvari',
                      sub: '180A / 1B',
                    },
                    {
                      id: 'airDrone' as const,
                      glyph: 'artillery' as const,
                      label: 'Topçu',
                      sub: '500A / 1B',
                    },
                    {
                      id: 'MIXED' as const,
                      glyph: 'sword' as const,
                      label: 'Karma',
                      sub: '3 Sınıf',
                    },
                  ].map((u) => {
                    const isActive = macroRecruitUnitMode === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        data-testid={`macro-unit-mode-${u.id}`}
                        onClick={() => {
                          sound.playClick();
                          onSetMacroRecruitUnitMode?.(u.id);
                        }}
                        className={`px-1.5 py-1 rounded-lg border text-center transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7]'
                            : 'bg-[#1b1510] text-[#d8cbb5] border-[#caa15a]/35 hover:border-[#e0b86e]'
                        }`}
                      >
                        <div className="text-[10px] font-extrabold truncate flex items-center justify-center gap-1">
                          <AoH3GlyphSvg name={u.glyph} className="w-3 h-3 shrink-0" />
                          <span>{u.label}</span>
                        </div>
                        <div className="text-[8.5px] font-mono-num opacity-85">{u.sub}</div>
                      </button>
                    );
                  })}
                </div>

                {/* One-Click Batch Recruitment Buttons */}
                {onBatchRecruitUnits && (
                  <div className="grid grid-cols-3 gap-1 pt-0.5 border-t border-[#3a2f22]">
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-border"
                      onClick={() =>
                        onBatchRecruitUnits('BORDER', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[#f3ead7] text-[9.5px] font-extrabold text-center cursor-pointer flex items-center justify-center gap-1"
                    >
                      <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                      <span>Sınırlara Toplu</span>
                    </button>
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-barracks"
                      onClick={() =>
                        onBatchRecruitUnits('BARRACKS', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-[#caa15a] hover:bg-[#e0b86e] text-[#14100c] text-[9.5px] font-extrabold text-center cursor-pointer flex items-center justify-center gap-1"
                    >
                      <AoH3GlyphSvg name="fortress" className="w-3 h-3 shrink-0" />
                      <span>Kışlalara Toplu</span>
                    </button>
                    <button
                      type="button"
                      data-testid="macro-batch-recruit-all"
                      onClick={() =>
                        onBatchRecruitUnits('ALL', macroRecruitUnitMode, undefined, 1)
                      }
                      className="px-1.5 py-1 rounded-lg bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[#e0b86e] text-[9.5px] font-extrabold text-center cursor-pointer flex items-center justify-center gap-1"
                    >
                      <AoH3GlyphSvg name="globe" className="w-3 h-3 shrink-0" />
                      <span>Tüm Ülkeye</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Collapsed Mini Status Strip (keeps 85%+ of map open for tapping cities!) */}
            {macroBodyCollapsed && (macroMode === 'BUILD_ECONOMY' || macroMode === 'BATCH_MARCH') && (
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/50 border border-[#3a2f22] text-[10px] text-[#f3ead7]">
                <span className="truncate font-semibold flex items-center gap-1">
                  <AoH3GlyphSvg name={macroMode === 'BUILD_ECONOMY' ? 'pin' : 'compass'} className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  <span className="truncate">
                    {macroMode === 'BUILD_ECONOMY'
                      ? `Haritadan şehir dokunun (${economySelectedIds.length} seçili)`
                      : `Haritadan ordu şehri dokunun (${batchMarchSourceIds.length} seçili)`}
                  </span>
                </span>
                <button
                  type="button"
                  data-testid="macro-tray-collapse-btn"
                  onClick={() => {
                    sound.playClick();
                    setMacroBodyCollapsed(false);
                  }}
                  className="px-2 py-0.5 rounded bg-[#caa15a] text-[#14100c] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
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
                    <span className="text-[#e0b86e] font-bold truncate">
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
                        className="px-1.5 py-0.5 rounded bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/40 text-[#e0b86e] font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Haritayı Gör</span>
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {selectedTerrs.length > 0 && (
                    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                      {selectedTerrs.map((t) => {
                        const opt = getSpecialtyOptionForResource(t.resource);
                        const elig = getSpecialtyTerritoryEligibility(t, opt);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onToggleEconomyCity?.(t.id)}
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                              elig.reason === 'MAXED'
                                ? 'bg-[#1b1510] border-[#3a2f22] text-[#9b8d77]'
                                : elig.reason === 'IN_PROGRESS'
                                ? 'bg-[#241c13] border-[#caa15a]/60 text-[#e0b86e]'
                                : 'bg-[#caa15a]/20 hover:bg-[#caa15a]/35 border-[#caa15a]/50 text-[#f3ead7]'
                            }`}
                          >
                            <ResourceSvg resource={t.resource} className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            <span>{t.name.replace(/^★\s*/, '')}</span>
                            <span className="font-mono-num text-[9px] opacity-80 inline-flex items-center gap-0.5">
                              {elig.reason === 'IN_PROGRESS' ? (
                                <AoH3GlyphSvg name="hammer" className="w-2.5 h-2.5 shrink-0" />
                              ) : (
                                `${elig.currentLvl}/${elig.maxLvl}`
                              )}
                            </span>
                            <X className="w-2.5 h-2.5 text-[#e0b86e] shrink-0" />
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
                              ? 'bg-[#2a2117] hover:bg-[#382b1d] border-[#caa15a]/70 text-[#f3ead7]'
                              : 'bg-black/45 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AoH3GlyphSvg name="bolt" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            <span className="text-[10px] font-extrabold truncate">
                              {autoEligiblePairs.length > 0
                                ? `Uygun Tesisleri Başlat (${autoEligiblePairs.length}/${selectedTerrs.length} Şehir)`
                                : 'Seçili Şehirlerin Hepsi Azami / İnşada'}
                            </span>
                          </div>
                          {autoEligiblePairs.length > 0 && (
                            <span className="text-[10px] font-mono-num font-extrabold text-[#e0b86e] shrink-0">
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
                                  ? 'bg-[#14100c] border-[#3a2f22] text-[#9b8d77]'
                                  : canAfford
                                  ? 'bg-black/55 hover:bg-[#caa15a]/20 border-[#caa15a]/50 text-[#f3ead7]'
                                  : 'bg-black/40 border-rose-500/35 text-rose-300'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <ResourceSvg resource={opt.resource} className="w-3 h-3 text-[#e0b86e] shrink-0" />
                                  <span className="text-[10px] font-bold truncate">
                                    {opt.shortName} ({eligibleCities.length}/{matchingCities.length})
                                  </span>
                                </div>
                                <div className="text-[9px] text-[#c5b79e] truncate font-mono-num flex items-center gap-1">
                                  {isLocked ? (
                                    queuedCount > 0 ? (
                                      <>
                                        <AoH3GlyphSvg name="hammer" className="w-2.5 h-2.5 shrink-0" />
                                        <span>İnşa Sürüyor</span>
                                      </>
                                    ) : (
                                      <>
                                        <AoH3GlyphSvg name="check" className="w-2.5 h-2.5 shrink-0" />
                                        <span>Azami 5/5</span>
                                      </>
                                    )
                                  ) : (
                                    <span>{`${opt.buildDays}g · +${opt.gdpBonus} GSYİH`}</span>
                                  )}
                                  {!isLocked && maxedCount > 0 ? ` · ${maxedCount} tam` : ''}
                                </div>
                              </div>
                              <span className="text-[10px] font-mono-num font-bold text-[#e0b86e] shrink-0">
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
                              ? 'bg-[#1b1510] hover:bg-[#2a2117] border-[#caa15a]/55 text-[#f3ead7]'
                              : 'bg-black/45 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <span className="text-[10px] font-bold truncate flex items-center gap-1">
                            <AoH3GlyphSvg name="anchor" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            <span>Kıyı Limanı & Tersane ({eligibleShipyardCities.length}/{selectedTerrs.length} Kıyı)</span>
                          </span>
                          <span className="text-[10px] font-mono-num font-bold text-[#e0b86e] shrink-0">
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
                  className="rounded-lg bg-[#14110e]/95 border border-[#caa15a]/50 p-1.5 flex flex-col gap-1.5 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <span className="text-[#f3ead7] font-bold truncate flex items-center gap-1">
                      {batchMarchTargetPicking ? (
                        <>
                          <AoH3GlyphSvg name="compass" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                          <span>Haritadan HEDEF şehre dokunun!</span>
                        </>
                      ) : (
                        <span>{`Kaynak şehir seçin (${selectedArmies.length})`}</span>
                      )}
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
                          className="px-1.5 py-0.5 rounded bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[#e0b86e] font-semibold cursor-pointer"
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
                          className="px-1.5 py-0.5 rounded bg-[#241c13] hover:bg-[#32271b] border border-[#caa15a]/45 text-[#f3ead7] font-semibold cursor-pointer"
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
                        className="px-1.5 py-0.5 rounded bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/40 text-[#e0b86e] font-bold flex items-center gap-0.5 cursor-pointer"
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
                          className="px-1.5 py-0.5 rounded bg-black/60 hover:bg-black/80 border border-[#3a2f22] text-[#d8cbb5] font-semibold cursor-pointer"
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
                                ? 'bg-[#caa15a]/20 hover:bg-[#caa15a]/35 border-[#caa15a]/55 text-[#f3ead7]'
                                : 'bg-rose-950/50 border-rose-500/45 text-rose-200'
                            }`}
                          >
                            <span>{t.name.replace(/^★\s*/, '')}</span>
                            <span className="font-mono-num text-[#e0b86e]">
                              {(sendAmt / 1000).toFixed(1)}B
                            </span>
                            <X className="w-2.5 h-2.5 opacity-80 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#3a2f22]">
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
                                ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7]'
                                : 'bg-[#1b1510] hover:bg-[#2a2117] text-[#d8cbb5] border-[#3a2f22]'
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
                          : 'bg-[#caa15a] hover:bg-[#e0b86e] border-[#f3ead7] text-[#14100c] shadow'
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
        <div className="absolute bottom-3 left-2.5 z-20 pointer-events-auto max-w-[min(260px,calc(100vw-1.25rem))] sm:max-w-[290px] bg-[#14100c]/95 rounded-xl border border-[#caa15a]/45 shadow-2xl backdrop-blur-md overflow-hidden text-[#f3ead7]">
          <button
            type="button"
            onClick={() => setLegendOpen(!legendOpen)}
            aria-expanded={legendOpen}
            aria-controls="map-mode-legend-content"
            className="w-full min-h-[38px] flex items-center justify-between px-2.5 py-1.5 bg-[#1b1510]/90 cursor-pointer select-none border-b border-[#3a2f22] text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#e0b86e]">
              <Info aria-hidden="true" className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>
                {mapMode === 'ECONOMIC' && 'Şehir Gelişim Puanı & Ekonomi'}
                {mapMode === 'RESOURCES' && 'Üretim Kaynakları & Değerleri'}
                {mapMode === 'RELIGION' && 'Din Haritası Lejantı'}
                {mapMode === 'CULTURE' && 'Kültür Haritası Lejantı'}
                {mapMode === 'ASSIMILATION' && 'Asimilasyon (Core) Lejantı'}
              </span>
            </div>
            <span aria-hidden="true" className="text-[#b8a990] hover:text-[#faf3e3] p-0.5">
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
                  <p className="text-[10px] text-[#e0b86e] leading-snug">
                    Bina ve teknoloji yatırımı arttıkça şehrin <strong>Gelişim Puanı</strong> yükselir ve harita rengi koyu zümrüte döner:
                  </p>
                  {[
                    { color: '#042F2E', title: '88+ Puan · İmparatorluk Metropolü', desc: 'Çok koyu zümrüt — en yüksek üretim ve vergi merkezi' },
                    { color: '#064E3B', title: '70–87 Puan · Kalkınmış Sanayi Şehri', desc: 'Koyu zümrüt — gelişmiş sanayi ve liman yatırımı' },
                    { color: '#047857', title: '54–69 Puan · Gelişen Ticaret Sancağı', desc: 'Derin yeşil — orta-üst ekonomik kapasite' },
                    { color: '#10B981', title: '28–53 Puan · Orta Ölçekli Eyalet', desc: 'Canlı yeşil — yatırıma açık gelişmekte olan şehir' },
                    { color: '#6EE7B7', title: '<28 Puan · Kırsal Taşra', desc: 'Açık nane — henüz bina yatırımı yapılmamış bölge' },
                  ].map((tier) => (
                    <div key={tier.title} className="flex items-center gap-2 p-1 rounded bg-[#1b1510]/80 border border-[#3a2f22]">
                      <span className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20" style={{ backgroundColor: tier.color }} />
                      <div className="min-w-0">
                        <span className="font-bold text-[#faf3e3] block truncate">{tier.title}</span>
                        <span className="text-[9px] text-[#b8a990] block truncate">{tier.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mapMode === 'RESOURCES' && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-[#e0b86e] leading-snug">
                    Her kaynağın ham taban değeri vardır; ancak <strong>Sanayi, Liman ve Teknoloji yatırımı</strong> yapılan bir Pamuk/Odun şehri, yatırımsız Petrol/Altın şehrini geçer!
                  </p>
                  {Object.entries(RESOURCE_INFO).map(([resId, r]) => (
                    <div
                      key={resId}
                      className="flex items-center justify-between gap-1.5 p-1 rounded bg-[#1b1510]/80 border border-[#3a2f22]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[#e0b86e] bg-[#14100c] border border-[#caa15a]/40"
                        >
                          <ResourceSvg resource={resId} className="w-3 h-3" />
                        </span>
                        <span className="font-bold text-[#faf3e3] truncate">{r.name}</span>
                      </div>
                      <span className="text-[10px] font-mono-num text-[#e0b86e] font-bold shrink-0">
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
                    className="flex items-start gap-1.5 p-1 rounded bg-[#1b1510]/80 border border-[#3a2f22]"
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 mt-0.5 shadow-sm flex items-center justify-center text-[#faf3e3] border border-[#caa15a]/45"
                      style={{ backgroundColor: r.color }}
                    >
                      <ReligionSvg religionId={r.id} className="w-2.5 h-2.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#faf3e3] truncate">
                          {r.name}
                        </span>
                        <span className="text-[9px] text-[#e0b86e] font-mono">
                          +{r.moralBonus}% M / +{r.stabilityBonus}% S
                        </span>
                      </div>
                      <p className="text-[10px] text-[#b8a990] line-clamp-1 leading-tight">
                        {r.description}
                      </p>
                    </div>
                  </div>
                ))}

              {mapMode === 'CULTURE' &&
                Object.values(CULTURES).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-1.5 p-1 rounded bg-[#1b1510]/80 border border-[#3a2f22]"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-[#faf3e3] block truncate">
                        {c.name}
                      </span>
                      <p className="text-[10px] text-[#b8a990] line-clamp-1 leading-tight">
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
                      <span className="text-[10px] text-[#d8cbb5]">
                        Milli vatan toprağı. Tam vergi ve ordu toplama.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-[#241c13] border border-[#caa15a]/45">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#e0b86e] shrink-0 shadow animate-pulse" />
                    <div>
                      <span className="font-bold text-[#e0b86e] block">
                        Asimilasyon Sürecinde
                      </span>
                      <span className="text-[10px] text-[#d8cbb5]">
                        Gün gün idari entegrasyon devam ediyor.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 rounded bg-rose-950/40 border border-rose-500/40">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0 shadow" />
                    <div>
                      <span className="font-bold text-rose-300 block">
                        Yabancı / Entegre Değil
                      </span>
                      <span className="text-[10px] text-[#d8cbb5]">
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
