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
} from '../../engine/empireAndArmyActions';
import { NationFlagCanvasBadge } from '../../map/nationFlagRenderer';
import {
  cleanNationName,
  cleanProvinceName,
  formatTroopsShort,
} from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import { TerrainPanoramaSvg } from '../illustrations/AoH3Illustrations';

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
  const titleText = territory.isCapital ? `★ ${cleanName}` : cleanName;
  const terrainMeta =
    TERRAIN_INFO[territory.terrain || 'OVA'] || TERRAIN_INFO.OVA;
  const resMeta = RESOURCE_INFO[territory.resource] || RESOURCE_INFO.TAHIL;
  const dev = calculateProvinceDevelopment(territory, owner);
  const straitBadge = getProvinceStraitBadge(territory.id, territories, wars);
  const isOrderActive = armyOrderSourceId === territory.id;
  const isUnderCombat =
    battles.some((b) => b.territoryId === territory.id) ||
    Boolean(territory.siege);
  const sendableTroops = Math.max(0, Math.floor(territory.garrison - 500));
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
  const supplyLimit = calculateProvinceSupplyLimit(territory, owner, seasonInfo);
  const isOverSupply = hasIntel && territory.garrison > supplyLimit;

  return (
    <div className="hud-province-quickbar absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:w-[560px] sm:max-w-[calc(100vw-8rem)] z-20 rounded-2xl bg-[#090e1a]/96 border border-amber-500/50 shadow-2xl px-2.5 sm:px-3 py-2 flex flex-col gap-2">
      {/* Direct Movement Prompt Banner (No Forced Percentage Split!) */}
      {isOrderActive && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-sky-950/90 border border-sky-400/50 text-[11px]">
          <span className="font-bold text-sky-200 truncate">
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
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
          >
            İptal
          </button>
        </div>
      )}

      {/* Optional Split Ratio Strip ("Böl") */}
      {splitOpen && isPlayerOwned && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-950/85 border border-amber-500/50 text-[11px]">
          <span className="font-bold text-amber-200 truncate">
            ✂️ Bölünerek gönderilecek ordu oranı:
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
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-amber-200 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40'
                }`}
              >
                %{Math.round(r * 100)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSplitOpen(false)}
              className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Safe Disband Confirmation Strip ("Asker Sil") */}
      {disbandOpen && isPlayerOwned && !isUnderCombat && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-[11px]">
          <span className="font-bold text-rose-200 truncate">
            🪖 Terhis (%75 İnsan Gücü İadesi):
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
              className="px-2 py-0.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0"
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
          className="flex flex-col gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/50 text-[11px]"
        >
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="font-bold text-emerald-200 text-[10px]">
              ⚔️ Birlik Sınıfı Seç &amp; Bas:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                {
                  id: 'infantry' as const,
                  label: `🛡 ${armyGen.infantryShort}`,
                  activeTone: 'bg-emerald-500 text-slate-950 border-emerald-300',
                  idleTone: 'bg-slate-900 text-emerald-200 border-emerald-500/40',
                },
                {
                  id: 'armor' as const,
                  label: `🐎 ${armyGen.armorShort}`,
                  activeTone: 'bg-amber-500 text-slate-950 border-amber-300',
                  idleTone: 'bg-slate-900 text-amber-200 border-amber-500/40',
                },
                {
                  id: 'airDrone' as const,
                  label: `💣 ${armyGen.airArtilleryShort}`,
                  activeTone: 'bg-sky-400 text-slate-950 border-sky-200',
                  idleTone: 'bg-slate-900 text-sky-200 border-sky-500/40',
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
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    quickUnitType === u.id ? u.activeTone : u.idleTone
                  }`}
                >
                  {u.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRecruitOpen(false)}
                className="px-1.5 py-0.5 rounded-lg bg-slate-900 text-slate-300 text-[10px] font-bold border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-testid="province-recruit-1k-btn"
              onClick={() => {
                const baseGold =
                  quickUnitType === 'infantry'
                    ? 120
                    : quickUnitType === 'armor'
                    ? 180
                    : 500;
                if (onRecruitUnit) {
                  onRecruitUnit(territory.id, quickUnitType, 1000, baseGold);
                } else {
                  onQuickRecruitInfantry(territory.id);
                }
              }}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
            >
              +1.000 Bas ({quickUnitType === 'infantry' ? '120A' : quickUnitType === 'armor' ? '180A' : '500A'})
            </button>

            <button
              type="button"
              data-testid="province-recruit-25k-btn"
              onClick={() => {
                const amt = quickUnitType === 'infantry' ? 5000 : 2500;
                const baseGold =
                  quickUnitType === 'infantry'
                    ? 250
                    : quickUnitType === 'armor'
                    ? 420
                    : 1100;
                if (onRecruitUnit) {
                  onRecruitUnit(territory.id, quickUnitType, amt, baseGold);
                } else {
                  onQuickRecruitInfantry(territory.id);
                }
              }}
              className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
            >
              +{quickUnitType === 'infantry' ? '5.000 (250A)' : quickUnitType === 'armor' ? '2.500 (420A)' : '2.500 (1100A)'}
            </button>

            {onBatchRecruitUnits && (
              <>
                <button
                  type="button"
                  data-testid="province-recruit-max-btn"
                  onClick={() =>
                    onBatchRecruitUnits('SINGLE_MAX', quickUnitType, territory.id)
                  }
                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  ⚡ Bu Şehirde Maks Bas
                </button>
                <button
                  type="button"
                  data-testid="province-recruit-border-btn"
                  onClick={() =>
                    onBatchRecruitUnits('BORDER', quickUnitType, territory.id, 1)
                  }
                  className="px-2 py-1 rounded-lg bg-sky-600/85 hover:bg-sky-500 text-white text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  🛡 Sınırlara Toplu Bas
                </button>
                <button
                  type="button"
                  data-testid="province-recruit-all-btn"
                  onClick={() =>
                    onBatchRecruitUnits('ALL', quickUnitType, territory.id, 1)
                  }
                  className="px-2 py-1 rounded-lg bg-purple-600/85 hover:bg-purple-500 text-white text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  🌍 Tüm Ülkeye Toplu Bas
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
              className="w-7 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0"
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
            <div className="hud-province-thumb relative w-12 h-10 rounded-xl overflow-hidden border border-amber-500/40 shrink-0 shadow">
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
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {titleText}
                </span>
                {straitBadge ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0">
                    ⚓ +{straitBadge.dailyTollShare}G
                  </span>
                ) : isPlayerOwned ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shrink-0">
                    🛡 BİZİM EYALET
                  </span>
                ) : atWar ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-500/60 shrink-0">
                    ⚔️ DÜŞMAN
                  </span>
                ) : isAllied ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-500/25 text-sky-200 border border-sky-500/50 shrink-0">
                    🤝 MÜTTEFİK
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                    TARAFSIZ
                  </span>
                )}
                {territory.isAssimilating && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/50 shrink-0">
                    🌍 Asimile %{Math.round(territory.assimilation ?? 30)}
                  </span>
                )}
                {territory.constructionQueue && territory.constructionQueue.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/50 shrink-0">
                    🔨 İnşa ({territory.constructionQueue[0].totalDays - territory.constructionQueue[0].progressDays}g)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate mt-0.5 font-mono-num">
                <span className="text-slate-400 truncate max-w-[100px] font-sans">
                  {cleanOwnerName}
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className={`font-bold shrink-0 ${
                    isPlayerOwned
                      ? 'text-emerald-300'
                      : atWar
                      ? 'text-rose-300'
                      : 'text-amber-300'
                  }`}
                >
                  {hasIntel ? (
                    <>
                      {formatTroopsShort(territory.garrison)}
                      <span className="hud-landscape-hide text-[10px] text-slate-300 font-sans">
                        {' '}· {armyGen.infantryShort}: {infK}B · {armyGen.armorShort}: {armK}B · {armyGen.airArtilleryShort}: {airK}B
                      </span>
                    </>
                  ) : (
                    '? İstihbarat'
                  )}
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className="text-amber-300 font-bold shrink-0"
                  title={`Şehir Gelişim Puanı: ${dev.developmentScore} (${dev.tierLabel})`}
                >
                  ★{dev.developmentScore}P
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className="text-emerald-300 font-bold shrink-0 font-sans"
                  title={`${resMeta.name}: Ham ${dev.baseResourceValue}A → Yatırımlı ${dev.effectiveResourceValue} Altın/gün (×${dev.totalInvestmentMult} Yatırım Çarpanı)`}
                >
                  {resMeta.icon} {resMeta.shortName} {dev.effectiveResourceValue}A
                </span>
                <span className="hidden md:inline text-slate-600">·</span>
                <span className="hidden md:inline text-slate-300 truncate max-w-[85px] font-sans">
                  {terrainMeta.name}
                </span>
                {hasIntel && (
                  <>
                    <span className="hidden sm:inline text-slate-600">·</span>
                    <span
                      className={`hidden sm:inline shrink-0 ${
                        isOverSupply
                          ? 'text-rose-400 font-bold'
                          : 'text-slate-400'
                      }`}
                      title={`${seasonInfo.name} İkmal Limiti: ${supplyLimit.toLocaleString('tr-TR')} asker (${isOverSupply ? 'Limit aşıldı — haftalık yıpranma riski!' : 'Güvenli ikmal'})`}
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
              className="w-7 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0"
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
            className="w-7 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Row: Direct Army Actions + Province Controls */}
        <div className="hud-province-actions flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          {isUnderCombat && onOpenBattleOverview && (
            <button
              onClick={() => {
                sound.playWarHorn();
                onOpenBattleOverview();
              }}
              className="min-h-[36px] px-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-lg shadow-red-950/60 animate-pulse transition-all whitespace-nowrap shrink-0"
            >
              <Swords className="w-3.5 h-3.5 shrink-0" />
              <span>{territory.siege ? '♜ Kuşatma' : '⚔️ Muharebe'}</span>
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
                  ? 'bg-sky-500 text-slate-950 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
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
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
              className="min-h-[36px] px-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-sky-500/40 text-sky-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
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
                  ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                  : disbandOpen
                  ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                  : 'bg-slate-900/90 hover:bg-rose-950/60 border-rose-500/40 text-rose-300'
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
                className="min-h-[36px] px-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/55 text-orange-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <span>🌍 Asimile Et (180A)</span>
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
              className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                recruitOpen
                  ? 'bg-emerald-400 text-slate-950 shadow'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>+Asker Bas</span>
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
              className="flex-1 sm:flex-initial min-h-[36px] px-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>Ülke</span>
            </button>
          )}

          <button
            onClick={() => {
              sound.playClick();
              onOpenFullDrawer();
            }}
            className="flex-1 sm:flex-initial min-h-[36px] px-2.5 sm:px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
          >
            {isPlayerOwned ? (
              <>
                <Landmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>İnşa & Eyalet</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>İncele</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
