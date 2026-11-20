// crew.js — the Old Town crew. Vex signs on at 30 respect, Mara at 70;
// walk up to the safehouse door and press E, first eligible first.
// Crew follow on foot, pile into your car when you drive, shoot back
// with their own pieces, go down under fire and get revived when you
// come back for them. C toggles follow / hold position. Membership is
// part of the save.

import { CREW_DEFS, SAFEHOUSE } from './config.js';
import { losClear, collideCircle } from './world.js';

export function tryRecruit(game) {
  const p = game.player;
  if (p.car) return false;
  if (Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) > 106) return false;
  for (const def of CREW_DEFS) {
    if (game.crew.some((m) => m.name === def.name)) continue;
    if (game.respect < def.respect) continue;
    game.crew.push({
      name: def.name, x: SAFEHOUSE.x + 30, y: SAFEHOUSE.y + 16, angle: 0,
      health: 100, state: 'follow', mode: 'follow', weapon: def.weapon, colour: def.colour,
      radius: 13, fireCd: Math.random() * 0.5, downT: 0, walkCycle: Math.random() * 6,
    });
    game.toast(def.name + ' joins the crew — ' + def.blurb);
    return true;
  }
  return false;
}

export function toggleCrewMode(game) {
  if (!game.crew.length) return;
  const next = game.crew[0].mode === 'follow' ? 'stay' : 'follow';
  for (const m of game.crew) if (m.state !== 'down') m.mode = next;
  game.toast('Crew: ' + (next === 'follow' ? 'on my heels' : 'hold this ground'));
}

export function restoreCrew(game, saved) {
  game.crew = [];
  for (const s of saved || []) {
    const def = CREW_DEFS.find((d) => d.name === s.name);
    if (!def) continue;
    game.crew.push({
      name: def.name, x: s.x ?? SAFEHOUSE.x + 30, y: s.y ?? SAFEHOUSE.y + 16, angle: 0,
      health: s.health ?? 100, state: 'follow', mode: 'follow', weapon: def.weapon, colour: def.colour,
      radius: 13, fireCd: 0.4, downT: 0, walkCycle: 0,
    });
  }
}

function crewShoot(game, m, target) {
  const a = Math.atan2(target.x - m.x, -(target.y - m.y)) + (Math.random() - 0.5) * 0.1;
  const speed = 880;
  game.projectiles.push({
    x: m.x + Math.sin(a) * 16, y: m.y - Math.cos(a) * 16,
    vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed,
    life: 0.5, dmg: m.weapon === 'smg' ? 10 : 20, friendly: true, kind: m.weapon,
  });
}

export function updateCrew(game, dt) {
  const p = game.player;
  game.crew.forEach((m, idx) => {
    if (m.state === 'down') {
      m.downT += dt;
      if (m.downT > 5 && Math.hypot(p.x - m.x, p.y - m.y) < 92 && !p.car) {
        m.state = 'follow'; m.health = 45; m.downT = 0;
        game.toast(m.name + ' is back on their feet');
      }
      return;
    }
    if (p.car) {
      if (m.state !== 'ride' && Math.hypot(p.car.x - m.x, p.car.y - m.y) < 74) m.state = 'ride';
      if (m.state === 'ride') { m.x = p.car.x; m.y = p.car.y; return; }
    } else if (m.state === 'ride') {
      m.state = 'follow';
      m.x = p.x + 24; m.y = p.y + 8;
    }
    if (m.mode === 'stay') return;
    // formation point: just off Rio's shoulder
    const back = { x: p.x - Math.sin(p.angle) * 36 + (idx ? 20 : -20), y: p.y + Math.cos(p.angle) * 36 };
    const d = Math.hypot(back.x - m.x, back.y - m.y);
    if (d > 44) {
      const run = d > 190 ? 246 : 196;
      m.angle = Math.atan2(back.x - m.x, -(back.y - m.y));
      m.x += Math.sin(m.angle) * run * dt;
      m.y += -Math.cos(m.angle) * run * dt;
      m.walkCycle += dt * 9;
      collideCircle(game.world, m, m.radius);
    }
    // shoot back at whoever is shooting at the crew
    m.fireCd -= dt;
    if (m.fireCd <= 0) {
      let target = null, best = 330;
      for (const e of game.enemies) {
        if (e.state === 'down') continue;
        const dd = Math.hypot(e.x - m.x, e.y - m.y);
        if (dd < best && losClear(game.world, m.x, m.y, e.x, e.y)) { target = e; best = dd; }
      }
      if (!target) for (const o of game.policeRef.officers) {
        const dd = Math.hypot(o.x - m.x, o.y - m.y);
        if (dd < best && losClear(game.world, m.x, m.y, o.x, o.y)) { target = o; best = dd; }
      }
      if (target) {
        crewShoot(game, m, target);
        m.fireCd = m.weapon === 'smg' ? 0.17 : 0.5;
      } else m.fireCd = 0.12;
    }
    if (m.health < 100) m.health = Math.min(100, m.health + dt * 1.6);
  });
}
