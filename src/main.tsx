import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register VitePWA Workbox Service Worker and broadcast offline-ready status for Vercel/iOS/Android play
if ('serviceWorker' in navigator) {
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
  let hasTriggeredReload = false;

  const reloadOnceForUpdate = () => {
    if (!import.meta.env.PROD || !navigator.onLine || hasTriggeredReload) return;
    try {
      const lastReloadAt = Number(
        window.sessionStorage.getItem('floda_sw_reloaded_at') || '0'
      );
      if (Date.now() - lastReloadAt < 10_000) return;
      window.sessionStorage.setItem('floda_sw_reloaded_at', String(Date.now()));
    } catch {
      // ignore storage errors in private browsing
    }
    hasTriggeredReload = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadControllerAtBoot) {
      reloadOnceForUpdate();
    }
  });

  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('floda-pwa-offline-ready'));
    },
    onNeedRefresh() {
      if (navigator.onLine) {
        updateSW(true).catch(() => {});
      }
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      if (navigator.onLine) {
        registration.update().catch(() => {});
      }
      if (import.meta.env.PROD) {
        window.setInterval(() => {
          if (document.visibilityState === 'visible' && navigator.onLine) {
            registration.update().catch(() => {});
          }
        }, 60_000);
      }
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
