// game.js — the simulation itself: one object, every system plugged into
// it, advanced in fixed steps. Modules never keep private copies of the
// shared collections — cars, enemies, crew, the arsenal all live here, so
// anything (a test harness included) that reaches in and moves a piece
// finds the game agreeing with it on the very next tick.

import { HEAT_LEVELS, SAVE_KEY, GUN_SHOP, GARAGE, SAFEHOUSE, START_HOUR, DAY_LENGTH } from './config.js';
import { buildWorld } from './world.js';
import { createAudio, STATIONS } from './audio.js';
import { createArsenal, updateWeapons, explodeAt } from './weapons.js';
import { createPolice, updatePolice, clearPolice, starsFor } from './police.js';
import { updateEnemies } from './combat.js';
import { makePlayer, makeCar, seedTraffic, seedPeds, updateEntities, updatePlayerOnFoot, updatePlayerCar } from './entities.js';
import { createMissions } from './missions.js';
import { raceNear, startRace, updateRaces } from './races.js';
import { recruit, recruitable, toggleFollow, updateCrew } from './crew.js';

export function createGame(seed) {
  const game = {
    seed,
    world: buildWorld(seed),
    audio: createAudio(),
    state: 'title', // title | playing | paused | busted | wasted
    overlayT: 0,
    time: 0,
    hour: START_HOUR,
    cash: 120,
    respect: 0,
    player: makePlayer(),
    cars: [],
    peds: [],
    enemies: [],
    enemiesDown: 0,
    crew: [],
    particles: [],
    camera: { x: 262, y: 368 },
    arsenal: createArsenal(),
    policeRef: createPolice(),
    missions: createMissions(),
    shop: null,
    mods: { engine: false, plating: false, nitro: false },
    station: 0,
    raceState: null,
    lastRace: null,
    arrestFill: 0,
    heatLock: 0,
    shake: 0,
    bannerText: '',
    bannerT: 0,
    cookOffs: [], // {x,y,t} delayed secondary explosions
    saveT: 0,
    manualSaveT: -99,

    get ammo() { return this.arsenal.ammo; },
    set ammo(v) { this.arsenal.ammo = v; },
    get weaponsOwned() { return this.arsenal.owned; },
    set weaponsOwned(v) { this.arsenal.owned = v; },

    banner(text) { this.bannerText = text; this.bannerT = 3.4; },

    addHeat(n) {
      if (this.heatLock) return;
      this.policeRef.heat = Math.min(320, this.policeRef.heat + n);
    },
    setHeatFloor(v) {
      if (this.heatLock) return;
      this.policeRef.heat = Math.max(this.policeRef.heat, v);
    },
    setWanted(n) {
      const stars = Math.max(0, Math.min(5, Math.round(n)));
      this.heatLock = 0;
      this.policeRef.heat = HEAT_LEVELS[stars];
      if (stars === 0) clearPolice(this);
    },

    spawnParticles(x, y, n, opts = {}) {
      const color = opts.color || '#ffffff';
      const speed = opts.speed || 120, life = opts.life || 0.5, size = opts.size || 3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        this.particles.push({ x, y, vx: Math.sin(a) * s, vy: -Math.cos(a) * s, life: life * (0.5 + Math.random()), maxLife: life, color, size });
      }
      if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
    },

    damagePlayer(amount) {
      const p = this.player;
      if (p.car || this.state !== 'playing') return;
      let rest = amount;
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, amount * 0.65);
        p.armor -= absorbed;
        rest = amount - absorbed;
      }
      p.health -= rest;
      this.shake = Math.min(8, this.shake + 1.5);
      if (p.health <= 0) this.wasted();
    },

    hurtEnemy(e, damage) {
      if (e.state === 'down') return;
      e.hp -= damage;
      this.spawnParticles(e.x, e.y, 3, { color: '#e2543e', speed: 70, life: 0.3, size: 3 });
      if (e.hp <= 0) {
        e.state = 'down';
        e.downT = 0;
        this.enemiesDown += 1;
        this.addHeat(2);
      }
    },

    hurtCrew(m, damage) {
      if (m.state === 'down') return;
      m.hp -= damage;
      if (m.hp <= 0) {
        m.state = 'down';
        m.reviveT = 11;
        this.banner(`${m.name} is down!`);
      }
    },

    damageCar(c, amount, fromBlast) {
      if (c.wrecked) return;
      const plated = c === this.player.car && this.mods.plating;
      c.hp -= plated ? amount * 0.5 : amount;
      c.damage = Math.min(100, c.damage + amount * 0.5);
      if (c.hp <= 0) {
        c.wrecked = true;
        c.speed = 0;
        explodeAt(this, c.x, c.y, 88, 46);
        // A wreck near other fuel tanks cooks them off in turn.
        for (const o of this.cars) {
          if (o !== c && !o.wrecked && Math.hypot(o.x - c.x, o.y - c.y) < 120) {
            this.cookOffs.push({ car: o, t: 0.55 + Math.random() * 0.5 });
          }
        }
        if (this.player.car === c) {
          this.player.car = null;
          this.damagePlayer(18);
        }
      }
    },

    busted() {
      if (this.state !== 'playing') return;
      this.state = 'busted';
      this.overlayT = 1.5;
      const fine = Math.min(this.cash, 60 + this.policeRef.stars * 40);
      this.cash -= fine;
      this.banner(`BUSTED — $${fine} in fines`);
    },

    wasted() {
      if (this.state !== 'playing') return;
      this.state = 'wasted';
      this.overlayT = 1.5;
      const bill = Math.floor(this.cash * 0.1);
      this.cash -= bill;
      this.banner(`WASTED — clinic bill $${bill}`);
    },

    respawn() {
      const p = this.player;
      p.car = null;
      p.x = SAFEHOUSE.x + 30; p.y = SAFEHOUSE.y + 30;
      p.health = 100;
      this.heatLock = 0;
      this.setWanted(0);
      this.state = 'playing';
    },

    startGame() {
      // PLAY NOW is a fresh first morning in Port Serena, every time. The
      // title screen's other promise — CONTINUE — is continueGame(), which
      // is the one that reaches for the saved life.
      this.audio.unlock();
      this.resetWorld();
      this.state = 'playing';
    },

    continueGame() {
      this.audio.unlock();
      if (!this.load()) this.resetWorld();
      this.state = 'playing';
    },

    resetWorld() {
      this.cars = seedTraffic(this, this.seed);
      this.peds = seedPeds(this, this.seed);
      this.enemies = [];
      this.enemiesDown = 0;
      this.crew = [];
      this.player = makePlayer();
      this.cash = 120;
      this.respect = 0;
      this.missions = createMissions();
      this.policeRef = createPolice();
      this.arsenal = createArsenal();
      this.mods = { engine: false, plating: false, nitro: false };
      this.raceState = null;
      this.lastRace = null;
      this.shop = null;
      this.hour = START_HOUR;
    },

    save() {
      this.manualSaveT = this.time;
      const data = {
        v: 3,
        cash: this.cash, respect: this.respect,
        weaponsOwned: this.arsenal.owned, ammo: this.arsenal.ammo,
        armor: this.player.armor, health: this.player.health,
        mods: this.mods,
        jobIndex: this.missions.jobIndex, stepIndex: this.missions.stepIndex,
        crew: this.crew.map((m) => ({ name: m.name, hp: m.hp })),
        station: this.station, hour: this.hour,
        x: this.player.x, y: this.player.y,
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
      return true;
    },
    saveSoon() { this.save(); },

    load() {
      let raw = null;
      try { raw = localStorage.getItem(SAVE_KEY); } catch { /* ignore */ }
      if (!raw) return false;
      let d;
      try { d = JSON.parse(raw); } catch { return false; }
      if (!d || typeof d !== 'object') return false;
      if (!this.cars.length) { this.cars = seedTraffic(this, this.seed); this.peds = seedPeds(this, this.seed); }
      this.cash = d.cash ?? this.cash;
      this.respect = d.respect ?? 0;
      this.arsenal.owned = d.weaponsOwned || { fists: true };
      if (d.ammo) this.arsenal.ammo = d.ammo;
      this.player.armor = d.armor ?? 0;
      this.player.health = d.health ?? 100;
      this.mods = d.mods || { engine: false, plating: false, nitro: false };
      this.missions.jobIndex = d.jobIndex ?? 0;
      this.missions.stepIndex = d.stepIndex ?? 0;
      this.missions.armed = false;
      this.missions.done = this.missions.jobIndex >= 8;
      this.station = d.station ?? 0;
      this.hour = d.hour ?? START_HOUR;
      if (typeof d.x === 'number') { this.player.x = d.x; this.player.y = d.y; }
      this.crew = [];
      for (const saved of d.crew || []) {
        const roster = [
          { name: 'Vex', role: 'Mechanic', color: '#4ecdc4', damage: 9, maxHp: 120 },
          { name: 'Mara', role: 'Smuggler', color: '#ef6f6c', damage: 12, maxHp: 150 },
        ].find((r) => r.name === saved.name);
        if (roster) {
          this.crew.push({
            name: roster.name, role: roster.role, color: roster.color,
            x: this.player.x + 24, y: this.player.y + 12, angle: 0,
            hp: saved.hp ?? roster.maxHp, maxHp: roster.maxHp, damage: roster.damage,
            state: 'follow', riding: false, reviveT: 0, shotT: 1,
          });
        }
      }
      return true;
    },

    // ---- interaction ------------------------------------------------------
    pressE() {
      const p = this.player;
      if (this.shop) { this.shop = null; return; }
      if (p.car) {
        const dGarage = Math.hypot(p.car.x - GARAGE.x, p.car.y - GARAGE.y);
        if (dGarage < 120) { this.shop = 'garage'; this.audio.blip(); return; }
        // Step out beside the car.
        p.car.driver = false;
        p.car.parked = true;
        p.x = p.car.x + 30; p.y = p.car.y + 6;
        p.car = null;
        return;
      }
      const dGuns = Math.hypot(p.x - GUN_SHOP.x, p.y - GUN_SHOP.y);
      if (dGuns < 84) { this.shop = 'weapons'; this.audio.blip(); return; }
      if (recruitable(this)) { recruit(this); return; }
      // Nearest borrowable car.
      let best = null, bd = 50;
      for (const c of this.cars) {
        if (c.wrecked) continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        best.parked = false;
        best.driver = true;
        p.car = best;
        p.x = best.x; p.y = best.y;
        if (!best.marked) this.addHeat(3);
        this.audio.blip();
      }
    },

    buyDigit(n) {
      const list = this.shop === 'weapons' ? GUN_SHOP.items : this.shop === 'garage' ? GARAGE.items : null;
      if (!list) return;
      const item = list[n - 1];
      if (!item) return;
      if (this.cash < item.price) { this.audio.dryFire(); return; }
      const ars = this.arsenal;
      const acts = {
        'own-pistol': () => { ars.owned.pistol = true; ars.ammo.pistol.reserve += 24; },
        'own-smg': () => { ars.owned.smg = true; ars.ammo.smg.reserve += 60; },
        'own-shotgun': () => { ars.owned.shotgun = true; ars.ammo.shotgun.reserve += 12; },
        'grenades': () => { ars.owned.grenade = true; ars.ammo.grenade.mag += 3; },
        'ammo-pistol': () => { ars.ammo.pistol.reserve += 36; },
        'ammo-smg': () => { ars.ammo.smg.reserve += 60; },
        'ammo-shotgun': () => { ars.ammo.shotgun.reserve += 12; },
        'armor': () => { this.player.armor = 100; },
        'mod-engine': () => { this.mods.engine = true; },
        'mod-plating': () => { this.mods.plating = true; },
        'mod-nitro': () => { this.mods.nitro = true; },
        'respray': () => { if (this.player.car) this.player.car.color = '#b388ff'; },
        'repair': () => { if (this.player.car) { this.player.car.damage = 0; this.player.car.hp = 999; } },
      };
      const act = acts[item.act];
      if (!act) return;
      // Owned big-ticket items cannot be bought twice.
      if ((item.act.startsWith('own-') && ars.owned[item.act.slice(4)]) ||
          (item.act === 'mod-engine' && this.mods.engine) ||
          (item.act === 'mod-plating' && this.mods.plating) ||
          (item.act === 'mod-nitro' && this.mods.nitro) ||
          (item.act === 'armor' && this.player.armor >= 100)) {
        this.audio.dryFire();
        return;
      }
      this.cash -= item.price;
      act();
      this.audio.cash();
      this.saveSoon();
    },

    // ---- the tick ---------------------------------------------------------
    update(dt, input) {
      this.time += dt;
      this.bannerT = Math.max(0, this.bannerT - dt);
      this.shake = Math.max(0, this.shake - dt * 26);

      if (this.state === 'title') {
        if (input.wasPressed('Enter') || input.wasPressed('KeyJ')) this.startGame();
        else if (input.wasPressed('KeyC')) this.continueGame();
        input.drain();
        return;
      }
      if (this.state === 'busted' || this.state === 'wasted') {
        this.overlayT -= dt;
        if (this.overlayT <= 0) this.respawn();
        input.drain();
        return;
      }
      if (this.state === 'paused') {
        if (input.wasPressed('Escape') || input.wasPressed('KeyP')) this.state = 'playing';
        input.drain();
        return;
      }

      // playing
      this.hour = (this.hour + (dt / DAY_LENGTH) * 24) % 24;

      if (this.shop) {
        for (let n = 1; n <= 8; n++) if (input.wasPressed('Digit' + n)) this.buyDigit(n);
        if (input.wasPressed('Escape') || input.wasPressed('KeyE')) this.shop = null;
        input.drain();
        return; // the world holds its breath while Rio shops
      }

      if (input.wasPressed('Escape') || input.wasPressed('KeyP')) { this.state = 'paused'; input.drain(); return; }
      if (input.wasPressed('KeyM')) this.audio.toggleMute();
      if (input.wasPressed('KeyE')) this.pressE();
      if (input.wasPressed('KeyC')) toggleFollow(this);
      if (input.wasPressed('KeyH') && this.player.car) this.audio.horn();
      if (input.wasPressed('KeyR') && !this.player.car) {
        this.player.x = SAFEHOUSE.x + 30; this.player.y = SAFEHOUSE.y + 30;
      }
      if (input.wasPressed('KeyN') && this.player.car) {
        this.station = (this.station + 1) % STATIONS.length;
        this.audio.blip();
      }

      // Racing claims the J edge before fists do, but only in a car at a
      // marker; the edge is drained below either way.
      if (input.wasPressed('KeyJ') && this.player.car && !this.raceState) {
        const def = raceNear(this);
        if (def) startRace(this, def);
      }

      if (this.player.car) updatePlayerCar(this, dt, input);
      else {
        updatePlayerOnFoot(this, dt, input);
        updateWeapons(this, dt, input);
      }
      updateEntities(this, dt);
      updatePolice(this, dt);
      updateEnemies(this, dt);
      updateCrew(this, dt);
      updateRaces(this, dt);
      this.missions.update(this, dt);

      // Cook-off chain reactions.
      for (let i = this.cookOffs.length - 1; i >= 0; i--) {
        const c = this.cookOffs[i];
        c.t -= dt;
        if (c.t <= 0) {
          this.cookOffs.splice(i, 1);
          if (!c.car.wrecked) { c.car.hp = 0; this.damageCar(c.car, 999, true); }
        }
      }

      // Particles.
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.vx *= 0.94; pt.vy *= 0.94;
      }

      // Camera settles on whoever Rio is right now.
      const focus = this.player.car || this.player;
      this.camera.x += (focus.x - this.camera.x) * Math.min(1, dt * 5);
      this.camera.y += (focus.y - this.camera.y) * Math.min(1, dt * 5);

      this.audio.update(dt, this);

      // Autosave, but never in the breath right after a manual save/load
      // shuffle (a test, or a player, may be mid-swap).
      this.saveT += dt;
      if (this.saveT > 15 && this.time - this.manualSaveT > 4) {
        this.saveT = 0;
        this.save();
        this.manualSaveT = -99;
      }

      input.drain();
    },

    getState() {
      const pol = this.policeRef;
      return {
        state: this.state,
        cash: this.cash,
        respect: this.respect,
        health: Math.round(this.player.health),
        armor: Math.round(this.player.armor),
        inCar: !!this.player.car,
        shop: this.shop,
        weapon: this.player.weapon,
        weaponsOwned: Object.keys(this.arsenal.owned).filter((k) => this.arsenal.owned[k]),
        ammo: this.arsenal.ammo,
        mods: this.mods,
        vehicles: this.cars.length,
        peds: this.peds.length,
        enemies: this.enemies.reduce((n, e) => n + (e.state !== 'down' ? 1 : 0), 0),
        enemiesDown: this.enemiesDown,
        jobIndex: this.missions.jobIndex,
        stepIndex: this.missions.stepIndex,
        jobDone: this.missions.jobDone,
        wanted: pol.stars,
        policeCars: pol.cars.length,
        helicopter: !!pol.heli,
        station: STATIONS[this.station].name,
        race: this.raceState ? { phase: this.raceState.phase, name: this.raceState.def.name, cp: this.raceState.cpIndex } : null,
        lastRace: this.lastRace,
        crew: this.crew.map((m) => ({ name: m.name, hp: Math.round(m.hp), state: m.state })),
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        hour: this.hour,
      };
    },
  };

  game.resetWorld();
  return game;
}
