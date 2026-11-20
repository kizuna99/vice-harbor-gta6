// Serena Police Department: heat, stars, pursuit, foot officers,
// Air One and — from four stars — roadblocks across the avenue.
// Heat only decays while no uniform can see Rio.

import { WANTED, VEHICLES } from './config.js';
import { clamp, range, angleLerp } from './random.js';
import { makeVehicle } from './entities.js';
import { resolveCollision, nearestRoadPoint } from './world.js';

export const police = {
  heat: 0,
  stars: 0,
  cars: [],
  officers: [],
  heli: null,
  unseenT: 0,
  arrest: 0,
  flashT: 0,
  roadblockT: 0,
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
    police.roadblockT = 0;
  }
}

export function clearWanted() { setWantedLevel(0); }

function spawnCopCar(player) {
  const a = range(0, Math.PI * 2);
  const d = range(430, 540);
  const x = clamp(player.x + Math.cos(a) * d, 60, 3140);
  const y = clamp(player.y + Math.sin(a) * d, 60, 1620);
  const car = makeVehicle(5, x, y, 0, '#f2f2f2');
  car.police = true;
  car.driver = true;
  police.cars.push(car);
  return car;
}

function spawnOfficer(player) {
  const a = range(0, Math.PI * 2);
  return {
    x: clamp(player.x + Math.cos(a) * 380, 40, 3160),
    y: clamp(player.y + Math.sin(a) * 380, 40, 1630),
    angle: 0, speed: 0, state: 'chase',
  };
}

function placeRoadblock(player) {
  // Two cruisers parked sideways on the road ahead of the suspect.
  const target = player.car || player;
  const ang = target.angle || 0;
  const fx = Math.sin(ang), fy = -Math.cos(ang);
  const aheadX = target.x + fx * 270;
  const aheadY = target.y + fy * 270;
  const snap = nearestRoadPoint(clamp(aheadX, 60, 3140), clamp(aheadY, 60, 1620));
  for (let i = 0; i < 2; i++) {
    const car = makeVehicle(5, snap.x + (i === 0 ? -20 : 20), snap.y + (i === 0 ? -14 : 14), Math.PI / 2, '#f2f2f2');
    car.police = true;
    car.driver = true;
    car.roadblock = true;
    car.speed = 0;
    police.cars.push(car);
  }
  police.roadblockT = WANTED.roadblockCooldownSec;
}

export function updatePolice(dt, player, game) {
  police.flashT += dt * 7;
  police.roadblockT = Math.max(0, police.roadblockT - dt);
  const target = player.car || player;
  const px = target.x, py = target.y;

  const pursuit = police.cars.filter((c) => !c.roadblock);
  const blocks = police.cars.filter((c) => c.roadblock);
  const wantCars = WANTED.policeCarsByStar[police.stars];
  const wantFoot = WANTED.footCopsByStar[police.stars];
  if (police.stars > 0) {
    while (pursuit.length < wantCars) pursuit.push(spawnCopCar(player));
    while (police.officers.length < wantFoot) police.officers.push(spawnOfficer(player));
  }
  if (pursuit.length > wantCars) pursuit.length = Math.max(wantCars, 0);
  if (police.officers.length > wantFoot) police.officers.length = Math.max(wantFoot, 0);
  police.cars = [...pursuit, ...blocks];

  // Roadblocks from four stars, refreshed on the cooldown.
  if (police.stars >= WANTED.roadblockFromStar && blocks.length < 2 && police.roadblockT <= 0) {
    placeRoadblock(player);
  }
  if (police.stars < WANTED.roadblockFromStar && blocks.length) {
    police.cars = police.cars.filter((c) => !c.roadblock);
  }

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
    const orbitA = h.sweep * 0.55;
    const hx = px + Math.cos(orbitA) * 150;
    const hy = py + Math.sin(orbitA) * 110;
    h.x += (hx - h.x) * Math.min(1, dt * 2.2);
    h.y += (hy - h.y) * Math.min(1, dt * 2.2);
    h.angle = Math.atan2(px - h.x, -(py - h.y));
    h.spotX = px + Math.sin(h.sweep * 1.7) * 34;
    h.spotY = py + Math.cos(h.sweep * 1.3) * 26;
  }

  let seen = false;

  for (const car of police.cars) {
    if (car.wrecked) continue;
    if (car.roadblock) { car.speed = 0; if (Math.hypot(px - car.x, py - car.y) < 420) seen = true; continue; }
    const dx = px - car.x, dy = py - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 420) seen = true;
    const wantAngle = Math.atan2(dx, -dy);
    car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 2.6));
    const top = VEHICLES[5].topSpeed * (0.82 + police.stars * 0.045);
    const wantSpeed = dist > 60 ? top : top * 0.25;
    car.speed += clamp(wantSpeed - car.speed, -300 * dt, VEHICLES[5].accel * dt);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y += -Math.cos(car.angle) * car.speed * dt;
    resolveCollision(car, 22);
    if (player.car && dist < 44 && game) game.onPoliceRam?.(car);
  }

  for (const o of police.officers) {
    const dx = px - o.x, dy = py - o.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 300) seen = true;
    if (dist > 560) {
      o.x = px + range(-300, 300); o.y = py + range(-300, 300);
    }
    o.angle = Math.atan2(dx, -dy);
    o.speed = dist > 30 ? 168 : 0;
    o.x += Math.sin(o.angle) * o.speed * dt;
    o.y += -Math.cos(o.angle) * o.speed * dt;
    resolveCollision(o, 10);
  }

  const suspectSpeed = player.car ? Math.abs(player.car.speed) : Math.hypot(player.vx || 0, player.vy || 0);
  let closeUnit = false;
  for (const car of police.cars) {
    if (Math.hypot(car.x - px, car.y - py) < WANTED.arrestRadius + 26) closeUnit = true;
  }
  for (const o of police.officers) {
    if (Math.hypot(o.x - px, o.y - py) < WANTED.arrestRadius) closeUnit = true;
  }
  if (police.stars > 0 && closeUnit && suspectSpeed < 55) {
    police.arrest = clamp(police.arrest + WANTED.arrestFillPerSec * dt, 0, 1);
  } else {
    police.arrest = clamp(police.arrest - WANTED.arrestDrainPerSec * dt, 0, 1);
  }

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
