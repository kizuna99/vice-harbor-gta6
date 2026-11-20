// game.js — the Game itself: one object holding the whole run (Rio,
// the city traffic, the SPD, the job book, the races, the crew, the
// money) and the rules that connect them — E to interact, J to shoot
// or to flag off a race, number keys for shops and gun slots, Q to
// reload, C for the crew, N for the radio. Also the save: a single
// localStorage record, vice-harbor-save-v3, written on every job done.

import { WEAPONS, WEAPON_BY_SLOT, WEAPON_SHOP, GARAGE, GARAGE_ITEMS, ARMOR_PRICE, SAVE_KEY, STATIONS } from './config.js';
import { buildWorld, collideCircle, districtAt } from './world.js';
import { makePlayer, makeCar, spawnTraffic, spawnPeds, updateTraffic, updatePeds, driveCar } from './entities.js';
import { Police } from './police.js';
import { freshAmmo, fireControl, startReload } from './weapons.js';
import { updateCombat } from './combat.js';
import { createMissions, startStep, updateMissions } from './missions.js';
import { tryStartRace, updateRaces } from './races.js';
import { tryRecruit, toggleCrewMode, restoreCrew, updateCrew } from './crew.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { clamp } from './random.js';

const SPD_FRONT = { x: 600, y: 252 };
const HOSPITAL = { x: 1800, y: 948 };

export class Game {
  constructor(seed = 7) {
    this.seed = seed;
    this.world = buildWorld(seed);
    this.state = 'title';
    this.timeHours = 10.2;
    this.elapsed = 0;
    this.player = makePlayer();
    this.cars = spawnTraffic(this.world, seed);
    this.peds = spawnPeds(seed);
    this.enemies = [];
    this.projectiles = [];
    this.thrown = [];
    this.particles = [];
    this.policeRef = new Police();
    this.missions = createMissions();
    this.raceState = null;
    this.lastRace = null;
    this.crew = [];
    this.respect = 0;
    this.cash = 250;
    this.weaponsOwned = { fists: true };
    this.ammo = freshAmmo();
    this.mods = { engine: false, plating: false };
    this.shop = null;
    this.station = 0;
    this.arrestFill = 0;
    this.camera = { x: 1600, y: 800 };
    this.view = { w: 960, h: 600 };
    this.shake = 0;
    this.threat = { x: 0, y: 0, t: 0 };
    this.toasts = [];
    this.lastBump = null;
    this.overT = 0;
    this.hasSave = false;
    this.shotMode = null;
    this.factories = { makeCar: (t, x, y, a) => makeCar(t, x, y, a, Math.random) };
    try { this.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { this.hasSave = false; }
  }

  toast(text) {
    this.toasts.push({ text, t: 3.4 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  startGame() {
    Audio.unlock();
    this.player = makePlayer();
    this.cars = spawnTraffic(this.world, this.seed);
    this.peds = spawnPeds(this.seed);
    this.enemies = []; this.projectiles = []; this.thrown = []; this.particles = [];
    this.policeRef = new Police();
    this.missions = createMissions();
    this.raceState = null; this.lastRace = null;
    this.crew = [];
    this.respect = 0; this.cash = 250;
    this.weaponsOwned = { fists: true };
    this.ammo = freshAmmo();
    this.mods = { engine: false, plating: false };
    this.shop = null; this.station = 0; this.arrestFill = 0;
    this.timeHours = 10.2;
    this.state = 'playing';
    startStep(this);
    this.toast('Port Serena. Bea has work — follow the gold marker.');
  }

  continueGame() {
    Audio.unlock();
    if (this.load()) { this.state = 'playing'; this.toast('Welcome back to Port Serena.'); }
    else this.startGame();
  }

  setWanted(n) { this.policeRef.setWanted(n); }

  save() {
    const data = {
      ver: 3, cash: this.cash, respect: this.respect,
      weaponsOwned: this.weaponsOwned, ammo: this.ammo, mods: this.mods, station: this.station,
      player: { x: this.player.x, y: this.player.y, health: this.player.health, armor: this.player.armor, weapon: this.player.weapon },
      missions: { jobIndex: this.missions.jobIndex, stepIndex: this.missions.stepIndex, done: this.missions.done },
      crew: this.crew.map((m) => ({ name: m.name, x: Math.round(m.x), y: Math.round(m.y), health: m.health })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.hasSave = true; } catch { /* private mode */ }
    return true;
  }

  load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
    if (!data) return false;
    this.cash = data.cash ?? this.cash;
    this.respect = data.respect ?? 0;
    this.weaponsOwned = data.weaponsOwned || { fists: true };
    this.ammo = Object.assign(freshAmmo(), data.ammo || {});
    this.mods = Object.assign({ engine: false, plating: false }, data.mods || {});
    this.station = data.station ?? 0;
    Audio.setStation(this.station);
    if (data.player) {
      this.player.x = data.player.x; this.player.y = data.player.y;
      this.player.health = data.player.health; this.player.armor = data.player.armor;
      this.player.weapon = data.player.weapon || 'fists';
      this.player.car = null;
    }
    if (data.missions) {
      this.missions.jobIndex = data.missions.jobIndex;
      this.missions.stepIndex = data.missions.stepIndex;
      this.missions.done = data.missions.done;
      this.missions.active = false; this.missions.runtime = null;
    }
    restoreCrew(this, data.crew);
    return true;
  }

  endPursuitIfAny() {
    if (this.policeRef.heatLock !== null) {
      this.policeRef.heatLock = null;
      this.missions.active = false;
      this.missions.runtime = null;
    }
  }

  busted() {
    if (this.state !== 'playing') return;
    this.endPursuitIfAny();
    this.state = 'busted';
    this.overT = 1.9;
    const fine = Math.min(this.cash, 150);
    this.cash -= fine;
    this.shop = null;
    Audio.denied();
    this.toast('BUSTED — the SPD impound your pride and $' + fine);
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.endPursuitIfAny();
    this.state = 'wasted';
    this.overT = 1.9;
    this.cash -= Math.min(this.cash, 100);
    this.shop = null;
    this.toast('WASTED — Serena General patches you up');
  }

  respawn() {
    const at = this.state === 'busted' ? SPD_FRONT : HOSPITAL;
    this.player.car = null;
    this.player.x = at.x; this.player.y = at.y;
    this.player.health = 100;
    if (this.state === 'wasted') this.player.armor = 0;
    this.policeRef.setWanted(0);
    this.arrestFill = 0;
    this.enemies = [];
    this.state = 'playing';
  }

  openShop(kind) { this.shop = kind; Audio.door(); }

  buyItem(n) {
    if (this.shop === 'weapons') {
      const guns = { 1: 'pistol', 2: 'smg', 3: 'shotgun' };
      if (guns[n]) {
        const key = guns[n], def = WEAPONS[key];
        if (this.weaponsOwned[key]) { this.toast('Already on your hip'); Audio.denied(); return; }
        if (this.cash < def.price) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= def.price;
        this.weaponsOwned[key] = true;
        this.ammo[key] = { mag: def.mag, reserve: def.reserve };
        this.toast(def.name + ' — yours. Slot ' + def.slot + '.');
        Audio.cash();
        return;
      }
      if (n === 4) {
        if (this.cash < WEAPONS.grenade.price) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= WEAPONS.grenade.price;
        this.weaponsOwned.grenade = true;
        this.ammo.grenade.mag = Math.min(12, this.ammo.grenade.mag + 3);
        this.toast('Three grenades, pins included');
        Audio.cash();
        return;
      }
      if (n === 5) {
        if (this.cash < 60) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= 60;
        for (const k of ['pistol', 'smg', 'shotgun']) if (this.weaponsOwned[k]) this.ammo[k].reserve = WEAPONS[k].reserve;
        this.toast('Magazines topped up');
        Audio.cash();
        return;
      }
      if (n === 6) {
        if (this.cash < 50) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= 50; this.player.health = 100;
        this.toast('Patched up');
        Audio.cash();
        return;
      }
      if (n === 8) {
        if (this.cash < ARMOR_PRICE) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= ARMOR_PRICE;
        this.player.armor = 100;
        this.toast('Kevlar vest fitted — soaks 65% of the hurt');
        Audio.cash();
        return;
      }
    } else if (this.shop === 'garage') {
      const item = GARAGE_ITEMS[n - 1];
      if (!item) return;
      const car = this.player.car;
      if (item.key === 'repair') {
        if (!car) { this.toast('No car on the lift'); Audio.denied(); return; }
        if (this.cash < item.price) { this.toast('Not enough cash'); Audio.denied(); return; }
        this.cash -= item.price; car.damage = 0;
        this.toast('Bodywork mint again');
        Audio.cash();
        return;
      }
      if (this.mods[item.key]) { this.toast('Already fitted'); Audio.denied(); return; }
      if (this.cash < item.price) { this.toast('Not enough cash'); Audio.denied(); return; }
      this.cash -= item.price;
      this.mods[item.key] = true;
      this.toast(item.name + ' fitted');
      Audio.cash();
    }
  }

  interact() {
    const p = this.player;
    if (p.car) {
      if (Math.hypot(p.car.x - GARAGE.x, p.car.y - GARAGE.y) <= 124) { this.openShop('garage'); return; }
      const car = p.car;
      p.car = null;
      car.driver = null;
      p.x = car.x + Math.cos(car.angle) * 30;
      p.y = car.y + Math.sin(car.angle) * 30;
      collideCircle(this.world, p, p.radius);
      Audio.door();
      return;
    }
    if (Math.hypot(p.x - WEAPON_SHOP.x, p.y - WEAPON_SHOP.y) <= 94) { this.openShop('weapons'); return; }
    if (tryRecruit(this)) return;
    let best = null, bd = 66;
    for (const car of this.cars) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      p.car = best;
      best.driver = 'player';
      best.parked = false;
      p.x = best.x; p.y = best.y;
      Audio.door();
      if (best.marked) this.toast('The marked GT. Bea sends her thanks in advance.');
    }
  }

  handleEscape() {
    if (this.shop) { this.shop = null; Audio.door(); return; }
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  update(dt) {
    this.elapsed += dt;
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 16);
    if (this.player.muzzle > 0) this.player.muzzle -= dt;

    if (Input.tap('Escape')) this.handleEscape();

    if (this.state === 'title') {
      updateTraffic(this, dt * 0.6);
      updatePeds(this, dt * 0.6);
      this.camera.x = 1650 + Math.cos(this.elapsed * 0.045) * 520;
      this.camera.y = 900 + Math.sin(this.elapsed * 0.033) * 320;
      Input.drain();
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      this.overT -= dt;
      if (this.overT <= 0) this.respawn();
      Input.drain();
      return;
    }
    if (this.state !== 'playing') { Input.drain(); return; }

    this.timeHours = (this.timeHours + dt * 0.02) % 24;

    if (this.shop) {
      for (let n = 1; n <= 8; n++) if (Input.tap('Digit' + n)) this.buyItem(n);
      Input.drain();
      return;
    }

    const p = this.player;
    const jobBefore = this.missions.jobIndex;

    // --- Rio on foot or behind the wheel -------------------------------
    if (p.car) {
      const ctrl = {
        throttle: (Input.down('KeyW') || Input.down('ArrowUp') ? 1 : 0) - (Input.down('KeyS') || Input.down('ArrowDown') ? 1 : 0),
        steer: (Input.down('KeyA') || Input.down('ArrowLeft') ? -1 : 0) + (Input.down('KeyD') || Input.down('ArrowRight') ? 1 : 0),
      };
      driveCar(this, p.car, dt, ctrl);
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      p.speedNow = Math.abs(p.car.speed);
      Audio.setEngine(true, Math.abs(p.car.speed) / p.car.type.top);
      if (Input.tap('KeyJ') || Input.tap('MouseLeft')) tryStartRace(this);
    } else {
      Audio.setEngine(false);
      let vx = (Input.down('KeyD') || Input.down('ArrowRight') ? 1 : 0) - (Input.down('KeyA') || Input.down('ArrowLeft') ? 1 : 0);
      let vy = (Input.down('KeyS') || Input.down('ArrowDown') ? 1 : 0) - (Input.down('KeyW') || Input.down('ArrowUp') ? 1 : 0);
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len; vy /= len;
        p.angle = Math.atan2(vx, -vy);
        p.x += vx * 178 * dt;
        p.y += vy * 178 * dt;
        p.walkCycle += dt * 9.5;
        p.speedNow = 178;
        collideCircle(this.world, p, p.radius);
      } else p.speedNow = 0;
      fireControl(this, dt, Input.down('KeyJ'), Input.tap('KeyJ') || Input.tap('MouseLeft'));
    }

    if (Input.tap('KeyE')) this.interact();
    for (let n = 1; n <= 5; n++) {
      if (Input.tap('Digit' + n)) {
        const key = WEAPON_BY_SLOT[n];
        if (key && (key === 'fists' || this.weaponsOwned[key])) { p.weapon = key; p.reloadT = 0; }
      }
    }
    if (Input.tap('KeyQ')) startReload(this);
    if (Input.tap('KeyC')) toggleCrewMode(this);
    if (Input.tap('KeyN') && p.car) {
      this.station = (this.station + 1) % STATIONS.length;
      Audio.setStation(this.station);
      this.toast('Radio: ' + STATIONS[this.station]);
    }

    // --- the city turns --------------------------------------------------
    updateTraffic(this, dt);
    updatePeds(this, dt);
    this.policeRef.update(this, dt);
    updateCombat(this, dt);
    updateMissions(this, dt);
    updateRaces(this, dt);
    updateCrew(this, dt);

    if (this.arrestFill >= 1) this.busted();
    if (this.missions.jobIndex > jobBefore) this.save(); // autosave on a finished job

    Audio.setSiren(this.policeRef.stars > 0 && this.policeRef.cars.length > 0);
    Audio.radioTick(!!p.car);

    // camera follows Rio, softly
    const tx = p.car ? p.car.x : p.x, ty = p.car ? p.car.y : p.y;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5.5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5.5);
    const hw = this.view.w / 2, hh = this.view.h / 2;
    this.camera.x = clamp(this.camera.x, Math.min(hw, 1600), Math.max(1600, 3200 - hw));
    this.camera.y = clamp(this.camera.y, Math.min(hh, 1200), Math.max(1200, 2400 - hh));

    Input.drain();
  }

  getState() {
    const p = this.player;
    return {
      state: this.state,
      cash: this.cash,
      respect: this.respect,
      wanted: this.policeRef.stars,
      heat: Math.round(this.policeRef.heat),
      policeCars: this.policeRef.cars.length,
      helicopter: !!this.policeRef.heli,
      vehicles: this.cars.length,
      peds: this.peds.length,
      inCar: !!p.car,
      health: Math.round(p.health),
      armor: Math.round(p.armor),
      weapon: p.weapon,
      weaponsOwned: Object.keys(this.weaponsOwned).filter((k) => this.weaponsOwned[k]),
      ammo: this.ammo,
      mods: this.mods,
      shop: this.shop,
      jobIndex: this.missions.jobIndex,
      stepIndex: this.missions.stepIndex,
      jobDone: this.missions.justCompleted,
      enemies: this.enemies.filter((e) => e.state !== 'down').length,
      enemiesDown: this.enemies.filter((e) => e.state === 'down').length,
      race: this.raceState,
      lastRace: this.lastRace,
      station: this.station,
      crew: this.crew,
      district: districtAt(p.x, p.y),
      timeHours: Math.round(this.timeHours * 10) / 10,
    };
  }
}
