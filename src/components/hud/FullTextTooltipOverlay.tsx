import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

interface TooltipPopupState {
  title: string;
  body?: string;
  x: number;
  y: number;
}

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 14;

/**
 * Resolves full readable explanation for a touched/long-pressed element:
 * - Explicit `data-full-text` attribute
 * - Visually truncated text (`scrollWidth > clientWidth + 2` or `line-clamp` overflow)
 * - Descriptive `title` or `aria-label` when paired with compact/truncated UI controls
 */
function extractFullTextFromTarget(
  startEl: HTMLElement | null
): { title: string; body?: string } | null {
  let el: HTMLElement | null = startEl;
  for (let depth = 0; depth < 4 && el && el !== document.body; depth++) {
    if (el.tagName === 'CANVAS') return null;

    const explicit = el.getAttribute('data-full-text')?.trim();
    if (explicit) {
      const parts = explicit.split(' — ');
      return parts.length > 1
        ? { title: parts[0], body: parts.slice(1).join(' — ') }
        : { title: explicit };
    }

    const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const isHorizontallyClipped =
      el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2;
    const isVerticallyClipped =
      el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 3;
    const titleAttr = el.getAttribute('title')?.trim();

    if ((isHorizontallyClipped || isVerticallyClipped) && rawText.length >= 4) {
      return {
        title: rawText,
        body:
          titleAttr && titleAttr !== rawText ? titleAttr : undefined,
      };
    }

    if (titleAttr && titleAttr.length >= 6) {
      return {
        title: rawText && rawText.length >= 2 && rawText.length < titleAttr.length ? rawText : titleAttr,
        body: rawText && rawText !== titleAttr && rawText.length < titleAttr.length ? titleAttr : undefined,
      };
    }

    el = el.parentElement;
  }
  return null;
}

/**
 * Global Mobile & iOS Long-Press Full-Text Inspector.
 * Holding a finger (~420ms) on any truncated (`…`) label, chip, button, or card
 * displays its complete text and description inside a viewport-safe popover.
 */
export const FullTextTooltipOverlay: React.FC = () => {
  const [popup, setPopup] = useState<TooltipPopupState | null>(null);
  const timerRef = useRef<number | null>(null);
  const startPtRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-fulltext-popover="1"]')) return;
      if (target.tagName === 'CANVAS') {
        setPopup(null);
        return;
      }

      // Close existing popup on new interaction elsewhere
      setPopup(null);

      // Long-press primarily helps touch/pen (iOS/Android) & also works with mouse hold
      startPtRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();

      const info = extractFullTextFromTarget(target);
      if (!info) return;

      const px = e.clientX;
      const py = e.clientY;
      timerRef.current = window.setTimeout(() => {
        suppressNextClickRef.current = true;
        setPopup({
          title: info.title,
          body: info.body,
          x: px,
          y: py,
        });
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 400);
      }, LONG_PRESS_MS);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!startPtRef.current || timerRef.current === null) return;
      const dist = Math.hypot(
        e.clientX - startPtRef.current.x,
        e.clientY - startPtRef.current.y
      );
      if (dist > MOVE_CANCEL_PX) {
        clearTimer();
      }
    };

    const handlePointerEnd = () => {
      clearTimer();
      startPtRef.current = null;
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (suppressNextClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressNextClickRef.current = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerEnd, { passive: true });
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true });
    window.addEventListener('click', handleClickCapture, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimer();
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('click', handleClickCapture, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!popup) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const maxW = Math.min(320, vw - 24);
  const clampedLeft = Math.max(12, Math.min(vw - maxW - 12, popup.x - maxW / 2));
  const preferAbove = popup.y > vh * 0.5;
  const clampedTop = preferAbove
    ? Math.max(14, popup.y - 108)
    : Math.min(vh - 110, popup.y + 18);

  return (
    <div
      data-fulltext-popover="1"
      role="status"
      style={{
        left: `${Math.round(clampedLeft)}px`,
        top: `${Math.round(clampedTop)}px`,
        width: `${Math.round(maxW)}px`,
      }}
      className="fixed z-[90] rounded-xl bg-[#0a1222]/96 border border-amber-400/60 shadow-2xl p-3 text-slate-100"
    >
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-amber-100 leading-snug break-words">
            {popup.title}
          </div>
          {popup.body && (
            <div className="text-[11px] text-slate-300 leading-relaxed mt-1 break-words">
              {popup.body}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Açıklamayı kapat"
          onClick={() => setPopup(null)}
          className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
