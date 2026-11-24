import React, { useState } from 'react';
import { Anchor, Compass, Layers, Swords, TrendingUp } from 'lucide-react';
import { BuildingType } from '../../types/game';
import { CommandDrawersProps } from './drawerTypes';
import { BUILDINGS, RESOURCE_INFO } from '../../data/world2026Data';
import { calculateProvinceDevelopment } from '../../engine/simulationEngine';
import { isTerritoryCoastal } from '../../engine/worldBuilder';
import {
  evaluateActiveStraits,
  TRADE_RAID_INFLUENCE_COST,
  TRADE_RAID_MANPOWER_COST,
} from '../../engine/straitsAndTradeEngine';

export const EconomyDrawer: React.FC<CommandDrawersProps> = ({
  playerNation,
  playerEconomy,
  territories,
  nations,
  wars,
  onUpdateTaxRate,
  onUpdateBudget,
  onCentralBankIntervention,
  onIssueWarBonds,
  onRaidEnemyTradeRoutes,
  onBatchAssimilate,
  onBatchStabilityFestival,
  onBatchUpgradeBuilding,
  onBatchBorderMobilization,
  onSelectTerritory,
  gameMode = 'EMPIRES_1440',
}) => {
  const [batchBuilding, setBatchBuilding] = useState<BuildingType>('factory');
  const is1440 = gameMode === 'EMPIRES_1440';
  const tradeDetails = playerEconomy.tradeDetails;
  const domesticTrade = Math.max(
    0,
    playerEconomy.tradeIncome -
      playerEconomy.straitTollIncome -
      playerEconomy.caravanTradeIncome -
      playerEconomy.seizedBlockadeIncome
  );
  const allWorldStraits = evaluateActiveStraits(territories, wars);
  const isPlayerInWar = wars.some(
    (w) =>
      w.attackers.includes(playerNation.id) ||
      w.defenders.includes(playerNation.id)
  );
  const canRaidTrade =
    isPlayerInWar &&
    Boolean(onRaidEnemyTradeRoutes) &&
    (playerNation.clanInfluence ?? 120) >= TRADE_RAID_INFLUENCE_COST &&
    playerNation.manpower >= TRADE_RAID_MANPOWER_COST;

  const ownedTerritories = Object.values(territories).filter(
    (t) => t && t.ownerId === playerNation.id
  );

  const nonCorePendingCount = ownedTerritories.filter(
    (t) =>
      !t.isAssimilating &&
      (t.coreOwnerId !== playerNation.id ||
        t.isOccupied ||
        (t.assimilation ?? 100) < 100)
  ).length;
  const restlessCount = ownedTerritories.filter(
    (t) => (t.unrest || 0) >= 10
  ).length;
  const borderCityCount = ownedTerritories.filter((t) =>
    t.neighbors.some((nbId) => {
      const nb = territories[nbId];
      return Boolean(nb && nb.ownerId !== playerNation.id);
    })
  ).length;

  const batchBldDef =
    BUILDINGS.find((b) => b.id === batchBuilding) || BUILDINGS[0];
  const eligibleBatchBuildCities = ownedTerritories.filter((t) => {
    if (batchBldDef.requiresCoastal && !isTerritoryCoastal(t)) return false;
    if ((t.buildings?.[batchBuilding] || 0) >= batchBldDef.maxLevel) return false;
    if ((t.constructionQueue || []).some((q) => q.building === batchBuilding))
      return false;
    return true;
  });
  const totalBatchBuildCost = eligibleBatchBuildCities.reduce((sum, t) => {
    const lvl = t.buildings?.[batchBuilding] || 0;
    return sum + Math.round(batchBldDef.baseCost * Math.pow(1.35, lvl));
  }, 0);
  const borderMobUnitGold = playerNation.enactedReforms.includes(
    'ref_national_defense_industry'
  )
    ? 120
    : 150;

  const ownedTerritoryDevRows = ownedTerritories
    .map((t) => ({
      territory: t,
      resMeta: RESOURCE_INFO[t.resource] || RESOURCE_INFO.TAHIL,
      dev: calculateProvinceDevelopment(t, playerNation),
    }))
    .sort((a, b) => b.dev.developmentScore - a.dev.developmentScore);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Income & Expense Breakdown (6 cols) */}
      <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">
          Günlük Hazine Gelir ve Gider Bilançosu
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">
              Vergi Gelirleri (%{playerNation.taxRate} Oran)
            </span>
            <span className="font-mono-num font-semibold text-emerald-400">
              +{playerEconomy.taxIncome} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">
              Sanayi & Stratejik Kaynak Üretimi
            </span>
            <span className="font-mono-num font-semibold text-emerald-400">
              +{playerEconomy.productionIncome} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">
              İç Pazar & Ticaret Antlaşmaları
            </span>
            <span className="font-mono-num font-semibold text-emerald-400">
              +{domesticTrade} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-amber-200 flex items-center gap-1.5">
              <span>⚓ Stratejik Boğaz Gümrükleri</span>
              {playerEconomy.seizedBlockadeIncome > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                  +{playerEconomy.seizedBlockadeIncome} Abluka
                </span>
              )}
            </span>
            <span className="font-mono-num font-semibold text-amber-300">
              +{playerEconomy.straitTollIncome + playerEconomy.seizedBlockadeIncome} Altın
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 py-1.5 border-b border-slate-800/80">
            <div className="min-w-0">
              <span className="text-sky-200">
                {is1440
                  ? '🐪 İpek & Baharat Kervan Geliri (Net)'
                  : '🚢 Deniz & Lojistik Geliri (Net)'}
              </span>
              {playerEconomy.blockadePenaltyLoss > 0 && (
                <p className="mt-0.5 text-[10px] leading-tight text-rose-300">
                  Abluka kesintisi −{playerEconomy.blockadePenaltyLoss} Altın; net gelire zaten yansıtıldı.
                </p>
              )}
            </div>
            <span className="font-mono-num font-semibold text-sky-300">
              +{playerEconomy.caravanTradeIncome} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">Vasal Devletlerden Haraç Geliri</span>
            <span className="font-mono-num font-semibold text-emerald-400">
              +{playerEconomy.vassalIncome} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">Üst Devlete Haraç Ödemesi</span>
            <span className="font-mono-num font-semibold text-rose-400">
              -{playerEconomy.vassalTributeOut} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">
              Ordu Bakım Gideri (
              {playerEconomy.totalGarrison.toLocaleString('tr-TR')} Asker)
            </span>
            <span className="font-mono-num font-semibold text-rose-400">
              -{playerEconomy.militaryUpkeep} Altın
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-300">
              Enflasyon Erimesi (%{playerNation.inflation.toFixed(1)})
            </span>
            <span className="font-mono-num font-semibold text-rose-400">
              -{playerEconomy.inflationPenalty} Altın
            </span>
          </div>

          <div className="flex justify-between pt-2 text-sm font-bold">
            <span className="text-white">Günlük Net Bütçe Dengesi</span>
            <span
              className={`font-mono-num ${
                playerEconomy.netDailyGold >= 0
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {playerEconomy.netDailyGold >= 0
                ? `+${playerEconomy.netDailyGold}`
                : playerEconomy.netDailyGold}{' '}
              Altın / Gün
            </span>
          </div>
        </div>

        {/* Monetary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={onCentralBankIntervention}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-200 text-xs font-semibold flex flex-col items-center justify-center transition-colors"
          >
            <span>
              {is1440
                ? 'Sikke Tashihi & Narh Fermanı'
                : 'Enflasyonla Mücadele Paketi'}
            </span>
            <span className="text-[10px] text-sky-400">
              800 Altın → -%2.5 Enflasyon & +2 İstikrar
            </span>
          </button>
          <button
            onClick={onIssueWarBonds}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold flex flex-col items-center justify-center transition-colors"
          >
            <span>
              {is1440
                ? 'İltizam & Sefer Akçesi Çıkar'
                : 'Devlet Tahvili İhraç Et'}
            </span>
            <span className="text-[10px] text-amber-400">
              +850 Altın Anında (+%4.5 Enflasyon · -6 İstikrar)
            </span>
          </button>
        </div>
      </div>

      {/* Tax & Budget Sliders (6 cols) */}
      <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-white">
          Vergi Oranı ve Ulusal Bütçe Kaydırıcıları
        </h3>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">
              Ulusal Vergi Oranı (Yüksek vergi istikrarı zorlar)
            </span>
            <span className="font-mono-num font-bold text-amber-400">
              %{playerNation.taxRate}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={60}
            value={playerNation.taxRate}
            onChange={(e) => onUpdateTaxRate(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {(
          [
            {
              key: 'military',
              label: 'Askeri Harcamalar (Ordu Taarruz Gücü)',
              color: 'text-rose-400',
            },
            {
              key: 'economy',
              label: 'Sanayi Teşvikleri (Üretim Çıktısı)',
              color: 'text-emerald-400',
            },
            {
              key: 'research',
              label: 'Bilim & Teknoloji Fonu (Araştırma Hızı)',
              color: 'text-sky-400',
            },
            {
              key: 'welfare',
              label: 'Sosyal Refah (İstikrar & İsyan Önleme)',
              color: 'text-purple-400',
            },
          ] as const
        ).map((item) => (
          <div key={item.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">{item.label}</span>
              <span className={`font-mono-num font-bold ${item.color}`}>
                %{playerNation.budget[item.key]}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={80}
              value={playerNation.budget[item.key]}
              onChange={(e) => onUpdateBudget(item.key, Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        ))}
      </div>

      {/* Stage 3.5: AoH2 DE / AoH3 Batch Empire Management (Toplu İmparatorluk Yönetimi) */}
      {(onBatchAssimilate ||
        onBatchStabilityFestival ||
        onBatchUpgradeBuilding ||
        onBatchBorderMobilization) && (
        <div
          data-testid="batch-empire-management-card"
          className="lg:col-span-12 bg-slate-950/85 border border-sky-500/35 rounded-2xl p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-sky-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Toplu İmparatorluk Yönetimi (Tek Tık Makro İdare)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Büyük imparatorluklarda tek tek şehir gezmeden asimilasyon, şenlik, sınır seferberliği ve kıyı limanı dahil toplu inşaat başlatın.
              </p>
            </div>
            <span className="font-mono-num text-xs text-amber-300 font-bold shrink-0">
              Hazine: {Math.floor(playerNation.treasury).toLocaleString('tr-TR')} Altın
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* 1. Toplu Asimilasyon */}
            {onBatchAssimilate && (
              <button
                type="button"
                data-testid="batch-assimilate-btn"
                disabled={nonCorePendingCount === 0 || playerNation.treasury < 180}
                onClick={onBatchAssimilate}
                className="p-3 rounded-xl bg-slate-900/90 hover:bg-emerald-950/50 border border-slate-800 hover:border-emerald-500/50 text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white">
                      🌍 Toplu Asimilasyon
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono-num text-[10px] font-bold shrink-0">
                      {nonCorePendingCount} Şehir
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                    Yabancı/işgal altındaki şehirleri Öz Vatan sürecine alır (-12 huzursuzluk).
                  </p>
                </div>
                <div className="text-[11px] font-mono-num font-bold text-amber-300">
                  {nonCorePendingCount > 0
                    ? `180G / Şehir (${(nonCorePendingCount * 180).toLocaleString('tr-TR')}G)`
                    : 'Tüm Şehirler Öz Vatan'}
                </div>
              </button>
            )}

            {/* 2. Toplu Şenlik & İstikrar */}
            {onBatchStabilityFestival && (
              <button
                type="button"
                data-testid="batch-festival-btn"
                disabled={restlessCount === 0 || playerNation.treasury < 140}
                onClick={onBatchStabilityFestival}
                className="p-3 rounded-xl bg-slate-900/90 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white">
                      🎉 Toplu Şenlik & Dirlik
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono-num text-[10px] font-bold shrink-0">
                      {restlessCount} Huzursuz
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                    Huzursuz (%10+) şehirlerde -15 isyan riski ve +2 Ulusal İstikrar sağlar.
                  </p>
                </div>
                <div className="text-[11px] font-mono-num font-bold text-amber-300">
                  {restlessCount > 0
                    ? `140G / Şehir (${(restlessCount * 140).toLocaleString('tr-TR')}G)`
                    : 'Asayiş Yerinde'}
                </div>
              </button>
            )}

            {/* 3. Sınır Seferberliği */}
            {onBatchBorderMobilization && (
              <button
                type="button"
                data-testid="batch-border-mob-btn"
                disabled={
                  borderCityCount === 0 ||
                  playerNation.treasury < borderMobUnitGold ||
                  playerNation.manpower < 1000
                }
                onClick={onBatchBorderMobilization}
                className="p-3 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white">
                      🛡️ Sınır Seferberliği
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono-num text-[10px] font-bold shrink-0">
                      {borderCityCount} Sınır
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                    Yabancı komşulu zayıf sınır şehirlerine +1.000 Piyade takviye eder.
                  </p>
                </div>
                <div className="text-[11px] font-mono-num font-bold text-amber-300">
                  {borderCityCount > 0
                    ? `${borderMobUnitGold}G + 1.000 İG / Şehir`
                    : 'Sınır Şehri Yok'}
                </div>
              </button>
            )}

            {/* 4. Toplu Bina / Kıyı Limanı İnşası */}
            {onBatchUpgradeBuilding && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-white">
                      🏗️ Toplu Bina İnşası
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono-num text-[10px] font-bold shrink-0">
                      {eligibleBatchBuildCities.length} Uygun
                    </span>
                  </div>
                  <select
                    aria-label="Toplu inşa edilecek bina türü"
                    data-testid="batch-building-select"
                    value={batchBuilding}
                    onChange={(e) => setBatchBuilding(e.target.value as BuildingType)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-400"
                  >
                    {BUILDINGS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {b.requiresCoastal ? ' (Yalnızca Kıyı)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  data-testid="batch-build-btn"
                  disabled={eligibleBatchBuildCities.length === 0}
                  onClick={() => onBatchUpgradeBuilding(batchBuilding)}
                  className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
                >
                  {eligibleBatchBuildCities.length > 0
                    ? `İnşayı Başlat (${eligibleBatchBuildCities.length}Ş · ${totalBatchBuildCost.toLocaleString('tr-TR')}G)`
                    : batchBldDef.requiresCoastal
                    ? 'Uygun Kıyı Şehri Yok'
                    : 'Uygun Şehir Yok'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 3: Strategic Straits, Blockades & Trade Corridors Command Center (Full 12 cols) */}
      <div className="lg:col-span-12 bg-slate-950/85 border border-amber-500/35 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Anchor className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Stratejik Boğaz Hakimiyeti, Deniz Ablukası ve Ticaret Koridorları
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Boğaz kıyılarını tutan devlet gümrük geliri toplar ve savaşta düşman ordularının deniz geçişini ve ticaretini ablukaya alır. Harita üstünden <strong>Ekonomi</strong> modunu açarak kervan akışını canlı izleyebilirsiniz.
            </p>
          </div>

          {onRaidEnemyTradeRoutes && (
            <button
              disabled={!canRaidTrade}
              onClick={onRaidEnemyTradeRoutes}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center shrink-0 border transition-colors ${
                canRaidTrade
                  ? 'bg-rose-600/25 hover:bg-rose-600/40 border-rose-500/60 text-rose-100 shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {is1440
                    ? '🏴‍☠️ Düşman Kervanlarına Akın Düzenle'
                    : '🏴‍☠️ Düşman Ticaret Konvoyunu Vur'}
                </span>
              </span>
              <span className="text-[10px] font-mono-num opacity-85">
                {isPlayerInWar
                  ? `${TRADE_RAID_INFLUENCE_COST} ⚜ Nüfuz · ${TRADE_RAID_MANPOWER_COST} Asker → +180..680G Ganimet`
                  : 'Sadece aktif savaş sırasında kullanılabilir'}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* World Strategic Straits Radar */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>⚓ Dünya Boğazları ve Gümrük Kontrolü</span>
              <span className="font-mono-num text-amber-300">
                Hakimiyetiniz: {tradeDetails.controlledStraits.length} Boğaz
              </span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {allWorldStraits.map((st) => {
                const myShare = st.ownerTollShares[playerNation.id] || 0;
                const domNation = st.dominantOwnerId
                  ? nations[st.dominantOwnerId]
                  : null;
                const firstShoreId = st.activeShoreIds[0];

                return (
                  <div
                    key={st.def.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 text-xs ${
                      myShare > 0
                        ? 'bg-amber-950/25 border-amber-500/50'
                        : st.isContestedByWar
                        ? 'bg-rose-950/25 border-rose-500/40'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">
                        ⚓ {st.def.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        Hakim:{' '}
                        <strong className="text-slate-200">
                          {domNation
                            ? domNation.name.replace(/\s*\(1440\)\s*$/, '')
                            : 'Paylaşımlı'}
                        </strong>
                        {myShare > 0 && st.hasFullMonopoly && (
                          <span className="text-emerald-400 font-semibold">
                            {' '}
                            · Tam Hakimiyet
                          </span>
                        )}
                        {st.isContestedByWar && (
                          <span className="text-rose-400 font-semibold">
                            {' '}
                            · Ablukada
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono-num mt-0.5 flex items-center gap-2">
                        <span className="text-amber-300">
                          Gümrük: +{st.totalDailyToll}G/gün
                        </span>
                        {myShare > 0 && (
                          <span className="text-emerald-400 font-bold">
                            (Payınız: +{myShare}G)
                          </span>
                        )}
                      </div>
                    </div>

                    {firstShoreId && (
                      <button
                        onClick={() => onSelectTerritory(firstShoreId)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 shrink-0"
                      >
                        Kıyıya Git
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Trade Caravans & Maritime Corridors */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {is1440
                    ? 'Aktif Kervan ve Deniz Ticaret Hatlarınız'
                    : 'Aktif Küresel Ticaret ve Enerji Hatlarınız'}
                </span>
              </span>
              <span className="font-mono-num text-sky-300">
                +{playerEconomy.caravanTradeIncome} Altın/gün
              </span>
            </div>

            {tradeDetails.activeCorridors.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                Henüz büyük küresel kervan/deniz kavşaklarından birine sahip değilsiniz. Önemli liman veya boğaz şehirlerini fethederek küresel ticaret ağından pay alabilirsiniz.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {tradeDetails.activeCorridors.map((corr) => (
                  <div
                    key={corr.corridorId}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      corr.isBlockadedByEnemy
                        ? 'bg-rose-950/25 border-rose-500/50'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {corr.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>
                          Kavşak Kontrolü:{' '}
                          <strong className="font-mono-num text-slate-200">
                            {corr.ownedHubCount}/{corr.totalHubCount}
                          </strong>
                        </span>
                        {corr.isBlockadedByEnemy ? (
                          <span className="text-rose-300 font-semibold">
                            ⚠️ Düşman Boğaz Ablukası Altında!
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            ✓ Açık Güzergâh
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-mono-num font-bold text-sky-300 shrink-0">
                      +{corr.dailyIncome}G/gün
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage 3.1 & 3.2: City Development Scores & Investment-Driven Resource Production Table */}
      <div className="lg:col-span-12 bg-slate-950/85 border border-emerald-500/35 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Şehir Gelişim Puanları ve Yatırım Odaklı Kaynak Üretimi ({ownedTerritoryDevRows.length} Eyalet)
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Her şehrin ham üretim kaynağı vardır (🪵 Odun, 🐄 Sığır, 🌿 Pamuk, 🌾 Tahıl, ⛏ Demir, 🪙 Altın, 🛢 Petrol); ancak <strong>Sanayi, Liman ve Teknoloji yatırımı</strong> yapılan şehirler, yatırımsız kalan zengin madenleri geride bırakır.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[240px] overflow-y-auto pr-1">
          {ownedTerritoryDevRows.map(({ territory: t, resMeta, dev }) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTerritory(t.id)}
              className="text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">
                    {t.isCapital ? '★ ' : ''}
                    {t.name.replace(/^★\s*/, '')}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono-num font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                    ★{dev.developmentScore}P
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/95 truncate mt-0.5 flex items-center gap-1">
                  <span>{resMeta.icon}</span>
                  <span className="truncate">{resMeta.name}</span>
                </div>
                <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
                  Ham {dev.baseResourceValue}A →{' '}
                  <strong className="text-emerald-400">
                    {dev.effectiveResourceValue}A/gün
                  </strong>{' '}
                  (×{dev.totalInvestmentMult})
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono-num font-bold text-amber-300">
                  +{dev.effectiveDailyGdp}
                </div>
                <div className="text-[9px] text-slate-400">Günlük GDP</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
