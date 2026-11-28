import React, { useMemo, useState } from "react";
import { Swords, ArrowRight, Shield, Flag, Crown, Globe, Users, Flame, Castle, Truck, Hammer } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import { ProvinceForeignDiplomacyPanel } from "./ProvinceForeignDiplomacyPanel";
import { ProvinceFiefPanel } from "./ProvinceFiefPanel";
import {
  COMMANDERS,
  IDEOLOGIES,
  RESOURCE_INFO,
  getArmyGenerationInfo,
  getNationModernizedTier,
} from "../../data/world2026Data";
import {
  CULTURES,
  RELIGIONS,
  resolveTerritoryCulture,
  resolveTerritoryReligion,
} from "../../data/religionAndCultureData";
import {
  calculateProvinceDevelopment,
  isAtWar,
} from "../../engine/simulationEngine";
import {
  calculateProvinceSupplyLimit,
  getGameSeason,
  isTerritoryEncircled,
} from "../../engine/seasonSupplyAndAiProfile";
import { getProvinceWeather } from "../../engine/seasonalWeatherEngine";
import { computeVisibleTerritoryIds } from "../../engine/fogOfWarEngine";
import { TERRAIN_INFO } from "../../engine/pashaAndFiefEngine";
import {
  getProvinceCorridorNames,
  getProvinceStraitBadge,
} from "../../engine/straitsAndTradeEngine";
import { computeSendableTroops } from "../../engine/actions/armyMovementActions";
import { NationFlagCanvasBadge } from "../../map/nationFlagRenderer";
import { cleanNationName, cleanProvinceName } from "../../utils/formatters";
import { sound } from "../../utils/soundEngine";
import {
  AoH3GlyphSvg,
  ReligionSvg,
  ResourceSvg,
  TerrainPanoramaSvg,
} from "../illustrations/AoH3Illustrations";
import { UnitEraArtworkThumb } from "./UnitEraArtworkThumb";

export const ProvinceDrawer: React.FC<CommandDrawersProps> = ({
  onClose,
  playerNation,
  selectedTerritory,
  territories,
  nations,
  relations,
  wars,
  moveRatio,
  onSetMoveRatio,
  onStartArmyOrderMode,
  onExecuteArmyMove,
  onRecruitUnit,
  onBatchRecruitUnits,
  onAssimilateTerritory,
  onStartMissionary,
  onDiplomaticAction,
  onOfferLandPurchase,
  onIssueProvinceUltimatum,
  onPeaceDeal,
  onSelectTerritory,
  onInspectNation,
  onOpenWarModal,
  onAssignFiefLord,
  onBestowFavorOnLord,
  onSiegeBombardment,
  tick = 0,
  gameMode = "EMPIRES_1440",
  fogOfWarEnabled = true,
}) => {
  const [provinceSubTab, setProvinceSubTab] = useState<"ARMY" | "FIEF">("ARMY");

  const visibleTerritoryIds = useMemo(
    () =>
      computeVisibleTerritoryIds(
        territories,
        nations,
        relations,
        [],
        [],
        playerNation.id
      ),
    [territories, nations, relations, playerNation.id]
  );

  const isEncircled = React.useMemo(
    () =>
      selectedTerritory
        ? isTerritoryEncircled(selectedTerritory.id, territories, nations)
        : false,
    [selectedTerritory, territories, nations]
  );

  if (!selectedTerritory) {
    return (
      <div className="p-6 text-center text-xs text-[#b8a990] bg-[#14100c] rounded-2xl border border-[#caa15a]/35">
        Harita üzerinden incelemek veya yönetmek istediğiniz eyalete dokunun.
      </div>
    );
  }

  const selectedOwner = nations[selectedTerritory.ownerId];
  if (!selectedOwner) return null;

  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const isSelectedPlayerOwned = selectedTerritory.ownerId === playerNation.id;
  const hasSelectedIntel = !fogOfWarEnabled || visibleTerritoryIds.has(selectedTerritory.id);

  const provRel = resolveTerritoryReligion(selectedTerritory, selectedOwner);
  const provCul = resolveTerritoryCulture(selectedTerritory, selectedOwner);
  const relDef = RELIGIONS[provRel];
  const culDef = CULTURES[provCul];
  const playerStateRel = playerNation.stateReligion || 'ISLAM_SUNNI';
  const isDifferentReligion = provRel !== playerStateRel;
  const resMeta =
    RESOURCE_INFO[selectedTerritory.resource] || RESOURCE_INFO.TAHIL;
  const provDev = calculateProvinceDevelopment(
    selectedTerritory,
    selectedOwner
  );
  const seasonInfo = getGameSeason(tick, gameMode);
  const provinceWeather = getProvinceWeather(selectedTerritory, tick, gameMode);
  const supplyLimit = Math.round(
    calculateProvinceSupplyLimit(
      selectedTerritory,
      selectedOwner,
      seasonInfo,
      tick,
      gameMode
    ) * (isEncircled ? 0.65 : 1.0)
  );
  const isOverSupply = hasSelectedIntel && selectedTerritory.garrison > supplyLimit;

  const tMeta = TERRAIN_INFO[selectedTerritory.terrain || 'OVA'];
  const wallHp = selectedTerritory.castleWallHp ?? 100;
  const fiefLord = selectedTerritory.fiefLordId
    ? COMMANDERS.find((c) => c.id === selectedTerritory.fiefLordId)
    : null;
  const totalBuildingLevels = Object.values(selectedTerritory.buildings || {}).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );
  const stBadge = getProvinceStraitBadge(selectedTerritory.id, territories, wars);
  const corridors = getProvinceCorridorNames(selectedTerritory.id, gameMode);
  const isCore = selectedTerritory.coreOwnerId === selectedTerritory.ownerId;

  return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 5 Cols: Territory & Army Command */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl overflow-hidden space-y-3">
                  {/* AoH3-Style Illustrated Terrain Panorama Header */}
                  <div className="relative h-20 w-full overflow-hidden border-b border-[#caa15a]/30">
                    <TerrainPanoramaSvg
                      terrain={selectedTerritory.terrain || "OVA"}
                      fortLevel={selectedTerritory.buildings.fortress}
                      isCapital={selectedTerritory.isCapital}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14100c] via-[#14100c]/45 to-transparent p-3 flex items-end justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <NationFlagCanvasBadge
                          nationId={selectedOwner.id}
                          flagCode={selectedOwner.flagCode}
                          color={selectedOwner.color}
                          width={38}
                          height={26}
                        />
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-display font-bold text-[#faf3e3] drop-shadow flex items-center gap-1 truncate">
                            {selectedTerritory.isCapital && (
                              <AoH3GlyphSvg
                                name="star"
                                className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                              />
                            )}
                            <span className="truncate">
                              {cleanProvinceName(selectedTerritory.name)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#e0b86e] truncate">
                            {cleanNationName(selectedOwner.name)} ·{' '}
                            {IDEOLOGIES[selectedOwner.ideology]?.name ?? 'Monarşi'}
                            {selectedTerritory.isDistrict && (
                              <span className="ml-1.5 rounded border border-[#cbd5e1]/40 px-1 py-px text-[9.5px] font-semibold uppercase tracking-wide text-[#cbd5e1]">
                                {gameMode === 'EMPIRES_1440' ? 'Sancak' : 'İlçe'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 ${
                          isSelectedPlayerOwned
                            ? 'text-[#e0b86e]'
                            : isAtWar(wars, playerNation.id, selectedOwner.id)
                            ? 'text-rose-300'
                            : 'text-[#d8cbb5]'
                        }`}
                      >
                        {isSelectedPlayerOwned ? (
                          <>
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span>Sizde</span>
                          </>
                        ) : isAtWar(wars, playerNation.id, selectedOwner.id) ? (
                          <>
                            <Swords className="w-3.5 h-3.5 shrink-0" />
                            <span>Düşman</span>
                          </>
                        ) : (
                          <>
                            <Flag className="w-3.5 h-3.5 shrink-0" />
                            <span>Yabancı</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 pb-3.5 space-y-2.5">
                  {/* AoH3 2x4 Compact Icon + Number Grid */}
                  <div
                    data-testid="aoh3-province-stat-grid"
                    className="grid grid-cols-4 gap-1.5"
                  >
                    {/* 1. Nüfus / Garnizon */}
                    <div className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0">
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Users className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>Ordu</span>
                      </div>
                      <div
                        className={`font-mono-num text-xs font-bold mt-0.5 truncate ${
                          isSelectedPlayerOwned ? 'text-[#f3ead7]' : 'text-rose-300'
                        }`}
                      >
                        {hasSelectedIntel
                          ? `${(selectedTerritory.garrison / 1000).toFixed(1)}B`
                          : '?'}
                      </div>
                    </div>

                    {/* 2. Din */}
                    <div
                      className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0"
                      title={relDef?.name}
                    >
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <ReligionSvg
                          religionId={provRel}
                          className="w-3 h-3 text-[#e0b86e] shrink-0"
                        />
                        <span>Din</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#f3ead7] mt-0.5 truncate">
                        {relDef?.name ?? '—'}
                      </div>
                    </div>

                    {/* 3. Kültür & Statü */}
                    <div
                      className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0"
                      title={`${culDef?.name} (${isCore ? 'Öz Vatan' : 'Asim. Gerekli'})`}
                    >
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Globe className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>{isCore ? 'Öz Vatan' : 'Fetih'}</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#f3ead7] mt-0.5 truncate">
                        {culDef?.name ?? '—'}
                      </div>
                    </div>

                    {/* 4. Huzursuzluk */}
                    <div className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0">
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Flame className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>İsyan</span>
                      </div>
                      <div
                        className={`font-mono-num text-xs font-bold mt-0.5 truncate ${
                          selectedTerritory.unrest >= 15
                            ? 'text-rose-400'
                            : selectedTerritory.unrest >= 5
                            ? 'text-[#e0b86e]'
                            : 'text-[#d8cbb5]'
                        }`}
                      >
                        %{selectedTerritory.unrest}
                      </div>
                    </div>

                    {/* 5. Kaynak */}
                    <div
                      className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0"
                      title={`${resMeta.name} (×${provDev.totalInvestmentMult})`}
                    >
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <ResourceSvg
                          resource={selectedTerritory.resource}
                          className="w-3 h-3 text-[#e0b86e] shrink-0"
                        />
                        <span className="truncate">{resMeta.name}</span>
                      </div>
                      <div className="font-mono-num text-xs font-bold text-[#e0b86e] mt-0.5 truncate">
                        +{provDev.effectiveResourceValue}A
                      </div>
                    </div>

                    {/* 6. Bina & Gelişim */}
                    <div className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0">
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Hammer className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>Gelişim</span>
                      </div>
                      <div className="font-mono-num text-xs font-bold text-[#f3ead7] mt-0.5 truncate">
                        {provDev.developmentScore}P · {totalBuildingLevels}B
                      </div>
                    </div>

                    {/* 7. Sur % */}
                    <div
                      className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0"
                      title={tMeta.name}
                    >
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Castle className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span className="truncate">{tMeta.name}</span>
                      </div>
                      <div className="font-mono-num text-xs font-bold text-[#f3ead7] mt-0.5 truncate">
                        %{wallHp}
                      </div>
                    </div>

                    {/* 8. İkmal */}
                    <div
                      className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl p-2 min-w-0"
                      title={`${provinceWeather.label} · İkmal Çarpanı ×${provinceWeather.supplyMultiplier.toFixed(2)}`}
                    >
                      <div className="text-[9.5px] text-[#a79880] flex items-center gap-1 truncate">
                        <Truck className="w-3 h-3 text-[#e0b86e] shrink-0" />
                        <span>İkmal</span>
                      </div>
                      <div
                        className={`font-mono-num text-xs font-bold mt-0.5 truncate ${
                          isOverSupply ? 'text-rose-400' : 'text-[#f3ead7]'
                        }`}
                      >
                        {(supplyLimit / 1000).toFixed(0)}B
                        {isOverSupply ? '!' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Seasonal Weather & Terrain Telemetry Strip */}
                  <div
                    data-testid="province-drawer-weather"
                    className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                    title={provinceWeather.summary}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: provinceWeather.accentHex }}
                        aria-hidden="true"
                      />
                      <span
                        className="font-bold truncate"
                        style={{ color: provinceWeather.accentHex }}
                      >
                        {provinceWeather.label}
                      </span>
                      <span className="text-[#8e806b] text-[10px] truncate">
                        · {tMeta.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 font-mono-num text-[10.5px] text-[#d8cbb5] shrink-0">
                      <span title="Arazi ve hava kaynaklı yürüyüş hızı">
                        Hız %{Math.round(provinceWeather.movementSpeedMultiplier * 100)}
                      </span>
                      <span className="text-[#caa15a]/35">·</span>
                      <span title="Muharebede birlik verimi">
                        Verim %{Math.round(provinceWeather.troopEfficiencyMultiplier * 100)}
                      </span>
                      <span className="text-[#caa15a]/35">·</span>
                      <span
                        className={
                          provinceWeather.attritionMultiplier >= 1.5
                            ? 'text-rose-300 font-bold'
                            : 'text-[#d8cbb5]'
                        }
                        title="Haftalık hava ve ikmal yıpranma çarpanı"
                      >
                        Yıpranma ×{provinceWeather.attritionMultiplier.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Single-line Troop Composition & Context Bar */}
                  <div className="bg-[#1b1510] border border-[#caa15a]/25 rounded-xl px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num">
                    {hasSelectedIntel ? (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[#f3ead7] font-bold inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                          <span>
                            {activeArmyGen.infantryShort}{' '}
                            {((selectedTerritory.units?.infantry || 0) / 1000).toFixed(1)}B
                          </span>
                        </span>
                        <span className="text-[#caa15a]/40">·</span>
                        <span className="text-[#e0b86e] font-bold inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="cavalry" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                          <span>
                            {activeArmyGen.armorShort}{' '}
                            {((selectedTerritory.units?.armor || 0) / 1000).toFixed(1)}B
                          </span>
                        </span>
                        <span className="text-[#caa15a]/40">·</span>
                        <span className="text-[#d8cbb5] font-bold inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="artillery" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                          <span>
                            {activeArmyGen.airArtilleryShort}{' '}
                            {((selectedTerritory.units?.airDrone || 0) / 1000).toFixed(1)}B
                          </span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#a79880] font-sans">
                        ? Savaş Sisi — Komşu değil
                      </span>
                    )}
                    {fiefLord && (
                      <span className="text-[#e0b86e] font-sans font-semibold inline-flex items-center gap-1 shrink-0">
                        <AoH3GlyphSvg name="fleur" className="w-3 h-3 shrink-0" />
                        <span>{fiefLord.name}</span>
                      </span>
                    )}
                  </div>

                  {(isEncircled || stBadge || corridors.length > 0) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-xl bg-[#1a140e] border border-[#caa15a]/25 text-[11px]">
                      {isEncircled && (
                        <span className="text-rose-300 font-bold inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="alert" className="w-3.5 h-3.5 shrink-0" />
                          <span>Kuşatılmış (−%25 Sav)</span>
                        </span>
                      )}
                      {stBadge && (
                        <span className="text-[#e0b86e] font-mono-num font-semibold inline-flex items-center gap-1">
                          <AoH3GlyphSvg name="anchor" className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {stBadge.straitName} (+{stBadge.dailyTollShare}A)
                          </span>
                        </span>
                      )}
                      {corridors.length > 0 && (
                        <span className="text-[#d8cbb5] truncate">
                          {corridors[0]}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Compact Mobile 2-Tab Switcher (Obsidian + Gold, 44px touch targets) */}
                  {isSelectedPlayerOwned && (
                    <div
                      role="tablist"
                      aria-label="Eyalet yönetim bölümleri"
                      className="sticky top-0 z-10 grid grid-cols-2 gap-1 bg-[#0f0c09]/95 backdrop-blur-md p-1 rounded-xl border border-[#caa15a]/30 lg:hidden"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={provinceSubTab === 'ARMY'}
                        onClick={() => setProvinceSubTab('ARMY')}
                        className={`min-h-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          provinceSubTab === 'ARMY'
                            ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]'
                            : 'text-[#d8cbb5] hover:text-white'
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5 shrink-0" />
                        <span>Ordu</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={provinceSubTab === 'FIEF'}
                        onClick={() => setProvinceSubTab('FIEF')}
                        className={`min-h-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          provinceSubTab === 'FIEF'
                            ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c]'
                            : 'text-[#d8cbb5] hover:text-white'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5 shrink-0" />
                        <span>Yönetim</span>
                      </button>
                    </div>
                  )}

                  {/* Assimilate Non-Core Province Card */}
                  {isSelectedPlayerOwned &&
                    (selectedTerritory.coreOwnerId !== playerNation.id ||
                      (selectedTerritory.assimilation ?? 100) < 100 ||
                      selectedTerritory.isAssimilating) && (
                      <div className="block">
                        {selectedTerritory.isOccupied ? (
                          <div className="w-full px-3 py-2 rounded-xl bg-[#1b1510] border border-[#caa15a]/30 text-[#e0b86e] text-[11px] flex items-center gap-1.5 font-semibold">
                            <Globe className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                            <span>Geçici İşgal (Barış sonrası asimile edilir)</span>
                          </div>
                        ) : selectedTerritory.isAssimilating ? (
                          <div className="w-full p-2.5 rounded-xl bg-[#1b1510] border border-[#caa15a]/45 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-[#f3ead7]">
                              <span className="flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                                <span>Asimilasyon</span>
                              </span>
                              <span className="font-mono-num text-[#e0b86e]">
                                %{Math.round(selectedTerritory.assimilation ?? 25)} (
                                {Math.max(
                                  1,
                                  Math.ceil(
                                    (100 - (selectedTerritory.assimilation ?? 25)) /
                                      1.25
                                  )
                                )}
                                g)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#0d0a07] rounded-full overflow-hidden border border-[#caa15a]/25">
                              <div
                                className="h-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(
                                    5,
                                    selectedTerritory.assimilation ?? 25
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onAssimilateTerritory(selectedTerritory.id)
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/50 text-[#f3ead7] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                              <span>
                                Asimile Et (%
                                {Math.round(
                                  selectedTerritory.assimilation ??
                                    (selectedTerritory.coreOwnerId === playerNation.id ? 75 : 25)
                                )}
                                )
                              </span>
                            </span>
                            <span className="font-mono-num text-[#e0b86e] shrink-0 ml-2">
                              180A · ~60g
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* Dini Tebliğ ve Misyoner Gönderimi */}
                  {isSelectedPlayerOwned &&
                    (isDifferentReligion || selectedTerritory.missionary) && (
                      <div
                        className={
                          provinceSubTab === 'FIEF'
                            ? 'block'
                            : 'hidden lg:block'
                        }
                      >
                        {selectedTerritory.missionary ? (
                          <div className="w-full p-2.5 rounded-xl bg-[#1b1510] border border-[#caa15a]/45 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-[#f3ead7]">
                              <span>
                                Tebliğ → {RELIGIONS[selectedTerritory.missionary.targetReligion]?.name}
                              </span>
                              <span className="font-mono-num text-[#e0b86e]">
                                %{Math.round(
                                  (selectedTerritory.missionary.progressDays /
                                    selectedTerritory.missionary.totalDays) *
                                    100
                                )}{' '}
                                ({selectedTerritory.missionary.totalDays -
                                  selectedTerritory.missionary.progressDays}
                                g)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[#0d0a07] rounded-full overflow-hidden border border-[#caa15a]/25">
                              <div
                                className="h-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(
                                    5,
                                    Math.round(
                                      (selectedTerritory.missionary.progressDays /
                                        selectedTerritory.missionary.totalDays) *
                                        100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onStartMissionary &&
                              onStartMissionary(selectedTerritory.id)
                            }
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/50 text-[#f3ead7] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <ReligionSvg
                                religionId={playerStateRel}
                                className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                              />
                              <span>
                                Tebliğ ({RELIGIONS[playerStateRel]?.name || 'Devlet Dini'})
                              </span>
                            </span>
                            <span className="font-mono-num text-[#e0b86e] shrink-0 ml-2">
                              120A · 60g
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* Player Owned: Tech-Synced Unit Recruitment & Army Movement */}
                  {isSelectedPlayerOwned && (
                    <div
                      className={`pt-2 space-y-3 border-t border-[#caa15a]/25 ${
                        provinceSubTab === 'ARMY' ? 'block' : 'hidden lg:block'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#f3ead7]">
                          Seferberlik · {activeArmyGen.generationLabel} ({activeArmyGen.eraTitle})
                        </span>
                        <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-[#1b1510] border border-[#caa15a]/40 text-[#e0b86e] font-bold">
                          +{activeArmyGen.combatBonusPct}% Güç
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Infantry Card */}
                        <div className="p-2 rounded-xl bg-[#1b1510] border border-[#caa15a]/35 flex flex-col items-center justify-between gap-1.5 text-center group">
                          <div className="flex flex-col items-center gap-1 w-full">
                            <UnitEraArtworkThumb
                              unitType="infantry"
                              gameMode={gameMode}
                              tier={modernizedTier}
                              alt={activeArmyGen.infantryShort}
                              showEraPill
                              className="w-full h-14 rounded-lg"
                            />
                            <span className="text-[11px] font-bold text-[#f3ead7] truncate w-full">
                              {activeArmyGen.infantryShort}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 w-full">
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'infantry',
                                  1000,
                                  120
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +1B (120A)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'infantry',
                                  5000,
                                  250
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +5B (250A)
                            </button>
                          </div>
                          {onBatchRecruitUnits && (
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits(
                                  'SINGLE_MAX',
                                  'infantry',
                                  selectedTerritory.id
                                )
                              }
                              className="w-full py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <AoH3GlyphSvg name="bolt" className="w-3 h-3 shrink-0" />
                              <span className="truncate">Maks {activeArmyGen.infantryShort}</span>
                            </button>
                          )}
                        </div>

                        {/* Armor / Cavalry Card */}
                        <div className="p-2 rounded-xl bg-[#1b1510] border border-[#caa15a]/35 flex flex-col items-center justify-between gap-1.5 text-center group">
                          <div className="flex flex-col items-center gap-1 w-full">
                            <UnitEraArtworkThumb
                              unitType="armor"
                              gameMode={gameMode}
                              tier={modernizedTier}
                              alt={activeArmyGen.armorShort}
                              showEraPill
                              className="w-full h-14 rounded-lg"
                            />
                            <span className="text-[11px] font-bold text-[#f3ead7] truncate w-full">
                              {activeArmyGen.armorShort}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 w-full">
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'armor',
                                  1000,
                                  180
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +1B (180A)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'armor',
                                  2500,
                                  420
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +2.5B (420A)
                            </button>
                          </div>
                          {onBatchRecruitUnits && (
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits(
                                  'SINGLE_MAX',
                                  'armor',
                                  selectedTerritory.id
                                )
                              }
                              className="w-full py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <AoH3GlyphSvg name="bolt" className="w-3 h-3 shrink-0" />
                              <span className="truncate">Maks {activeArmyGen.armorShort}</span>
                            </button>
                          )}
                        </div>

                        {/* Air / Artillery Card */}
                        <div className="p-2 rounded-xl bg-[#1b1510] border border-[#caa15a]/35 flex flex-col items-center justify-between gap-1.5 text-center group">
                          <div className="flex flex-col items-center gap-1 w-full">
                            <UnitEraArtworkThumb
                              unitType="airDrone"
                              gameMode={gameMode}
                              tier={modernizedTier}
                              alt={activeArmyGen.airArtilleryShort}
                              showEraPill
                              className="w-full h-14 rounded-lg"
                            />
                            <span className="text-[11px] font-bold text-[#f3ead7] truncate w-full">
                              {activeArmyGen.airArtilleryShort}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 w-full">
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'airDrone',
                                  1000,
                                  500
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +1B (500A)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onRecruitUnit(
                                  selectedTerritory.id,
                                  'airDrone',
                                  2500,
                                  1100
                                )
                              }
                              className="px-1 py-1 rounded-lg bg-[#241c13] hover:bg-[#322619] border border-[#caa15a]/35 text-[#f3ead7] text-[10px] font-bold cursor-pointer"
                            >
                              +2.5B (1100A)
                            </button>
                          </div>
                          {onBatchRecruitUnits && (
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits(
                                  'SINGLE_MAX',
                                  'airDrone',
                                  selectedTerritory.id
                                )
                              }
                              className="w-full py-1 rounded-lg bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <AoH3GlyphSvg name="bolt" className="w-3 h-3 shrink-0" />
                              <span className="truncate">Maks {activeArmyGen.airArtilleryShort}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Batch Recruitment Bar in Province Drawer */}
                      {onBatchRecruitUnits && (
                        <div className="p-2.5 rounded-xl bg-[#14100c] border border-[#caa15a]/35 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-[#e0b86e] inline-flex items-center gap-1">
                              <AoH3GlyphSvg name="bolt" className="w-3.5 h-3.5 shrink-0" />
                              <span>Toplu Asker Bas (Sınırlara &amp; Tüm Ülkeye):</span>
                            </span>
                            <span className="text-[10px] text-[#b8a990]">
                              Tek tıkla ulusal seferberlik
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits('BORDER', 'MIXED', selectedTerritory.id, 1)
                              }
                              className="px-2 py-1.5 rounded-lg bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/40 text-[#f3ead7] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 text-center cursor-pointer"
                            >
                              <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                              <span>Sınırlara Karma Ordu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits('BORDER', 'infantry', selectedTerritory.id, 1)
                              }
                              className="px-2 py-1.5 rounded-lg bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/40 text-[#f3ead7] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 text-center cursor-pointer"
                            >
                              <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                              <span>Sınırlara {activeArmyGen.infantryShort}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits('BORDER', 'armor', selectedTerritory.id, 1)
                              }
                              className="px-2 py-1.5 rounded-lg bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/40 text-[#f3ead7] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 text-center cursor-pointer"
                            >
                              <AoH3GlyphSvg name="cavalry" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                              <span>Sınırlara {activeArmyGen.armorShort}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onBatchRecruitUnits('ALL', 'MIXED', selectedTerritory.id, 1)
                              }
                              className="px-2 py-1.5 rounded-lg bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/40 text-[#f3ead7] text-[10px] font-extrabold inline-flex items-center justify-center gap-1 text-center cursor-pointer"
                            >
                              <AoH3GlyphSvg name="globe" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                              <span>Tüm Ülkeye Karma</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Army Dispatch Controls */}
                      <div className="bg-[#1b1510] border border-[#caa15a]/30 rounded-xl p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#f3ead7] font-medium font-mono-num">
                            Sevk: <strong>%{Math.round(moveRatio * 100)}</strong> (
                            {Math.round(
                              computeSendableTroops(selectedTerritory.garrison) * moveRatio
                            ).toLocaleString('tr-TR')}{' '}
                            Asker)
                          </span>
                          <div className="flex gap-1">
                            {[0.25, 0.5, 0.75, 1].map((r) => (
                              <button
                                type="button"
                                key={r}
                                onClick={() => onSetMoveRatio(r)}
                                className={`min-h-[36px] px-2.5 py-0.5 rounded text-[11px] font-mono-num cursor-pointer ${
                                  moveRatio === r
                                    ? 'bg-[#e0b86e] text-[#14100c] font-bold'
                                    : 'bg-[#120e0a] text-[#c5b79e] border border-[#caa15a]/25'
                                }`}
                              >
                                %{r * 100}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onStartArmyOrderMode(selectedTerritory.id);
                            onClose();
                          }}
                          className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#caa15a] to-[#e0b86e] hover:from-[#d8b16a] hover:to-[#ecc67d] text-[#14100c] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Swords className="w-4 h-4" />
                          <span>Haritadan Hedef Seç</span>
                        </button>

                        {/* Quick Neighbor Target Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {selectedTerritory.neighbors.map((nId) => {
                            const nTerr = territories[nId];
                            if (!nTerr) return null;
                            const isOwn = nTerr.ownerId === playerNation.id;
                            const atWar = isAtWar(
                              wars,
                              playerNation.id,
                              nTerr.ownerId
                            );
                            return (
                              <button
                                type="button"
                                key={nId}
                                onClick={() =>
                                  onExecuteArmyMove(selectedTerritory.id, nId)
                                }
                                className={`min-h-[40px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border transition-colors cursor-pointer ${
                                  isOwn
                                    ? 'bg-[#231b12] border-[#e0b86e]/55 text-[#e0b86e] hover:bg-[#2d2317]'
                                    : atWar
                                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200 hover:bg-rose-900/70'
                                    : 'bg-[#120e0a] border-[#caa15a]/25 text-[#d8cbb5] hover:border-[#caa15a]/55'
                                }`}
                              >
                                <span>{cleanProvinceName(nTerr.name)}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Right 7 Cols: Fief Lord Assignment + Buildings (if owned) OR Siege + Foreign Diplomacy (if foreign) */}
              <div className="lg:col-span-7 space-y-4">
                {isSelectedPlayerOwned ? (
                  <>
                    <ProvinceFiefPanel
                      playerNation={playerNation}
                      selectedTerritory={selectedTerritory}
                      territories={territories}
                      isVisibleOnMobile={provinceSubTab === 'FIEF'}
                      onAssignFiefLord={onAssignFiefLord}
                      onBestowFavorOnLord={onBestowFavorOnLord}
                    />
                  </>
                ) : (
                  /* Foreign Nation Siege & Diplomatic Command Box */
                  <ProvinceForeignDiplomacyPanel
                    playerNation={playerNation}
                    selectedTerritory={selectedTerritory}
                    selectedOwner={selectedOwner}
                    territories={territories}
                    nations={nations}
                    relations={relations}
                    wars={wars}
                    gameMode={gameMode}
                    onDiplomaticAction={onDiplomaticAction}
                    onOfferLandPurchase={onOfferLandPurchase}
                    onIssueProvinceUltimatum={onIssueProvinceUltimatum}
                    onPeaceDeal={onPeaceDeal}
                    onSelectTerritory={onSelectTerritory}
                    onInspectNation={onInspectNation}
                    onOpenWarModal={onOpenWarModal}
                    onSiegeBombardment={onSiegeBombardment}
                    onClose={onClose}
                  />
                )}
              </div>
            </div>
  );
};
