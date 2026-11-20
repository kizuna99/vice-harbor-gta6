// missions.js — Auntie Bea's job book: eight jobs, each a short chain
// of steps (go here, run these points, survive the dock, outrun the
// searchlight). The engine is deliberately plain: a step is active, the
// world is watched, the step completes, the book turns a page. The
// public face is `game.missions` — jobIndex, stepIndex, done — and
// startStep(), which is idempotent so callers can prod it safely.

import { BEA_SPOT, SAFEHOUSE } from './config.js';
import { spawnEnemy } from './combat.js';
import { Audio } from './audio.js';

export const JOBS = [
  { title: 'Serena Welcome', reward: 250, respect: 6, steps: [
    { kind: 'goto', x: 1500, y: 600, r: 96, label: 'Drop the parcel on Palm Row' },
    { kind: 'goto', x: 600, y: 1000, r: 96, label: 'Roll past Serena Munitions' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: 'Checkpoint Rush', reward: 350, respect: 8, steps: [
    { kind: 'rounds', points: [[2200, 300], [3000, 600], [2600, 1000], [1800, 600]], r: 96, label: 'Hit every checkpoint' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: 'Borrowed Wheels', reward: 500, respect: 10, steps: [
    { kind: 'goto', x: 1000, y: 1400, r: 104, label: 'Take the marked Solano GT', spawnGt: true },
    { kind: 'goto', x: 2200, y: 1400, r: 116, label: 'Drop it at Serena Customs' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: "Lulu's Ride", reward: 450, respect: 12, steps: [
    { kind: 'goto', x: 2600, y: 300, r: 104, label: 'Pick up Lulu Mar at the marina stage' },
    { kind: 'goto', x: 900, y: 2100, r: 104, label: 'Drop Lulu at the boardwalk' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: 'Beach Money', reward: 600, respect: 14, steps: [
    { kind: 'rounds', points: [[1100, 2100], [1500, 2120], [1900, 2100], [2300, 2120]], r: 92, label: 'Work the boardwalk collections' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: 'Dockside Pickup', reward: 700, respect: 16, steps: [
    { kind: 'goto', x: 2900, y: 1800, r: 96, label: 'Load up at the dock warehouse' },
    { kind: 'goto', x: SAFEHOUSE.x, y: SAFEHOUSE.y, r: 112, label: 'Cool off at the safehouse' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Back to Bea's corner" },
  ] },
  { title: 'Dockside Crossfire', reward: 1200, respect: 20, steps: [
    { kind: 'goto', x: 2900, y: 1420, r: 102, label: 'Meet the buyers at the dock gate' },
    { kind: 'fight', x: 2790, y: 1470, waves: [4, 3, 3], label: 'Survive the crossfire — take the strongbox' },
    { kind: 'goto', x: BEA_SPOT.x, y: BEA_SPOT.y, r: 104, label: "Bring the strongbox to Bea's corner" },
  ] },
  { title: 'Searchlight Run', reward: 1500, respect: 25, steps: [
    { kind: 'goto', x: 2600, y: 1180, r: 102, label: 'Reach the marina pickup' },
    { kind: 'pursuit', time: 170, label: 'Lose Air One — reach the safehouse' },
  ] },
];

export function createMissions() {
  return {
    jobIndex: 0, stepIndex: 0, done: false,
    active: false, activeKey: '', justCompleted: false,
    runtime: null, nextJobT: 0,
  };
}

function keyOf(m) { return m.jobIndex + ':' + m.stepIndex; }

export function currentStep(game) {
  const job = JOBS[game.missions.jobIndex];
  return job ? job.steps[game.missions.stepIndex] || null : null;
}

export function startStep(game) {
  const m = game.missions;
  if (m.done) return;
  const step = currentStep(game);
  if (!step) { m.done = true; return; }
  if (m.active && m.activeKey === keyOf(m)) return; // already running this step
  m.active = true;
  m.activeKey = keyOf(m);
  m.justCompleted = false;
  m.nextJobT = 0;
  const rt = { t: 0 };
  if (step.kind === 'rounds') rt.point = 0;
  if (step.kind === 'fight') { game.enemies = []; rt.wave = 0; rt.spawned = false; rt.betweenT = 0; rt.wasFighting = false; }
  if (step.kind === 'pursuit') { rt.left = step.time; game.policeRef.heatLock = 170; }
  if (step.spawnGt) {
    const { makeCar } = game.factories;
    const gt = makeCar('gt', 1046, 1400, Math.PI / 2);
    gt.marked = true;
    gt.colour = '#ffd23d';
    game.cars.push(gt);
    rt.gt = gt;
  }
  m.runtime = rt;
  if (m.stepIndex === 0) game.toast(JOBS[m.jobIndex].title + ' — ' + step.label);
}

function completeStep(game) {
  const m = game.missions;
  const job = JOBS[m.jobIndex];
  m.active = false;
  m.runtime = null;
  m.stepIndex += 1;
  Audio.cash();
  if (m.stepIndex >= job.steps.length) {
    game.cash += job.reward;
    game.respect += job.respect;
    m.jobIndex += 1;
    m.stepIndex = 0;
    m.justCompleted = true;
    game.toast('Job done: ' + job.title + ' — $' + job.reward);
    if (m.jobIndex >= JOBS.length) { m.done = true; game.toast('Every job in the book is done. Port Serena is yours.'); }
    else m.nextJobT = 3;
  } else {
    startStep(game);
  }
}

export function currentObjective(game) {
  const m = game.missions;
  const step = currentStep(game);
  if (!step || m.done) return null;
  const job = JOBS[m.jobIndex];
  if (step.kind === 'rounds') {
    const pt = step.points[(m.runtime && m.runtime.point) || 0];
    return { x: pt[0], y: pt[1], label: step.label, job: job.title };
  }
  if (step.kind === 'pursuit') return { x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: step.label, job: job.title };
  return { x: step.x, y: step.y, label: step.label, job: job.title };
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (m.done) return;
  if (!m.active) {
    if (m.nextJobT > 0) { m.nextJobT -= dt; if (m.nextJobT <= 0) startStep(game); }
    return;
  }
  if (m.activeKey !== keyOf(m)) return; // indices were moved externally; startStep will re-arm
  const step = currentStep(game);
  if (!step) return;
  const rt = m.runtime;
  const p = game.player;
  rt.t += dt;

  if (step.kind === 'goto') {
    if (Math.hypot(p.x - step.x, p.y - step.y) <= step.r) completeStep(game);
  } else if (step.kind === 'rounds') {
    const pt = step.points[rt.point];
    if (Math.hypot(p.x - pt[0], p.y - pt[1]) <= step.r) {
      rt.point += 1;
      Audio.cash();
      if (rt.point >= step.points.length) completeStep(game);
    }
  } else if (step.kind === 'fight') {
    const alive = game.enemies.filter((e) => e.state !== 'down').length;
    const near = Math.hypot(p.x - step.x, p.y - step.y) < 310;
    if (!rt.spawned && near && rt.betweenT <= 0) {
      const count = step.waves[rt.wave];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rt.wave * 0.7;
        spawnEnemy(game, step.x + Math.cos(a) * 128, step.y + Math.sin(a) * 128, i % 2 ? 'smg' : 'pistol');
      }
      rt.spawned = true;
      rt.wasFighting = true;
      game.toast('Wave ' + (rt.wave + 1) + ' — they brought friends');
    }
    if (rt.spawned && alive === 0) {
      rt.wave += 1;
      rt.spawned = false;
      if (rt.wave >= step.waves.length) completeStep(game);
      else rt.betweenT = 1.15;
    }
    if (rt.betweenT > 0) rt.betweenT -= dt;
  } else if (step.kind === 'pursuit') {
    rt.left -= dt;
    if (Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) <= 116) {
      game.policeRef.heatLock = null;
      game.policeRef.setWanted(0);
      game.arrestFill = 0;
      game.toast('The searchlight swings away. You made it.');
      completeStep(game);
    } else if (rt.left <= 0) {
      game.policeRef.heatLock = null;
      game.policeRef.setWanted(2);
      m.active = false;
      m.runtime = null;
      game.toast('The run went cold — the pickup will wait for another night');
    }
  }
}
