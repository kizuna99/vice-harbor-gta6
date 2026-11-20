// Game orchestration for the v2 edition: fixed-step simulation,
// day-night clock, camera, particles, shops, races, crew, enemies
// and the v3 save file. Rendering lives in render.js.

import { WORLD, SAVE_KEY, DAY_LENGTH_SEC, START_HOUR, CRIME_HEAT, WEAPON_SHOP, GARAGE, SAFEHOUSE } from './config.js';
import { clamp } from './random.js';
import { buildWorld, districtAt, world } from './world.js';
import { keys, pressed, consume, anyPressed, axisX, axisY, sprinting, drainPressed } from './input.js';
import {
  spawnTraffic, spawnParked, spawnPeds, makePlayer,
  updateTrafficCar, updatePed, updatePlayerOnFoot, updatePlayerCar,
  nearestEnterableCar,
} from './entities.js';
import { police, addHeat as policeAddHeat, updatePolice, clearWanted, starsForHeat } from './police.js';
import { tryPunch, damagePlayer, respawnAtClinic, bustedPenalty } from './combat.js';
import { missions, beginMissions, startJobStep, updateMissions, showMessage, currentStep } from './missions.js';
import {
  WEAPONS, SLOT_ORDER, defaultAmmo, switchWeapon, startReload,
  updatePlayerAttack, updateGrenades, updateProjectiles, updateEnemies,
  updateCarExplosions, buyWeaponItem, buyGarageItem,
} from './weapons.js';
import { raceAt, startRace, updateRace } from './races.js';
import { makeCrewMember, CREW_DEFS, tryRecruit, toggleCrewMode, updateCrew } from './crew.js';
import { audio } from './audio.js';

export const game = {
  state: 'title',
  player: null,
  cars: [],
  peds: [],
  enemies: [],
  projectiles: [],
  grenades: [],
  crew: [],
  policeRef: police,
  audio,
  cash: 250,
  respect: 0,
  jobsDone: 0,
  weaponsOwned: { fists: true },
  ammo: defaultAmmo(),
  mods: { engine: false, plating: false },
  shop: null,
  raceState: null,
  lastRace: null,
  enemiesDown: 0,
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
  ramCooldown: 0,

  addHeat(n) { policeAddHeat(n, this); },
  hurtPlayer(n) { damagePlayer(this, n); },
  tryPunchNow() { tryPunch(this); },
  showBanner(text, secs) { showMessage(this, text, secs); },

  onWantedRise() { this.audio?.checkpoint(); },

  onPoliceRam() {
    if (this.ramCooldown > 0) return;
    this.ramCooldown = 0.5;
    damagePlayer(this, 4);
    this.shake = Math.min(12, this.shake + 3);
    this.audio?.crash();
  },

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
    if (this.particles.length >= 260) this.particles.shift();
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
    this.shop = null;
    if (fresh) {
      this.cash = 250; this.respect = 0; this.jobsDone = 0;
      this.weaponsOwned = { fists: true };
      this.ammo = defaultAmmo();
      this.mods = { engine: false, plating: false };
      this.enemies = []; this.projectiles = []; this.grenades = []; this.crew = [];
      this.enemiesDown = 0;
      this.raceState = null; this.lastRace = null;
      missions.jobIndex = 0; missions.stepIndex = 0; missions.done = false;
      this.player.x = world.spawn.x; this.player.y = world.spawn.y;
      this.player.health = 100; this.player.armor = 0; this.player.weapon = 'fists';
      this.player.car = null;
      clearWanted();
      beginMissions(this);
    } else {
      startJobStep(this);
      showMessage(this, 'Welcome back to Port Serena, Rio.', 3.5);
    }
  },

  // --- save / load (v3: weapons, ammo, armor, mods, crew) ---------------

  save() {
    try {
      const p = this.player;
      const data = {
        cash: this.cash, respect: this.respect, jobsDone: this.jobsDone,
        jobIndex: missions.jobIndex, stepIndex: missions.stepIndex, done: missions.done,
        hour: this.hour,
        px: Math.round(p.x), py: Math.round(p.y),
        weaponsOwned: Object.keys(this.weaponsOwned).filter((k) => this.weaponsOwned[k]),
        ammo: this.ammo,
        armor: Math.round(p.armor),
        health: Math.round(p.health),
        weapon: p.weapon,
        mods: this.mods,
        crew: this.crew.map((m) => m.name),
        enemiesDown: this.enemiesDown,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable */ }
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
      if (Array.isArray(d.weaponsOwned)) {
        this.weaponsOwned = { fists: true };
        for (const k of d.weaponsOwned) this.weaponsOwned[k] = true;
      } else if (d.weaponsOwned && typeof d.weaponsOwned === 'object') {
        this.weaponsOwned = { fists: true, ...d.weaponsOwned };
      }
      if (d.ammo) {
        const base = defaultAmmo();
        for (const k of Object.keys(base)) {
          if (d.ammo[k]) base[k] = { mag: d.ammo[k].mag | 0, reserve: d.ammo[k].reserve | 0 };
        }
        this.ammo = base;
      }
      if (typeof d.armor === 'number') this.player.armor = d.armor;
      if (typeof d.health === 'number') this.player.health = d.health;
      if (d.weapon && WEAPONS[d.weapon]) this.player.weapon = d.weapon;
      if (d.mods) this.mods = { engine: !!d.mods.engine, plating: !!d.mods.plating };
      if (Array.isArray(d.crew)) {
        this.crew = [];
        for (const name of d.crew) {
          const def = CREW_DEFS.find((c) => c.name === name);
          if (def) this.crew.push(makeCrewMember(def, this.player.x + 24, this.player.y + 8));
        }
      }
      if (typeof d.enemiesDown === 'number') this.enemiesDown = d.enemiesDown;
      return true;
    } catch { return false; }
  },

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },

  // --- shops ---------------------------------------------------------------

  handleShopInput() {
    if (consume('Escape') || consume('KeyP')) { this.shop = null; return; }
    for (let i = 0; i < 8; i++) {
      if (consume(`Digit${i + 1}`)) {
        const ok = this.shop === 'weapons' ? buyWeaponItem(this, i) : buyGarageItem(this, i);
        if (!ok) showMessage(this, 'Cannot buy that (cash, already owned, or not applicable).', 1.8);
      }
    }
  },

  // --- per-tick simulation ---------------------------------------------------

  step(dt) {
    this.time += dt;
    this.hintT = Math.max(0, this.hintT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.districtBannerT = Math.max(0, this.districtBannerT - dt);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 26);

    this.hour += (dt / DAY_LENGTH_SEC) * 24;
    if (this.hour >= 24) { this.hour -= 24; this.dayCount++; }

    if (this.state === 'busted' || this.state === 'wasted') {
      this.endTimer -= dt;
      this.updateFx(dt);
      if (this.endTimer <= 0) this.resolveEndState();
      drainPressed();
      return;
    }
    if (this.state !== 'playing') { this.updateFx(dt); drainPressed(); return; }

    const p = this.player;

    // Inside a shop the world waits: browse with Digit1-8, leave with Esc.
    if (this.shop) {
      this.handleShopInput();
      this.updateFx(dt);
      drainPressed();
      return;
    }

    if (anyPressed('KeyP', 'Escape')) { this.state = 'paused'; drainPressed(); return; }

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
    if (consume('KeyC')) toggleCrewMode(this);
    if (consume('KeyQ')) startReload(this);
    if (consume('KeyR')) {
      if (p.car) { p.car.x = world.spawn.x; p.car.y = world.spawn.y; p.car.speed = 0; }
      p.x = world.spawn.x; p.y = world.spawn.y;
      showMessage(this, 'Back at Bea\'s corner.', 2);
    }

    // Weapon slots 1-5 (outside shops).
    for (let s = 0; s < SLOT_ORDER.length; s++) {
      if (consume(`Digit${s + 1}`)) switchWeapon(this, SLOT_ORDER[s]);
    }
    // Digits 6-8 have no meaning outside a shop; they are drained below.

    // Interact: shops and the safehouse outrank getting into a car.
    if (anyPressed('KeyE', 'KeyF', 'Enter')) {
      audio.init(); audio.resume();
      if (p.car) {
        if (Math.hypot(p.car.x - GARAGE.x, p.car.y - GARAGE.y) < GARAGE.radius) {
          this.shop = 'garage';
          showMessage(this, 'Serena Customs — keys 1-4, Esc to leave.', 2.5);
        } else {
          const car = p.car;
          p.car = null;
          p.x = car.x + Math.cos(car.angle) * 30;
          p.y = car.y + Math.sin(car.angle) * 30;
          car.driver = false;
          audio.door();
        }
      } else if (Math.hypot(p.x - WEAPON_SHOP.x, p.y - WEAPON_SHOP.y) < WEAPON_SHOP.radius) {
        this.shop = 'weapons';
        showMessage(this, 'Serena Munitions — keys 1-8, Esc to leave.', 2.5);
      } else if (Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) < SAFEHOUSE.radius && tryRecruit(this)) {
        // Recruited — tryRecruit already messaged and saved.
      } else {
        const car = nearestEnterableCar(p, this.cars);
        if (car) {
          const wasParked = car.parked;
          const hadDriver = car.driver;
          if (hadDriver && !wasParked) {
            const ped = this.peds[0];
            if (ped) { ped.x = car.x + 24; ped.y = car.y; ped.state = 'flee'; ped.panic = 2.5; }
            this.addHeat(CRIME_HEAT.stealCar);
            car.stolen = true;
          } else if (wasParked) {
            this.addHeat(CRIME_HEAT.stealCar * 0.5);
          }
          car.parked = false; car.driver = true;
          if (this.mods.engine) car.tuned = true;
          if (this.mods.plating) car.plated = true;
          p.car = car;
          audio.door();
          if (car.isMissionCar) showMessage(this, 'Got the Solano. Warehouse 7 — go!', 3.5);
        }
      }
    }

    // Attack / race-start share the J edge. In a car at a race marker,
    // J flags the race off; on foot, J fires or punches. The edge is
    // consumed here or in updatePlayerAttack, and any leftover is
    // drained at the end of the tick — never carried over.
    const attackEdge = pressed.has('KeyJ') || pressed.has('MousePunch');
    if (p.car) {
      if (attackEdge && !this.raceState) {
        const race = raceAt(p.car.x, p.car.y);
        if (race) {
          startRace(this, race);
          showMessage(this, `${race.name} — get ready!`, 2.5);
        }
      }
    } else {
      updatePlayerAttack(this, dt, attackEdge, !!keys['KeyJ']);
    }

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
      if ((input.brake && Math.abs(p.car.speed) > 60) || (Math.abs(input.x) > 0 && Math.abs(p.car.speed) > 210)) {
        this.addSkid(p.car.x, p.car.y, p.car.angle);
      }
      threat = { x: p.car.x, y: p.car.y, radius: Math.abs(p.car.speed) > 40 ? 90 : 30, active: true };
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
      threat = { x: p.x, y: p.y, radius: 46, active: p.punchAnim > 0.4 };
    }

    // Stunt ramps + airborne physics for every car.
    for (const car of [...this.cars, ...police.cars]) {
      car.rampCooldown = Math.max(0, (car.rampCooldown || 0) - dt);
      if (car.airZ > 0 || car.zVel > 0) {
        car.airZ += car.zVel * dt;
        car.zVel -= 720 * dt;
        if (car.airZ <= 0) { car.airZ = 0; car.zVel = 0; }
      } else if (Math.abs(car.speed) > 80 && car.rampCooldown <= 0) {
        for (const r of world.ramps) {
          if (car.x > r.x - r.w / 2 && car.x < r.x + r.w / 2 && car.y > r.y - r.h / 2 && car.y < r.y + r.h / 2) {
            car.zVel = 265;
            car.airZ = 1;
            car.rampCooldown = 1.4;
            if (car === p.car) { this.audio?.checkpoint(); showMessage(this, 'Airborne!', 1.4); }
            break;
          }
        }
      }
    }

    // --- ambient world ---
    const events = [];
    for (const car of this.cars) {
      if (car === p.car) continue;
      updateTrafficCar(car, dt, this.cars, p, events, this.peds);
      if (p.car && Math.hypot(car.x - p.car.x, car.y - p.car.y) < 40 && Math.abs(p.car.speed) > 50) {
        car.speed *= 0.4; p.car.speed *= 0.55;
        this.addHeat(CRIME_HEAT.hitCar);
        damagePlayer(this, 3);
        this.audio?.crash();
      }
    }
    for (const e of events) if (e.type === 'honk') audio.honk();
    for (const ped of this.peds) updatePed(ped, dt, threat);

    updatePolice(dt, p, this);

    // Searchlight Run: the heat lock re-asserts itself after the
    // normal police bookkeeping until the safehouse scrubs it.
    const stepNow = currentStep();
    if (stepNow && stepNow.heatLock && this.state === 'playing') {
      police.heat = stepNow.heatLock;
      police.stars = starsForHeat(police.heat);
      if (!police.heli && police.stars >= 3) {
        police.heli = { x: p.x + 300, y: p.y - 260, angle: 0, sweep: 0, spotX: p.x, spotY: p.y };
      }
    }

    updateEnemies(this, dt);
    updateCrew(this, dt);
    updateRace(this, dt);
    updateProjectiles(this, dt);
    updateGrenades(this, dt);
    updateCarExplosions(this, dt);
    updateMissions(dt, this);

    const dName = districtAt(p.x, p.y).name;
    if (dName !== this.districtName) {
      this.districtName = dName;
      this.districtBannerT = 2.6;
    }

    const lead = p.car ? clamp(p.car.speed * 0.22, -60, 90) : 0;
    const tx = p.x + Math.sin(p.angle) * lead;
    const ty = p.y - Math.cos(p.angle) * lead;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);

    this.updateFx(dt);

    let nearestCop = Infinity;
    for (const c of police.cars) nearestCop = Math.min(nearestCop, Math.hypot(c.x - p.x, c.y - p.y));
    audio.update(dt, {
      inCar: !!p.car,
      carSpeed: p.car ? p.car.speed : 0,
      nearestCopDist: nearestCop,
    });

    // The stale-input fix: no edge survives the tick it arrived in.
    drainPressed();
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
      this.player.x = 640; this.player.y = 300;
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
  const t = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
  return 0.12 + 0.88 * t;
}
export { WORLD, WEAPON_SHOP as _WS, GARAGE as _G, SAFEHOUSE as _SH };
