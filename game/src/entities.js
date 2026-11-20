// entities.js — the living layer: Rio (the player), the six car models
// as traffic and parked stock, and the pedestrians of Port Serena.
// Traffic follows the road grid lane by lane and turns at crossings;
// pedestrians keep to the sidewalks unless something scares them.

import { CAR_TYPES, WORLD_W, WORLD_H } from './config.js';
import { AVENUES_X, STREETS_Y, ROAD_W, RAMPS, isWater, collideCircle } from './world.js';
import { makeRng, rngPick, rngRange, clamp, angleDelta } from './random.js';

export function makePlayer() {
  return {
    x: 1250, y: 520, angle: 0, radius: 13,
    health: 100, armor: 0, weapon: 'fists', car: null,
    walkCycle: 0, speedNow: 0, fireCd: 0, reloadT: 0, muzzle: 0,
  };
}

let carSeq = 0;
export function makeCar(typeId, x, y, angle, rng) {
  const type = CAR_TYPES.find((t) => t.id === typeId) || CAR_TYPES[2];
  return {
    id: ++carSeq, type, typeId, x, y, angle, speed: 0,
    colour: rng ? rngPick(rng, type.colours) : type.colours[0],
    driver: null, parked: false, wrecked: false, exploding: 0,
    damage: 0, airZ: 0, airVz: 0, radius: type.w / 2,
    cruise: rngRange(rng || Math.random, 92, 138), marked: false, roadblock: false, police: false,
  };
}

const CARDINALS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
function laneLine(car) {
  // the centre-line coordinate a car should hold on its current road
  const f = { x: Math.sin(car.angle), y: -Math.cos(car.angle) };
  if (Math.abs(f.y) > 0.5) { // travelling north/south along an avenue
    let best = AVENUES_X[0];
    for (const ax of AVENUES_X) if (Math.abs(ax - car.x) < Math.abs(best - car.x)) best = ax;
    return { axis: 'x', at: best + (f.y < 0 ? 27 : -27) };
  }
  let best = STREETS_Y[0];
  for (const sy of STREETS_Y) if (Math.abs(sy - car.y) < Math.abs(best - car.y)) best = sy;
  return { axis: 'y', at: best + (f.x > 0 ? 27 : -27) };
}

export function spawnTraffic(world, seed) {
  const rng = makeRng(seed * 31 + 7);
  const cars = [];
  // rolling traffic, dealt onto the avenues and streets
  for (let i = 0; i < 24; i++) {
    const typeId = rngPick(rng, ['coupe', 'sedan', 'sedan', 'taxi', 'gt', 'truck']);
    let x, y, angle;
    if (rng() < 0.5) {
      x = rngPick(rng, AVENUES_X); y = rngRange(rng, 140, 2050);
      angle = rng() < 0.5 ? 0 : Math.PI;
      x += angle === 0 ? 27 : -27;
    } else {
      y = rngPick(rng, STREETS_Y); x = rngRange(rng, 140, 3060);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      y += angle === Math.PI / 2 ? 27 : -27;
    }
    const car = makeCar(typeId, x, y, angle, rng);
    car.driver = 'traffic';
    car.speed = car.cruise * 0.7;
    cars.push(car);
  }
  // parked stock along the block edges, never inside a clear zone
  for (let i = 0; i < 14; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const x = rngRange(rng, 120, WORLD_W - 120);
      const y = rngRange(rng, 120, 2050);
      if (world.clearZones.some((z) => Math.hypot(z.x - x, z.y - y) < z.r + 26)) continue;
      const nearAvenue = AVENUES_X.some((ax) => Math.abs(ax - x) < ROAD_W / 2 + 40);
      const nearStreet = STREETS_Y.some((sy) => Math.abs(sy - y) < ROAD_W / 2 + 40);
      if (!nearAvenue && !nearStreet) continue;
      const car = makeCar(rngPick(rng, ['coupe', 'sedan', 'gt', 'taxi']), x, y, nearAvenue ? 0 : Math.PI / 2, rng);
      car.parked = true;
      cars.push(car);
      break;
    }
  }
  return cars;
}

export function spawnPeds(seed) {
  const rng = makeRng(seed * 57 + 3);
  const peds = [];
  for (let i = 0; i < 30; i++) {
    const ax = rngPick(rng, AVENUES_X), sy = rngPick(rng, STREETS_Y);
    const x = ax + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 17) + rngRange(rng, -30, 30);
    const y = sy + rngRange(rng, -260, 260);
    peds.push({
      x: clamp(x, 40, WORLD_W - 40), y: clamp(y, 40, 2140), angle: rngRange(rng, 0, 6.28),
      speed: rngRange(rng, 48, 78), state: 'walk', fleeT: 0,
      tx: x, ty: y, colour: rngPick(rng, ['#d95f4b', '#4b7ad9', '#59b06a', '#d9b84b', '#9a6ad9', '#d97cb0']),
      radius: 11, walkCycle: rngRange(rng, 0, 6),
    });
  }
  return peds;
}

export function updateTraffic(game, dt) {
  const p = game.player;
  for (const car of game.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    // brake for anything ahead in the lane, Rio included
    let want = car.cruise;
    const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(dx * fy - dy * fx);
      if (ahead > 0 && ahead < 64 && side < 22) want = Math.min(want, Math.max(0, other.speed - 6));
    }
    if (!p.car) {
      const dx = p.x - car.x, dy = p.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(dx * fy - dy * fx);
      if (ahead > 0 && ahead < 58 && side < 24) want = 0;
    }
    car.speed += clamp(want - car.speed, -260 * dt, 120 * dt);
    car.x += fx * car.speed * dt;
    car.y += fy * car.speed * dt;
    // hold the lane line, and sometimes turn at a crossing
    const lane = laneLine(car);
    if (lane.axis === 'x') car.x += clamp(lane.at - car.x, -60 * dt, 60 * dt);
    else car.y += clamp(lane.at - car.y, -60 * dt, 60 * dt);
    const nearCross = AVENUES_X.some((ax) => Math.abs(ax - car.x) < 10) && STREETS_Y.some((sy) => Math.abs(sy - car.y) < 10);
    if (nearCross && Math.random() < 0.006) {
      const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.angle = CARDINALS.reduce((best, c) => (Math.abs(angleDelta(car.angle + turn, c)) < Math.abs(angleDelta(car.angle + turn, best)) ? c : best), CARDINALS[0]);
    }
    if (car.x < 30 || car.x > WORLD_W - 30 || car.y < 30 || car.y > 2200) {
      car.angle += Math.PI; // dead end at the map edge: turn around
      car.x = clamp(car.x, 40, WORLD_W - 40); car.y = clamp(car.y, 40, 2190);
    }
  }
}

export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.x - game.threat.x, -(ped.y - game.threat.y));
      ped.angle = away;
      ped.x += Math.sin(away) * 155 * dt;
      ped.y += -Math.cos(away) * 155 * dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else {
      const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 14) {
        // pick the next stretch of sidewalk to wander
        const along = Math.random() < 0.5;
        if (along) { ped.tx = ped.x + rngRange(Math.random, -420, 420); ped.ty = ped.y + rngRange(Math.random, -36, 36); }
        else { ped.ty = ped.y + rngRange(Math.random, -420, 420); ped.tx = ped.x + rngRange(Math.random, -36, 36); }
        ped.tx = clamp(ped.tx, 30, WORLD_W - 30); ped.ty = clamp(ped.ty, 30, 2150);
      } else {
        ped.angle = Math.atan2(dx, -dy);
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
      }
    }
    ped.walkCycle += dt * 7;
    collideCircle(game.world, ped, ped.radius);
  }
}

// Player driving. ctrl: {throttle -1..1, steer -1..1}. Mutates the car;
// bumps are reported through game.lastBump so the caller can charge
// damage and heat fairly.
export function driveCar(game, car, dt, ctrl) {
  const tuned = game.mods.engine ? 1.12 : 1;
  const top = car.type.top * tuned;
  if (ctrl.throttle > 0) car.speed += car.type.accel * tuned * dt * ctrl.throttle;
  else if (ctrl.throttle < 0) car.speed += (car.speed > 8 ? -330 : -120) * dt * -ctrl.throttle;
  else {
    const drag = 120 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  car.speed = clamp(car.speed, -92, top);
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += ctrl.steer * 2.45 * steerAuthority * dt;

  const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;

  // stunt ramps: fast + lined up + on the plate = airborne
  if (car.airZ <= 0) {
    for (const ramp of RAMPS) {
      if (Math.hypot(ramp.x - car.x, ramp.y - car.y) < 36 && Math.abs(car.speed) > 92 &&
          Math.cos(angleDelta(car.angle, ramp.angle)) > 0.5) {
        car.airVz = Math.abs(car.speed) * 0.52;
        car.airZ = 0.5;
        game.lastBump = 'ramp';
      }
    }
  }
  if (car.airZ > 0 || car.airVz > 0) {
    car.airVz -= 640 * dt;
    car.airZ += car.airVz * dt;
    if (car.airZ <= 0) {
      car.airZ = 0; car.airVz = 0;
      for (let i = 0; i < 8; i++) game.particles.push({ x: car.x + rngRange(Math.random, -18, 18), y: car.y + rngRange(Math.random, -10, 10), vx: rngRange(Math.random, -40, 40), vy: rngRange(Math.random, -40, 40), life: 0.4, max: 0.4, size: 3, color: '#cbb98f', grav: 0 });
    }
  } else {
    const before = Math.abs(car.speed);
    if (collideCircle(game.world, car, car.radius)) {
      if (before > 130) { car.damage += (before - 130) * 0.045 * (game.mods.plating ? 0.5 : 1); game.lastBump = 'hard'; }
      else if (before > 40) game.lastBump = 'soft';
      car.speed *= -0.22;
    }
    // car-to-car contact: shove apart, trade a little paint
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = car.x - other.x, dy = car.y - other.y;
      const rr = car.radius + other.radius - 4;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) / 2;
        car.x += (dx / d) * push; car.y += (dy / d) * push;
        if (!other.roadblock) { other.x -= (dx / d) * push * 0.7; other.y -= (dy / d) * push * 0.7; }
        if (Math.abs(car.speed) > 90) { other.damage += 5; car.damage += 3 * (game.mods.plating ? 0.5 : 1); game.lastBump = 'car'; }
        car.speed *= 0.72;
      }
    }
    for (const pc of game.policeRef.cars) {
      const dx = car.x - pc.x, dy = car.y - pc.y;
      const rr = car.radius + pc.radius - 4;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) / 2;
        car.x += (dx / d) * push; car.y += (dy / d) * push;
        if (Math.abs(car.speed) > 90) car.damage += 3;
        car.speed *= 0.75;
      }
    }
  }
  if (isWater(car.x, car.y)) { car.x -= fx * car.speed * dt; car.y -= fy * car.speed * dt; car.speed = 0; }
}
