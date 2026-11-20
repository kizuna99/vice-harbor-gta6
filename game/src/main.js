// main.js — boot, the frame loop, and the window.ViceHarbor handle the
// harbour is known by. The simulation advances in fixed 1/60 steps (several
// in a slow frame, none in a fast one) and the renderer paints afterwards.
//
// ?seed=N fixes the city. ?shot=cover|chase|mission|finale stages that
// scene instead of running the loop, paints it, and sets __shotReady.

import { STEP } from './config.js';
import { createGame } from './game.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(window);
const game = createGame(seed);

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// The public handle. `missions` is a getter on purpose: starting a new game
// swaps the mission book, and anyone holding the handle must see the live
// one, never the retired copy.
window.ViceHarbor = {
  game,
  getState: () => game.getState(),
  startGame: () => game.startGame(),
  continueGame: () => game.continueGame(),
  setWanted: (n) => game.setWanted(n),
  get missions() { return game.missions; },
  startStep: () => game.missions.startStep(game),
  save: () => game.save(),
};

// Touch pad: the on-screen buttons feed the same input sets as the keys.
for (const btn of document.querySelectorAll('[data-key]')) {
  const code = btn.getAttribute('data-key');
  const on = (e) => { e.preventDefault(); input.setVirtual(code, true); if (game.state === 'title') game.startGame(); };
  const off = (e) => { e.preventDefault(); input.setVirtual(code, false); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
}

if (shotName) {
  stageShot(game, shotName);
  renderer.draw(game);
  renderer.draw(game);
  window.__shotReady = true;
  if (status) status.textContent = `Vice Harbor scene: ${shotName}`;
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    while (acc >= STEP) {
      game.update(STEP, input);
      acc -= STEP;
    }
    renderer.draw(game);
    if (status) {
      const s = game.getState();
      status.textContent = `Vice Harbor: ${s.state}, $${s.cash}, wanted ${s.wanted} stars`;
    }
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}
