// Auntie Bea's job list — eight jobs in strict sequence.
// Steps carry a world target the HUD, minimap and light pillar point
// at. Two step kinds break the mould: `combat` steps spawn waves of
// gunmen that must all go down, and the `escape` finale locks Rio's
// heat at four stars until he reaches the safehouse.

import { MISSION_REWARDS } from './config.js';
import { makeVehicle } from './entities.js';
import { makeEnemy } from './weapons.js';
import { resolveCollision } from './world.js';

export const JOBS = [
  {
    title: 'First Run for Bea',
    brief: 'Take the package from Bea\'s Kitchen to the Ferry Office at Serena Marina.',
    steps: [
      { label: 'Pick up the package at Bea\'s Kitchen', x: 1250, y: 430, r: 44, mode: 'foot' },
      { label: 'Deliver to the Ferry Office, Serena Marina', x: 620, y: 1180, r: 52, mode: 'any' },
    ],
  },
  {
    title: 'Neon Rush',
    brief: 'Hit all five checkpoints before the clock runs out. Dusk racing, Bea style.',
    steps: [
      { label: 'Checkpoint 1 — Palm Row lights', x: 1400, y: 200, r: 56, mode: 'car', timer: 95 },
      { label: 'Checkpoint 2 — University gate', x: 2600, y: 200, r: 56, mode: 'car' },
      { label: 'Checkpoint 3 — Customs House', x: 2600, y: 1000, r: 56, mode: 'car' },
      { label: 'Checkpoint 4 — Boardwalk Fries', x: 1400, y: 1000, r: 56, mode: 'car' },
      { label: 'Finish at Bea\'s Kitchen', x: 1250, y: 430, r: 56, mode: 'car' },
    ],
  },
  {
    title: 'Hot Solano',
    brief: 'A marked Solano GT is parked near the University. Take it to Warehouse 7 in the docks.',
    steps: [
      { label: 'Steal the marked Solano GT', x: 2380, y: 560, r: 60, mode: 'any', spawnSolano: true, needMissionCar: true },
      { label: 'Deliver the Solano to Warehouse 7', x: 2760, y: 1330, r: 58, mode: 'car', needModel: 'solano' },
    ],
  },
  {
    title: 'VIP to the Marina',
    brief: 'Singer Lulu Mar is waiting at the Hotel Palma. Ferry her to Serena Marina, fast and intact.',
    steps: [
      { label: 'Pick up Lulu Mar at Hotel Palma', x: 1560, y: 430, r: 52, mode: 'car' },
      { label: 'Drop Lulu at Serena Marina', x: 700, y: 1250, r: 56, mode: 'car', timer: 110, passenger: true },
    ],
  },
  {
    title: 'Beach Money',
    brief: 'Three debtors left cash along the Boardwalk. Collect all three on foot.',
    steps: [
      { label: 'Collect cash — Shell Shop', x: 1500, y: 1520, r: 36, mode: 'foot' },
      { label: 'Collect cash — Ocean Drive palms', x: 1900, y: 1560, r: 36, mode: 'foot' },
      { label: 'Collect cash — Boardwalk west end', x: 1180, y: 1500, r: 36, mode: 'foot' },
    ],
  },
  {
    title: 'Serena Send-Off',
    brief: 'Grab the Dockmaster at the Port Docks and make the run to the end of Pier Nine.',
    steps: [
      { label: 'Reach the Port Docks loading yard', x: 2900, y: 1420, r: 58, mode: 'any' },
      { label: 'Getaway: reach the end of Pier Nine', x: 2425, y: 1980, r: 62, mode: 'car', timer: 120, heatOnStart: 90 },
    ],
  },
  {
    title: 'Dockside Crossfire',
    brief: 'Ferro\'s crew jumped the strongbox crew at the docks. Clear every wave, then bring the box to Bea.',
    steps: [
      { label: 'Reach the Port Docks loading yard', x: 2900, y: 1420, r: 58, mode: 'any' },
      { label: 'Dockside Crossfire — clear all three waves', x: 2790, y: 1470, r: 60, mode: 'foot', type: 'combat', waves: [3, 3, 4] },
      { label: 'Bring the strongbox to Bea\'s Kitchen', x: 1250, y: 430, r: 56, mode: 'any' },
    ],
  },
  {
    title: 'Searchlight Run',
    brief: 'Air One has Rio lit up at four stars. Break line of sight and reach the Old Town safehouse.',
    steps: [
      { label: 'Reach the pickup east of the Boardwalk', x: 2600, y: 1180, r: 56, mode: 'any' },
      { label: 'Searchlight Run — reach the Old Town safehouse', x: 200, y: 340, r: 74, mode: 'any', type: 'escape', heatLock: 170, timer: 170 },
    ],
  },
];

export const missions = {
  jobIndex: 0,
  stepIndex: 0,
  timer: 0,
  timerMax: 0,
  done: false,
  solanoCar: null,
  passengerAboard: false,
  message: '',
  messageT: 0,
  combatKey: '',
  waveIndex: 0,
  waveDelayT: 0,
};

export function currentStep() {
  if (missions.done) return null;
  const job = JOBS[missions.jobIndex];
  return job ? job.steps[missions.stepIndex] : null;
}

export function currentJob() {
  return missions.done ? null : JOBS[missions.jobIndex];
}

export function showMessage(game, text, secs) {
  missions.message = text;
  missions.messageT = secs || 4;
  game.bannerText = text;
  game.bannerT = secs || 4;
}

function spawnWave(game, step, waveIdx) {
  const count = step.waves[waveIdx];
  const cx = step.x, cy = step.y;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + waveIdx * 0.7;
    const d = 120 + (i % 3) * 36;
    const e = makeEnemy(cx + Math.cos(a) * d, cy + Math.sin(a) * d, i === 0 ? 'ferro' : 'gunman');
    resolveCollision(e, 12);
    game.enemies.push(e);
  }
  missions.waveIndex = waveIdx;
  showMessage(game, `Wave ${waveIdx + 1} of ${step.waves.length} — ${count} hostiles!`, 3);
}

export function startJobStep(game) {
  const step = currentStep();
  if (!step) return;
  missions.timer = step.timer || 0;
  missions.timerMax = step.timer || 0;
  if (step.spawnSolano && !missions.solanoCar) {
    const car = makeVehicle(1, step.x, step.y, Math.PI / 2, '#d92632');
    car.parked = true; car.driver = false;
    car.isMissionCar = true;
    missions.solanoCar = car;
    game.cars.push(car);
  }
  if (step.heatOnStart) game.addHeat(step.heatOnStart);
  if (step.heatLock) {
    game.policeRef.heat = step.heatLock;
    game.policeRef.stars = 4;
  }
  if (step.type === 'combat') {
    const key = `${missions.jobIndex}:${missions.stepIndex}`;
    if (missions.combatKey !== key) {
      missions.combatKey = key;
      missions.waveIndex = 0;
      missions.waveDelayT = 0;
      game.enemies.length = 0;
      spawnWave(game, step, 0);
    }
  }
}

export function beginMissions(game) {
  missions.jobIndex = 0;
  missions.stepIndex = 0;
  missions.done = false;
  missions.solanoCar = null;
  missions.passengerAboard = false;
  missions.combatKey = '';
  startJobStep(game);
  const job = currentJob();
  if (job) showMessage(game, `JOB: ${job.title} — ${job.brief}`, 6);
}

function stepModeOk(step, game) {
  if (step.mode === 'car') return !!game.player.car;
  if (step.mode === 'foot') return !game.player.car;
  return true;
}

function advanceStep(game) {
  const job = currentJob();
  game.audio?.pickup();
  missions.stepIndex++;
  if (missions.stepIndex >= job.steps.length) {
    const cash = MISSION_REWARDS.cash[missions.jobIndex];
    const respect = MISSION_REWARDS.respect[missions.jobIndex];
    game.cash += cash;
    game.respect += respect;
    game.jobsDone++;
    game.audio?.cashRegister();
    missions.jobIndex++;
    missions.stepIndex = 0;
    missions.passengerAboard = false;
    missions.combatKey = '';
    if (missions.jobIndex >= JOBS.length) {
      missions.done = true;
      showMessage(game, 'All jobs done. Port Serena is yours, Rio. Free roam!', 7);
    } else {
      const next = currentJob();
      showMessage(game, `Job complete: +$${cash}, +${respect} respect. Next: ${next.title}`, 6);
      startJobStep(game);
    }
    game.save();
  } else {
    if (currentStep()?.passenger) {
      missions.passengerAboard = true;
      showMessage(game, 'Lulu Mar is in. "Marina, darling — and step on it."', 4);
    } else {
      showMessage(game, `Step done. ${currentStep().label}`, 3.5);
    }
    startJobStep(game);
    game.save();
  }
}

export function updateMissions(dt, game) {
  missions.messageT = Math.max(0, missions.messageT - dt);
  const step = currentStep();
  if (!step || game.player.dead || game.player.busted) return;

  if (missions.timerMax > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      showMessage(game, 'Out of time — the step resets. Go again.', 4);
      missions.timer = missions.timerMax;
      game.audio?.fail();
      return;
    }
  }

  // Combat steps resolve on kills, not arrival.
  if (step.type === 'combat') {
    const alive = game.enemies.filter((e) => e.state !== 'down').length;
    if (alive === 0) {
      if (missions.waveIndex + 1 < step.waves.length) {
        missions.waveDelayT -= dt;
        if (missions.waveDelayT <= 0) {
          spawnWave(game, step, missions.waveIndex + 1);
          missions.waveDelayT = 0.9;
        }
      } else {
        showMessage(game, 'Strongbox secured. Get it to Bea.', 4);
        advanceStep(game);
      }
    }
    return;
  }

  if (step.needModel) {
    const c = game.player.car;
    if (!c || c.model.id !== step.needModel) {
      const d = Math.hypot(game.player.x - step.x, game.player.y - step.y);
      if (d < step.r + 30 && game.hintT <= 0) {
        showMessage(game, 'Warehouse 7 only accepts the Solano GT.', 3);
        game.hintT = 5;
      }
      if (!(c && c.isMissionCar)) return;
    }
  }

  if (!stepModeOk(step, game)) return;
  if (step.needMissionCar && game.player.car !== missions.solanoCar) return;

  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  const d = Math.hypot(px - step.x, py - step.y);
  if (d > step.r) return;

  if (step.type === 'escape') {
    // Reaching the safehouse scrubs the locked heat completely.
    game.policeRef.heat = 0;
    game.policeRef.stars = 0;
    game.policeRef.cars.length = 0;
    game.policeRef.officers.length = 0;
    game.policeRef.heli = null;
    game.policeRef.arrest = 0;
  }
  advanceStep(game);
}

export function objectiveDistance(game) {
  const step = currentStep();
  if (!step) return 0;
  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  return Math.round(Math.hypot(px - step.x, py - step.y));
}
