// entities.js — the living layer: Rio himself, the traffic that fills the
// avenues, and the pedestrians who mostly wish he would go away. Cars run a
// simple lane discipline on the grid (right-hand lanes, brake for the car
// ahead, stop for a pedestrian in the paint) which is enough to make the
// city feel inhabited without a traffic court.

import { AVENUES, STREETS, VEHICLE_TYPES, PLAYER } from './config.js';
import { createRandom, dirFrom, clamp } from './random.js';

export function makePlayer() {
  return {
    x: PLAYER.startX, y: PLAYER.startY, angle: Math.PI,
    health: 100, armor: 0, weapon: 'fists', car: null,
    walkCycle: 0,
  };
}

export function makeCar(typeIdx, x, y, angle, opts = {}) {
  const t = VEHICLE_TYPES[typeIdx];
  return {
    x, y, angle, speed: 0,
    typeIdx, color: opts.color || t.color, name: t.name,
    parked: !!opts.parked, driver: !!opts.driver, police: false,
    wrecked: false, hp: t.hp, damage: 0,
    airZ: 0, vz: 0, honkT: 0,
  };
}

export function seedTraffic(game, seed) {
  const rng = createRandom(seed ^ 0x7ea5);
  const cars = [];
  // Rolling traffic on both orientations of the grid.
  for (let i = 0; i < 22; i++) {
    const horiz = rng.chance(0.5);
    const typeIdx = rng.int(0, 4);
    let x, y, angle;
    if (horiz) {
      const sy = rng.pick(STREETS);
      const dir = rng.chance(0.5) ? 1 : -1;
      y = sy + (dir > 0 ? -14 : 14);
      x = rng.range(60, 3140);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ax = rng.pick(AVENUES);
      const dir = rng.chance(0.5) ? 1 : -1;
      x = ax + (dir > 0 ? 14 : -14);
      y = rng.range(60, 2340);
      angle = dir > 0 ? Math.PI : 0;
    }
    const c = makeCar(typeIdx, x, y, angle, {});
    c.speed = rng.range(70, 120);
    c.axis = horiz ? 'h' : 'v';
    cars.push(c);
  }
  // Parked cars along the kerbs, ready to be borrowed.
  for (let i = 0; i < 13; i++) {
    const horiz = rng.chance(0.5);
    const typeIdx = rng.int(0, 4);
    let x, y, angle;
    if (horiz) {
      const sy = rng.pick(STREETS);
      y = sy + (rng.chance(0.5) ? -26 : 26);
      x = rng.range(120, 3080);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ax = rng.pick(AVENUES);
      x = ax + (rng.chance(0.5) ? -26 : 26);
      y = rng.range(120, 2280);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    const c = makeCar(typeIdx, x, y, angle, { parked: true });
    c.axis = horiz ? 'h' : 'v';
    cars.push(c);
  }
  // The marked Solano GT that job three is about, waiting by Palm Row east.
  const gt = makeCar(1, 1800, 574, Math.PI / 2, { parked: true, color: '#f2b035' });
  gt.marked = true;
  gt.axis = 'h';
  cars.push(gt);
  return cars;
}

export function seedPeds(game, seed) {
  const rng = createRandom(seed ^ 0x9ed5);
  const peds = [];
  const shirts = ['#ef6f6c', '#ffd23e', '#4ecdc4', '#f7f7f7', '#84a98c', '#e2543e', '#7fb2d9'];
  for (let i = 0; i < 30; i++) {
    const horiz = rng.chance(0.5);
    let x, y;
    if (horiz) { const sy = rng.pick(STREETS); y = sy + rng.pick([-46, 46]); x = rng.range(60, 3140); }
    else { const ax = rng.pick(AVENUES); x = ax + rng.pick([-46, 46]); y = rng.range(60, 2300); }
    peds.push({
      x, y, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(34, 58), baseSpeed: 0,
      color: rng.pick(shirts), panic: 0, down: false, downTimer: 0,
      axis: horiz ? 'h' : 'v', dir: rng.chance(0.5) ? 1 : -1, walkCycle: rng.range(0, 6),
    });
    peds[i].baseSpeed = peds[i].speed;
  }
  return peds;
}

function updateTrafficCar(game, c, dt) {
  if (c.parked || c.wrecked || c === game.player.car) return;
  // Brake for whoever is ahead in the lane, car or pedestrian.
  let blocked = false;
  const dir = dirFrom(c.angle);
  const noseX = c.x + dir.x * 46, noseY = c.y + dir.y * 46;
  for (const o of game.cars) {
    if (o === c || o.wrecked) continue;
    if (Math.hypot(o.x - noseX, o.y - noseY) < 30) { blocked = true; break; }
  }
  if (!blocked) {
    for (const p of game.peds) {
      if (!p.down && Math.hypot(p.x - noseX, p.y - noseY) < 30) { blocked = true; break; }
    }
  }
  if (!blocked && Math.hypot(game.player.x - noseX, game.player.y - noseY) < 30 && !game.player.car) blocked = true;

  const cruise = 126;
  c.speed += clamp((blocked ? 0 : cruise) - c.speed, -300 * dt, 90 * dt);
  if (blocked && c.speed < 8 && c.honkT <= 0) { c.honkT = 3; if (Math.hypot(c.x - game.player.x, c.y - game.player.y) < 260) game.audio.horn(); }
  c.honkT -= dt;
  c.x += dir.x * c.speed * dt;
  c.y += dir.y * c.speed * dt;

  // Turn at some intersections, otherwise wrap at the map edge.
  const nearLine = c.axis === 'h' ? AVENUES : STREETS;
  const coord = c.axis === 'h' ? c.x : c.y;
  for (const line of nearLine) {
    if (Math.abs(coord - line) < 6 && Math.random() < 0.0035) {
      c.axis = c.axis === 'h' ? 'v' : 'h';
      c.angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
      const nd = dirFrom(c.angle);
      c.x += nd.x * 20; c.y += nd.y * 20;
      break;
    }
  }
  if (c.x < -60) c.x = 3260; if (c.x > 3260) c.x = -60;
  if (c.y < -60) c.y = 2460; if (c.y > 2460) c.y = -60;
}

export function updateEntities(game, dt) {
  for (const c of game.cars) updateTrafficCar(game, c, dt);
  const p = game.player;
  for (const ped of game.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.x += 30; }
      continue;
    }
    ped.panic = Math.max(0, ped.panic - dt);
    const fleeing = ped.panic > 0;
    let ang = ped.angle;
    if (fleeing) {
      ang = Math.atan2(ped.x - p.x, -(ped.y - p.y));
    } else if (Math.random() < 0.004) {
      ped.dir *= -1;
      ang = ped.axis === 'h' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? Math.PI : 0);
    }
    ped.angle = ang;
    const sp = fleeing ? 150 : ped.baseSpeed;
    const dir = dirFrom(ang);
    let nx = ped.x + dir.x * sp * dt;
    let ny = ped.y + dir.y * sp * dt;
    const fixed = game.world.collide(nx, ny, 11);
    if (Math.abs(fixed.x - nx) > 0.1 || Math.abs(fixed.y - ny) > 0.1) ped.dir *= -1;
    ped.x = fixed.x; ped.y = fixed.y;
    ped.walkCycle += dt * (fleeing ? 11 : 6);
  }
}

// On-foot movement, shared by the free-roam tick. Returns nothing; writes
// straight into the player.
export function updatePlayerOnFoot(game, dt, input) {
  const p = game.player;
  const axis = input.axis();
  const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const sp = sprint ? 218 : PLAYER.walkSpeed;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    const nx = p.x + (axis.x / len) * sp * dt;
    const ny = p.y + (axis.y / len) * sp * dt;
    const fixed = game.world.collide(nx, ny, PLAYER.radius);
    p.x = fixed.x; p.y = fixed.y;
    p.angle = Math.atan2(axis.x, -axis.y);
    p.walkCycle += dt * (sprint ? 11 : 8);
  }
}

// Driving the car Rio sits in. Engine mods and nitro are read live so a
// fresh purchase pulls away harder on the very next block.
export function updatePlayerCar(game, dt, input) {
  const p = game.player;
  const c = p.car;
  if (!c) return;
  const t = VEHICLE_TYPES[c.typeIdx];
  const engineBoost = game.mods.engine ? 1.22 : 1;
  const top = t.top * engineBoost;
  const accel = t.accel * engineBoost * (game.mods.nitro && input.isDown('ShiftLeft') ? 1.5 : 1);

  if (input.isDown('KeyW') || input.isDown('ArrowUp')) c.speed += accel * dt;
  else if (input.isDown('KeyS') || input.isDown('ArrowDown')) c.speed -= accel * 0.62 * dt;
  else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 60 * dt);
  if (input.isDown('Space')) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 420 * dt);
  c.speed = clamp(c.speed, -top * 0.38, top);

  const steer = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? -1 : 0) + (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
  if (steer !== 0 && Math.abs(c.speed) > 4) {
    c.angle += steer * t.grip * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 120);
  }

  const dir = dirFrom(c.angle);
  let nx = c.x + dir.x * c.speed * dt;
  let ny = c.y + dir.y * c.speed * dt;

  // Stunt ramps: cross one with pace and the car leaves the ground.
  if (c.airZ <= 0) {
    const ramp = game.world.rampAt(nx, ny);
    if (ramp && Math.abs(c.speed) > 95) { c.vz = 300; c.airZ = 0.01; }
  }
  if (c.airZ > 0) {
    c.airZ += c.vz * dt;
    c.vz -= 620 * dt;
    if (c.airZ <= 0) {
      c.airZ = 0; c.vz = 0;
      game.spawnParticles(c.x, c.y, 8, { color: '#d9c7a7', speed: 90, life: 0.4, size: 3 });
    }
  } else {
    const fixed = game.world.collide(nx, ny, 20);
    if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
      if (Math.abs(c.speed) > 120) { game.damageCar(c, 6, false); game.shake = Math.min(8, game.shake + 3); }
      c.speed *= 0.35;
    }
    nx = fixed.x; ny = fixed.y;
  }
  c.x = nx; c.y = ny;
  p.x = c.x; p.y = c.y;
  p.angle = c.angle;

  // Brushing traffic is expensive in every currency.
  for (const o of game.cars) {
    if (o === c || o.wrecked) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < 34 && Math.abs(c.speed) > 60) {
      game.damageCar(o, 8, false);
      game.damageCar(c, 5, false);
      c.speed *= 0.55;
      game.addHeat(3);
      game.spawnParticles((o.x + c.x) / 2, (o.y + c.y) / 2, 6, { color: '#ffd76a', speed: 120, life: 0.3, size: 3 });
    }
  }
  for (const ped of game.peds) {
    if (!ped.down && Math.hypot(ped.x - c.x, ped.y - c.y) < 26 && Math.abs(c.speed) > 40) {
      ped.down = true; ped.downTimer = 9;
      game.addHeat(8);
    }
  }
}
