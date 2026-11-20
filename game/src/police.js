// Serena Police Department: wanted heat, pursuit cars, foot officers,
// the helicopter — and, new in v2, cruiser roadblocks at four stars.
// Heat only decays while nobody in uniform can see Rio; the arrest
// meter fills when an officer is close and Rio is slow.

import { WANTED, CRIME_HEAT, VEHICLES } from './config.js';
import { clamp, range, angleLerp } from './random.js';
import { makeVehicle } from './entities.js';
import { resolveCollision } from './world.js';

export const police = {
  heat: 0,
  stars: 0,
  cars: [],
  officers: [],
  heli: null,
  unseenT: 0,
  arrest: 0,       // 0..1
  flashT: 0,
  roadblockCd: 0,  // seconds until the next roadblock can be placed
};

export function starsForHeat(heat) {
  let s = 0;
  for (let i = 1; i < WANTED.thresholds.length; i++) {
    if (heat >= WANTED.thresholds[i]) s = i;
  }
  return s;
}

export function addHeat(amount, game) {
  police.heat = clamp(police.heat + amount, 0, WANTED.thresholds[5] + 160);
  const s = starsForHeat(police.heat);
  if (s > police.stars && game) game.onWantedRise?.(s);
  police.stars = s;
}

export function setWantedLevel(n) {
  police.stars = clamp(n, 0, 5);
  police.heat = WANTED.thresholds[police.stars] + (police.stars > 0 ? 4 : 0);
  if (n === 0) {
    police.heat = 0;
    police.arrest = 0;
    police.cars.length = 0;
    police.officers.length = 0;
    police.heli = null;
    police.roadblockCd = 0;
  }
}

export function clearWanted() { setWantedLevel(0); }

function spawnCopCar(player, existing) {
  // Spawn just outside view, on a road-ish ring around the player.
  const a = range(0, Math.PI * 2);
  const d = range(430, 540);
  const x = clamp(player.x + Math.cos(a) * d, 60, 3140);
  const y = clamp(player.y + Math.sin(a) * d, 60, 1620);
  const car = makeVehicle(5, x, y, 0, '#f2f2f2');
  car.police = true;
  car.driver = true;
  existing.push(car);
  return car;
}

function spawnOfficer(player) {
  const a = range(0, Math.PI * 2);
  return {
    x: clamp(player.x + Math.cos(a) * 380, 40, 3160),
    y: clamp(player.y + Math.sin(a) * 380, 40, 1630),
    angle: 0, speed: 0, state: 'chase', // chase | down
    health: 70, downT: 0,
  };
}

function chaseCars() {
  return police.cars.filter((c) => !c.roadblock);
}

function placeRoadblock(player) {
  // Two cruisers side by side across the road ahead of the suspect,
  // noses pointed back at him. They hold position — a wall, not a chase.
  const target = player.car || player;
  const a = target.angle || 0;
  const fx = Math.sin(a), fy = -Math.cos(a);
  const px = Math.cos(a), py = Math.sin(a); // perpendicular unit vector
  const aheadX = target.x + fx * WANTED.roadblockAheadPx;
  const aheadY = target.y + fy * WANTED.roadblockAheadPx;
  for (const side of [-1, 1]) {
    const car = makeVehicle(5,
      clamp(aheadX + px * side * 30, 50, 3150),
      clamp(aheadY + py * side * 30, 50, 1640),
      a + Math.PI, '#f2f2f2');
    car.police = true;
    car.driver = true;
    car.roadblock = true;
    car.speed = 0;
    resolveCollision(car, 22);
    police.cars.push(car);
  }
  police.roadblockCd = WANTED.roadblockRespawnSec;
}

export function updatePolice(dt, player, game) {
  police.flashT += dt * 7;
  police.roadblockCd = Math.max(0, police.roadblockCd - dt);
  const target = player.car || player;
  const px = target.x, py = target.y;

  // Roadblocks: keep a fresh pair in front of a four-star suspect.
  if (police.stars >= WANTED.roadblockFromStar) {
    const blocks = police.cars.filter((c) => c.roadblock && !c.wrecked);
    if (blocks.length < WANTED.roadblockCars && police.roadblockCd <= 0) {
      // Drop any stale single survivor so the new pair is coherent.
      police.cars = police.cars.filter((c) => !c.roadblock);
      placeRoadblock(player);
    }
  } else if (police.cars.some((c) => c.roadblock)) {
    police.cars = police.cars.filter((c) => !c.roadblock);
  }

  // Maintain force size for the current star level (chase units only;
  // roadblock cruisers are extra and exempt from the trim).
  const wantCars = WANTED.policeCarsByStar[police.stars];
  const wantFoot = WANTED.footCopsByStar[police.stars];
  if (police.stars > 0) {
    while (chaseCars().length < wantCars) spawnCopCar(player, police.cars);
    while (police.officers.length < wantFoot) police.officers.push(spawnOfficer(player));
  }
  let excess = chaseCars().length - wantCars;
  if (excess > 0) {
    police.cars = police.cars.filter((c) => {
      if (c.roadblock) return true;
      if (excess > 0) { excess--; return false; }
      return true;
    });
  }
  if (police.officers.length > wantFoot) police.officers.length = Math.max(wantFoot, 0);

  // Helicopter joins at three stars and above.
  if (police.stars >= WANTED.heliFromStar) {
    if (!police.heli) {
      police.heli = { x: px + 300, y: py - 260, angle: 0, sweep: 0, spotX: px, spotY: py };
    }
  } else {
    police.heli = null;
  }
  if (police.heli) {
    const h = police.heli;
    h.sweep += dt;
    // Orbit the target and drag the searchlight across the street.
    const orbitA = h.sweep * 0.55;
    const hx = px + Math.cos(orbitA) * 150;
    const hy = py + Math.sin(orbitA) * 110;
    h.x += (hx - h.x) * Math.min(1, dt * 2.2);
    h.y += (hy - h.y) * Math.min(1, dt * 2.2);
    h.angle = Math.atan2(px - h.x, -(py - h.y));
    h.spotX = px + Math.sin(h.sweep * 1.7) * 34;
    h.spotY = py + Math.cos(h.sweep * 1.3) * 26;
  }

  // Line of sight: any unit within range counts as seeing Rio.
  let seen = false;

  for (const car of police.cars) {
    const dx = px - car.x, dy = py - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 420) seen = true;
    if (car.roadblock) {
      // The wall holds: brake to a stop and keep its nose on Rio.
      car.speed = Math.max(0, car.speed - 320 * dt);
      car.angle = angleLerp(car.angle, Math.atan2(dx, -dy), Math.min(1, dt * 1.6));
      continue;
    }
    if (car.wrecked) { car.speed = 0; continue; }
    const wantAngle = Math.atan2(dx, -dy);
    car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 2.6));
    const top = VEHICLES[5].topSpeed * (0.82 + police.stars * 0.045);
    const wantSpeed = dist > 60 ? top : top * 0.25;
    car.speed += clamp(wantSpeed - car.speed, -300 * dt, VEHICLES[5].accel * dt);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y += -Math.cos(car.angle) * car.speed * dt;
    resolveCollision(car, 22);
    // Ram contact nudges the suspect and chips damage.
    if (player.car && dist < 44 && game) game.onPoliceRam?.(car);
  }

  for (const o of police.officers) {
    if (o.state === 'down') {
      o.downT -= dt;
      if (o.downT <= 0) { o.state = 'chase'; o.health = 70; }
      continue;
    }
    const dx = px - o.x, dy = py - o.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 300) seen = true;
    if (dist > 560) { // teleport-catch-up so foot cops stay relevant
      o.x = px + range(-300, 300); o.y = py + range(-300, 300);
    }
    o.angle = Math.atan2(dx, -dy);
    o.speed = dist > 30 ? 168 : 0;
    o.x += Math.sin(o.angle) * o.speed * dt;
    o.y += -Math.cos(o.angle) * o.speed * dt;
    resolveCollision(o, 10);
  }

  // Arrest meter: fills when a unit is close and Rio is slow or on foot.
  const suspectSpeed = player.car ? Math.abs(player.car.speed) : Math.hypot(player.vx || 0, player.vy || 0);
  let closeUnit = false;
  for (const car of police.cars) {
    if (Math.hypot(car.x - px, car.y - py) < WANTED.arrestRadius + 26) closeUnit = true;
  }
  for (const o of police.officers) {
    if (o.state !== 'down' && Math.hypot(o.x - px, o.y - py) < WANTED.arrestRadius) closeUnit = true;
  }
  if (police.stars > 0 && closeUnit && suspectSpeed < 55) {
    police.arrest = clamp(police.arrest + WANTED.arrestFillPerSec * dt, 0, 1);
  } else {
    police.arrest = clamp(police.arrest - WANTED.arrestDrainPerSec * dt, 0, 1);
  }

  // Heat bookkeeping.
  if (seen) {
    police.unseenT = 0;
  } else {
    police.unseenT += dt;
    if (police.unseenT > WANTED.unseenGraceSec && police.stars > 0) {
      police.heat = Math.max(0, police.heat - WANTED.decayPerSec * dt);
      police.stars = starsForHeat(police.heat);
      if (police.stars === 0) { police.cars.length = 0; police.officers.length = 0; police.heli = null; }
    }
  }

  if (police.arrest >= 1 && game) {
    game.onBusted?.();
    police.arrest = 0;
  }
  return { seen };
}

export { CRIME_HEAT };
