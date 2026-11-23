import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure installed Android/iOS PWA registers Service Worker immediately for 100% offline play
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .catch(() => {
      // SW registration may be skipped in dev mode
    });

  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing || !navigator.onLine) return;
    refreshing = true;
    window.location.reload();
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
