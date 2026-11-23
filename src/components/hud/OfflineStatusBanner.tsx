import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const OfflineStatusBanner: React.FC = () => {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[70px] sm:bottom-[80px] left-2.5 z-30 pointer-events-none"
    >
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/95 border border-amber-500/50 text-amber-200 text-[11px] font-semibold shadow-lg">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Çevrimdışı Mod · Kayıtlar Cihazda</span>
      </div>
    </div>
  );
};
