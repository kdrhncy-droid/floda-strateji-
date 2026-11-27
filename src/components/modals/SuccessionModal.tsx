import React from 'react';
import {
  CheckCircle2,
  Crown,
  Handshake,
  Landmark,
  ScrollText,
  Sparkles,
  Swords,
  UserCheck,
} from 'lucide-react';
import {
  GameModeId,
  Nation,
  SuccessionChoiceOption,
  SuccessionEvent,
} from '../../types/game';
import {
  DEATH_CAUSE_LABELS,
  RULER_TRAITS,
} from '../../data/historicalDynasties';
import {
  formatRulerFullTitle,
  getRulerAge,
} from '../../engine/dynastyAndSuccessionEngine';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { getTechArtwork } from '../drawers/techArtwork';
import { getRulerPortraitAsset } from '../common/rulerPortraitArtwork';
import { sound } from '../../utils/soundEngine';

export interface SuccessionModalProps {
  activeSuccession: SuccessionEvent | null;
  playerNation?: Nation | null;
  playerTreasury: number;
  gameMode: GameModeId;
  onResolveChoice: (option: SuccessionChoiceOption) => void;
}

export const SuccessionModal: React.FC<SuccessionModalProps> = ({
  activeSuccession,
  playerNation,
  playerTreasury,
  gameMode,
  onResolveChoice,
}) => {
  const dialogRef = useAccessibleDialog(
    Boolean(activeSuccession),
    () => undefined,
    { closeOnEscape: false }
  );

  if (!activeSuccession) return null;

  const artworkAsset = getTechArtwork('COURT', 'ADMINISTRATION');
  const incoming = activeSuccession.incomingRuler;
  const previous = activeSuccession.previousRuler;
  const trait = RULER_TRAITS[incoming.traitId] || RULER_TRAITS.CAUTIOUS;
  const causeMeta = DEATH_CAUSE_LABELS[previous.cause];
  const incomingAge = getRulerAge(incoming, activeSuccession.eventYear);
  const portraitAsset = getRulerPortraitAsset({
    nationId: activeSuccession.nationId,
    dynastyName: incoming.dynastyName,
    rulerName: incoming.name,
    rulerTitle: incoming.title,
    isElected: incoming.isElected,
    primaryCulture: playerNation?.primaryCulture,
    stateReligion: playerNation?.stateReligion,
    ideology: playerNation?.ideology,
    gameMode,
  });

  return (
    <div
      data-testid="succession-modal-backdrop"
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/82 backdrop-blur-sm p-3 sm:p-4 overscroll-contain"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="succession-modal-title"
        aria-describedby="succession-modal-desc"
        tabIndex={-1}
        data-testid="succession-modal"
        className="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] rounded-2xl bg-[#14100c] border-2 border-[#caa15a]/70 shadow-[0_24px_75px_rgba(0,0,0,0.92)] text-[#f3ead7] overflow-hidden flex flex-col"
      >
        {/* Oil-Painting Banner */}
        <div
          className="relative w-full shrink-0 overflow-hidden border-b border-[#caa15a]/40 min-h-[6rem] sm:min-h-[8.5rem] [@media(max-height:500px)]:min-h-[4.75rem] flex flex-col justify-between gap-2.5 p-3 sm:p-4"
          style={{ background: artworkAsset.fallbackGradient }}
        >
          <img
            src={artworkAsset.src}
            alt={activeSuccession.headline}
            loading="eager"
            decoding="sync"
            referrerPolicy="no-referrer"
            style={{ objectPosition: artworkAsset.objectPosition }}
            className="absolute inset-0 w-full h-full object-cover brightness-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14100c] via-[#14100c]/55 to-black/35" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14100c]/90 border border-[#caa15a]/55 text-[11px] font-bold text-[#e0b86e]">
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>
                {activeSuccession.isElection
                  ? 'Genel Seçim & Görev Devri'
                  : gameMode === 'EMPIRES_1440'
                  ? 'Cülus-ı Hümâyûn · Taht Değişimi'
                  : 'Liderlik Değişimi'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-black/70 border border-[#caa15a]/35 font-mono-num text-[10.5px] font-semibold text-[#e7c786]">
              {activeSuccession.eventYear} · {causeMeta.label}
            </span>
          </div>

          <h2
            id="succession-modal-title"
            className="relative z-10 font-display text-base sm:text-lg font-extrabold text-[#faf3e3] leading-snug drop-shadow"
          >
            {activeSuccession.headline}
          </h2>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto overscroll-contain space-y-3.5">
          <p
            id="succession-modal-desc"
            className="text-xs sm:text-sm text-[#d8cbb5] leading-relaxed"
          >
            {activeSuccession.description}
          </p>

          {/* Incoming Ruler Spotlight Card */}
          <div className="rounded-xl bg-[#1b1510] border border-[#caa15a]/40 p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {portraitAsset && (
                  <div className="relative w-[60px] h-[80px] sm:w-[68px] sm:h-[90px] shrink-0 overflow-hidden rounded-lg border border-[#caa15a]/70 bg-[#120e0a] shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
                    <img
                      src={portraitAsset.src}
                      alt={`${formatRulerFullTitle(incoming)} portresi`}
                      loading="eager"
                      decoding="sync"
                      referrerPolicy="no-referrer"
                      style={{ objectPosition: portraitAsset.objectPosition }}
                      className={`w-full h-full object-cover ${
                        portraitAsset.imageClassName || ''
                      }`}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120e0a]/60 via-transparent to-black/15" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#caa15a]">
                    {activeSuccession.isElection
                      ? 'Yeni Lider Adayı'
                      : 'Tahta Çıkan Hükümdar'}
                  </div>
                  <div className="font-display text-base font-extrabold text-[#faf3e3] mt-0.5 leading-snug">
                    {formatRulerFullTitle(incoming)}{' '}
                    <span className="font-mono-num text-xs font-semibold text-[#cfc3ae] whitespace-nowrap">
                      ({incomingAge} yaş)
                    </span>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[#e0b86e] font-semibold">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {trait.name} — {trait.shortEffect}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 shrink-0">
                <div className="rounded-lg bg-[#14100c] border border-[#caa15a]/25 px-2.5 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[9.5px] text-[#b8a990]">
                    <Landmark className="w-3 h-3 text-[#e0b86e]" />
                    <span>İdare</span>
                  </div>
                  <div className="font-mono-num text-sm font-black text-[#faf3e3]">
                    {incoming.admin}/6
                  </div>
                </div>
                <div className="rounded-lg bg-[#14100c] border border-[#caa15a]/25 px-2.5 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[9.5px] text-[#b8a990]">
                    <Handshake className="w-3 h-3 text-sky-300" />
                    <span>Dip</span>
                  </div>
                  <div className="font-mono-num text-sm font-black text-[#faf3e3]">
                    {incoming.diplomacy}/6
                  </div>
                </div>
                <div className="rounded-lg bg-[#14100c] border border-[#caa15a]/25 px-2.5 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[9.5px] text-[#b8a990]">
                    <Swords className="w-3 h-3 text-rose-300" />
                    <span>Ask</span>
                  </div>
                  <div className="font-mono-num text-sm font-black text-[#faf3e3]">
                    {incoming.military}/6
                  </div>
                </div>
              </div>
            </div>

            {activeSuccession.nextHeir && (
              <div className="pt-2 border-t border-[#2f271e] flex items-center justify-between gap-2 text-[11px] text-[#cfc3ae]">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-[#caa15a] shrink-0" />
                  <span>
                    Yeni {activeSuccession.isElection ? 'Aday' : 'Veliaht'}:{' '}
                    <strong className="text-[#f3ead7]">
                      {formatRulerFullTitle(activeSuccession.nextHeir)}
                    </strong>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] text-[#9b8e78] shrink-0">
                  <ScrollText className="w-3 h-3" />
                  <span>
                    {previous.reignStartYear}–{previous.reignEndYear}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Decision Options */}
          <div className="space-y-2">
            {activeSuccession.options.map((opt) => {
              const cannotAfford =
                opt.goldCost > 0 && playerTreasury < opt.goldCost;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={cannotAfford}
                  data-testid={`succession-option-${opt.id}`}
                  onClick={() => {
                    sound.playTreaty();
                    onResolveChoice(opt);
                  }}
                  className={`w-full min-h-[54px] text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    cannotAfford
                      ? 'bg-[#17130f]/60 border-[#342c22] opacity-55 cursor-not-allowed'
                      : 'bg-[#1b1510] hover:bg-[#261d14] border-[#caa15a]/40 hover:border-[#e0b86e] group cursor-pointer'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-[#faf3e3] group-hover:text-[#e0b86e] transition-colors">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[#b8a990] mt-0.5">
                      {opt.subtitle}
                    </div>
                    <div
                      className={`font-mono-num text-[11px] font-semibold mt-1 ${
                        opt.stabilityDelta >= 0
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {opt.effectSummary}
                      {cannotAfford ? ' (Yetersiz Hazine)' : ''}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#9b8e78] group-hover:text-[#e0b86e] shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
