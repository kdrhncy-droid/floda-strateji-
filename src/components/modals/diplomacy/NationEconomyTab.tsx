import React from 'react';
import { BookOpen, Coins, TrendingUp, Trophy } from 'lucide-react';
import { Nation } from '../../../types/game';
import { computeNationTechMetrics } from '../../../data/world2026Data';
import {
  calculateNationEconomy,
  computeNationEconomySummary,
} from '../../../engine/simulationEngine';
import { useLongPress } from '../../common/EconomySourcesPopover';
import { NationFlagCanvasBadge } from '../../../map/nationFlagRenderer';
import { sound } from '../../../utils/soundEngine';
import { cleanNationName, formatTroopsShort } from '../../../utils/formatters';
import { NationPowerRankingEntry } from '../../../engine/worldRankings';
import { AoH3GlyphSvg } from '../../illustrations/AoH3Illustrations';

export interface NationEconomyTabProps {
  inspectedNation: Nation;
  isPlayerNation: boolean;
  econ: ReturnType<typeof calculateNationEconomy>;
  economySummary: ReturnType<typeof computeNationEconomySummary>;
  techMetrics: ReturnType<typeof computeNationTechMetrics>;
  monthlyPopGrowthPct: number;
  techCount: number;
  netGoldLabel: string;
  grossDailyIncome: number;
  totalDailyExpense: number;
  worldRank: number;
  worldRankings: NationPowerRankingEntry[];
  economyLongPress: ReturnType<typeof useLongPress>;
  onOpenEconomyPopover: () => void;
  onSelectInspectedNation: (nationId: string) => void;
}

export const NationEconomyTab: React.FC<NationEconomyTabProps> = ({
  inspectedNation,
  isPlayerNation,
  econ,
  economySummary,
  techMetrics,
  monthlyPopGrowthPct,
  techCount,
  netGoldLabel,
  grossDailyIncome,
  totalDailyExpense,
  worldRank,
  worldRankings,
  economyLongPress,
  onOpenEconomyPopover,
  onSelectInspectedNation,
}) => {
  return (
    <div className="space-y-3">
      {/* Player: Full Daily Income/Expense Ledger · Foreign: ONLY Mevcut Ekonomi + Basılı Tut Kaynaklar */}
      {isPlayerNation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 inline-flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Günlük Gelirler</span>
              </span>
              <span className="font-mono-num text-xs font-extrabold text-emerald-300">
                +{grossDailyIncome.toFixed(1)} A/g
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Vergi Geliri', val: econ.taxIncome },
                { label: 'Üretim & Atölye', val: econ.productionIncome },
                { label: 'Ticaret & Anlaşmalar', val: econ.tradeIncome },
                {
                  label: 'Boğaz & Kervan',
                  val: econ.straitTollIncome + econ.caravanTradeIncome,
                },
                {
                  label: 'Vasal & Abluka',
                  val: econ.vassalIncome + econ.seizedBlockadeIncome,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-[#cfc3ae]">{row.label}</span>
                  <span className="font-mono-num font-bold text-emerald-200">
                    +{row.val.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 inline-flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>Günlük Giderler &amp; Denge</span>
              </span>
              <span className="font-mono-num text-xs font-extrabold text-rose-300">
                -{totalDailyExpense.toFixed(1)} A/g
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Ordu Bakımı', val: econ.militaryUpkeep },
                { label: 'Enflasyon Kaybı', val: econ.inflationPenalty },
                { label: 'Ödenen Vasal Haracı', val: econ.vassalTributeOut },
                { label: 'Abluka Kesintisi', val: econ.blockadePenaltyLoss },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-[#cfc3ae]">{row.label}</span>
                  <span className="font-mono-num font-bold text-rose-200">
                    -{row.val.toFixed(1)}
                  </span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-[#2d261e] flex items-center justify-between text-xs font-bold">
                <span className="text-[#f0e6d2]">Günlük Net Kâr</span>
                <span
                  className={`font-mono-num ${
                    econ.netDailyGold >= 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {netGoldLabel} A/gün
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section
          data-testid="foreign-current-economy-card"
          className="rounded-xl bg-[#13110e] border border-[#caa15a]/40 p-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <div className="text-xs font-bold text-[#e0b86e] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span>Mevcut Ekonomi</span>
            </div>
            <div className="font-mono-num text-xl font-extrabold text-[#faf3e3] mt-0.5">
              {economySummary.totalEconomy.toLocaleString('tr-TR')}
            </div>
            <div className="text-[11px] text-[#b2a58f] mt-0.5">
              {economySummary.provinceCount} Eyalet · Ort. Yatırım ×
              {economySummary.avgInvestmentMult.toFixed(2)}
            </div>
          </div>
          <button
            type="button"
            data-testid="foreign-economy-sources-btn"
            onPointerDown={economyLongPress.onPointerDown}
            onPointerUp={economyLongPress.onPointerUp}
            onPointerLeave={economyLongPress.onPointerLeave}
            onPointerCancel={economyLongPress.onPointerCancel}
            onClick={() => {
              if (economyLongPress.consumeLongPressFlag()) return;
              sound.playClick();
              onOpenEconomyPopover();
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#e0b86e]/55 text-xs font-bold text-[#e0b86e] flex flex-col items-end cursor-pointer select-none"
          >
            <span>Ekonomi Kaynaklarını Gör</span>
            <span className="text-[10px] font-normal text-[#c5b79e]">
              (Ekonomi butonuna basılı tutun)
            </span>
          </button>
        </section>
      )}

      {/* Tech, Population Growth & Infrastructure */}
      <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#e0b86e] inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bilim, Büyüme &amp; Altyapı</span>
          </span>
          <span className="text-[11px] font-semibold text-[#e0bc78]">
            {techMetrics.eraLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
            <div className="text-[10px] text-[#b2a58f]">Teknoloji Seviyesi</div>
            <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
              {techMetrics.techLevel} / {techMetrics.maxTechLevel}
            </div>
          </div>
          <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
            <div className="text-[10px] text-[#b2a58f]">Günlük Araştırma</div>
            <div className="font-mono-num text-xs font-bold text-[#f3ead7]">
              +{econ.dailyResearch.toFixed(1)} AP
            </div>
          </div>
          <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
            <div className="text-[10px] text-[#b2a58f]">Nüfus Büyümesi</div>
            <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
              +%{monthlyPopGrowthPct} /ay
            </div>
          </div>
          <div className="rounded-lg bg-[#1e1a15] border border-[#342d24] p-2">
            <div className="text-[10px] text-[#b2a58f]">Başkent Seviyesi</div>
            <div className="font-mono-num text-xs font-bold text-[#e0b86e]">
              Sv. {techMetrics.capitalLevel} · Saray{' '}
              {techMetrics.capitalPalaceLevel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-[#cfc3ae]">
          <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
            <AoH3GlyphSvg
              name="book"
              className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
            />
            <span>Okul:</span>
            <strong className="text-[#f3ead7]">
              {techMetrics.schoolCount}
            </strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
            <AoH3GlyphSvg
              name="crown"
              className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
            />
            <span>Lise:</span>
            <strong className="text-[#f3ead7]">
              {techMetrics.highSchoolCount}
            </strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
            <AoH3GlyphSvg
              name="trophy"
              className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
            />
            <span>Üniversite:</span>
            <strong className="text-[#f3ead7]">
              {techMetrics.universityCount}
            </strong>
          </span>
          <span className="px-2 py-1 rounded-lg bg-[#1a1611] border border-[#2f2820] inline-flex items-center gap-1.5">
            <AoH3GlyphSvg
              name="science"
              className="w-3.5 h-3.5 text-[#e0b86e] shrink-0"
            />
            <span>Açık Teknoloji:</span>
            <strong className="text-[#e0b86e]">{techCount}</strong>
          </span>
        </div>
      </section>

      {/* Top 5 World Powers Comparison */}
      <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#e0b86e]">
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>Dünya Büyük Güçleri (İlk 5)</span>
          </span>
          <span className="font-mono-num text-[11px] text-[#cfc3ae]">
            Seçili: #{worldRank}
          </span>
        </div>

        <div className="space-y-1.5">
          {worldRankings.slice(0, 5).map((item, idx) => {
            const isSelected = item.nation.id === inspectedNation.id;
            return (
              <button
                key={item.nation.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onSelectInspectedNation(item.nation.id);
                }}
                className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#251d14] border-[#e0b86e]/65 text-[#f3ead7]'
                    : 'bg-[#1a1611] hover:bg-[#241e18] border-[#2f2820] text-[#e5dac6]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-num text-xs font-extrabold text-[#e0b86e] w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <NationFlagCanvasBadge
                    nationId={item.nation.id}
                    flagCode={item.nation.flagCode}
                    color={item.nation.color}
                    width={22}
                    height={15}
                  />
                  <span className="text-xs font-bold truncate">
                    {cleanNationName(item.nation.name)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono-num shrink-0">
                  <span className="text-[#cfc3ae]">{item.ownedCount} Ey.</span>
                  <span className="text-[#e0b86e] font-bold">
                    {formatTroopsShort(item.army)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
