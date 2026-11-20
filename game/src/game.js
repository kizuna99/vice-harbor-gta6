// Game orchestration: fixed-step simulation, day-night clock, camera,
// particles, skidmarks, crime bookkeeping and the save file.
// Rendering lives in render.js; this module owns every piece of state.
// v2 wires in the arsenal (weapons.js), the two shops, the Ferro crew,
// stunt ramps and the expanded save format.

import {
  WORLD, SAVE_KEY, DAY_LENGTH_SEC, START_HOUR, CRIME_HEAT,
  SHOPS, WEAPON_SHOP_ITEMS, GARAGE_ITEMS, STUNT,
} from './config.js';
import { clamp, rand, range, pick } from './random.js';
import { buildWorld, districtAt, world } from './world.js';
import { keys, consume, anyPressed, axisX, axisY, sprinting } from './input.js';
import {
  spawnTraffic, spawnParked, spawnPeds, makePlayer,
  updateTrafficCar, updatePed, updatePlayerOnFoot, updatePlayerCar, updateAirborne,
  nearestEnterableCar,
} from './entities.js';
import { police, addHeat as policeAddHeat, updatePolice, clearWanted } from './police.js';
import { tryPunch, damagePlayer, respawnAtClinic, bustedPenalty } from './combat.js';
import { missions, beginMissions, startJobStep, updateMissions, showMessage } from './missions.js';
import {
  WEAPON_BY_SLOT, createAmmo, defaultOwned, grantWeapon,
  tryFire, startReload, updateWeapons, updateEnemies,
} from './weapons.js';
import { audio } from './audio.js';
import { raceAt, startRace, updateRaces } from './races.js';
import { makeCrewMember, tryRecruit, toggleCrew, updateCrew } from './crew.js';

const AMMO_PACKS = { pistol: 36, smg: 90, shotgun: 18 };

export const game = {
  state: 'title', // title | playing | paused | busted | wasted
  player: null,
  cars: [],
  peds: [],
  enemies: [],
  projectiles: [],
  grenades: [],
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
  // --- v2 state ---
  weaponsOwned: defaultOwned(),
  ammo: createAmmo(),
  mods: { engine: false, plating: false },
  shop: null,           // null | { type: 'weapons' | 'garage' }
  fireCd: 0,
  reloadT: 0,
  muzzle: null,
  enemiesDownTotal: 0,
  arrestFill: 0,
  // --- phase-2 state: crew, street races ---
  crew: [],
  raceState: null,
  lastRace: null,

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
    this.shop = null;
    this.lastFine = bustedPenalty(this);
    this.audio?.bustedJingle();
  },

  onWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.endTimer = 2.6;
    this.shop = null;
    this.audio?.wastedJingle();
  },

  spawnHitParticles(x, y) {
    for (let i = 0; i < 10; i++) this.spawnParticle(x, y, '#ffd166');
  },

  spawnParticle(x, y, color, opts) {
    const o = opts || {};
    if (this.particles.length >= 320) this.particles.shift();
    const a = rand() * Math.PI * 2;
    const sp = 40 + rand() * 130;
    this.particles.push({
      x, y,
      vx: o.vx !== undefined ? o.vx : Math.cos(a) * sp,
      vy: o.vy !== undefined ? o.vy : Math.sin(a) * sp,
      life: o.life !== undefined ? o.life : 0.45 + rand() * 0.4,
      maxLife: o.life !== undefined ? o.life : 0.85,
      color, size: o.size !== undefined ? o.size : 2 + rand() * 3,
      kind: o.kind || 'spark',
    });
  },

  addSkid(x, y, angle) {
    if (this.skidmarks.length >= 300) this.skidmarks.shift();
    this.skidmarks.push({ x, y, angle, life: 6 });
  },

  // --- shops ---------------------------------------------------------------

  shopNear() {
    const p = this.player;
    for (const s of SHOPS) {
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d > s.radius) continue;
      if (s.needCar && p.car) return s;
      if (!s.needCar && !p.car) return s;
    }
    return null;
  },

  tryOpenShop() {
    const s = this.shopNear();
    if (!s) return false;
    this.shop = { type: s.id };
    this.audio?.door();
    showMessage(this, s.id === 'weapons'
      ? 'Serena Munitions — keys 1-8 buy, Esc leaves.'
      : 'Serena Customs — keys 1-3 buy, Esc leaves.', 3);
    return true;
  },

  closeShop() {
    this.shop = null;
    this.save();
  },

  buyItem(item) {
    const fail = (msg) => { showMessage(this, msg, 2.2); this.audio?.fail(); };
    if (this.cash < item.price) { fail(`Not enough cash for ${item.label} ($${item.price}).`); return; }
    if (item.kind === 'weapon') {
      if (this.weaponsOwned[item.id]) { fail(`You already own the ${item.label}.`); return; }
      this.cash -= item.price;
      grantWeapon(this, item.id);
      showMessage(this, `Bought the ${item.label}. Slot ${item.key.slice(-1)} draws it.`, 2.6);
    } else if (item.kind === 'grenade') {
      this.cash -= item.price;
      this.weaponsOwned.grenade = true;
      this.ammo.grenade.mag += 3;
      showMessage(this, 'Three grenades in the bag. Slot 4 throws.', 2.6);
    } else if (item.kind === 'ammo') {
      this.cash -= item.price;
      this.ammo[item.id].reserve += AMMO_PACKS[item.id];
      showMessage(this, `${item.label} — reserve topped up.`, 2.2);
    } else if (item.kind === 'kevlar') {
      if (this.player.armor >= 100) { fail('Your vest is already whole.'); return; }
      this.cash -= item.price;
      this.player.armor = 100;
      showMessage(this, 'Fresh kevlar fitted. It eats most of every hit.', 2.6);
    } else if (item.kind === 'mod') {
      if (this.mods[item.id]) { fail(`${item.label} is already fitted.`); return; }
      this.cash -= item.price;
      this.mods[item.id] = true;
      showMessage(this, `${item.label} fitted to your ride.`, 2.6);
    } else if (item.kind === 'respray') {
      const car = this.player.car;
      if (!car) { fail('Bring a car in first.'); return; }
      if (car.wrecked) { fail('That one is scrap. Respray cannot fix a cook-off.'); return; }
      this.cash -= item.price;
      car.damage = 0;
      car.color = pick(car.model.colors);
      showMessage(this, 'Fresh paint, dents hammered out.', 2.6);
    } else {
      return;
    }
    this.audio?.cashRegister();
  },

  stepShop() {
    // Inside a shop the city holds its breath: browse with the number
    // keys, leave with Esc or E. Nothing out there can arrest Rio
    // mid-purchase.
    const items = this.shop.type === 'weapons' ? WEAPON_SHOP_ITEMS : GARAGE_ITEMS;
    for (const item of items) {
      if (consume(item.key)) this.buyItem(item);
    }
    if (consume('Escape') || consume('KeyE')) this.closeShop();
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
      this.weaponsOwned = defaultOwned();
      this.ammo = createAmmo();
      this.mods = { engine: false, plating: false };
      this.enemies = [];
      this.projectiles = [];
      this.grenades = [];
      this.enemiesDownTotal = 0;
      this.crew = [];
      this.lastRace = null;
      this.shop = null;
      missions.jobIndex = 0; missions.stepIndex = 0; missions.done = false;
      this.player.x = world.spawn.x; this.player.y = world.spawn.y;
      this.player.health = 100; this.player.armor = 0; this.player.weapon = 'fists';
      this.player.car = null;
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
        weaponsOwned: this.weaponsOwned,
        armor: Math.round(this.player.armor),
        mods: this.mods,
        ammo: this.ammo,
        weapon: this.player.weapon,
        crew: this.crew.map((m) => ({ name: m.name, x: Math.round(m.x), y: Math.round(m.y) })),
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
      // v2 fields, all optional so a v1-era save still loads cleanly.
      this.weaponsOwned = { ...defaultOwned(), ...(d.weaponsOwned || {}) };
      const savedAmmo = createAmmo();
      if (d.ammo) {
        for (const id of Object.keys(savedAmmo)) {
          if (d.ammo[id]) {
            savedAmmo[id].mag = d.ammo[id].mag | 0;
            savedAmmo[id].reserve = d.ammo[id].reserve | 0;
          }
        }
      }
      this.ammo = savedAmmo;
      this.mods = { engine: false, plating: false, ...(d.mods || {}) };
      this.player.armor = typeof d.armor === 'number' ? clamp(d.armor, 0, 100) : 0;
      this.player.weapon = this.weaponsOwned[d.weapon] ? d.weapon : 'fists';
      // Crew roster rides along in the same save (absent in older ones).
      this.crew = (d.crew || []).map((s) => makeCrewMember(s.name, s.x, s.y));
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

    // Inside a shop, time politely stops.
    if (this.shop) {
      missions.messageT = Math.max(0, missions.messageT - dt);
      this.stepShop();
      this.updateFx(dt);
      return;
    }

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
    if (consume('KeyC')) toggleCrew(this);
    if (consume('KeyH')) audio.honk();
    if (consume('KeyR')) {
      // Reset to the nearest safe spot: Bea's corner.
      if (p.car) { p.car.x = world.spawn.x; p.car.y = world.spawn.y; p.car.speed = 0; }
      p.x = world.spawn.x; p.y = world.spawn.y;
      showMessage(this, 'Back at Bea\'s corner.', 2);
    }

    // Weapon slots 1-5 (only weapons Rio actually owns).
    for (const key of Object.keys(WEAPON_BY_SLOT)) {
      if (consume(key)) {
        const id = WEAPON_BY_SLOT[key];
        if (this.weaponsOwned[id]) {
          p.weapon = id;
          this.reloadT = 0;
          audio.door();
        } else {
          showMessage(this, 'Serena Munitions sells that. You do not own it yet.', 1.8);
        }
      }
    }
    if (consume('KeyQ')) startReload(this);

    // Enter / exit vehicles — but a shop door wins the E key when
    // Rio is standing (or sitting) right at one.
    if (anyPressed('KeyE', 'KeyF', 'Enter')) {
      audio.init(); audio.resume();
      if (!this.tryOpenShop() && !tryRecruit(this)) {
        if (p.car) {
          const car = p.car;
          p.car = null;
          p.x = car.x + Math.cos(car.angle) * 30;
          p.y = car.y + Math.sin(car.angle) * 30;
          car.driver = false;
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
    }

    // Attack: fists punch; anything else shoots (held fire for the SMG,
    // one trigger pull per press for the rest, gated by fireCd). At a
    // race start marker the trigger flags the race off instead. The
    // trigger edge is drained every tick, whatever happens: a stale
    // press must never fire (or flag off a race) seconds later.
    const raceDef = raceAt(this);
    const trigger = anyPressed('KeyJ', 'MousePunch');
    if (raceDef && trigger) {
      startRace(this, raceDef);
    } else if (p.weapon === 'fists') {
      if (trigger) tryPunch(this);
    } else if (keys['KeyJ'] || trigger) {
      tryFire(this);
    }

    // --- movement ---
    let threat = null;
    if (p.car) {
      p.car.plateMul = this.mods.plating ? 0.5 : 1;
      const impact = updatePlayerCar(p.car, dt, input, this.mods.engine ? 1.13 : 1);
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      if (impact) {
        this.audio?.crash();
        this.addHeat(CRIME_HEAT.hitCar);
        for (let i = 0; i < 8; i++) this.spawnParticle(p.car.x, p.car.y, '#cfd8dc');
      }
      // Stunt ramps: fast enough, pointed the right way, wheels leave.
      if (p.car.airZ <= 0 && p.car.airVz <= 0 && Math.abs(p.car.speed) > STUNT.minSpeed) {
        for (const r of world.ramps) {
          if (Math.abs(p.car.x - r.x) > r.w / 2 + 8 || Math.abs(p.car.y - r.y) > r.h / 2 + 8) continue;
          const dot = Math.sin(p.car.angle) * Math.sin(r.angle) + -Math.cos(p.car.angle) * -Math.cos(r.angle);
          if (dot < 0.6) continue;
          p.car.airVz = clamp(Math.abs(p.car.speed) * 0.95, 190, 300);
          p.car.airPeak = 0;
          this.audio?.stunt();
          showMessage(this, 'AIRBORNE!', 1.4);
          break;
        }
      }
      const landedPeak = updateAirborne(p.car, dt);
      if (landedPeak >= STUNT.bonusPeak) {
        this.cash += STUNT.bonusCash;
        showMessage(this, `Clean air! +$${STUNT.bonusCash} style bonus.`, 2.4);
        this.audio?.checkpoint();
      } else if (landedPeak > 0) {
        this.audio?.crash();
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
      threat = { x: p.x, y: p.y, radius: this.muzzle ? 150 : 46, active: p.punchAnim > 0.4 || !!this.muzzle };
    }

    // --- ambient world ---
    const events = [];
    for (const car of this.cars) {
      if (car === p.car || car.racer) continue; // race rivals drive themselves
      updateTrafficCar(car, dt, this.cars, p, events, this.peds);
    }
    for (const e of events) if (e.type === 'honk') audio.honk();
    // Traffic vs player-car collisions.
    if (p.car) {
      for (const car of this.cars) {
        if (car === p.car || car.wrecked) continue;
        if (Math.hypot(car.x - p.car.x, car.y - p.car.y) < 40 && Math.abs(p.car.speed) > 50) {
          car.speed *= 0.4; p.car.speed *= 0.55;
          this.addHeat(CRIME_HEAT.hitCar);
          damagePlayer(this, 3);
          this.audio?.crash();
        }
      }
    }
    for (const ped of this.peds) updatePed(ped, dt, threat);

    // Burning wrecks keep smoking until they are all that is left.
    for (const car of [...this.cars, ...police.cars]) {
      if (!car.wrecked) continue;
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.14;
        this.spawnParticle(car.x + range(-8, 8), car.y + range(-10, 10),
          rand() < 0.4 ? '#ff7b2e' : '#4a4f58',
          { vx: range(-8, 8), vy: range(-40, -18), life: 0.8 + rand() * 0.7, size: 4 + rand() * 6, kind: rand() < 0.4 ? 'fire' : 'smoke' });
      }
    }

    // --- law, lead and story ---
    updatePolice(dt, p, this);
    this.arrestFill = police.arrest;
    updateWeapons(this, dt);
    updateEnemies(this, dt);
    updateRaces(this, dt);
    updateCrew(this, dt);
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
      if (pt.kind === 'smoke') {
        pt.vy -= 12 * dt;               // smoke keeps rising
        pt.size += 5 * dt;              // and spreading
        pt.vx *= 0.985; pt.vy *= 0.985;
      } else {
        pt.vx *= 0.92; pt.vy *= 0.92;
      }
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
