import React, { useMemo, useState } from 'react';
import { Check, Coins, Hammer, Lock, MapPin, Star } from 'lucide-react';
import { BuildingType, Territory } from '../../types/game';
import { CommandDrawersProps } from './drawerTypes';
import { BUILDINGS, getTechTreeForMode } from '../../data/world2026Data';
import {
  SPECIALTY_PRODUCTION_OPTIONS,
  SpecialtyProductionOption,
  getSpecialtyTerritoryEligibility,
} from '../../engine/empireAndArmyActions';
import { isTerritoryCoastal } from '../../engine/worldBuilder';
import { cleanProvinceName } from '../../utils/formatters';
import { sound } from '../../utils/soundEngine';
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  AoH3MenuBanner,
  ResourceSvg,
} from '../illustrations/AoH3Illustrations';
import {
  getBuildingArtwork,
  getSpecialtyArtwork,
} from './buildingArtwork';
import { TechArtworkAsset } from './techArtwork';

type ConstructionCategory = 'ALL' | 'ECONOMY' | 'SCIENCE' | 'DIPLOMACY' | 'MILITARY';

type ConstructionCatalogItem =
  | {
      kind: 'BUILDING';
      id: string;
      buildingType: BuildingType;
      title: string;
      subtitle: string;
      description: string;
      effectSummary: string;
      categories: Exclude<ConstructionCategory, 'ALL'>[];
      baseCost: number;
      maxLevel: number;
      requiresCoastal?: boolean;
      requiresCapital?: boolean;
      requiredTechId?: string;
      glyph: AoH3GlyphName;
      artwork: TechArtworkAsset;
    }
  | {
      kind: 'SPECIALTY';
      id: string;
      option: SpecialtyProductionOption;
      title: string;
      subtitle: string;
      description: string;
      effectSummary: string;
      categories: Exclude<ConstructionCategory, 'ALL'>[];
      baseCost: number;
      maxLevel: number;
      artwork: TechArtworkAsset;
    };

const BUILDING_CATEGORY_MAP: Record<BuildingType, Exclude<ConstructionCategory, 'ALL'>[]> = {
  factory: ['ECONOMY'],
  tradeHub: ['ECONOMY', 'DIPLOMACY'],
  supplyDepot: ['ECONOMY', 'MILITARY'],
  shipyard: ['ECONOMY', 'DIPLOMACY'],
  mint: ['ECONOMY'],
  granary: ['ECONOMY'],
  school: ['SCIENCE'],
  highSchool: ['SCIENCE'],
  university: ['SCIENCE'],
  capitalPalace: ['DIPLOMACY'],
  barracks: ['MILITARY'],
  armyHearth: ['MILITARY'],
  fortress: ['MILITARY'],
};

const BUILDING_GLYPH_MAP: Record<BuildingType, AoH3GlyphName> = {
  factory: 'hammer',
  barracks: 'sword',
  armyHearth: 'shield',
  fortress: 'fortress',
  school: 'book',
  highSchool: 'crown',
  university: 'science',
  capitalPalace: 'star',
  tradeHub: 'handshake',
  supplyDepot: 'scale',
  shipyard: 'anchor',
  mint: 'gold',
  granary: 'shield',
};

export const ConstructionDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  territories,
  onUpgradeBuilding,
  onInvestSpecialtyProduction,
  onSelectTerritory,
  gameMode = 'EMPIRES_1440',
}) => {
  const [category, setCategory] = useState<ConstructionCategory>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string>('bld:factory');
  const [brokenArtworkIds, setBrokenArtworkIds] = useState<Record<string, boolean>>({});
  const is1440 = gameMode === 'EMPIRES_1440';

  const ownedTerritories = useMemo(
    () =>
      Object.values(territories)
        .filter((t) => t && t.ownerId === playerNation.id)
        .sort(
          (a, b) =>
            Number(b.isCapital) - Number(a.isCapital) ||
            b.baseGdp - a.baseGdp ||
            a.name.localeCompare(b.name, 'tr')
        ),
    [territories, playerNation.id]
  );

  const buildCostMult = useMemo(() => {
    let m = 1.0;
    const techs = playerNation.unlockedTechs || [];
    if (techs.includes('eco_2b')) m *= 0.88;
    if (techs.includes('adm_1b')) m *= 0.9;
    if (techs.includes('sci_4b')) m *= 0.85;
    if (techs.includes('sci_6b')) m *= 0.9;
    return m;
  }, [playerNation.unlockedTechs]);

  const getBuildingCostAndDays = (defBaseCost: number, currentLvl: number) => {
    const cost = Math.max(
      80,
      Math.round(defBaseCost * Math.pow(1.35, currentLvl) * buildCostMult)
    );
    const baseBuildDays = Math.max(14, 18 + currentLvl * 14);
    const totalDays = playerNation.unlockedTechs?.includes('adm_3b')
      ? Math.max(10, Math.round(baseBuildDays * 0.8))
      : baseBuildDays;
    return { cost, totalDays };
  };

  const catalogItems = useMemo<ConstructionCatalogItem[]>(() => {
    const bldItems: ConstructionCatalogItem[] = BUILDINGS.map((b) => ({
      kind: 'BUILDING',
      id: `bld:${b.id}`,
      buildingType: b.id,
      title: (is1440 ? b.eraName1440 : b.name) || b.name || b.id,
      subtitle: b.requiresCapital
        ? 'Yalnızca Başkent'
        : b.requiresCoastal
        ? 'Kıyı Şehirleri'
        : 'Tüm Şehirler',
      description: b.description,
      effectSummary: b.effectSummary,
      categories: BUILDING_CATEGORY_MAP[b.id] || ['ECONOMY'],
      baseCost: b.baseCost,
      maxLevel: b.maxLevel,
      requiresCoastal: b.requiresCoastal,
      requiresCapital: b.requiresCapital,
      requiredTechId: b.requiredTechId,
      glyph: BUILDING_GLYPH_MAP[b.id] || 'hammer',
      artwork: getBuildingArtwork(b.id),
    }));

    const specItems: ConstructionCatalogItem[] = SPECIALTY_PRODUCTION_OPTIONS.map(
      (opt) => ({
        kind: 'SPECIALTY',
        id: `spec:${opt.id}`,
        option: opt,
        title: opt.name,
        subtitle: `Özel Kaynak · ${opt.buildDays} Gün`,
        description: opt.description,
        effectSummary: `+${opt.gdpBonus} Üretim Değeri · Doğal Kaynak Tesisi`,
        categories: ['ECONOMY'],
        baseCost: opt.costGold,
        maxLevel: 5,
        artwork: getSpecialtyArtwork(opt.id),
      })
    );

    return [...bldItems, ...specItems];
  }, [is1440]);

  const filteredItems = useMemo(() => {
    if (category === 'ALL') return catalogItems;
    return catalogItems.filter((item) => item.categories.includes(category));
  }, [catalogItems, category]);

  const activeItem =
    filteredItems.find((i) => i.id === selectedItemId) ||
    catalogItems.find((i) => i.id === selectedItemId) ||
    filteredItems[0] ||
    catalogItems[0];

  const techTree = useMemo(() => getTechTreeForMode(gameMode), [gameMode]);

  // Track ongoing construction counts & highest progress % per catalog item for card overlays
  const itemActiveStats = useMemo(() => {
    const stats: Record<string, { count: number; maxPct: number }> = {};
    for (const t of ownedTerritories) {
      const q = t.constructionQueue || [];
      q.forEach((job, idx) => {
        const bKey = `bld:${job.building}`;
        const pct =
          idx === 0
            ? Math.min(99, Math.round((job.progressDays / Math.max(1, job.totalDays)) * 100))
            : 0;
        const cur = stats[bKey] || { count: 0, maxPct: 0 };
        stats[bKey] = {
          count: cur.count + 1,
          maxPct: Math.max(cur.maxPct, pct),
        };
      });
    }
    return stats;
  }, [ownedTerritories]);

  // Evaluate each owned city against the selected construction item
  const cityRows = useMemo(() => {
    if (!activeItem) return [];

    return ownedTerritories
      .map((t) => {
        const queue = t.constructionQueue || [];
        if (activeItem.kind === 'BUILDING') {
          const bType = activeItem.buildingType;
          const currentLvl = t.buildings?.[bType] || 0;
          const queueIdx = queue.findIndex((q) => q.building === bType);
          const queueItem = queueIdx >= 0 ? queue[queueIdx] : undefined;
          const { cost, totalDays } = getBuildingCostAndDays(
            activeItem.baseCost,
            currentLvl
          );
          const techLocked = Boolean(
            activeItem.requiredTechId &&
              !(playerNation.unlockedTechs || []).includes(activeItem.requiredTechId)
          );
          const reqTechName = activeItem.requiredTechId
            ? techTree.find((tc) => tc.id === activeItem.requiredTechId)
                ?.shortTitle || activeItem.requiredTechId
            : '';

          let disabledReason: string | null = null;
          if (techLocked) {
            disabledReason = `Teknoloji: ${reqTechName}`;
          } else if (
            activeItem.requiresCapital &&
            !t.isCapital &&
            t.id !== playerNation.capitalTerritoryId
          ) {
            disabledReason = 'Sadece Başkent';
          } else if (activeItem.requiresCoastal && !isTerritoryCoastal(t)) {
            disabledReason = 'Kıyı Gerekli';
          } else if (currentLvl >= activeItem.maxLevel) {
            disabledReason = 'Azami Seviye';
          } else if (queueItem) {
            if (queueIdx === 0) {
              const pct = Math.round(
                (queueItem.progressDays / Math.max(1, queueItem.totalDays)) * 100
              );
              disabledReason = `İnşada (%${pct})`;
            } else {
              disabledReason = `Sırada #${queueIdx + 1}`;
            }
          }

          return {
            territory: t,
            currentLvl,
            maxLvl: activeItem.maxLevel,
            cost,
            totalDays,
            queueLen: queue.length,
            inProgress: Boolean(queueItem),
            isMaxed: currentLvl >= activeItem.maxLevel,
            isHiddenIncompatible:
              (activeItem.requiresCapital &&
                !t.isCapital &&
                t.id !== playerNation.capitalTerritoryId) ||
              (activeItem.requiresCoastal && !isTerritoryCoastal(t)),
            eligible: !disabledReason,
            disabledReason,
          };
        } else {
          const opt = activeItem.option;
          const wrongResource = t.resource !== opt.resource;
          const elig = getSpecialtyTerritoryEligibility(t, opt);
          const queueIdx = queue.findIndex((q) => q.building === opt.buildingBoost);
          const queueItem = queueIdx >= 0 ? queue[queueIdx] : undefined;
          let disabledReason: string | null = null;
          if (wrongResource) {
            disabledReason = 'Kaynak Uygun Değil';
          } else if (elig.reason === 'MAXED') {
            disabledReason = 'Azami Seviye';
          } else if (elig.reason === 'IN_PROGRESS') {
            if (queueItem && queueIdx === 0) {
              const pct = Math.round(
                (queueItem.progressDays / Math.max(1, queueItem.totalDays)) * 100
              );
              disabledReason = `İnşada (%${pct})`;
            } else if (queueIdx > 0) {
              disabledReason = `Sırada #${queueIdx + 1}`;
            } else {
              disabledReason = 'İnşada';
            }
          }
          return {
            territory: t,
            currentLvl: elig.currentLvl,
            maxLvl: elig.maxLvl,
            cost: opt.costGold,
            totalDays: opt.buildDays,
            queueLen: queue.length,
            inProgress: elig.reason === 'IN_PROGRESS',
            isMaxed: elig.reason === 'MAXED',
            isHiddenIncompatible: wrongResource,
            eligible: !disabledReason,
            disabledReason,
          };
        }
      })
      .filter((row) => !row.isHiddenIncompatible)
      .sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        return (
          Number(b.territory.isCapital) - Number(a.territory.isCapital) ||
          b.territory.baseGdp - a.territory.baseGdp
        );
      });
  }, [activeItem, ownedTerritories, playerNation, techTree, buildCostMult]);

  const activeConstructionCount = useMemo(
    () =>
      ownedTerritories.reduce(
        (sum, t) => sum + (t.constructionQueue?.length || 0),
        0
      ),
    [ownedTerritories]
  );

  const handleCityClick = (city: Territory) => {
    if (!activeItem) return;
    sound.playClick();
    if (activeItem.kind === 'BUILDING') {
      onUpgradeBuilding(city.id, activeItem.buildingType);
    } else if (onInvestSpecialtyProduction) {
      onInvestSpecialtyProduction([city.id], activeItem.option.id);
    }
  };

  return (
    <div className="space-y-3" data-testid="construction-drawer">
      <AoH3MenuBanner
        artKey="ENGINEERING"
        branch="ECONOMY"
        icon="hammer"
        title="İnşaat & Yatırım Atölyesi"
        subtitle={`${ownedTerritories.length} Eyalet · ${activeConstructionCount} Sıradaki İnşaat · Hazine ${Math.floor(
          playerNation.treasury
        ).toLocaleString('tr-TR')} Altın`}
      />

      {/* Category Filters: Tümü, Ekonomi, Teknoloji, Diplomasi, Askeri */}
      <div
        role="tablist"
        aria-label="İnşaat kategorileri"
        className="grid grid-cols-5 gap-1 bg-[#100d09] p-1 rounded-xl border border-[#caa15a]/30"
      >
        {(
          [
            { id: 'ALL', label: 'Tümü' },
            { id: 'ECONOMY', label: 'Ekonomi' },
            { id: 'SCIENCE', label: 'Teknoloji' },
            { id: 'DIPLOMACY', label: 'Diplomasi' },
            { id: 'MILITARY', label: 'Askeri' },
          ] as const
        ).map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`construction-filter-${tab.id}`}
              onClick={() => {
                sound.playClick();
                setCategory(tab.id);
              }}
              className={`min-h-[38px] px-1 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors truncate cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                  : 'text-[#d8cbb5] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left 7 Cols: Illustrated Tech-Tree-Style Grand Architecture Catalog */}
        <div className="lg:col-span-7 bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-bold text-[#e0b86e] flex items-center gap-1.5">
              <Hammer className="w-3.5 h-3.5 shrink-0" />
              <span>İnşa Edilebilir Yapılar ({filteredItems.length})</span>
            </span>
            <span className="text-[10px] text-[#9b8e78]">
              Yapı seçip şehir tıklayın
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[380px] overflow-y-auto pr-0.5">
            {filteredItems.map((item) => {
              const isSelected = activeItem?.id === item.id;
              const isTechLocked =
                item.kind === 'BUILDING' &&
                Boolean(
                  item.requiredTechId &&
                    !(playerNation.unlockedTechs || []).includes(
                      item.requiredTechId
                    )
                );
              const liveStat = itemActiveStats[item.id];
              const hasActiveBuild = Boolean(liveStat && liveStat.count > 0);
              const imgBroken = brokenArtworkIds[item.id];

              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`construction-item-${item.id}`}
                  onClick={() => {
                    sound.playClick();
                    setSelectedItemId(item.id);
                  }}
                  style={{
                    background: item.artwork.fallbackGradient,
                  }}
                  className={`group relative h-[104px] sm:h-[112px] rounded-xl border text-left overflow-hidden select-none transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#f3ead7] ring-2 ring-[#e0b86e] ring-offset-1 ring-offset-[#14100c] shadow-lg'
                      : isTechLocked
                      ? 'border-[#3d3226]/80 opacity-75 hover:opacity-95'
                      : hasActiveBuild
                      ? 'border-[#e0b86e]/90 shadow-md shadow-[#caa15a]/15'
                      : 'border-[#caa15a]/45 hover:border-[#ebd090]'
                  }`}
                >
                  {/* Full-Bleed Architectural Painting */}
                  {!imgBroken && (
                    <img
                      src={item.artwork.src}
                      alt={item.title}
                      loading="eager"
                      decoding="sync"
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (!el.dataset.retried) {
                          el.dataset.retried = '1';
                          el.src = `${item.artwork.src}${
                            item.artwork.src.includes('?') ? '&' : '?'
                          }r=1`;
                          return;
                        }
                        setBrokenArtworkIds((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }));
                      }}
                      style={{
                        objectPosition: item.artwork.objectPosition,
                      }}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                        isTechLocked
                          ? 'grayscale-[60%] brightness-70'
                          : isSelected
                          ? 'brightness-100'
                          : 'brightness-90'
                      }`}
                    />
                  )}

                  {/* Measured Contrast Scrim for Crisp Legibility */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#090705]/95 via-[#090705]/40 to-[#090705]/50"
                  />

                  {/* Top Row: Glyph / Lock / Active Count + Gold Cost */}
                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                        isTechLocked
                          ? 'bg-black/75 border-rose-500/40 text-rose-300'
                          : hasActiveBuild
                          ? 'bg-[#2a1f11]/90 border-[#e0b86e]/70 text-[#f3ead7]'
                          : 'bg-black/65 border-[#caa15a]/40 text-[#e0b86e]'
                      }`}
                    >
                      {isTechLocked ? (
                        <Lock className="w-2.5 h-2.5" />
                      ) : item.kind === 'BUILDING' ? (
                        <AoH3GlyphSvg name={item.glyph} className="w-3 h-3" />
                      ) : (
                        <ResourceSvg
                          resource={item.option.resource}
                          className="w-3 h-3"
                        />
                      )}
                    </span>

                    <span className="font-mono-num text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/70 text-[#e0b86e] leading-none">
                      {hasActiveBuild && liveStat.maxPct > 0
                        ? `%${liveStat.maxPct}`
                        : `${item.baseCost}A+`}
                    </span>
                  </div>

                  {/* Bottom Text Overlay: Building Title & Key Effect */}
                  <div className="absolute bottom-1.5 left-2 right-2 z-10 space-y-0.5">
                    <div className="text-[11px] font-display font-bold text-[#faf3e3] leading-tight line-clamp-1 drop-shadow">
                      {item.title}
                    </div>
                    <div className="text-[9.5px] text-[#d8cbb5] leading-tight line-clamp-1">
                      {isTechLocked ? (
                        <span className="text-rose-300 font-semibold">
                          Araştırma Gerekli
                        </span>
                      ) : hasActiveBuild ? (
                        <span className="text-[#f3ead7] font-mono-num font-semibold">
                          {liveStat.count} şehirde sırada · {item.subtitle}
                        </span>
                      ) : (
                        item.effectSummary
                      )}
                    </div>
                  </div>

                  {/* Live Bottom Progress Rail if Building Currently Active */}
                  {hasActiveBuild && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60 z-10">
                      <div
                        className="h-full bg-gradient-to-r from-[#caa15a] to-[#f3ead7] transition-all duration-300"
                        style={{ width: `${Math.max(8, liveStat.maxPct)}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Illustrated Selected Structure Hero + Eligible Player Cities */}
        <div className="lg:col-span-5 bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-3 space-y-2.5">
          {activeItem && (
            <>
              {/* Illustrated Structure Detail Banner */}
              <div
                className="relative rounded-xl overflow-hidden border border-[#caa15a]/45 min-h-[82px]"
                style={{ background: activeItem.artwork.fallbackGradient }}
              >
                {!brokenArtworkIds[`hero_${activeItem.id}`] && (
                  <img
                    src={activeItem.artwork.src}
                    alt={activeItem.title}
                    loading="eager"
                    decoding="sync"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenArtworkIds((prev) => ({
                        ...prev,
                        [`hero_${activeItem.id}`]: true,
                      }))
                    }
                    style={{ objectPosition: activeItem.artwork.objectPosition }}
                    className="absolute inset-0 w-full h-full object-cover brightness-85"
                  />
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-r from-[#0c0907]/95 via-[#0c0907]/75 to-[#0c0907]/45"
                />
                <div className="relative z-10 p-2.5 flex flex-col justify-between gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-display font-bold text-[#faf3e3] truncate">
                        {activeItem.title}
                      </div>
                      <div className="text-[10px] text-[#e0b86e] font-semibold line-clamp-1">
                        {activeItem.effectSummary}
                      </div>
                    </div>
                    <span className="font-mono-num text-[10.5px] font-bold text-[#f3ead7] bg-black/60 px-1.5 py-0.5 rounded shrink-0">
                      {cityRows.filter((r) => r.eligible).length} Şehir
                    </span>
                  </div>
                  <p className="text-[10px] text-[#d8cbb5] leading-snug line-clamp-2">
                    {activeItem.description}
                  </p>
                </div>
              </div>

              <div
                data-testid="construction-city-list"
                className="space-y-1.5 max-h-[305px] overflow-y-auto pr-0.5"
              >
                {cityRows.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#120e0a] border border-[#caa15a]/20 text-center text-xs text-[#9b8e78]">
                    Bu yapı türü için uygun eyaletiniz bulunmuyor (kıyı veya özel doğal kaynak gerektirir).
                  </div>
                ) : (
                  cityRows.map((row) => {
                    const canAfford = playerNation.treasury >= row.cost;
                    const clickable = row.eligible && canAfford;

                    return (
                      <div
                        key={row.territory.id}
                        className={`rounded-xl border p-2 flex items-center justify-between gap-2 transition-colors ${
                          clickable
                            ? 'bg-[#1a1510] border-[#caa15a]/35 hover:border-[#e0b86e]'
                            : 'bg-[#120e0a] border-[#caa15a]/15 opacity-80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            sound.playSelectTerritory();
                            onSelectTerritory(row.territory.id);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          title="Haritada göster"
                        >
                          <span className="w-6 h-6 rounded-lg bg-[#14100c] border border-[#caa15a]/35 flex items-center justify-center shrink-0">
                            {row.territory.isCapital ? (
                              <Star className="w-3.5 h-3.5 text-[#e0b86e]" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-[#caa15a]" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#faf3e3] truncate">
                              {cleanProvinceName(row.territory.name)}
                            </div>
                            <div className="text-[10px] font-mono-num text-[#b8a990] flex items-center gap-1.5 truncate">
                              <span>
                                Sv.{row.currentLvl}/{row.maxLvl}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{row.totalDays} Gün</span>
                              {row.queueLen > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[#e0b86e]">
                                    {row.queueLen} Sırada
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          data-testid={`construct-city-btn-${row.territory.id}`}
                          disabled={!clickable}
                          onClick={() => handleCityClick(row.territory)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-[11px] font-extrabold font-mono-num inline-flex items-center gap-1.5 shrink-0 transition-colors whitespace-nowrap ${
                            clickable
                              ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] cursor-pointer shadow'
                              : 'bg-[#1b1510] border border-[#caa15a]/20 text-[#8e806a] cursor-not-allowed'
                          }`}
                        >
                          {row.isMaxed ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Azami</span>
                            </>
                          ) : row.disabledReason ? (
                            <span>{row.disabledReason}</span>
                          ) : !canAfford ? (
                            <span className="text-rose-300">
                              {row.cost.toLocaleString('tr-TR')}A (Yetersiz)
                            </span>
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5" />
                              <span>
                                {row.queueLen > 0 ? 'Sıraya Ekle' : 'İnşa Et'} ·{' '}
                                {row.cost.toLocaleString('tr-TR')}A
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
