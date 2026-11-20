// Street races: two unsanctioned checkpoint events flagged on the
// map. Drive to a start marker, tap J, and run eight checkpoints
// against two AI rivals who steer the same course with a rubber band
// so the finish stays honest. Winning pays best; showing up pays a
// little. Race state lives here; the HUD and markers draw from here.

import { clamp, angleLerp } from './random.js';
import { makeVehicle } from './entities.js';
import { resolveCollision } from './world.js';
import { showMessage } from './missions.js';

export const RACES = [
  {
    id: 'palm-sprint', name: 'Palm Row Sprint', pace: 234,
    start: { x: 1400, y: 600 },
    checkpoints: [[2200, 600], [3000, 600], [3000, 1000], [2200, 1000], [2200, 1400], [1400, 1400], [1400, 1000], [1400, 600]],
    payout: [400, 150, 60], respect: [12, 6, 3],
  },
  {
    id: 'harbor-lights', name: 'Harbor Lights Run', pace: 246,
    start: { x: 600, y: 1560 },
    checkpoints: [[1400, 1560], [2200, 1560], [3000, 1560], [3000, 1000], [2200, 1000], [2200, 600], [1400, 600], [600, 600]],
    payout: [650, 250, 100], respect: [18, 9, 4],
  },
];

export const races = { active: null };

export function raceAt(game) {
  const p = game.player;
  if (!p.car || races.active) return null;
  for (const def of RACES) {
    if (Math.hypot(p.x - def.start.x, p.y - def.start.y) < 56) return def;
  }
  return null;
}

function progress(x, y, cp, def) {
  if (cp >= def.checkpoints.length) return 1e9;
  const [cx, cy] = def.checkpoints[cp];
  return cp * 100000 - Math.hypot(cx - x, cy - y);
}

export function startRace(game, def) {
  const foes = [];
  // Rivals line up just south of the start point, noses north.
  [[-30, 46], [30, 46]].forEach(([ox, oy], i) => {
    const car = makeVehicle(i === 0 ? 1 : 0, def.start.x + ox, def.start.y + oy, -Math.PI / 2);
    car.parked = false; car.driver = true; car.racer = true;
    game.cars.push(car);
    foes.push({ car, cp: 0, prog: 0, finished: false });
  });
  races.active = { def, phase: 'count', countT: 2.4, lastBeat: 3, cp: 0, t: 0, foes, pos: 3 };
  game.raceState = { name: def.name, cp: 0, total: def.checkpoints.length, pos: 3, phase: 'count' };
  showMessage(game, `${def.name} — first to the last flag takes the pot.`, 3);
}

function finishRace(game) {
  const r = races.active;
  const pos = r.pos;
  const cash = r.def.payout[pos - 1];
  const respect = r.def.respect[pos - 1];
  game.cash += cash;
  game.respect += respect;
  game.lastRace = { name: r.def.name, pos, payout: cash, respect, t: Math.round(r.t * 10) / 10 };
  for (const f of r.foes) {
    const i = game.cars.indexOf(f.car);
    if (i >= 0) game.cars.splice(i, 1);
  }
  races.active = null;
  game.raceState = null;
  game.audio?.cashRegister();
  showMessage(game, `Finished ${ordinal(pos)} in the ${r.def.name}: +$${cash}, +${respect} respect.`, 5);
  game.save();
}

export function ordinal(n) {
  return ['1st', '2nd', '3rd'][n - 1] || `${n}th`;
}

export function updateRaces(game, dt) {
  const r = races.active;
  if (!r) return;
  const p = game.player;
  if (r.phase === 'count') {
    r.countT -= dt;
    const beat = Math.ceil(r.countT);
    if (beat !== r.lastBeat && beat > 0) { r.lastBeat = beat; game.audio?.checkpoint(); }
    if (r.countT <= 0) {
      r.phase = 'go';
      showMessage(game, 'GO!', 1.2);
      game.audio?.cashRegister();
    }
    game.raceState = { name: r.def.name, cp: r.cp, total: r.def.checkpoints.length, pos: r.pos, phase: r.phase, count: Math.max(0, Math.ceil(r.countT)) };
    return;
  }
  r.t += dt;
  // Rivals run the course.
  const playerProg = progress(p.x, p.y, r.cp, r.def);
  for (const f of r.foes) {
    if (f.finished) continue;
    const [cx, cy] = r.def.checkpoints[f.cp];
    const dx = cx - f.car.x, dy = cy - f.car.y;
    const d = Math.hypot(dx, dy);
    if (d < 66) {
      f.cp++;
      if (f.cp >= r.def.checkpoints.length) { f.finished = true; f.prog = 1e9; continue; }
    }
    f.prog = progress(f.car.x, f.car.y, f.cp, r.def);
    const band = f.prog < playerProg - 400 ? 1.13 : f.prog > playerProg + 1600 ? 0.9 : 1;
    const want = r.def.pace * band;
    f.car.angle = angleLerp(f.car.angle, Math.atan2(dx, -dy), Math.min(1, dt * 3));
    f.car.speed += clamp(want - f.car.speed, -260 * dt, f.car.model.accel * dt);
    f.car.x += Math.sin(f.car.angle) * f.car.speed * dt;
    f.car.y += -Math.cos(f.car.angle) * f.car.speed * dt;
    resolveCollision(f.car, 20);
  }
  // Player checkpoints.
  if (p.car && r.cp < r.def.checkpoints.length) {
    const [cx, cy] = r.def.checkpoints[r.cp];
    if (Math.hypot(cx - p.x, cy - p.y) < 68) {
      r.cp++;
      game.audio?.checkpoint();
      if (r.cp >= r.def.checkpoints.length) {
        r.pos = 1 + r.foes.filter((f) => f.finished).length;
        finishRace(game);
        return;
      }
    }
  }
  const myProg = progress(p.x, p.y, r.cp, r.def);
  r.pos = 1 + r.foes.filter((f) => !f.finished && f.prog > myProg).length + r.foes.filter((f) => f.finished).length;
  game.raceState = { name: r.def.name, cp: r.cp, total: r.def.checkpoints.length, pos: r.pos, phase: 'go', t: Math.round(r.t * 10) / 10 };
}

// --- drawing (called from render.js) ---------------------------------------

export function drawRaceMarkers(ctx, game) {
  if (races.active) {
    const r = races.active;
    if (r.cp < r.def.checkpoints.length) {
      const [cx, cy] = r.def.checkpoints[r.cp];
      ring(ctx, game, cx, cy, '#ffffff');
    }
    return;
  }
  for (const def of RACES) {
    // Checkered start flag on a short pole.
    const { x, y } = def.start;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#f5f5f0' : '#14161a';
        ctx.fillRect(x + i * 6, y - 34 + j * 6, 6, 6);
      }
    }
    ring(ctx, game, x, y, '#ffd166');
  }
}

function ring(ctx, game, x, y, color) {
  const pulse = 0.65 + Math.sin(game.time * 4) * 0.25;
  ctx.strokeStyle = color;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, 30 + Math.sin(game.time * 4) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawRaceHud(ctx, game) {
  const s = game.raceState;
  if (!s) return;
  ctx.textAlign = 'center';
  if (s.phase === 'count') {
    ctx.fillStyle = '#ffd60a';
    ctx.font = '900 64px system-ui';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(s.count > 0 ? String(s.count) : 'GO!', 480, 250);
    ctx.shadowBlur = 0;
    return;
  }
  const label = `🏁 ${s.name} · CP ${Math.min(s.cp + 1, s.total)}/${s.total} · ${ordinal(s.pos)} · ${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`;
  ctx.font = '700 14px system-ui';
  const w = ctx.measureText(label).width + 30;
  ctx.fillStyle = 'rgba(10, 13, 20, 0.72)';
  ctx.beginPath();
  ctx.roundRect((960 - w) / 2, 140, w, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(label, 480, 161);
}
