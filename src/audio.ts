type Mode = 'none' | 'menu' | 'game' | 'gold' | 'boss';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { bass: 38, tones: [50, 53, 57] },
  { bass: 34, tones: [46, 50, 53] },
  { bass: 41, tones: [41, 45, 48] },
  { bass: 36, tones: [48, 52, 55] },
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private lp!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  private mode: Mode = 'none';
  private step = 0;
  private nextTime = 0;
  private bpm = 96;
  private muted = false;

  get ready(): boolean { return !!this.ctx; }

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      void ctx.resume();
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(ctx.destination);

      this.lp = ctx.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 2400;
      this.lp.Q.value = 0.4;
      this.lp.connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.34;
      this.musicBus.connect(this.lp);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.62;
      this.sfxBus.connect(this.master);

      const len = Math.floor(ctx.sampleRate * 0.6);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      this.applyMute();
      if (this.mode !== 'none') this.setMode(this.mode, true);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMute();
  }

  get isMuted(): boolean { return this.muted; }

  private applyMute(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  setMode(mode: Mode, force = false): void {
    if (!this.ctx) { this.mode = mode; return; }
    if (mode === this.mode && !force) return;
    this.mode = mode;
    this.step = 0;
    this.bpm = mode === 'gold' ? 132 : mode === 'boss' ? 108 : mode === 'menu' ? 88 : 96;
    this.nextTime = this.ctx.currentTime + 0.06;
    const target = mode === 'none' ? 0 : mode === 'menu' ? 0.26 : 0.32;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.18);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  /** 每帧调用，提前 0.2s 排程 */
  update(): void {
    if (!this.ctx || this.mode === 'none' || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.5) this.nextTime = now + 0.05;
    const eighth = 60 / this.bpm / 2;
    while (this.nextTime < now + 0.2) {
      this.scheduleStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 32;
      this.nextTime += eighth;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx) return;
    const bar = Math.floor(step / 8);
    const chord = CHORDS[bar % 4];
    const inBar = step % 8;
    const mode = this.mode;

    if (inBar === 0) {
      this.tone(midi(chord.bass - 12), 0.55, 'triangle', 0.16, time, this.musicBus);
      for (const t of chord.tones) {
        this.tone(midi(t), 1.7, 'sine', 0.045, time, this.musicBus);
      }
    }
    if (inBar === 4) {
      this.tone(midi(chord.bass - 12), 0.5, 'triangle', 0.13, time, this.musicBus);
    }
    if (mode === 'gold' || mode === 'boss') {
      if (inBar === 0 || inBar === 4) {
        this.tone(midi(chord.bass), 0.22, 'sawtooth', 0.07, time, this.musicBus, 1800);
      }
      if (inBar === 2 || inBar === 6) {
        this.tone(midi(chord.tones[2] + 12), 0.24, 'square', 0.05, time, this.musicBus, 2400);
      }
    }
    if (mode !== 'boss' && (inBar === 1 || inBar === 3 || inBar === 5 || inBar === 7)) {
      const note = chord.tones[(bar + inBar) % 3] + 12;
      this.tone(midi(note), 0.16, 'square', 0.035, time, this.musicBus, 3200);
    }
    if (mode === 'gold' && inBar % 2 === 1) {
      this.noise(0.05, 0.028, time, this.musicBus, 5200);
    }
    if (mode === 'boss' && (inBar === 0 || inBar === 4)) {
      this.noise(0.16, 0.1, time, this.musicBus, 240);
      this.tone(48, 0.3, 'sine', 0.1, time, this.musicBus, 300);
    }
  }

  private tone(
    freq: number, dur: number, type: OscillatorType, gain: number, when: number,
    dest: AudioNode, cutoff?: number, sweepTo?: number,
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node: AudioNode = g;
    if (cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.connect(f);
      node = f;
    }
    osc.connect(g);
    node.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private noise(dur: number, gain: number, when: number, dest: AudioNode, cutoff = 1200): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  play(name: string): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const bus = this.sfxBus;
    switch (name) {
      case 'bite':
        this.noise(0.06, 0.28, t, bus, 900);
        this.tone(110 + Math.random() * 40, 0.07, 'square', 0.06, t, bus, 700);
        break;
      case 'gulp':
        this.tone(220, 0.13, 'sine', 0.16, t, bus, 1200, 80);
        break;
      case 'boost':
        this.noise(0.35, 0.22, t, bus, 2000);
        this.tone(180, 0.32, 'sawtooth', 0.04, t, bus, 1600, 620);
        break;
      case 'coin':
        this.tone(880, 0.07, 'sine', 0.12, t, bus);
        this.tone(1320, 0.09, 'sine', 0.1, t + 0.06, bus);
        break;
      case 'gem':
        this.tone(1568, 0.1, 'triangle', 0.11, t, bus);
        this.tone(2093, 0.14, 'triangle', 0.09, t + 0.09, bus);
        break;
      case 'damage':
        this.tone(90, 0.18, 'sawtooth', 0.18, t, bus, 500, 45);
        this.noise(0.12, 0.16, t, bus, 500);
        break;
      case 'jelly':
        this.tone(420, 0.16, 'sawtooth', 0.1, t, bus, 1800, 260);
        break;
      case 'mine':
        this.noise(1.0, 0.32, t, bus, 300);
        this.tone(50, 0.9, 'sine', 0.2, t, bus, 200, 28);
        break;
      case 'missile':
        this.noise(0.3, 0.16, t, bus, 1400);
        break;
      case 'goldrush':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.09, t + i * 0.09, bus, 3600));
        break;
      case 'level':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, t + i * 0.08, bus));
        break;
      case 'boss':
        this.tone(55, 1.1, 'sawtooth', 0.2, t, bus, 320, 38);
        this.noise(0.8, 0.18, t, bus, 260);
        break;
      case 'bosshit':
        this.noise(0.5, 0.3, t, bus, 700);
        this.tone(70, 0.5, 'square', 0.18, t, bus, 400, 35);
        break;
      case 'death':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, t + i * 0.2, bus, 1200));
        break;
      case 'ui':
        this.tone(1000, 0.03, 'sine', 0.07, t, bus);
        break;
      case 'heal':
        this.tone(660, 0.12, 'sine', 0.08, t, bus);
        this.tone(990, 0.15, 'sine', 0.06, t + 0.08, bus);
        break;
      case 'revive':
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, t + i * 0.1, bus));
        break;
    }
  }
}
