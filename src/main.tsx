import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register VitePWA Workbox Service Worker and broadcast offline-ready status for Vercel/iOS/Android play
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
