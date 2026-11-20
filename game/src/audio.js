// audio.js — everything the game sounds like, synthesised. An engine hum
// that follows the throttle, a two-tone siren that pans with distance, one-
// shot effects, and three radio stations run by a lookahead step sequencer.
// The radio only ever READS the game (is Rio in a car? which station?) — it
// never writes a single field of game state.

export const STATIONS = [
  { name: 'Serena Sun FM', style: 'arp' },
  { name: 'Harbor Wave Radio', style: 'rock' },
  { name: 'Night Pier 88', style: 'talk' },
];

const NOTE = { C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, E5: 659.25 };

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;
  let stepTimer = 0;
  let stepIndex = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'square', vol = 0.12, when = 0, slide = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2, when = 0, low = 400, high = 3000) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // One radio step. Sun FM arpeggiates a sunlit C-major ladder; Harbor Wave
  // drives a four-on-the-floor rock bassline with hat ticks; Night Pier is
  // mostly static with a low talk-like murmur underneath.
  function radioStep(station, i) {
    const style = STATIONS[station].style;
    if (style === 'arp') {
      const ladder = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.C5, NOTE.A4, NOTE.G4, NOTE.E4];
      tone(ladder[i % 8], 0.16, 'triangle', 0.07);
      if (i % 8 === 0) tone(NOTE.C3, 0.5, 'sine', 0.09);
      if (i % 8 === 4) tone(NOTE.G3, 0.5, 'sine', 0.09);
    } else if (style === 'rock') {
      const bass = [NOTE.E2, NOTE.E2, NOTE.G2, NOTE.E2, NOTE.A2, NOTE.E2, NOTE.B2, NOTE.D3];
      tone(bass[i % 8], 0.18, 'sawtooth', 0.08);
      noise(0.03, 0.05, 0, 5000, 9000);
      if (i % 4 === 2) noise(0.09, 0.1, 0, 800, 2400);
    } else {
      noise(0.14, 0.028, 0, 1200, 3400);
      if (i % 4 === 0) tone(90 + (i % 3) * 14, 0.3, 'sine', 0.05);
      if (i % 16 === 12) tone(NOTE.A3, 0.12, 'sine', 0.04);
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    get muted() { return muted; },

    update(dt, game) {
      if (!ctx) return;
      const inCar = !!game.player.car;
      const speed = inCar ? Math.abs(game.player.car.speed) : 0;
      engineGain.gain.setTargetAtTime(inCar ? 0.028 + speed / 9000 : 0, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed * 0.55, ctx.currentTime, 0.08);
      const nearest = game.policeRef.cars.length || game.policeRef.heli ? 1 : 0;
      sirenGain.gain.setTargetAtTime(nearest && game.policeRef.stars > 0 ? 0.016 : 0, ctx.currentTime, 0.2);
      if (sirenOsc) sirenOsc.frequency.setTargetAtTime(660 + Math.sin(ctx.currentTime * 5.2) * 190, ctx.currentTime, 0.05);

      if (inCar && !muted) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          stepTimer = 0.21;
          radioStep(game.station, stepIndex++);
        }
      }
    },

    shot(kind) {
      if (kind === 'shotgun') { noise(0.16, 0.3, 0, 300, 1600); tone(120, 0.12, 'square', 0.1, 0, -60); }
      else if (kind === 'smg') noise(0.05, 0.16, 0, 900, 3200);
      else if (kind === 'pistol') { noise(0.07, 0.2, 0, 700, 2600); tone(190, 0.05, 'square', 0.06); }
      else tone(140, 0.06, 'square', 0.08); // punch swish
    },
    dryFire() { tone(880, 0.04, 'square', 0.05); },
    reload() { tone(320, 0.05, 'square', 0.06); tone(240, 0.05, 'square', 0.06, 0.09); },
    boom() { noise(0.7, 0.5, 0, 60, 700); tone(58, 0.6, 'sine', 0.4, 0, -24); },
    blip() { tone(660, 0.07, 'sine', 0.09); tone(990, 0.09, 'sine', 0.09, 0.07); },
    cash() { tone(1180, 0.06, 'square', 0.07); tone(1560, 0.1, 'square', 0.07, 0.06); },
    horn() { tone(370, 0.22, 'square', 0.1); tone(466, 0.22, 'square', 0.08); },
    sirenBurst() { tone(740, 0.12, 'triangle', 0.08); tone(988, 0.12, 'triangle', 0.08, 0.12); },
  };
}
