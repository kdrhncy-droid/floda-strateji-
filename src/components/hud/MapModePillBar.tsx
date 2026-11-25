import React, { useState } from 'react';
import {
  Crosshair,
  Navigation,
  UserPlus,
  MousePointerClick,
  Info,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { MapMode, Territory } from '../../types/game';
import {
  BatchRecruitScope,
  BatchRecruitUnitMode,
} from '../../engine/empireAndArmyActions';
import {
  MIN_MARCH_TROOPS,
  computeSendableTroops,
} from '../../engine/actions/armyMovementActions';
import { sound } from '../../utils/soundEngine';
import { CULTURES, RELIGIONS } from '../../data/religionAndCultureData';
import { RESOURCE_INFO } from '../../data/world2026Data';
import {
  AoH3GlyphSvg,
  ReligionSvg,
  ResourceSvg,
} from '../illustrations/AoH3Illustrations';

export type MapMacroMode =
  | 'NONE'
  | 'RECRUIT_INFANTRY'
  | 'BATCH_MARCH';

interface MapModePillBarProps {
  mapMode: MapMode;
  macroMode?: MapMacroMode;
  macroRecruitUnitMode?: BatchRecruitUnitMode;
  toastMessage: string | null;
  batchMarchSourceIds?: string[];
  batchMarchTargetPicking?: boolean;
  batchMarchRatio?: number;
  territories?: Record<string, Territory>;
  hasBottomCard?: boolean;
  hideWhenDrawerOpen?: boolean;
  belowTraySlot?: React.ReactNode;
  /** AoH3 selected-province flag chips, shown directly under the tool row. */
  selectionChipsSlot?: React.ReactNode;
  onSetMapMode?: (mode: MapMode) => void;
  onSetMacroMode?: (mode: MapMacroMode) => void;
  onSetMacroRecruitUnitMode?: (unitMode: BatchRecruitUnitMode) => void;
  onBatchRecruitUnits?: (
    scope: BatchRecruitScope,
    unitMode?: BatchRecruitUnitMode,
    territoryId?: string,
    roundsPerCity?: number
  ) => void;
  onToggleBatchCity?: (territoryId: string) => void;
  onSelectReadyBatchCities?: () => void;
  onSelectBorderBatchCities?: () => void;
  onClearBatchCities?: () => void;
  onSetBatchTargetPicking?: (picking: boolean) => void;
  onSetBatchMarchRatio?: (ratio: number) => void;
  onDismissToast?: () => void;
}

export const MapModePillBar: React.FC<MapModePillBarProps> = ({
  mapMode,
  macroMode = 'NONE',
  macroRecruitUnitMode = 'infantry',
  batchMarchSourceIds = [],
  batchMarchTargetPicking = false,
  batchMarchRatio = 1,
  territories = {},
  hasBottomCard = false,
  hideWhenDrawerOpen = false,
  belowTraySlot,
  selectionChipsSlot,
  onSetMacroMode,
  onSetMacroRecruitUnitMode,
  onBatchRecruitUnits,
  onToggleBatchCity,
  onSelectReadyBatchCities,
  onSelectBorderBatchCities,
  onClearBatchCities,
  onSetBatchTargetPicking,
  onSetBatchMarchRatio,
}) => {
  const [legendOpen, setLegendOpen] = useState(true);
  const [macroBodyCollapsed, setMacroBodyCollapsed] = useState(false);

  const hasLegend =
    mapMode === 'ECONOMIC' ||
    mapMode === 'RESOURCES' ||
    mapMode === 'RELIGION' ||
    mapMode === 'CULTURE' ||
    mapMode === 'ASSIMILATION';
  const showMacroTray = macroMode !== 'NONE';

  return (
    <>
      <div
        className={`hud-top-overlay hud-mapmode-bar absolute top-2 inset-x-2 z-30 flex flex-col gap-1.5 pointer-events-none ${
          hideWhenDrawerOpen ? 'portrait:max-[900px]:hidden' : ''
        }`}
      >
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
                    setMacroBodyCollapsed(false);
                  }}
                  title="Normal Eyalet Seçim Modu"
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors text-[#b8a990] hover:text-[#f3ead7]"
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
            {macroBodyCollapsed && macroMode === 'BATCH_MARCH' && (
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/50 border border-[#3a2f22] text-[10px] text-[#f3ead7]">
                <span className="truncate font-semibold flex items-center gap-1">
                  <AoH3GlyphSvg name="compass" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  <span className="truncate">
                    {`Haritadan ordu şehri dokunun (${batchMarchSourceIds.length} seçili)`}
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
                  <span>Paneli Aç ({batchMarchSourceIds.length})</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Multi-City Batch Army Dispatch Panel when "Toplu Sevk" is active */}
            {macroMode === 'BATCH_MARCH' && !macroBodyCollapsed && (() => {
              const selectedArmies = batchMarchSourceIds
                .map((id) => territories[id])
                .filter((t): t is Territory => Boolean(t));

              const stagedTroops = selectedArmies.reduce((sum, t) => {
                const sendable = computeSendableTroops(t.garrison);
                const amt = Math.min(sendable, Math.round(sendable * batchMarchRatio));
                return sum + (amt >= MIN_MARCH_TROOPS ? amt : 0);
              }, 0);

              const readyCityCount = selectedArmies.filter((t) => {
                const sendable = computeSendableTroops(t.garrison);
                return Math.min(sendable, Math.round(sendable * batchMarchRatio)) >= MIN_MARCH_TROOPS;
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
                        const sendable = computeSendableTroops(t.garrison);
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
                              sendAmt >= MIN_MARCH_TROOPS
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
