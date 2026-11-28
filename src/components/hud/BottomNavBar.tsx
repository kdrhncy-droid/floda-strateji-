import React from 'react';
import {
  Globe,
  TrendingUp,
  Handshake,
  Landmark,
  Hammer,
  WifiOff,
} from 'lucide-react';
import { BottomDrawerTab } from '../../types/game';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { sound } from '../../utils/soundEngine';

export const OfflineStatusBanner: React.FC<{ liftAboveBottomCard?: boolean }> = ({
  liftAboveBottomCard = false,
}) => {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-2.5 z-25 pointer-events-none transition-all ${
        liftAboveBottomCard ? 'bottom-[175px] sm:bottom-[150px]' : 'bottom-[70px] sm:bottom-[80px]'
      }`}
    >
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/95 border border-amber-500/50 text-amber-200 text-[11px] font-semibold shadow-lg">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Çevrimdışı Mod · Kayıtlar Cihazda</span>
      </div>
    </div>
  );
};

interface BottomNavBarProps {
  activeTab: BottomDrawerTab;
  activeWarCount: number;
  onSetActiveTab: (tab: BottomDrawerTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  activeWarCount,
  onSetActiveTab,
}) => {
  const tabs = [
    { id: 'TERRITORY' as const, label: 'Eyalet', icon: Globe, badge: 0 },
    { id: 'ECONOMY' as const, label: 'Ekonomi', icon: TrendingUp, badge: 0 },
    { id: 'CONSTRUCTION' as const, label: 'İnşaat', icon: Hammer, badge: 0 },
    {
      id: 'DIPLOMACY' as const,
      label: 'Diplomasi',
      icon: Handshake,
      badge: activeWarCount,
    },
    { id: 'GOVERNMENT' as const, label: 'Yönetim', icon: Landmark, badge: 0 },
  ];

  return (
    <nav aria-label="Ana aksiyon şeridi" className="hud-bottom-nav aoh3-nav h-16 pb-safe hud-surface grid grid-cols-5 items-center z-30 shrink-0 px-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const ariaText =
          tab.badge > 0 ? `${tab.label} (${tab.badge} savaş)` : tab.label;
        return (
          <button
            key={tab.id}
            title={ariaText}
            aria-label={ariaText}
            onClick={() => {
              sound.playClick();
              onSetActiveTab(isActive ? 'NONE' : tab.id);
            }}
            className={`hud-bottom-nav-btn relative min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
              isActive
                ? 'hud-nav-active'
                : 'hud-nav-idle'
            }`}
            aria-pressed={isActive}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {tab.badge > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-mono-num font-bold leading-none flex items-center justify-center border border-[#14100c]"
              >
                {tab.badge}
              </span>
            )}
            <span className="text-[10px] font-semibold tracking-tight mt-1 whitespace-nowrap truncate max-w-[92%]">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
