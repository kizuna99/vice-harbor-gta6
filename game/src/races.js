// Street races: two marked courses, a countdown, eight checkpoints
// and two rubber-banding rivals. Press J in a car at a start marker.

import { makeVehicle } from './entities.js';
import { resolveCollision } from './world.js';

export const RACES = [
  {
    id: 'palm',
    name: 'Palm Row Sprint',
    start: { x: 1400, y: 600 },
    checkpoints: [[2200, 600], [3000, 600], [3000, 1000], [2200, 1000], [2200, 1400], [1400, 1400], [1400, 1000], [1400, 600]],
    payout: 400,
    respect: 6,
  },
  {
    id: 'harbor',
    name: 'Harbor Lights Run',
    start: { x: 600, y: 1560 },
    checkpoints: [[1400, 1560], [2200, 1560], [3000, 1400], [3000, 1000], [2200, 1000], [1400, 1000], [600, 1180], [600, 1560]],
    payout: 650,
    respect: 10,
  },
];

export function raceAt(x, y) {
  for (const r of RACES) {
    if (Math.hypot(x - r.start.x, y - r.start.y) < 78) return r;
  }
  return null;
}

export function startRace(game, race) {
  const rivals = [];
  for (let i = 0; i < 2; i++) {
    const car = makeVehicle(i === 0 ? 1 : 0, race.start.x - 46 - i * 8, race.start.y + (i === 0 ? -26 : 26), Math.PI / 2);
    car.parked = false;
    car.driver = true;
    car.speed = 0;
    rivals.push({ car, idx: 0, finished: false, finishTime: 0 });
  }
  game.raceState = {
    race,
    phase: 'count',
    countT: 2.4,
    idx: 0,
    time: 0,
    rivals,
  };
  game.lastRace = null;
  return game.raceState;
}

export function raceProgressOf(state, isPlayer, rival) {
  if (isPlayer) return state.idx;
  return rival.idx;
}

export function updateRace(game, dt) {
  const st = game.raceState;
  if (!st) return;
  if (st.phase === 'count') {
    st.countT -= dt;
    if (st.countT <= 0) {
      st.phase = 'go';
      game.audio?.checkpoint?.();
    }
    return;
  }
  st.time += dt;
  const cps = st.race.checkpoints;

  // Player progress (only while seated in a car).
  const pc = game.player.car;
  if (pc && st.idx < cps.length) {
    const [cx, cy] = cps[st.idx];
    if (Math.hypot(pc.x - cx, pc.y - cy) < 88) {
      st.idx++;
      game.audio?.checkpoint?.();
      if (st.idx >= cps.length) finishRace(game);
    }
  }
  if (!game.raceState) return; // finished above

  // Rivals steer checkpoint to checkpoint. Rubber-banding keeps them
  // honest: trail the player's progress and they hurry, lead it and
  // they ease off — but never beyond a believable street pace.
  for (const r of st.rivals) {
    if (r.finished) continue;
    const car = r.car;
    if (r.idx >= cps.length) { r.finished = true; r.finishTime = st.time; continue; }
    const [cx, cy] = cps[r.idx];
    const dx = cx - car.x, dy = cy - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 74) { r.idx++; continue; }
    const targetAngle = Math.atan2(dx, -dy);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    let top = 168;
    if (r.idx < st.idx) top = 198;
    else if (r.idx > st.idx) top = 148;
    car.speed += Math.max(-260 * dt, Math.min(240 * dt, top - car.speed));
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y += -Math.cos(car.angle) * car.speed * dt;
    resolveCollision(car, 20);
  }
}

function finishRace(game) {
  const st = game.raceState;
  const beaten = st.rivals.filter((r) => r.finished).length;
  const pos = beaten + 1;
  const payout = pos === 1 ? st.race.payout : pos === 2 ? Math.floor(st.race.payout * 0.4) : 0;
  if (payout > 0) game.cash += payout;
  if (pos === 1) game.respect += st.race.respect;
  game.lastRace = { race: st.race.name, pos, payout, time: Math.round(st.time * 10) / 10 };
  game.showBanner?.(`Race finished: P${pos} — +$${payout}`, 4.5);
  game.audio?.cashRegister?.();
  game.raceState = null;
  game.save();
}

export function currentCheckpoint(state) {
  if (!state || state.phase !== 'go') return null;
  const cp = state.race.checkpoints[state.idx];
  return cp ? { x: cp[0], y: cp[1] } : null;
}
