// world.js — Port Serena's static shape: the road grid, the buildings that
// fill its blocks, the docks apron, the beach and the pier. Everything here
// is built once from the seed and then only read: collisions, line-of-sight
// for gunfire, and the renderer all consult the same tables.

import { AVENUES, STREETS, WORLD, DISTRICTS, RAMPS } from './config.js';
import { createRandom, cellNoise } from './random.js';

const ROAD_HALF = 34;      // asphalt half-width around each grid line
const SIDEWALK = 12;       // pavement ring beyond the asphalt

// Open yards that building generation must keep clear: the docks apron where
// the crossfire happens, Bea's plaza up north, and the two shop forecourts.
const CLEARINGS = [
  { x: 2700, y: 1418, w: 470, h: 230 },   // Port Docks apron
  { x: 1150, y: 330, w: 210, h: 210 },    // Bea's Corner plaza
  { x: 520, y: 920, w: 170, h: 170 },     // Munitions forecourt
  { x: 2120, y: 1320, w: 170, h: 170 },   // Customs forecourt
  { x: 120, y: 260, w: 170, h: 170 },     // safehouse yard
];

function rectsOverlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function buildWorld(seed) {
  const rng = createRandom(seed ^ 0x51ab);
  const buildings = [];

  // Walk each block between neighbouring grid lines and drop one to three
  // buildings into it, leaving alleys. Blocks that touch a clearing stay
  // empty so mission spaces read as yards, not mazes.
  const xs = [-80, ...AVENUES, WORLD.width + 80];
  const ys = [-80, ...STREETS, WORLD.height + 80];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + ROAD_HALF + SIDEWALK;
      const by = ys[j] + ROAD_HALF + SIDEWALK;
      const bw = xs[i + 1] - xs[i] - (ROAD_HALF + SIDEWALK) * 2;
      const bh = ys[j + 1] - ys[j] - (ROAD_HALF + SIDEWALK) * 2;
      if (bw < 120 || bh < 120) continue;
      if (by > WORLD.beachY - 60) continue; // the shore stays open
      const block = { x: bx, y: by, w: bw, h: bh };
      if (CLEARINGS.some((c) => rectsOverlap(block, c, -30))) continue;
      const district = districtAt(bx + bw / 2, by + bh / 2);
      const count = rng.int(1, 3);
      for (let k = 0; k < count; k++) {
        const w = bw * (count === 1 ? rng.range(0.62, 0.8) : rng.range(0.3, 0.44));
        const h = bh * rng.range(0.55, 0.82);
        const x = bx + (count === 1 ? (bw - w) / 2 : (k * bw) / count + rng.range(4, 18));
        const y = by + rng.range(0, Math.max(1, bh - h));
        const b = {
          x, y, w, h,
          floors: rng.int(2, 9),
          roof: district.roof[k % district.roof.length],
          wall: district.wall,
          seed: rng.int(1, 99999),
          district: district.name,
        };
        if (CLEARINGS.some((c) => rectsOverlap(b, c, 6))) continue;
        buildings.push(b);
      }
    }
  }

  // Palms along the shore and Palm Row; lamps on every corner grid point.
  const palms = [];
  for (let x = 60; x < WORLD.width; x += 130) palms.push({ x: x + rng.range(-14, 14), y: WORLD.beachY + 26 + rng.range(-8, 8), s: rng.range(0.8, 1.25) });
  for (let x = 340; x < 3100; x += 210) palms.push({ x, y: 600 - ROAD_HALF - 22, s: rng.range(0.8, 1.15) });
  const lamps = [];
  for (const ax of AVENUES) for (const sy of STREETS) lamps.push({ x: ax + ROAD_HALF + 8, y: sy + ROAD_HALF + 8 });

  return {
    buildings,
    palms,
    lamps,
    ramps: RAMPS,
    width: WORLD.width,
    height: WORLD.height,

    isWater(x, y) {
      if (y < WORLD.waterY) return false;
      const p = WORLD.pier;
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
      return true;
    },
    isSand(x, y) {
      return y >= WORLD.beachY && y < WORLD.waterY;
    },
    isRoad(x, y) {
      for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF) return true;
      for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_HALF) return true;
      return false;
    },
    rampAt(x, y) {
      for (const r of RAMPS) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
      return null;
    },

    // Circle vs. every building: returns the position pushed out along the
    // shallowest axis, or null when the circle is already clear. Water is
    // solid for anything that is not a boat, and there are no boats.
    collide(x, y, radius) {
      let px = x, py = y;
      px = Math.max(radius, Math.min(WORLD.width - radius, px));
      const maxY = this.isWater(px, y) ? WORLD.waterY - radius : WORLD.height - radius;
      py = Math.max(radius, Math.min(maxY, py));
      for (const b of buildings) {
        const nx = Math.max(b.x, Math.min(b.x + b.w, px));
        const ny = Math.max(b.y, Math.min(b.y + b.h, py));
        const dx = px - nx, dy = py - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * radius;
          py = ny + (dy / d) * radius;
        } else {
          // Centre inside the rect: leave by the nearest face.
          const left = px - b.x, right = b.x + b.w - px, top = py - b.y, bot = b.y + b.h - py;
          const m = Math.min(left, right, top, bot);
          if (m === left) px = b.x - radius;
          else if (m === right) px = b.x + b.w + radius;
          else if (m === top) py = b.y - radius;
          else py = b.y + b.h + radius;
        }
      }
      return { x: px, y: py };
    },

    pointInBuilding(x, y, pad = 0) {
      for (const b of buildings) {
        if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
      }
      return null;
    },

    // Slab test, segment against every building rect. Gunfire and police
    // eyesight both stop at walls.
    lineBlocked(x1, y1, x2, y2) {
      for (const b of buildings) {
        if (segmentHitsRect(x1, y1, x2, y2, b)) return true;
      }
      return false;
    },

    textureAt(x, y) {
      return cellNoise(x >> 5, y >> 5, 7);
    },
  };
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const axes = [
    [-dx, x1 - r.x], [dx, r.x + r.w - x1],
    [-dy, y1 - r.y], [dy, r.y + r.h - y1],
  ];
  for (const [p, q] of axes) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
