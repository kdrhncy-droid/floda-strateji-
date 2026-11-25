import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { CommandDrawersProps } from './drawerTypes';
import { RESOURCE_INFO } from '../../data/world2026Data';
import { calculateProvinceDevelopment } from '../../engine/simulationEngine';
import {
  evaluateActiveStraits,
  TRADE_RAID_INFLUENCE_COST,
  TRADE_RAID_MANPOWER_COST,
} from '../../engine/straitsAndTradeEngine';
import { cleanNationName, cleanProvinceName } from '../../utils/formatters';
import {
  AoH3GlyphName,
  AoH3GlyphSvg,
  AoH3MenuBanner,
  ResourceSvg,
} from '../illustrations/AoH3Illustrations';

type EconomyTab = 'BUDGET' | 'BATCH' | 'CITIES';

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
  onBatchBorderMobilization,
  onSelectTerritory,
  gameMode = 'EMPIRES_1440',
}) => {
  const [activeTab, setActiveTab] = useState<EconomyTab>('BUDGET');
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

  const maxDevScore = Math.max(
    100,
    ownedTerritoryDevRows[0]?.dev.developmentScore ?? 100
  );

  const hasBatchActions = Boolean(
    onBatchAssimilate ||
      onBatchStabilityFestival ||
      onBatchBorderMobilization
  );

  const bannerConfig =
    activeTab === 'BUDGET'
      ? {
          artKey: 'TREASURY' as const,
          branch: 'ECONOMY' as const,
          title: is1440 ? 'Hazine-i Hümâyûn & Maliye' : 'Ulusal Hazine & Bütçe',
          subtitle: `${Math.floor(playerNation.treasury).toLocaleString('tr-TR')} Altın · Net ${
            playerEconomy.netDailyGold >= 0
              ? `+${playerEconomy.netDailyGold}`
              : playerEconomy.netDailyGold
          } A/gün`,
          icon: 'gold' as AoH3GlyphName,
        }
      : activeTab === 'BATCH'
      ? {
          artKey: 'ENGINEERING' as const,
          branch: 'ADMINISTRATION' as const,
          title: 'Tek Tık Toplu Yönetim',
          subtitle: `${ownedTerritories.length} Eyalet · ${nonCorePendingCount} Entegrasyon · ${borderCityCount} Sınır`,
          icon: 'hammer' as AoH3GlyphName,
        }
      : {
          artKey: 'TRADE' as const,
          branch: 'ECONOMY' as const,
          title: is1440 ? 'Boğazlar, Kervanlar & Şehirler' : 'Boğazlar & Küresel Ticaret',
          subtitle: `${tradeDetails.controlledStraits.length} Boğaz · +${playerEconomy.caravanTradeIncome} A/gün Hat`,
          icon: 'anchor' as AoH3GlyphName,
        };

  return (
    <div className="space-y-3">
      {/* AoH3 Illustrated Oil-Painting Header Banner */}
      <AoH3MenuBanner
        artKey={bannerConfig.artKey}
        branch={bannerConfig.branch}
        title={bannerConfig.title}
        subtitle={bannerConfig.subtitle}
        icon={bannerConfig.icon}
        rightSlot={
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#14100c]/85 border border-[#caa15a]/35 font-mono-num text-[11px] text-[#e0b86e]">
            <span>Enflasyon %{playerNation.inflation.toFixed(1)}</span>
          </div>
        }
      />

      {/* AoH3 3-Tab Economy Switcher + Live Treasury Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#caa15a]/25">
        <div
          role="tablist"
          aria-label="Ekonomi ve Hazine Sekmeleri"
          className="grid grid-cols-3 gap-1 bg-[#120e0a] p-1 rounded-xl border border-[#caa15a]/30 w-full sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'BUDGET'}
            data-testid="eco-tab-budget"
            onClick={() => setActiveTab('BUDGET')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'BUDGET'
                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                : 'text-[#d8cbb5] hover:text-[#faf3e3]'
            }`}
          >
            <AoH3GlyphSvg name="gold" className="w-3.5 h-3.5 shrink-0" />
            <span>Bütçe</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'BATCH'}
            data-testid="eco-tab-batch"
            onClick={() => setActiveTab('BATCH')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'BATCH'
                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                : 'text-[#d8cbb5] hover:text-[#faf3e3]'
            }`}
          >
            <AoH3GlyphSvg name="hammer" className="w-3.5 h-3.5 shrink-0" />
            <span>Toplu İşlem</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'CITIES'}
            data-testid="eco-tab-cities"
            onClick={() => setActiveTab('CITIES')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'CITIES'
                ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                : 'text-[#d8cbb5] hover:text-[#faf3e3]'
            }`}
          >
            <AoH3GlyphSvg name="anchor" className="w-3.5 h-3.5 shrink-0" />
            <span>Boğaz &amp; Şehir</span>
          </button>
        </div>

        {/* Inline Treasury Summary */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono-num text-[#c5b79e]">
          <span>
            Hazine:{' '}
            <strong className="text-[#e0b86e]">
              {Math.floor(playerNation.treasury).toLocaleString('tr-TR')} A
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Net:{' '}
            <strong
              className={
                playerEconomy.netDailyGold >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }
            >
              {playerEconomy.netDailyGold >= 0
                ? `+${playerEconomy.netDailyGold}`
                : playerEconomy.netDailyGold}{' '}
              A/gün
            </strong>
          </span>
          <span className="text-[#caa15a]/40">·</span>
          <span>
            Enflasyon{' '}
            <strong className="text-[#f3ead7]">
              %{playerNation.inflation.toFixed(1)}
            </strong>
          </span>
        </div>
      </div>

      {/* TAB 1: BÜTÇE */}
      {activeTab === 'BUDGET' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Income & Expense Breakdown */}
          <div className="lg:col-span-6 bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="scroll" className="w-4 h-4 text-[#e0b86e]" />
              <span>Günlük Hazine Bilançosu</span>
            </h3>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#d8cbb5]">
                  Vergi (%{playerNation.taxRate})
                </span>
                <span className="font-mono-num font-semibold text-emerald-400">
                  +{playerEconomy.taxIncome} A
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#d8cbb5]">Üretim &amp; Kaynak</span>
                <span className="font-mono-num font-semibold text-emerald-400">
                  +{playerEconomy.productionIncome} A
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#d8cbb5]">İç Pazar &amp; Ticaret</span>
                <span className="font-mono-num font-semibold text-emerald-400">
                  +{domesticTrade} A
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#f3ead7] flex items-center gap-1.5">
                  <AoH3GlyphSvg name="anchor" className="w-3.5 h-3.5 text-[#e0b86e]" />
                  <span>Boğaz Gümrükleri</span>
                  {playerEconomy.seizedBlockadeIncome > 0 && (
                    <span className="text-[10px] text-[#e0b86e] font-mono-num">
                      (+{playerEconomy.seizedBlockadeIncome} Abluka)
                    </span>
                  )}
                </span>
                <span className="font-mono-num font-semibold text-[#e0b86e]">
                  +{playerEconomy.straitTollIncome + playerEconomy.seizedBlockadeIncome} A
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#f3ead7] flex items-center gap-1.5">
                  <AoH3GlyphSvg
                    name={is1440 ? 'caravan' : 'anchor'}
                    className="w-3.5 h-3.5 text-[#e0b86e]"
                  />
                  <span>{is1440 ? 'Kervan Geliri' : 'Deniz Lojistiği'}</span>
                  {playerEconomy.blockadePenaltyLoss > 0 && (
                    <span className="text-[10px] font-mono-num text-rose-400">
                      (−{playerEconomy.blockadePenaltyLoss} Abluka)
                    </span>
                  )}
                </span>
                <span className="font-mono-num font-semibold text-[#e0b86e]">
                  +{playerEconomy.caravanTradeIncome} A
                </span>
              </div>
              {playerEconomy.vassalIncome > 0 && (
                <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                  <span className="text-[#d8cbb5]">Vasal Haracı</span>
                  <span className="font-mono-num font-semibold text-emerald-400">
                    +{playerEconomy.vassalIncome} A
                  </span>
                </div>
              )}
              {playerEconomy.vassalTributeOut > 0 && (
                <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                  <span className="text-[#d8cbb5]">Üst Devlet Haracı</span>
                  <span className="font-mono-num font-semibold text-rose-400">
                    -{playerEconomy.vassalTributeOut} A
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#d8cbb5]">
                  Ordu Bakımı ({(playerEconomy.totalGarrison / 1000).toFixed(1)}B)
                </span>
                <span className="font-mono-num font-semibold text-rose-400">
                  -{playerEconomy.militaryUpkeep} A
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#caa15a]/15">
                <span className="text-[#d8cbb5]">
                  Enflasyon (%{playerNation.inflation.toFixed(1)})
                </span>
                <span className="font-mono-num font-semibold text-rose-400">
                  -{playerEconomy.inflationPenalty} A
                </span>
              </div>

              <div className="flex justify-between pt-2 text-sm font-bold">
                <span className="text-[#f3ead7]">Net Bütçe</span>
                <span
                  className={`font-mono-num ${
                    playerEconomy.netDailyGold >= 0
                      ? 'text-[#e0b86e]'
                      : 'text-rose-400'
                  }`}
                >
                  {playerEconomy.netDailyGold >= 0
                    ? `+${playerEconomy.netDailyGold}`
                    : playerEconomy.netDailyGold}{' '}
                  A/gün
                </span>
              </div>
            </div>

            {/* Monetary Actions (Unified Obsidian + Antique Gold) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onCentralBankIntervention}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/45 text-[#f3ead7] text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <AoH3GlyphSvg name="scale" className="w-3.5 h-3.5 text-[#e0b86e]" />
                  <span>{is1440 ? 'Sikke Tashihi' : 'Enflasyon Müdahalesi'}</span>
                </span>
                <span className="text-[10px] font-mono-num text-[#e0b86e]">
                  800 A · -%2.5 Enf · +2 İst
                </span>
              </button>
              <button
                type="button"
                onClick={onIssueWarBonds}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/45 text-[#f3ead7] text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <AoH3GlyphSvg name="gold" className="w-3.5 h-3.5 text-[#e0b86e]" />
                  <span>{is1440 ? 'Sefer Akçesi' : 'Devlet Tahvili'}</span>
                </span>
                <span className="text-[10px] font-mono-num text-[#e0b86e]">
                  +850 A · +%4.5 Enf · -6 İst
                </span>
              </button>
            </div>
          </div>

          {/* Tax & Budget Sliders (Fixed Obsidian + Antique Gold) */}
          <div className="lg:col-span-6 bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-4 space-y-3.5">
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="scale" className="w-4 h-4 text-[#e0b86e]" />
              <span>Vergi &amp; Harcama Oranları</span>
            </h3>

            <div className="p-2.5 rounded-xl bg-[#1b1510] border border-[#caa15a]/30 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#f3ead7] font-semibold">
                  Ulusal Vergi Oranı
                </span>
                <span className="font-mono-num font-bold text-[#e0b86e]">
                  %{playerNation.taxRate}
                </span>
              </div>
              <input
                type="range"
                aria-label="Ulusal Vergi Oranı"
                min={10}
                max={60}
                value={playerNation.taxRate}
                onChange={(e) => onUpdateTaxRate(Number(e.target.value))}
                className="w-full h-6 accent-[#e0b86e] cursor-pointer"
              />
            </div>

            {(
              [
                {
                  key: 'military',
                  label: 'Askerî Harcama',
                  icon: 'sword' as AoH3GlyphName,
                },
                {
                  key: 'economy',
                  label: 'Sanayi Yatırımı',
                  icon: 'hammer' as AoH3GlyphName,
                },
                {
                  key: 'research',
                  label: 'Bilim & Araştırma',
                  icon: 'science' as AoH3GlyphName,
                },
                {
                  key: 'welfare',
                  label: 'Sosyal Refah',
                  icon: 'scale' as AoH3GlyphName,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="p-2.5 rounded-xl bg-[#1b1510] border border-[#caa15a]/25 space-y-1"
              >
                <div className="flex justify-between text-xs">
                  <span className="text-[#d8cbb5] font-semibold flex items-center gap-1.5">
                    <AoH3GlyphSvg
                      name={item.icon}
                      className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                    />
                    <span>{item.label}</span>
                  </span>
                  <span className="font-mono-num font-bold text-[#e0b86e]">
                    %{playerNation.budget[item.key]}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={item.label}
                  min={10}
                  max={80}
                  value={playerNation.budget[item.key]}
                  onChange={(e) =>
                    onUpdateBudget(item.key, Number(e.target.value))
                  }
                  className="w-full h-6 accent-[#e0b86e] cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TOPLU İŞLEM */}
      {activeTab === 'BATCH' && (
        <div
          data-testid="batch-empire-management-card"
          className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#caa15a]/20 pb-2">
            <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
              <AoH3GlyphSvg name="hammer" className="w-4 h-4 text-[#e0b86e] shrink-0" />
              <span>Tek Tık Toplu Yönetim</span>
            </h3>
            <span className="font-mono-num text-xs text-[#e0b86e] font-bold shrink-0">
              {Math.floor(playerNation.treasury).toLocaleString('tr-TR')} Altın
            </span>
          </div>

          {hasBatchActions ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {onBatchAssimilate && (
                <button
                  type="button"
                  data-testid="batch-assimilate-btn"
                  disabled={
                    nonCorePendingCount === 0 || playerNation.treasury < 180
                  }
                  onClick={onBatchAssimilate}
                  className="min-h-[84px] p-3 rounded-xl bg-[#1b1510] hover:bg-[#241c13] border border-[#caa15a]/35 hover:border-[#e0b86e] text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[#f3ead7] flex items-center gap-1.5">
                      <AoH3GlyphSvg name="globe" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                      <span>Toplu Asimilasyon</span>
                    </span>
                    <span className="font-mono-num text-[11px] font-bold text-[#e0b86e] shrink-0">
                      {nonCorePendingCount} Şehir
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-num font-bold text-[#c5b79e]">
                    {nonCorePendingCount > 0
                      ? `180A/Ş (${(nonCorePendingCount * 180).toLocaleString('tr-TR')}A)`
                      : 'Tümü Öz Vatan'}
                  </div>
                </button>
              )}

              {onBatchStabilityFestival && (
                <button
                  type="button"
                  data-testid="batch-festival-btn"
                  disabled={restlessCount === 0 || playerNation.treasury < 140}
                  onClick={onBatchStabilityFestival}
                  className="min-h-[84px] p-3 rounded-xl bg-[#1b1510] hover:bg-[#241c13] border border-[#caa15a]/35 hover:border-[#e0b86e] text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[#f3ead7] flex items-center gap-1.5">
                      <AoH3GlyphSvg name="festival" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                      <span>Toplu Şenlik</span>
                    </span>
                    <span className="font-mono-num text-[11px] font-bold text-[#e0b86e] shrink-0">
                      {restlessCount} Huzursuz
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-num font-bold text-[#c5b79e]">
                    {restlessCount > 0
                      ? `140A/Ş (${(restlessCount * 140).toLocaleString('tr-TR')}A)`
                      : 'Asayiş Yerinde'}
                  </div>
                </button>
              )}

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
                  className="min-h-[84px] p-3 rounded-xl bg-[#1b1510] hover:bg-[#241c13] border border-[#caa15a]/35 hover:border-[#e0b86e] text-left flex flex-col justify-between gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[#f3ead7] flex items-center gap-1.5">
                      <AoH3GlyphSvg name="shield" className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                      <span>Sınır Seferberliği</span>
                    </span>
                    <span className="font-mono-num text-[11px] font-bold text-[#e0b86e] shrink-0">
                      {borderCityCount} Sınır
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-num font-bold text-[#c5b79e]">
                    {borderCityCount > 0
                      ? `${borderMobUnitGold}A + 1B İG / Şehir`
                      : 'Sınır Yok'}
                  </div>
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: BOĞAZ & ŞEHİRLER (AoH3 Table + Unified Gold Progress Bar) */}
      {activeTab === 'CITIES' && (
        <div className="space-y-4">
          {/* AoH3-Style Province Economy & Development Table */}
          <div className="bg-[#14100c] border border-[#caa15a]/40 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#caa15a]/25 flex items-center justify-between gap-2 bg-[#1a140f]">
              <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                <AoH3GlyphSvg name="gold" className="w-4 h-4 text-[#e0b86e] shrink-0" />
                <span>Eyalet Ekonomi &amp; Yatırım Tablosu</span>
              </h3>
              <span className="font-mono-num text-xs text-[#e0b86e] font-bold">
                {ownedTerritoryDevRows.length} Şehir
              </span>
            </div>

            {/* Table Column Header */}
            <div className="grid grid-cols-[minmax(0,1.25fr)_76px_minmax(96px,1fr)_64px] items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a79880] bg-[#100d09] border-b border-[#caa15a]/20">
              <span>Şehir</span>
              <span>Kaynak</span>
              <span>Gelişim</span>
              <span className="text-right">Gelir</span>
            </div>

            {/* Scrollable City Rows */}
            <div className="divide-y divide-[#caa15a]/15 max-h-[260px] overflow-y-auto">
              {ownedTerritoryDevRows.map(({ territory: t, resMeta, dev }) => {
                const fillPct = Math.max(
                  6,
                  Math.min(100, Math.round((dev.developmentScore / maxDevScore) * 100))
                );
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTerritory(t.id)}
                    className="w-full min-h-[44px] px-3 py-2 grid grid-cols-[minmax(0,1.25fr)_76px_minmax(96px,1fr)_64px] items-center gap-2 text-left hover:bg-[#1e1812] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      {t.isCapital && (
                        <AoH3GlyphSvg
                          name="star"
                          className="w-3 h-3 text-[#e0b86e] shrink-0"
                        />
                      )}
                      <span className="text-xs font-bold text-[#f3ead7] truncate">
                        {cleanProvinceName(t.name)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#d8cbb5] truncate">
                      <ResourceSvg
                        resource={t.resource}
                        className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
                      />
                      <span className="truncate">{resMeta.name}</span>
                    </div>

                    <div className="relative h-5 rounded bg-[#0d0a07] border border-[#caa15a]/30 overflow-hidden flex items-center px-1.5">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                      <span className="relative z-10 font-mono-num text-[10px] font-extrabold text-[#faf3e3] drop-shadow">
                        {dev.developmentScore} · ×{dev.totalInvestmentMult}
                      </span>
                    </div>

                    <div className="text-right font-mono-num text-xs font-bold text-[#e0b86e] shrink-0">
                      +{dev.effectiveDailyGdp}A
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategic Straits & Trade Corridors */}
          <div className="bg-[#14100c] border border-[#caa15a]/35 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#caa15a]/20 pb-2.5">
              <h3 className="text-sm font-display font-bold text-[#f3ead7] flex items-center gap-2">
                <AoH3GlyphSvg name="anchor" className="w-4 h-4 text-[#e0b86e] shrink-0" />
                <span>Boğazlar &amp; Ticaret Hatları</span>
              </h3>

              {onRaidEnemyTradeRoutes && (
                <button
                  type="button"
                  disabled={!canRaidTrade}
                  onClick={onRaidEnemyTradeRoutes}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    canRaidTrade
                      ? 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-500/60 text-rose-100'
                      : 'bg-[#120e0a] border-[#caa15a]/20 text-[#6e624f] cursor-not-allowed'
                  }`}
                >
                  <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="flex items-center gap-1">
                    <span>{is1440 ? 'Kervan Akını' : 'Konvoy Vur'}</span>
                    <span>({TRADE_RAID_INFLUENCE_COST}</span>
                    <AoH3GlyphSvg name="fleur" className="w-3 h-3 shrink-0" />
                    <span>· {TRADE_RAID_MANPOWER_COST} İG)</span>
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Straits */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#d8cbb5] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <AoH3GlyphSvg name="anchor" className="w-3.5 h-3.5 text-[#e0b86e]" />
                    <span>Boğaz Gümrükleri</span>
                  </span>
                  <span className="font-mono-num text-[#e0b86e]">
                    {tradeDetails.controlledStraits.length} Hakimiyet
                  </span>
                </div>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {allWorldStraits.map((st) => {
                    const myShare = st.ownerTollShares[playerNation.id] || 0;
                    const domNation = st.dominantOwnerId
                      ? nations[st.dominantOwnerId]
                      : null;
                    const firstShoreId = st.activeShoreIds[0];

                    return (
                      <div
                        key={st.def.id}
                        className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                          myShare > 0
                            ? 'bg-[#211910] border-[#e0b86e]/65'
                            : st.isContestedByWar
                            ? 'bg-rose-950/25 border-rose-500/45'
                            : 'bg-[#1b1510] border-[#caa15a]/25'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#f3ead7] flex items-center gap-1.5 truncate">
                            <AoH3GlyphSvg name="anchor" className="w-3 h-3 text-[#e0b86e] shrink-0" />
                            <span className="truncate">{st.def.name}</span>
                          </div>
                          <div className="text-[11px] font-mono-num text-[#b8a990] truncate">
                            {domNation
                              ? cleanNationName(domNation.name)
                              : 'Paylaşımlı'}{' '}
                            · +{st.totalDailyToll}A/g
                            {myShare > 0 && (
                              <span className="text-emerald-400 font-bold">
                                {' '}
                                (Pay: +{myShare}A)
                              </span>
                            )}
                          </div>
                        </div>

                        {firstShoreId && (
                          <button
                            type="button"
                            onClick={() => onSelectTerritory(firstShoreId)}
                            className="min-h-[38px] px-2.5 py-1 rounded-lg bg-[#241c14] hover:bg-[#31261b] border border-[#caa15a]/35 text-[11px] font-semibold text-[#e0b86e] flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Git</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Corridors */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#d8cbb5] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <AoH3GlyphSvg name="compass" className="w-3.5 h-3.5 text-[#e0b86e]" />
                    <span>{is1440 ? 'Kervan Hatları' : 'Küresel Koridorlar'}</span>
                  </span>
                  <span className="font-mono-num text-[#e0b86e]">
                    +{playerEconomy.caravanTradeIncome} A/gün
                  </span>
                </div>

                {tradeDetails.activeCorridors.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/20 text-xs text-[#b8a990]">
                    Aktif kervan/deniz kavşağı yok.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {tradeDetails.activeCorridors.map((corr) => (
                      <div
                        key={corr.corridorId}
                        className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                          corr.isBlockadedByEnemy
                            ? 'bg-rose-950/25 border-rose-500/50'
                            : 'bg-[#1b1510] border-[#caa15a]/25'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#f3ead7] truncate">
                            {corr.name}
                          </div>
                          <div className="text-[11px] font-mono-num text-[#b8a990]">
                            Kavşak {corr.ownedHubCount}/{corr.totalHubCount} ·{' '}
                            {corr.isBlockadedByEnemy ? (
                              <span className="text-rose-300 font-semibold">
                                Ablukada
                              </span>
                            ) : (
                              <span className="text-emerald-400">Açık</span>
                            )}
                          </div>
                        </div>

                        <div className="font-mono-num font-bold text-[#e0b86e] shrink-0">
                          +{corr.dailyIncome}A/g
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
