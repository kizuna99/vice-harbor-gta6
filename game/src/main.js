// main.js — boot and the bridge to the outside world. Sets up the
// canvas, the clock and the input, exposes the window.ViceHarbor
// handle (the game's public face: getState, startGame, setWanted,
// missions, startStep, save), and runs the frame loop. If the URL
// names a staged scene (?shot=cover&seed=7), that scene is set up
// before the first frame.

import { Game } from './game.js';
import { render } from './render.js';
import { Input } from './input.js';
import { startStep } from './missions.js';
import { applyShot } from './shots.js';
import { Audio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 7;

const game = new Game(seed);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.view = { w: canvas.width, h: canvas.height };
}
window.addEventListener('resize', resize);
resize();

Input.attach(window, canvas);

canvas.addEventListener('mousedown', (ev) => {
  Audio.unlock();
  if (game.state !== 'title' || !game.titleButtons) return;
  for (const b of game.titleButtons) {
    if (ev.clientX >= b.x && ev.clientX <= b.x + b.w && ev.clientY >= b.y && ev.clientY <= b.y + b.h) {
      if (b.id === 'play') game.startGame();
      else if (b.id === 'continue') game.continueGame();
    }
  }
});
window.addEventListener('keydown', (ev) => {
  Audio.unlock();
  if (game.state === 'title' && (ev.code === 'Enter' || ev.code === 'Space')) game.startGame();
});

window.ViceHarbor = {
  game,
  getState: () => game.getState(),
  startGame: () => game.startGame(),
  setWanted: (n) => game.setWanted(n),
  startStep: () => startStep(game),
  save: () => game.save(),
  load: () => game.load(),
  get missions() { return game.missions; },
};

if (params.get('shot')) applyShot(game, params.get('shot'));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;
  game.update(dt);
  render(ctx, game, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
