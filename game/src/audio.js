// audio.js — every sound in Port Serena is synthesised live with the
// Web Audio API: engine hum, two-tone sirens, gunshots, the strongbox
// chime, and three procedural radio stations that play little composed
// loops off seeded patterns. The radio only ever makes noise — it is
// never handed a reference to the game, so it cannot mutate state.
// All entry points are failure-proof: if audio is unavailable or the
// context is still locked, they quietly do nothing.

const SCALES = {
  sun:  { base: 220, notes: [0, 2, 4, 7, 9, 12, 9, 7], wave: 'triangle', tempo: 210 },
  wave: { base: 196, notes: [0, 3, 5, 7, 10, 12, 10, 7], wave: 'sine', tempo: 260 },
  pier: { base: 164, notes: [0, 0, 7, 5, 3, 3, 10, 7], wave: 'square', tempo: 300 },
};
const STATION_KEYS = ['sun', 'wave', 'pier'];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.station = 0;
    this.radioTimer = null;
    this.noteAt = 0;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* audio is a garnish, never a blocker */ }
  }

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = 0) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  noise(dur, vol = 0.25, freq = 1200) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
    } catch { /* ignore */ }
  }

  shot(kind) {
    if (kind === 'shotgun') { this.noise(0.22, 0.5, 800); this.tone(90, 0.18, 'square', 0.3, 0, 40); }
    else if (kind === 'smg') { this.noise(0.07, 0.3, 1800); }
    else if (kind === 'grenade') { this.noise(0.1, 0.15, 600); }
    else { this.noise(0.1, 0.35, 1400); this.tone(160, 0.07, 'square', 0.15, 0, 70); }
  }
  explosion() { this.noise(0.7, 0.6, 300); this.tone(55, 0.6, 'sine', 0.5, 0, 28); }
  cash() { this.tone(880, 0.09, 'triangle', 0.2); this.tone(1320, 0.14, 'triangle', 0.2, 0.07); }
  denied() { this.tone(140, 0.16, 'square', 0.18); }
  door() { this.tone(320, 0.08, 'sine', 0.12, 0, 210); }
  step() { this.noise(0.03, 0.05, 900); }

  setEngine(on, rpm = 0) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (on && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.0;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (this.engineOsc) {
        this.engineOsc.frequency.value = 55 + rpm * 85;
        this.engineGain.gain.value = on ? 0.05 + rpm * 0.05 : 0.0;
      }
    } catch { /* ignore */ }
  }

  setSiren(on) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenGain.gain.value = 0.0;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      if (this.sirenOsc) {
        const wail = 660 + Math.sin(this.ctx.currentTime * 4.2) * 190;
        this.sirenOsc.frequency.value = wail;
        this.sirenGain.gain.value = on ? 0.035 : 0.0;
      }
    } catch { /* ignore */ }
  }

  // The radio scheduler: while the player sits in a car, step through
  // the current station's pattern. Pure output — reads only its own
  // station index, which the game sets when N is pressed.
  setStation(i) { this.station = ((i % 3) + 3) % 3; }
  radioTick(inCar) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (!inCar) return;
      const now = performance.now();
      const st = SCALES[STATION_KEYS[this.station]];
      if (now < this.noteAt) return;
      this.noteAt = now + st.tempo;
      const stepIdx = Math.floor(now / st.tempo) % st.notes.length;
      const semis = st.notes[stepIdx];
      const freq = st.base * Math.pow(2, semis / 12);
      this.tone(freq, st.tempo / 1000 * 0.92, st.wave, 0.07);
      if (stepIdx % 4 === 0) this.tone(st.base / 2, 0.22, 'sine', 0.09);
    } catch { /* ignore */ }
  }
}

export const Audio = new AudioEngine();
