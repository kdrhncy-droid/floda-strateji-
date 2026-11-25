import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { sound } from '../utils/soundEngine';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isOnline,
    offlineStatus,
    install,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const guideDialogRef = useAccessibleDialog(showGuideModal, () =>
    setShowGuideModal(false)
  );

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    sound.playClick();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore if blocked by iframe permissions
    }
  };

  const handleInstallClick = async () => {
    sound.playClick();
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {!isOnline ? (
        <div
          title="Çevrimdışı Mod (Önbellek Aktif)"
          className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Çevrimdışı</span>
        </div>
      ) : offlineStatus === 'READY' ? (
        <div
          title="Tüm harita ve oyun dosyaları cihaza önbelleklendi — internetsiz açılabilir"
          className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10.5px] font-semibold flex items-center gap-1 whitespace-nowrap"
        >
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span className={compact ? 'hidden xl:inline' : 'hidden sm:inline'}>
            Çevrimdışı Hazır
          </span>
        </div>
      ) : offlineStatus === 'CACHING' ? (
        <div
          title="Oyun dosyaları çevrimdışı kullanım için önbelleğe alınıyor"
          className="px-2 py-1 rounded-lg bg-[#14100c]/90 border border-[#caa15a]/45 text-[#e0b86e] text-[10.5px] font-semibold flex items-center gap-1 whitespace-nowrap"
        >
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span className={compact ? 'hidden xl:inline' : 'hidden sm:inline'}>
            Önbellek...
          </span>
        </div>
      ) : null}

      {/* Fullscreen Toggle Button for Android & Desktop */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Oynanış (Android/PC)'}
        aria-label={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Oynanış'}
        className="min-w-[36px] min-h-[36px] px-2 rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#3a3228] hover:border-[#c89d54]/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#cfc3ae] transition-colors shrink-0 cursor-pointer"
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5 text-[#c89d54]" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-[#c89d54]" />
        )}
        {!compact && <span className="hidden sm:inline">Tam Ekran</span>}
      </button>

      {/* Install PWA Button (hidden once running in installed standalone mode) */}
      {!isInstalled && (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Android / iOS Cihaza Uygulama Olarak Yükle"
          className="min-w-[36px] min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-[#212b22] hover:bg-[#2a382c] border border-[#45825c]/55 text-[#9dd4b0] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#6eb887] shrink-0" />
          <span className={compact ? 'hidden 2xl:inline' : ''}>
            {isIOS ? 'iOS Kurulum' : 'Uygulamayı İndir'}
          </span>
        </button>
      )}

      {/* Render modal via Portal to document.body so header backdrop-filter never clips fixed positioning */}
      {showGuideModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div
              ref={guideDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pwa-guide-title"
              aria-describedby="pwa-guide-description"
              tabIndex={-1}
              className="w-full max-w-md rounded-xl bg-[#191612] border border-[#c89d54]/45 p-5 shadow-2xl text-[#f0e6d2] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-[#c89d54]" />
                  <h3 id="pwa-guide-title" className="font-display text-base font-bold text-[#f0e6d2]">
                    Mobil Uygulama & Çevrimdışı Kurulum
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Kurulum yönergesini kapat"
                  className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#b2a58f] hover:text-[#f0e6d2] hover:bg-[#231f1a] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div id="pwa-guide-description" className="text-xs text-[#cfc3ae] space-y-2.5 leading-relaxed">
                <p>
                  <strong>Floda Strategy</strong>, telefonunuza tam ekran bir mobil oyun olarak kurulabilir ve internetsiz oynanabilir:
                </p>
                {offlineStatus === 'READY' && (
                  <div className="rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-3 py-2 text-emerald-200 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Çevrimdışı önbellek hazır! Tüm harita, ses ve oyun dosyaları cihaza indirildi.</span>
                  </div>
                )}
                {isIOS ? (
                  <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-3 space-y-1.5">
                    <div>1. Site açıldıktan sonra üstte <strong>Çevrimdışı Hazır</strong> işaretinin yanmasını bekleyin.</div>
                    <div>2. Safari alt çubuğundaki <strong>Paylaş (Share)</strong> simgesine dokunun ve <strong>Ana Ekrana Ekle</strong> deyin.</div>
                    <div>3. İnterneti kapatmadan önce ana ekrandaki simgeden oyunu <strong>1 kez açın</strong> (iOS önbelleği kilitler).</div>
                  </div>
                ) : (
                  <div className="bg-[#14110e] border border-[#3a3228] rounded-lg p-3 space-y-1.5">
                    <div>1. Oyunu doğrudan Chrome sekmesinde açın ve <strong>Çevrimdışı Hazır</strong> işaretini görün.</div>
                    <div>2. Android Chrome menüsünden (<strong>⋮</strong>) <strong>Uygulamayı Yükle</strong> veya <strong>Ana ekrana ekle</strong> seçeneğine dokunun.</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="aoh3-menu-btn-primary w-full min-h-[42px] rounded-lg font-bold text-xs cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
