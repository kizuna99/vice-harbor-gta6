// Entities: traffic cars, parked cars, pedestrians and the player.
// Traffic follows the avenue grid in right-hand lanes, brakes for the
// car ahead and turns at intersections. Pedestrians wander pavements,
// flee from danger and fall when struck. Cars carry v2 state too:
// stunt air time (airZ) and a wrecked flag once they cook off.

import { VEHICLES, PLAYER, WORLD, STUNT } from './config.js';
import { rand, range, pick, chance, clamp, angleLerp } from './random.js';
import { world, resolveCollision, collideRect } from './world.js';

let nextId = 1;

export function makeVehicle(modelIdx, x, y, angle, color) {
  const model = VEHICLES[modelIdx];
  return {
    id: nextId++,
    model, modelIdx,
    x, y, angle: angle || 0,
    speed: 0,
    w: model.w, h: model.h,
    color: color || pick(model.colors),
    driver: true,
    parked: false,
    police: !!model.police,
    stolen: false,
    damage: 0,          // 0..100; at 100 the car cooks off
    wrecked: false,
    roadblock: false,   // set on SPD roadblock cruisers
    honkT: 0,
    airZ: 0,            // stunt height above the road, px
    airVz: 0,
    airPeak: 0,
    smokeT: 0,          // burning-wreck particle timer
    // traffic brain
    laneAxis: null,   // 'x' travelling along a horizontal street, 'y' vertical
    laneLine: 0,      // centre line of current road
    dirSign: 1,
    turnCooldown: 0,
    brakeLight: false,
  };
}

export function laneOffsetFor(v) {
  // Right-hand traffic: offset to the right of the direction of travel.
  void v;
  return 24;
}

export function spawnTraffic(count) {
  const cars = [];
  const spots = [];
  for (const ry of world.roadsY) {
    for (let x = 120; x < WORLD.width - 120; x += 260) spots.push({ x: x + range(-40, 40), y: ry, horiz: true });
  }
  for (const rx of world.roadsX) {
    for (let y = 120; y < 1600; y += 260) spots.push({ x: rx, y: y + range(-40, 40), horiz: false });
  }
  for (let i = 0; i < count && spots.length; i++) {
    const s = spots.splice(Math.floor(rand() * spots.length), 1)[0];
    const mi = Math.floor(rand() * 5); // never spawn cruisers as traffic
    const dir = chance(0.5) ? 1 : -1;
    const v = makeVehicle(mi, s.x, s.y, 0);
    if (s.horiz) {
      v.laneAxis = 'x'; v.laneLine = s.y; v.dirSign = dir;
      v.y = s.y + dir * laneOffsetFor(v);
      v.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      v.laneAxis = 'y'; v.laneLine = s.x; v.dirSign = dir;
      v.x = s.x - dir * laneOffsetFor(v);
      v.angle = dir > 0 ? Math.PI : 0;
    }
    v.speed = range(60, 110);
    cars.push(v);
  }
  return cars;
}

export function spawnParked(count) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 30) {
    tries++;
    const x = range(80, WORLD.width - 80);
    const y = range(80, 1580);
    if (collideRect(x, y, 30)) continue;
    const mi = Math.floor(rand() * 5);
    const v = makeVehicle(mi, x, y, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    v.parked = true; v.driver = false; v.speed = 0;
    cars.push(v);
  }
  return cars;
}

export function makePed(x, y) {
  return {
    id: nextId++,
    x, y, angle: range(0, Math.PI * 2),
    speed: 0, state: 'stroll', // stroll | flee | down
    tx: x, ty: y, retarget: range(1, 4),
    health: 60, downT: 0,
    shirt: pick(['#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#f2f2f2']),
    skin: pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    panic: 0,
  };
}

export function spawnPeds(count) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < count * 40) {
    tries++;
    const x = range(60, WORLD.width - 60);
    const y = range(60, 1620);
    if (collideRect(x, y, 14)) continue;
    peds.push(makePed(x, y));
  }
  return peds;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: PLAYER.maxHealth,
    armor: 0,           // v2: kevlar points, refilled at Serena Munitions
    weapon: 'fists',    // v2: currently drawn weapon id
    car: null,
    punchT: 0, punchAnim: 0,
    dead: false, busted: false,
    walkCycle: 0,
  };
}

// --- traffic update -------------------------------------------------------

function nearestIntersection(v) {
  // Distance ahead to the next crossing road along travel direction.
  let best = Infinity;
  if (v.laneAxis === 'x') {
    for (const rx of world.roadsX) {
      const d = (rx - v.x) * v.dirSign;
      if (d > 10 && d < best) best = d;
    }
  } else {
    for (const ry of world.roadsY) {
      const d = (ry - v.y) * v.dirSign;
      if (d > 10 && d < best) best = d;
    }
  }
  return best;
}

export function updateTrafficCar(v, dt, allCars, player, events, peds) {
  if (v.parked || v.police || v.wrecked || v === player.car) return;
  v.turnCooldown -= dt;
  v.honkT -= dt;

  // Desired speed, slowed by the vehicle directly ahead in the same lane.
  let want = 120;
  v.brakeLight = false;
  for (const o of allCars) {
    if (o === v) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const fx = Math.sin(v.angle), fy = -Math.cos(v.angle);
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 74 && side < 26) {
      want = Math.min(want, Math.max(0, (ahead - 52) * 3));
      v.brakeLight = v.speed > want + 4;
      if (ahead < 56 && v.honkT <= 0 && events) { events.push({ type: 'honk', x: v.x, y: v.y }); v.honkT = 2.4; }
    }
  }
  // A pedestrian in the road makes traffic brake too: anyone standing
  // in the lane corridor ahead brings the car to a full stop.
  if (peds) {
    const fx = Math.sin(v.angle), fy = -Math.cos(v.angle);
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - v.x, dy = ped.y - v.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(dx * fy - dy * fx);
      if (ahead > 0 && ahead < 58 && side < 20) {
        want = 0;
        v.brakeLight = true;
        break;
      }
    }
  }

  // Maybe turn at the next intersection.
  const distCross = nearestIntersection(v);
  if (distCross < 30 && v.turnCooldown <= 0 && chance(0.34)) {
    if (v.laneAxis === 'x') {
      // snap onto the vertical avenue we are crossing
      let line = v.laneLine;
      let bestD = Infinity;
      for (const rx of world.roadsX) { const d = Math.abs(rx - v.x); if (d < bestD) { bestD = d; line = rx; } }
      v.laneAxis = 'y'; v.laneLine = line;
      v.dirSign = chance(0.5) ? 1 : -1;
    } else {
      let line = v.laneLine;
      let bestD = Infinity;
      for (const ry of world.roadsY) { const d = Math.abs(ry - v.y); if (d < bestD) { bestD = d; line = ry; } }
      v.laneAxis = 'x'; v.laneLine = line;
      v.dirSign = chance(0.5) ? 1 : -1;
    }
    v.turnCooldown = 1.6;
  }

  // Steer toward the lane centre, offset for right-hand traffic.
  let tx, ty, targetAngle;
  if (v.laneAxis === 'x') {
    ty = v.laneLine + v.dirSign * laneOffsetFor(v);
    tx = v.x + v.dirSign * 120;
    targetAngle = v.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    tx = v.laneLine - v.dirSign * laneOffsetFor(v);
    ty = v.y + v.dirSign * 120;
    targetAngle = v.dirSign > 0 ? Math.PI : 0;
  }
  // Blend heading toward lane direction; lateral correction via lane pull.
  v.angle = angleLerp(v.angle, targetAngle, Math.min(1, dt * 3.2));
  if (v.laneAxis === 'x') v.y += (ty - v.y) * Math.min(1, dt * 2.4);
  else v.x += (tx - v.x) * Math.min(1, dt * 2.4);

  // Speed control.
  const accel = v.model.accel * 0.45;
  if (v.speed < want) v.speed = Math.min(want, v.speed + accel * dt);
  else v.speed = Math.max(want, v.speed - 320 * dt);

  v.x += Math.sin(v.angle) * v.speed * dt;
  v.y += -Math.cos(v.angle) * v.speed * dt;

  // Despawn far off-map wanderers back onto the grid.
  if (v.x < 30 || v.x > WORLD.width - 30 || v.y < 30 || v.y > 1640) {
    v.x = clamp(v.x, 60, WORLD.width - 60);
    v.y = clamp(v.y, 60, 1600);
  }
  resolveCollision(v, 20);
}

// --- pedestrian update ----------------------------------------------------

export function updatePed(p, dt, threat) {
  if (p.state === 'down') {
    p.downT -= dt;
    if (p.downT <= 0 && p.health > 0) p.state = 'flee';
    return;
  }
  p.retarget -= dt;

  if (threat && threat.active) {
    const dx = p.x - threat.x, dy = p.y - threat.y;
    const d = Math.hypot(dx, dy);
    if (d < threat.radius) {
      p.state = 'flee';
      p.angle = Math.atan2(dx, -dy);
      p.speed = 175;
      p.panic = 1.5;
    }
  }
  if (p.state === 'flee') {
    p.panic -= dt;
    if (p.panic <= 0) { p.state = 'stroll'; p.speed = 0; }
  } else {
    if (p.retarget <= 0) {
      p.retarget = range(2, 5);
      p.tx = clamp(p.x + range(-220, 220), 40, WORLD.width - 40);
      p.ty = clamp(p.y + range(-220, 220), 40, 1630);
      if (collideRect(p.tx, p.ty, 14)) { p.tx = p.x; p.ty = p.y; }
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      p.angle = Math.atan2(dx, -dy);
      p.speed = 62;
    } else p.speed = 0;
  }

  p.x += Math.sin(p.angle) * p.speed * dt;
  p.y += -Math.cos(p.angle) * p.speed * dt;
  resolveCollision(p, 10);
}

export function knockPed(p, fromAngle) {
  p.state = 'down';
  p.downT = 3.2;
  p.health -= 40;
  p.angle = fromAngle;
}

// --- player update --------------------------------------------------------

export function updatePlayerOnFoot(player, dt, input) {
  const sp = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = input.x, my = input.y;
  const len = Math.hypot(mx, my);
  if (len > 0.01) {
    mx /= Math.max(1, len); my /= Math.max(1, len);
    player.angle = Math.atan2(mx, -my);
    player.walkCycle += dt * (input.sprint ? 13 : 9);
  } else {
    player.walkCycle = 0;
  }
  player.x += mx * sp * dt * (len > 0 ? 1 : 0);
  player.y += my * sp * dt * (len > 0 ? 1 : 0);
  resolveCollision(player, PLAYER.radius);
  player.punchT = Math.max(0, player.punchT - dt);
  player.punchAnim = Math.max(0, player.punchAnim - dt * 5);
}

// Integrates stunt air time. Returns the landing peak (px) on the tick
// the car touches down, otherwise 0.
export function updateAirborne(car, dt) {
  if (car.airZ <= 0 && car.airVz <= 0) return 0;
  car.airVz -= STUNT.gravity * dt;
  car.airZ += car.airVz * dt;
  if (car.airZ > car.airPeak) car.airPeak = car.airZ;
  if (car.airZ <= 0) {
    car.airZ = 0;
    car.airVz = 0;
    const peak = car.airPeak;
    car.airPeak = 0;
    return peak;
  }
  return 0;
}

export function updatePlayerCar(car, dt, input, tuneMul) {
  const m = car.model;
  const tune = tuneMul || 1;
  if (car.wrecked) {
    car.speed -= car.speed * 2.2 * dt;
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y += -Math.cos(car.angle) * car.speed * dt;
    return false;
  }
  const throttle = input.y < 0 ? 1 : input.y > 0 ? -0.55 : 0;
  if (throttle > 0) car.speed += m.accel * tune * dt;
  else if (throttle < 0) car.speed += m.accel * 0.6 * dt * (car.speed > 12 ? -2.2 : 1);
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * 420 * dt;
  if (throttle === 0 && Math.abs(car.speed) < 4) car.speed = 0;
  car.speed = clamp(car.speed, -m.topSpeed * 0.4, m.topSpeed * tune);

  const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += input.x * 1.9 * steerAuthority * dt * (1 - Math.abs(car.speed) / (m.topSpeed * 2.6));

  const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;

  // While airborne the car sails over the scenery: no collision push.
  if (car.airZ > 0 || car.airVz > 0) return false;

  const beforeX = car.x, beforeY = car.y;
  resolveCollision(car, 22);
  if (Math.hypot(car.x - beforeX, car.y - beforeY) > 6 && Math.abs(car.speed) > 90) {
    car.damage += 6 * (car.plateMul || 1); // Serena Customs plating halves it
    car.speed *= 0.45;
    return true; // hard impact this tick
  }
  return false;
}

export function nearestEnterableCar(player, cars) {
  let best = null, bestD = 52 * 52;
  for (const c of cars) {
    if (c.wrecked) continue;
    const dx = c.x - player.x, dy = c.y - player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
