// Offline Open-Source Audio Samples (Wesnoth GPL/CC) + Warm Lowpass Web Audio Synthesis + Haptic Feedback
// Includes strict per-cue cooldowns and 4x/5x speed tick throttling so sounds never stack or spam.

type SfxKey =
  | 'click'
  | 'select'
  | 'build'
  | 'march'
  | 'recruit'
  | 'victory'
  | 'defeat';

const SFX_URLS: Record<SfxKey, string> = {
  click: '/assets/audio/sfx/click.mp3',
  select: '/assets/audio/sfx/select.mp3',
  build: '/assets/audio/sfx/build.mp3',
  march: '/assets/audio/sfx/march.mp3',
  recruit: '/assets/audio/sfx/recruit.mp3',
  victory: '/assets/audio/sfx/victory.mp3',
  defeat: '/assets/audio/sfx/defeat.mp3',
};

type CueCategory =
  | 'click'
  | 'select'
  | 'build'
  | 'march'
  | 'recruit'
  | 'treaty'
  | 'coin'
  | 'combatClash'
  | 'siegeFall'
  | 'warHorn'
  | 'warDrum'
  | 'victory'
  | 'defeat';

export type TickCueType =
  | 'SELECT_TERRITORY'
  | 'MARCH'
  | 'BUILD'
  | 'RECRUIT'
  | 'TREATY'
  | 'TAX_COIN'
  | 'COMBAT_CLASH'
  | 'SIEGE_FALL'
  | 'VICTORY'
  | 'DEFEAT'
  | 'WAR_DRUM'
  | 'WAR_HORN';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volumeScale: number = 0.68;
  private buffers: Map<SfxKey, AudioBuffer> = new Map();
  private preloadStarted: boolean = false;
  private lastCueAtMs: Record<CueCategory, number> = {
    click: 0,
    select: 0,
    build: 0,
    march: 0,
    recruit: 0,
    treaty: 0,
    coin: 0,
    combatClash: 0,
    siegeFall: 0,
    warHorn: 0,
    warDrum: 0,
    victory: 0,
    defeat: 0,
  };
  private lastTickCueAtMs = 0;
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

  private canPlayCue(key: CueCategory, minGapMs: number): boolean {
    const nowMs = Date.now();
    if (nowMs - this.lastCueAtMs[key] < minGapMs) return false;
    this.lastCueAtMs[key] = nowMs;
    return true;
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

  private createWarmFilter(cutoffHz: number): BiquadFilterNode | null {
    if (!this.ctx) return null;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.75, this.ctx.currentTime);
    filter.connect(this.getOutputNode() || this.ctx.destination);
    return filter;
  }

  /**
   * Plays at most one deduplicated background simulation cue per tick,
   * with strict rate-limiting at high speeds (4x / 5x) to prevent audio spam.
   */
  public playTickCues(cues: readonly TickCueType[], speed: number) {
    if (!this.enabled || cues.length === 0) return;

    const unique = new Set(cues);
    // Dramatic single drum cue for war declaration / cabinet crisis bypasses routine 5x tick filter (has its own 2.5s cooldown)
    if (unique.has('WAR_DRUM')) {
      this.playWarDrum();
      this.lastTickCueAtMs = Date.now();
      return;
    }

    const minTickGapMs = speed >= 5 ? 2400 : speed >= 4 ? 1600 : 650;
    const nowMs = Date.now();
    if (nowMs - this.lastTickCueAtMs < minTickGapMs) return;

    // Pick only the single highest-priority meaningful cue from this tick
    let chosen: Exclude<TickCueType, 'WAR_DRUM'> | null = null;
    if (unique.has('VICTORY')) chosen = 'VICTORY';
    else if (unique.has('DEFEAT')) chosen = 'DEFEAT';
    else if (unique.has('SIEGE_FALL')) chosen = 'SIEGE_FALL';
    else if (unique.has('WAR_HORN') && speed <= 4) chosen = 'WAR_HORN';
    else if (unique.has('TREATY')) chosen = 'TREATY';
    else if (unique.has('COMBAT_CLASH') && speed <= 4) chosen = 'COMBAT_CLASH';
    else if (unique.has('TAX_COIN') && speed <= 3) chosen = 'TAX_COIN';
    else if (unique.has('BUILD')) chosen = 'BUILD';
    else if (unique.has('RECRUIT')) chosen = 'RECRUIT';
    else if (unique.has('MARCH') && speed <= 3) chosen = 'MARCH';
    else if (unique.has('SELECT_TERRITORY') && speed <= 3)
      chosen = 'SELECT_TERRITORY';

    if (!chosen) return;
    this.lastTickCueAtMs = nowMs;

    if (chosen === 'VICTORY') this.playVictory();
    else if (chosen === 'DEFEAT') this.playDefeat();
    else if (chosen === 'SIEGE_FALL') this.playSiegeFall();
    else if (chosen === 'WAR_HORN') this.playWarHorn();
    else if (chosen === 'TREATY') this.playTreaty();
    else if (chosen === 'COMBAT_CLASH') this.playBattleClash();
    else if (chosen === 'TAX_COIN') this.playCoin();
    else if (chosen === 'BUILD') this.playBuild();
    else if (chosen === 'RECRUIT') this.playRecruit();
    else if (chosen === 'MARCH') this.playMarch();
    else if (chosen === 'SELECT_TERRITORY') this.playSelectTerritory();
  }

  public playClick() {
    if (!this.enabled || !this.canPlayCue('click', 45)) return;
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
    if (!this.enabled || !this.canPlayCue('select', 90)) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('select', 0.42, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(580);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    osc.connect(gain);
    gain.connect(filter || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playBuild() {
    if (!this.enabled || !this.canPlayCue('build', 350)) return;
    this.vibrate([10, 22, 12]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('build', 0.56, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(640);
    [220, 293.66, 369.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(0.042, now + idx * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.055 + 0.14);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.15);
    });
  }

  public playMarch() {
    if (!this.enabled || !this.canPlayCue('march', 350)) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('march', 0.52, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(360);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.11);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(filter || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Warm, muffled low ceremonial war/alert horn chord (<460Hz lowpass, 1.8s cooldown)
   * for mobilization, bombardment, ultimatum tension, or battle launch.
   */
  public playWarHorn() {
    if (!this.enabled || !this.canPlayCue('warHorn', 1800)) return;
    this.vibrate([12, 18, 12]);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(460);
    [130.81, 196.0].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.96, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 0.36);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.055 : 0.036, now + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.38);

      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  /**
   * Crisp muted steel clash + distant cannon thump for active field battle rounds (1.4s cooldown).
   */
  public playBattleClash() {
    if (!this.enabled || !this.canPlayCue('combatClash', 1400)) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Distant muffled cannon / impact thud
    const lowFilter = this.createWarmFilter(280);
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(112, now);
    thudOsc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    thudGain.gain.setValueAtTime(0.055, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    thudOsc.connect(thudGain);
    thudGain.connect(lowFilter || this.ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.17);

    // Subtle damped blade ring (lowpass filtered so never harsh)
    const ringFilter = this.createWarmFilter(1250);
    [520, 785].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.028);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.14 + i * 0.028);
      gain.gain.setValueAtTime(0.001, now + i * 0.028);
      gain.gain.linearRampToValueAtTime(0.026, now + i * 0.028 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.028 + 0.14);
      osc.connect(gain);
      gain.connect(ringFilter || this.ctx.destination);
      osc.start(now + i * 0.028);
      osc.stop(now + i * 0.028 + 0.15);
    });
  }

  /**
   * Resonant bronze fortress bell + double drum cadence when a siege completes or wall breaches (1.6s cooldown).
   */
  public playSiegeFall() {
    if (!this.enabled || !this.canPlayCue('siegeFall', 1600)) return;
    this.vibrate([14, 20, 18]);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bellFilter = this.createWarmFilter(720);
    [220, 329.63, 440].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.042, now + idx * 0.06 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.06 + 0.34);
      osc.connect(gain);
      gain.connect(bellFilter || this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.36);
    });
  }

  /**
   * Warm muted gold coin clink for treasury income, war bonds, tribute, and land purchases (650ms cooldown).
   */
  public playCoin() {
    if (!this.enabled || !this.canPlayCue('coin', 650)) return;
    this.vibrate(9);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(1400);
    [587.33, 880.0].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.048);
      gain.gain.setValueAtTime(0.001, now + i * 0.048);
      gain.gain.linearRampToValueAtTime(0.032, now + i * 0.048 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.048 + 0.16);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + i * 0.048);
      osc.stop(now + i * 0.048 + 0.18);
    });
  }

  /**
   * Single soft, deep, muffled kettle-drum (kös) thud for major war declarations and cabinet crises.
   * Strictly low-frequency (<240Hz), ~230ms decay, 2.5s cooldown — never brassy, never spams.
   */
  public playWarDrum() {
    if (!this.enabled || !this.canPlayCue('warDrum', 2500)) return;
    this.vibrate([16, 20, 14]);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(240);

    // Deep fundamental drum skin resonance
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(108, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(46, now + 0.22);
    bodyGain.gain.setValueAtTime(0.001, now);
    bodyGain.gain.linearRampToValueAtTime(0.085, now + 0.012);
    bodyGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.25);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(filter || this.ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.27);

    // Subtle soft leather mallet attack harmonic
    const hitOsc = this.ctx.createOscillator();
    const hitGain = this.ctx.createGain();
    hitOsc.type = 'triangle';
    hitOsc.frequency.setValueAtTime(165, now);
    hitOsc.frequency.exponentialRampToValueAtTime(72, now + 0.085);
    hitGain.gain.setValueAtTime(0.036, now);
    hitGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
    hitOsc.connect(hitGain);
    hitGain.connect(filter || this.ctx.destination);
    hitOsc.start(now);
    hitOsc.stop(now + 0.11);
  }

  public playTreaty() {
    // Soft wax-seal thump + subtle parchment chime with 1.2s cooldown.
    if (!this.enabled || !this.canPlayCue('treaty', 1200)) return;
    this.vibrate(10);
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Wax seal press thump
    const sealFilter = this.createWarmFilter(260);
    const sealOsc = this.ctx.createOscillator();
    const sealGain = this.ctx.createGain();
    sealOsc.type = 'sine';
    sealOsc.frequency.setValueAtTime(140, now);
    sealOsc.frequency.exponentialRampToValueAtTime(68, now + 0.075);
    sealGain.gain.setValueAtTime(0.042, now);
    sealGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);
    sealOsc.connect(sealGain);
    sealGain.connect(sealFilter || this.ctx.destination);
    sealOsc.start(now);
    sealOsc.stop(now + 0.095);

    const filter = this.createWarmFilter(580);
    [329.63, 440.0].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.035 + i * 0.055);
      gain.gain.setValueAtTime(0.001, now + 0.035 + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.026, now + 0.035 + i * 0.055 + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.035 + i * 0.055 + 0.17);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + 0.035 + i * 0.055);
      osc.stop(now + 0.035 + i * 0.055 + 0.19);
    });
  }

  public playVictory() {
    if (!this.enabled || !this.canPlayCue('victory', 1500)) return;
    this.vibrate([14, 24, 16]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('victory', 0.62, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(620);
    [261.63, 329.63, 392.0].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.036, now + idx * 0.065);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.24);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.26);
    });
  }

  public playDefeat() {
    if (!this.enabled || !this.canPlayCue('defeat', 1500)) return;
    this.vibrate([18, 22, 18]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('defeat', 0.6, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(380);
    [220, 174.61, 146.83].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.034, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.24);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.26);
    });
  }

  public playRecruit() {
    if (!this.enabled || !this.canPlayCue('recruit', 350)) return;
    this.vibrate([10, 16, 14]);
    this.init();
    if (!this.ctx) return;
    if (this.playSample('recruit', 0.56, 1.0)) return;

    const now = this.ctx.currentTime;
    const filter = this.createWarmFilter(580);
    const drumOsc = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    drumOsc.type = 'triangle';
    drumOsc.frequency.setValueAtTime(145, now);
    drumOsc.frequency.exponentialRampToValueAtTime(68, now + 0.09);
    drumGain.gain.setValueAtTime(0.055, now);
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
      gain.gain.setValueAtTime(0.036, now + 0.03 + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03 + idx * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(filter || this.ctx.destination);
      osc.start(now + 0.03 + idx * 0.055);
      osc.stop(now + 0.03 + idx * 0.055 + 0.18);
    });
  }
}

export const sound = new SoundEngine();
