import React, { useState } from 'react';
import {
  Cpu,
  Eye,
  EyeOff,
  Gamepad2,
  Keyboard,
  Map,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AI_AGGRESSIVENESS_OPTIONS,
  AUTO_SAVE_OPTIONS,
  BORDER_THICKNESS_OPTIONS,
  CAPITULATION_THRESHOLD_OPTIONS,
  CRISIS_FREQUENCY_OPTIONS,
  GameSettings,
  GRAPHICS_QUALITY_OPTIONS,
  KEYBOARD_SHORTCUTS_LIST,
  MAP_LABEL_DENSITY_OPTIONS,
  MAP_LABEL_SCALE_OPTIONS,
  UI_SCALE_OPTIONS,
} from '../../engine/gameSettings';
import { sound } from '../../utils/soundEngine';

export type SettingsCategoryId =
  | 'GRAPHICS'
  | 'MAP'
  | 'AUDIO'
  | 'GAMEPLAY'
  | 'SHORTCUTS';

interface CategorizedSettingsPanelProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  audioExtraSlot?: React.ReactNode;
}

const CATEGORY_TABS: ReadonlyArray<{
  id: SettingsCategoryId;
  label: string;
  testId: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'GRAPHICS', label: 'Grafik', testId: 'settings-tab-graphics', icon: Cpu },
  { id: 'MAP', label: 'Harita', testId: 'settings-tab-map', icon: Map },
  { id: 'AUDIO', label: 'Ses', testId: 'settings-tab-audio', icon: Volume2 },
  { id: 'GAMEPLAY', label: 'Oynanış & AI', testId: 'settings-tab-gameplay', icon: Gamepad2 },
  { id: 'SHORTCUTS', label: 'Kısayollar', testId: 'settings-tab-shortcuts', icon: Keyboard },
];

const SHORTCUT_GROUPS: ReadonlyArray<
  'Zaman & Kamera' | 'Harita Modları' | 'Ordu & Yönetim'
> = ['Zaman & Kamera', 'Harita Modları', 'Ordu & Yönetim'];

export const CategorizedSettingsPanel: React.FC<CategorizedSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  soundEnabled: controlledSoundEnabled,
  onToggleSound,
  audioExtraSlot,
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>('GRAPHICS');
  const [localSoundEnabled, setLocalSoundEnabled] = useState<boolean>(() => sound.enabled);

  const isSoundEnabled =
    typeof controlledSoundEnabled === 'boolean'
      ? controlledSoundEnabled
      : localSoundEnabled;

  const handleToggleSound = () => {
    if (onToggleSound) {
      onToggleSound();
      return;
    }
    const next = !sound.enabled;
    sound.enabled = next;
    setLocalSoundEnabled(next);
    if (next) {
      sound.playClick();
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Tab Strip */}
      <div
        role="tablist"
        aria-label="Ayar kategorileri"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5"
      >
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={tab.testId}
              onClick={() => {
                sound.playClick();
                setActiveCategory(tab.id);
              }}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                  : 'bg-[#211d18] text-[#cfc3ae] border-[#3a3228] hover:border-[#7a5e2f] hover:text-[#f0e6d2]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. GRAPHICS & PERFORMANCE */}
      {activeCategory === 'GRAPHICS' && (
        <div className="space-y-4">
          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#e0bc78]">
                Harita Çözünürlüğü ve Grafik Kalitesi
              </h3>
              <p className="text-[11px] text-[#b2a58f] mt-0.5">
                Cihazınızın pil ömrüne veya ekran keskinliğine göre piksel ölçeğini belirleyin.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                const active = (settings.graphicsQuality || 'HIGH') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ graphicsQuality: opt.value });
                    }}
                    className={`min-h-[46px] p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54]/20 border-[#c89d54] text-[#f0e6d2]'
                        : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#e0bc78]">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[#b2a58f] mt-0.5 leading-snug">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <button
              type="button"
              aria-pressed={settings.smoothArmyAnimations ?? true}
              onClick={() => {
                sound.playClick();
                onUpdateSettings({
                  smoothArmyAnimations: !(settings.smoothArmyAnimations ?? true),
                });
              }}
              className={`w-full min-h-[50px] p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                (settings.smoothArmyAnimations ?? true)
                  ? 'bg-[#26211a] border-[#c89d54]/60 text-[#f0e6d2]'
                  : 'bg-[#1c1814] border-[#342d24] text-[#b2a58f]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#f0e6d2] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c89d54] shrink-0" />
                  <span>Akıcı Ordu ve Kuşatma Animasyonları (60 FPS)</span>
                </div>
                <div className="text-[11px] text-[#b2a58f] mt-0.5">
                  {(settings.smoothArmyAnimations ?? true)
                    ? 'Yürüyen ordular ve savaş efektleri yüksek kare hızında kesintisiz akar.'
                    : 'Enerji tasarrufu: Harita yalnızca veri değişiminde yenilenir.'}
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                  (settings.smoothArmyAnimations ?? true)
                    ? 'bg-[#c89d54] text-[#110f0d]'
                    : 'bg-[#2b251e] text-[#cfc3ae]'
                }`}
              >
                {(settings.smoothArmyAnimations ?? true) ? 'Açık' : 'Kapalı'}
              </span>
            </button>

            <div className="pt-2 border-t border-[#2a241d] space-y-2">
              <div>
                <div className="text-xs font-bold text-[#e0bc78]">
                  Arayüz (HUD) Ölçeği
                </div>
                <p className="text-[11px] text-[#b2a58f] mt-0.5">
                  Mobil veya masaüstü ekranınızda menü ve düğme boyutunu ayarlayın.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {UI_SCALE_OPTIONS.map((opt) => {
                  const active = (settings.uiScale || 'STANDARD') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      title={opt.desc}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSettings({ uiScale: opt.value });
                      }}
                      className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                          : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. MAP & APPEARANCE */}
      {activeCategory === 'MAP' && (
        <div className="space-y-4">
          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#e0bc78]">
                Sınır Çizgisi Kalınlığı
              </h3>
              <p className="text-[11px] text-[#b2a58f] mt-0.5">
                Ülke ve eyalet sınırlarının haritadaki vurgu kalınlığını özelleştirin.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BORDER_THICKNESS_OPTIONS.map((opt) => {
                const active = (settings.borderThickness || 'NORMAL') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    title={opt.desc}
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ borderThickness: opt.value });
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                        : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <div className="space-y-2">
              <div>
                <div className="text-xs font-bold text-[#e0bc78]">
                  Harita Yazı Boyutu
                </div>
                <p className="text-[11px] text-[#b2a58f] mt-0.5">
                  Başkent ve şehir isimlerinin kartografik yazı ölçeği.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MAP_LABEL_SCALE_OPTIONS.map((opt) => {
                  const active = (settings.mapLabelScale || 'NORMAL') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      title={opt.desc}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSettings({ mapLabelScale: opt.value });
                      }}
                      className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                          : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2a241d] space-y-2">
              <div>
                <div className="text-xs font-bold text-[#e0bc78]">
                  Şehir Etiketi Yoğunluğu
                </div>
                <p className="text-[11px] text-[#b2a58f] mt-0.5">
                  Eyalet isimlerinin hangi yakınlaştırma düzeyinde görüneceğini seçin.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MAP_LABEL_DENSITY_OPTIONS.map((opt) => {
                  const active = settings.mapLabelDensity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      title={opt.desc}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSettings({ mapLabelDensity: opt.value });
                      }}
                      className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                          : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2a241d]">
              <button
                type="button"
                aria-pressed={settings.fogOfWarEnabled}
                onClick={() => {
                  sound.playClick();
                  onUpdateSettings({ fogOfWarEnabled: !settings.fogOfWarEnabled });
                }}
                className={`w-full min-h-[50px] p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  settings.fogOfWarEnabled
                    ? 'bg-[#26211a] border-[#c89d54]/60 text-[#f0e6d2]'
                    : 'bg-[#1c1814] border-[#342d24] text-[#b2a58f]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#f0e6d2] flex items-center gap-1.5">
                    {settings.fogOfWarEnabled ? (
                      <Eye className="w-4 h-4 text-[#c89d54] shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-[#9e927d] shrink-0" />
                    )}
                    <span>Savaş Sisi (İstihbarat Sınırı)</span>
                  </div>
                  <div className="text-[11px] text-[#b2a58f] mt-0.5">
                    {settings.fogOfWarEnabled
                      ? 'Gerçekçi: Yalnızca sınır komşularının ve müttefiklerin orduları görünür.'
                      : 'Kapalı: Dünyadaki tüm devletlerin garnizonları açıkça görünür.'}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                    settings.fogOfWarEnabled
                      ? 'bg-[#c89d54] text-[#110f0d]'
                      : 'bg-[#2b251e] text-[#cfc3ae]'
                  }`}
                >
                  {settings.fogOfWarEnabled ? 'Açık' : 'Kapalı'}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 3. AUDIO & MUSIC */}
      {activeCategory === 'AUDIO' && (
        <div className="space-y-4">
        <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2a241d]">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#e0bc78]">
                Ses Kanalları ve Mehterhane Seviyesi
              </h3>
              <p className="text-[11px] text-[#b2a58f] mt-0.5">
                Ana ses, marş müziği ve savaş efektlerini ayrı ayrı dengeleyin.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSoundEnabled
                    ? 'bg-[#26211a] border-[#c89d54]/60 text-[#f0e6d2]'
                    : 'bg-[#1c1814] border-[#3a3228] text-[#9e927d]'
                }`}
              >
                {isSoundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#c89d54]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-[#9e927d]" />
                )}
                <span>{isSoundEnabled ? 'Efektler Açık' : 'Efektler Kapalı'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playTreaty();
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#211d18] hover:bg-[#2b251e] border border-[#c89d54]/40 text-xs font-semibold text-[#e0bc78] transition-colors cursor-pointer"
              >
                Efekt Testi
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Master Volume */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#f0e6d2]">Ana Ses Seviyesi</span>
                <span className="font-mono-num font-bold text-[#e0bc78]">
                  %{settings.masterVolume ?? 85}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                data-testid="slider-master-volume"
                value={settings.masterVolume ?? 85}
                onChange={(e) =>
                  onUpdateSettings({ masterVolume: Number(e.target.value) })
                }
                className="w-full h-2 rounded-lg appearance-none bg-[#2b251e] accent-[#c89d54] cursor-pointer"
              />
            </label>

            {/* Music Volume */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#f0e6d2]">Müzik ve Mehterhane</span>
                <span className="font-mono-num font-bold text-[#e0bc78]">
                  %{settings.musicVolume ?? 65}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                data-testid="slider-music-volume"
                value={settings.musicVolume ?? 65}
                onChange={(e) =>
                  onUpdateSettings({ musicVolume: Number(e.target.value) })
                }
                className="w-full h-2 rounded-lg appearance-none bg-[#2b251e] accent-[#c89d54] cursor-pointer"
              />
            </label>

            {/* SFX Volume */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#f0e6d2]">Savaş, Kuşatma ve Arayüz Efektleri</span>
                <span className="font-mono-num font-bold text-[#e0bc78]">
                  %{settings.sfxVolume ?? 80}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                data-testid="slider-sfx-volume"
                value={settings.sfxVolume ?? 80}
                onChange={(e) =>
                  onUpdateSettings({ sfxVolume: Number(e.target.value) })
                }
                className="w-full h-2 rounded-lg appearance-none bg-[#2b251e] accent-[#c89d54] cursor-pointer"
              />
            </label>
          </div>
        </section>
        {audioExtraSlot}
        </div>
      )}

      {/* 4. GAMEPLAY & AI */}
      {activeCategory === 'GAMEPLAY' && (
        <div className="space-y-4">
          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#e0bc78]">
                Yapay Zekâ Saldırganlığı
              </h3>
              <p className="text-[11px] text-[#b2a58f] mt-0.5">
                Komşu devletlerin savaş açma eğilimini ve seferberlik temposunu belirleyin.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AI_AGGRESSIVENESS_OPTIONS.map((opt) => {
                const active = settings.aiAggressiveness === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ aiAggressiveness: opt.value });
                    }}
                    className={`min-h-[46px] p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54]/20 border-[#c89d54] text-[#f0e6d2]'
                        : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#e0bc78]">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-[#b2a58f] mt-0.5 leading-snug">
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 sm:p-4 space-y-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#e0bc78]">
                Otomatik Teslimiyet (Kapitülasyon) Eşiği
              </h3>
              <p className="text-[11px] text-[#b2a58f] mt-0.5">
                Başkenti düşen bir devletin topraklarının yüzde kaçı işgal edildiğinde teslim olacağını belirleyin.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CAPITULATION_THRESHOLD_OPTIONS.map((opt) => {
                const active = (settings.capitulationThresholdPct ?? 75) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    title={opt.desc}
                    onClick={() => {
                      sound.playClick();
                      onUpdateSettings({ capitulationThresholdPct: opt.value });
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                        : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#2a241d] space-y-2">
              <div className="text-xs font-bold text-[#e0bc78]">
                Kabine Kriz ve Fırsat Olayları Sıklığı
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CRISIS_FREQUENCY_OPTIONS.map((opt) => {
                  const active = settings.crisisFrequencyDays === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSettings({ crisisFrequencyDays: opt.value });
                      }}
                      className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#c89d54] text-[#110f0d] border-[#e0bc78]'
                          : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2a241d] space-y-2">
              <div className="text-xs font-bold text-[#e0bc78]">
                Otomatik Kayıt (Auto-Save) Sıklığı
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AUTO_SAVE_OPTIONS.map((opt) => {
                  const active = settings.autoSaveIntervalDays === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      title={opt.desc}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSettings({ autoSaveIntervalDays: opt.value });
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#45825c]/30 border-[#66a67d] text-[#f0e6d2]'
                          : 'bg-[#1c1814] border-[#342d24] text-[#cfc3ae] hover:border-[#7a5e2f]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#e0bc78]">{opt.label}</div>
                      <div className="text-[10px] text-[#b2a58f] truncate">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 5. KEYBOARD SHORTCUTS */}
      {activeCategory === 'SHORTCUTS' && (
        <div className="space-y-3">
          {SHORTCUT_GROUPS.map((group) => {
            const entries = KEYBOARD_SHORTCUTS_LIST.filter(
              (item) => item.category === group
            );
            return (
              <section
                key={group}
                className="rounded-xl bg-[#13110e] border border-[#342d24] p-3.5 space-y-2"
              >
                <h3 className="text-xs font-bold text-[#e0bc78]">{group}</h3>
                <div className="divide-y divide-[#241f19]">
                  {entries.map((entry) => (
                    <div
                      key={entry.keys}
                      className="py-2 first:pt-0.5 last:pb-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-[#ded3bf]">{entry.action}</span>
                      <kbd className="px-2 py-1 rounded-md bg-[#231f1a] border border-[#c89d54]/40 font-mono-num text-[11px] font-bold text-[#e0bc78] whitespace-nowrap shrink-0">
                        {entry.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
