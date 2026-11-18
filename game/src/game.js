// Game orchestration: fixed-step simulation, day-night clock, camera,
// particles, skidmarks, crime bookkeeping and the save file.
// Rendering lives in render.js; this module owns every piece of state.

import { WORLD, SAVE_KEY, DAY_LENGTH_SEC, START_HOUR, CRIME_HEAT } from './config.js';
import { clamp } from './random.js';
import { buildWorld, districtAt, world } from './world.js';
import { keys, consume, anyPressed, axisX, axisY, sprinting } from './input.js';
import {
  spawnTraffic, spawnParked, spawnPeds, makePlayer,
  updateTrafficCar, updatePed, updatePlayerOnFoot, updatePlayerCar,
  nearestEnterableCar,
} from './entities.js';
import { police, addHeat as policeAddHeat, updatePolice, clearWanted } from './police.js';
import { tryPunch, damagePlayer, respawnAtClinic, bustedPenalty } from './combat.js';
import { missions, beginMissions, startJobStep, updateMissions, showMessage } from './missions.js';
import { audio } from './audio.js';

export const game = {
  state: 'title', // title | playing | paused | busted | wasted
  player: null,
  cars: [],
  peds: [],
  policeRef: police,
  audio,
  cash: 250,
  respect: 0,
  jobsDone: 0,
  hour: START_HOUR,
  dayCount: 1,
  camera: { x: 0, y: 0 },
  shake: 0,
  particles: [],
  skidmarks: [],
  bannerText: '',
  bannerT: 0,
  districtName: '',
  districtBannerT: 0,
  hintT: 0,
  fps: 60,
  time: 0,
  endTimer: 0,
  lastFine: 0,
  lastClinicFee: 0,
  started: false,
  muted: false,

  addHeat(n) { policeAddHeat(n, this); },

  onWantedRise() {
    this.audio?.checkpoint();
  },

  onPoliceRam() {
    if (this.ramCooldown > 0) return;
    this.ramCooldown = 0.5;
    damagePlayer(this, 4);
    this.shake = Math.min(12, this.shake + 3);
    this.audio?.crash();
  },
  ramCooldown: 0,

  onBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.endTimer = 2.6;
    this.lastFine = bustedPenalty(this);
    this.audio?.bustedJingle();
  },

  onWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.endTimer = 2.6;
    this.audio?.wastedJingle();
  },

  spawnHitParticles(x, y) {
    for (let i = 0; i < 10; i++) this.spawnParticle(x, y, '#ffd166');
  },

  spawnParticle(x, y, color) {
    if (this.particles.length >= 240) this.particles.shift();
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 130;
    this.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.45 + Math.random() * 0.4, maxLife: 0.85,
      color, size: 2 + Math.random() * 3,
    });
  },

  addSkid(x, y, angle) {
    if (this.skidmarks.length >= 300) this.skidmarks.shift();
    this.skidmarks.push({ x, y, angle, life: 6 });
  },

  // --- lifecycle ----------------------------------------------------------

  init(seed) {
    buildWorld();
    this.player = makePlayer(world.spawn.x, world.spawn.y);
    this.cars = [...spawnTraffic(17), ...spawnParked(13)];
    this.peds = spawnPeds(30);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.districtName = districtAt(this.player.x, this.player.y).name;
    void seed;
  },

  startGame(fresh) {
    this.state = 'playing';
    this.started = true;
    if (fresh) {
      this.cash = 250; this.respect = 0; this.jobsDone = 0;
      missions.jobIndex = 0; missions.stepIndex = 0; missions.done = false;
      this.player.x = world.spawn.x; this.player.y = world.spawn.y;
      this.player.health = 100; this.player.car = null;
      clearWanted();
      beginMissions(this);
    } else {
      // Continuing: keep the loaded job progress, just re-arm its step.
      startJobStep(this);
      showMessage(this, 'Welcome back to Port Serena, Rio.', 3.5);
    }
  },

  // --- save / load --------------------------------------------------------

  save() {
    try {
      const data = {
        cash: this.cash, respect: this.respect, jobsDone: this.jobsDone,
        jobIndex: missions.jobIndex, stepIndex: missions.stepIndex, done: missions.done,
        hour: this.hour,
        px: Math.round(this.player.x), py: Math.round(this.player.y),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable — game continues unsaved */ }
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.cash = d.cash ?? 250;
      this.respect = d.respect ?? 0;
      this.jobsDone = d.jobsDone ?? 0;
      missions.jobIndex = d.jobIndex ?? 0;
      missions.stepIndex = d.stepIndex ?? 0;
      missions.done = !!d.done;
      this.hour = d.hour ?? START_HOUR;
      if (typeof d.px === 'number') { this.player.x = d.px; this.player.y = d.py; }
      return true;
    } catch { return false; }
  },

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },

  // --- per-tick simulation --------------------------------------------------

  step(dt) {
    this.time += dt;
    this.hintT = Math.max(0, this.hintT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.districtBannerT = Math.max(0, this.districtBannerT - dt);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 26);

    // Clock: a full cycle every DAY_LENGTH_SEC seconds.
    this.hour += (dt / DAY_LENGTH_SEC) * 24;
    if (this.hour >= 24) { this.hour -= 24; this.dayCount++; }

    if (this.state === 'busted' || this.state === 'wasted') {
      this.endTimer -= dt;
      this.updateFx(dt);
      if (this.endTimer <= 0) this.resolveEndState();
      return;
    }
    if (this.state !== 'playing') { this.updateFx(dt); return; }

    const p = this.player;

    // Pause toggle.
    if (anyPressed('KeyP', 'Escape')) { this.state = 'paused'; return; }

    // --- input-driven actions ---
    const input = {
      x: axisX(), y: axisY(),
      sprint: sprinting(),
      brake: !!keys['Space'],
    };

    if (consume('KeyM')) {
      this.muted = audio.toggleMute();
      showMessage(this, this.muted ? 'Sound off' : 'Sound on', 1.6);
    }
    if (consume('KeyN') && p.car) {
      audio.init(); audio.resume();
      showMessage(this, `Radio: ${audio.cycleStation()}`, 2);
    }
    if (consume('KeyH')) audio.honk();
    if (consume('KeyR')) {
      // Reset to the nearest safe spot: Bea's corner.
      if (p.car) { p.car.x = world.spawn.x; p.car.y = world.spawn.y; p.car.speed = 0; }
      p.x = world.spawn.x; p.y = world.spawn.y;
      showMessage(this, 'Back at Bea\'s corner.', 2);
    }

    // Enter / exit vehicles.
    if (anyPressed('KeyE', 'KeyF', 'Enter')) {
      audio.init(); audio.resume();
      if (p.car) {
        const car = p.car;
        p.car = null;
        p.x = car.x + Math.cos(car.angle) * 30;
        p.y = car.y + Math.sin(car.angle) * 30;
        car.driver = false;
        if (car.parked) car.parked = true;
        audio.door();
      } else {
        const car = nearestEnterableCar(p, this.cars);
        if (car) {
          const wasParked = car.parked;
          const hadDriver = car.driver;
          if (hadDriver && !car.parked) {
            // Driver bails out and runs.
            const ped = this.peds[0];
            if (ped) { ped.x = car.x + 24; ped.y = car.y; ped.state = 'flee'; ped.panic = 2.5; }
            this.addHeat(CRIME_HEAT.stealCar);
            car.stolen = true;
          } else if (wasParked) {
            this.addHeat(CRIME_HEAT.stealCar * 0.5);
          }
          car.parked = false; car.driver = true;
          p.car = car;
          audio.door();
          if (car.isMissionCar) showMessage(this, 'Got the Solano. Warehouse 7 — go!', 3.5);
        }
      }
    }

    // Punching.
    if (anyPressed('KeyJ', 'MousePunch')) tryPunch(this);

    // --- movement ---
    let threat = null;
    if (p.car) {
      const impact = updatePlayerCar(p.car, dt, input);
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      if (impact) {
        this.audio?.crash();
        this.addHeat(CRIME_HEAT.hitCar);
        for (let i = 0; i < 8; i++) this.spawnParticle(p.car.x, p.car.y, '#cfd8dc');
      }
      // Skidmarks under hard braking / fast cornering.
      if ((input.brake && Math.abs(p.car.speed) > 60) || Math.abs(input.x) > 0 && Math.abs(p.car.speed) > 210) {
        this.addSkid(p.car.x, p.car.y, p.car.angle);
      }
      threat = { x: p.car.x, y: p.car.y, radius: Math.abs(p.car.speed) > 40 ? 90 : 30, active: true };
      // Running over a pedestrian is a serious crime.
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
        if (d < 26 && Math.abs(p.car.speed) > 30) {
          ped.state = 'down'; ped.downT = 4; ped.health -= 60;
          this.addHeat(CRIME_HEAT.hitPed);
          damagePlayer(this, 2);
          this.spawnHitParticles(ped.x, ped.y);
        }
      }
    } else {
      updatePlayerOnFoot(p, dt, input);
      if (anyPressed('KeyJ', 'MousePunch')) { /* handled above */ }
      threat = { x: p.x, y: p.y, radius: 46, active: p.punchAnim > 0.4 };
    }

    // --- ambient world ---
    const events = [];
    for (const car of this.cars) {
      if (car === p.car) continue;
      updateTrafficCar(car, dt, this.cars, p, events, this.peds);
      // Traffic vs player-car collisions.
      if (p.car && Math.hypot(car.x - p.car.x, car.y - p.car.y) < 40 && Math.abs(p.car.speed) > 50) {
        car.speed *= 0.4; p.car.speed *= 0.55;
        this.addHeat(CRIME_HEAT.hitCar);
        damagePlayer(this, 3);
        this.audio?.crash();
      }
    }
    for (const e of events) if (e.type === 'honk') audio.honk();
    for (const ped of this.peds) updatePed(ped, dt, threat);

    // --- law ---
    updatePolice(dt, p, this);

    // --- story ---
    updateMissions(dt, this);

    // --- district tracking ---
    const dName = districtAt(p.x, p.y).name;
    if (dName !== this.districtName) {
      this.districtName = dName;
      this.districtBannerT = 2.6;
    }

    // --- camera follows with a touch of speed lead ---
    const lead = p.car ? clamp(p.car.speed * 0.22, -60, 90) : 0;
    const tx = p.x + Math.sin(p.angle) * lead;
    const ty = p.y - Math.cos(p.angle) * lead;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);

    this.updateFx(dt);

    // --- audio bed ---
    let nearestCop = Infinity;
    for (const c of police.cars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - p.x, c.y - p.y));
    audio.update(dt, {
      inCar: !!p.car,
      carSpeed: p.car ? p.car.speed : 0,
      nearestCopDist: nearestCop,
    });
  },

  updateFx(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.skidmarks.length - 1; i >= 0; i--) {
      this.skidmarks[i].life -= dt;
      if (this.skidmarks[i].life <= 0) this.skidmarks.splice(i, 1);
    }
  },

  resolveEndState() {
    if (this.state === 'wasted') {
      respawnAtClinic(this);
      clearWanted();
      showMessage(this, `Harbor Clinic patched you up. Fee: $${this.lastClinicFee}.`, 4.5);
    } else if (this.state === 'busted') {
      this.player.busted = false;
      this.player.car = null;
      this.player.x = 640; this.player.y = 300; // outside SPD HQ, Old Town
      clearWanted();
      showMessage(this, `SPD released you. Fine: $${this.lastFine}. Stay sharp, Rio.`, 4.5);
    }
    this.state = 'playing';
    this.save();
  },

  resume() { if (this.state === 'paused') this.state = 'playing'; },
};

export function isNight(hour) {
  return hour < 5.6 || hour > 18.6;
}
export function daylight(hour) {
  // 0 at deep night, 1 at midday — smooth shoulders at dawn/dusk.
  const t = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
  return 0.12 + 0.88 * t;
}
export { WORLD };
