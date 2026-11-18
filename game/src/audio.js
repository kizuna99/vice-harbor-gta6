// Synthetic sound: everything is oscillators and filtered noise, so
// the game ships zero audio files. Starts on the first user gesture,
// as browser autoplay rules require.

import { clamp } from './random.js';

export const STATIONS = [
  { name: 'Serena Sun FM', base: 261.63, scale: [0, 4, 7, 11, 12, 11, 7, 4], tempo: 0.24, wave: 'triangle' },
  { name: 'Harbor Wave Radio', base: 196.0, scale: [0, 3, 7, 10, 12, 10, 7, 3], tempo: 0.31, wave: 'sine' },
  { name: 'Night Pier 88', base: 146.83, scale: [0, 5, 7, 12, 14, 12, 7, 5], tempo: 0.19, wave: 'square' },
];

export const audio = {
  ctx: null,
  master: null,
  muted: false,
  started: false,
  engineOsc: null, engineGain: null, engineFilter: null,
  sirenOsc: null, sirenGain: null, sirenLfo: null,
  radioTimer: null, radioStep: 0,
  stationIdx: 0,
  inCar: false,

  init() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this.buildEngine();
    this.buildSiren();
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  buildEngine() {
    const c = this.ctx;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  },

  buildSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 760;
    this.sirenLfo = c.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.7;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = c.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  },

  // Called every frame with live world state.
  update(dt, state) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const mutedGain = this.muted ? 0 : 1;

    // Engine follows the player's car speed; silent on foot.
    const speed = state.inCar ? Math.abs(state.carSpeed) : 0;
    const engineLevel = state.inCar && !this.muted ? 0.05 + Math.min(0.08, speed / 3800) : 0;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed * 0.55, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(280 + speed * 2.4, t, 0.1);

    // Sirens swell with the nearest police unit.
    const sirenLevel = !this.muted && state.nearestCopDist < 460
      ? clamp(0.085 * (1 - state.nearestCopDist / 460), 0, 0.085)
      : 0;
    this.sirenGain.gain.setTargetAtTime(sirenLevel, t, 0.15);

    // Radio only plays while driving.
    if (state.inCar && !this.muted) this.runRadio(dt);
    void mutedGain;
  },

  runRadio(dt) {
    const st = STATIONS[this.stationIdx];
    this.radioTimer = (this.radioTimer || 0) - dt;
    if (this.radioTimer > 0) return;
    this.radioTimer = st.tempo;
    const semis = st.scale[this.radioStep % st.scale.length];
    this.radioStep++;
    const freq = st.base * Math.pow(2, semis / 12);
    this.tone(freq, st.tempo * 0.92, 0.045, st.wave);
    if (this.radioStep % 4 === 0) this.tone(st.base / 2, st.tempo * 1.8, 0.05, 'sine');
  },

  cycleStation() {
    this.stationIdx = (this.stationIdx + 1) % STATIONS.length;
    this.radioStep = 0;
    this.radioTimer = 0;
    return STATIONS[this.stationIdx].name;
  },

  stationName() { return STATIONS[this.stationIdx].name; },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  tone(freq, dur, vol, wave) {
    if (!this.started || this.muted) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  },

  noise(dur, vol, freq) {
    if (!this.started || this.muted) return;
    const c = this.ctx;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 900;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  },

  punch() { this.noise(0.09, 0.22, 500); },
  honk() { this.tone(392, 0.16, 0.06, 'square'); this.tone(330, 0.16, 0.05, 'square'); },
  pickup() { this.tone(880, 0.09, 0.09, 'sine'); setTimeout(() => this.tone(1318, 0.12, 0.09, 'sine'), 70); },
  cashRegister() {
    this.tone(1046, 0.08, 0.09, 'triangle');
    setTimeout(() => this.tone(1568, 0.14, 0.09, 'triangle'), 80);
  },
  checkpoint() { this.tone(740, 0.1, 0.08, 'sine'); },
  fail() { this.tone(196, 0.3, 0.1, 'sawtooth'); },
  crash() { this.noise(0.22, 0.3, 300); },
  door() { this.noise(0.06, 0.12, 1200); },
  bustedJingle() { this.tone(392, 0.16, 0.1, 'triangle'); setTimeout(() => this.tone(311, 0.16, 0.1, 'triangle'), 150); setTimeout(() => this.tone(233, 0.34, 0.1, 'triangle'), 300); },
  wastedJingle() { this.tone(330, 0.2, 0.1, 'sine'); setTimeout(() => this.tone(262, 0.2, 0.1, 'sine'), 190); setTimeout(() => this.tone(196, 0.44, 0.1, 'sine'), 380); },
};
