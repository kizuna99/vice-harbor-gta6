// police.js — the Serena Police Department. Heat is a score, stars are
// its public face. Cruisers hunt in packs sized by the star count,
// officers pile out up close and work the arrest meter, Air One joins
// at three stars, and four stars earns you a roadblock across the road
// ahead. Everything answers to setWanted: zero means the city forgets.

import { HEAT_RUNGS, starsForHeat, CAR_TYPES } from './config.js';
import { AVENUES_X, STREETS_Y, collideCircle } from './world.js';
import { clamp, angleDelta, rngRange } from './random.js';

const CRUISER = CAR_TYPES.find((t) => t.id === 'cruiser');
const WANTED_CARS = [0, 2, 3, 4, 5, 7];

export class Police {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.heatLock = null;      // set by the Searchlight Run: heat is pinned
    this.spawnT = 0;
    this.heliT = 0;
    this.roadblockT = 0;
    this.calmT = 0;
  }

  setWanted(n) {
    this.stars = clamp(n, 0, 5);
    this.heat = HEAT_RUNGS[this.stars];
    if (this.stars === 0) this.clearAll();
  }

  addHeat(amount) {
    if (this.heatLock !== null) return;
    this.heat = clamp(this.heat + amount, 0, 320);
    this.stars = starsForHeat(this.heat);
    this.calmT = 0;
  }

  clearAll() {
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.roadblockT = 0;
  }

  spawnCruiser(game, roadblock = false, at = null) {
    const p = game.player;
    let x, y;
    if (at) { x = at.x; y = at.y; }
    else {
      // roll in from a road a few blocks away, never on top of the player
      const ang = Math.random() * Math.PI * 2;
      const d = rngRange(Math.random, 640, 820);
      x = clamp(p.x + Math.cos(ang) * d, 80, 3120);
      y = clamp(p.y + Math.sin(ang) * d, 80, 2140);
      let best = AVENUES_X[0];
      for (const ax of AVENUES_X) if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
      if (Math.abs(best - x) < 160) x = best; else {
        let bs = STREETS_Y[0];
        for (const sy of STREETS_Y) if (Math.abs(sy - y) < Math.abs(bs - y)) bs = sy;
        y = bs;
      }
    }
    const car = {
      id: 'spd' + Math.floor(Math.random() * 1e9), type: CRUISER, typeId: 'cruiser',
      x, y, angle: Math.atan2(p.x - x, -(p.y - y)), speed: 0, colour: '#eef1f4',
      driver: 'spd', parked: false, wrecked: false, exploding: 0, damage: 0,
      airZ: 0, airVz: 0, radius: 24, cruise: 200, marked: false, roadblock, police: true,
    };
    this.cars.push(car);
    return car;
  }

  placeRoadblock(game) {
    const p = game.player;
    const facing = p.car ? p.car.angle : p.angle;
    const fx = Math.sin(facing), fy = -Math.cos(facing);
    const aheadX = p.x + fx * 430, aheadY = p.y + fy * 430;
    let avenue = AVENUES_X[0];
    for (const ax of AVENUES_X) if (Math.abs(ax - aheadX) < Math.abs(avenue - aheadX)) avenue = ax;
    let street = STREETS_Y[0];
    for (const sy of STREETS_Y) if (Math.abs(sy - aheadY) < Math.abs(street - aheadY)) street = sy;
    if (Math.abs(avenue - aheadX) < Math.abs(street - aheadY)) {
      // the road runs north–south: park two cruisers across it
      this.spawnCruiser(game, true, { x: avenue - 27, y: clamp(aheadY, 80, 2140) });
      this.spawnCruiser(game, true, { x: avenue + 27, y: clamp(aheadY, 80, 2140) });
    } else {
      this.spawnCruiser(game, true, { x: clamp(aheadX, 80, 3120), y: street - 27 });
      this.spawnCruiser(game, true, { x: clamp(aheadX, 80, 3120), y: street + 27 });
    }
    for (const c of this.cars) if (c.roadblock) c.angle = facing + Math.PI / 2;
  }

  update(game, dt) {
    if (this.heatLock !== null) { this.heat = this.heatLock; this.stars = starsForHeat(this.heat); }
    else {
      this.calmT += dt;
      if (this.calmT > 6 && this.heat > 0) { this.heat = Math.max(0, this.heat - 2.4 * dt); this.stars = starsForHeat(this.heat); }
    }
    if (this.stars === 0) { if (this.cars.length || this.officers.length || this.heli) this.clearAll(); return; }

    const p = game.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;

    // reinforcements roll in on a beat until the pack is at strength
    this.spawnT -= dt;
    const want = WANTED_CARS[this.stars];
    const active = this.cars.filter((c) => !c.roadblock && !c.wrecked).length;
    if (active < want && this.spawnT <= 0) { this.spawnCruiser(game); this.spawnT = 0.7; }

    // roadblocks at four stars and up
    this.roadblockT -= dt;
    if (this.stars >= 4 && this.roadblockT <= 0 && !this.cars.some((c) => c.roadblock)) {
      this.placeRoadblock(game);
      this.roadblockT = 7;
    }

    // Air One
    if (this.stars >= 3) {
      this.heliT += dt;
      if (!this.heli && this.heliT > 0.45) this.heli = { x: px, y: py - 200, angle: 0, phase: Math.random() * 6 };
      if (this.heli) {
        this.heli.phase += dt;
        const hx = px + Math.cos(this.heli.phase * 0.7) * 130;
        const hy = py + Math.sin(this.heli.phase * 0.9) * 110 - 60;
        this.heli.x += (hx - this.heli.x) * Math.min(1, dt * 2.2);
        this.heli.y += (hy - this.heli.y) * Math.min(1, dt * 2.2);
        this.heli.angle = Math.atan2(px - this.heli.x, -(py - this.heli.y));
      }
    } else { this.heli = null; this.heliT = 0; }

    // cruisers hunt
    for (const car of this.cars) {
      if (car.wrecked) continue;
      if (car.roadblock) {
        const d = Math.hypot(car.x - px, car.y - py);
        if (d > 1000) car.dead = true;
        continue;
      }
      const d = Math.hypot(car.x - px, car.y - py);
      if (d > 1500 && this.stars < 3) { car.dead = true; continue; }
      const wantAngle = Math.atan2(px - car.x, -(py - car.y));
      car.angle += clamp(angleDelta(car.angle, wantAngle), -2.3 * dt, 2.3 * dt);
      const top = d > 60 ? CRUISER.top * 0.97 : 60;
      car.speed += clamp(top - car.speed, -300 * dt, 210 * dt);
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.y += -Math.cos(car.angle) * car.speed * dt;
      collideCircle(game.world, car, car.radius);
      // an officer piles out when they corner Rio on foot
      if (!p.car && d < 95 && this.officers.length < Math.min(5, this.stars + 1) && Math.random() < dt * 0.9) {
        this.officers.push({ x: car.x + 20, y: car.y + 10, angle: 0, radius: 12, walkCycle: Math.random() * 6 });
      }
    }
    this.cars = this.cars.filter((c) => !c.dead);

    // officers on foot work the arrest
    let arresting = false;
    for (const o of this.officers) {
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (p.car || d > 1300) { o.dead = true; continue; }
      o.angle = Math.atan2(p.x - o.x, -(p.y - o.y));
      if (d > 30) {
        o.x += Math.sin(o.angle) * 152 * dt;
        o.y += -Math.cos(o.angle) * 152 * dt;
        o.walkCycle += dt * 8;
        collideCircle(game.world, o, o.radius);
      } else if (p.speedNow < 32) arresting = true;
    }
    this.officers = this.officers.filter((o) => !o.dead);
    if (arresting) game.arrestFill = Math.min(1, game.arrestFill + dt / 2.4);
    else game.arrestFill = Math.max(0, game.arrestFill - dt * 1.3);
  }
}
