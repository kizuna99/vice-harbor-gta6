// Staged scenes for the maker's screenshots (?shot=cover|chase|mission|finale&seed=N).
// Each scene drives the real simulation with scripted inputs for a few seconds — traffic
// flows, the police converge, the helicopter arrives — then freezes on a frame the game
// itself produced. Same seed, same frame, every time.

import { STEP } from './config.js';

function scriptedInput(throttle, steer) {
  return {
    direction: () => ({ x: throttle, y: 0 }),
    throttle: () => throttle,
    steer: () => steer,
    sprinting: () => false,
    braking: () => false,
    takeActions: () => 0,
    mouseState: () => ({ x: 0, y: 0, down: false }),
    touchState: () => ({ active: false, held: new Set() }),
  };
}

const NO_ACTIONS = { enter: false, attack: false, confirm: false, pause: false, radio: false, horn: false, reset: false };

function runSteps(game, steps, input) {
  for (let i = 0; i < steps; i += 1) game.step(STEP, input, NO_ACTIONS);
}

function putPlayerInCar(game, car, x, y, angle, speed) {
  const { state } = game;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.driver = 'player';
  state.player.vehicle = car;
  state.player.x = x;
  state.player.y = y;
  state.camera.x = x;
  state.camera.y = y;
}

/** Keep the frozen frame readable: no other vehicle may sit on top of the player's car. */
function clearSpaceAroundPlayer(game, radius) {
  const { state } = game;
  const focus = game.playerPosition();
  for (const vehicle of state.vehicles) {
    if (state.player.vehicle && vehicle === state.player.vehicle) continue;
    const dx = vehicle.x - focus.x;
    const dy = vehicle.y - focus.y;
    if (Math.hypot(dx, dy) < radius) {
      vehicle.x += dx >= 0 ? 170 : -170;
      vehicle.y += dy >= 0 ? 60 : -60;
    }
  }
}

export function stageShot(name, game, missions) {
  const { state } = game;
  state.screen = 'play';

  if (name === 'chase') {
    state.missionIndex = 5;
    state.timeOfDay = 0.82;
    const car = state.parked.find((v) => v.model.name === 'Solano GT') ?? state.parked[0];
    putPlayerInCar(game, car, 2050, 930, 0, 300);
    state.wanted = 4;
    runSteps(game, 300, scriptedInput(1, 0));
    // Make sure the pursuit is in frame even if the spawns rolled far away.
    const focus = game.playerPosition();
    const near = state.policeCars.some((c) => Math.hypot(c.x - focus.x, c.y - focus.y) < 520);
    if (!near && state.policeCars.length > 0) {
      state.policeCars[0].x = focus.x - 190;
      state.policeCars[0].y = focus.y + 90;
      if (state.policeCars[1]) {
        state.policeCars[1].x = focus.x - 320;
        state.policeCars[1].y = focus.y - 120;
      }
    }
    missions.update(0);
    state.objective = { x: 2620, y: 2600, label: 'Reach Pier Nine — lose them or outrun them', distance: 1750 };
    state.jobInfo = { title: 'Serena Send-Off', label: 'Reach Pier Nine — lose them or outrun them', timerLeft: null };
    clearSpaceAroundPlayer(game, 95);
    return;
  }

  if (name === 'mission') {
    state.missionIndex = 4;
    state.timeOfDay = 0.4;
    state.player.x = 1460;
    state.player.y = 2290;
    state.player.angle = 0.4;
    state.camera.x = 1460;
    state.camera.y = 2290;
    runSteps(game, 150, scriptedInput(0, 0));
    missions.update(0);
    return;
  }

  if (name === 'finale') {
    state.missionIndex = 5;
    state.timeOfDay = 0.9;
    const truck = state.parked.find((v) => v.kind === 'truck') ?? state.parked[1];
    // Westbound on Ocean Drive, the pier in sight, the pursuit stacked up behind.
    putPlayerInCar(game, truck, 3180, 2457, Math.PI, 205);
    state.wanted = 3;
    runSteps(game, 150, scriptedInput(1, 0));
    const focus = game.playerPosition();
    if (state.policeCars.length > 0) {
      state.policeCars[0].x = focus.x + 185;
      state.policeCars[0].y = focus.y - 8;
      state.policeCars[0].angle = Math.PI;
    }
    if (state.policeCars.length > 1) {
      state.policeCars[1].x = focus.x + 330;
      state.policeCars[1].y = focus.y + 26;
      state.policeCars[1].angle = Math.PI;
    }
    missions.update(0);
    state.objective = { x: 2620, y: 2600, label: 'Reach Pier Nine — lose them or outrun them', distance: 640 };
    state.jobInfo = { title: 'Serena Send-Off', label: 'Reach Pier Nine — lose them or outrun them', timerLeft: null };
    clearSpaceAroundPlayer(game, 90);
    return;
  }

  // cover (default): golden-hour drive along Harbor Cross with the first job on the HUD.
  state.missionIndex = 0;
  state.timeOfDay = 0.6;
  const car = state.parked.find((v) => v.model.name === 'Brisa Convertible') ?? state.parked[0];
  putPlayerInCar(game, car, 1150, 1532, 0, 235);
  runSteps(game, 170, scriptedInput(1, 0));
  missions.update(0);
  clearSpaceAroundPlayer(game, 95);
}
