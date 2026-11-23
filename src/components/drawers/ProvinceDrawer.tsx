import React, { useState } from "react";
import { Swords, ArrowRight } from "lucide-react";
import { CommandDrawersProps } from "./drawerTypes";
import { ProvinceForeignDiplomacyPanel } from "./ProvinceForeignDiplomacyPanel";
import { ProvinceFiefPanel } from "./ProvinceFiefPanel";
import { ProvinceBuildingsPanel } from "./ProvinceBuildingsPanel";
import {
  COMMANDERS,
  IDEOLOGIES,
  RESOURCE_INFO,
  calculateArmyModernizationCost,
  getArmyGenerationInfo,
  getNationModernizedTier,
  getNationUnlockedMilTier,
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
import { computeVisibleTerritoryIds } from "../../engine/fogOfWarEngine";
import { TERRAIN_INFO } from "../../engine/pashaAndFiefEngine";
import {
  getProvinceCorridorNames,
  getProvinceStraitBadge,
} from "../../engine/straitsAndTradeEngine";
import { sound } from "../../utils/soundEngine";
import {
  TerrainPanoramaSvg,
  UnitTypeIllustrationSvg,
} from "../illustrations/AoH3Illustrations";

export const ProvinceDrawer: React.FC<CommandDrawersProps> = ({
  onClose,
  playerNation,
  playerEconomy,
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
  onUpgradeBuilding,
  onAssimilateTerritory,
  onStartMissionary,
  onDiplomaticAction,
  onPeaceDeal,
  onSelectTerritory,
  onInspectNation,
  onModernizeNationalArmy,
  onAssignFiefLord,
  onBestowFavorOnLord,
  onSiegeBombardment,
  gameMode = "EMPIRES_1440",
  fogOfWarEnabled = true,
}) => {
  const [provinceSubTab, setProvinceSubTab] = useState<"ARMY" | "ECONOMY" | "FIEF">("ARMY");

  if (!selectedTerritory) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/70 rounded-2xl border border-slate-800">
        Harita üzerinden incelemek veya yönetmek istediğiniz eyalete dokunun.
      </div>
    );
  }

  const selectedOwner = nations[selectedTerritory.ownerId];
  if (!selectedOwner) return null;

  const unlockedMilTier = getNationUnlockedMilTier(playerNation);
  const modernizedTier = getNationModernizedTier(playerNation);
  const activeArmyGen = getArmyGenerationInfo(gameMode, modernizedTier);
  const hasPendingArmyUpgrade = unlockedMilTier > modernizedTier;
  const modernizationCost = calculateArmyModernizationCost(
    playerNation,
    playerEconomy.totalGarrison
  );
  const visibleTerritoryIds = computeVisibleTerritoryIds(
    territories,
    nations,
    relations,
    [],
    [],
    playerNation.id
  );
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

  return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 5 Cols: Territory & Army Command */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden space-y-3">
                  {/* AoH3-Style Illustrated Terrain Panorama Header */}
                  <div className="relative h-24 w-full overflow-hidden border-b border-slate-800">
                    <TerrainPanoramaSvg
                      terrain={selectedTerritory.terrain || "OVA"}
                      fortLevel={selectedTerritory.buildings.fortress}
                      isCapital={selectedTerritory.isCapital}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent p-3 flex items-end justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-xs text-white shadow-lg border border-white/20"
                          style={{ backgroundColor: selectedOwner.color }}
                        >
                          {selectedOwner.flagCode}
                        </span>
                        <div>
                          <div className="text-sm sm:text-base font-bold text-white drop-shadow">
                            {selectedTerritory.isCapital ? '★ ' : ''}
                            {selectedTerritory.name.replace(/^★\s*/, '')}
                          </div>
                          <div className="text-[11px] text-amber-200/95 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>
                              {selectedOwner.name} ·{' '}
                              {IDEOLOGIES[selectedOwner.ideology]?.name ?? 'Monarşi'}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shadow-sm flex items-center gap-1"
                              style={{ backgroundColor: `${relDef?.color || '#059669'}dd` }}
                              title={`${relDef?.name}: ${relDef?.description}`}
                            >
                              <span>{relDef?.symbol}</span>
                              <span>{relDef?.name}</span>
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shadow-sm"
                              style={{ backgroundColor: `${culDef?.color || '#DC2626'}dd` }}
                              title={`${culDef?.name}: ${culDef?.description}`}
                            >
                              🏹 {culDef?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                          isSelectedPlayerOwned
                            ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-300'
                            : isAtWar(wars, playerNation.id, selectedOwner.id)
                            ? 'bg-rose-950/90 border-rose-400/60 text-rose-200'
                            : 'bg-slate-900/90 border-slate-700 text-slate-300'
                        }`}
                      >
                        {isSelectedPlayerOwned
                          ? '🛡 SİZİN EYALETİNİZ'
                          : isAtWar(wars, playerNation.id, selectedOwner.id)
                          ? '⚔️ DÜŞMAN TOPRAĞI'
                          : '🏳 YABANCI EYALET'}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-3">
                  {/* Territory Metrics & Unit Composition (Respects Fog of War) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5">
                      <div className="text-[11px] text-slate-400">
                        {isSelectedPlayerOwned ? 'Sizin Garnizonunuz' : 'Bölge Garnizonu'}
                      </div>
                      <div
                        className={`font-mono-num text-sm font-bold mt-0.5 ${
                          isSelectedPlayerOwned ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {hasSelectedIntel
                          ? `${selectedTerritory.garrison.toLocaleString('tr-TR')} Asker`
                          : '? (Savaş Sisi)'}
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Üretim Kaynağı & Değer</span>
                        <span className="text-[10px] font-mono-num text-emerald-300 font-bold">
                          ×{provDev.totalInvestmentMult} Yatırım
                        </span>
                      </div>
                      <div className="text-xs font-bold text-amber-300 mt-0.5 truncate">
                        {resMeta.icon} {resMeta.name}
                      </div>
                      <div className="text-[10px] font-mono-num text-slate-300 mt-0.5">
                        Ham {provDev.baseResourceValue}A →{' '}
                        <strong className="text-emerald-400">
                          {provDev.effectiveResourceValue} Altın/gün
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* City Development Score & Investment Breakdown Strip */}
                  <div className="bg-emerald-950/35 border border-emerald-500/35 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <span>★ Şehir Gelişim Puanı: {provDev.developmentScore}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] text-emerald-200 border border-emerald-500/30">
                          {provDev.tierLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        Bina Yatırımı ×{provDev.buildingInvestmentMult} · Teknoloji ×{provDev.techInvestmentMult} · Toplam Günlük Katkı:{' '}
                        <strong className="font-mono-num text-amber-300">
                          +{provDev.effectiveDailyGdp} GDP
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Unit Breakdown Bar */}
                  <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    {hasSelectedIntel ? (
                      <>
                        <div>
                          <span className="text-slate-400">{activeArmyGen.infantryShort}: </span>
                          <strong className="font-mono-num text-slate-200">
                            {((selectedTerritory.units?.infantry || 0) / 1000).toFixed(1)}B
                          </strong>
                        </div>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <div>
                          <span className="text-slate-400">{activeArmyGen.armorShort}: </span>
                          <strong className="font-mono-num text-amber-400">
                            {((selectedTerritory.units?.armor || 0) / 1000).toFixed(1)}B
                          </strong>
                        </div>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <div>
                          <span className="text-slate-400">{activeArmyGen.airArtilleryShort}: </span>
                          <strong className="font-mono-num text-sky-400">
                            {((selectedTerritory.units?.airDrone || 0) / 1000).toFixed(1)}B
                          </strong>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-400 text-[11px]">
                        İstihbarat Yok: Sınır komşusu olmayan yabancı eyaletlerin birlik dağılımı gizlidir.
                      </div>
                    )}
                  </div>

                  {/* Terrain & Castle Wall Integrity Bar (AoH3 + Bannerlord Siege Info) */}
                  {(() => {
                    const tMeta =
                      TERRAIN_INFO[selectedTerritory.terrain || 'OVA'];
                    const wallHp = selectedTerritory.castleWallHp ?? 100;
                    const fiefLord = selectedTerritory.fiefLordId
                      ? COMMANDERS.find(
                          (c) => c.id === selectedTerritory.fiefLordId
                        )
                      : null;
                    return (
                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-slate-400">Arazi: </span>
                            <strong
                              style={{ color: tMeta.color }}
                              className="font-semibold"
                            >
                              {tMeta.name}
                            </strong>
                          </div>
                          <div className="font-mono-num text-amber-300">
                            ♜ Kale Suru: %{wallHp}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>{tMeta.summary}</span>
                          {fiefLord && (
                            <span className="text-purple-300 font-semibold">
                              ⚜ Tımar: {fiefLord.name}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const stBadge = getProvinceStraitBadge(
                            selectedTerritory.id,
                            territories,
                            wars
                          );
                          const corridors = getProvinceCorridorNames(
                            selectedTerritory.id,
                            gameMode
                          );
                          if (!stBadge && corridors.length === 0) return null;
                          return (
                            <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[11px]">
                              {stBadge && (
                                <div className="flex items-center justify-between text-amber-300 font-semibold">
                                  <span>⚓ {stBadge.straitName}</span>
                                  <span className="font-mono-num">
                                    +{stBadge.dailyTollShare}G/gün Gümrük
                                  </span>
                                </div>
                              )}
                              {corridors.length > 0 && (
                                <div className="text-sky-300 truncate">
                                  {corridors[0]}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Province Core & Unrest Status Bar */}
                  <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Statü: </span>
                      <strong
                        className={
                          selectedTerritory.coreOwnerId === selectedTerritory.ownerId
                            ? 'text-emerald-400'
                            : 'text-orange-400'
                        }
                      >
                        {selectedTerritory.isCapital ? '★ Başkent · ' : ''}
                        {selectedTerritory.coreOwnerId === selectedTerritory.ownerId
                          ? 'Öz Vatan Toprağı (Core)'
                          : 'Yeni Fethedilen Bölge (Asimilasyon Gerekli)'}
                      </strong>
                    </div>
                    <div className="font-mono-num text-slate-300">
                      Huzursuzluk: %{selectedTerritory.unrest}
                    </div>
                  </div>

                  {/* Compact Mobile 3-Tab Switcher (AoH3-style contextual sections) */}
                  {isSelectedPlayerOwned && (
                    <div
                      role="tablist"
                      aria-label="Eyalet yönetim bölümleri"
                      className="sticky top-0 z-10 grid grid-cols-3 gap-1.5 bg-slate-950/95 backdrop-blur-md p-1 rounded-xl border border-slate-800 lg:hidden"
                    >
                      <button
                        role="tab"
                        aria-selected={provinceSubTab === 'ARMY'}
                        onClick={() => setProvinceSubTab('ARMY')}
                        className={`min-h-[48px] rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 ${
                          provinceSubTab === 'ARMY'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="text-sm leading-none">⚔️</span>
                        <span>Ordu</span>
                        <span className="text-[9px] font-medium opacity-70">Hareket & birlik</span>
                      </button>
                      <button
                        role="tab"
                        aria-selected={provinceSubTab === 'ECONOMY'}
                        onClick={() => setProvinceSubTab('ECONOMY')}
                        className={`min-h-[48px] rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 ${
                          provinceSubTab === 'ECONOMY'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="text-sm leading-none">🏛️</span>
                        <span>Ekonomi</span>
                        <span className="text-[9px] font-medium opacity-70">Bina & gelir</span>
                      </button>
                      <button
                        role="tab"
                        aria-selected={provinceSubTab === 'FIEF'}
                        onClick={() => setProvinceSubTab('FIEF')}
                        className={`min-h-[48px] rounded-lg text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5 ${
                          provinceSubTab === 'FIEF'
                            ? 'bg-purple-500 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="text-sm leading-none">⚜️</span>
                        <span>Yönetim</span>
                        <span className="text-[9px] font-medium opacity-70">Tımar & vali</span>
                      </button>
                    </div>
                  )}

                  {/* Assimilate Non-Core Province Card (AoH3 Style) */}
                  {isSelectedPlayerOwned &&
                    (selectedTerritory.coreOwnerId !== playerNation.id ||
                      selectedTerritory.isAssimilating ||
                      selectedTerritory.unrest > 10) && (
                      <div
                        className={
                          provinceSubTab === 'ECONOMY'
                            ? 'block'
                            : 'hidden lg:block'
                        }
                      >
                        {selectedTerritory.isAssimilating ? (
                          <div className="w-full p-3 rounded-xl bg-orange-950/40 border border-orange-500/50 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-orange-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                                Asimilasyon & Core Entegrasyonu Devam Ediyor
                              </span>
                              <span className="font-mono-num text-amber-300">
                                %{Math.round(selectedTerritory.assimilation ?? 30)} (
                                {Math.max(
                                  1,
                                  Math.ceil(
                                    (100 - (selectedTerritory.assimilation ?? 30)) /
                                      1.25
                                  )
                                )}{' '}
                                Gün Kaldı)
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(
                                    5,
                                    selectedTerritory.assimilation ?? 30
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Günlük +%1.25 entegrasyon ilerlemesi sağlanıyor. %100 olunca eyalet Öz Vatan olacak ve isyan riski sıfırlanacak.
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              onAssimilateTerritory(selectedTerritory.id)
                            }
                            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-200 text-xs font-bold flex items-center justify-between transition-colors shadow-sm"
                          >
                            <span className="text-left">
                              {selectedTerritory.coreOwnerId !== playerNation.id
                                ? '🤝 Eyaleti Asimile Et (Öz Vatan / Core Yap)'
                                : '🛡️ Bölgesel Asayiş ve Entegrasyon Paketi'}
                            </span>
                            <span className="font-mono-num text-orange-300 shrink-0 ml-2">
                              180 Altın · ~60 Gün
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* Dini Tebliğ ve Misyoner Gönderimi (AoH3 Din Sistemi) */}
                  {isSelectedPlayerOwned &&
                    (isDifferentReligion || selectedTerritory.missionary) && (
                      <div
                        className={
                          provinceSubTab === 'ECONOMY'
                            ? 'block'
                            : 'hidden lg:block'
                        }
                      >
                        {selectedTerritory.missionary ? (
                          <div className="w-full p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-200">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                ☪ Dini Tebliğ & İrşad Faaliyeti Sürüyor
                              </span>
                              <span className="font-mono-num text-emerald-300">
                                %{Math.round(
                                  (selectedTerritory.missionary.progressDays /
                                    selectedTerritory.missionary.totalDays) *
                                    100
                                )}{' '}
                                ({selectedTerritory.missionary.totalDays -
                                  selectedTerritory.missionary.progressDays}{' '}
                                Gün Kaldı)
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
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
                            <p className="text-[10px] text-slate-400">
                              Ulema ve tebliğ heyeti ahalinin{' '}
                              <strong className="text-emerald-300">
                                {RELIGIONS[selectedTerritory.missionary.targetReligion]?.name}
                              </strong>{' '}
                              inancına geçişini sağlıyor. Tamamlandığında isyan riski ve huzursuzluk kalıcı olarak düşecek.
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              onStartMissionary &&
                              onStartMissionary(selectedTerritory.id)
                            }
                            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-between transition-colors shadow-sm"
                          >
                            <span className="text-left flex items-center gap-1.5">
                              <span>☪</span>
                              <span>
                                Tebliğ Heyeti Gönder (
                                {RELIGIONS[playerStateRel]?.name || 'Devlet Dini'}
                                )
                              </span>
                            </span>
                            <span className="font-mono-num text-emerald-300 shrink-0 ml-2">
                              120 Altın · 60 Gün
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                  {/* Player Owned: Tech-Synced Unit Recruitment & Army Movement */}
                  {isSelectedPlayerOwned && (
                    <div
                      className={`pt-2 space-y-3 border-t border-slate-800 ${
                        provinceSubTab === 'ARMY' ? 'block' : 'hidden lg:block'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          Seferberlik ({activeArmyGen.generationLabel}: {activeArmyGen.eraTitle})
                        </span>
                        {hasPendingArmyUpgrade && (
                          <button
                            onClick={onModernizeNationalArmy}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold animate-pulse"
                          >
                            ⚡ Orduyu Güncelle ({modernizationCost}G)
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() =>
                            onRecruitUnit(
                              selectedTerritory.id,
                              'infantry',
                              5000,
                              250
                            )
                          }
                          className="min-h-[68px] p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-colors"
                        >
                          <UnitTypeIllustrationSvg
                            unitType="infantry"
                            modeId={gameMode}
                            className="w-8 h-8"
                          />
                          <span>+5B {activeArmyGen.infantryShort}</span>
                          <span className="font-mono-num text-[10px] text-emerald-400/90">
                            250 Altın
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            onRecruitUnit(
                              selectedTerritory.id,
                              'armor',
                              2500,
                              420
                            )
                          }
                          className="min-h-[68px] p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-colors"
                        >
                          <UnitTypeIllustrationSvg
                            unitType="armor"
                            modeId={gameMode}
                            className="w-8 h-8"
                          />
                          <span>+2.5B {activeArmyGen.armorShort}</span>
                          <span className="font-mono-num text-[10px] text-amber-400">
                            420 Altın
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            onRecruitUnit(
                              selectedTerritory.id,
                              'airDrone',
                              1000,
                              500
                            )
                          }
                          className="min-h-[68px] p-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-colors"
                        >
                          <UnitTypeIllustrationSvg
                            unitType="airDrone"
                            modeId={gameMode}
                            className="w-8 h-8"
                          />
                          <span>+1B {activeArmyGen.airArtilleryShort}</span>
                          <span className="font-mono-num text-[10px] text-sky-400">
                            500 Altın
                          </span>
                        </button>
                      </div>

                      {/* Army Dispatch Controls */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-slate-300 font-medium">
                            Gönderilecek: <strong>%{Math.round(moveRatio * 100)}</strong> (
                            {Math.round(
                              Math.max(0, selectedTerritory.garrison - 500) * moveRatio
                            ).toLocaleString('tr-TR')}{' '}
                            Asker)
                          </span>
                          <div className="flex gap-1">
                            {[0.25, 0.5, 0.75, 1].map((r) => (
                              <button
                                key={r}
                                onClick={() => onSetMoveRatio(r)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono-num ${
                                  moveRatio === r
                                    ? 'bg-amber-500 text-slate-950 font-bold'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                %{r * 100}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Kaynak eyalette en az 500 asker savunmada kalır.
                        </p>

                        <button
                          onClick={() => {
                            sound.playClick();
                            onStartArmyOrderMode(selectedTerritory.id);
                            onClose();
                          }}
                          className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <Swords className="w-4 h-4" />
                          <span>🧭 Haritadan Hedef Seç & Hareket Et (Doğrudan Rota)</span>
                        </button>

                        {/* Quick Neighbor Target Buttons */}
                        <div className="pt-1">
                          <div className="text-[11px] text-slate-400 mb-1.5">
                            Komşu Bölgelere Hızlı Hareket Emri:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
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
                                  key={nId}
                                  onClick={() =>
                                    onExecuteArmyMove(selectedTerritory.id, nId)
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                                    isOwn
                                      ? 'bg-sky-950/60 border-sky-500/40 text-sky-200 hover:bg-sky-900/60'
                                      : atWar
                                      ? 'bg-rose-950/70 border-rose-500/50 text-rose-200 hover:bg-rose-900/70'
                                      : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                                  }`}
                                >
                                  <span>{nTerr.name}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              );
                            })}
                          </div>
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
                    <ProvinceBuildingsPanel
                      playerNation={playerNation}
                      selectedTerritory={selectedTerritory}
                      isVisibleOnMobile={provinceSubTab === 'ECONOMY'}
                      onUpgradeBuilding={onUpgradeBuilding}
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
                    onPeaceDeal={onPeaceDeal}
                    onSelectTerritory={onSelectTerritory}
                    onInspectNation={onInspectNation}
                    onSiegeBombardment={onSiegeBombardment}
                    onClose={onClose}
                  />
                )}
              </div>
            </div>
  );
};
