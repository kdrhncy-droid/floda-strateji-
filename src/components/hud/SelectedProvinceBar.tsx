import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Landmark,
  Layers,
  Navigation,
  Scissors,
  Swords,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  RESOURCE_INFO,
  getArmyGenerationInfo,
  getNationModernizedTier,
} from '../../data/world2026Data';
import { computeVisibleTerritoryIds } from '../../engine/fogOfWarEngine';
import { TERRAIN_INFO } from '../../engine/pashaAndFiefEngine';
import {
  calculateProvinceDevelopment,
  getOrCreateRelation,
  isAtWar,
} from '../../engine/simulationEngine';
import {
  calculateProvinceSupplyLimit,
  getGameSeason,
} from '../../engine/seasonSupplyAndAiProfile';
import { getProvinceWeather } from '../../engine/seasonalWeatherEngine';
import { getProvinceStraitBadge } from '../../engine/straitsAndTradeEngine';
import {
  ActiveBattle,
  ActiveWar,
  DiplomaticRelation,
  GameModeId,
  Nation,
  Territory,
  UnitType,
} from '../../types/game';
import {
  BatchRecruitScope,
  BatchRecruitUnitMode,
  calculateRecruitGoldCost,
  calculateRecruitmentDurationDays,
  NUCLEAR_STRIKE_GOLD_COST,
} from '../../engine/empireAndArmyActions';
import { computeSendableTroops } from '../../engine/actions/armyMovementActions';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import {
  cleanNationName,
  cleanProvinceName,
  formatTroopsShort,
} from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import {
  AoH3GlyphSvg,
  ResourceSvg,
  TerrainPanoramaSvg,
} from '../illustrations/AoH3Illustrations';

interface SelectedProvinceBarProps {
  territory: Territory;
  playerNationId: string;
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
  wars: ActiveWar[];
  battles?: ActiveBattle[];
  tick?: number;
  gameMode: GameModeId;
  fogOfWarEnabled: boolean;
  armyOrderSourceId: string | null;
  moveRatio: number;
  onSetMoveRatio: (ratio: number) => void;
  onStartArmyOrder: (territoryId: string | null) => void;
  onQuickRecruitInfantry: (territoryId: string) => void;
  onRecruitUnit?: (
    territoryId: string,
    unitType: UnitType,
    amount: number,
    goldCost: number
  ) => void;
  onBatchRecruitUnits?: (
    scope: BatchRecruitScope,
    unitMode?: BatchRecruitUnitMode,
    territoryId?: string,
    roundsPerCity?: number
  ) => void;
  onAssimilateTerritory?: (territoryId: string) => void;
  onMergeArmies?: (territoryId: string) => void;
  onDisbandArmy?: (territoryId: string, ratio: 0.5 | 1) => void;
  onLaunchNuclearStrike?: (territoryId: string) => void;
  onSelectTerritory: (territoryId: string) => void;
  onOpenFullDrawer: () => void;
  onInspectNation?: (nationId: string) => void;
  onOpenBattleOverview?: () => void;
  onClear: () => void;
}

export const SelectedProvinceBar: React.FC<SelectedProvinceBarProps> = ({
  territory,
  playerNationId,
  nations,
  territories,
  relations,
  wars,
  battles = [],
  tick = 0,
  gameMode,
  fogOfWarEnabled,
  armyOrderSourceId,
  moveRatio,
  onSetMoveRatio,
  onStartArmyOrder,
  onQuickRecruitInfantry,
  onRecruitUnit,
  onBatchRecruitUnits,
  onAssimilateTerritory,
  onMergeArmies,
  onDisbandArmy,
  onLaunchNuclearStrike,
  onSelectTerritory,
  onOpenFullDrawer,
  onInspectNation,
  onOpenBattleOverview,
  onClear,
}) => {
  const [splitOpen, setSplitOpen] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [quickUnitType, setQuickUnitType] = useState<UnitType>('infantry');

  useEffect(() => {
    setSplitOpen(false);
    setDisbandOpen(false);
  }, [territory.id]);

  const visibleIds = useMemo(
    () =>
      computeVisibleTerritoryIds(
        territories,
        nations,
        relations,
        [],
        [],
        playerNationId
      ),
    [territories, nations, relations, playerNationId]
  );

  // Owned provinces list for 1-tap mobile cycling (< / >)
  const ownedTerritoryIds = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t.ownerId === playerNationId)
        .sort((a, b) => b.garrison - a.garrison)
        .map((t) => t.id),
    [territories, playerNationId]
  );

  const owner = nations[territory.ownerId];
  if (!owner) return null;

  const isPlayerOwned = territory.ownerId === playerNationId;
  const hasIntel =
    isPlayerOwned || !fogOfWarEnabled || visibleIds.has(territory.id);
  const atWar =
    !isPlayerOwned && Boolean(isAtWar(wars, playerNationId, owner.id));
  const rel = !isPlayerOwned
    ? getOrCreateRelation(relations, playerNationId, owner.id)
    : null;
  const isAllied = Boolean(rel?.isAllied || rel?.allianceType);

  const cycleOwnedProvince = (dir: -1 | 1) => {
    if (ownedTerritoryIds.length === 0) return;
    sound.playSelectTerritory();
    const idx = ownedTerritoryIds.indexOf(territory.id);
    if (idx === -1) {
      onSelectTerritory(ownedTerritoryIds[0]);
      return;
    }
    const nextIdx =
      (idx + dir + ownedTerritoryIds.length) % ownedTerritoryIds.length;
    onSelectTerritory(ownedTerritoryIds[nextIdx]);
  };

  const cleanName = cleanProvinceName(territory.name);
  const cleanOwnerName = cleanNationName(owner.name);
  const titleText = cleanName;
  const terrainMeta =
    TERRAIN_INFO[territory.terrain || 'OVA'] || TERRAIN_INFO.OVA;
  const resMeta = RESOURCE_INFO[territory.resource] || RESOURCE_INFO.TAHIL;
  const dev = calculateProvinceDevelopment(territory, owner);
  const straitBadge = getProvinceStraitBadge(territory.id, territories, wars);
  const isOrderActive = armyOrderSourceId === territory.id;
  const isUnderCombat =
    battles.some((b) => b.territoryId === territory.id) ||
    Boolean(territory.siege);
  const sendableTroops = computeSendableTroops(territory.garrison);
  const plannedSendTroops = Math.min(
    sendableTroops,
    Math.round(sendableTroops * (Number.isFinite(moveRatio) ? moveRatio : 1))
  );

  const infK = (
    (territory.units?.infantry ?? territory.garrison) / 1000
  ).toFixed(1);
  const armK = ((territory.units?.armor ?? 0) / 1000).toFixed(1);
  const airK = ((territory.units?.airDrone ?? 0) / 1000).toFixed(1);
  const armyGen = getArmyGenerationInfo(
    gameMode,
    getNationModernizedTier(owner)
  );
  const seasonInfo = getGameSeason(tick, gameMode);
  const provinceWeather = getProvinceWeather(territory, tick, gameMode);
  const supplyLimit = calculateProvinceSupplyLimit(
    territory,
    owner,
    seasonInfo,
    tick,
    gameMode
  );
  const isOverSupply = hasIntel && territory.garrison > supplyLimit;

  return (
    <div className="hud-province-quickbar aoh3-quickbar absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:w-[560px] sm:max-w-[calc(100vw-8rem)] z-20 rounded-2xl bg-[#14100c]/96 border border-[#caa15a]/50 shadow-2xl px-2.5 sm:px-3 py-2 flex flex-col gap-2">
      {/* Direct Movement Prompt Banner (No Forced Percentage Split!) */}
      {isOrderActive && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#1b1510]/95 border border-[#caa15a]/55 text-[11px]">
          <span className="font-bold text-[#f3ead7] truncate">
            {territory.isCoastal
              ? `Hedef şehre veya açık denize dokunun · %${Math.round(moveRatio * 100)} (${plannedSendTroops.toLocaleString('tr-TR')} asker)`
              : `Hedef şehre dokunun · %${Math.round(moveRatio * 100)} (${plannedSendTroops.toLocaleString('tr-TR')} asker)`}
          </span>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onStartArmyOrder(null);
            }}
            className="px-2 py-0.5 rounded-lg bg-[#241c13] hover:bg-[#32271b] text-[#f3ead7] text-[10px] font-bold border border-[#caa15a]/35 whitespace-nowrap shrink-0"
          >
            İptal
          </button>
        </div>
      )}

      {/* Optional Split Ratio Strip ("Böl") */}
      {splitOpen && isPlayerOwned && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#241c13]/95 border border-[#caa15a]/50 text-[11px]">
          <span className="font-bold text-[#f3ead7] truncate flex items-center gap-1">
            <Scissors className="w-3 h-3 text-[#e0b86e] shrink-0" />
            <span className="truncate">Bölünerek gönderilecek ordu oranı:</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {[0.25, 0.5, 0.75].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSetMoveRatio(r);
                  setSplitOpen(false);
                  onStartArmyOrder(territory.id);
                }}
                className={`px-2 py-0.5 rounded-lg font-mono-num text-[10px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                  Math.abs(moveRatio - r) < 0.05 && isOrderActive
                    ? 'bg-[#caa15a] text-[#14100c]'
                    : 'bg-[#14100c] text-[#e0b86e] hover:bg-[#caa15a] hover:text-[#14100c] border border-[#caa15a]/40'
                }`}
              >
                %{Math.round(r * 100)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSplitOpen(false)}
              className="px-2 py-0.5 rounded-lg bg-[#14100c] text-[#d8cbb5] text-[10px] font-bold border border-[#3a2f22] whitespace-nowrap shrink-0"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Safe Disband Confirmation Strip ("Asker Sil") */}
      {disbandOpen && isPlayerOwned && !isUnderCombat && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-[11px]">
          <span className="font-bold text-rose-200 truncate flex items-center gap-1">
            <AoH3GlyphSvg name="shield" className="w-3 h-3 text-rose-300 shrink-0" />
            <span className="truncate">Terhis (%75 İnsan Gücü İadesi):</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                onDisbandArmy?.(territory.id, 0.5);
                setDisbandOpen(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold whitespace-nowrap shrink-0"
            >
              %50 Sil
            </button>
            <button
              type="button"
              onClick={() => {
                onDisbandArmy?.(territory.id, 1);
                setDisbandOpen(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold whitespace-nowrap shrink-0"
            >
              Tamamını Sil
            </button>
            <button
              type="button"
              onClick={() => setDisbandOpen(false)}
              className="px-2 py-0.5 rounded-lg bg-[#14100c] text-[#d8cbb5] text-[10px] font-bold border border-[#3a2f22] whitespace-nowrap shrink-0"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* AoH3 Multi-Unit & Batch Recruitment Strip ("+Asker Bas") */}
      {recruitOpen && isPlayerOwned && (
        <div
          data-testid="province-bar-recruit-strip"
          className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl bg-[#1b1510]/98 border border-[#caa15a]/50 text-[11px]"
        >
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="font-bold text-[#e0b86e] text-[10px] flex items-center gap-1">
              <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
              <span>Birlik Sınıfı Seç &amp; Bas:</span>
            </span>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                {
                  id: 'infantry' as const,
                  glyph: 'shield' as const,
                  label: armyGen.infantryShort,
                },
                {
                  id: 'armor' as const,
                  glyph: 'cavalry' as const,
                  label: armyGen.armorShort,
                },
                {
                  id: 'airDrone' as const,
                  glyph: 'artillery' as const,
                  label: armyGen.airArtilleryShort,
                },
              ].map((u) => (
                <button
                  key={u.id}
                  type="button"
                  data-testid={`province-unit-select-${u.id}`}
                  onClick={() => {
                    sound.playClick();
                    setQuickUnitType(u.id);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border whitespace-nowrap shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                    quickUnitType === u.id
                      ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7]'
                      : 'bg-[#14100c] text-[#d8cbb5] border-[#caa15a]/35 hover:border-[#e0b86e]'
                  }`}
                >
                  <AoH3GlyphSvg name={u.glyph} className="w-3 h-3 shrink-0" />
                  <span>{u.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRecruitOpen(false)}
                aria-label="Asker basma panelini kapat"
                className="px-1.5 py-0.5 rounded-lg bg-[#14100c] text-[#b8a990] hover:text-[#faf3e3] text-[10px] font-bold border border-[#3a2f22] whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(() => {
              const pNation = nations[playerNationId];
              const cost1k = calculateRecruitGoldCost(quickUnitType, 1000, pNation);
              const days1k = calculateRecruitmentDurationDays(
                1000,
                quickUnitType,
                territory,
                pNation
              );
              const bigAmt = quickUnitType === 'infantry' ? 5000 : 2500;
              const costBig = calculateRecruitGoldCost(quickUnitType, bigAmt, pNation);
              const daysBig = calculateRecruitmentDurationDays(
                bigAmt,
                quickUnitType,
                territory,
                pNation
              );
              return (
                <>
                  <button
                    type="button"
                    data-testid="province-recruit-1k-btn"
                    onClick={() => {
                      if (onRecruitUnit) {
                        onRecruitUnit(territory.id, quickUnitType, 1000, cost1k);
                      } else {
                        onQuickRecruitInfantry(territory.id);
                      }
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2a2117] hover:bg-[#382b1d] border border-[#caa15a]/50 text-[#f3ead7] text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    +1.000 Bas ({cost1k}A · {days1k}g)
                  </button>

                  <button
                    type="button"
                    data-testid="province-recruit-25k-btn"
                    onClick={() => {
                      if (onRecruitUnit) {
                        onRecruitUnit(territory.id, quickUnitType, bigAmt, costBig);
                      } else {
                        onQuickRecruitInfantry(territory.id);
                      }
                    }}
                    className="px-2 py-1 rounded-lg bg-[#2a2117] hover:bg-[#382b1d] border border-[#caa15a]/50 text-[#e0b86e] text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    +{bigAmt.toLocaleString('tr-TR')} ({costBig}A · {daysBig}g)
                  </button>
                </>
              );
            })()}

            {onBatchRecruitUnits && (
              <>
                <button
                  type="button"
                  data-testid="province-recruit-max-btn"
                  onClick={() =>
                    onBatchRecruitUnits('SINGLE_MAX', quickUnitType, territory.id)
                  }
                  className="px-2 py-1 rounded-lg bg-[#caa15a] hover:bg-[#e0b86e] text-[#14100c] text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <AoH3GlyphSvg name="bolt" className="w-3 h-3 shrink-0" />
                  <span>Bu Şehirde Maks Bas</span>
                </button>
                <button
                  type="button"
                  data-testid="province-recruit-border-btn"
                  onClick={() =>
                    onBatchRecruitUnits('BORDER', quickUnitType, territory.id, 1)
                  }
                  className="px-2 py-1 rounded-lg bg-[#14100c] hover:bg-[#241c13] border border-[#caa15a]/45 text-[#f3ead7] text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  <span>Sınırlara Toplu Bas</span>
                </button>
                <button
                  type="button"
                  data-testid="province-recruit-all-btn"
                  onClick={() =>
                    onBatchRecruitUnits('ALL', quickUnitType, territory.id, 1)
                  }
                  className="px-2 py-1 rounded-lg bg-[#14100c] hover:bg-[#241c13] border border-[#caa15a]/45 text-[#e0b86e] text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <AoH3GlyphSvg name="globe" className="w-3 h-3 shrink-0" />
                  <span>Tüm Ülkeye Toplu Bas</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="hud-province-summary flex flex-col gap-2">
        {/* Top Row: Illustrated Terrain Badge + Province Title + Army Breakdown */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Mobile 1-Tap Province Cycle Left */}
          {ownedTerritoryIds.length > 1 && (
            <button
              onClick={() => cycleOwnedProvince(-1)}
              title="Önceki Eyaletimiz / Ordumuz"
              className="w-7 h-9 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#3a2f22] flex items-center justify-center text-[#e0b86e] shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenFullDrawer();
            }}
            className="flex items-center gap-2.5 min-w-0 text-left flex-1"
          >
            {/* AoH3 Mini Illustrated Terrain + Flag Crest */}
            <div className="hud-province-thumb relative w-12 h-10 rounded-xl overflow-hidden border border-[#caa15a]/45 shrink-0 shadow">
              <TerrainPanoramaSvg
                terrain={territory.terrain || 'OVA'}
                fortLevel={territory.buildings.fortress}
                isCapital={territory.isCapital}
                className="w-full h-full"
              />
              <div className="absolute bottom-0.5 right-0.5">
                <NationFlagCanvasBadge
                  nationId={owner.id}
                  flagCode={owner.flagCode}
                  color={owner.color}
                  width={22}
                  height={14}
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-[#faf3e3] truncate flex items-center gap-1">
                  {territory.isCapital && (
                    <AoH3GlyphSvg name="star" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  )}
                  <span className="truncate">{titleText}</span>
                </span>
                {straitBadge ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#caa15a]/20 text-[#e0b86e] border border-[#caa15a]/45 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="anchor" className="w-2.5 h-2.5 shrink-0" />
                    <span>+{straitBadge.dailyTollShare}G</span>
                  </span>
                ) : isPlayerOwned ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#caa15a]/20 text-[#e0b86e] border border-[#caa15a]/50 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="shield" className="w-2.5 h-2.5 shrink-0" />
                    <span>BİZİM EYALET</span>
                  </span>
                ) : atWar ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-500/60 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="sword" className="w-2.5 h-2.5 shrink-0" />
                    <span>DÜŞMAN</span>
                  </span>
                ) : isAllied ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#caa15a]/20 text-[#f3ead7] border border-[#caa15a]/50 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="handshake" className="w-2.5 h-2.5 shrink-0" />
                    <span>MÜTTEFİK</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1b1510] text-[#d8cbb5] border border-[#3a2f22] shrink-0">
                    TARAFSIZ
                  </span>
                )}
                {territory.isAssimilating && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#caa15a]/20 text-[#e0b86e] border border-[#caa15a]/50 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="globe" className="w-2.5 h-2.5 shrink-0" />
                    <span>Asimile %{Math.round(territory.assimilation ?? 30)}</span>
                  </span>
                )}
                {territory.constructionQueue && territory.constructionQueue.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#caa15a]/20 text-[#e0b86e] border border-[#caa15a]/50 shrink-0 inline-flex items-center gap-0.5">
                    <AoH3GlyphSvg name="hammer" className="w-2.5 h-2.5 shrink-0" />
                    <span>İnşa ({territory.constructionQueue[0].totalDays - territory.constructionQueue[0].progressDays}g)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#d8cbb5] truncate mt-0.5 font-mono-num">
                <span className="text-[#b8a990] truncate max-w-[100px] font-sans">
                  {cleanOwnerName}
                </span>
                <span className="text-[#6e604c]">·</span>
                <span
                  className={`font-bold shrink-0 ${
                    isPlayerOwned
                      ? 'text-[#e0b86e]'
                      : atWar
                      ? 'text-rose-300'
                      : 'text-[#d8cbb5]'
                  }`}
                >
                  {hasIntel ? (
                    <>
                      {formatTroopsShort(territory.garrison)}
                      <span className="hud-landscape-hide text-[10px] text-[#d8cbb5] font-sans">
                        {' '}· {armyGen.infantryShort}: {infK}B · {armyGen.armorShort}: {armK}B · {armyGen.airArtilleryShort}: {airK}B
                      </span>
                    </>
                  ) : (
                    '? İstihbarat'
                  )}
                </span>
                <span className="text-[#6e604c]">·</span>
                <span
                  className="text-[#e0b86e] font-bold shrink-0 inline-flex items-center gap-0.5"
                  title={`Şehir Gelişim Puanı: ${dev.developmentScore} (${dev.tierLabel})`}
                >
                  <AoH3GlyphSvg name="star" className="w-2.5 h-2.5 shrink-0" />
                  <span>{dev.developmentScore}P</span>
                </span>
                <span className="text-[#6e604c]">·</span>
                <span
                  className="text-[#f3ead7] font-bold shrink-0 font-sans inline-flex items-center gap-0.5"
                  title={`${resMeta.name}: Ham ${dev.baseResourceValue}A → Yatırımlı ${dev.effectiveResourceValue} Altın/gün (×${dev.totalInvestmentMult} Yatırım Çarpanı)`}
                >
                  <ResourceSvg resource={territory.resource} className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  <span>{resMeta.shortName} {dev.effectiveResourceValue}A</span>
                </span>
                <span className="hidden md:inline text-[#6e604c]">·</span>
                <span className="hidden md:inline text-[#d8cbb5] truncate max-w-[85px] font-sans">
                  {terrainMeta.name}
                </span>
                <span className="hidden sm:inline text-[#6e604c]">·</span>
                <span
                  data-testid="province-weather-tag"
                  className="hidden sm:inline shrink-0 font-sans font-semibold"
                  style={{ color: provinceWeather.accentHex }}
                  title={`${provinceWeather.label} · Yürüyüş Hızı %${Math.round(
                    provinceWeather.movementSpeedMultiplier * 100
                  )} · Birlik Verimi %${Math.round(
                    provinceWeather.troopEfficiencyMultiplier * 100
                  )} · Yıpranma ×${provinceWeather.attritionMultiplier.toFixed(2)} — ${provinceWeather.summary}`}
                >
                  {provinceWeather.shortLabel}
                </span>
                {hasIntel && (
                  <>
                    <span className="hidden sm:inline text-[#6e604c]">·</span>
                    <span
                      className={`hidden sm:inline shrink-0 ${
                        isOverSupply
                          ? 'text-rose-400 font-bold'
                          : 'text-[#b8a990]'
                      }`}
                      title={`${provinceWeather.label} İkmal Limiti: ${supplyLimit.toLocaleString('tr-TR')} asker (${isOverSupply ? 'Limit aşıldı — haftalık yıpranma riski!' : 'Güvenli ikmal'})`}
                      data-testid="province-supply-status"
                    >
                      İkmal {Math.round(territory.garrison / 1000)}B/{Math.round(supplyLimit / 1000)}B
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Mobile 1-Tap Province Cycle Right */}
          {ownedTerritoryIds.length > 1 && (
            <button
              onClick={() => cycleOwnedProvince(1)}
              title="Sonraki Eyaletimiz / Ordumuz"
              className="w-7 h-9 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#3a2f22] flex items-center justify-center text-[#e0b86e] shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Close Button on Top Right */}
          <button
            onClick={() => {
              sound.playClick();
              onClear();
            }}
            title="Seçimi Kaldır"
            aria-label="Eyalet seçimini kaldır"
            className="w-7 h-9 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#3a2f22] flex items-center justify-center text-[#b8a990] hover:text-[#faf3e3] shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Active Siege 0/100 -> 100/100 Progress Strip */}
        {territory.siege && (() => {
          const siegePct = Math.max(0, Math.min(100, Math.round(territory.siege.progress)));
          const besieger = nations[territory.siege.attackerId];
          const isPlayerAtt = territory.siege.attackerId === playerNationId;
          return (
            <div
              data-testid="province-siege-progress-strip"
              className="px-2.5 py-1.5 rounded-xl bg-[#1b1510]/95 border border-[#caa15a]/45 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="font-bold text-[#f3ead7] flex items-center gap-1.5 truncate">
                  <AoH3GlyphSvg name="fortress" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                  <span className="truncate">
                    {cleanNationName(besieger?.name || 'Kuşatmacı')} Kuşatması (
                    {formatTroopsShort(territory.siege.attackerTroops)})
                  </span>
                </span>
                <span className="font-mono-num font-extrabold text-[#e0b86e] shrink-0">
                  {siegePct}/100
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#0d0a07] border border-[#caa15a]/25 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isPlayerAtt
                      ? 'bg-gradient-to-r from-[#b8862d] to-[#facc15]'
                      : 'bg-gradient-to-r from-rose-700 to-rose-400'
                  }`}
                  style={{ width: `${Math.max(siegePct > 0 ? 3 : 0, siegePct)}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Active Recruitment Queue Strip (Asker Eğitim Sırası) */}
        {isPlayerOwned &&
          Array.isArray(territory.recruitmentQueue) &&
          territory.recruitmentQueue.length > 0 && (() => {
            const activeJob = territory.recruitmentQueue[0];
            const doneDays = Math.max(0, activeJob.progressDays || 0);
            const remDays = Math.max(1, activeJob.totalDays - doneDays);
            const pct = Math.max(
              6,
              Math.min(
                100,
                Math.round((doneDays / Math.max(1, activeJob.totalDays)) * 100)
              )
            );
            const totalQueuedTroops = territory.recruitmentQueue.reduce(
              (acc, j) => acc + (j.troops || 0),
              0
            );
            const hearthLvl = territory.buildings?.armyHearth ?? 0;
            return (
              <div
                data-testid="province-recruitment-queue-strip"
                className="px-2.5 py-1.5 rounded-xl bg-[#18130d]/95 border border-[#caa15a]/40 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="font-bold text-[#f3ead7] flex items-center gap-1.5 truncate">
                    <AoH3GlyphSvg name="sword" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                    <span className="truncate">
                      Eğitimde: {activeJob.label} (+{formatTroopsShort(totalQueuedTroops)})
                      {territory.recruitmentQueue.length > 1
                        ? ` · ${territory.recruitmentQueue.length} Sıra`
                        : ''}
                    </span>
                  </span>
                  <span className="font-mono-num font-bold text-[#e0b86e] shrink-0">
                    {remDays}g kaldı
                    {hearthLvl > 0 ? ` · Ocak Sv.${hearthLvl}` : ''}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0d0a07] border border-[#caa15a]/25 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#caa15a] to-[#facc15] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

        {/* Bottom Row: Direct Army Actions + Province Controls */}
        <div className="hud-province-actions flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          {isUnderCombat && onOpenBattleOverview && (
            <button
              onClick={() => {
                sound.playWarHorn();
                onOpenBattleOverview();
              }}
              className="min-h-[36px] px-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-[#8f6a34] hover:from-rose-600 hover:to-[#caa15a] text-[#faf3e3] text-[11px] font-bold flex items-center justify-center gap-1 shadow-lg animate-pulse transition-all whitespace-nowrap shrink-0"
            >
              {territory.siege ? (
                <AoH3GlyphSvg name="fortress" className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Swords className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {territory.siege
                  ? `Kuşatma (${Math.round(territory.siege.progress)}/100)`
                  : 'Muharebe'}
              </span>
            </button>
          )}

          {isPlayerOwned && territory.garrison >= 300 && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setSplitOpen(false);
                setDisbandOpen(false);
                onSetMoveRatio(1);
                onStartArmyOrder(isOrderActive ? null : territory.id);
              }}
              title="Ordunun tamamını (%100) doğrudan seçeceğiniz şehre hareket ettirin"
              className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                isOrderActive
                  ? 'bg-[#f3ead7] text-[#14100c] animate-pulse'
                  : 'bg-[#caa15a] hover:bg-[#e0b86e] text-[#14100c]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>{isOrderActive ? 'Hedef Seç' : 'Hareket'}</span>
            </button>
          )}

          {isPlayerOwned && territory.garrison >= 1500 && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setDisbandOpen(false);
                setSplitOpen((prev) => !prev);
              }}
              title="Ordudan %25, %50 veya %75 ayırarak hareket ettir"
              className={`min-h-[36px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                splitOpen
                  ? 'bg-[#caa15a]/25 border-[#e0b86e] text-[#f3ead7]'
                  : 'bg-[#1b1510] hover:bg-[#261e16] border-[#caa15a]/35 text-[#f3ead7]'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
              <span>Böl</span>
            </button>
          )}

          {isPlayerOwned && onMergeArmies && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setSplitOpen(false);
                setDisbandOpen(false);
                onMergeArmies(territory.id);
              }}
              title="Komşu şehirlerdeki güvenli yedek birlikleri bu merkezde birleştir"
              className="min-h-[36px] px-2.5 rounded-xl bg-[#1b1510] hover:bg-[#261e16] border border-[#caa15a]/40 text-[#f3ead7] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
              <span>Birleştir</span>
            </button>
          )}

          {isPlayerOwned && onDisbandArmy && territory.garrison > 0 && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                if (isUnderCombat) {
                  onDisbandArmy(territory.id, 0.5);
                  return;
                }
                setSplitOpen(false);
                setDisbandOpen((prev) => !prev);
              }}
              title={
                isUnderCombat
                  ? 'Muharebe veya kuşatma sırasında asker silinemez'
                  : 'Gereksiz askerleri terhis edip %75 İnsan Gücü iadesi al'
              }
              className={`min-h-[36px] px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                isUnderCombat
                  ? 'bg-[#1b1510]/50 border-[#3a2f22] text-[#7e705a] cursor-not-allowed'
                  : disbandOpen
                  ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                  : 'bg-[#1b1510] hover:bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Asker Sil</span>
            </button>
          )}

          {isPlayerOwned &&
            onAssimilateTerritory &&
            !territory.isOccupied &&
            !territory.isAssimilating &&
            (territory.coreOwnerId !== playerNationId ||
              (territory.assimilation ?? 100) < 100) && (
              <button
                type="button"
                onClick={() => {
                  onAssimilateTerritory(territory.id);
                }}
                title="Fethedilen şehri asimile ederek %100 Öz Vatan (Core) yap ve isyan riskini düşür (180 Altın)"
                className="min-h-[36px] px-2.5 rounded-xl bg-[#261d13] hover:bg-[#35281a] border border-[#caa15a]/55 text-[#f3ead7] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <AoH3GlyphSvg name="globe" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                <span>Asimile Et (180A)</span>
              </button>
            )}

          {isPlayerOwned && (
            <button
              type="button"
              data-testid="province-bar-recruit-toggle-btn"
              onClick={() => {
                sound.playClick();
                setSplitOpen(false);
                setDisbandOpen(false);
                if (onRecruitUnit || onBatchRecruitUnits) {
                  setRecruitOpen((prev) => !prev);
                } else {
                  onQuickRecruitInfantry(territory.id);
                }
              }}
              title="Asker Bas: Piyade, Süvari/Zırhlı, Topçu/SİHA ve Toplu Asker Basma"
              className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                recruitOpen
                  ? 'bg-[#caa15a] text-[#14100c] border-[#f3ead7] shadow'
                  : 'bg-[#2a2117] hover:bg-[#382b1d] text-[#f3ead7] border-[#caa15a]/55'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>+Asker Bas</span>
            </button>
          )}

          {!isPlayerOwned &&
            atWar &&
            onLaunchNuclearStrike &&
            nations[playerNationId]?.unlockedTechs?.includes('mil_10') && (
              <button
                type="button"
                data-testid="province-bar-nuclear-strike-btn"
                onClick={() => {
                  sound.playWarHorn();
                  onLaunchNuclearStrike(territory.id);
                }}
                title="2026 Nükleer Füze Saldırısı: düşman garnizonunu ve surlarını yok eder (1500 Altın, +18 Agresiflik)"
                className="min-h-[36px] px-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-amber-600 hover:from-rose-600 hover:to-amber-500 border border-amber-300/70 text-[#faf3e3] text-[11px] font-extrabold flex items-center justify-center gap-1 shadow-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AoH3GlyphSvg name="bolt" className="w-3.5 h-3.5 shrink-0" />
                <span>Nükleer Füze ({NUCLEAR_STRIKE_GOLD_COST}A)</span>
              </button>
            )}

          {onInspectNation && !isPlayerOwned && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onInspectNation(owner.id);
              }}
              aria-label={`${cleanOwnerName} diplomasi ağını incele`}
              title={`${cleanOwnerName} ülkesinin savaşlarını, müttefiklerini ve paktlarını gör`}
              className="flex-1 sm:flex-initial min-h-[36px] px-2.5 rounded-xl bg-[#1b1510] hover:bg-[#261e16] border border-[#caa15a]/45 text-[#f3ead7] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
              <span>Ülke</span>
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenFullDrawer();
            }}
            className="flex-1 sm:flex-initial min-h-[36px] px-2.5 sm:px-3 rounded-xl bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/35 text-[#f3ead7] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            {isPlayerOwned ? (
              <>
                <Landmark className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                <span>Eyalet</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                <span>İncele</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
