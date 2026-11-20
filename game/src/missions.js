// Eight jobs from fixer Auntie Bea, played strictly in sequence.
// Every job is a list of steps; each step has a world target that the
// HUD arrow, the minimap and a light pillar all point at. Timed steps
// reset themselves on timeout — the job itself is never lost.
// v2 adds two step kinds: 'combat' (clear every Ferro wave in the
// container yard) and 'pursuit' (a reach step run under pinned heat).

import { MISSION_REWARDS } from './config.js';
import { makeVehicle } from './entities.js';
import { spawnWave, enemiesStanding } from './weapons.js';
import { police, starsForHeat, clearWanted } from './police.js';

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
    brief: 'The Ferro crew is holding Bea\'s strongbox in the container yard. Three waves, ten guns. Take it back.',
    steps: [
      { label: 'Reach the Port Docks loading yard', x: 2900, y: 1420, r: 58, mode: 'any' },
      { label: 'Clear the Ferro crew from the container yard', x: 2790, y: 1470, r: 60, mode: 'any', kind: 'combat', waves: [3, 3, 4] },
      { label: 'Run the strongbox back to Bea\'s Kitchen', x: 1250, y: 430, r: 56, mode: 'any' },
    ],
  },
  {
    title: 'Searchlight Run',
    brief: 'Lift the impounded crate from the Customs cage and lose Air One before the clock dies. The Old Town safehouse washes the heat.',
    steps: [
      { label: 'Reach the Customs cage, Port Docks', x: 2600, y: 1180, r: 56, mode: 'any' },
      { label: 'Lose the pursuit — reach the Old Town safehouse', x: 200, y: 340, r: 64, mode: 'any', kind: 'pursuit', timer: 170, pinHeat: 170, pinStars: 4, clearWantedOnComplete: true },
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
  wave: 0,        // combat bookkeeping: waves already spawned
  waveDelay: 0,   // pause between combat waves
};

export function currentStep() {
  if (missions.done) return null;
  const job = JOBS[missions.jobIndex];
  return job ? job.steps[missions.stepIndex] : null;
}

export function currentJob() {
  return missions.done ? null : JOBS[missions.jobIndex];
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
  if (step.pinHeat) {
    // The pursuit step starts hot and stays hot until it ends.
    police.heat = Math.max(police.heat, step.pinHeat);
    police.stars = starsForHeat(police.heat);
    if (step.pinStars) police.stars = Math.max(police.stars, step.pinStars);
  }
  if (step.kind === 'combat' && missions.wave === 0 && game.enemies.length === 0) {
    missions.wave = 1;
    missions.waveDelay = 0;
    spawnWave(game, step.x, step.y, step.waves[0], 0);
    showMessage(game, 'The Ferro crew is dug in between the containers. Wave one — move!', 4.5);
  }
}

export function beginMissions(game) {
  missions.jobIndex = 0;
  missions.stepIndex = 0;
  missions.done = false;
  missions.solanoCar = null;
  missions.passengerAboard = false;
  missions.wave = 0;
  missions.waveDelay = 0;
  game.enemies.length = 0;
  startJobStep(game);
  const job = currentJob();
  if (job) showMessage(game, `JOB: ${job.title} — ${job.brief}`, 6);
}

export function showMessage(game, text, secs) {
  missions.message = text;
  missions.messageT = secs || 4;
  game.bannerText = text;
  game.bannerT = secs || 4;
}

function stepModeOk(step, game) {
  if (step.mode === 'car') return !!game.player.car;
  if (step.mode === 'foot') return !game.player.car;
  return true;
}

function completeStep(game) {
  game.audio?.pickup();
  const job = currentJob();
  const step = currentStep();
  if (step?.clearWantedOnComplete) {
    clearWanted();
    showMessage(game, 'The safehouse door rolls shut. Air One loses you in the rooftops.', 4.5);
  }
  missions.stepIndex++;
  missions.wave = 0;
  missions.waveDelay = 0;
  game.enemies.length = 0;

  if (step.passenger === undefined && currentStep()?.passenger) {
    missions.passengerAboard = true;
    showMessage(game, 'Lulu Mar is in. "Marina, darling — and step on it."', 4);
  }

  if (missions.stepIndex >= job.steps.length) {
    // Job complete: pay out and roll to the next job.
    const cash = MISSION_REWARDS.cash[missions.jobIndex];
    const respect = MISSION_REWARDS.respect[missions.jobIndex];
    game.cash += cash;
    game.respect += respect;
    game.jobsDone++;
    game.audio?.cashRegister();
    missions.jobIndex++;
    missions.stepIndex = 0;
    missions.passengerAboard = false;
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
    if (!step?.clearWantedOnComplete) showMessage(game, `Step done. ${currentStep().label}`, 3.5);
    startJobStep(game);
    game.save();
  }
}

// Returns true while the combat step is still being fought.
function updateCombatStep(dt, game, step) {
  const standing = enemiesStanding(game);
  if (standing > 0) return true;
  if (missions.wave < step.waves.length) {
    missions.waveDelay -= dt;
    if (missions.waveDelay <= 0) {
      missions.wave++;
      spawnWave(game, step.x, step.y, step.waves[missions.wave - 1], missions.wave - 1);
      showMessage(game, `Wave ${missions.wave} — the Ferro crew keeps coming!`, 3.5);
      missions.waveDelay = 0.9;
    }
    return true;
  }
  return false; // yard is clear: fall through to completion
}

export function updateMissions(dt, game) {
  missions.messageT = Math.max(0, missions.messageT - dt);
  const step = currentStep();
  if (!step || game.player.dead || game.player.busted) return;

  // Pursuit steps hold their heat no matter how well Rio hides.
  if (step.pinHeat) {
    if (police.heat < step.pinHeat) police.heat = step.pinHeat;
    police.stars = starsForHeat(police.heat);
    if (step.pinStars) police.stars = Math.max(police.stars, step.pinStars);
  }

  // Countdown for timed steps; expiry restarts just this step.
  if (missions.timerMax > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      showMessage(game, 'Out of time — the step resets. Go again.', 4);
      missions.timer = missions.timerMax;
      if (step.pinHeat) {
        police.heat = Math.max(police.heat, step.pinHeat);
        police.stars = starsForHeat(police.heat);
        if (step.pinStars) police.stars = Math.max(police.stars, step.pinStars);
      }
      game.audio?.fail();
      return;
    }
  }

  // Combat steps complete on kills, never on position.
  if (step.kind === 'combat') {
    if (updateCombatStep(dt, game, step)) return;
    completeStep(game);
    return;
  }

  // The Hot Solano delivery insists on the right car.
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

  // The steal step only completes once Rio is actually in the Solano.
  if (step.needMissionCar && game.player.car !== missions.solanoCar) return;

  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  const d = Math.hypot(px - step.x, py - step.y);
  if (d > step.r) return;

  completeStep(game);
}

export function objectiveDistance(game) {
  const step = currentStep();
  if (!step) return 0;
  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  return Math.round(Math.hypot(px - step.x, py - step.y));
}

export function ferroStanding(game) {
  return enemiesStanding(game);
}
