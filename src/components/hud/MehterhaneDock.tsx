import React, { useEffect, useState } from 'react';
import { SkipForward, X, Music, Volume2, VolumeX } from 'lucide-react';
import { music, MUSIC_TRACKS } from '../../engine/musicEngine';

export const MehterhaneDock: React.FC = () => {
  const [, setTick] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    return music.subscribe(() => setTick((t) => t + 1));
  }, []);

  const isPlaying = music.isPlaying;

  if (!isPlaying && !isExpanded) {
    return null;
  }

  return (
    <div className="hud-mehter-dock fixed bottom-16 right-3 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
      {/* Expanded Offline Mehterhane Selector */}
      {isExpanded && (
        <div className="pointer-events-auto w-68 sm:w-76 rounded-2xl bg-[#090e1a]/98 border border-amber-500/50 shadow-2xl p-3 space-y-2.5 text-xs text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-display font-bold text-amber-300">
              <Music className="w-4 h-4 text-amber-400" />
              <span>Mehterhane (Çevrimdışı)</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              aria-label="Müzik seçiciyi kapat"
              className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
            {MUSIC_TRACKS.map((trk) => {
              const active = music.activeTrackId === trk.id;
              return (
                <button
                  key={trk.id}
                  onClick={() => {
                    music.setTrack(trk.id);
                    if (!music.isPlaying) music.play();
                  }}
                  className={`w-full p-2 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-slate-950/80 border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[11px] truncate">
                      {trk.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                      {trk.eraTag}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {trk.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Floating Offline Mehter Pill */}
      <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#090e1a]/95 border border-amber-500/45 shadow-xl text-xs">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-left max-w-[140px]"
          title="Mehterhane Marş Seçiciyi Aç"
        >
          <span className="text-amber-400 font-bold">♫</span>
          <span className="text-[11px] font-semibold text-amber-100 truncate">
            {music.activeTrackTitle}
          </span>
        </button>

        <button
          onClick={() => music.nextTrack()}
          title="Sonraki Marş"
          aria-label="Sonraki Marş"
          className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-amber-300"
        >
          <SkipForward className="w-3 h-3" />
        </button>

        <button
          onClick={() => music.toggle()}
          title={isPlaying ? 'Marşı Durdur' : 'Marşı Çal'}
          aria-label={isPlaying ? 'Marşı Durdur' : 'Marşı Çal'}
          className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-emerald-400"
        >
          {isPlaying ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>
    </div>
  );
};
