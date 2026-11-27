import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Menu,
  Music,
  Newspaper,
  Pause,
  Play,
  Sliders,
  VolumeX,
} from 'lucide-react';
import { SpeedLevel } from '../../types/game';
import { music } from '../../engine/musicEngine';
import { sound } from '../../utils/soundEngine';

/**
 * AoH3 hamburger menu: the reference HUD keeps the top-right bar to a single ☰,
 * the minus/plus zoom plaque and the date. Time, music, news and the system
 * panel therefore live one tap deeper, here.
 */

interface AoH3TopMenuProps {
  speed: SpeedLevel;
  isMusicPlaying: boolean;
  newsCount: number;
  onSetSpeed: (speed: SpeedLevel) => void;
  onTogglePause: () => void;
  onOpenNewsDrawer: () => void;
  onOpenSystemModal: () => void;
  onFocusCapital?: () => void;
}

const MenuRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trailing?: React.ReactNode;
  onClick: () => void;
}> = ({ icon: Icon, label, trailing, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-[3px] text-left text-[11px] font-semibold text-[#e9dcc2] hover:bg-[#caa15a]/14 hover:text-[#faf3e3] transition-colors"
  >
    <Icon className="w-3.5 h-3.5 text-[#d8b471] shrink-0" />
    <span className="flex-1 truncate">{label}</span>
    {trailing !== undefined && (
      <span className="font-mono-num text-[10px] text-[#b2a58f] shrink-0">
        {trailing}
      </span>
    )}
  </button>
);

export const AoH3TopMenu: React.FC<AoH3TopMenuProps> = ({
  speed,
  isMusicPlaying,
  newsCount,
  onSetSpeed,
  onTogglePause,
  onOpenNewsDrawer,
  onOpenSystemModal,
  onFocusCapital,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          sound.playClick();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Divan menüsü"
        title="Divan · zaman, müzik, haberler ve sistem"
        className={`aoh3-topbtn relative ${open ? 'is-active' : ''}`}
      >
        <Menu className="w-4 h-4" />
        {newsCount > 0 && !open && (
          <span
            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#d1746b] border border-[#0b0907]"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-[228px] aoh3-panel aoh3-chamfer rounded-lg z-[60] text-xs"
        >
          <div className="aoh3-panel-title rounded-t-[11px]">
            <span className="aoh3-panel-title-text">Divan</span>
            <span className="aoh3-panel-title-rule" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="aoh3-panel-close"
              aria-label="Divan menüsünü kapat"
            >
              ✕
            </button>
          </div>

          <div className="p-1.5">
            <div className="px-1.5 pb-1.5">
              <div className="flex items-center justify-between">
                <span className="aoh3-menu-label">Zaman</span>
                <span className="font-mono-num text-[10px] font-bold text-[#d8b471]">
                  {speed === 0 ? 'DURDU' : `${speed}x`}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onTogglePause();
                  }}
                  aria-label={speed === 0 ? 'Devam et' : 'Duraklat'}
                  className={`aoh3-time-btn ${speed === 0 ? 'is-active' : ''}`}
                >
                  {speed === 0 ? (
                    <Play className="w-3 h-3 fill-current" />
                  ) : (
                    <Pause className="w-3 h-3" />
                  )}
                </button>
                {([1, 2, 3, 4, 5] as SpeedLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onSetSpeed(level);
                    }}
                    aria-label={`Hız ${level}x`}
                    aria-pressed={speed === level}
                    className={`aoh3-time-btn flex-1 ${speed === level ? 'is-active' : ''}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#caa15a]/18 mb-1" />

            {onFocusCapital && (
              <MenuRow
                icon={Compass}
                label="Başkente Odakla"
                onClick={() => {
                  sound.playClick();
                  onFocusCapital();
                  setOpen(false);
                }}
              />
            )}
            <MenuRow
              icon={isMusicPlaying ? Music : VolumeX}
              label="Arka Plan Müziği"
              trailing={isMusicPlaying ? 'AÇIK' : 'KAPALI'}
              onClick={() => {
                sound.playClick();
                music.toggle();
              }}
            />
            <MenuRow
              icon={Newspaper}
              label="Haberler"
              trailing={newsCount}
              onClick={() => {
                sound.playClick();
                onOpenNewsDrawer();
                setOpen(false);
              }}
            />
            <MenuRow
              icon={Sliders}
              label="Sistem & Kayıt"
              onClick={() => {
                sound.playClick();
                onOpenSystemModal();
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
