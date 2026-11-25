// Offline Open-Source Audio Samples (Wesnoth GPL/CC) + Web Audio API Fallback + Haptic Feedback

type SfxKey =
  | 'click'
  | 'select'
  | 'build'
  | 'march'
  | 'recruit'
  | 'war_horn'
  | 'treaty'
  | 'victory'
  | 'defeat';

const SFX_URLS: Record<SfxKey, string> = {
  click: '/assets/audio/sfx/click.mp3',
  select: '/assets/audio/sfx/select.mp3',
  build: '/assets/audio/sfx/build.mp3',
  march: '/assets/audio/sfx/march.mp3',
  recruit: '/assets/audio/sfx/recruit.mp3',
  war_horn: '/assets/audio/sfx/war_horn.mp3',
  treaty: '/assets/audio/sfx/treaty.mp3',
  victory: '/assets/audio/sfx/victory.mp3',
  defeat: '/assets/audio/sfx/defeat.mp3',
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volumeScale: number = 0.68;
  private buffers: Map<SfxKey, AudioBuffer> = new Map();
  private preloadStarted: boolean = false;
  public enabled: boolean = true;

  public setVolumes(masterPct: number, sfxPct: number) {
    const m = Math.max(0, Math.min(100, masterPct)) / 100;
    const s = Math.max(0, Math.min(100, sfxPct)) / 100;
    this.volumeScale = m * s;
    this.enabled = this.volumeScale > 0.005;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.volumeScale,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  private getOutputNode(): AudioNode | null {
    if (!this.ctx) return null;
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volumeScale, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.masterGain;
  }

  private preloadSamples() {
    if (
      this.preloadStarted ||
      !this.ctx ||
      typeof window === 'undefined' ||
      typeof fetch !== 'function'
    ) {
      return;
    }
    this.preloadStarted = true;
    const ctx = this.ctx;
    (Object.keys(SFX_URLS) as SfxKey[]).forEach((key) => {
      fetch(SFX_URLS[key])
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          this.buffers.set(key, decoded);
        })
        .catch(() => {
          // Silently fall back to Web Audio synth if sample isn't available
        });
    });
  }

  private init() {
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
    this.preloadSamples();
  }

  private playSample(
    key: SfxKey,
    gainLevel: number = 0.65,
    playbackRate: number = 1.0
  ): boolean {
    if (!this.ctx) return false;
    const buffer = this.buffers.get(key);
    if (!buffer) return false;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(playbackRate, this.ctx.currentTime);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
      source.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      source.start(0);
      return true;
    } catch {
      return false;
    }
  }

  private vibrate(pattern: number | number[]) {
    if (!this.enabled || typeof navigator === 'undefined') return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore if unsupported
    }
  }

  private lastHornAtMs = 0;
  private lastFanfareAtMs = 0;

  private createWarmFilter(cutoffHz: number): BiquadFilterNode | null {
    if (!this.ctx) return null;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.75, this.ctx.currentTime);
    filter.connect(this.getOutputNode() || this.ctx.destination);
    return filter;
  }

  public playClick() {
    if (!this.enabled) return;
    this.vibrate(8);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('click', 0.42, 1.05)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(520);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(118, now + 0.038);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.04);

    osc.connect(gain);
    gain.connect(filter || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.044);
  }

  public playSelectTerritory() {
    if (!this.enabled) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('select', 0.45, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(580);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.052, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    osc.connect(gain);
    gain.connect(filter || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playBuild() {
    if (!this.enabled) return;
    this.vibrate([12, 26, 14]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('build', 0.65, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(640);
    [220, 293.66, 369.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(0.048, now + idx * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.055 + 0.14);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.15);
    });
  }

  public playMarch() {
    if (!this.enabled) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('march', 0.58, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(360);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.11);

    gain.gain.setValueAtTime(0.042, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(filter || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playWarHorn() {
    if (!this.enabled) return;
    const nowMs = Date.now();
    if (nowMs - this.lastHornAtMs < 550) return;
    this.lastHornAtMs = nowMs;

    this.vibrate([18, 30, 24]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('war_horn', 0.72, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(420);
    [98, 146.83].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.34);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.042 : 0.028, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public playTreaty() {
    if (!this.enabled) return;
    this.vibrate([10, 20, 10]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('treaty', 0.65, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(680);
    [330, 415.3, 493.88].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.045, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.24);
    });
  }

  public playVictory() {
    if (!this.enabled) return;
    const nowMs = Date.now();
    if (nowMs - this.lastFanfareAtMs < 500) return;
    this.lastFanfareAtMs = nowMs;

    this.vibrate([14, 28, 18]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('victory', 0.72, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(620);
    [261.63, 329.63, 392.0].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.04, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.24);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.26);
    });
  }

  public playDefeat() {
    if (!this.enabled) return;
    const nowMs = Date.now();
    if (nowMs - this.lastFanfareAtMs < 500) return;
    this.lastFanfareAtMs = nowMs;

    this.vibrate([22, 24, 22]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('defeat', 0.7, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(380);
    [220, 174.61, 146.83].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.038, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.24);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.26);
    });
  }

  public playRecruit() {
    if (!this.enabled) return;
    this.vibrate([12, 18, 16]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('recruit', 0.65, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(580);
    const drumOsc = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drumOsc.type = 'triangle';
    drumOsc.frequency.setValueAtTime(145, now);
    drumOsc.frequency.exponentialRampToValueAtTime(68, now + 0.09);
    drumGain.gain.setValueAtTime(0.065, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    drumOsc.connect(drumGain);
    drumGain.connect(filter || this.ctx.destination);
    drumOsc.start(now);
    drumOsc.stop(now + 0.12);

    [293.66, 440.0].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.03 + idx * 0.055);
      gain.gain.setValueAtTime(0.042, now + 0.03 + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03 + idx * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + 0.03 + idx * 0.055);
      osc.stop(now + 0.03 + idx * 0.055 + 0.18);
    });
  }
}

export const sound = new SoundEngine();
