// Boot + frame loop for Vice Harbor — Port Serena.
// Fixed-timestep simulation at 60 Hz with an accumulator, render on
// every animation frame, and a small debug handle for the playtest.

import { initInput, pressed } from './input.js';
import { game } from './game.js';
import { render } from './render.js';
import { parseShotRequest, stageScene } from './shots.js';
import { police, setWantedLevel } from './police.js';
import { missions } from './missions.js';
import { districtAt } from './world.js';
import { audio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  // Internal resolution stays 960x600; CSS stretches it to the screen.
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

// Title-screen buttons + first-gesture audio unlock.
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
    game.startGame(!game.hasSave() ? true : false);
    pressed.delete(e.code);
  } else if (game.state === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
    game.resume();
    pressed.delete(e.code);
  }
});

// Fixed-step loop.
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

// Debug / playtest handle.
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
      jobDone: missions.done,
      inCar: !!p.car,
      health: Math.round(p.health),
      state: game.state,
      hour: game.hour,
    };
  },
  startGame() { game.startGame(true); },
  setWanted(n) { setWantedLevel(n); },
  save() { game.save(); },
  game,
};
