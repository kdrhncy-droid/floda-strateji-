// Offline Open-Source Orchestral Soundtrack (Battle for Wesnoth GPL/CC) + Ottoman Mehterhane Synthesizer & Custom MP3 Engine

export type MusicTrackId =
  | 'OSS_WESNOTH_KINGDOM'
  | 'OSS_WESNOTH_LOYALISTS'
  | 'OSS_WESNOTH_BATTLE_EPIC'
  | 'OSS_WESNOTH_REVELATION'
  | 'TR_MEHTER_CEDDIN'
  | 'TR_MEHTER_HUCUM'
  | 'TR_MEHTER_GENC_OSMAN'
  | 'TR_MEHTER_YELKENLER'
  | 'TR_MEHTER_ESTERGON'
  | 'TR_MECIYIYE_MARSI'
  | 'TR_OLUR_MU_BOYLE'
  | 'GLOBAL_STRATEGY_SYMPHONY'
  | 'CUSTOM_MP3';

export interface MusicTrackDefinition {
  id: MusicTrackId;
  title: string;
  subtitle: string;
  bpm: number;
  eraTag: string;
  isMehter?: boolean;
  audioUrl?: string;
}

export const MUSIC_TRACKS: MusicTrackDefinition[] = [
  {
    id: 'OSS_WESNOTH_KINGDOM',
    title: 'Krallık Divanı Senfonisi (Açık Kaynak Orkestra)',
    subtitle: 'Battle for Wesnoth — Ana Saltanat & Strateji Orkestra Kaydı (Çevrimdışı MP3)',
    bpm: 108,
    eraTag: 'Açık Kaynak Orkestra',
    audioUrl: '/assets/audio/music/wesnoth_main_menu.mp3',
  },
  {
    id: 'OSS_WESNOTH_LOYALISTS',
    title: 'İmparatorluk Muhafızları Marşı (Açık Kaynak Orkestra)',
    subtitle: 'Battle for Wesnoth — Loyalists Kraliyet Seferi Senfonisi (Çevrimdışı MP3)',
    bpm: 116,
    eraTag: 'Açık Kaynak Orkestra',
    audioUrl: '/assets/audio/music/wesnoth_loyalists.mp3',
  },
  {
    id: 'OSS_WESNOTH_BATTLE_EPIC',
    title: 'Büyük Meydan Muharebesi (Açık Kaynak Orkestra)',
    subtitle: 'Battle for Wesnoth — Battle Epic Savaş & Kuşatma Senfonisi (Çevrimdışı MP3)',
    bpm: 128,
    eraTag: 'Açık Kaynak Orkestra',
    audioUrl: '/assets/audio/music/wesnoth_battle_epic.mp3',
  },
  {
    id: 'OSS_WESNOTH_REVELATION',
    title: 'Keşif ve Diplomasi Prelüdü (Açık Kaynak Orkestra)',
    subtitle: 'Battle for Wesnoth — Revelation Tarihi Harita & Diplomasi Teması (Çevrimdışı MP3)',
    bpm: 96,
    eraTag: 'Açık Kaynak Orkestra',
    audioUrl: '/assets/audio/music/wesnoth_revelation.mp3',
  },
  {
    id: 'TR_MEHTER_CEDDIN',
    title: 'Ceddin Deden, Neslin Baban',
    subtitle: 'Orijinal Osmanlı Mehter Marşı (Zurna, Kös & Çevgan Sentezi)',
    bpm: 112,
    eraTag: 'Mehterhane-i Hümayun',
    isMehter: true,
  },
  {
    id: 'TR_MEHTER_HUCUM',
    title: 'Tarihi Mehter Hücum Marşı',
    subtitle: 'Devlet-i Aliyye Meydan Muharebesi & Taarruz Marşı',
    bpm: 124,
    eraTag: 'Sefer-i Hümayun',
    isMehter: true,
  },
  {
    id: 'TR_MEHTER_GENC_OSMAN',
    title: 'Genç Osman Marşı',
    subtitle: 'Bıyığında Tarak Durmaz, Allah Allah Deyip Geçer Genç Osman',
    bpm: 118,
    eraTag: 'Bağdat Seferi (1638)',
    isMehter: true,
  },
  {
    id: 'TR_MEHTER_YELKENLER',
    title: 'Yelkenler Biçilecek (Fetih Marşı)',
    subtitle: 'Fatih\'in İstanbul\'u Fethi & Donanma-yı Hümayun Marşı',
    bpm: 114,
    eraTag: 'Fetih 1453',
    isMehter: true,
  },
  {
    id: 'TR_MEHTER_ESTERGON',
    title: 'Estergon Kalesi',
    subtitle: 'Estergon Kalesi Su Başı Durak — Tarihi Serhat & Kuşatma Marşı',
    bpm: 102,
    eraTag: 'Rumeli Serhaddi',
    isMehter: true,
  },
  {
    id: 'TR_MECIYIYE_MARSI',
    title: 'Mecidiye Marşı (1844)',
    subtitle: 'Osmanlı İmparatorluğu Resmi Saltanat & Bando Marşı',
    bpm: 116,
    eraTag: 'Mızıka-yı Hümayun',
    isMehter: false,
  },
  {
    id: 'TR_OLUR_MU_BOYLE',
    title: 'Olur mu Böyle Olur mu',
    subtitle: 'Kardeş Kardeşi Vurur mu (Marş Versiyonu)',
    bpm: 116,
    eraTag: 'Ulusal Marş',
    isMehter: false,
  },
  {
    id: 'GLOBAL_STRATEGY_SYMPHONY',
    title: 'Imperium Strateji Senfonisi',
    subtitle: 'Evrensel Komuta Odası & Diplomasi Teması',
    bpm: 104,
    eraTag: 'Senfoni',
    isMehter: false,
  },
];

// Standard equal-tempered note frequencies (Hz)
const N: Record<string, number> = {
  REST: 0,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  Cs4: 277.18,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  Gs4: 415.3,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  Cs5: 554.37,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
};

interface NoteStep {
  note: string;
  beats: number;
  bass?: string;
  drum?: 'KICK' | 'SNARE' | 'BOTH' | 'CEVGAN';
}

// 1. Ceddin Deden, Neslin Baban (Authentic Hüseyni / Rast Mehter Transcription)
const MEHTER_CEDDIN_SCORE: NoteStep[] = [
  // "Ced-din de-den, nes-lin ba-ban!"
  { note: 'A4', beats: 1, bass: 'A3', drum: 'CEVGAN' },
  { note: 'B4', beats: 0.5, bass: 'A3', drum: 'SNARE' },
  { note: 'C5', beats: 0.5, bass: 'A3' },
  { note: 'D5', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'C5', beats: 1, bass: 'C4', drum: 'SNARE' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'Gs4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'CEVGAN' },

  // "Hep kah-ra-man Türk mil-le-ti!"
  { note: 'E5', beats: 1.5, bass: 'C4', drum: 'CEVGAN' },
  { note: 'D5', beats: 0.5, bass: 'B3', drum: 'SNARE' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'SNARE' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'C4', drum: 'SNARE' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'CEVGAN' },

  // "Or-du-la-rın, pek çok za-man / Ver-di dün-ya-ya şan!"
  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'D5', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'E5', beats: 1, bass: 'C4', drum: 'CEVGAN' },
  { note: 'F5', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'E5', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'D5', beats: 1, bass: 'B3', drum: 'SNARE' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'SNARE' },
  { note: 'A4', beats: 1.5, bass: 'A3', drum: 'CEVGAN' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 2. Tarihi Mehter Hücum Marşı (High-energy Charge Rhythm with Kös & Çevgan crashes)
const MEHTER_HUCUM_SCORE: NoteStep[] = [
  { note: 'A4', beats: 0.75, bass: 'A3', drum: 'CEVGAN' },
  { note: 'A4', beats: 0.25, bass: 'A3', drum: 'SNARE' },
  { note: 'D5', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'D5', beats: 0.75, bass: 'D4', drum: 'CEVGAN' },
  { note: 'E5', beats: 0.25, bass: 'C4', drum: 'SNARE' },
  { note: 'F5', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'E5', beats: 0.5, bass: 'C4', drum: 'SNARE' },
  { note: 'D5', beats: 0.5, bass: 'B3', drum: 'KICK' },
  { note: 'Cs5', beats: 1, bass: 'A3', drum: 'CEVGAN' },
  { note: 'D5', beats: 1, bass: 'D4', drum: 'BOTH' },

  { note: 'E5', beats: 1, bass: 'A3', drum: 'CEVGAN' },
  { note: 'F5', beats: 0.5, bass: 'D4', drum: 'SNARE' },
  { note: 'G5', beats: 0.5, bass: 'C4', drum: 'KICK' },
  { note: 'F5', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'E5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'D5', beats: 1, bass: 'Bb3', drum: 'SNARE' },
  { note: 'Cs5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'D5', beats: 1.5, bass: 'D4', drum: 'CEVGAN' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 3. Genç Osman Marşı
const MEHTER_GENC_OSMAN_SCORE: NoteStep[] = [
  { note: 'D4', beats: 0.5, bass: 'D4', drum: 'KICK' },
  { note: 'G4', beats: 1, bass: 'G3', drum: 'CEVGAN' },
  { note: 'G4', beats: 0.5, bass: 'G3', drum: 'SNARE' },
  { note: 'A4', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'Bb4', beats: 1, bass: 'G3', drum: 'SNARE' },
  { note: 'C5', beats: 1, bass: 'C4', drum: 'CEVGAN' },
  { note: 'Bb4', beats: 0.5, bass: 'G3', drum: 'SNARE' },
  { note: 'A4', beats: 0.5, bass: 'D4' },
  { note: 'G4', beats: 1.5, bass: 'G3', drum: 'BOTH' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },

  { note: 'D5', beats: 1, bass: 'G3', drum: 'CEVGAN' },
  { note: 'C5', beats: 1, bass: 'C4', drum: 'SNARE' },
  { note: 'Bb4', beats: 1, bass: 'G3', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'Bb4', beats: 1, bass: 'G3', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'Fs4', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'G4', beats: 1.5, bass: 'G3', drum: 'CEVGAN' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 4. Yelkenler Biçilecek (Fetih Marşı)
const MEHTER_YELKENLER_SCORE: NoteStep[] = [
  { note: 'E4', beats: 1, bass: 'A3', drum: 'CEVGAN' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'D5', beats: 1.5, bass: 'D4', drum: 'CEVGAN' },
  { note: 'C5', beats: 0.5, bass: 'C4', drum: 'SNARE' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'BOTH' },

  { note: 'E5', beats: 1, bass: 'C4', drum: 'CEVGAN' },
  { note: 'E5', beats: 1, bass: 'C4', drum: 'SNARE' },
  { note: 'D5', beats: 1, bass: 'B3', drum: 'KICK' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'Gs4', beats: 1, bass: 'E4', drum: 'KICK' },
  { note: 'A4', beats: 1.5, bass: 'A3', drum: 'CEVGAN' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 5. Estergon Kalesi
const MEHTER_ESTERGON_SCORE: NoteStep[] = [
  { note: 'A4', beats: 1.5, bass: 'D4', drum: 'CEVGAN' },
  { note: 'Bb4', beats: 0.5, bass: 'D4', drum: 'SNARE' },
  { note: 'A4', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'G4', beats: 1, bass: 'G3', drum: 'SNARE' },
  { note: 'F4', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'E4', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'D4', beats: 1.5, bass: 'D4', drum: 'CEVGAN' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },

  { note: 'G4', beats: 1, bass: 'G3', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'Bb4', beats: 1, bass: 'G3', drum: 'CEVGAN' },
  { note: 'G4', beats: 1, bass: 'C4', drum: 'SNARE' },
  { note: 'F4', beats: 1, bass: 'D4', drum: 'KICK' },
  { note: 'E4', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'D4', beats: 2, bass: 'D4', drum: 'CEVGAN' },
];

// 6. Mecidiye Marşı (1844 Imperial Ottoman Anthem)
const MECIDIYE_SCORE: NoteStep[] = [
  { note: 'C5', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'G4', beats: 0.5, bass: 'C4', drum: 'SNARE' },
  { note: 'G4', beats: 0.5, bass: 'C4' },
  { note: 'A4', beats: 1, bass: 'F4', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'G3', drum: 'SNARE' },
  { note: 'C5', beats: 1.5, bass: 'C4', drum: 'CEVGAN' },
  { note: 'D5', beats: 0.5, bass: 'B3', drum: 'SNARE' },
  { note: 'E5', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'D5', beats: 1, bass: 'G3', drum: 'SNARE' },
  { note: 'C5', beats: 1.5, bass: 'C4', drum: 'BOTH' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 7. Olur mu böyle olur mu / Kardeş kardeşi vurur mu
const OLUR_MU_BOYLE_SCORE: NoteStep[] = [
  { note: 'E4', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'A4', beats: 1, bass: 'A3', drum: 'SNARE' },
  { note: 'A4', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'B3', drum: 'SNARE' },
  { note: 'C5', beats: 1.5, bass: 'A3', drum: 'KICK' },
  { note: 'B4', beats: 0.5, bass: 'A3', drum: 'SNARE' },
  { note: 'A4', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'SNARE' },

  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'D5', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'E5', beats: 1.5, bass: 'C4', drum: 'KICK' },
  { note: 'D5', beats: 0.5, bass: 'B3', drum: 'SNARE' },
  { note: 'C5', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'B4', beats: 1, bass: 'E4', drum: 'SNARE' },
  { note: 'A4', beats: 1.5, bass: 'A3', drum: 'BOTH' },
  { note: 'REST', beats: 0.5, drum: 'SNARE' },
];

// 8. Imperium Strategy Symphony
const STRATEGY_SYMPHONY_SCORE: NoteStep[] = [
  { note: 'D4', beats: 1.5, bass: 'A3', drum: 'KICK' },
  { note: 'F4', beats: 0.5, bass: 'A3' },
  { note: 'A4', beats: 2, bass: 'D4', drum: 'SNARE' },
  { note: 'G4', beats: 1.5, bass: 'C4', drum: 'KICK' },
  { note: 'F4', beats: 0.5, bass: 'C4' },
  { note: 'E4', beats: 2, bass: 'A3', drum: 'SNARE' },
  { note: 'D4', beats: 1.5, bass: 'A3', drum: 'KICK' },
  { note: 'A4', beats: 0.5, bass: 'D4' },
  { note: 'Bb4', beats: 1, bass: 'D4', drum: 'SNARE' },
  { note: 'A4', beats: 1, bass: 'C4', drum: 'KICK' },
  { note: 'G4', beats: 1, bass: 'B3', drum: 'SNARE' },
  { note: 'E4', beats: 1, bass: 'A3', drum: 'KICK' },
  { note: 'D4', beats: 2, bass: 'A3', drum: 'BOTH' },
];

class NationalMusicEngine {
  private ctx: AudioContext | null = null;
  private isPlayingState: boolean = false;
  private currentTrack: MusicTrackId = 'OSS_WESNOTH_KINGDOM';
  private customTrackName: string = 'Özel Marş (MP3)';
  private customAudioEl: HTMLAudioElement | null = null;
  private customObjectUrl: string | null = null;
  private bundledAudioEl: HTMLAudioElement | null = null;
  private bundledAudioSrc: string | null = null;
  private stepIndex: number = 0;
  private timerId: number | null = null;
  private listeners: Set<() => void> = new Set();

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public get isPlaying(): boolean {
    return this.isPlayingState;
  }

  public get activeTrackId(): MusicTrackId {
    return this.currentTrack;
  }

  public get activeTrackTitle(): string {
    if (this.currentTrack === 'CUSTOM_MP3') {
      return this.customTrackName;
    }
    return (
      MUSIC_TRACKS.find((t) => t.id === this.currentTrack)?.title ||
      'Krallık Divanı Senfonisi (Açık Kaynak Orkestra)'
    );
  }

  private masterGain: GainNode | null = null;
  private musicVolumeScale: number = 0.55;

  public setVolumes(masterPct: number, musicPct: number) {
    const m = Math.max(0, Math.min(100, masterPct)) / 100;
    const mu = Math.max(0, Math.min(100, musicPct)) / 100;
    this.musicVolumeScale = m * mu;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.musicVolumeScale,
        this.ctx.currentTime,
        0.03
      );
    }
    const clampedVol = Math.max(0, Math.min(1, this.musicVolumeScale));
    if (this.customAudioEl) {
      this.customAudioEl.volume = clampedVol;
    }
    if (this.bundledAudioEl) {
      this.bundledAudioEl.volume = clampedVol;
    }
  }

  private getOutputNode(): AudioNode | null {
    if (!this.ctx) return null;
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.musicVolumeScale,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);
    }
    return this.masterGain;
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.getOutputNode();
  }

  public selectDefaultTrackForNation(_nationId: string) {
    if (this.currentTrack === 'CUSTOM_MP3') return;
    if (!MUSIC_TRACKS.some((t) => t.id === this.currentTrack)) {
      this.currentTrack = 'OSS_WESNOTH_KINGDOM';
    }
    this.notify();
  }

  public loadCustomMp3File(file: File) {
    this.stop();
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
    }
    this.customObjectUrl = URL.createObjectURL(file);
    this.customTrackName = file.name.replace(/\.[^/.]+$/, '');
    this.customAudioEl = new Audio(this.customObjectUrl);
    this.customAudioEl.loop = true;
    this.customAudioEl.volume = Math.max(0, Math.min(1, this.musicVolumeScale));
    this.currentTrack = 'CUSTOM_MP3';
    this.play();
  }

  public setTrack(trackId: MusicTrackId) {
    const wasPlaying = this.isPlayingState;
    this.stop();
    this.currentTrack = trackId;
    this.stepIndex = 0;
    if (wasPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public nextTrack() {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.currentTrack);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    this.setTrack(next.id);
    if (!this.isPlayingState) {
      this.play();
    }
  }

  public toggle() {
    if (this.isPlayingState) {
      this.stop();
    } else {
      this.play();
    }
  }

  public play() {
    if (this.isPlayingState) return;
    this.isPlayingState = true;

    if (this.currentTrack === 'CUSTOM_MP3' && this.customAudioEl) {
      this.customAudioEl.play().catch(() => {
        this.isPlayingState = false;
        this.notify();
      });
      this.notify();
      return;
    }

    const activeDef = MUSIC_TRACKS.find((t) => t.id === this.currentTrack);
    if (activeDef?.audioUrl && typeof Audio !== 'undefined') {
      if (!this.bundledAudioEl || this.bundledAudioSrc !== activeDef.audioUrl) {
        if (this.bundledAudioEl) {
          this.bundledAudioEl.pause();
        }
        this.bundledAudioEl = new Audio(activeDef.audioUrl);
        this.bundledAudioEl.loop = true;
        this.bundledAudioSrc = activeDef.audioUrl;
      }
      this.bundledAudioEl.volume = Math.max(
        0,
        Math.min(1, this.musicVolumeScale)
      );
      this.bundledAudioEl.play().catch(() => {
        // Fallback to Web Audio synth if autoplay or audio decoding fails
        this.initContext();
        this.stepIndex = 0;
        this.scheduleNextNote();
      });
      this.notify();
      return;
    }

    this.initContext();
    this.stepIndex = 0;
    this.scheduleNextNote();
    this.notify();
  }

  public stop() {
    this.isPlayingState = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }
    if (this.bundledAudioEl) {
      this.bundledAudioEl.pause();
    }
    this.notify();
  }

  private getScore(): { score: NoteStep[]; bpm: number; isMehter: boolean } {
    switch (this.currentTrack) {
      case 'TR_MEHTER_CEDDIN':
        return { score: MEHTER_CEDDIN_SCORE, bpm: 112, isMehter: true };
      case 'TR_MEHTER_HUCUM':
        return { score: MEHTER_HUCUM_SCORE, bpm: 124, isMehter: true };
      case 'TR_MEHTER_GENC_OSMAN':
        return { score: MEHTER_GENC_OSMAN_SCORE, bpm: 118, isMehter: true };
      case 'TR_MEHTER_YELKENLER':
        return { score: MEHTER_YELKENLER_SCORE, bpm: 114, isMehter: true };
      case 'TR_MEHTER_ESTERGON':
        return { score: MEHTER_ESTERGON_SCORE, bpm: 102, isMehter: true };
      case 'TR_MECIYIYE_MARSI':
        return { score: MECIDIYE_SCORE, bpm: 116, isMehter: false };
      case 'GLOBAL_STRATEGY_SYMPHONY':
        return { score: STRATEGY_SYMPHONY_SCORE, bpm: 104, isMehter: false };
      case 'TR_OLUR_MU_BOYLE':
      default:
        return { score: OLUR_MU_BOYLE_SCORE, bpm: 116, isMehter: false };
    }
  }

  private scheduleNextNote() {
    if (!this.isPlayingState || !this.ctx) return;

    const { score, bpm, isMehter } = this.getScore();
    const step = score[this.stepIndex % score.length];
    this.stepIndex = (this.stepIndex + 1) % score.length;

    const beatDurationSec = 60 / bpm;
    const stepDurationSec = step.beats * beatDurationSec;
    const now = this.ctx.currentTime;

    const outNode = this.getOutputNode() || this.ctx.destination;

    // 1. Lead Mehter Zurna / Brass Voice (warm lowpass-shaped acoustic reed & horn)
    const freq = N[step.note] || 0;
    if (freq > 0) {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = isMehter ? 'sawtooth' : 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * (isMehter ? 1.003 : 1.002), now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isMehter ? 920 : 1080, now);
      filter.Q.setValueAtTime(isMehter ? 0.9 : 0.7, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isMehter ? 0.068 : 0.062, now + 0.032);
      gain.gain.exponentialRampToValueAtTime(
        0.0008,
        now + Math.max(0.09, stepDurationSec * 0.94)
      );

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(outNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + stepDurationSec);
      osc2.stop(now + stepDurationSec);
    }

    // 2. Boru / Bass Harmony Voice
    const bassFreq = step.bass ? N[step.bass] || 0 : 0;
    if (bassFreq > 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bassFreq * 0.5, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(420, now);

      bassGain.gain.setValueAtTime(0.001, now);
      bassGain.gain.linearRampToValueAtTime(0.065, now + 0.025);
      bassGain.gain.exponentialRampToValueAtTime(
        0.0008,
        now + Math.max(0.09, stepDurationSec * 0.88)
      );

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(outNode);
      bassOsc.start(now);
      bassOsc.stop(now + stepDurationSec);
    }

    // 3. Imperial Kös (Deep Kettle Drum), Nakkaare & Çevgan (Zil / Cymbal)
    if (
      step.drum === 'KICK' ||
      step.drum === 'BOTH' ||
      step.drum === 'CEVGAN'
    ) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(108, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.16);

      kickGain.gain.setValueAtTime(0.095, now);
      kickGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);

      kickOsc.connect(kickGain);
      kickGain.connect(outNode);
      kickOsc.start(now);
      kickOsc.stop(now + 0.18);
    }

    if (step.drum === 'SNARE' || step.drum === 'BOTH') {
      const snareOsc = this.ctx.createOscillator();
      const snareFilter = this.ctx.createBiquadFilter();
      const snareGain = this.ctx.createGain();
      snareOsc.type = 'triangle';
      snareOsc.frequency.setValueAtTime(195, now);
      snareOsc.frequency.exponentialRampToValueAtTime(84, now + 0.065);

      snareFilter.type = 'lowpass';
      snareFilter.frequency.setValueAtTime(520, now);

      snareGain.gain.setValueAtTime(0.036, now);
      snareGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);

      snareOsc.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(outNode);
      snareOsc.start(now);
      snareOsc.stop(now + 0.08);
    }

    if (step.drum === 'CEVGAN') {
      // Soft Bronze Bell / Çevgan Chime
      const zilOsc = this.ctx.createOscillator();
      const zilFilter = this.ctx.createBiquadFilter();
      const zilGain = this.ctx.createGain();
      zilOsc.type = 'triangle';
      zilOsc.frequency.setValueAtTime(1240, now);
      zilFilter.type = 'bandpass';
      zilFilter.frequency.setValueAtTime(1180, now);
      zilFilter.Q.setValueAtTime(1.2, now);

      zilGain.gain.setValueAtTime(0.018, now);
      zilGain.gain.exponentialRampToValueAtTime(0.0006, now + 0.13);

      zilOsc.connect(zilFilter);
      zilFilter.connect(zilGain);
      zilGain.connect(outNode);
      zilOsc.start(now);
      zilOsc.stop(now + 0.14);
    }

    this.timerId = window.setTimeout(() => {
      this.scheduleNextNote();
    }, stepDurationSec * 1000);
  }
}

export const music = new NationalMusicEngine();
