// Web Audio API Synthesized Sound Effects + Android Haptic Feedback for Grand Strategy War Room

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

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

  public playClick() {
    if (!this.enabled) return;
    this.vibrate(8);
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.045);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playSelectTerritory() {
    if (!this.enabled) return;
    this.vibrate(12);
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, this.ctx.currentTime + 0.07);

    gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.075);
  }

  public playBuild() {
    if (!this.enabled) return;
    this.vibrate([12, 30, 15]);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [280, 420, 560].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.08, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.1);
    });
  }

  private lastHornAtMs = 0;
  private lastFanfareAtMs = 0;

  private createWarmFilter(cutoffHz: number): BiquadFilterNode | null {
    if (!this.ctx) return null;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.7, this.ctx.currentTime);
    filter.connect(this.ctx.destination);
    return filter;
  }

  public playMarch() {
    if (!this.enabled) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;

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

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(420);
    // Warm AoH3 deep historical war drum + low horn fifth (no raw sawtooth buzz)
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

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(620);
    // Warm, low-register AoH3 parchment seal chord (C4, E4, G4) — no piercing C6
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

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(380);
    // Soft muted descending interval (A3 -> F3 -> D3)
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
}

export const sound = new SoundEngine();
