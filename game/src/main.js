// main.js — boot, fixed-timestep loop, and the public debug handle.
// The simulation advances in exact 1/60 steps no matter the display rate,
// with the frame delta clamped so a backgrounded tab can't teleport Rio.

import { Game } from './game.js';
import { render } from './render.js';
import { input } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game();
game._buttons = [];

input.attach(canvas);
input.bindTouchButtons(document.getElementById('touch'));

// Staged screenshot mode boots straight into the scene.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
} else {
  game.screen = 'title';
}

// Title / pause keyboard flow (kept out of Input so endFrame clearing in
// the simulation can never swallow a menu key).
window.addEventListener('keydown', (e) => {
  if (game.screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    game.startGame(false);
  } else if (game.screen === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) {
    game.screen = 'pause';
  } else if (game.screen === 'pause' && (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter')) {
    game.screen = 'play';
  }
});

// Title buttons are drawn by the renderer into game._buttons each frame.
canvas.addEventListener('pointerdown', (e) => {
  game.audio.start();
  if (game.screen !== 'title') return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  for (const b of game._buttons || []) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      game.startGame(b.id === 'continue');
    }
  }
});
window.addEventListener('pointerdown', () => game.audio.start(), { once: true });

// Debug / playtest handle — the headless checks drive the game through it.
window.ViceHarbor = {
  game,
  input,
  getState: () => game.getState(),
  startGame: (useSave = false) => game.startGame(useSave),
  setWanted: (n) => game.setWanted(n),
  save: () => game.save(),
  load: () => game.load(),
  getSaveRaw: () => { try { return localStorage.getItem('vice-harbor-port-serena-v2'); } catch { return null; } },
};

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
let fpsFrames = 0;
let fpsTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let delta = (now - last) / 1000;
  last = now;
  if (delta > 0.1) delta = 0.1; // clamp: no physics explosions after a stall
  if (delta < 0) delta = 0;

  fpsFrames++;
  fpsTime += delta;
  if (fpsTime >= 0.5) {
    game.fps = fpsFrames / fpsTime;
    fpsFrames = 0; fpsTime = 0;
  }

  if (game.screen === 'play' || game.screen === 'busted' || game.screen === 'wasted') {
    acc += delta;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
  } else {
    // Menus still tick the clock hands and clear per-frame input.
    game.time += delta;
    input.endFrame();
  }

  // Touch controls appear once a touch has actually happened.
  const touchEl = document.getElementById('touch');
  if (touchEl && input.touchSeen) touchEl.classList.add('on');

  render(game, ctx, canvas.width, canvas.height);
}
requestAnimationFrame(frame);
