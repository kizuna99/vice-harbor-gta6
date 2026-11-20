// races.js — the two street races. J (or a click) at a start marker
// with your engine running flags one off: a 3-2-1 count, eight
// checkpoints, two rival cars running rubber-band pace, and the purse
// paid only for first. The race state lives on game.raceState; when it
// ends it leaves a game.lastRace receipt behind.

import { RACES } from './config.js';

function trackPoints(def) { return [def.start, ...def.checkpoints.map(([x, y]) => ({ x, y }))]; }

export function trackLength(def) {
  const pts = trackPoints(def);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

export function pointAlong(def, frac) {
  const pts = trackPoints(def);
  const total = trackLength(def);
  let want = frac * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (want <= seg) {
      const t = seg === 0 ? 0 : want / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
        angle: Math.atan2(pts[i].x - pts[i - 1].x, -(pts[i].y - pts[i - 1].y)),
      };
    }
    want -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

export function tryStartRace(game) {
  if (game.raceState || !game.player.car) return false;
  const c = game.player.car;
  for (const def of RACES) {
    if (Math.hypot(c.x - def.start.x, c.y - def.start.y) <= 124) {
      const len = trackLength(def);
      game.raceState = {
        def, phase: 'count', t: 2.6, cp: 0, elapsed: 0,
        rivals: [
          { prog: 0, speed: len / 96, colour: '#e23d8f' },
          { prog: 0, speed: len / 118, colour: '#3d7de2' },
        ],
      };
      game.toast(def.name + ' — first home takes $' + def.payout);
      return true;
    }
  }
  return false;
}

export function rivalPositions(game) {
  const rs = game.raceState;
  if (!rs) return [];
  return rs.rivals.map((r) => ({ ...pointAlong(rs.def, Math.min(1, r.prog)), colour: r.colour }));
}

export function updateRaces(game, dt) {
  const rs = game.raceState;
  if (!rs) return;
  if (rs.phase === 'count') {
    rs.t -= dt;
    if (rs.t <= 0) { rs.phase = 'go'; rs.elapsed = 0; game.toast('GO!'); }
    return;
  }
  rs.elapsed += dt;
  const car = game.player.car;
  if (!car) { game.raceState = null; game.toast('Race abandoned — you left the car'); return; }
  // player progress as a fraction, for the rubber band
  const total = rs.def.checkpoints.length;
  const playerProg = rs.cp / total;
  for (const r of rs.rivals) {
    if (r.prog >= 1) continue;
    const band = playerProg > r.prog ? 1.05 : 0.95;
    r.prog += (r.speed * band * dt) / trackLength(rs.def);
  }
  const cp = rs.def.checkpoints[rs.cp];
  if (cp && Math.hypot(car.x - cp[0], car.y - cp[1]) <= 100) {
    rs.cp += 1;
    if (rs.cp >= total) {
      const beaten = rs.rivals.filter((r) => r.prog >= 1).length;
      const pos = beaten + 1;
      const payout = pos === 1 ? rs.def.payout : 0;
      if (payout) game.cash += payout;
      game.lastRace = { name: rs.def.name, pos, payout, time: rs.elapsed };
      game.toast(pos === 1 ? rs.def.name + ' — FIRST. $' + payout + ' is yours.' : rs.def.name + ' — you came ' + pos + (pos === 2 ? 'nd' : 'rd') + '.');
      game.raceState = null;
    }
  }
}
