// game.js — simulation core for Vice Harbor: Port Serena.
// Owns the player, the vehicle/ped lists, the clock, the camera, particle
// and skid pools, and the save file. Rendering lives in render.js; this
// file never touches the canvas.

import { CFG, SAVE_KEY } from './config.js';
import { RNG, clamp, dist } from './random.js';
import { world } from './world.js';
import { input } from './input.js';
import {
  spawnTraffic, spawnParked, spawnPeds, updateTrafficCar, updatePed,
  moveCar, bailDriver,
} from './entities.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { AudioSys } from './audio.js';
import { tryPunch, damagePlayer, endRun, respawn } from './combat.js';

export class Game {
  constructor() {
    this.rng = new RNG(7);
    this.screen = 'title'; // title | play | pause | busted | wasted
    this.hour = CFG.startHour;
    this.time = 0;
    this.fps = 60;
    this.player = this.freshPlayer();
    this.vehicles = [];
    this.peds = [];
    this.police = new Police(this.rng);
    this.missions = new Missions();
    this.audio = new AudioSys();
    this.particles = [];
    this.skids = [];
    this.camera = { x: this.player.x, y: this.player.y, shake: 0 };
    this.threatAt = null;
    this.message = '';
    this.messageTimer = 0;
    this.endTimer = 0;
    this.lastFee = 0;
    this.stats = { jobsDone: 0, pedsHit: 0, officersHit: 0, carsStolen: 0, topSpeed: 0 };
    this.currentDistrict = world.districtAt(this.player.x, this.player.y).name;
    this.districtBannerTimer = 0;
    this.hasSave = false;
    this.populate();
    this.refreshSaveFlag();
  }

  freshPlayer() {
    return {
      x: 960, y: 470, angle: Math.PI / 2, health: CFG.playerHealth,
      inCar: null, cash: 120, respect: 0, arrestMeter: 0,
      punchCooldown: 0, punchAnim: 0, hurtFlash: 0, passengerAboard: false,
      speed: 0,
    };
  }

  populate() {
    this.vehicles = [...spawnTraffic(this.rng), ...spawnParked(this.rng)];
    this.peds = spawnPeds(this.rng);
  }

  // --- Save / load ---------------------------------------------------------
  refreshSaveFlag() {
    try { this.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { this.hasSave = false; }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash, respect: this.player.respect,
        jobIndex: this.missions.index, x: this.player.x, y: this.player.y,
        hour: this.hour, stats: this.stats,
      }));
      this.hasSave = true;
    } catch { /* storage may be unavailable headless — saving is best-effort */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.player.cash = s.cash | 0;
      this.player.respect = s.respect | 0;
      this.player.x = +s.x || this.player.x;
      this.player.y = +s.y || this.player.y;
      this.hour = +s.hour || this.hour;
      this.missions.index = clamp(s.jobIndex | 0, 0, 6);
      if (s.stats) this.stats = { ...this.stats, ...s.stats };
      return true;
    } catch { return false; }
  }

  startGame(useSave) {
    this.audio.start();
    if (useSave) this.load();
    this.missions.betweenTimer = 0.1;
    this.missions.active = false;
    this.screen = 'play';
  }

  setWanted(n) {
    // Debug / screenshot hook: jump straight to a star level.
    const heatFor = [0, 15, 45, 85, 125, 175];
    this.police.heat = heatFor[clamp(n | 0, 0, 5)];
    if (n === 0) this.police.clearUnits(this);
  }

  getState() {
    return {
      cash: this.player.cash, respect: this.player.respect,
      wanted: this.police.wanted, heat: Math.round(this.police.heat),
      vehicles: this.vehicles.length, peds: this.peds.length,
      policeCars: this.police.cars.length, officers: this.police.officers.length,
      helicopter: this.police.heli.active,
      fps: Math.round(this.fps), screen: this.screen,
      hour: +this.hour.toFixed(2), district: this.currentDistrict,
      jobIndex: this.missions.index, inCar: !!this.player.inCar,
      health: Math.round(this.player.health),
    };
  }

  // --- Effects pools ---------------------------------------------------------
  spawnParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= CFG.particleCap) this.particles.shift();
      const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(30, 170);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.rng.range(0.25, 0.7), maxLife: 0.7, color, size: this.rng.range(1.5, 3.5) });
    }
  }

  addSkid(x, y, angle) {
    if (this.skids.length >= CFG.skidCap) this.skids.shift();
    this.skids.push({ x, y, angle, life: 6 });
  }

  // --- Main update -----------------------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.threatAt) { this.threatAt.timer -= dt; if (this.threatAt.timer <= 0) this.threatAt = null; }
    if (this.screen === 'busted' || this.screen === 'wasted') {
      this.endTimer += dt;
      if (this.endTimer > 1.4 && (input.wasPressed('KeyE', 'Enter', 'Space') || this.endTimer > 4)) {
        respawn(this);
      }
      input.endFrame();
      return;
    }
    if (this.screen !== 'play') { input.endFrame(); return; }

    // Clock: a full day/night cycle.
    this.hour = (this.hour + (dt * 24) / CFG.dayLengthSec) % 24;

    const p = this.player;
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.punchAnim = Math.max(0, p.punchAnim - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);

    if (p.inCar) this.updateDriving(dt); else this.updateOnFoot(dt);

    // World actors.
    for (const car of this.vehicles) {
      if (car === p.inCar || car.kind === 'police') continue;
      updateTrafficCar(car, dt, this.vehicles, this.rng);
    }
    const threat = this.threatAt ? { x: this.threatAt.x, y: this.threatAt.y } : null;
    for (const ped of this.peds) updatePed(ped, dt, threat, this.rng);
    // Passenger rides in the back seat, invisible until delivery. If Rio
    // stepped out mid-job she waits by the kerb and climbs back in when he
    // returns with a car — otherwise the VIP job could soft-lock.
    const passenger = this.missions.passenger;
    if (passenger && !passenger.isPassenger && passenger.state === 'wait' && p.inCar
        && dist(passenger.x, passenger.y, p.x, p.y) < 76) {
      passenger.isPassenger = true;
      p.passengerAboard = true;
    }
    if (passenger && passenger.isPassenger && p.inCar) {
      passenger.x = p.inCar.x; passenger.y = p.inCar.y;
    }

    this.police.update(dt, this);
    this.updateArrest(dt);
    this.updateCollisions(dt);
    this.missions.update(dt, this);

    // District tracking for the HUD banner.
    const dName = world.districtAt(p.x, p.y).name;
    if (dName !== this.currentDistrict) {
      this.currentDistrict = dName;
      this.districtBannerTimer = 2.6;
    }
    if (this.districtBannerTimer > 0) this.districtBannerTimer -= dt;

    // Camera follows with a little lookahead and impact shake.
    const focus = p.inCar || p;
    const look = p.inCar ? clamp(Math.abs(p.inCar.speed) * 0.35, 0, 90) : 0;
    const tx = focus.x + Math.cos(p.angle) * look;
    const ty = focus.y + Math.sin(p.angle) * look;
    this.camera.x += (tx - this.camera.x) * clamp(dt * 5, 0, 1);
    this.camera.y += (ty - this.camera.y) * clamp(dt * 5, 0, 1);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 26);

    // Particles & skids.
    for (const pt of this.particles) {
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const sk of this.skids) sk.life -= dt;
    this.skids = this.skids.filter((sk) => sk.life > 0);

    // Audio beds.
    let sirenProx = 0;
    for (const c of this.police.cars) {
      const d = dist(c.x, c.y, p.x, p.y);
      sirenProx = Math.max(sirenProx, clamp(1 - d / 620, 0, 1));
    }
    this.audio.update(dt, {
      inCar: !!p.inCar,
      speedNorm: p.inCar ? clamp(Math.abs(p.inCar.speed) / p.inCar.model.top, 0, 1) : 0,
      sirenProx,
    });

    if (input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.message = muted ? 'Muted' : 'Sound on'; this.messageTimer = 1.4;
    }
    input.endFrame();
  }

  updateOnFoot(dt) {
    const p = this.player;
    const mx = input.moveX(), my = input.moveY();
    const moving = mx !== 0 || my !== 0;
    const sprint = input.isDown('ShiftLeft', 'ShiftRight');
    const spd = sprint ? CFG.playerSprintSpeed : CFG.playerWalkSpeed;
    if (moving) {
      const len = Math.hypot(mx, my) || 1;
      p.angle = Math.atan2(my / len, mx / len);
      p.x += (mx / len) * spd * dt;
      p.y += (my / len) * spd * dt;
      p.speed = spd;
      const fixed = world.collideCircle(p.x, p.y, CFG.playerRadius);
      p.x = fixed.x; p.y = fixed.y;
    } else p.speed = 0;

    if (input.wasPressed('KeyJ') || input.clickPunch) tryPunch(this);

    // Enter a car: nearest vehicle within reach.
    if (input.wasPressed('KeyE', 'KeyF', 'Enter')) {
      let best = null, bd = 58;
      for (const car of this.vehicles) {
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bd) { bd = d; best = car; }
      }
      if (best) this.enterCar(best);
    }
    if (input.wasPressed('KeyR')) this.resetToRoad();
  }

  enterCar(car) {
    const p = this.player;
    p.inCar = car;
    car.kind = car.kind === 'police' ? 'police' : 'player';
    this.audio.sfx('enter');
    if (!car.stolen) {
      car.stolen = true;
      this.stats.carsStolen++;
      if (car.driverBailed || Math.abs(car.speed) > 24) {
        // already handled below
      }
      if (car.hadDriver) { /* reserved */ }
    }
    // Stealing a moving traffic car: driver bails, heat jumps.
    if (car.wasTraffic && Math.abs(car.speed) > 24) {
      bailDriver(car, this.peds, this.rng);
      this.police.crime('stealMovingCar');
    } else if (car.wasTraffic || car.wasParked) {
      this.police.crime('stealCar');
    }
    car.wasTraffic = false; car.wasParked = false;
  }

  exitCar() {
    const p = this.player;
    const car = p.inCar;
    if (!car) return;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    const fixed = world.collideCircle(p.x, p.y, CFG.playerRadius);
    p.x = fixed.x; p.y = fixed.y;
    if (car.kind === 'player') car.kind = 'parked';
    p.inCar = null;
    p.passengerAboard = p.passengerAboard && false;
    if (this.missions.passenger && this.missions.passenger.isPassenger) {
      // Lulu waits by the car if Rio steps out mid-job.
      this.missions.passenger.isPassenger = false;
      this.missions.passenger.x = p.x + 14; this.missions.passenger.y = p.y;
      this.missions.passenger.state = 'wait';
    }
  }

  updateDriving(dt) {
    const p = this.player;
    const car = p.inCar;
    const fwd = input.moveY() < 0 || input.isDown('KeyW', 'ArrowUp');
    const back = input.moveY() > 0 || input.isDown('KeyS', 'ArrowDown');
    const left = input.moveX() < 0, right = input.moveX() > 0;
    const brake = input.isDown('Space');

    if (fwd) car.speed += car.model.accel * dt;
    else if (back) car.speed -= (car.speed > 4 ? 320 : car.model.accel * 0.55) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 42 * dt);
    if (brake) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 460 * dt);
      if (Math.abs(car.speed) > 60 && this.rng.chance(0.5)) {
        this.addSkid(car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14, car.angle);
      }
    }
    car.speed = clamp(car.speed, -car.model.top * 0.38, car.model.top);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 4) {
      car.angle += steer * (1.9 * car.model.grip) * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 120, 0.35, 1);
    }
    moveCar(car, dt);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    this.stats.topSpeed = Math.max(this.stats.topSpeed, Math.abs(car.speed));

    if (input.wasPressed('KeyH')) this.audio.sfx('horn');
    if (input.wasPressed('KeyN')) {
      this.message = this.audio.cycleStation(); this.messageTimer = 1.6;
    }
    if (input.wasPressed('KeyE', 'KeyF', 'Enter')) {
      if (Math.abs(car.speed) < 130) this.exitCar();
    }
    if (input.wasPressed('KeyR')) this.resetToRoad();
  }

  resetToRoad() {
    const p = this.player;
    let best = null, bd = Infinity;
    for (const pt of world.intersections) {
      const d = dist(p.x, p.y, pt.x, pt.y);
      if (d < bd) { bd = d; best = pt; }
    }
    if (p.inCar) { p.inCar.x = best.x; p.inCar.y = best.y; p.inCar.speed = 0; }
    p.x = best.x; p.y = best.y;
    this.camera.x = p.x; this.camera.y = p.y;
    this.message = 'Back on the road'; this.messageTimer = 1.2;
  }

  updateArrest(dt) {
    const p = this.player;
    if (this.police.wanted === 0) { p.arrestMeter = Math.max(0, p.arrestMeter - CFG.arrestDrainPerSec * dt); return; }
    const slowOrFoot = !p.inCar || Math.abs(p.inCar.speed) < 26;
    let near = false;
    if (slowOrFoot) {
      for (const off of this.police.officers) {
        if (off.state !== 'down' && dist(off.x, off.y, p.x, p.y) < CFG.arrestRange) near = true;
      }
      for (const car of this.police.cars) {
        if (dist(car.x, car.y, p.x, p.y) < CFG.arrestRange + 14 && Math.abs(car.speed) < 30) near = true;
      }
    }
    if (near) {
      p.arrestMeter += CFG.arrestFillPerSec * dt;
      if (p.arrestMeter >= 1) { p.arrestMeter = 1; endRun(this, 'busted'); }
    } else {
      p.arrestMeter = Math.max(0, p.arrestMeter - CFG.arrestDrainPerSec * dt);
    }
  }

  updateCollisions(dt) {
    void dt;
    const p = this.player;
    // Generic separation for non-player pairs: traffic that spawns or
    // converges into the same space pushes apart instead of jamming
    // nose-to-nose forever. (Pairs involving Rio's car get the full
    // damage treatment below.)
    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      if (a === p.inCar) continue;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        if (b === p.inCar) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        const minD = (a.model.w + b.model.w) * 0.36;
        if (d > 0.01 && d < minD) {
          const push = ((minD - d) / d) * 0.32;
          const nx = (b.x - a.x) * push, ny = (b.y - a.y) * push;
          a.x -= nx; a.y -= ny;
          b.x += nx; b.y += ny;
        }
      }
    }
    // Player car vs other cars: soft push + damage + crash feedback.
    if (p.inCar) {
      const mine = p.inCar;
      for (const other of this.vehicles) {
        if (other === mine) continue;
        const d = dist(mine.x, mine.y, other.x, other.y);
        const minD = (mine.model.w + other.model.w) * 0.36;
        if (d > 0 && d < minD) {
          const nx = (other.x - mine.x) / d, ny = (other.y - mine.y) / d;
          const push = (minD - d) * 0.5;
          other.x += nx * push; other.y += ny * push;
          mine.x -= nx * push; mine.y -= ny * push;
          const impact = Math.abs(mine.speed) * 0.4;
          // Only a genuine closing-speed hit counts as a crash. Low-speed
          // rubbing (a neighbour car glued to your flank in traffic) just
          // pushes apart — otherwise the speed penalty fires every frame
          // and Rio can never pull away from a jam.
          if (impact > 6 && Math.abs(mine.speed) > 55) {
            this.camera.shake = Math.min(9, impact * 0.14);
            this.spawnParticles(other.x, other.y, 5, '#ffd23f');
            this.audio.sfx('crash');
            damagePlayer(this, impact * 0.12);
            if (other.kind === 'police') this.police.crime('hitPoliceCar');
            mine.speed *= 0.55;
          } else if (other.kind === 'police' && Math.abs(mine.speed) > 120) {
            this.police.crime('hitPoliceCar');
          }
        }
      }
      // Player car vs pedestrians: a serious crime, and it hurts.
      if (Math.abs(mine.speed) > 70) {
        for (const ped of this.peds) {
          if (ped.state === 'down' || ped.isPassenger || ped.role === 'officer') continue;
          if (dist(mine.x, mine.y, ped.x, ped.y) < 24) {
            ped.state = 'down'; ped.downTimer = 4; ped.health -= 30;
            this.police.crime('hitPedWithCar');
            this.spawnParticles(ped.x, ped.y, 8, '#ef476f');
            this.camera.shake = Math.min(8, this.camera.shake + 3);
            mine.speed *= 0.8;
          }
        }
      }
    }
  }
}

// Mark freshly spawned traffic/parked cars so enterCar can price the crime.
// Done here, once, by tagging the arrays populate() produced.
const _origPopulate = Game.prototype.populate;
Game.prototype.populate = function patchedPopulate() {
  _origPopulate.call(this);
  for (const v of this.vehicles) {
    if (v.kind === 'traffic') v.wasTraffic = true;
    if (v.kind === 'parked') v.wasParked = true;
  }
};
