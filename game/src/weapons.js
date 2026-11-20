// weapons.js — the gun rack: what each trigger pull does. Semi-auto
// pieces fire on the press edge only; the SMG runs while J is held.
// Grenades are thrown, not shot: they arc out, settle, and cook off on
// a 0.75s fuse. Reloads are manual on Q and automatic on an empty mag.

import { WEAPONS } from './config.js';
import { Audio } from './audio.js';

export function freshAmmo() {
  return {
    pistol: { mag: 0, reserve: 0 },
    smg: { mag: 0, reserve: 0 },
    shotgun: { mag: 0, reserve: 0 },
    grenade: { mag: 0, reserve: 0 },
  };
}

export function startReload(game) {
  const p = game.player;
  const def = WEAPONS[p.weapon];
  if (!def || p.weapon === 'fists' || p.weapon === 'grenade') return false;
  const ammo = game.ammo[p.weapon];
  if (p.reloadT > 0 || ammo.mag >= def.mag || ammo.reserve <= 0) return false;
  p.reloadT = p.weapon === 'shotgun' ? 1.4 : p.weapon === 'smg' ? 1.1 : 0.8;
  return true;
}

function finishReload(game) {
  const p = game.player;
  const def = WEAPONS[p.weapon];
  const ammo = game.ammo[p.weapon];
  const take = Math.min(def.mag - ammo.mag, ammo.reserve);
  ammo.mag += take;
  ammo.reserve -= take;
}

// wantHeld: J is down. wantEdge: J went down this tick.
export function fireControl(game, dt, wantHeld, wantEdge) {
  const p = game.player;
  p.fireCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) finishReload(game);
    return;
  }
  if (p.car) return;
  const key = p.weapon;
  const def = WEAPONS[key];
  if (!def) return;
  const trigger = def.auto ? wantHeld : wantEdge;
  if (!trigger || p.fireCd > 0) return;

  if (key === 'fists') {
    p.fireCd = def.rate / 1000;
    const fx = Math.sin(p.angle), fy = -Math.cos(p.angle);
    for (const e of game.enemies) {
      if (e.state !== 'down' && Math.hypot(e.x - (p.x + fx * 26), e.y - (p.y + fy * 26)) < 26) e.health -= def.dmg;
    }
    return;
  }

  const ammo = game.ammo[key];
  if (ammo.mag <= 0) { if (!startReload(game)) Audio.denied(); p.fireCd = 0.25; return; }
  ammo.mag -= 1;
  p.fireCd = def.rate / 1000;
  p.muzzle = 0.05;
  Audio.shot(key);
  game.threat = { x: p.x, y: p.y, t: 4 };
  for (const ped of game.peds) if (Math.hypot(ped.x - p.x, ped.y - p.y) < 210) { ped.state = 'flee'; ped.fleeT = 4; }
  // gunfire only draws the law when the law is there to hear it
  const heard = game.policeRef.cars.length > 0 || game.policeRef.officers.length > 0;
  if (heard) game.policeRef.addHeat(2.5);

  const fx = Math.sin(p.angle), fy = -Math.cos(p.angle);
  if (key === 'grenade') {
    game.thrown.push({
      x: p.x + fx * 16, y: p.y + fy * 16,
      vx: fx * def.speed, vy: fy * def.speed, fuse: 0.75,
    });
    return;
  }
  for (let i = 0; i < def.pellets; i++) {
    const a = p.angle + (Math.random() - 0.5) * 2 * def.spread;
    game.projectiles.push({
      x: p.x + Math.sin(a) * 18, y: p.y - Math.cos(a) * 18,
      vx: Math.sin(a) * def.speed, vy: -Math.cos(a) * def.speed,
      life: def.range / def.speed, dmg: def.dmg, friendly: true, kind: key,
    });
  }
}
