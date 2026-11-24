import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type OfflineCacheStatus = 'READY' | 'CACHING' | 'DEV' | 'UNSUPPORTED';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineStatus, setOfflineStatus] = useState<OfflineCacheStatus>(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return 'UNSUPPORTED';
    }
    if (!import.meta.env.PROD) return 'DEV';
    return navigator.serviceWorker.controller ? 'READY' : 'CACHING';
  });

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleOfflineReady = () => setOfflineStatus('READY');

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('floda-pwa-offline-ready', handleOfflineReady);

    let cancelled = false;
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      if (navigator.serviceWorker.controller) {
        setOfflineStatus('READY');
      } else {
        navigator.serviceWorker.ready
          .then((reg) => {
            if (!cancelled && reg.active) {
              setOfflineStatus('READY');
            }
          })
          .catch(() => {});
      }
    }

    // Request Screen Wake Lock on mobile so screen doesn't dim while watching real-time strategy flow
    let wakeLockSentinel: { release?: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          wakeLockSentinel = await nav.wakeLock.request('screen');
        }
      } catch {
        // Ignore if not supported or denied
      }
    };
    requestWakeLock();

    return () => {
      cancelled = true;
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('floda-pwa-offline-ready', handleOfflineReady);
      wakeLockSentinel?.release?.().catch(() => {});
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isOnline,
    offlineStatus,
    install,
  };
}
