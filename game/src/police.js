// police.js — the Serena Police Department (SPD).
// Heat is the raw score; stars are derived from it. Units scale with stars,
// the helicopter joins at 3 stars, and heat only bleeds off while no unit
// can see Rio — hiding actually works, sprinting down Ocean Drive doesn't.

import { CFG, WANTED_LEVELS, HEAT } from './config.js';
import { clamp, dist, angleLerp } from './random.js';
import { makeVehicle, makePed, moveCar } from './entities.js';
import { world } from './world.js';

export function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  if (heat < 30) return 1;
  if (heat < 65) return 2;
  if (heat < 105) return 3;
  if (heat < 150) return 4;
  return 5;
}

export class Police {
  constructor(rng) {
    this.rng = rng;
    this.heat = 0;
    this.cars = [];     // police vehicles (also mirrored into game.vehicles)
    this.officers = []; // foot officers (mirrored into game.peds)
    this.heli = { active: false, x: 0, y: 0, angle: 0, sweep: 0, rotor: 0 };
    this.seenTimer = 0; // seconds since any unit last saw the player
    this.spawnCooldown = 0;
  }

  get wanted() { return starsFromHeat(this.heat); }

  addHeat(points) {
    this.heat = clamp(this.heat + points, 0, 220);
  }

  clear() {
    this.heat = 0;
    this.seenTimer = 99;
  }

  // Spawn a unit just off-screen near the player so pursuit feels responsive
  // without cars popping into view.
  spawnCar(game) {
    const p = game.player;
    const a = this.rng.range(0, Math.PI * 2);
    const d = 560;
    const x = clamp(p.x + Math.cos(a) * d, 40, CFG.worldW - 40);
    const y = clamp(p.y + Math.sin(a) * d, 40, CFG.worldH - 40);
    // Snap to the nearest road so cruisers arrive on tarmac.
    let bx = x, by = y, bd = Infinity;
    for (const pt of world.intersections) {
      const dd = dist(x, y, pt.x, pt.y);
      if (dd < bd) { bd = dd; bx = pt.x; by = pt.y; }
    }
    const car = makeVehicle('cruiser', bx, by, Math.atan2(p.y - by, p.x - bx), 'police');
    this.cars.push(car);
    game.vehicles.push(car);
    return car;
  }

  spawnOfficer(game) {
    const p = game.player;
    const a = this.rng.range(0, Math.PI * 2);
    const off = makePed(clamp(p.x + Math.cos(a) * 380, 30, CFG.worldW - 30), clamp(p.y + Math.sin(a) * 380, 30, CFG.worldH - 30), this.rng, 'officer');
    off.color = '#274690';
    this.officers.push(off);
    game.peds.push(off);
    return off;
  }

  update(dt, game) {
    const p = game.player;
    const level = WANTED_LEVELS[this.wanted];
    this.spawnCooldown -= dt;

    // Maintain unit counts for the current star level.
    if (this.wanted > 0 && this.spawnCooldown <= 0) {
      if (this.cars.length < level.cars) { this.spawnCar(game); this.spawnCooldown = 0.7; }
      else if (this.officers.length < level.foot) { this.spawnOfficer(game); this.spawnCooldown = 0.7; }
    }
    // Despawn far-away excess units when heat drops.
    if (this.cars.length > level.cars) {
      const far = this.cars.find((c) => dist(c.x, c.y, p.x, p.y) > 800);
      if (far) this.removeCar(game, far);
    }
    if (this.officers.length > level.foot) {
      const far = this.officers.find((o) => dist(o.x, o.y, p.x, p.y) > 700);
      if (far) this.removeOfficer(game, far);
    }

    // Vision: any unit (or the helicopter) within range refreshes "seen".
    let seen = false;
    for (const c of this.cars) if (dist(c.x, c.y, p.x, p.y) < 470) seen = true;
    for (const o of this.officers) if (dist(o.x, o.y, p.x, p.y) < 300) seen = true;
    if (this.heli.active) seen = true;
    if (seen) this.seenTimer = 0; else this.seenTimer += dt;

    // Heat decay — only while unseen, and never while a job crime is fresh.
    if (this.wanted > 0 && this.seenTimer > 2.2) {
      this.heat = Math.max(0, this.heat - CFG.wantedDecayPerSec * dt);
      if (this.heat === 0) this.clearUnits(game);
    }

    // Pursuit driving: steer at the player, match the star-level pace.
    for (const car of this.cars) {
      const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle = angleLerp(car.angle, targetAngle, clamp(dt * 2.6, 0, 1));
      const d = dist(car.x, car.y, p.x, p.y);
      const want = car.model.top * level.speed * (d > 260 ? 1 : 0.72);
      car.speed += clamp(want - car.speed, -300 * dt, car.model.accel * dt);
      if (d < 52) car.speed = Math.min(car.speed, 40); // pull alongside, don't orbit
      moveCar(car, dt);
    }
    // Foot officers run at the player; the arrest logic itself lives in
    // game.js because it needs the player's full state.
    for (const off of this.officers) {
      if (off.state === 'down') continue;
      const d = dist(off.x, off.y, p.x, p.y);
      const spd = this.wanted >= 4 ? 205 : 178;
      off.angle = Math.atan2(p.y - off.y, p.x - off.x);
      if (d > 26) {
        off.x += Math.cos(off.angle) * spd * dt;
        off.y += Math.sin(off.angle) * spd * dt;
        const fixed = world.collideCircle(off.x, off.y, CFG.playerRadius);
        off.x = fixed.x; off.y = fixed.y;
      }
      off.speed = spd;
    }

    // Helicopter at 3+ stars: hovers offset from the player, searchlight
    // sweeping — and while it is up, Rio is always "seen".
    const wantHeli = this.wanted >= 3;
    if (wantHeli && !this.heli.active) {
      this.heli.active = true;
      this.heli.x = p.x - 300; this.heli.y = p.y - 300;
    }
    if (!wantHeli) this.heli.active = false;
    if (this.heli.active) {
      const hx = p.x + Math.cos(this.heli.sweep * 0.6) * 120;
      const hy = p.y + Math.sin(this.heli.sweep * 0.6) * 120;
      this.heli.x += (hx - this.heli.x) * clamp(dt * 1.6, 0, 1);
      this.heli.y += (hy - this.heli.y) * clamp(dt * 1.6, 0, 1);
      this.heli.sweep += dt;
      this.heli.rotor += dt * 40;
      this.heli.angle = Math.atan2(p.y - this.heli.y, p.x - this.heli.x);
    }
  }

  removeCar(game, car) {
    this.cars = this.cars.filter((c) => c !== car);
    game.vehicles = game.vehicles.filter((v) => v !== car);
  }
  removeOfficer(game, off) {
    this.officers = this.officers.filter((o) => o !== off);
    game.peds = game.peds.filter((q) => q !== off);
  }
  clearUnits(game) {
    for (const c of [...this.cars]) this.removeCar(game, c);
    for (const o of [...this.officers]) this.removeOfficer(game, o);
    this.heli.active = false;
  }

  // Crime helpers so call sites read clearly.
  crime(kind) { if (HEAT[kind]) this.addHeat(HEAT[kind]); }
}
