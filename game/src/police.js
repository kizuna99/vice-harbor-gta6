// The Serena Police Department: wanted heat, patrol cars that pursue, officers who chase
// on foot and arrest, and the helicopter that joins at three stars. Police read the same
// city the player drives: cars spawn on roads at the edge of sight, steer by pursuit, and
// officers spill out of them when the player is on foot. More stars mean more cars, faster
// cars and a shorter temper — and heat only cools while no uniform can see the player.
// Recorded-session note: pursuit steering slides along buildings axis-by-axis instead of
// bouncing, so a chase through the Old Town grid stays a chase and never a traffic jam.

import { VEHICLE, WANTED, WORLD } from './config.js';
import { nearestRoadPoint, circleHitsBuilding } from './world.js';

const POLICE_MODEL = { name: 'SPD Interceptor', color: '#274690', maxSpeed: 470, kind: 'car' };

function spawnPoliceCar(state, random) {
  const focus = state.player.vehicle
    ? { x: state.player.vehicle.x, y: state.player.vehicle.y }
    : { x: state.player.x, y: state.player.y };
  const angle = random() * Math.PI * 2;
  const rawX = Math.max(80, Math.min(WORLD.width - 80, focus.x + Math.cos(angle) * 780));
  const rawY = Math.max(80, Math.min(WORLD.beachY - 60, focus.y + Math.sin(angle) * 780));
  const road = nearestRoadPoint(rawX, rawY);
  return {
    x: road.x, y: road.y,
    angle: Math.atan2(focus.y - road.y, focus.x - road.x),
    speed: 0, model: POLICE_MODEL, color: POLICE_MODEL.color, kind: 'car',
    driver: 'police', health: 100, honkTimer: 0, axis: 'x', direction: 1, cruise: 0,
    sirenPhase: random() * Math.PI * 2, officerOut: false, stuckTimer: 0,
  };
}

function steerVehicleToward(vehicle, target, maxSpeed, dt, buildings) {
  const dx = target.x - vehicle.x;
  const dy = target.y - vehicle.y;
  const distance = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  let turn = desired - vehicle.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  vehicle.angle += Math.max(-2.5 * dt, Math.min(2.5 * dt, turn));
  const targetSpeed = distance > 70 ? maxSpeed : maxSpeed * 0.3;
  vehicle.speed += Math.max(-430 * dt, Math.min(310 * dt, targetSpeed - vehicle.speed));
  const nx = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * dt;
  const ny = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * dt;
  if (!circleHitsBuilding(buildings, nx, ny, VEHICLE.radius)) {
    vehicle.x = nx;
    vehicle.y = ny;
    vehicle.stuckTimer = 0;
  } else if (!circleHitsBuilding(buildings, nx, vehicle.y, VEHICLE.radius)) {
    vehicle.x = nx;
    vehicle.speed *= 0.55;
  } else if (!circleHitsBuilding(buildings, vehicle.x, ny, VEHICLE.radius)) {
    vehicle.y = ny;
    vehicle.speed *= 0.55;
  } else {
    vehicle.speed *= -0.3;
    vehicle.stuckTimer += dt;
  }
  vehicle.x = Math.max(40, Math.min(WORLD.width - 40, vehicle.x));
  vehicle.y = Math.max(40, Math.min(WORLD.waterY - 24, vehicle.y));
  return distance;
}

export function createPoliceSystem(game, city, random) {
  const { state } = game;

  function desiredPoliceCars() {
    return state.wanted === 0 ? 0 : state.wanted + 1;
  }

  function anyPoliceNear(radius) {
    const focus = game.playerPosition();
    if (state.helicopter) return true;
    for (const car of state.policeCars) {
      if (Math.hypot(car.x - focus.x, car.y - focus.y) < radius) return true;
    }
    for (const officer of state.officers) {
      if (Math.hypot(officer.x - focus.x, officer.y - focus.y) < radius) return true;
    }
    return false;
  }

  function spawnOfficer(car) {
    state.officers.push({
      x: car.x + 30, y: car.y + 16, angle: 0, speed: 196,
      color: '#274690', state: 'chase', stateTimer: 0,
      targetX: car.x, targetY: car.y, fallTimer: 0, hitCooldown: 0, car,
    });
    car.officerOut = true;
  }

  function stepPolice(dt) {
    // Heat cools only while nobody in uniform can see the player.
    state.heatTimer += dt;
    if (state.wanted > 0 && state.heatTimer > 4 && !anyPoliceNear(430)) {
      state.hiddenTimer += dt;
      if (state.hiddenTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.hiddenTimer = 0;
        state.heatTimer = 0;
        state.message = state.wanted === 0 ? 'You lost the cops — heat cleared' : 'Heat is cooling — stay out of sight';
        state.messageTimer = 2.4;
        game.emit('clear');
      }
    } else {
      state.hiddenTimer = 0;
    }

    // Keep the pursuit at the size the wanted level calls for.
    const wanted = desiredPoliceCars();
    while (state.policeCars.length < wanted) {
      const car = spawnPoliceCar(state, random);
      state.policeCars.push(car);
      state.vehicles.push(car);
    }
    if (state.wanted === 0 && state.policeCars.length > 0) {
      for (const car of state.policeCars) {
        const index = state.vehicles.indexOf(car);
        if (index >= 0) state.vehicles.splice(index, 1);
      }
      state.policeCars = [];
      state.officers = [];
    }

    const focus = game.playerPosition();
    const pursuitSpeed = 305 + state.wanted * 38;
    for (const car of state.policeCars) {
      const distance = steerVehicleToward(car, focus, pursuitSpeed, dt, city.buildings);
      if (!state.player.vehicle && distance < 120 && !car.officerOut) spawnOfficer(car);
      if (state.player.vehicle && distance < VEHICLE.radius + 26 && Math.abs(car.speed) > 120 && Math.abs(state.player.vehicle.speed) < 60) {
        state.shake = Math.max(state.shake, 4);
        game.emit('crash');
        car.speed *= 0.4;
      }
      if (car.stuckTimer > 1.4) {
        const road = nearestRoadPoint(car.x, car.y);
        car.x = road.x;
        car.y = road.y;
        car.stuckTimer = 0;
      }
    }

    // Officers chase on foot, tackle, and build the arrest.
    const p = state.player;
    let arresting = false;
    for (const officer of state.officers) {
      if (officer.state === 'down') {
        officer.fallTimer -= dt;
        if (officer.fallTimer <= 0) officer.state = 'chase';
        continue;
      }
      const dx = p.x - officer.x;
      const dy = p.y - officer.y;
      const distance = Math.hypot(dx, dy);
      if (!p.vehicle && distance > 4) {
        officer.x += (dx / distance) * officer.speed * dt;
        officer.y += (dy / distance) * officer.speed * dt;
        officer.angle = Math.atan2(dy, dx);
      }
      if (!p.vehicle && distance < 30) {
        arresting = true;
        officer.hitCooldown -= dt;
        if (officer.hitCooldown <= 0) {
          officer.hitCooldown = 0.9;
          p.health -= 5;
          game.emit('thud');
        }
      }
    }
    if (!p.vehicle && state.wanted > 0 && arresting) {
      p.arrestMeter += dt / WANTED.arrestSeconds;
      if (p.arrestMeter >= 1) {
        p.busted = true;
        state.screen = 'over';
        game.emit('busted');
      }
    } else {
      p.arrestMeter = Math.max(0, p.arrestMeter - dt * 0.7);
    }

    // The helicopter joins at three stars: a circling spotlight that keeps the player lit.
    if (state.wanted >= WANTED.helicopterStar) {
      if (!state.helicopter) {
        state.helicopter = { x: focus.x + 300, y: focus.y - 260, angle: 0, orbit: random() * Math.PI * 2 };
        game.emit('heli');
      }
      const heli = state.helicopter;
      heli.orbit += dt * 0.55;
      heli.x += (focus.x + Math.cos(heli.orbit) * 210 - heli.x) * Math.min(1, dt * 1.6);
      heli.y += (focus.y + Math.sin(heli.orbit) * 150 - heli.y) * Math.min(1, dt * 1.6);
      heli.angle = Math.atan2(focus.y - heli.y, focus.x - heli.x);
    } else {
      state.helicopter = null;
    }
  }

  return { stepPolice, anyPoliceNear, desiredPoliceCars };
}
