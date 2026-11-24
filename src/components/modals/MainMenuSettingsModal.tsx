import React from 'react';
import { Sliders, X } from 'lucide-react';
import { GameSettings } from '../../engine/gameSettings';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';
import { CategorizedSettingsPanel } from './CategorizedSettingsPanel';

interface MainMenuSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
}

export const MainMenuSettingsModal: React.FC<MainMenuSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playClick();
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="main-settings-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-2xl bg-[#191612] border border-[#c89d54]/45 shadow-2xl overflow-hidden text-[#f0e6d2]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#13110e] border-b border-[#c89d54]/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sliders className="w-5 h-5 text-[#c89d54] shrink-0" />
            <div className="min-w-0">
              <h2
                id="main-settings-title"
                className="font-display text-base sm:text-lg font-bold text-[#f0e6d2] truncate"
              >
                Oyun Ayarları
              </h2>
              <p className="text-[11px] text-[#b2a58f] truncate">
                Grafik, harita görünümü, ses seviyeleri, yapay zekâ ve kısayollar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            aria-label="Ayarları kapat"
            className="w-10 h-10 rounded-xl bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 text-[#cfc3ae] hover:text-[#f0e6d2] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categorized Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <CategorizedSettingsPanel
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#13110e] border-t border-[#c89d54]/25 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d] text-xs font-bold cursor-pointer transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
