import React from 'react';
import {
  CheckCircle2,
  Handshake,
  ScrollText,
  ShieldAlert,
  Swords,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CrisisEventDefinition,
  CrisisEventOption,
  GameModeId,
  TechArtKey,
  TechBranch,
  WorldNewsEvent,
} from '../types/game';
import { sound } from '../utils/soundEngine';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { getTechArtwork } from './drawers/techArtwork';
import { AoH3GlyphSvg } from './illustrations/AoH3Illustrations';

interface CrisisAndNewsModalProps {
  activeCrisis: CrisisEventDefinition | null;
  onResolveCrisis: (option: CrisisEventOption) => void;
  showNewsDrawer: boolean;
  onCloseNewsDrawer: () => void;
  newsEvents: WorldNewsEvent[];
  gameMode?: GameModeId;
}

function getCrisisArtworkSpec(category: CrisisEventDefinition['category']): {
  artKey: TechArtKey;
  branch: TechBranch;
  categoryLabel: string;
} {
  switch (category) {
    case 'ASKERI':
      return {
        artKey: 'INFANTRY',
        branch: 'MILITARY',
        categoryLabel: 'Askerî Sefer & Ocak',
      };
    case 'EKONOMI':
      return {
        artKey: 'TREASURY',
        branch: 'ECONOMY',
        categoryLabel: 'Hazine & Ticaret',
      };
    case 'TEKNOLOJI':
      return {
        artKey: 'OBSERVATORY',
        branch: 'SCIENCE',
        categoryLabel: 'İlim & Teknoloji',
      };
    case 'JEOPOLITIK':
    default:
      return {
        artKey: 'COURT',
        branch: 'ADMINISTRATION',
        categoryLabel: 'Divan & Jeopolitik',
      };
  }
}

export const CrisisAndNewsModal: React.FC<CrisisAndNewsModalProps> = ({
  activeCrisis,
  onResolveCrisis,
  showNewsDrawer,
  onCloseNewsDrawer,
  newsEvents,
  gameMode = 'EMPIRES_1440',
}) => {
  const is1440 = gameMode === 'EMPIRES_1440';
  const crisisDialogRef = useAccessibleDialog(
    Boolean(activeCrisis),
    () => undefined,
    { closeOnEscape: false }
  );
  const accessibleNewsOpen = showNewsDrawer && !activeCrisis;
  const newsDialogRef = useAccessibleDialog(
    accessibleNewsOpen,
    onCloseNewsDrawer
  );

  const crisisArt = activeCrisis
    ? getCrisisArtworkSpec(activeCrisis.category)
    : null;
  const artworkAsset = crisisArt
    ? getTechArtwork(crisisArt.artKey, crisisArt.branch)
    : null;

  return (
    <>
      {/* 1. AoH3 Oil-Painting Imperial Ferman / Cabinet Decision Modal */}
      {activeCrisis && crisisArt && artworkAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overscroll-contain">
          <div
            ref={crisisDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crisis-dialog-title"
            aria-describedby="crisis-dialog-description"
            tabIndex={-1}
            className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] rounded-2xl bg-[#14100c] border-2 border-[#caa15a]/65 shadow-[0_24px_70px_rgba(0,0,0,0.9)] text-[#f3ead7] overflow-hidden flex flex-col"
          >
            {/* Oil-Painting Artwork Banner */}
            <div
              className="relative h-32 sm:h-40 w-full shrink-0 overflow-hidden border-b border-[#caa15a]/40 [@media(max-height:500px)]:h-20"
              style={{ background: artworkAsset.fallbackGradient }}
            >
              <img
                src={artworkAsset.src}
                alt={activeCrisis.title}
                loading="eager"
                decoding="sync"
                referrerPolicy="no-referrer"
                style={{ objectPosition: artworkAsset.objectPosition }}
                className="w-full h-full object-cover brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14100c] via-[#14100c]/55 to-black/35" />

              <div className="absolute top-3 left-3.5 right-3.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14100c]/85 border border-[#caa15a]/50 text-[10.5px] font-bold text-[#e0b86e] uppercase tracking-wider">
                  <AoH3GlyphSvg name="crown" className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {is1440 ? 'Divan-ı Hümâyûn Fermanı' : 'Ulusal Kabine Kararı'}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-black/65 border border-[#caa15a]/35 text-[10px] font-semibold text-[#d8cbb5]">
                  {crisisArt.categoryLabel}
                </span>
              </div>

              <div className="absolute bottom-2.5 left-4 right-4">
                <h3
                  id="crisis-dialog-title"
                  className="font-display text-base sm:text-lg font-extrabold text-[#faf3e3] leading-snug drop-shadow"
                >
                  {activeCrisis.title}
                </h3>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-3.5">
              <p
                id="crisis-dialog-description"
                className="text-xs sm:text-sm text-[#d8cbb5] leading-relaxed"
              >
                {activeCrisis.description}
              </p>

              <div className="space-y-2 pt-0.5">
                {activeCrisis.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      sound.playTreaty();
                      onResolveCrisis(opt);
                    }}
                    className="w-full min-h-[52px] text-left p-3.5 rounded-xl bg-[#1b1510] hover:bg-[#261d14] border border-[#caa15a]/35 hover:border-[#e0b86e] transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-[#faf3e3] group-hover:text-[#e0b86e] transition-colors">
                        {opt.label}
                      </div>
                      <div className="font-mono-num text-[11px] font-semibold text-emerald-400 mt-1">
                        {opt.effectSummary}
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-[#9b8e78] group-hover:text-[#e0b86e] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AoH3 World Chronicle / News Feed Drawer */}
      {accessibleNewsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs overscroll-contain">
          <div
            ref={newsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md h-full bg-[#14100c]/98 border-l border-[#caa15a]/45 flex flex-col shadow-2xl text-[#f3ead7]"
          >
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#caa15a]/30 bg-[#100d09] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#1b1510] border border-[#caa15a]/45 flex items-center justify-center text-[#e0b86e] shrink-0">
                  <ScrollText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="news-dialog-title"
                    className="font-display text-sm sm:text-base font-bold text-[#faf3e3] truncate"
                  >
                    {is1440 ? 'Vekâyinâme & Cihan Haberleri' : 'Dünya Haber Akışı'}
                  </h3>
                  <p className="text-[11px] text-[#b8a990] truncate">
                    Savaşlar, barış antlaşmaları ve küresel gelişmeler
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onCloseNewsDrawer();
                }}
                aria-label="Haberler panelini kapat"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#b8a990] hover:text-[#faf3e3] hover:bg-[#1e1812] border border-transparent hover:border-[#caa15a]/30 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-2">
              {newsEvents.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#9b8e78]">
                  Henüz kayda geçmiş bir cihan haberi bulunmuyor.
                </div>
              ) : (
                newsEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-[#1b1510] border border-[#caa15a]/25 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 font-bold text-[#e0b86e] min-w-0">
                        {ev.type === 'WAR' && (
                          <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        {ev.type === 'PEACE' && (
                          <Handshake className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        {ev.type === 'COALITION' && (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {ev.type === 'ECONOMY' && (
                          <TrendingUp className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
                        )}
                        <span className="truncate">{ev.title}</span>
                      </span>
                      <span className="font-mono-num text-[#b8a990] shrink-0">
                        {ev.dateStr}
                      </span>
                    </div>
                    <p className="text-xs text-[#d8cbb5] leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
