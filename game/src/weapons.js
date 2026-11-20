// weapons.js — the arsenal: what Rio owns, what is loaded, and every bullet
// and grenade in the air. Projectiles advance in small steps and test the
// thing they might hit BEFORE the wall behind it, so a gunman standing in a
// doorway still gets hit. Armour, explosions and heat live elsewhere; this
// module asks the game to apply them.

import { WEAPON_DEFS } from './config.js';
import { dirFrom } from './random.js';

export function createArsenal() {
  return {
    owned: { fists: true },
    ammo: {
      pistol: { mag: 12, reserve: 48 },
      smg: { mag: 30, reserve: 120 },
      shotgun: { mag: 6, reserve: 24 },
      grenade: { mag: 0, reserve: 0 },
    },
    projectiles: [],   // {x,y,vx,vy,life,damage,hostile,tracer}
    shells: [],        // live grenades {x,y,vx,vy,fuse}
    fireTimer: 0,
  };
}

const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
const BY_SLOT = {};
for (const [id, def] of Object.entries(WEAPON_DEFS)) BY_SLOT[def.slot] = id;

export function fireProjectile(game, x, y, angle, opts) {
  const d = dirFrom(angle);
  game.arsenal.projectiles.push({
    x: x + d.x * 16, y: y + d.y * 16,
    vx: d.x * opts.speed, vy: d.y * opts.speed,
    life: opts.range / opts.speed,
    damage: opts.damage,
    hostile: !!opts.hostile,
    tracer: opts.tracer !== false,
  });
  game.spawnParticles(x + d.x * 18, y + d.y * 18, 2, { color: '#ffd76a', speed: 60, life: 0.12, size: 2 });
}

// A blast hurts everything in the radius, wrecks cars, and can cook a
// wreck's fuel tank into a second blast a moment later (the game schedules
// those). Returns nothing; the mess is the point.
export function explodeAt(game, x, y, radius, damage) {
  game.spawnParticles(x, y, 26, { color: '#ff9a3c', speed: 260, life: 0.8, size: 4 });
  game.spawnParticles(x, y, 14, { color: '#5a5a5a', speed: 120, life: 1.5, size: 6 });
  game.audio.boom();
  game.shake = Math.min(14, game.shake + 9);
  const hurt = (ent, mult = 1) => {
    const d = Math.hypot(ent.x - x, ent.y - y);
    if (d < radius + 14) return damage * mult * (1 - (d / (radius + 14)) * 0.55);
    return 0;
  };
  const pd = hurt(game.player);
  if (pd > 0 && !game.player.car) game.damagePlayer(pd);
  for (const e of game.enemies) {
    if (e.state === 'down') continue;
    const ed = hurt(e);
    if (ed > 0) game.hurtEnemy(e, ed);
  }
  for (const m of game.crew) {
    if (m.state === 'down') continue;
    const md = hurt(m, 0.7);
    if (md > 0) game.hurtCrew(m, md);
  }
  for (const c of game.cars) {
    if (c.wrecked) continue;
    const cd = hurt(c);
    if (cd > 0) game.damageCar(c, cd, true);
  }
  for (const p of game.peds) {
    if (p.down) continue;
    if (hurt(p) > 12) { p.down = true; p.downTimer = 9; }
  }
  game.addHeat(9);
}

function throwGrenade(game) {
  const p = game.player;
  const a = game.arsenal.ammo.grenade;
  if (a.mag <= 0) { game.audio.dryFire(); return; }
  a.mag -= 1;
  const d = dirFrom(p.angle);
  game.arsenal.shells.push({ x: p.x + d.x * 14, y: p.y + d.y * 14, vx: d.x * 330, vy: d.y * 330, fuse: WEAPON_DEFS.grenade.fuse });
  game.audio.shot('throw');
}

function fireOnce(game, id) {
  const def = WEAPON_DEFS[id];
  const p = game.player;
  const a = game.arsenal.ammo[id];
  if (id === 'grenade') { throwGrenade(game); return; }
  if (id === 'fists') {
    game.audio.shot('fists');
    const d = dirFrom(p.angle);
    const tx = p.x + d.x * def.range, ty = p.y + d.y * def.range;
    for (const e of game.enemies) {
      if (e.state !== 'down' && Math.hypot(e.x - tx, e.y - ty) < 24) game.hurtEnemy(e, def.damage);
    }
    for (const ped of game.peds) {
      if (!ped.down && Math.hypot(ped.x - tx, ped.y - ty) < 22) {
        ped.down = true; ped.downTimer = 7; game.addHeat(5);
      }
    }
    game.spawnParticles(tx, ty, 3, { color: '#ffffff', speed: 50, life: 0.15, size: 2 });
    return;
  }
  if (!a || a.mag <= 0) { game.audio.dryFire(); return; }
  a.mag -= 1;
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = pellets > 1 ? (i / (pellets - 1) - 0.5) * 2 * def.spread + (Math.random() - 0.5) * 0.03 : (Math.random() - 0.5) * 0.012;
    fireProjectile(game, p.x, p.y, p.angle + spread, { speed: def.speed, range: def.range, damage: def.damage, hostile: false });
  }
  game.audio.shot(id);
  game.addHeat(1);
  game.shake = Math.min(6, game.shake + (id === 'shotgun' ? 2.4 : 0.5));
}

// Per-tick weapon work: slot keys, the trigger, reload, and everything
// already in the air. Called only while playing, on foot, and out of shops.
export function updateWeapons(game, dt, input) {
  const ars = game.arsenal;
  ars.fireTimer = Math.max(0, ars.fireTimer - dt);
  const p = game.player;

  for (let s = 0; s < SLOT_KEYS.length; s++) {
    if (input.wasPressed(SLOT_KEYS[s])) {
      const id = BY_SLOT[s + 1];
      if (id && ars.owned[id] && (id !== 'grenade' || ars.ammo.grenade.mag > 0 || p.weapon === 'grenade')) {
        p.weapon = id;
      }
    }
  }

  if (input.wasPressed('KeyQ')) {
    const id = p.weapon;
    const a = ars.ammo[id];
    if (a && id !== 'grenade') {
      const def = WEAPON_DEFS[id];
      const need = def.mag - a.mag;
      const take = Math.min(need, a.reserve);
      if (take > 0) { a.mag += take; a.reserve -= take; game.audio.reload(); }
    }
  }

  const id = p.weapon;
  const def = WEAPON_DEFS[id];
  if (def) {
    const trigger = def.semi ? input.wasPressed('KeyJ') : input.isDown('KeyJ');
    if (trigger && ars.fireTimer <= 0) {
      fireOnce(game, id);
      ars.fireTimer = def.rof;
    }
  }

  // Grenades in flight.
  for (let i = ars.shells.length - 1; i >= 0; i--) {
    const s = ars.shells[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.vx *= 0.92; s.vy *= 0.92;
    s.fuse -= dt;
    if (s.fuse <= 0) {
      ars.shells.splice(i, 1);
      explodeAt(game, s.x, s.y, WEAPON_DEFS.grenade.blast, WEAPON_DEFS.grenade.damage);
    }
  }

  // Projectiles, stepped so fast rounds cannot tunnel through people.
  const stepLen = 9;
  for (let i = ars.projectiles.length - 1; i >= 0; i--) {
    const pr = ars.projectiles[i];
    pr.life -= dt;
    let dead = pr.life <= 0;
    const steps = Math.max(1, Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / stepLen));
    for (let s = 0; s < steps && !dead; s++) {
      pr.x += (pr.vx * dt) / steps;
      pr.y += (pr.vy * dt) / steps;
      if (pr.hostile) {
        if (!game.player.car && Math.hypot(game.player.x - pr.x, game.player.y - pr.y) < 14) {
          game.damagePlayer(pr.damage);
          dead = true;
          break;
        }
        for (const m of game.crew) {
          if (m.state !== 'down' && !m.riding && Math.hypot(m.x - pr.x, m.y - pr.y) < 13) {
            game.hurtCrew(m, pr.damage);
            dead = true;
            break;
          }
        }
        if (dead) break;
      } else {
        let hit = false;
        for (const e of game.enemies) {
          if (e.state !== 'down' && Math.hypot(e.x - pr.x, e.y - pr.y) < 15) {
            game.hurtEnemy(e, pr.damage);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const c of game.cars) {
            if (!c.wrecked && Math.hypot(c.x - pr.x, c.y - pr.y) < 24) {
              game.damageCar(c, pr.damage, false);
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const ped of game.peds) {
            if (!ped.down && Math.hypot(ped.x - pr.x, ped.y - pr.y) < 12) {
              ped.down = true; ped.downTimer = 8;
              game.addHeat(6);
              hit = true;
              break;
            }
          }
        }
        if (hit) { dead = true; break; }
      }
      if (game.world.pointInBuilding(pr.x, pr.y, -2)) {
        game.spawnParticles(pr.x, pr.y, 2, { color: '#ffe9a8', speed: 40, life: 0.15, size: 2 });
        dead = true;
      }
    }
    if (dead) ars.projectiles.splice(i, 1);
  }
}
