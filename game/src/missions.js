// The story of Vice Harbor: six jobs for fixer Auntie Bea that teach the city one system at
// a time — a first delivery, a neon street race, a marked car to steal, a VIP to ferry, cash
// to gather on the boardwalk, and a final getaway under the helicopter. Each job is a short
// list of steps; this system watches the player, moves the objective marker, runs the
// timers, pays the reward and saves. The renderer reads state.objective and state.jobInfo.

import { VEHICLE_MODELS } from './config.js';

const RACE_POINTS = [
  { x: 2100, y: 300, label: 'Checkpoint 1 — Palm Row North' },
  { x: 3300, y: 900, label: 'Checkpoint 2 — University East' },
  { x: 2700, y: 1500, label: 'Checkpoint 3 — Harbor Cross' },
  { x: 1500, y: 2100, label: 'Checkpoint 4 — Boardwalk South' },
  { x: 900, y: 900, label: 'Finish — Old Town West' },
];

export function createJobs(city) {
  const P = city.places;
  return [
    {
      id: 'first-run', title: 'First Run for Bea', reward: 150, respect: 1,
      intro: 'Bea: “Pick up a package at Serena Marina and bring it to Cafe Solano. Simple. Paid.”',
      steps: [
        { type: 'goto', place: P.marina, label: 'Pick up the package at Serena Marina', radius: 84 },
        { type: 'goto', place: P.cafe, label: 'Deliver the package to Cafe Solano', radius: 84 },
      ],
    },
    {
      id: 'neon-rush', title: 'Neon Rush', reward: 300, respect: 2,
      intro: 'Bea: “The Palm Row crew runs a checkpoint race at dusk. Win it and they owe us.”',
      steps: [
        { type: 'race', points: RACE_POINTS, label: 'Run the Neon Rush checkpoints', timer: 110 },
      ],
    },
    {
      id: 'hot-solano', title: 'Hot Solano', reward: 350, respect: 2,
      intro: 'Bea: “A blue Solano GT sits in the Marina lot. Take it. Solano Motors pays for it, no questions.”',
      steps: [
        { type: 'steal', place: P.marinaLot, label: 'Steal the blue Solano GT in the Marina lot', radius: 90 },
        { type: 'goto', place: P.chopShop, label: 'Deliver the Solano GT to Solano Motors', radius: 96, needVehicle: true },
      ],
    },
    {
      id: 'vip', title: 'VIP to the Marina', reward: 400, respect: 3,
      intro: 'Bea: “A singer named Lulu Mar is hiding at Hotel Brisa. Drive her to the Marina. Gently.”',
      steps: [
        { type: 'pickup', place: P.hotel, label: 'Pick up Lulu Mar at Hotel Brisa (stop your car)', radius: 92 },
        { type: 'goto', place: P.marina, label: 'Drive Lulu Mar to Serena Marina', radius: 96, needVehicle: true, timer: 130 },
      ],
    },
    {
      id: 'beach-money', title: 'Beach Money', reward: 250, respect: 2,
      intro: 'Bea: “Three drops were left along the Boardwalk. On foot, quiet, quick.”',
      steps: [
        { type: 'collect', places: [P.boardwalkWest, P.boardwalkMid, P.boardwalkEast], label: 'Collect the Boardwalk drops', radius: 52 },
      ],
    },
    {
      id: 'send-off', title: 'Serena Send-Off', reward: 600, respect: 4,
      intro: 'Bea: “Last job. Grab the freight at the Port Docks and reach Pier Nine — the whole SPD will object.”',
      steps: [
        { type: 'goto', place: P.docks, label: 'Pick up the freight at the Port Docks', radius: 96, needVehicle: true },
        { type: 'escape', place: P.pier, label: 'Reach Pier Nine — lose them or outrun them', radius: 100 },
      ],
    },
  ];
}

export function createMissionSystem(game, city, random) {
  const { state } = game;
  const jobs = createJobs(city);
  let stepIndex = 0;
  let stepTimer = 0;
  let raceIndex = 0;
  let collected = 0;
  let targetVehicle = null;
  let announcedJob = -1;
  let escapeHeatSet = false;

  function currentJob() {
    return jobs[state.missionIndex % jobs.length];
  }

  function currentStep() {
    return currentJob().steps[stepIndex];
  }

  function spawnTargetVehicle() {
    const model = VEHICLE_MODELS.find((m) => m.name === 'Solano GT');
    const place = city.places.marinaLot;
    targetVehicle = {
      x: place.x, y: place.y, angle: 0, speed: 0,
      model, color: model.color, kind: 'car', driver: 'mission',
      health: 100, honkTimer: 0, axis: 'x', direction: 1, cruise: 0,
    };
    state.vehicles.push(targetVehicle);
    state.parked.push(targetVehicle);
  }

  function setObjective(x, y, label) {
    const focus = game.playerPosition();
    state.objective = {
      x, y, label,
      distance: Math.round(Math.hypot(x - focus.x, y - focus.y)),
    };
  }

  function completeStep() {
    const job = currentJob();
    stepIndex += 1;
    stepTimer = 0;
    raceIndex = 0;
    collected = 0;
    escapeHeatSet = false;
    game.emit('step');
    if (stepIndex >= job.steps.length) completeJob(job);
    else state.message = currentStep().label;
    state.messageTimer = 3;
  }

  function completeJob(job) {
    state.cash += job.reward;
    state.respect += job.respect;
    if (!state.completedJobs.includes(job.id)) state.completedJobs.push(job.id);
    state.message = `Job done: ${job.title} — +$${job.reward}`;
    state.messageTimer = 4.2;
    game.emit('jobdone');
    stepIndex = 0;
    state.missionIndex = (state.missionIndex + 1) % jobs.length;
    announcedJob = -1;
    if (job.id === 'send-off') {
      state.wanted = 0;
      state.message = 'Story complete — Port Serena is yours. Jobs now repeat for cash.';
      state.messageTimer = 5;
    }
    game.saveGame();
  }

  function failTimerStep(reason) {
    stepTimer = 0;
    raceIndex = 0;
    state.message = reason;
    state.messageTimer = 3.4;
    game.emit('fail');
  }

  function update(dt) {
    const job = currentJob();
    if (announcedJob !== state.missionIndex) {
      announcedJob = state.missionIndex;
      state.message = job.intro;
      state.messageTimer = 5;
      if (job.id === 'hot-solano' && !targetVehicle) spawnTargetVehicle();
      if (job.id === 'neon-rush') state.timeOfDay = 0.86; // the race always runs at neon dusk
    }
    const step = currentStep();
    if (!step) return;
    const focus = game.playerPosition();
    const inVehicle = Boolean(state.player.vehicle);

    if (step.type === 'goto' || step.type === 'escape') {
      setObjective(step.place.x, step.place.y, step.label);
      if (step.type === 'escape' && !escapeHeatSet) {
        escapeHeatSet = true;
        if (state.wanted < 3) game.raiseWanted(3 - state.wanted, 'The SPD is all over this run');
      }
      if (step.timer) {
        stepTimer += dt;
        state.jobInfo = { title: job.title, label: step.label, timerLeft: Math.max(0, step.timer - stepTimer) };
        if (stepTimer > step.timer) {
          failTimerStep('Too slow — the job resets. Try again.');
          return;
        }
      } else {
        state.jobInfo = { title: job.title, label: step.label, timerLeft: null };
      }
      const distance = Math.hypot(focus.x - step.place.x, focus.y - step.place.y);
      if (distance <= step.radius && (!step.needVehicle || inVehicle)) completeStep();
      return;
    }

    if (step.type === 'steal') {
      const target = targetVehicle;
      if (target) setObjective(target.x, target.y, step.label);
      state.jobInfo = { title: job.title, label: step.label, timerLeft: null };
      if (target && state.player.vehicle === target) {
        game.raiseWanted(1, 'That is the car — the SPD noticed');
        completeStep();
      }
      return;
    }

    if (step.type === 'race') {
      const point = step.points[raceIndex];
      setObjective(point.x, point.y, `${step.label} (${raceIndex + 1}/${step.points.length})`);
      stepTimer += dt;
      state.jobInfo = { title: job.title, label: step.label, timerLeft: Math.max(0, step.timer - stepTimer) };
      if (stepTimer > step.timer) {
        failTimerStep('Out of time — the Neon Rush resets. Grab a fast car.');
        return;
      }
      if (inVehicle && Math.hypot(focus.x - point.x, focus.y - point.y) < 110) {
        raceIndex += 1;
        game.emit('checkpoint');
        if (raceIndex >= step.points.length) completeStep();
      }
      return;
    }

    if (step.type === 'pickup') {
      setObjective(step.place.x, step.place.y, step.label);
      state.jobInfo = { title: job.title, label: step.label, timerLeft: null };
      if (inVehicle && Math.abs(state.player.vehicle.speed) < 14
        && Math.hypot(focus.x - step.place.x, focus.y - step.place.y) <= step.radius) {
        state.passenger = { name: 'Lulu Mar' };
        state.message = 'Lulu Mar: “Marina. Fast, but keep the paint on.”';
        state.messageTimer = 3;
        completeStep();
      }
      return;
    }

    if (step.type === 'collect') {
      const remaining = step.places.slice(collected);
      const next = remaining[0];
      if (next) setObjective(next.x, next.y, `${step.label} (${collected}/${step.places.length})`);
      state.jobInfo = { title: job.title, label: step.label, timerLeft: null };
      if (!inVehicle && next && Math.hypot(focus.x - next.x, focus.y - next.y) <= step.radius) {
        collected += 1;
        state.cash += 25;
        game.emit('pickup');
        if (collected >= step.places.length) completeStep();
      }
    }
  }

  return { update, jobs, currentJob };
}
