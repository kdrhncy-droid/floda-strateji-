import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Handshake,
  History,
  Landmark,
  ScrollText,
  Sparkles,
  Swords,
  UserCheck,
} from 'lucide-react';
import { GameModeId, Nation } from '../../types/game';
import {
  DEATH_CAUSE_LABELS,
  RULER_TRAITS,
} from '../../data/historicalDynasties';
import {
  ensureNationRulerState,
  formatRulerFullTitle,
  getGameYearFromTick,
  getRulerAge,
  getRulerModifiers,
} from '../../engine/dynastyAndSuccessionEngine';
import { sound } from '../../utils/soundEngine';
import { getRulerPortraitAsset } from './rulerPortraitArtwork';

export interface RulerDynastyCardProps {
  nation: Nation;
  gameMode: GameModeId;
  tick: number;
  compact?: boolean;
}

export const RulerDynastyCard: React.FC<RulerDynastyCardProps> = ({
  nation,
  gameMode,
  tick,
  compact = false,
}) => {
  const [historyOpen, setHistoryOpen] = useState(false);

  const hydratedNation = ensureNationRulerState(nation, gameMode, tick);
  const ruler = hydratedNation.ruler!;
  const heir = hydratedNation.heir;
  const history = hydratedNation.dynastyHistory || [];
  const currentYear = getGameYearFromTick(tick, gameMode);
  const rulerAge = getRulerAge(ruler, currentYear);
  const reignYears = Math.max(0, currentYear - ruler.reignStartYear);
  const trait = RULER_TRAITS[ruler.traitId] || RULER_TRAITS.CAUTIOUS;
  const mods = getRulerModifiers(hydratedNation);
  const portraitAsset = getRulerPortraitAsset({
    nationId: hydratedNation.id,
    dynastyName: ruler.dynastyName,
    rulerName: ruler.name,
    rulerTitle: ruler.title,
    isElected: ruler.isElected,
    primaryCulture: hydratedNation.primaryCulture,
    stateReligion: hydratedNation.stateReligion,
    ideology: hydratedNation.ideology,
    gameMode,
  });

  const nextElectionYear =
    ruler.isElected && ruler.termLimitYears
      ? Math.max(
          currentYear,
          getGameYearFromTick(
            (ruler.reignStartTick || 0) + ruler.termLimitYears * 365,
            gameMode
          )
        )
      : null;

  const effectChips: string[] = [];
  const taxPct = Math.round(mods.taxMultDelta * 100);
  if (taxPct !== 0) {
    effectChips.push(`${taxPct > 0 ? '+' : ''}%${taxPct} Vergi`);
  }
  const atkPct = Math.round(mods.combatAttackDelta * 100);
  if (atkPct !== 0) {
    effectChips.push(`${atkPct > 0 ? '+' : ''}%${atkPct} Taarruz`);
  }
  const defPct = Math.round(mods.combatDefenseDelta * 100);
  if (defPct !== 0) {
    effectChips.push(`${defPct > 0 ? '+' : ''}%${defPct} Savunma`);
  }
  const siegePct = Math.round(mods.siegeSpeedBonus * 100);
  if (siegePct > 0) {
    effectChips.push(`+%${siegePct} Kuşatma`);
  }
  const tradePct = Math.round(mods.tradeMultDelta * 100);
  if (tradePct > 0) {
    effectChips.push(`+%${tradePct} Ticaret`);
  }
  const resPct = Math.round(mods.researchMultDelta * 100);
  if (resPct > 0) {
    effectChips.push(`+%${resPct} Bilim`);
  }
  if (mods.aeDecayBonus >= 0.01) {
    effectChips.push(`AE Soğuma +${mods.aeDecayBonus.toFixed(2)}/gün`);
  }

  const skillItems = [
    {
      key: 'adm',
      label: 'İdare',
      value: ruler.admin,
      icon: Landmark,
      colorClass: 'text-[#e0b86e]',
    },
    {
      key: 'dip',
      label: 'Diplomasi',
      value: ruler.diplomacy,
      icon: Handshake,
      colorClass: 'text-sky-300',
    },
    {
      key: 'mil',
      label: 'Askerlik',
      value: ruler.military,
      icon: Swords,
      colorClass: 'text-rose-300',
    },
  ];

  return (
    <section
      data-testid="ruler-dynasty-card"
      aria-label="Hükümdar ve hanedan bilgisi"
      className="rounded-xl bg-[#16120e] border border-[#caa15a]/40 shadow-md overflow-hidden"
    >
      {/* Top Ruler Identity Row */}
      <div className={compact ? 'p-2.5 sm:p-3 space-y-2.5' : 'p-3.5 space-y-3'}>
        <div
          className={
            compact
              ? 'flex flex-col gap-2.5'
              : 'flex flex-col sm:flex-row sm:items-start justify-between gap-3'
          }
        >
          <div className="flex items-start gap-3 min-w-0">
            {portraitAsset && (
              <div
                data-testid="ruler-portrait-frame"
                className={`relative shrink-0 overflow-hidden rounded-lg border border-[#caa15a]/70 bg-[#120e0a] shadow-[0_8px_22px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-[#f3ead7]/15 ${
                  compact
                    ? 'w-[62px] h-[82px] sm:w-[68px] sm:h-[90px]'
                    : 'w-[72px] h-[96px] sm:w-[80px] sm:h-[106px]'
                }`}
              >
                <img
                  src={portraitAsset.src}
                  alt={`${formatRulerFullTitle(ruler)} portresi`}
                  loading="eager"
                  decoding="sync"
                  referrerPolicy="no-referrer"
                  style={{ objectPosition: portraitAsset.objectPosition }}
                  className={`w-full h-full object-cover ${
                    portraitAsset.imageClassName || ''
                  }`}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120e0a]/65 via-transparent to-black/15" />
                <div className="pointer-events-none absolute inset-0 rounded-lg border border-[#f5d89a]/20" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#241c13] border border-[#caa15a]/45 text-[10.5px] font-bold text-[#e0b86e]">
                  <Crown className="w-3 h-3 shrink-0" />
                  <span>
                    {ruler.isElected ? 'Seçilmiş Lider' : ruler.dynastyName}
                  </span>
                </span>
                <span className="text-[10.5px] font-mono-num text-[#cfc3ae]">
                  {rulerAge} yaş ·{' '}
                  {reignYears === 0
                    ? `${ruler.reignStartYear} başlangıç`
                    : `${reignYears} yıldır görevde (${ruler.reignStartYear})`}
                </span>
                {nextElectionYear !== null && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-400/35 text-[10px] font-mono-num text-sky-200 font-semibold">
                    Seçim: {nextElectionYear}
                  </span>
                )}
              </div>

              <h3
                data-testid="ruler-full-name"
                className="mt-1 font-display font-extrabold text-sm sm:text-base text-[#faf3e3] leading-snug"
              >
                {formatRulerFullTitle(ruler)}
              </h3>

              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#201911] border border-[#caa15a]/35 text-[10.5px] font-bold text-[#e7c786]"
                  title={trait.description}
                >
                  <Sparkles className="w-3 h-3 text-[#caa15a] shrink-0" />
                  <span>{trait.name}</span>
                </span>
                {effectChips.slice(0, 4).map((chip) => (
                  <span
                    key={chip}
                    className="px-1.5 py-0.5 rounded bg-[#1d1711] border border-[#42382b] text-[10px] font-mono-num font-semibold text-[#dfd2bc]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Core Skills (1-6) */}
          <div
            className={`grid grid-cols-3 gap-1.5 ${
              compact ? 'w-full' : 'shrink-0 sm:min-w-[204px]'
            }`}
          >
            {skillItems.map((sk) => {
              const Icon = sk.icon;
              return (
                <div
                  key={sk.key}
                  className="rounded-lg bg-[#1d1711] border border-[#caa15a]/25 px-2 py-1.5 text-center"
                >
                  <div className="flex items-center justify-center gap-1 text-[9.5px] text-[#b8a990] font-semibold">
                    <Icon className={`w-3 h-3 ${sk.colorClass}`} />
                    <span>{sk.label}</span>
                  </div>
                  <div className="font-mono-num text-xs sm:text-sm font-black text-[#faf3e3] mt-0.5">
                    {sk.value}
                    <span className="text-[10px] font-normal text-[#8e806b]">
                      /6
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heir / Next Candidate Strip */}
        {heir && (
          <div
            data-testid="ruler-heir-strip"
            className="rounded-lg bg-[#1b1510] border border-[#3d3326] px-2.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-[#caa15a] shrink-0" />
              <div className="min-w-0 text-[11px] text-[#d8cbb5] truncate">
                <span className="text-[#a5967e] font-semibold">
                  {ruler.isElected ? 'Öne Çıkan Aday: ' : 'Veliaht: '}
                </span>
                <span className="font-bold text-[#f3ead7]">
                  {formatRulerFullTitle(heir)}
                </span>{' '}
                <span className="font-mono-num text-[10.5px] text-[#b8a990]">
                  ({getRulerAge(heir, currentYear)} yaş)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono-num text-[#cfc3ae] shrink-0">
              <span>İdr {heir.admin}</span>
              <span className="text-[#5a4e3d]">·</span>
              <span>Dip {heir.diplomacy}</span>
              <span className="text-[#5a4e3d]">·</span>
              <span>Ask {heir.military}</span>
              <span className="text-[#5a4e3d]">·</span>
              <span className="text-[#e0b86e] font-semibold">
                {RULER_TRAITS[heir.traitId]?.name || 'Tedbirli'}
              </span>
            </div>
          </div>
        )}

        {/* Expandable Dynasty Chronicle / Past Rulers */}
        <div className="border-t border-[#2f271e] pt-2">
          <button
            type="button"
            data-testid="toggle-dynasty-history"
            aria-expanded={historyOpen}
            onClick={() => {
              sound.playClick();
              setHistoryOpen((prev) => !prev);
            }}
            className="w-full flex items-center justify-between gap-2 text-[11px] font-bold text-[#cfc3ae] hover:text-[#e0b86e] transition-colors cursor-pointer py-0.5"
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#caa15a]" />
              <span>
                {ruler.isElected
                  ? `Önceki Liderler (${history.length})`
                  : `Hanedan Şeceresi & Saltanat Tarihi (${history.length})`}
              </span>
            </span>
            {historyOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#caa15a]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#a5967e]" />
            )}
          </button>

          {historyOpen && (
            <div
              data-testid="dynasty-history-list"
              className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1"
            >
              {history.length === 0 ? (
                <div className="text-[11px] text-[#9b8e78] italic flex items-center gap-1.5 py-1">
                  <ScrollText className="w-3.5 h-3.5 shrink-0 text-[#7d705c]" />
                  <span>
                    Henüz kaydedilmiş önceki hükümdar yok. Taht değişimleri
                    burada kronolojik olarak saklanır.
                  </span>
                </div>
              ) : (
                history.map((past, idx) => {
                  const causeMeta = DEATH_CAUSE_LABELS[past.cause];
                  return (
                    <div
                      key={`${past.name}_${past.reignEndYear}_${idx}`}
                      className="rounded-lg bg-[#1b1510] border border-[#352c21] px-2.5 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px]"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[#f3ead7]">
                          {formatRulerFullTitle(past)}
                        </span>{' '}
                        <span className="font-mono-num text-[#b8a990]">
                          ({past.reignStartYear}–{past.reignEndYear} ·{' '}
                          {past.ageAtEnd} yaş)
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#e0b86e] shrink-0">
                        {causeMeta?.label || 'Vefat'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
