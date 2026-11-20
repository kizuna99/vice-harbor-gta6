// crew.js — Rio's people. Vex, a Palm Row mechanic who shoots like she
// welds (straight, no wasted motion), and Mara, a marina smuggler who only
// joins crews that have already proved themselves. Respect opens the door;
// after that they follow, ride, fight, fall and get back up like anyone
// worth paying.

import { SAFEHOUSE } from './config.js';
import { angleTo, dirFrom } from './random.js';
import { fireProjectile } from './weapons.js';

export const ROSTER = [
  { name: 'Vex', need: 30, hp: 120, damage: 9, color: '#4ecdc4', role: 'Mechanic' },
  { name: 'Mara', need: 70, hp: 150, damage: 12, color: '#ef6f6c', role: 'Smuggler' },
];

export function recruitable(game) {
  if (game.player.car) return null;
  if (Math.hypot(game.player.x - SAFEHOUSE.x, game.player.y - SAFEHOUSE.y) > 84) return null;
  for (const r of ROSTER) {
    if (game.respect >= r.need && !game.crew.some((m) => m.name === r.name)) return r;
  }
  return null;
}

export function recruit(game) {
  const r = recruitable(game);
  if (!r) return null;
  const member = {
    name: r.name, role: r.role, color: r.color,
    x: SAFEHOUSE.x + 18, y: SAFEHOUSE.y + 26, angle: 0,
    hp: r.hp, maxHp: r.hp, damage: r.damage,
    state: 'follow', riding: false, reviveT: 0, shotT: 1,
  };
  game.crew.push(member);
  game.banner(`${r.name} joins the crew — ${r.role}`);
  game.audio.blip();
  game.saveSoon();
  return member;
}

export function toggleFollow(game) {
  const next = game.crew.some((m) => m.state === 'follow') ? 'stay' : 'follow';
  for (const m of game.crew) if (m.state !== 'down') m.state = next;
  game.banner(next === 'follow' ? 'Crew: on me' : 'Crew: hold position');
}

export function updateCrew(game, dt) {
  const p = game.player;
  for (const m of game.crew) {
    if (m.state === 'down') {
      m.reviveT -= dt;
      // Rio standing over a fallen friend speeds the recovery up.
      if (Math.hypot(p.x - m.x, p.y - m.y) < 44) m.reviveT -= dt * 3;
      if (m.reviveT <= 0) {
        m.state = 'follow';
        m.hp = Math.floor(m.maxHp * 0.55);
        game.banner(`${m.name} is back up`);
      }
      continue;
    }
    // Riding: glued to the car, out of the line of fire.
    if (p.car) {
      if (Math.hypot(p.car.x - m.x, p.car.y - m.y) < 64) m.riding = true;
      if (m.riding) { m.x = p.car.x; m.y = p.car.y; continue; }
    } else if (m.riding) {
      m.riding = false;
      m.x = p.x + 22; m.y = p.y + 10;
    }

    if (m.state === 'follow') {
      // Formation point trails Rio opposite his facing, alternating sides
      // per member so the crew does not stack into a single file.
      const idx = game.crew.indexOf(m);
      const back = dirFrom(p.angle + Math.PI + (idx === 0 ? -0.5 : 0.5));
      const tx = p.x + back.x * 40, ty = p.y + back.y * 40;
      const d = Math.hypot(tx - m.x, ty - m.y);
      if (d > 14) {
        const want = angleTo(m.x, m.y, tx, ty);
        m.angle = want;
        const sp = d > 130 ? 252 : 168;
        const dir = dirFrom(want);
        const fixed = game.world.collide(m.x + dir.x * sp * dt, m.y + dir.y * sp * dt, 12);
        m.x = fixed.x; m.y = fixed.y;
      }
    }

    // Fight: nearest visible gunman inside 330px gets a round a second.
    m.shotT -= dt;
    let target = null, td = 330;
    for (const e of game.enemies) {
      if (e.state === 'down') continue;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d < td && !game.world.lineBlocked(m.x, m.y, e.x, e.y)) { target = e; td = d; }
    }
    if (target && m.shotT <= 0 && game.state === 'playing') {
      m.shotT = 0.95;
      m.angle = angleTo(m.x, m.y, target.x, target.y);
      fireProjectile(game, m.x, m.y, m.angle, { speed: 580, range: 380, damage: m.damage, hostile: false });
      game.audio.shot('pistol');
    }
  }
}
