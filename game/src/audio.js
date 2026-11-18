// Every sound in Vice Harbor is synthesized with the Web Audio API — no audio files, no
// network. One engine hum follows the player's speed, police sirens rise when a patrol car
// closes in, the helicopter thumps overhead at high heat, and three radio stations play
// procedural loops: a sun-pop arpeggio, a slow wave of chords, and a night-pier bassline.
// Short one-shot blips mark doors, horns, hits, pickups and job results.

import { RADIO_STATIONS } from './config.js';

const SUN_PATTERN = [0, 4, 7, 11, 12, 11, 7, 4, 0, 4, 7, 11, 14, 11, 7, 4];
const WAVE_CHORDS = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [4, 7, 11]];
const NIGHT_BASS = [0, 0, 12, 0, 3, 0, 10, 12, 0, 0, 12, 0, 5, 3, 2, 1];
const BASE_NOTE = 110; // A2

function noteFrequency(semitones) {
  return BASE_NOTE * Math.pow(2, semitones / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicGain = null;
  let stepIndex = 0;
  let nextNoteTime = 0;
  let sirenFlip = 0;
  let muted = false;

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return false;
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      nextNoteTime = ctx.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, seconds, type, volume, slideTo) {
    if (!ensureContext()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function scheduleMusicNote(stationIndex, when) {
    const station = RADIO_STATIONS[stationIndex];
    const step = stepIndex % 16;
    const bar = Math.floor(stepIndex / 16) % 4;
    if (station.style === 'sun') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = noteFrequency(SUN_PATTERN[step] + 12);
      gain.gain.setValueAtTime(0.5, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + 0.2);
      osc.connect(gain).connect(musicGain);
      osc.start(when);
      osc.stop(when + 0.22);
    } else if (station.style === 'wave') {
      if (step % 4 === 0) {
        for (const tone of WAVE_CHORDS[bar]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = noteFrequency(tone + 12);
          gain.gain.setValueAtTime(0.22, when);
          gain.gain.exponentialRampToValueAtTime(0.01, when + 0.85);
          osc.connect(gain).connect(musicGain);
          osc.start(when);
          osc.stop(when + 0.9);
        }
      }
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = noteFrequency(NIGHT_BASS[step]);
      gain.gain.setValueAtTime(0.34, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + 0.19);
      osc.connect(gain).connect(musicGain);
      osc.start(when);
      osc.stop(when + 0.2);
      if (step % 8 === 4) blipAt(noteFrequency(31), when, 0.3, 'sine', 0.12);
    }
  }

  function blipAt(frequency, when, seconds, type, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + seconds);
    osc.connect(gain).connect(musicGain);
    osc.start(when);
    osc.stop(when + seconds);
  }

  /** Called every frame: drives the engine, the sirens and the radio sequencer. */
  function update(state, dt) {
    if (!ctx) return;
    const driving = state.player.vehicle;
    const speed = driving ? Math.abs(driving.speed) : 0;
    engineGain.gain.setTargetAtTime(driving ? 0.05 + speed / 6000 : 0, ctx.currentTime, 0.08);
    if (driving) engineOsc.frequency.setTargetAtTime(52 + speed * 0.33, ctx.currentTime, 0.06);

    let nearestPolice = Infinity;
    const focus = state.player.vehicle ?? state.player;
    for (const car of state.policeCars) {
      nearestPolice = Math.min(nearestPolice, Math.hypot(car.x - focus.x, car.y - focus.y));
    }
    const sirenLevel = state.wanted > 0 && nearestPolice < 620 ? 0.028 * (1 - nearestPolice / 700) : 0;
    sirenGain.gain.setTargetAtTime(sirenLevel, ctx.currentTime, 0.1);
    if (sirenLevel > 0) {
      sirenFlip += dt;
      if (sirenFlip > 0.34) {
        sirenFlip = 0;
        sirenOsc.frequency.value = sirenOsc.frequency.value > 820 ? 690 : 950;
      }
    }

    while (nextNoteTime < ctx.currentTime + 0.3) {
      scheduleMusicNote(state.radioStation, nextNoteTime);
      nextNoteTime += 0.21;
      stepIndex += 1;
    }
  }

  function playEvent(name, state) {
    if (!ensureContext()) return;
    switch (name) {
      case 'door': blip(180, 0.09, 'square', 0.1, 90); break;
      case 'horn': blip(340, 0.22, 'square', 0.14); break;
      case 'crash': blip(90, 0.3, 'sawtooth', 0.3, 40); break;
      case 'thud': blip(120, 0.14, 'sine', 0.3, 60); break;
      case 'swing': blip(500, 0.07, 'sine', 0.06, 240); break;
      case 'pickup': blip(880, 0.16, 'triangle', 0.16, 1320); break;
      case 'checkpoint': blip(660, 0.14, 'triangle', 0.16, 990); break;
      case 'step': blip(520, 0.12, 'triangle', 0.12, 780); break;
      case 'jobdone':
        blip(523, 0.16, 'triangle', 0.18);
        setTimeout(() => blip(659, 0.16, 'triangle', 0.18), 110);
        setTimeout(() => blip(784, 0.3, 'triangle', 0.2), 220);
        break;
      case 'crime': blip(220, 0.2, 'square', 0.1, 160); break;
      case 'clear': blip(440, 0.2, 'sine', 0.1, 660); break;
      case 'radio': blip(1200, 0.05, 'square', 0.06); break;
      case 'heli': blip(70, 0.5, 'sawtooth', 0.1, 65); break;
      case 'busted': blip(300, 0.5, 'square', 0.14, 110); break;
      case 'wasted': blip(200, 0.7, 'sawtooth', 0.14, 50); break;
      case 'fail': blip(240, 0.3, 'square', 0.1, 140); break;
      default: break;
    }
    void state;
  }

  return {
    unlock: ensureContext,
    update,
    playEvent,
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    isMuted: () => muted,
  };
}
