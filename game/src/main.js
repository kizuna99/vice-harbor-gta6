// Boot, frame loop and the window.ViceHarbor debug handle.
// Fixed-timestep simulation at 60 Hz; rendering follows rAF.

import { initInput, pressed } from './input.js';
import { game } from './game.js';
import { render } from './render.js';
import { parseShotRequest, stageScene } from './shots.js';
import { police, setWantedLevel } from './police.js';
import { missions, startJobStep } from './missions.js';
import { districtAt } from './world.js';
import { audio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = 960;
  canvas.height = 600;
}
fitCanvas();

game.init(7);
if (game.hasSave()) game.load();

initInput(canvas);

const shotRequest = parseShotRequest();
if (shotRequest) {
  game.startGame(true);
  stageScene(game, shotRequest);
}

canvas.addEventListener('pointerdown', (e) => {
  audio.init();
  audio.resume();
  if (game.state !== 'title') return;
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * 960;
  const my = ((e.clientY - rect.top) / rect.height) * 600;
  for (const b of game.uiButtons || []) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      if (b.id === 'play') game.startGame(true);
      if (b.id === 'continue') game.startGame(false);
    }
  }
});
window.addEventListener('keydown', (e) => {
  audio.init();
  audio.resume();
  if (game.state === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    game.startGame(!game.hasSave());
    pressed.delete(e.code);
  } else if (game.state === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
    game.resume();
    pressed.delete(e.code);
  }
});

let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;
let fpsFrames = 0;
let fpsTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  accumulator += dt;

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    game.fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
  }

  while (accumulator >= STEP) {
    game.step(STEP);
    accumulator -= STEP;
  }
  render(ctx, game);
}
requestAnimationFrame(frame);

// Debug / playtest surface. getState returns plain data only.
window.ViceHarbor = {
  getState() {
    const p = game.player;
    return {
      cash: game.cash,
      respect: game.respect,
      wanted: police.stars,
      vehicles: game.cars.length,
      peds: game.peds.length,
      policeCars: police.cars.length,
      helicopter: !!police.heli,
      fps: game.fps,
      district: districtAt(p.x, p.y).name,
      jobIndex: missions.jobIndex,
      stepIndex: missions.stepIndex,
      jobDone: missions.done,
      inCar: !!p.car,
      health: Math.round(p.health),
      armor: Math.round(p.armor),
      weapon: p.weapon,
      weaponsOwned: Object.keys(game.weaponsOwned).filter((k) => game.weaponsOwned[k]),
      ammo: JSON.parse(JSON.stringify(game.ammo)),
      mods: { ...game.mods },
      shop: game.shop,
      enemies: game.enemies.filter((e) => e.state !== 'down').length,
      enemiesDown: game.enemiesDown,
      station: audio.stationName(),
      race: game.raceState
        ? { phase: game.raceState.phase, idx: game.raceState.idx, total: game.raceState.race.checkpoints.length, name: game.raceState.race.name }
        : null,
      lastRace: game.lastRace ? { ...game.lastRace } : null,
      crew: game.crew.map((m) => ({ name: m.name, x: Math.round(m.x), y: Math.round(m.y), health: Math.round(m.health), down: m.state === 'down', mode: m.mode })),
      state: game.state,
      hour: game.hour,
    };
  },
  startGame() { game.startGame(true); },
  setWanted(n) { setWantedLevel(n); },
  startStep() { startJobStep(game); },
  save() { game.save(); },
  game,
  missions,
};
