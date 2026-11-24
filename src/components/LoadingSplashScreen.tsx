import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  BOOT_STAGES,
  BootStageDefinition,
  computeBootProgress,
  detectHardwareProfile,
  HardwareProfile,
  STRATEGY_LOADING_TIPS,
} from '../engine/bootLoader';
import { initSaveStorage } from '../engine/saveManager';
import { GeoCountryFeature } from '../engine/worldBuilder';
import { Nation } from '../types/game';
import { drawNationFlagOnCanvas } from '../map/nationFlagRenderer';

import warRoomArt from '../assets/images/floda_main_menu_war_room_1795459892773.jpg';
import siegeBastionArt from '../assets/images/floda_loading_siege_bastion_1795459892243.jpg';
import cavalryChargeArt from '../assets/images/floda_loading_cavalry_charge_1795459893299.jpg';
import navalArmadaArt from '../assets/images/floda_loading_naval_armada_1795459893134.jpg';
import menuLandscapeArt from '../assets/images/floda_menu_landscape_1795461163428.jpg';
import menuPortraitArt from '../assets/images/floda_menu_portrait_1795461162475.jpg';

export interface HistoricalArtSlide {
  src: string;
  caption: string;
  era: string;
}

export const HISTORICAL_ART_SLIDES: HistoricalArtSlide[] = [
  {
    src: siegeBastionArt,
    caption: 'Boğaz Kalesi Kuşatması',
    era: '1440 · Kale ve Topçu Harbi',
  },
  {
    src: cavalryChargeArt,
    caption: 'Anadolu ve Balkan Süvari Seferi',
    era: '1440 · Meydan Muharebesi',
  },
  {
    src: navalArmadaArt,
    caption: 'Kadırga Donanması ve Boğaz Hâkimiyeti',
    era: '1440 · Deniz Gücü ve Ticaret',
  },
  {
    src: warRoomArt,
    caption: 'Hümayun Harita ve Diplomasi Divanı',
    era: '1440 · Devlet Aklı ve İttifaklar',
  },
];

interface LoadingSplashScreenProps {
  features: GeoCountryFeature[];
  nations: Record<string, Nation>;
  onComplete: (profile: HardwareProfile) => void;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export const LoadingSplashScreen: React.FC<LoadingSplashScreenProps> = ({
  features,
  nations,
  onComplete,
}) => {
  const hardwareProfile = useMemo(() => detectHardwareProfile(), []);

  const [slideIndex, setSlideIndex] = useState<number>(() =>
    Math.floor(Math.random() * HISTORICAL_ART_SLIDES.length)
  );
  const [tipIndex, setTipIndex] = useState<number>(() =>
    Math.floor(Math.random() * STRATEGY_LOADING_TIPS.length)
  );
  const [activeStageId, setActiveStageId] =
    useState<BootStageDefinition['id']>('HARDWARE');
  const [progress, setProgress] = useState<number>(6);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});
  const completedRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % HISTORICAL_ART_SLIDES.length);
    }, 3200);
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % STRATEGY_LOADING_TIPS.length);
    }, 4200);
    return () => {
      clearInterval(slideTimer);
      clearInterval(tipTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runRealBootWarmup = async () => {
      const doneSet = new Set<BootStageDefinition['id']>();

      const markProgress = (
        stageId: BootStageDefinition['id'],
        fraction: number
      ) => {
        if (cancelled) return;
        setActiveStageId(stageId);
        setProgress(computeBootProgress(doneSet, stageId, fraction));
      };

      markProgress('HARDWARE', 0.5);
      await yieldFrame();
      doneSet.add('HARDWARE');
      markProgress('SAVES', 0.1);

      await initSaveStorage().catch(() => {});
      await yieldFrame();
      doneSet.add('SAVES');
      markProgress('WORLD_MAP', 0.05);

      const chunkSize = hardwareProfile.warmupChunkSize;
      const totalFeatures = Math.max(1, features.length);
      for (let i = 0; i < features.length; i += chunkSize) {
        if (cancelled) return;
        const end = Math.min(features.length, i + chunkSize);
        let checksumAcc = 0;
        for (let j = i; j < end; j++) {
          const geom = features[j]?.geometry;
          if (geom && 'coordinates' in geom && Array.isArray(geom.coordinates)) {
            checksumAcc += geom.coordinates.length;
          }
        }
        if (checksumAcc < 0) break;
        markProgress('WORLD_MAP', end / totalFeatures);
        await yieldFrame();
      }
      doneSet.add('WORLD_MAP');
      markProgress('FLAGS_ATLAS', 0.1);

      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = 48;
        offscreen.height = 32;
        const ctx = offscreen.getContext('2d');
        const nationList = Object.values(nations).slice(0, 24);
        if (ctx) {
          for (let i = 0; i < nationList.length; i++) {
            const nat = nationList[i];
            drawNationFlagOnCanvas(
              ctx,
              0,
              0,
              48,
              32,
              nat.id,
              nat.flagCode,
              nat.color
            );
            if (i % Math.max(6, Math.round(chunkSize / 12)) === 0) {
              markProgress('FLAGS_ATLAS', (i + 1) / Math.max(1, nationList.length));
              await yieldFrame();
            }
          }
        }
        if (document.fonts && document.fonts.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise((r) => setTimeout(r, 240)),
          ]);
        }
      } catch {
        // Canvas warmup is best-effort
      }
      doneSet.add('FLAGS_ATLAS');
      markProgress('MEDIA_AUDIO', 0.25);

      const targetMenuArt =
        typeof window !== 'undefined' && window.innerHeight > window.innerWidth
          ? menuPortraitArt
          : menuLandscapeArt;

      await Promise.race([
        preloadImage(targetMenuArt),
        new Promise((r) => setTimeout(r, 380)),
      ]);
      doneSet.add('MEDIA_AUDIO');
      if (cancelled) return;
      setProgress(100);
      setIsFadingOut(true);

      setTimeout(() => {
        if (!cancelled && !completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current(hardwareProfile);
        }
      }, hardwareProfile.fadeOutMs);
    };

    runRealBootWarmup();
    return () => {
      cancelled = true;
    };
  }, [features, nations, hardwareProfile]);

  const activeSlide = HISTORICAL_ART_SLIDES[slideIndex];
  const activeStage =
    BOOT_STAGES.find((s) => s.id === activeStageId) || BOOT_STAGES[0];
  const activeTip = STRATEGY_LOADING_TIPS[tipIndex];

  return (
    <div
      data-testid="floda-loading-screen"
      className={`fixed inset-0 z-[90] flex flex-col justify-between overflow-hidden bg-[#110f0d] text-[#f0e6d2] transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Active classical oil painting backdrop with warm umber contrast scrim */}
      <div className="absolute inset-0 overflow-hidden">
        {!brokenImages[slideIndex] && (
          <img
            key={activeSlide.caption}
            src={activeSlide.src}
            alt={activeSlide.caption}
            referrerPolicy="no-referrer"
            onError={() =>
              setBrokenImages((prev) => ({ ...prev, [slideIndex]: true }))
            }
            className="w-full h-full object-cover scale-[1.04]"
          />
        )}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, #34281a 0%, #191612 55%, #110f0d 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#110f0d]/85 via-[#110f0d]/42 to-[#110f0d]/95" />
      </div>

      {/* Top Brand Header */}
      <div className="relative z-10 px-5 sm:px-10 pt-6 sm:pt-9 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-2xl sm:text-4xl font-extrabold tracking-[0.08em] text-[#f5ecd9] drop-shadow"
            style={{ textWrap: 'balance' }}
          >
            FLODA STRATEGY
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#e0bc78]">
            <span>{activeSlide.caption}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#cfc3ae]">{activeSlide.era}</span>
          </div>
        </div>

        <button
          type="button"
          data-testid="skip-boot-splash"
          onClick={() => {
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete(hardwareProfile);
            }
          }}
          className="aoh3-menu-btn min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold text-[#e0bc78] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Menüye Geç
        </button>
      </div>

      {/* Bottom Strategy Tip + Real Hardware-Adaptive Progress Bar */}
      <div className="relative z-10 px-5 sm:px-10 pb-6 sm:pb-9 max-w-5xl w-full mx-auto space-y-4">
        <div className="aoh3-menu-panel rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs font-semibold text-[#e0bc78]">
              Strateji İpucu · {activeTip.title}
            </div>
            <p className="text-xs sm:text-sm text-[#e3d9c6] leading-relaxed">
              {activeTip.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setTipIndex((prev) => (prev + 1) % STRATEGY_LOADING_TIPS.length)
            }
            className="aoh3-menu-btn self-start sm:self-center min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold text-[#e0bc78] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Sonraki İpucu</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-[#f0e6d2] font-medium">
              {activeStage.title}
              <span className="hidden sm:inline text-[#b2a58f]">
                {' '}
                — {activeStage.detail}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#cfc3ae] font-mono-num tabular-nums">
              <span className="text-[#9e927d]">{hardwareProfile.label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-[#e0bc78]">%{progress}</span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Oyun yükleme ilerlemesi"
            className="h-2 w-full rounded-full bg-[#1d1914] border border-[#c89d54]/30 overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-[width] duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  'linear-gradient(90deg, #8a6427 0%, #c89d54 65%, #ebd096 100%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
