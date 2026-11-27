// Offline Open-Source Orchestral Soundtrack (Battle for Wesnoth GPL/CC) & Custom MP3 Player
// Includes dynamic peace/war mood transitions with smooth crossfade volume curves.

import { GameModeId, GameScreenState } from '../types/game';

export type MusicTrackId =
  | 'OSS_WESNOTH_KINGDOM'
  | 'OSS_WESNOTH_LOYALISTS'
  | 'OSS_WESNOTH_BATTLE_EPIC'
  | 'OSS_WESNOTH_REVELATION'
  | 'CUSTOM_MP3';

export type MusicMood = 'PEACE' | 'WAR';

export interface MusicTrackDefinition {
  id: Exclude<MusicTrackId, 'CUSTOM_MP3'>;
  title: string;
  subtitle: string;
  bpm: number;
  eraTag: string;
  mood: MusicMood;
  audioUrl: string;
}

export const MUSIC_TRACKS: MusicTrackDefinition[] = [
  {
    id: 'OSS_WESNOTH_KINGDOM',
    title: 'Krallık Divanı Senfonisi',
    subtitle: 'Ana Saltanat ve Strateji Orkestra Kaydı (Çevrimdışı MP3)',
    bpm: 108,
    eraTag: 'Barış · Orkestra',
    mood: 'PEACE',
    audioUrl: '/assets/audio/music/wesnoth_main_menu.mp3',
  },
  {
    id: 'OSS_WESNOTH_LOYALISTS',
    title: 'İmparatorluk Muhafızları Marşı',
    subtitle: 'Kraliyet Seferi Orkestra Kaydı (Çevrimdışı MP3)',
    bpm: 116,
    eraTag: 'Barış · Sefer',
    mood: 'PEACE',
    audioUrl: '/assets/audio/music/wesnoth_loyalists.mp3',
  },
  {
    id: 'OSS_WESNOTH_BATTLE_EPIC',
    title: 'Büyük Meydan Muharebesi',
    subtitle: 'Savaş ve Kuşatma Senfonisi (Çevrimdışı MP3)',
    bpm: 128,
    eraTag: 'Savaş · Destansı',
    mood: 'WAR',
    audioUrl: '/assets/audio/music/wesnoth_battle_epic.mp3',
  },
  {
    id: 'OSS_WESNOTH_REVELATION',
    title: 'Keşif ve Diplomasi Prelüdü',
    subtitle: 'Tarihi Harita ve Diplomasi Teması (Çevrimdışı MP3)',
    bpm: 96,
    eraTag: 'Barış · Diplomasi',
    mood: 'PEACE',
    audioUrl: '/assets/audio/music/wesnoth_revelation.mp3',
  },
];

export interface DynamicMoodResolutionInput {
  isAtWar: boolean;
  gameMode: GameModeId;
  screenState?: GameScreenState;
  currentTrackId: MusicTrackId;
  dynamicEnabled: boolean;
  manualOverrideMood: MusicMood | null;
}

/**
 * Pure resolver determining which orchestral track fits the current campaign state
 * while honoring custom MP3 uploads and per-mood manual track overrides.
 */
export function resolveDynamicMoodTrack(
  params: DynamicMoodResolutionInput
): MusicTrackId {
  const {
    isAtWar,
    gameMode,
    screenState = 'PLAYING',
    currentTrackId,
    dynamicEnabled,
    manualOverrideMood,
  } = params;

  if (currentTrackId === 'CUSTOM_MP3') return 'CUSTOM_MP3';
  if (!dynamicEnabled) return currentTrackId;

  if (screenState === 'TITLE_MENU') {
    if (manualOverrideMood === 'PEACE') return currentTrackId;
    return 'OSS_WESNOTH_KINGDOM';
  }

  const desiredMood: MusicMood = isAtWar ? 'WAR' : 'PEACE';
  if (manualOverrideMood === desiredMood) {
    return currentTrackId;
  }

  if (desiredMood === 'WAR') {
    return 'OSS_WESNOTH_BATTLE_EPIC';
  }

  // Keep peaceful diplomacy theme if already listening to it in peacetime
  if (currentTrackId === 'OSS_WESNOTH_REVELATION') {
    return currentTrackId;
  }

  return gameMode === 'EMPIRES_1440'
    ? 'OSS_WESNOTH_LOYALISTS'
    : 'OSS_WESNOTH_KINGDOM';
}

class NationalMusicEngine {
  private isPlayingState: boolean = false;
  private currentTrack: MusicTrackId = 'OSS_WESNOTH_KINGDOM';
  private customTrackName: string = 'Özel Müzik (MP3)';
  private customAudioEl: HTMLAudioElement | null = null;
  private customObjectUrl: string | null = null;
  private bundledAudioEl: HTMLAudioElement | null = null;
  private bundledAudioSrc: string | null = null;
  private musicVolumeScale: number = 0.55;
  private dynamicMoodEnabledState: boolean = true;
  private activeMoodState: MusicMood = 'PEACE';
  private manualOverrideMood: MusicMood | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<() => void> = new Set();

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private clearFadeTimer() {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private rampElementVolume(
    el: HTMLAudioElement,
    fromVol: number,
    toVol: number,
    durationMs: number,
    onDone?: () => void
  ) {
    this.clearFadeTimer();
    const clampedFrom = Math.max(0, Math.min(1, fromVol));
    const clampedTo = Math.max(0, Math.min(1, toVol));
    el.volume = clampedFrom;

    if (durationMs <= 0 || typeof setInterval !== 'function' || Math.abs(clampedTo - clampedFrom) < 0.01) {
      el.volume = clampedTo;
      onDone?.();
      return;
    }

    const steps = 10;
    const stepMs = Math.max(25, Math.round(durationMs / steps));
    let step = 0;
    this.fadeTimer = setInterval(() => {
      step += 1;
      const ratio = Math.min(1, step / steps);
      el.volume = Math.max(
        0,
        Math.min(1, clampedFrom + (clampedTo - clampedFrom) * ratio)
      );
      if (step >= steps) {
        this.clearFadeTimer();
        el.volume = clampedTo;
        onDone?.();
      }
    }, stepMs);
  }

  public get isPlaying(): boolean {
    return this.isPlayingState;
  }

  public get activeTrackId(): MusicTrackId {
    return this.currentTrack;
  }

  public get activeMood(): MusicMood {
    return this.activeMoodState;
  }

  public get dynamicMoodEnabled(): boolean {
    return this.dynamicMoodEnabledState;
  }

  public get activeTrackTitle(): string {
    if (this.currentTrack === 'CUSTOM_MP3') {
      return this.customTrackName;
    }
    return (
      MUSIC_TRACKS.find((t) => t.id === this.currentTrack)?.title ||
      MUSIC_TRACKS[0].title
    );
  }

  public setDynamicMoodEnabled(enabled: boolean) {
    if (this.dynamicMoodEnabledState === enabled) return;
    this.dynamicMoodEnabledState = enabled;
    if (enabled) {
      this.manualOverrideMood = null;
    }
    this.notify();
  }

  public setVolumes(masterPct: number, musicPct: number) {
    const m = Math.max(0, Math.min(100, masterPct)) / 100;
    const mu = Math.max(0, Math.min(100, musicPct)) / 100;
    this.musicVolumeScale = Math.max(0, Math.min(1, m * mu));
    this.clearFadeTimer();
    if (this.customAudioEl) {
      this.customAudioEl.volume = this.musicVolumeScale;
    }
    if (this.bundledAudioEl) {
      this.bundledAudioEl.volume = this.musicVolumeScale;
    }
  }

  public selectDefaultTrackForNation(_nationId: string) {
    if (this.currentTrack === 'CUSTOM_MP3') return;
    if (!MUSIC_TRACKS.some((t) => t.id === this.currentTrack)) {
      this.currentTrack = 'OSS_WESNOTH_KINGDOM';
    }
    this.notify();
  }

  public syncCampaignMood(params: {
    isAtWar: boolean;
    gameMode: GameModeId;
    screenState?: GameScreenState;
  }) {
    const nextMood: MusicMood =
      params.screenState !== 'TITLE_MENU' && params.isAtWar ? 'WAR' : 'PEACE';
    const moodChanged = nextMood !== this.activeMoodState;
    this.activeMoodState = nextMood;

    // Reset previous manual override once war/peace state legitimately shifts
    if (moodChanged && this.manualOverrideMood !== nextMood) {
      this.manualOverrideMood = null;
    }

    const nextTrack = resolveDynamicMoodTrack({
      isAtWar: params.isAtWar,
      gameMode: params.gameMode,
      screenState: params.screenState,
      currentTrackId: this.currentTrack,
      dynamicEnabled: this.dynamicMoodEnabledState,
      manualOverrideMood: this.manualOverrideMood,
    });

    if (nextTrack !== this.currentTrack) {
      this.crossfadeToTrack(nextTrack);
    } else if (moodChanged) {
      this.notify();
    }
  }

  private crossfadeToTrack(nextTrack: MusicTrackId) {
    if (!this.isPlayingState || !this.bundledAudioEl || typeof Audio === 'undefined') {
      this.setTrack(nextTrack, false);
      return;
    }

    const oldEl = this.bundledAudioEl;
    const startVol = oldEl.volume;
    this.rampElementVolume(oldEl, startVol, 0.02, 420, () => {
      oldEl.pause();
      this.currentTrack = nextTrack;
      const activeDef =
        MUSIC_TRACKS.find((t) => t.id === this.currentTrack) || MUSIC_TRACKS[0];
      if (!activeDef?.audioUrl) {
        this.notify();
        return;
      }
      if (this.bundledAudioSrc !== activeDef.audioUrl) {
        oldEl.onended = null;
        const freshEl = new Audio(activeDef.audioUrl);
        freshEl.loop = false;
        freshEl.onended = () => {
          if (this.isPlayingState && this.currentTrack !== 'CUSTOM_MP3') {
            this.nextTrack();
          }
        };
        this.bundledAudioEl = freshEl;
        this.bundledAudioSrc = activeDef.audioUrl;
      }
      const targetEl = this.bundledAudioEl;
      if (!targetEl) {
        this.notify();
        return;
      }
      targetEl.volume = 0.02;
      targetEl
        .play()
        .then(() => {
          this.rampElementVolume(targetEl, 0.02, this.musicVolumeScale, 520);
        })
        .catch(() => {
          this.isPlayingState = false;
          this.notify();
        });
      this.notify();
    });
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
    this.customAudioEl.volume = this.musicVolumeScale;
    this.currentTrack = 'CUSTOM_MP3';
    this.play();
  }

  public setTrack(trackId: MusicTrackId, userInitiated: boolean = false) {
    const validId: MusicTrackId =
      trackId === 'CUSTOM_MP3' || MUSIC_TRACKS.some((t) => t.id === trackId)
        ? trackId
        : 'OSS_WESNOTH_KINGDOM';
    if (userInitiated) {
      this.manualOverrideMood = this.activeMoodState;
    }
    const wasPlaying = this.isPlayingState;
    this.stop();
    this.currentTrack = validId;
    if (wasPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public nextTrack() {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.currentTrack);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    this.setTrack(next.id, false);
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
      this.customAudioEl.volume = Math.min(0.05, this.musicVolumeScale);
      this.customAudioEl
        .play()
        .then(() => {
          if (this.customAudioEl) {
            this.rampElementVolume(
              this.customAudioEl,
              this.customAudioEl.volume,
              this.musicVolumeScale,
              400
            );
          }
        })
        .catch(() => {
          this.isPlayingState = false;
          this.notify();
        });
      this.notify();
      return;
    }

    const activeDef =
      MUSIC_TRACKS.find((t) => t.id === this.currentTrack) || MUSIC_TRACKS[0];
    if (activeDef?.audioUrl && typeof Audio !== 'undefined') {
      if (!this.bundledAudioEl || this.bundledAudioSrc !== activeDef.audioUrl) {
        if (this.bundledAudioEl) {
          this.bundledAudioEl.onended = null;
          this.bundledAudioEl.pause();
        }
        const audioEl = new Audio(activeDef.audioUrl);
        audioEl.loop = false;
        audioEl.onended = () => {
          if (this.isPlayingState && this.currentTrack !== 'CUSTOM_MP3') {
            this.nextTrack();
          }
        };
        this.bundledAudioEl = audioEl;
        this.bundledAudioSrc = activeDef.audioUrl;
      }
      const el = this.bundledAudioEl;
      el.volume = Math.min(0.05, this.musicVolumeScale);
      el.play()
        .then(() => {
          this.rampElementVolume(el, el.volume, this.musicVolumeScale, 450);
        })
        .catch(() => {
          this.isPlayingState = false;
          this.notify();
        });
      this.notify();
      return;
    }

    this.isPlayingState = false;
    this.notify();
  }

  public stop() {
    this.clearFadeTimer();
    this.isPlayingState = false;
    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }
    if (this.bundledAudioEl) {
      this.bundledAudioEl.pause();
    }
    this.notify();
  }
}

export const music = new NationalMusicEngine();
