import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Flame,
  Handshake,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  ActiveWar,
  AiCommanderStance,
  DiplomaticRelation,
  GameModeId,
  Nation,
} from '../../../types/game';
import { RulerDynastyCard } from '../../common/RulerDynastyCard';
import { computeNationTechMetrics } from '../../../data/world2026Data';
import { NationDiplomacySummary } from '../../../engine/nationDiplomacySummary';
import {
  calculateNationEconomy,
  computeNationEconomySummary,
} from '../../../engine/simulationEngine';
import { useLongPress } from '../../common/EconomySourcesPopover';
import { NationFlagCanvasBadge } from '../../../map/nationFlagRenderer';
import { sound } from '../../../utils/soundEngine';
import { cleanNationName, formatTroopsShort } from '../../../utils/formatters';
import { DiplomaticActionType, PeaceDealType } from '../../drawers/drawerTypes';
import { AoH3GlyphSvg } from '../../illustrations/AoH3Illustrations';

export interface NationOverviewTabProps {
  summary: NationDiplomacySummary;
  isPlayerNation: boolean;
  playerNationId: string;
  nations: Record<string, Nation>;
  wars: ActiveWar[];
  tick: number;
  gameMode: GameModeId;
  econ: ReturnType<typeof calculateNationEconomy>;
  economySummary: ReturnType<typeof computeNationEconomySummary>;
  techMetrics: ReturnType<typeof computeNationTechMetrics>;
  monthlyPopGrowthPct: number;
  capitalName: string;
  techCount: number;
  popLabel: string;
  netGoldLabel: string;
  grossDailyIncome: number;
  totalDailyExpense: number;
  worldRank: number;
  livingNationsCount: number;
  playerRel: DiplomaticRelation | null;
  activePlayerWar: ActiveWar | undefined;
  warBlockReason: string | null;
  vassalAnnexCost: number;
  aiCommanderEnabled: boolean;
  aiCommanderStance: AiCommanderStance;
  isPlayerAtWar: boolean;
  economyLongPress: ReturnType<typeof useLongPress>;
  onToggleAiCommander?: () => void;
  onSetAiCommanderStance?: (stance: AiCommanderStance) => void;
  onSelectInspectedNation: (nationId: string) => void;
  onFocusCapital: () => void;
  onOpenEconomyTab: () => void;
  onOpenDiplomacyTab: () => void;
  onDiplomaticAction: (
    targetNationId: string,
    action: DiplomaticActionType
  ) => void;
  onPeaceDeal: (warId: string, dealType: PeaceDealType) => void;
  onOpenWarModal?: (warId: string) => void;
  onClose: () => void;
}

export const NationOverviewTab: React.FC<NationOverviewTabProps> = ({
  summary,
  isPlayerNation,
  playerNationId,
  nations,
  wars,
  tick,
  gameMode,
  econ,
  economySummary,
  techMetrics,
  monthlyPopGrowthPct,
  capitalName,
  techCount,
  popLabel,
  netGoldLabel,
  grossDailyIncome,
  totalDailyExpense,
  worldRank,
  livingNationsCount,
  playerRel,
  activePlayerWar,
  warBlockReason,
  vassalAnnexCost,
  aiCommanderEnabled,
  aiCommanderStance,
  isPlayerAtWar,
  economyLongPress,
  onToggleAiCommander,
  onSetAiCommanderStance,
  onSelectInspectedNation,
  onFocusCapital,
  onOpenEconomyTab,
  onOpenDiplomacyTab,
  onDiplomaticAction,
  onPeaceDeal,
  onOpenWarModal,
  onClose,
}) => {
  const quickPactGroups = [
    {
      key: 'wars',
      label: 'Savaşta',
      colorClass: 'border-rose-500/45 bg-rose-950/35 text-rose-200',
      entries: summary.activeWars,
    },
    {
      key: 'offensive',
      label: 'Tam İttifak',
      colorClass: 'border-[#caa15a]/50 bg-[#1b1510] text-[#f3ead7]',
      entries: summary.offensiveAllies,
    },
    {
      key: 'defensive',
      label: 'Savunma Paktı',
      colorClass: 'border-[#caa15a]/45 bg-[#1b1510] text-[#f3ead7]',
      entries: summary.defensivePacts,
    },
    {
      key: 'trade',
      label: 'Ticaret',
      colorClass: 'border-[#caa15a]/45 bg-[#1b1510] text-[#e0b86e]',
      entries: summary.tradePartners,
    },
    {
      key: 'nap',
      label: 'Saldırmazlık',
      colorClass: 'border-[#caa15a]/35 bg-[#1b1510] text-[#d8cbb5]',
      entries: summary.nonAggressionPacts,
    },
    {
      key: 'vassals',
      label: 'Vasal',
      colorClass: 'border-[#caa15a]/50 bg-[#1b1510] text-[#e0b86e]',
      entries: summary.vassals,
    },
  ].filter((g) => g.entries.length > 0);

  const stabilityPct = Math.max(
    0,
    Math.min(100, Math.round(summary.nation.stability))
  );
  const stabilityBarColor =
    stabilityPct >= 40
      ? 'bg-gradient-to-r from-[#8f6a34] to-[#e0b86e]'
      : 'bg-rose-500';
  const aePct = Math.max(
    0,
    Math.min(100, Math.round(summary.nation.aggressiveExpansion))
  );
  const techProgressPct = Math.max(
    4,
    Math.min(
      100,
      Math.round((techMetrics.techLevel / techMetrics.maxTechLevel) * 100)
    )
  );

  const aeVal = Math.min(
    100,
    Math.max(0, Math.round(summary.nation.aggressiveExpansion || 0))
  );
  const weVal = Math.min(
    100,
    Math.max(0, Math.round(summary.nation.warExhaustion || 0))
  );
  const coalitionActive =
    aeVal >= 100 ||
    wars.some(
      (w) =>
        w.isCoalitionWar &&
        (w.defenderId === summary.nation.id ||
          w.defenders.includes(summary.nation.id))
    );

  return (
    <>
      {/* Live Reigning Ruler, Skills, Heir & Dynasty Chronicle */}
      <RulerDynastyCard
        nation={summary.nation}
        gameMode={gameMode}
        tick={tick}
        compact
      />

      {/* 8 Visual National Telemetry Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* 1. Hazine & Günlük Net */}
        <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Coins className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Hazine</span>
            </span>
            <span
              className={`font-mono-num font-bold ${
                econ.netDailyGold >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netGoldLabel}/g
            </span>
          </div>
          <div className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none">
            {Math.round(summary.nation.treasury).toLocaleString('tr-TR')}
          </div>
        </div>

        {/* 2. İstikrar & Halk Düzeni */}
        <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Scale className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>İstikrar</span>
            </span>
            <span
              className={`font-mono-num font-bold ${
                aePct >= 50 ? 'text-rose-400' : 'text-[#b2a58f]'
              }`}
              title="Agresif Genişleme"
            >
              AE %{aePct}
            </span>
          </div>
          <div className="space-y-1">
            <div className="font-mono-num text-base font-extrabold text-[#f6ecd7] leading-none">
              %{stabilityPct}
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stabilityBarColor}`}
                style={{ width: `${stabilityPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Ordu & İnsan Gücü */}
        <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Swords className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Ordu</span>
            </span>
            <span className="font-mono-num text-[#d8cbb5] font-semibold">
              +{econ.dailyManpower}/g
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono-num text-base font-extrabold text-[#e0bc78] leading-none">
              {formatTroopsShort(summary.totalArmy)}
            </span>
            <span className="font-mono-num text-[10px] text-[#b2a58f]">
              Rez: {formatTroopsShort(summary.nation.manpower)}
            </span>
          </div>
        </div>

        {/* 4. Nüfus & Büyüme Oranı */}
        <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Users className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Nüfus</span>
            </span>
            <span className="font-mono-num font-bold text-[#e0b86e]">
              +%{monthlyPopGrowthPct}/ay
            </span>
          </div>
          <div className="font-mono-num text-base font-extrabold text-[#f6ecd7] leading-none">
            {popLabel}
          </div>
        </div>

        {/* 5. Teknoloji & Çağ */}
        <div className="rounded-xl bg-[#1e1a15] border border-[#3a3126] p-2.5 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <BookOpen className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Teknoloji</span>
            </span>
            <span className="font-mono-num font-bold text-[#e0b86e]">
              {techCount} Tek
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="font-mono-num text-sm font-extrabold text-[#f6ecd7] leading-none">
                Sv. {techMetrics.techLevel}
              </span>
              <span className="font-mono-num text-[10px] text-[#d8cbb5]">
                +{techMetrics.monthlyTechGrowth}/ay
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8f6a34] to-[#e0b86e] transition-all"
                style={{ width: `${techProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 6. Başkent & Toprak */}
        <button
          type="button"
          onClick={onFocusCapital}
          className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer"
          title="Başkenti haritada göster"
        >
          <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Başkent</span>
            </span>
            <span className="font-mono-num font-bold text-[#e0bc78]">
              {summary.provinceCount} Eyalet
            </span>
          </div>
          <div className="flex items-center justify-between w-full gap-1">
            <span className="text-sm font-bold text-[#f6ecd7] truncate leading-tight">
              {capitalName}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
          </div>
        </button>

        {/* 7. Ekonomi */}
        <button
          type="button"
          data-testid="modal-economy-tile"
          onPointerDown={economyLongPress.onPointerDown}
          onPointerUp={economyLongPress.onPointerUp}
          onPointerLeave={economyLongPress.onPointerLeave}
          onPointerCancel={economyLongPress.onPointerCancel}
          onClick={() => {
            if (economyLongPress.consumeLongPressFlag()) return;
            sound.playClick();
            onOpenEconomyTab();
          }}
          className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer select-none"
          title="Ekonomi kaynakları ve yatırımlar için basılı tutun"
        >
          <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <TrendingUp className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>{isPlayerNation ? 'Ekonomi' : 'Mevcut Ekonomi'}</span>
            </span>
            <span className="font-mono-num text-[#d8cbb5]">
              {isPlayerNation
                ? `Enf %${summary.nation.inflation.toFixed(1)}`
                : 'Basılı tut'}
            </span>
          </div>
          {isPlayerNation ? (
            <div className="flex items-center justify-between w-full gap-1">
              <span className="font-mono-num text-sm font-extrabold text-emerald-300 leading-none">
                +{grossDailyIncome.toFixed(1)}/g
              </span>
              <span className="font-mono-num text-[10px] text-rose-300/90">
                -{totalDailyExpense.toFixed(1)}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between w-full gap-1">
              <span
                data-testid="modal-foreign-economy-value"
                className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none"
              >
                {economySummary.totalEconomy.toLocaleString('tr-TR')}
              </span>
              <span className="text-[9.5px] text-[#9b8e78]">Kaynaklar</span>
            </div>
          )}
        </button>

        {/* 8. Dünya Sıralaması & Prestij */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onOpenEconomyTab();
          }}
          className="rounded-xl bg-[#1e1a15] hover:bg-[#29221a] border border-[#3a3126] hover:border-[#c89d54]/60 p-2.5 flex flex-col justify-between gap-1 text-left transition-colors cursor-pointer"
          title="Dünya Güç Sıralaması"
        >
          <div className="flex items-center justify-between w-full text-[10px] text-[#b2a58f]">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Trophy className="w-3.5 h-3.5 text-[#e0b86e]" />
              <span>Güç Sırası</span>
            </span>
            <span className="inline-flex items-center gap-0.5 text-[#e0b86e] font-mono-num">
              <Sparkles className="w-3 h-3" />
              {techMetrics.prestige}
            </span>
          </div>
          <div className="flex items-baseline justify-between w-full">
            <span className="font-mono-num text-base font-extrabold text-[#e0b86e] leading-none">
              #{worldRank}
            </span>
            <span className="text-[10px] text-[#b2a58f] font-mono-num">
              / {livingNationsCount} Devlet
            </span>
          </div>
        </button>
      </div>

      {/* Koalisyon / Agresiflik & Savaş Yorgunluğu Göstergesi */}
      <section
        data-testid="nation-coalition-status"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <div
          className={`rounded-xl border p-2.5 space-y-1.5 ${
            coalitionActive
              ? 'bg-rose-950/50 border-rose-500/60'
              : aeVal >= 75
              ? 'bg-amber-950/35 border-amber-500/45'
              : 'bg-[#120f0c] border-[#342d24]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-[#e0bc78] inline-flex items-center gap-1">
              <AoH3GlyphSvg name="flag" className="w-3.5 h-3.5 text-rose-400" />
              <span>Koalisyon &amp; Agresiflik</span>
            </span>
            <span
              className={`font-mono-num font-extrabold ${
                coalitionActive
                  ? 'text-rose-300'
                  : aeVal >= 75
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}
            >
              {aeVal} / 100
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#0a0806] border border-[#3a3126] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                coalitionActive
                  ? 'bg-rose-500'
                  : aeVal >= 75
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${aeVal}%` }}
            />
          </div>
          <div className="text-[10px] text-[#b2a58f] leading-snug">
            {coalitionActive
              ? 'DÜNYA KOALİSYONU AKTİF! Agresiflik 100 eşiğine ulaştı.'
              : aeVal >= 75
              ? `Koalisyon tehlikesi yüksek! ${100 - aeVal} puan sonra tüm dünya savaş açar.`
              : "Agresiflik 100'e ulaşırsa bütün dünya koalisyon kurup savaş açar."}
          </div>
        </div>

        <div className="rounded-xl bg-[#120f0c] border border-[#342d24] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-[#e0bc78] inline-flex items-center gap-1">
              <AoH3GlyphSvg name="sword" className="w-3.5 h-3.5 text-amber-400" />
              <span>Savaş Yorgunluğu</span>
            </span>
            <span
              className={`font-mono-num font-extrabold ${
                weVal >= 55
                  ? 'text-rose-300'
                  : weVal >= 25
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}
            >
              %{weVal}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#0a0806] border border-[#3a3126] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                weVal >= 55
                  ? 'bg-rose-500'
                  : weVal >= 25
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${weVal}%` }}
            />
          </div>
          <div className="text-[10px] text-[#b2a58f] leading-snug">
            {weVal > 0
              ? `Vergi/Üretim -%${Math.round(weVal * 0.45)} · Ordu Morali -%${Math.round(
                  weVal * 0.42
                )} · Bakım +%${Math.round(weVal * 0.7)}`
              : 'Ülke dinç ve seferberliğe hazır. Uzun savaşlar ekonomiyi yıpratır.'}
          </div>
        </div>
      </section>

      {/* Active Pacts & Wars Strip */}
      <section className="rounded-xl bg-[#120f0c] border border-[#342d24] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#e0bc78]">
            <Handshake className="w-3.5 h-3.5 text-[#c89d54]" />
            <span>Aktif Paktlar &amp; Savaşlar</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-num font-bold">
            <span className="px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/30 text-rose-300 inline-flex items-center gap-1">
              <AoH3GlyphSvg name="sword" className="w-3 h-3 shrink-0" />
              <span>{summary.activeWars.length}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#e0b86e] inline-flex items-center gap-1">
              <AoH3GlyphSvg name="handshake" className="w-3 h-3 shrink-0" />
              <span>{summary.offensiveAllies.length}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#d8cbb5] inline-flex items-center gap-1">
              <AoH3GlyphSvg name="shield" className="w-3 h-3 text-[#e0b86e] shrink-0" />
              <span>{summary.defensivePacts.length}</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#1b1510] border border-[#caa15a]/35 text-[#e0b86e] inline-flex items-center gap-1">
              <AoH3GlyphSvg name="gold" className="w-3 h-3 shrink-0" />
              <span>{summary.tradePartners.length}</span>
            </span>
          </div>
        </div>

        {quickPactGroups.length === 0 ? (
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#9b8e78] bg-[#1a1611] rounded-lg px-3 py-2 border border-[#2d261e]">
            <span>Henüz aktif savaş, ittifak veya pakt bulunmuyor.</span>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onOpenDiplomacyTab();
              }}
              className="text-[#e0b86e] font-bold hover:underline shrink-0 cursor-pointer"
            >
              İlişkiler →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {quickPactGroups.map((grp) => (
              <div key={grp.key} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#a69881]">
                  {grp.label} ({grp.entries.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {grp.entries.map((entry) => {
                    const entryName = cleanNationName(entry.nation.name);
                    return (
                      <button
                        key={entry.nation.id}
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onSelectInspectedNation(entry.nation.id);
                        }}
                        className={`min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-left transition-colors cursor-pointer ${grp.colorClass}`}
                      >
                        <NationFlagCanvasBadge
                          nationId={entry.nation.id}
                          flagCode={entry.nation.flagCode}
                          color={entry.nation.color}
                          width={22}
                          height={15}
                        />
                        <span className="text-[11px] font-bold max-w-[130px] truncate">
                          {entryName}
                        </span>
                        {grp.key === 'wars' ? (
                          <span className="font-mono-num text-[10px] font-extrabold">
                            {(entry.warScore || 0) > 0
                              ? `+${entry.warScore}`
                              : entry.warScore}
                            %
                          </span>
                        ) : (
                          <span className="font-mono-num text-[10px] opacity-85">
                            {entry.relationScore > 0
                              ? `+${entry.relationScore}`
                              : entry.relationScore}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Player Controls OR Grouped Foreign Diplomatic Actions */}
      {isPlayerNation ? (
        <section className="rounded-xl bg-[#120f0c] border border-[#c89d54]/30 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot
                className={`w-4 h-4 ${
                  aiCommanderEnabled ? 'text-[#e0b86e]' : 'text-[#c89d54]'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-[#f6ecd7]">
                  Otomatik Ordu Komutanı (YZ)
                </div>
                <div className="text-[10px] text-[#9b8e78]">
                  Açıkken ordularınızı otomatik yönetir ve savunur
                </div>
              </div>
            </div>

            {onToggleAiCommander && (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onToggleAiCommander();
                }}
                aria-pressed={aiCommanderEnabled}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  aiCommanderEnabled
                    ? 'border-[#e0b86e] bg-[#251d13] text-[#e0b86e]'
                    : 'border-[#c89d54]/45 bg-[#211d18] hover:bg-[#2b251e] text-[#f0e6d2]'
                }`}
              >
                <span>
                  {aiCommanderEnabled
                    ? isPlayerAtWar
                      ? 'Açık · Durdur'
                      : 'Hazır · Kapat'
                    : 'Komutayı Devret'}
                </span>
              </button>
            )}
          </div>

          {onSetAiCommanderStance && (
            <div className="grid grid-cols-3 gap-1.5 bg-[#1b1611] border border-[#2f2820] rounded-xl p-1">
              {(
                [
                  { id: 'BALANCED', label: 'Dengeli' },
                  { id: 'AGGRESSIVE', label: 'Taarruz' },
                  { id: 'DEFENSIVE', label: 'Savunma' },
                ] as const
              ).map((st) => {
                const active = aiCommanderStance === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      sound.playClick();
                      onSetAiCommanderStance(st.id);
                    }}
                    className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] shadow'
                        : 'text-[#cfc3ae] hover:text-white hover:bg-[#272019]'
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-xl bg-[#120f0c] border border-[#c89d54]/30 p-3 space-y-2.5">
          {warBlockReason && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#1d1710] border border-[#caa15a]/45 text-[11px] text-[#f3ead7]">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                <span className="leading-snug">{warBlockReason}</span>
              </div>
              {playerRel && playerRel.score > -30 && (
                <button
                  type="button"
                  onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600/35 hover:bg-rose-600/55 border border-rose-400/50 text-rose-100 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Flame className="w-3 h-3" />
                  <span>Hakaret (-30)</span>
                </button>
              )}
            </div>
          )}

          {/* Icon + Short Label Diplomatic Actions Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {activePlayerWar ? (
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  if (onOpenWarModal) {
                    onClose();
                    onOpenWarModal(activePlayerWar.id);
                  } else {
                    onPeaceDeal(activePlayerWar.id, 'WHITE_PEACE');
                  }
                }}
                className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d] text-[11px] font-extrabold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span className="leading-tight truncate max-w-full">
                  Barış Masası
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="modal-declare-war-btn"
                onClick={() =>
                  onDiplomaticAction(summary.nation.id, 'DECLARE_WAR')
                }
                className={`min-h-[54px] px-2 py-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                  warBlockReason
                    ? 'bg-rose-950/75 border border-rose-500/40 text-rose-200 hover:bg-rose-900/80'
                    : 'bg-rose-700 hover:bg-rose-600 text-white shadow'
                }`}
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span className="leading-tight truncate max-w-full">
                  Savaş İlanı
                </span>
              </button>
            )}

            <button
              type="button"
              data-testid="modal-improve-relations-btn"
              onClick={() => onDiplomaticAction(summary.nation.id, 'IMPROVE')}
              title="Diplomatik elçi gönder (+3/gün · 10 gün)"
              className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#271f17] border border-[#caa15a]/40 text-[#f3ead7] text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <Handshake className="w-4 h-4 shrink-0 text-[#e0b86e]" />
              <span className="leading-tight truncate max-w-full">+İlişki</span>
              <span className="text-[9px] text-[#e0b86e] font-mono-num">
                +3/g · 10g
              </span>
            </button>

            <button
              type="button"
              data-testid="modal-damage-relations-btn"
              onClick={() => onDiplomaticAction(summary.nation.id, 'DAMAGE')}
              title="İlişki bozma elçisi gönder (-3/gün · 10 gün)"
              className="min-h-[54px] px-2 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/55 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <TrendingDown className="w-4 h-4 shrink-0 text-rose-300" />
              <span className="leading-tight truncate max-w-full">-İlişki</span>
              <span className="text-[9px] text-rose-300 font-mono-num">
                -3/g · 10g
              </span>
            </button>

            <button
              type="button"
              data-testid="modal-insult-btn"
              onClick={() => onDiplomaticAction(summary.nation.id, 'INSULT')}
              title="Diplomatik hakaret (-30 ilişki · +1 prestij · 5 gün soğuma)"
              className="min-h-[54px] px-2 py-1.5 rounded-xl bg-rose-950/45 hover:bg-rose-900/55 border border-rose-500/40 text-rose-200 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <Flame className="w-4 h-4 shrink-0 text-rose-300" />
              <span className="leading-tight truncate max-w-full">
                Hakaret Et
              </span>
              <span className="text-[9px] text-rose-300 font-mono-num">
                {(() => {
                  const lastTick =
                    nations[playerNationId]?.lastInsultTickByNation?.[
                      summary.nation.id
                    ];
                  const rem =
                    lastTick !== undefined
                      ? Math.max(0, 5 - (tick - lastTick))
                      : 0;
                  return rem > 0 ? `${rem}g soğuma` : '-30 · 5g';
                })()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDiplomaticAction(summary.nation.id, 'TRADE')}
              className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                playerRel?.hasTradeAgreement
                  ? 'bg-gradient-to-r from-[#caa15a] to-[#e0b86e] text-[#14100c] border-[#e0b86e]'
                  : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              <Coins
                className={`w-4 h-4 shrink-0 ${
                  playerRel?.hasTradeAgreement ? 'text-[#14100c]' : 'text-[#e0b86e]'
                }`}
              />
              <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                <span>Ticaret</span>
                {playerRel?.hasTradeAgreement && (
                  <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                )}
              </span>
            </button>

            <button
              type="button"
              data-testid="modal-offensive-pact-btn"
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'OFFENSIVE_PACT')
              }
              className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                playerRel?.allianceType === 'OFFENSIVE'
                  ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                  : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              <Swords className="w-4 h-4 shrink-0 text-[#e0b86e]" />
              <span className="leading-tight truncate max-w-full">
                {playerRel?.allianceType === 'OFFENSIVE'
                  ? 'İttifak Feshi'
                  : 'Tam İttifak'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'DEFENSIVE_PACT')
              }
              className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                playerRel?.allianceType === 'DEFENSIVE'
                  ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                  : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0 text-[#e0b86e]" />
              <span className="leading-tight truncate max-w-full">
                {playerRel?.allianceType === 'DEFENSIVE'
                  ? 'Savunma Feshi'
                  : 'Savunma'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'NON_AGGRESSION')
              }
              className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                playerRel?.hasNonAggression
                  ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                  : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              <Timer className="w-4 h-4 shrink-0 text-[#e0b86e]" />
              <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                <span>
                  {playerRel?.hasNonAggression ? 'Saldırmaz' : 'Saldırmazlık'}
                </span>
                {playerRel?.hasNonAggression && (
                  <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'MILITARY_ACCESS')
              }
              className={`min-h-[54px] px-2 py-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${
                playerRel?.hasMilitaryAccess
                  ? 'bg-[#251d14] border-[#e0b86e] text-[#e0b86e]'
                  : 'bg-[#1b1510] hover:bg-[#271f17] border-[#caa15a]/40 text-[#f3ead7]'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0 text-[#e0b86e]" />
              <span className="leading-tight truncate max-w-full inline-flex items-center gap-0.5">
                <span>
                  {playerRel?.hasMilitaryAccess ? 'Geçiş' : 'Askerî Geçiş'}
                </span>
                {playerRel?.hasMilitaryAccess && (
                  <AoH3GlyphSvg name="check" className="w-3 h-3 shrink-0" />
                )}
              </span>
            </button>

            {summary.nation.vassalOf === playerNationId ? (
              <button
                type="button"
                data-testid="modal-annex-vassal-btn"
                onClick={() =>
                  onDiplomaticAction(summary.nation.id, 'ANNEX_VASSAL')
                }
                title="Vasal devleti ilhak et (+20 İlişki gerekir)"
                className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#241c13] hover:bg-[#31261a] border border-[#e0b86e]/60 text-[#e0b86e] text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span className="leading-tight truncate max-w-full">
                  İlhak ({vassalAnnexCost}A)
                </span>
              </button>
            ) : !activePlayerWar ? (
              <button
                type="button"
                data-testid="modal-ultimatum-vassal-btn"
                onClick={() =>
                  onDiplomaticAction(summary.nation.id, 'ULTIMATUM_VASSAL')
                }
                title="20 DP · Vasallık ültimatomu gönder"
                className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#1b1510] hover:bg-[#271f17] border border-[#caa15a]/45 text-[#e0b86e] text-[11px] font-bold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span className="leading-tight truncate max-w-full">
                  Vasallık
                </span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onFocusCapital}
              className="min-h-[54px] px-2 py-1.5 rounded-xl bg-[#211c16] hover:bg-[#2c251d] border border-[#42382b] text-[#f0e6d2] text-[11px] font-semibold flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-[#e0b86e] shrink-0" />
              <span className="leading-tight truncate max-w-full">Harita</span>
            </button>
          </div>

          {/* Covert Espionage Action Strip */}
          <div className="pt-2 border-t border-[#c89d54]/20 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              data-testid={`diplo-spy-fort-${summary.nation.id}`}
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'ESPIONAGE_SABOTAGE_FORT')
              }
              title="Kale Sabotajı (25 DP · 220 Altın)"
              className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#f3ead7] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <AoH3GlyphSvg
                  name="fortress"
                  className="w-3 h-3 text-[#e0b86e] shrink-0"
                />
                <span>Sur Sabotaj</span>
              </span>
              <span className="font-mono-num text-[9.5px] text-[#e0b86e]">
                220A
              </span>
            </button>
            <button
              type="button"
              data-testid={`diplo-spy-revolt-${summary.nation.id}`}
              onClick={() =>
                onDiplomaticAction(summary.nation.id, 'ESPIONAGE_INCITE_REVOLT')
              }
              title="İsyan Kışkırt (30 DP · 260 Altın)"
              className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#f3ead7] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <AoH3GlyphSvg
                  name="revolt"
                  className="w-3 h-3 text-[#e0b86e] shrink-0"
                />
                <span>İsyan Kışkırt</span>
              </span>
              <span className="font-mono-num text-[9.5px] text-[#e0b86e]">
                260A
              </span>
            </button>
            <button
              type="button"
              data-testid={`diplo-spy-siphon-${summary.nation.id}`}
              onClick={() =>
                onDiplomaticAction(
                  summary.nation.id,
                  'ESPIONAGE_SIPHON_TREASURY'
                )
              }
              title="Hazine & Bilim Sızdır (20 DP · 150 Altın)"
              className="min-h-[46px] px-2 py-1.5 rounded-xl bg-[#19130e] hover:bg-[#251c14] border border-[#c89d54]/30 text-[10.5px] font-bold text-[#e0b86e] flex flex-col items-center justify-center gap-0.5 text-center cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <AoH3GlyphSvg
                  name="scroll"
                  className="w-3 h-3 text-[#e0b86e] shrink-0"
                />
                <span>Hazine Sızdır</span>
              </span>
              <span className="font-mono-num text-[9.5px] text-[#e0b86e]">
                150A
              </span>
            </button>
          </div>
        </section>
      )}
    </>
  );
};
