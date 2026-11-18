// audio.js — every sound in Port Serena is synthesized with Web Audio.
// No samples, no files: an engine hum that tracks speed, two-tone sirens
// that swell as cruisers close in, three little procedural radio stations,
// and one-shot SFX built from oscillators and filtered noise.

const STATIONS = [
  { name: 'Serena Sun FM', base: 220, scale: [0, 2, 4, 7, 9], tempo: 0.24, wave: 'triangle' },
  { name: 'Harbor Wave Radio', base: 196, scale: [0, 3, 5, 7, 10], tempo: 0.31, wave: 'sine' },
  { name: 'Night Pier 88', base: 164, scale: [0, 2, 3, 7, 8], tempo: 0.19, wave: 'square' },
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0; // -1 = radio off while driving? keep 0..2, N cycles incl. off
    this.radioOff = false;
    this.noteTimer = 0;
    this.noteIdx = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
  }

  // Must be called from a user gesture at least once.
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch {
      this.ctx = null; // headless or blocked: the game stays silent, not broken
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
    return this.muted;
  }

  cycleStation() {
    if (this.radioOff) { this.radioOff = false; this.station = 0; }
    else {
      this.station++;
      if (this.station >= STATIONS.length) { this.station = 0; this.radioOff = true; }
    }
    this.noteIdx = 0;
    return this.radioOff ? 'Radio off' : STATIONS[this.station].name;
  }

  stationName() { return this.radioOff ? 'Radio off' : STATIONS[this.station].name; }

  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.25, freq = 900) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'punch': this.noise(0.09, 0.35, 500); this.blip(120, 0.08, 'sine', 0.3, 60); break;
      case 'crash': this.noise(0.28, 0.4, 300); break;
      case 'pickup': this.blip(660, 0.09, 'sine', 0.22); setTimeout(() => this.blip(990, 0.12, 'sine', 0.22), 70); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.24), i * 90)); break;
      case 'fail': this.blip(220, 0.3, 'sawtooth', 0.16, 110); break;
      case 'horn': this.blip(370, 0.22, 'square', 0.14); this.blip(466, 0.22, 'square', 0.1); break;
      case 'busted': [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.24), i * 140)); break;
      case 'wasted': this.blip(196, 0.7, 'sine', 0.3, 49); break;
      case 'enter': this.blip(440, 0.06, 'sine', 0.12); break;
      default: break;
    }
  }

  // Called every frame with live simulation values.
  update(dt, { inCar, speedNorm, sirenProx }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineOsc) {
      const target = inCar ? 55 + speedNorm * 165 : 0;
      this.engineOsc.frequency.setTargetAtTime(Math.max(30, target), t, 0.08);
      this.engineGain.gain.setTargetAtTime(inCar && !this.muted ? 0.05 + speedNorm * 0.05 : 0, t, 0.1);
    }
    if (this.sirenOsc) {
      this.sirenPhase += dt * 5.2;
      const tone = Math.sin(this.sirenPhase) > 0 ? 720 : 540;
      this.sirenOsc.frequency.setTargetAtTime(tone, t, 0.03);
      const vol = sirenProx > 0.02 && !this.muted ? sirenProx * 0.07 : 0;
      this.sirenGain.gain.setTargetAtTime(vol, t, 0.15);
    }
    // Radio sequencer: gentle procedural melody while driving.
    if (inCar && !this.radioOff && !this.muted) {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0) {
        const st = STATIONS[this.station];
        this.noteTimer = st.tempo;
        const semi = st.scale[this.noteIdx % st.scale.length] + (this.noteIdx % 8 >= 6 ? 12 : 0);
        this.noteIdx++;
        const freq = st.base * Math.pow(2, semi / 12);
        this.blip(freq, st.tempo * 0.92, st.wave, 0.055);
      }
    }
  }
}
