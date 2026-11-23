import React, { useState } from 'react';
import { Sliders, Volume2, VolumeX, X } from 'lucide-react';
import {
  AI_AGGRESSIVENESS_OPTIONS,
  AUTO_SAVE_OPTIONS,
  GameSettings,
  MAP_LABEL_DENSITY_OPTIONS,
  UI_SCALE_OPTIONS,
} from '../../engine/gameSettings';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { sound } from '../../utils/soundEngine';

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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => sound.enabled);
  const dialogRef = useAccessibleDialog(isOpen, onClose);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const nextEnabled = !sound.enabled;
    sound.enabled = nextEnabled;
    setSoundEnabled(nextEnabled);
    if (nextEnabled) {
      sound.playClick();
    }
  };

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
        className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-xl bg-[#191612] border border-[#c89d54]/45 shadow-2xl overflow-hidden text-[#f0e6d2]"
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
                Harita görünümü, yapay zekâ dengesi, ses ve otomatik kayıt
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
            className="w-10 h-10 rounded-lg bg-[#231f1a] hover:bg-[#2d2720] border border-[#c89d54]/30 text-[#cfc3ae] hover:text-[#f0e6d2] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Audio & Fog toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`min-h-[46px] px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-[#26211a] border-[#c89d54]/60 text-[#f0e6d2]'
                  : 'bg-[#15120f] border-[#3a3228] text-[#9e927d]'
              }`}
            >
              <span className="text-xs font-semibold flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#c89d54]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#9e927d]" />
                )}
                <span>Oyun Sesi ve Efektler</span>
              </span>
              <span className="text-[11px] font-bold text-[#e0bc78]">
                {soundEnabled ? 'Açık' : 'Kapalı'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onUpdateSettings({ fogOfWarEnabled: !settings.fogOfWarEnabled });
              }}
              className={`min-h-[46px] px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                settings.fogOfWarEnabled
                  ? 'bg-[#26211a] border-[#c89d54]/60 text-[#f0e6d2]'
                  : 'bg-[#15120f] border-[#3a3228] text-[#9e927d]'
              }`}
            >
              <span className="text-xs font-semibold">Savaş Sisi</span>
              <span className="text-[11px] font-bold text-[#e0bc78]">
                {settings.fogOfWarEnabled ? 'Açık' : 'Kapalı'}
              </span>
            </button>
          </div>

          {/* UI Scale */}
          <div className="space-y-2 pt-1 border-t border-[#342d24]">
            <div className="text-xs font-semibold text-[#e0bc78]">
              Arayüz Ölçeği
            </div>
            <div className="grid grid-cols-3 gap-2">
              {UI_SCALE_OPTIONS.map((opt) => {
                const active = (settings.uiScale || 'STANDARD') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ uiScale: opt.value });
                    }}
                    title={opt.desc}
                    className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78] font-bold'
                        : 'bg-[#211d18] border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Label Density */}
          <div className="space-y-2 pt-2 border-t border-[#342d24]">
            <div className="text-xs font-semibold text-[#e0bc78]">
              Harita Şehir Etiketi Yoğunluğu
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MAP_LABEL_DENSITY_OPTIONS.map((opt) => {
                const active = settings.mapLabelDensity === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ mapLabelDensity: opt.value });
                    }}
                    title={opt.desc}
                    className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78] font-bold'
                        : 'bg-[#211d18] border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Aggressiveness */}
          <div className="space-y-2 pt-2 border-t border-[#342d24]">
            <div className="text-xs font-semibold text-[#e0bc78]">
              Yapay Zekâ Saldırganlığı
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_AGGRESSIVENESS_OPTIONS.map((opt) => {
                const active = settings.aiAggressiveness === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ aiAggressiveness: opt.value });
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78] font-bold'
                        : 'bg-[#211d18] border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-Save */}
          <div className="space-y-2 pt-2 border-t border-[#342d24]">
            <div className="text-xs font-semibold text-[#e0bc78]">
              Otomatik Kayıt Sıklığı
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {AUTO_SAVE_OPTIONS.map((opt) => {
                const active = settings.autoSaveIntervalDays === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ autoSaveIntervalDays: opt.value });
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#45825c] text-[#f6f1e7] border-[#66a67d] font-bold'
                        : 'bg-[#211d18] border-[#3a3228] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-[#13110e] border-t border-[#c89d54]/25 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="min-h-[40px] px-5 py-2 rounded-lg bg-[#c89d54] hover:bg-[#d8b26e] text-[#110f0d] text-xs font-bold cursor-pointer transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
