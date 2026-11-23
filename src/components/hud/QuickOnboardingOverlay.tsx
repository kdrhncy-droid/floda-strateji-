import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Compass, Shield, Swords, X } from 'lucide-react';

const STORAGE_KEY = 'IMPERIUM_ONBOARDING_DONE_V1';

interface QuickOnboardingOverlayProps {
  visible: boolean;
}

const STEPS = [
  {
    icon: Compass,
    title: '1/3 • Harita ve Eyalet Yönetimi',
    body: 'Kendi eyaletlerine dokunarak asker basabilir, bina kurabilir ve garnizonu görebilirsin. Haritayı iki parmakla veya çift dokunarak yakınlaştırabilir, üstteki pusula simgesiyle başkente dönebilirsin.',
  },
  {
    icon: Swords,
    title: '2/3 • Ordu Yürüt ve Fethet',
    body: 'Kendi eyaletini seçtikten sonra alt çubuktaki "Ordu Yürüt" düğmesine bas ve hedef komşu eyalete dokun. Tarafsız topraklara girerken savaş ilanı veya geçiş izni seçebilirsin.',
  },
  {
    icon: Shield,
    title: '3/3 • Diplomasi ve Çevrimdışı Kayıt',
    body: 'Alt sekmeden Ekonomi, Diplomasi ve Ordugâh panellerini aç. Sol üst menüden (≡) oyununu cihazına kaydedip internetsiz olarak istediğin zaman devam edebilirsin.',
  },
];

export const QuickOnboardingOverlay: React.FC<QuickOnboardingOverlayProps> = ({
  visible,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (dismissed) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [dismissed]);

  if (!visible || dismissed) return null;

  const complete = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const step = STEPS[stepIdx];
  const Icon = step.icon;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="hud-onboarding-card fixed bottom-[74px] sm:bottom-[86px] inset-x-0 mx-auto z-30 w-[calc(100vw-1.5rem)] max-w-md pointer-events-auto">
      <div className="rounded-2xl bg-slate-950/95 border border-amber-500/50 shadow-2xl p-3.5 text-slate-100 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-amber-300" />
            </div>
            <h3 className="font-display font-bold text-xs sm:text-sm text-amber-200 truncate">
              {step.title}
            </h3>
          </div>
          <button
            onClick={complete}
            aria-label="Rehberi kapat"
            className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed mb-3">
          {step.body}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIdx
                    ? 'w-5 bg-amber-400'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={complete}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Atla
            </button>
            <button
              onClick={() => {
                if (isLast) complete();
                else setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <span>{isLast ? 'Başla' : 'İleri'}</span>
              {isLast ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
