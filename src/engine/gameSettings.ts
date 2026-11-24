import { SpeedLevel } from '../types/game';

export type AutoSaveIntervalOption = 0 | 30 | 90 | 180 | 300 | 365;
export type AiAggressivenessLevel = 'PASSIVE' | 'NORMAL' | 'AGGRESSIVE' | 'CHAOS';
export type CrisisFrequencyOption = 0 | 32 | 60 | 90;
export type MapLabelDensityOption = 'COMPACT' | 'BALANCED' | 'DETAILED';
export type UiScaleOption = 'COMPACT' | 'STANDARD' | 'LARGE';
export type GraphicsQualityOption = 'LOW' | 'BALANCED' | 'HIGH';
export type BorderThicknessOption = 'THIN' | 'NORMAL' | 'BOLD';
export type MapLabelScaleOption = 'SMALL' | 'NORMAL' | 'LARGE';
export type CapitulationThresholdOption = 60 | 75 | 85 | 100;

export interface ClockSpeedProfile {
  speed: SpeedLevel;
  /** Real-time milliseconds between simulation steps */
  intervalMs: number;
  /** In-game hours advanced per simulation step */
  hoursStep: number;
  /** Short Turkish rate label for HUD */
  rateLabel: string;
}

export const CLOCK_SPEED_PROFILES: Record<SpeedLevel, ClockSpeedProfile> = {
  0: {
    speed: 0,
    intervalMs: 0,
    hoursStep: 0,
    rateLabel: 'DURAKLATILDI',
  },
  1: {
    speed: 1,
    intervalMs: 620,
    hoursStep: 1,
    rateLabel: 'HIZ: 1x (+1 Saat)',
  },
  2: {
    speed: 2,
    intervalMs: 450,
    hoursStep: 2,
    rateLabel: 'HIZ: 2x (+2 Saat)',
  },
  3: {
    speed: 3,
    intervalMs: 360,
    hoursStep: 3,
    rateLabel: 'HIZ: 3x (+3 Saat)',
  },
  4: {
    speed: 4,
    intervalMs: 295,
    hoursStep: 3,
    rateLabel: 'HIZ: 4x (+3 Saat)',
  },
  5: {
    speed: 5,
    intervalMs: 220,
    hoursStep: 4,
    rateLabel: 'HIZ: 5x (+4 Saat)',
  },
};

export function getClockSpeedProfile(speed: SpeedLevel): ClockSpeedProfile {
  return CLOCK_SPEED_PROFILES[speed] || CLOCK_SPEED_PROFILES[1];
}

export function getRealSecondsPerGameYear(speed: SpeedLevel): number {
  const profile = getClockSpeedProfile(speed);
  if (profile.intervalMs <= 0 || profile.hoursStep <= 0) return Infinity;
  const ticksPerDay = 24 / profile.hoursStep;
  const secondsPerDay = (ticksPerDay * profile.intervalMs) / 1000;
  return secondsPerDay * 365;
}

export const MAP_LABEL_DENSITY_OPTIONS: {
  value: MapLabelDensityOption;
  label: string;
  desc: string;
}[] = [
  {
    value: 'COMPACT',
    label: 'Kompakt',
    desc: 'Eyalet adları daha yakından görünür; haritada daha az metin kalır.',
  },
  {
    value: 'BALANCED',
    label: 'Dengeli',
    desc: 'Ülke, başkent ve eyalet adları önerilen yakınlaştırmada görünür.',
  },
  {
    value: 'DETAILED',
    label: 'Ayrıntılı',
    desc: 'Başkent ve eyalet adları daha uzaktan görünür.',
  },
];

export const GRAPHICS_QUALITY_OPTIONS: {
  value: GraphicsQualityOption;
  label: string;
  desc: string;
}[] = [
  {
    value: 'LOW',
    label: 'Pil Tasarrufu',
    desc: '1.0x piksel yoğunluğu — eski telefonlarda en yüksek akıcılık.',
  },
  {
    value: 'BALANCED',
    label: 'Dengeli',
    desc: '1.5x piksel yoğunluğu — keskin harita ve dengeli pil tüketimi.',
  },
  {
    value: 'HIGH',
    label: 'Yüksek (Retina)',
    desc: '2.0x+ tam çözünürlük — en keskin gravür sınırlar ve yazılar.',
  },
];

export const BORDER_THICKNESS_OPTIONS: {
  value: BorderThicknessOption;
  label: string;
  desc: string;
}[] = [
  { value: 'THIN', label: 'İnce', desc: 'Zarif, harita renklerini öne çıkaran sınırlar.' },
  { value: 'NORMAL', label: 'Standart', desc: 'Önerilen kartografik ülke ve sancak ayrımı.' },
  { value: 'BOLD', label: 'Kalın', desc: 'Yüksek kontrastlı, uzaktan kolay okunan sınırlar.' },
];

export const MAP_LABEL_SCALE_OPTIONS: {
  value: MapLabelScaleOption;
  label: string;
  desc: string;
}[] = [
  { value: 'SMALL', label: 'Küçük', desc: 'Geniş harita görüşü için daha narin şehir yazıları.' },
  { value: 'NORMAL', label: 'Standart', desc: 'Dengeli okunabilirlik.' },
  { value: 'LARGE', label: 'Büyük', desc: 'Mobil ekranlarda kolay okunan büyütülmüş yazılar.' },
];

export const CAPITULATION_THRESHOLD_OPTIONS: {
  value: CapitulationThresholdOption;
  label: string;
  desc: string;
}[] = [
  { value: 60, label: '%60 İşgal', desc: 'Hızlı seferler — rakipler daha erken teslim olur.' },
  { value: 75, label: '%75 İşgal', desc: 'Dengeli büyük strateji standardı (Önerilen).' },
  { value: 85, label: '%85 İşgal', desc: 'Zorlu direniş — neredeyse tam işgal gerekir.' },
  { value: 100, label: 'Sadece %100', desc: 'Tüm şehirler düşmeden otomatik teslimiyet olmaz.' },
];

export interface KeyboardShortcutEntry {
  keys: string;
  action: string;
  category: 'Zaman & Kamera' | 'Harita Modları' | 'Ordu & Yönetim';
}

export const KEYBOARD_SHORTCUTS_LIST: KeyboardShortcutEntry[] = [
  { keys: 'Boşluk', action: 'Oyunu duraklat / devam ettir', category: 'Zaman & Kamera' },
  { keys: '1 / 2 / 3 / 4 / 5', action: 'Oyun hızını 1x / 2x / 3x / 4x / 5x yap', category: 'Zaman & Kamera' },
  { keys: 'H veya Home', action: 'Kamerayı başkente odakla', category: 'Zaman & Kamera' },
  { keys: 'Esc', action: 'Aktif hareket emrini veya üst pencereyi kapat', category: 'Zaman & Kamera' },
  { keys: 'Q', action: 'Siyasi Harita modu', category: 'Harita Modları' },
  { keys: 'W', action: 'Ekonomi & Gelişim Haritası modu', category: 'Harita Modları' },
  { keys: 'E', action: 'Kaynaklar Haritası modu', category: 'Harita Modları' },
  { keys: 'R', action: 'Diplomasi Haritası modu', category: 'Harita Modları' },
  { keys: 'T', action: 'Arazi & İkmal Haritası modu', category: 'Harita Modları' },
  { keys: 'M', action: 'Seçili eyalette Hareket emrini başlat / iptal et', category: 'Ordu & Yönetim' },
  { keys: 'B', action: 'Toplu İşlem (Makro Ekonomi & Seferberlik) panelini aç', category: 'Ordu & Yönetim' },
];

export interface GameSettings {
  autoSaveIntervalDays: AutoSaveIntervalOption;
  fogOfWarEnabled: boolean;
  showZoomControls: boolean;
  aiAggressiveness: AiAggressivenessLevel;
  crisisFrequencyDays: CrisisFrequencyOption;
  mapLabelDensity: MapLabelDensityOption;
  uiScale: UiScaleOption;
  graphicsQuality: GraphicsQualityOption;
  smoothArmyAnimations: boolean;
  borderThickness: BorderThicknessOption;
  mapLabelScale: MapLabelScaleOption;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  capitulationThresholdPct: CapitulationThresholdOption;
}

const SETTINGS_STORAGE_KEY = 'IMPERIUM_2026_SETTINGS_V1';

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  autoSaveIntervalDays: 90,
  fogOfWarEnabled: true,
  showZoomControls: false,
  aiAggressiveness: 'NORMAL',
  crisisFrequencyDays: 90,
  mapLabelDensity: 'BALANCED',
  uiScale: 'STANDARD',
  graphicsQuality: 'HIGH',
  smoothArmyAnimations: true,
  borderThickness: 'NORMAL',
  mapLabelScale: 'NORMAL',
  masterVolume: 85,
  musicVolume: 65,
  sfxVolume: 80,
  capitulationThresholdPct: 75,
};

export function getBorderThicknessMultiplier(
  thickness?: BorderThicknessOption
): number {
  if (thickness === 'THIN') return 0.75;
  if (thickness === 'BOLD') return 1.35;
  return 1.0;
}

export function getMapLabelScaleMultiplier(
  scale?: MapLabelScaleOption
): number {
  if (scale === 'SMALL') return 0.86;
  if (scale === 'LARGE') return 1.16;
  return 1.0;
}

export function getGraphicsMaxDpr(quality?: GraphicsQualityOption): number {
  if (quality === 'LOW') return 1.0;
  if (quality === 'BALANCED') return 1.5;
  return 2.0;
}

export const UI_SCALE_OPTIONS: {
  value: UiScaleOption;
  label: string;
  desc: string;
}[] = [
  { value: 'COMPACT', label: 'Kompakt', desc: 'Küçük mobil ekranlar ve geniş harita görüşü için kompakt HUD' },
  { value: 'STANDARD', label: 'Standart', desc: 'Dengeli arayüz boyutu' },
  { value: 'LARGE', label: 'Büyük', desc: 'Dokunmatik kolaylığı için büyütülmüş butonlar ve yazılar' },
];

export const AUTO_SAVE_OPTIONS: {
  value: AutoSaveIntervalOption;
  label: string;
  desc: string;
}[] = [
  { value: 0, label: 'Kapalı', desc: 'Sadece manuel kayıt alınır' },
  { value: 30, label: '30 Gün', desc: 'Her oyun ayında bir otomatik kayıt' },
  { value: 90, label: '90 Gün', desc: 'Her 3 ayda bir otomatik kayıt (Önerilen)' },
  { value: 180, label: '180 Gün', desc: 'Her 6 ayda bir otomatik kayıt' },
  { value: 300, label: '300 Gün', desc: 'Her 300 günde bir seyrek otomatik kayıt' },
  { value: 365, label: '365 Gün', desc: 'Yılda bir kez otomatik kayıt' },
];

export const AI_AGGRESSIVENESS_OPTIONS: {
  value: AiAggressivenessLevel;
  label: string;
  desc: string;
}[] = [
  {
    value: 'PASSIVE',
    label: 'Barışçıl (Pasif)',
    desc: 'Yapay zeka nadiren savaş açar, ekonomi ve savunmaya odaklanır.',
  },
  {
    value: 'NORMAL',
    label: 'Dengeli (Normal)',
    desc: 'Gerçekçi diplomasi, fırsatçı sınır savaşları ve koalisyon dengesi.',
  },
  {
    value: 'AGGRESSIVE',
    label: 'Saldırgan (Zor)',
    desc: 'Büyük güçler hızla ordularını büyütür ve zayıf komşularını fetheder.',
  },
  {
    value: 'CHAOS',
    label: 'Kıyamet (Kaos)',
    desc: 'Sürekli küresel savaşlar, sert koalisyonlar ve yüksek AI seferberliği.',
  },
];

export const CRISIS_FREQUENCY_OPTIONS: {
  value: CrisisFrequencyOption;
  label: string;
}[] = [
  { value: 32, label: 'Normal (32 Gün)' },
  { value: 60, label: 'Orta (60 Gün)' },
  { value: 90, label: 'Seyrek (90 Gün)' },
  { value: 0, label: 'Kapalı (Manuel)' },
];

function clampPct(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...parsed,
      masterVolume: clampPct(parsed.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume),
      musicVolume: clampPct(parsed.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
      sfxVolume: clampPct(parsed.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume),
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}
