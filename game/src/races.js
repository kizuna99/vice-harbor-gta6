// races.js — street racing for people who deliver packages by day. Two
// standing courses, each an eight-checkpoint loop with two house rivals who
// rubber-band: they press harder when Rio leads and lift off when he is
// buried, so the last lap is always a story. A race only starts on a fresh
// J edge at the marker with Rio already in a car — the input module drains
// every edge at the end of each tick, so a punch thrown a minute ago in a
// shop can never light the countdown by accident.

import { angleTo, dirFrom } from './random.js';

export const RACES = [
  {
    id: 'palm', name: 'Palm Row Sprint', prize: 400, respect: 6,
    start: { x: 1400, y: 600 },
    checkpoints: [[2200, 600], [3000, 600], [3000, 1000], [2200, 1000], [2200, 1400], [1400, 1400], [1400, 1000], [1400, 600]],
  },
  {
    id: 'harbor', name: 'Harbor Lights Run', prize: 650, respect: 9,
    start: { x: 400, y: 2200 },
    checkpoints: [[1000, 2200], [1600, 2200], [2200, 2200], [2200, 1800], [1600, 1800], [1000, 1800], [400, 1800], [400, 2200]],
  },
];

export function raceNear(game) {
  if (!game.player.car) return null;
  for (const r of RACES) {
    if (Math.hypot(game.player.x - r.start.x, game.player.y - r.start.y) < 78) return r;
  }
  return null;
}

export function startRace(game, def) {
  const rivals = [-46, 46].map((off, i) => ({
    x: def.start.x + off, y: def.start.y + (i === 0 ? -30 : 30),
    angle: game.player.car.angle, speed: 0, cp: 0, name: i === 0 ? 'Vex (house car)' : 'Mara (house car)',
    color: i === 0 ? '#4ecdc4' : '#ef6f6c',
  }));
  game.raceState = {
    def, phase: 'count', t: 2.6, cpIndex: 0, rivals, elapsed: 0,
  };
  game.banner(`${def.name} — ready…`);
}

function rivalProgress(state, r) {
  const total = state.def.checkpoints.length;
  const next = state.def.checkpoints[Math.min(r.cp, total - 1)];
  const segLeft = Math.hypot(next[0] - r.x, next[1] - r.y);
  return r.cp + (1 - Math.min(1, segLeft / 800));
}

export function updateRaces(game, dt) {
  const s = game.raceState;
  if (!s) return;
  const car = game.player.car;
  if (s.phase === 'count') {
    s.t -= dt;
    if (car) { car.speed *= Math.max(0, 1 - dt * 4); } // held on the line
    if (s.t <= 0) { s.phase = 'go'; game.banner('GO!'); game.audio.blip(); }
    return;
  }
  s.elapsed += dt;
  if (!car) return; // out of the car, the clock runs but the course waits

  // Player checkpoints.
  const cp = s.def.checkpoints[s.cpIndex];
  if (cp && Math.hypot(car.x - cp[0], car.y - cp[1]) < 88) {
    s.cpIndex += 1;
    game.audio.blip();
    if (s.cpIndex >= s.def.checkpoints.length) {
      finishRace(game);
      return;
    }
  }

  // Rivals run the same loop, rubber-banded against Rio's progress.
  const playerProg = s.cpIndex;
  for (const r of s.rivals) {
    const target = s.def.checkpoints[Math.min(r.cp, s.def.checkpoints.length - 1)];
    const want = angleTo(r.x, r.y, target[0], target[1]);
    let d = want - r.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    r.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
    const prog = rivalProgress(s, r);
    const band = prog < playerProg ? 1.13 : prog > playerProg + 0.5 ? 0.9 : 1;
    const top = 196 * band;
    r.speed += Math.max(-200 * dt, Math.min(140 * dt, top - r.speed));
    const dir = dirFrom(r.angle);
    r.x += dir.x * r.speed * dt;
    r.y += dir.y * r.speed * dt;
    if (Math.hypot(r.x - target[0], r.y - target[1]) < 80) r.cp += 1;
  }
}

function finishRace(game) {
  const s = game.raceState;
  const progs = s.rivals.map((r) => rivalProgress(s, r));
  const total = s.def.checkpoints.length;
  let pos = 1;
  for (const pr of progs) if (pr >= total) pos += 1;
  // Nobody else can have finished: rivals cap below the full loop while
  // Rio is still running it, so a completed Rio loop is a win or a podium.
  const payout = pos === 1 ? s.def.prize : pos === 2 ? Math.floor(s.def.prize * 0.4) : Math.floor(s.def.prize * 0.15);
  game.cash += payout;
  if (pos === 1) game.respect += s.def.respect;
  game.lastRace = { name: s.def.name, pos, payout, time: s.elapsed };
  game.banner(pos === 1 ? `${s.def.name}: FIRST — $${payout}` : `${s.def.name}: P${pos} — $${payout}`);
  game.audio.cash();
  game.raceState = null;
  game.saveSoon();
}
