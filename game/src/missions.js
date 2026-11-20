// missions.js — Auntie Bea's book of jobs, plus the two nights that follow
// it. A job is a list of steps; a step is a place to reach, a fight to
// finish, or a pursuit to outrun. The system arms a step, watches it, pays
// out, and moves on. Timers fail the STEP, never the whole job.

import { HEAT_LOCK_RUN } from './config.js';
import { makeGunman } from './combat.js';

const gotoStep = (x, y, label, opts = {}) => ({ kind: 'goto', x, y, r: opts.r || 92, label, time: opts.time || 0, heat: opts.heat || 0 });

export const JOBS = [
  { title: 'First Drop', pay: 150, respect: 5, steps: [
    gotoStep(1000, 1000, 'Pick up the package on University Row'),
    gotoStep(1400, 1400, 'Drop it at the Midtown lockup'),
  ] },
  { title: 'Neon Rush', pay: 220, respect: 7, steps: [
    gotoStep(600, 600, 'Checkpoint 1: Palm Row west', { time: 95 }),
    gotoStep(1400, 600, 'Checkpoint 2: the ramp straight', { time: 95 }),
    gotoStep(2200, 600, 'Checkpoint 3: Marina gates', { time: 95 }),
    gotoStep(2200, 1400, 'Checkpoint 4: Customs corner', { time: 95 }),
    gotoStep(1000, 1400, 'Checkpoint 5: Bea is watching', { time: 95 }),
  ] },
  { title: 'Golden Boy', pay: 300, respect: 9, steps: [
    { kind: 'steal', x: 1800, y: 574, r: 90, label: 'Steal the marked Solano GT', time: 0, heat: 0 },
    gotoStep(600, 1400, 'Lose the shine at the Old Town garage'),
  ] },
  { title: 'Lulu Mar, Live', pay: 340, respect: 10, steps: [
    gotoStep(2400, 1000, 'Collect Lulu Mar from the Marina hotel', { time: 80 }),
    gotoStep(600, 1800, 'Get her to the Boardwalk stage', { time: 80 }),
  ] },
  { title: 'Beach Money', pay: 380, respect: 12, steps: [
    gotoStep(800, 2200, 'Collection 1: the first lifeguard stand'),
    gotoStep(1400, 2200, 'Collection 2: under the pier sign'),
    gotoStep(2000, 2200, 'Collection 3: the last cabana'),
  ] },
  { title: 'Serena Send-Off', pay: 520, respect: 14, steps: [
    gotoStep(2900, 1420, 'Reach the Dockmaster at the Port Docks'),
    gotoStep(1240, 2320, 'Outrun it all to Pier Nine', { time: 110, heat: 70 }),
  ] },
  { title: 'Dockside Crossfire', pay: 800, respect: 18, steps: [
    gotoStep(2900, 1420, 'Walk into the docks yard'),
    { kind: 'fight', x: 2820, y: 1500, r: 200, label: 'Survive the Ferro crew', time: 0, heat: 0 },
    gotoStep(1250, 430, "Bring the strongbox to Bea's Corner"),
  ] },
  { title: 'Searchlight Run', pay: 1000, respect: 24, steps: [
    gotoStep(2600, 1180, 'Trip the port alarm'),
    { kind: 'escape', x: 200, y: 340, r: 105, label: 'Reach the Old Town safehouse', time: 170, heat: 0 },
  ] },
];

// Where each wave of the crossfire comes over the fence.
const WAVE_SPOTS = [
  [[2652, 1470], [2652, 1560], [2980, 1452], [2900, 1600]],
  [[2652, 1500], [2990, 1580], [2820, 1446]],
  [[2995, 1470], [2652, 1430], [2880, 1610]],
];

export function createMissions() {
  return {
    jobIndex: 0,
    stepIndex: 0,
    done: false,       // whole book finished
    jobDone: false,    // the current job just paid out
    armed: false,
    fightActive: false,
    timer: 0,
    wave: 0,
    waveAlive: 0,
    spawnedTotal: 0,

    job() { return JOBS[this.jobIndex] || null; },
    step() { const j = this.job(); return j ? j.steps[this.stepIndex] || null : null; },

    startStep(game) {
      const step = this.step();
      this.armed = true;
      this.jobDone = false;
      if (!step) return;
      this.timer = step.time || 0;
      if (step.heat) game.setHeatFloor(step.heat);
      if (step.kind === 'fight') {
        // Re-arming a fight that is already in the field must not stack a
        // second copy of wave one on top of the first.
        const anyAlive = game.enemies.some((e) => e.state !== 'down');
        if (this.fightActive && anyAlive) return;
        this.fightActive = true;
        this.wave = 0;
        this.spawnedTotal = 0;
        this.spawnWave(game);
      }
      if (step.kind === 'escape') {
        game.heatLock = HEAT_LOCK_RUN;
        game.policeRef.heat = HEAT_LOCK_RUN;
        this.timer = step.time || 170;
      }
    },

    spawnWave(game) {
      const spots = WAVE_SPOTS[this.wave] || [];
      for (const [x, y] of spots) {
        game.enemies.push(makeGunman(x, y, this.wave === 2 ? 1.25 : 1));
        this.spawnedTotal += 1;
      }
      this.waveAlive = spots.length;
    },

    completeStep(game) {
      const job = this.job();
      game.cash += 0; // step payouts land on job completion, below
      this.stepIndex += 1;
      this.armed = false;
      if (this.stepIndex >= job.steps.length) {
        game.cash += job.pay;
        game.respect += job.respect;
        this.jobDone = true;
        game.audio.cash();
        game.banner(`Job done: ${job.title}  +$${job.pay}`);
        this.jobIndex += 1;
        this.stepIndex = 0;
        if (this.jobIndex >= JOBS.length) {
          this.done = true;
          game.banner('Port Serena is yours. Free roam!');
        }
      } else {
        game.audio.blip();
      }
    },

    failStep(game) {
      game.banner('Out of time — the step resets');
      this.armed = false;
      if (this.step() && this.step().kind === 'escape') {
        game.heatLock = 0;
        game.setWanted(0);
      }
      this.startStep(game);
    },

    update(game, dt) {
      if (this.done) return;
      const step = this.step();
      if (!step) return;
      if (!this.armed) this.startStep(game);
      if (step.time) {
        this.timer -= dt;
        if (this.timer <= 0) { this.failStep(game); return; }
      }
      const p = game.player;
      if (step.kind === 'goto' || step.kind === 'escape') {
        const d = Math.hypot(p.x - step.x, p.y - step.y);
        if (d < step.r) {
          if (step.kind === 'escape') {
            game.heatLock = 0;
            game.setWanted(0);
            game.banner('The safehouse door slams. Silence.');
          }
          this.completeStep(game);
        }
      } else if (step.kind === 'steal') {
        if (p.car && p.car.marked) this.completeStep(game);
      } else if (step.kind === 'fight') {
        const alive = game.enemies.reduce((n, e) => n + (e.state !== 'down' ? 1 : 0), 0);
        if (alive === 0 && this.spawnedTotal > 0) {
          if (this.wave < WAVE_SPOTS.length - 1) {
            this.wave += 1;
            game.banner(`Wave ${this.wave + 1} — over the fence!`);
            this.spawnWave(game);
          } else if (game.enemiesDown >= this.spawnedTotal) {
            game.banner('The strongbox is yours');
            this.fightActive = false;
            this.completeStep(game);
          }
        }
      }
    },
  };
}
