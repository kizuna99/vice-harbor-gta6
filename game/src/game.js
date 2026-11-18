// The simulation core of Vice Harbor: Rio on foot and behind the wheel, the traffic and
// pedestrian stepping, car stealing, collisions and the camera. Police, wanted and combat
// live here too (crime raises heat, heat brings the Serena PD). Missions read and steer
// this state through the small API at the bottom; rendering only reads it.

import {
  COUNTS, PLAYER, SAVE_KEY, STEP, VEHICLE, VIEW, WANTED, WORLD,
} from './config.js';
import { createRandom } from './random.js';
import { circleHitsBuilding, resolveCircleCollisions } from './world.js';
import {
  createParkedCars, createPedestrians, createTraffic, knockDownPedestrian,
  stepPedestrian, stepTrafficVehicle,
} from './entities.js';
import { createPoliceSystem } from './police.js';
import { createCombatSystem } from './combat.js';
import { nearestRoadPoint } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createGame(city, seed) {
  const random = createRandom(seed ^ 0xbeef);
  const traffic = createTraffic(random);
  const parked = createParkedCars(random);
  const pedestrians = createPedestrians(random);

  const state = {
    screen: SCREEN_TITLE,
    time: 0,
    cash: 120,
    respect: 0,
    missionIndex: 0,
    completedJobs: [],
    player: {
      x: city.places.start.x, y: city.places.start.y, angle: -Math.PI / 2,
      health: PLAYER.health, vehicle: null, punchCooldown: 0, arrestMeter: 0,
      busted: false, wasted: false,
    },
    vehicles: [...traffic, ...parked],
    traffic, parked, pedestrians,
    policeCars: [],
    officers: [],
    helicopter: null,
    wanted: 0,
    heatTimer: 0,
    hiddenTimer: 0,
    camera: { x: city.places.start.x, y: city.places.start.y },
    district: 'Palm Row',
    message: '',
    messageTimer: 0,
    objective: null,
    events: [],
    shake: 0,
    radioStation: 0,
    muted: false,
    timeOfDay: 0.34,
    skids: [],
    particles: [],
    passenger: null,
  };

  function emit(name) {
    state.events.push(name);
  }

  function playerPosition() {
    const p = state.player;
    return p.vehicle ? { x: p.vehicle.x, y: p.vehicle.y } : { x: p.x, y: p.y };
  }

  function raiseWanted(amount, reason) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.heatTimer = 0;
    if (state.wanted > before) {
      state.message = reason;
      state.messageTimer = 2.6;
      emit('crime');
    }
  }

  function nearestVehicle(x, y, maxDistance) {
    let best = null;
    let bestDistance = maxDistance;
    for (const vehicle of state.vehicles) {
      const distance = Math.hypot(vehicle.x - x, vehicle.y - y);
      if (distance < bestDistance) {
        best = vehicle;
        bestDistance = distance;
      }
    }
    return best;
  }

  function enterVehicle(vehicle) {
    const p = state.player;
    const wasTraffic = vehicle.driver === 'traffic';
    vehicle.driver = 'player';
    vehicle.speed = 0;
    p.vehicle = vehicle;
    emit('door');
    if (wasTraffic) {
      // The driver bails out and runs: a pedestrian now, and a witness to the theft.
      const witness = {
        x: vehicle.x + 30, y: vehicle.y + 10, angle: 0, speed: 60,
        color: '#e8e4d2', state: 'flee', stateTimer: 0, targetX: vehicle.x, targetY: vehicle.y, fallTimer: 0,
      };
      state.pedestrians.push(witness);
      raiseWanted(1, 'Car stolen — the Serena PD is on its way');
    }
  }

  function exitVehicle() {
    const p = state.player;
    if (!p.vehicle) return;
    const vehicle = p.vehicle;
    vehicle.driver = 'parked';
    vehicle.speed = 0;
    p.x = vehicle.x + Math.cos(vehicle.angle + Math.PI / 2) * 34;
    p.y = vehicle.y + Math.sin(vehicle.angle + Math.PI / 2) * 34;
    const fixed = resolveCircleCollisions(city.buildings, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.vehicle = null;
    emit('door');
  }

  function stepOnFoot(dt, input) {
    const p = state.player;
    const direction = input.direction();
    const length = Math.hypot(direction.x, direction.y);
    if (length > 0) {
      const speed = input.sprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const nx = (direction.x / length) * speed * dt;
      const ny = (direction.y / length) * speed * dt;
      p.x += nx;
      p.y += ny;
      p.angle = Math.atan2(direction.y, direction.x);
    }
    p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
    p.y = Math.max(30, Math.min(WORLD.waterY - 16, p.y));
    const fixed = resolveCircleCollisions(city.buildings, p.x, p.y, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
  }

  function stepDriving(dt, input) {
    const vehicle = state.player.vehicle;
    const model = vehicle.model;
    const throttle = input.throttle();
    if (throttle > 0) vehicle.speed += VEHICLE.accel * dt * (1 - Math.max(0, vehicle.speed) / model.maxSpeed);
    else if (throttle < 0) {
      if (vehicle.speed > 12) vehicle.speed -= VEHICLE.brake * dt;
      else vehicle.speed = Math.max(-VEHICLE.reverseMax, vehicle.speed - 190 * dt);
    }
    if (input.braking()) vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), VEHICLE.brake * dt);
    vehicle.speed -= vehicle.speed * VEHICLE.drag * dt;
    if (Math.abs(vehicle.speed) < 2 && throttle === 0) vehicle.speed = 0;
    const steer = input.steer();
    if (steer !== 0 && vehicle.speed !== 0) {
      const direction = vehicle.speed >= 0 ? 1 : -1;
      vehicle.angle += steer * VEHICLE.gripTurn * dt * direction * Math.min(1, Math.abs(vehicle.speed) / 190);
    }
    // Hard steering or braking at speed lays rubber: two short skid segments, pooled.
    if ((Math.abs(steer) > 0 && Math.abs(vehicle.speed) > 230) || (input.braking() && Math.abs(vehicle.speed) > 200)) {
      state.skids.push({ x: vehicle.x - Math.cos(vehicle.angle) * 16, y: vehicle.y - Math.sin(vehicle.angle) * 16 });
      if (state.skids.length > 300) state.skids.splice(0, state.skids.length - 300);
    }
    const nx = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * dt;
    const ny = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * dt;
    const radius = vehicle.kind === 'truck' ? VEHICLE.truckRadius : VEHICLE.radius;
    if (circleHitsBuilding(city.buildings, nx, ny, radius)) {
      if (Math.abs(vehicle.speed) > 150) {
        state.shake = Math.min(9, Math.abs(vehicle.speed) / 55);
        vehicle.health -= 9;
        burstParticles(nx, ny, '#f4e3b2', 10);
        emit('crash');
      }
      vehicle.speed *= -0.22;
    } else {
      vehicle.x = Math.max(40, Math.min(WORLD.width - 40, nx));
      vehicle.y = Math.max(40, Math.min(WORLD.waterY - 20, ny));
    }
    // Running someone down is a crime the whole street sees.
    for (const ped of state.pedestrians) {
      if (ped.state === 'down') continue;
      if (Math.abs(vehicle.speed) > 60 && Math.hypot(ped.x - vehicle.x, ped.y - vehicle.y) < radius + 11) {
        knockDownPedestrian(ped);
        raiseWanted(1, 'Hit and run — wanted level up');
        emit('thud');
      }
    }
  }

  function stepWorld(dt, input, actions) {
    state.time += dt;
    state.timeOfDay = (state.timeOfDay + dt / 260) % 1;
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 16);

    if (actions.enter || actions.confirm) {
      if (state.player.vehicle) exitVehicle();
      else {
        const vehicle = nearestVehicle(state.player.x, state.player.y, PLAYER.enterRange);
        if (vehicle) enterVehicle(vehicle);
      }
    }
    if (actions.reset) resetPosition();
    if (actions.radio) {
      state.radioStation = (state.radioStation + 1) % 3;
      emit('radio');
    }
    if (actions.horn && state.player.vehicle) emit('horn');

    if (state.player.vehicle) stepDriving(dt, input);
    else stepOnFoot(dt, input);

    for (const vehicle of state.traffic) {
      if (vehicle.driver === 'traffic') stepTrafficVehicle(vehicle, state.vehicles, random, dt);
    }
    const danger = state.wanted > 0 || (state.player.vehicle && Math.abs(state.player.vehicle.speed) > 330)
      ? playerPosition() : null;
    for (const ped of state.pedestrians) stepPedestrian(ped, random, dt, danger);

    stepPolice(dt);
    stepCombat(dt, actions);

    // The camera trails the player, looking ahead in the direction of travel.
    const focus = playerPosition();
    const lead = state.player.vehicle
      ? { x: Math.cos(state.player.vehicle.angle) * 66, y: Math.sin(state.player.vehicle.angle) * 66 }
      : { x: 0, y: 0 };
    state.camera.x += (focus.x + lead.x - state.camera.x) * Math.min(1, dt * 4.2);
    state.camera.y += (focus.y + lead.y - state.camera.y) * Math.min(1, dt * 4.2);
    state.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, state.camera.x));
    state.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2 + 190, state.camera.y));
  }

  let policeSystem = null;
  let combatSystem = null;
  function stepPolice(dt) {
    if (policeSystem) policeSystem.stepPolice(dt);
  }
  function stepCombat(dt, actions) {
    if (combatSystem) combatSystem.stepCombat(dt, actions);
  }

  function resetPosition() {
    const p = state.player;
    const focus = playerPosition();
    const road = nearestRoadPoint(focus.x, focus.y);
    if (p.vehicle) {
      p.vehicle.x = road.x;
      p.vehicle.y = road.y;
      p.vehicle.speed = 0;
    } else {
      p.x = road.x;
      p.y = road.y;
    }
    state.message = 'Back on the road';
    state.messageTimer = 1.4;
  }

  function burstParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= 240) state.particles.shift();
      const angle = random() * Math.PI * 2;
      const speed = 40 + random() * 150;
      state.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.55, color, size: 2 + random() * 3,
      });
    }
  }

  function saveGame() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, respect: state.respect, missionIndex: state.missionIndex,
        completedJobs: state.completedJobs, x: p.x, y: p.y,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.cash = data.cash ?? state.cash;
      state.respect = data.respect ?? 0;
      state.missionIndex = data.missionIndex ?? 0;
      state.completedJobs = data.completedJobs ?? [];
      state.player.x = data.x ?? state.player.x;
      state.player.y = data.y ?? state.player.y;
      return true;
    } catch {
      return false;
    }
  }

  function hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  const facade = { state, playerPosition, raiseWanted, emit };
  policeSystem = createPoliceSystem(facade, city, random);
  combatSystem = createCombatSystem(facade, city, random);

  return {
    state,
    step: stepWorld,
    playerPosition,
    nearestVehicle,
    raiseWanted,
    saveGame,
    loadGame,
    hasSave,
    emit,
    burstParticles,
    respawn() {
      if (combatSystem) combatSystem.respawnAtClinic(state.player.busted ? 'Busted' : 'Wasted');
    },
  };
}

export { STEP };
