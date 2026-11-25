import React, { useEffect, useState } from 'react';
import { SkipForward, X, Music, Volume2, VolumeX } from 'lucide-react';
import { music, MUSIC_TRACKS } from '../../engine/musicEngine';

interface MehterhaneDockProps {
  hideCompactOnMobile?: boolean;
}

export const MehterhaneDock: React.FC<MehterhaneDockProps> = ({
  hideCompactOnMobile = false,
}) => {
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
    <div
      className={`hud-mehter-dock fixed bottom-16 right-3 z-30 flex flex-col items-end gap-1.5 pointer-events-none ${
        hideCompactOnMobile && !isExpanded ? 'hud-mehter-yield' : ''
      }`}
    >
      {/* Expanded Offline Mehterhane Selector */}
      {isExpanded && (
        <div className="pointer-events-auto w-68 sm:w-76 rounded-2xl bg-[#14100c]/98 border border-[#caa15a]/50 shadow-2xl p-3 space-y-2.5 text-xs text-[#f3ead7]">
          <div className="flex items-center justify-between border-b border-[#caa15a]/25 pb-2">
            <div className="flex items-center gap-1.5 font-display font-bold text-[#e0b86e]">
              <Music className="w-4 h-4 text-[#e0b86e]" />
              <span>Mehterhane (Çevrimdışı)</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              aria-label="Müzik seçiciyi kapat"
              className="w-6 h-6 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/25 flex items-center justify-center text-[#9d8f76] hover:text-[#f3ead7] cursor-pointer"
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
                  className={`w-full p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#caa15a]/20 border-[#caa15a] text-[#faf3e3]'
                      : 'bg-[#0f0c09]/85 border-[#caa15a]/20 text-[#d4c8b4] hover:border-[#caa15a]/45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[11px] truncate">
                      {trk.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#caa15a]/15 text-[#e0b86e] border border-[#caa15a]/30 shrink-0">
                      {trk.eraTag}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#9d8f76] truncate mt-0.5">
                    {trk.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Floating Offline Mehter Pill */}
      <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14100c]/95 border border-[#caa15a]/45 shadow-xl text-xs">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-left max-w-[140px] cursor-pointer"
          title="Mehterhane Marş Seçiciyi Aç"
        >
          <Music className="w-3.5 h-3.5 text-[#e0b86e] shrink-0" />
          <span className="text-[11px] font-semibold text-[#f3ead7] truncate">
            {music.activeTrackTitle}
          </span>
        </button>

        <button
          onClick={() => music.nextTrack()}
          title="Sonraki Marş"
          aria-label="Sonraki Marş"
          className="w-6 h-6 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/25 flex items-center justify-center text-[#e0b86e] cursor-pointer"
        >
          <SkipForward className="w-3 h-3" />
        </button>

        <button
          onClick={() => music.toggle()}
          title={isPlaying ? 'Marşı Durdur' : 'Marşı Çal'}
          aria-label={isPlaying ? 'Marşı Durdur' : 'Marşı Çal'}
          className="w-6 h-6 rounded-lg bg-[#1b1510] hover:bg-[#2a2117] border border-[#caa15a]/25 flex items-center justify-center text-[#e0b86e] cursor-pointer"
        >
          {isPlaying ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-[#7c705d]" />
          )}
        </button>
      </div>
    </div>
  );
};
