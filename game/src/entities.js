// entities.js — vehicles, traffic AI, parked cars and pedestrians.
// Traffic follows the road network waypoint-to-waypoint; pedestrians
// wander the pavements and react to violence and reckless driving.

import { CFG, VEHICLE_MODELS, modelById } from './config.js';
import { RNG, clamp, dist, angleLerp } from './random.js';
import { world } from './world.js';

let nextId = 1;

export function makeVehicle(modelId, x, y, angle, kind) {
  const model = modelById(modelId);
  return {
    id: nextId++, model, modelId, x, y, angle, speed: 0,
    kind, // 'traffic' | 'parked' | 'police' | 'mission' | 'player'
    color: model.color, health: 100, driverBailed: false,
    waypoint: null, waitTimer: 0, honkTimer: 0, stolen: false,
    lightPhase: Math.random() * Math.PI * 2,
  };
}

function nearestIntersection(x, y) {
  let best = null, bd = Infinity;
  for (const p of world.intersections) {
    const d = dist(x, y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// Pick the next waypoint: an intersection one block away in a valid
// direction, biased to keep going straight so traffic feels purposeful.
function pickWaypoint(car, rng) {
  const cur = nearestIntersection(car.x, car.y);
  const options = [];
  for (const p of world.intersections) {
    const dx = Math.abs(p.x - cur.x), dy = Math.abs(p.y - cur.y);
    const oneBlock = (dx > 10 && dy < 10) || (dy > 10 && dx < 10);
    if (oneBlock) options.push(p);
  }
  if (!options.length) return cur;
  const hx = Math.cos(car.angle), hy = Math.sin(car.angle);
  let best = null, bestScore = -Infinity;
  for (const p of options) {
    const vx = p.x - cur.x, vy = p.y - cur.y, len = Math.hypot(vx, vy) || 1;
    const straight = (vx / len) * hx + (vy / len) * hy;
    const score = straight * 1.6 + rng.f() * 0.7;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

export function spawnTraffic(rng) {
  const cars = [];
  const civModels = VEHICLE_MODELS.filter((m) => !m.police);
  for (let i = 0; i < CFG.trafficCount; i++) {
    const spot = rng.pick(world.intersections);
    const m = rng.pick(civModels);
    let x = spot.x + rng.spread(30), y = spot.y + rng.spread(30);
    // Never spawn two cars on top of each other: an overlapped pair jams
    // forever because both brake for the "car ahead". Nudge along the
    // street until the spot is clear.
    for (let tries = 0; tries < 6; tries++) {
      const clash = cars.some((c) => dist(c.x, c.y, x, y) < 78);
      if (!clash) break;
      x += 90; if (x > CFG.worldW - 60) x = 80;
    }
    const car = makeVehicle(m.id, x, y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic');
    car.waypoint = pickWaypoint(car, rng);
    car.speed = rng.range(60, 110);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(rng) {
  const cars = [];
  const civModels = VEHICLE_MODELS.filter((m) => !m.police);
  for (let i = 0; i < CFG.parkedCount; i++) {
    // Park along avenues, nudged to the kerb.
    const ax = rng.pick(world.avenues);
    const y = rng.range(120, CFG.worldH - 120);
    const side = rng.chance(0.5) ? -1 : 1;
    const m = rng.pick(civModels);
    cars.push(makeVehicle(m.id, ax + side * (CFG.roadW / 2 - 14), y, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'parked'));
  }
  return cars;
}

export function updateTrafficCar(car, dt, vehicles, rng) {
  if (car.kind !== 'traffic') return;
  if (car.waitTimer > 0) { car.waitTimer -= dt; car.speed = Math.max(0, car.speed - 300 * dt); moveCar(car, dt); return; }
  if (!car.waypoint) car.waypoint = pickWaypoint(car, rng);
  const dx = car.waypoint.x - car.x, dy = car.waypoint.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 46) { car.waypoint = pickWaypoint(car, rng); return; }
  // Drive on the right-hand side of the road: aim at the waypoint shifted
  // by the lane offset along the right normal of the direction of travel.
  // Centre-line driving (the first version) meant opposing streams met
  // nose-to-nose at every block and ground the whole city down.
  const segAngle = Math.atan2(dy, dx);
  const tx = car.waypoint.x - Math.sin(segAngle) * CFG.laneOffset;
  const ty = car.waypoint.y + Math.cos(segAngle) * CFG.laneOffset;
  const targetAngle = Math.atan2(ty - car.y, tx - car.x);
  car.angle = angleLerp(car.angle, targetAngle, clamp(dt * 3.2, 0, 1));

  // Brake for a vehicle ahead in our lane.
  let desired = 150;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const other of vehicles) {
    if (other === car) continue;
    const ox = other.x - car.x, oy = other.y - car.y;
    const ahead = ox * fx + oy * fy;
    const side = Math.abs(-ox * fy + oy * fx);
    if (ahead > 0 && ahead < 74 && side < 20) { desired = Math.min(desired, Math.max(0, (ahead - 40) * 3)); }
  }
  const top = car.model.top * 0.52;
  desired = Math.min(desired, top);
  car.speed += clamp(desired - car.speed, -260 * dt, car.model.accel * 0.6 * dt);
  // Anti-deadlock: a car boxed in at a junction for a few seconds gives up
  // on its current leg and picks a different one, which un-knots queues.
  if (Math.abs(car.speed) < 6 && desired > 30) {
    car.stuckTimer = (car.stuckTimer || 0) + dt;
    if (car.stuckTimer > 2.6) { car.stuckTimer = 0; car.waypoint = pickWaypoint(car, rng); }
  } else car.stuckTimer = 0;
  moveCar(car, dt);
}

export function moveCar(car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const r = car.model.w / 2;
  const fixed = world.collideCircle(car.x, car.y, r * 0.72);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    car.x = fixed.x; car.y = fixed.y;
    car.speed *= 0.55;
    car.health -= Math.abs(car.speed) * 0.02;
  }
  car.x = clamp(car.x, 20, CFG.worldW - 20);
  car.y = clamp(car.y, 20, CFG.worldH - 20);
}

// --- Pedestrians -----------------------------------------------------------

const PED_COLORS = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#ffc6ff', '#f1fa8c'];

export function makePed(x, y, rng, role = 'civ') {
  return {
    id: nextId++, x, y, angle: rng.range(0, Math.PI * 2), speed: 0,
    color: rng.pick(PED_COLORS), role, state: 'stroll', stateTimer: 0,
    tx: x, ty: y, health: 30, fleeFrom: null, downTimer: 0, isPassenger: false,
  };
}

export function spawnPeds(rng) {
  const peds = [];
  for (let i = 0; i < CFG.pedCount; i++) {
    peds.push(makePed(rng.range(120, 2900), rng.range(120, 2280), rng));
  }
  return peds;
}

export function updatePed(ped, dt, threat, rng) {
  if (ped.isPassenger) return;
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0 && ped.health > 0) ped.state = 'flee';
    return;
  }
  let tx = ped.tx, ty = ped.ty, speed = 52;
  if (ped.state === 'flee' && ped.fleeFrom) {
    const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    tx = ped.x + Math.cos(away) * 220; ty = ped.y + Math.sin(away) * 220;
    speed = 172;
    ped.stateTimer -= dt;
    if (ped.stateTimer <= 0) { ped.state = 'stroll'; ped.fleeFrom = null; }
  } else {
    if (dist(ped.x, ped.y, tx, ty) < 14 || ped.stateTimer <= 0) {
      ped.tx = clamp(ped.x + rng.spread(300), 30, CFG.worldW - 30);
      ped.ty = clamp(ped.y + rng.spread(300), 30, CFG.worldH - 30);
      ped.stateTimer = rng.range(2, 5);
    }
    ped.stateTimer -= dt;
  }
  // React to a nearby threat (a punch, a speeding car, gunfire-free panic).
  if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 90 && ped.state !== 'flee') {
    ped.state = 'flee'; ped.fleeFrom = { x: threat.x, y: threat.y }; ped.stateTimer = 2.4;
  }
  const want = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle = angleLerp(ped.angle, want, clamp(dt * 6, 0, 1));
  ped.speed = speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  const fixed = world.collideCircle(ped.x, ped.y, CFG.playerRadius);
  ped.x = fixed.x; ped.y = fixed.y;
}

export function knockDownPed(ped, fromAngle) {
  ped.state = 'down';
  ped.downTimer = 3.2;
  ped.x += Math.cos(fromAngle) * 16;
  ped.y += Math.sin(fromAngle) * 16;
  ped.health -= 16;
}

// When the player steals a moving traffic car, its driver bails out and
// sprints away — the car becomes the player's, the driver becomes a ped.
export function bailDriver(car, peds, rng) {
  if (car.driverBailed) return null;
  car.driverBailed = true;
  const ped = makePed(car.x + 18, car.y + 10, rng);
  ped.state = 'flee'; ped.fleeFrom = { x: car.x, y: car.y }; ped.stateTimer = 3;
  peds.push(ped);
  return ped;
}

export { RNG };
