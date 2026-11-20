// world.js — Port Serena itself: the road grid, six districts of
// buildings, the docks with their container yards, beach, water and the
// pier. Everything is dealt from one seed so the city never changes
// between visits. Also home to the two questions every other system
// asks the map: "does this circle fit here?" and "can A see B?"

import { WORLD_W, WORLD_H, SAFEHOUSE, BEA_SPOT, WEAPON_SHOP, GARAGE, EAST, SOUTH, WEST, DISTRICTS } from './config.js';
import { makeRng, rngInt, rngPick, hash2 } from './random.js';

export const ROAD_W = 118;
export const AVENUES_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS_Y = [300, 600, 1000, 1400, 1800, 2100];
export const WATER_Y = 2305;   // the sea starts here
export const SAND_Y = 2180;    // sand starts here
export const PIER = { x0: 2610, y0: 2160, x1: 2770, y1: 2400 };

export const RAMPS = [
  { x: 1330, y: 600, angle: EAST },   // Palm Row, just west of the race line
  { x: 600, y: 1640, angle: SOUTH },  // University drop
  { x: 2470, y: 300, angle: WEST },   // Marina heights
  { x: 1750, y: 2100, angle: EAST },  // Boardwalk run-up
];

// Places that must stay open ground: mission stages, shop fronts, the
// safehouse yard. Buildings are never dealt into these circles.
const CLEAR_ZONES = [
  { x: SAFEHOUSE.x, y: SAFEHOUSE.y, r: 118 },
  { x: BEA_SPOT.x, y: BEA_SPOT.y, r: 128 },
  { x: WEAPON_SHOP.x, y: WEAPON_SHOP.y, r: 104 },
  { x: GARAGE.x, y: GARAGE.y, r: 116 },
  { x: 2790, y: 1470, r: 205 },  // dockside arena
  { x: 2900, y: 1420, r: 110 },  // dock gate
  { x: 2600, y: 1180, r: 96 },   // marina pickup
  { x: 2900, y: 1800, r: 92 },   // dock warehouse door
  { x: 2600, y: 165, r: 165 },   // university green
];

const ROOF_TONES = ['#b0563f', '#8a6a4f', '#6d7f8a', '#a34a5e', '#54707e', '#7d5a80', '#96684a', '#4f6e5d'];
const WALL_TONES = ['#d9c6a5', '#cbb59a', '#b8c4c9', '#e3d3b8', '#c9a689', '#aebfc0', '#d6b8a6'];

function rectHitsCircle(rx, ry, rw, rh, cx, cy, cr) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < cr * cr;
}

export function buildWorld(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [];
  const containers = [];
  const half = ROAD_W / 2;

  // Blocks are the rectangles of land between neighbouring roads.
  const xs = [-40, ...AVENUES_X, WORLD_W + 40];
  const ys = [-40, ...STREETS_Y, SAND_Y + 40];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + half + 22, bx1 = xs[i + 1] - half - 22;
      const by0 = ys[j] + half + 22, by1 = ys[j + 1] - half - 22;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      if (cy > SAND_Y - 60) continue;                       // boardwalk + beach stay open
      const inDocks = cx > 2380 && cy > 1330;
      if (inDocks && hash2(i, j) < 0.45) continue;          // dock yards are half open ground
      const lotsX = bx1 - bx0 > 330 ? 2 : 1;
      const lotsY = by1 - by0 > 300 ? 2 : 1;
      for (let lx = 0; lx < lotsX; lx++) {
        for (let ly = 0; ly < lotsY; ly++) {
          const x0 = bx0 + (bx1 - bx0) * (lx / lotsX) + 7;
          const x1 = bx0 + (bx1 - bx0) * ((lx + 1) / lotsX) - 7;
          const y0 = by0 + (by1 - by0) * (ly / lotsY) + 7;
          const y1 = by0 + (by1 - by0) * ((ly + 1) / lotsY) - 7;
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          if (CLEAR_ZONES.some((z) => rectHitsCircle(x0, y0, x1 - x0, y1 - y0, z.x, z.y, z.r))) continue;
          const centreBias = 1 - Math.min(1, Math.hypot(mx - 1600, my - 1150) / 1500);
          buildings.push({
            x: x0, y: y0, w: x1 - x0, h: y1 - y0,
            floors: inDocks ? rngInt(rng, 1, 2) : rngInt(rng, 2, 4) + Math.round(centreBias * rngInt(rng, 2, 6)),
            roof: rngPick(rng, ROOF_TONES), wall: rngPick(rng, WALL_TONES),
            seed: Math.floor(hash2(Math.round(mx), Math.round(my)) * 1e6),
            warehouse: inDocks,
          });
        }
      }
    }
  }

  // Container stacks ring the dock arena and fill the yards — they are
  // low, hard cover: they collide and they block sight lines.
  const boxCols = ['#b3502e', '#2e6db3', '#3f9e58', '#b3a02e', '#7a4a8c'];
  const stackSpots = [];
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2;
    stackSpots.push({ x: 2790 + Math.cos(ang) * 218, y: 1470 + Math.sin(ang) * 218, rot: a % 2 });
  }
  stackSpots.push(
    { x: 2560, y: 1560, rot: 0 }, { x: 2560, y: 1660, rot: 1 }, { x: 3050, y: 1620, rot: 0 },
    { x: 2980, y: 1960, rot: 1 }, { x: 2620, y: 1980, rot: 0 }, { x: 2500, y: 1420, rot: 1 },
  );
  for (const s of stackSpots) {
    const w = s.rot ? 26 : 66, h = s.rot ? 66 : 26;
    containers.push({ x: s.x - w / 2, y: s.y - h / 2, w, h, colour: rngPick(rng, boxCols), low: true });
  }

  // Palms shade Palm Row and the boardwalk; crates litter the docks.
  const palms = [];
  for (let x = 320; x < 3150; x += 128) {
    if (AVENUES_X.some((ax) => Math.abs(ax - x) < 90)) continue;
    palms.push({ x: x + hash2(x, 1) * 20 - 10, y: 600 - half - 17 });
    palms.push({ x: x + hash2(x, 2) * 20 - 10, y: 600 + half + 17 });
  }
  for (let x = 860; x < 2320; x += 118) palms.push({ x, y: 2162 });
  const crates = [];
  for (let i = 0; i < 26; i++) {
    crates.push({ x: 2440 + hash2(i, 7) * 700, y: 1380 + hash2(i, 11) * 560, s: 12 + hash2(i, 3) * 10 });
  }
  const stalls = [];
  for (let x = 940; x < 2300; x += 168) stalls.push({ x, y: 2066, colour: rngPick(rng, boxCols) });

  const colliders = [...buildings, ...containers];
  // A coarse grid over the colliders keeps collision checks cheap.
  const CELL = 220;
  const grid = new Map();
  const cellKey = (cx, cy) => cx + ':' + cy;
  colliders.forEach((c, idx) => {
    const x0 = Math.floor(c.x / CELL), x1 = Math.floor((c.x + c.w) / CELL);
    const y0 = Math.floor(c.y / CELL), y1 = Math.floor((c.y + c.h) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const k = cellKey(gx, gy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(idx);
    }
  });

  return { buildings, containers, colliders, grid, CELL, palms, crates, stalls, clearZones: CLEAR_ZONES };
}

export function districtAt(x, y) {
  if (y >= WATER_Y) return 'The Harbour';
  if (y >= SAND_Y) return 'The Boardwalk';
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Port Serena';
}

export function isRoad(x, y) {
  if (y > WATER_Y - 20) return false;
  const half = ROAD_W / 2;
  return AVENUES_X.some((ax) => Math.abs(ax - x) <= half) || STREETS_Y.some((sy) => Math.abs(sy - y) <= half);
}

export function onPier(x, y) { return x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0 && y <= PIER.y1; }
export function isWater(x, y) { return y >= WATER_Y && !onPier(x, y); }

// Push a circle (entity at e.x/e.y with radius r) out of every solid
// rect it overlaps. Returns true if anything pushed.
export function collideCircle(world, e, r) {
  let pushed = false;
  const CELL = world.CELL;
  const gx = Math.floor(e.x / CELL), gy = Math.floor(e.y / CELL);
  const seen = new Set();
  for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
    const bucket = world.grid.get(ix + ':' + iy);
    if (!bucket) continue;
    for (const idx of bucket) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      const c = world.colliders[idx];
      const nx = Math.max(c.x, Math.min(e.x, c.x + c.w));
      const ny = Math.max(c.y, Math.min(e.y, c.y + c.h));
      const dx = e.x - nx, dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * r; e.y = ny + (dy / d) * r;
        } else {
          // centre inside the rect: leave by the shortest side
          const left = e.x - c.x, right = c.x + c.w - e.x, top = e.y - c.y, bot = c.y + c.h - e.y;
          const m = Math.min(left, right, top, bot);
          if (m === left) e.x = c.x - r; else if (m === right) e.x = c.x + c.w + r;
          else if (m === top) e.y = c.y - r; else e.y = c.y + c.h + r;
        }
        pushed = true;
      }
    }
  }
  // the sea is a wall unless you are on the pier
  if (e.y + r > WATER_Y && !onPier(e.x, e.y)) { e.y = WATER_Y - r; pushed = true; }
  if (e.x < r) { e.x = r; pushed = true; }
  if (e.y < r) { e.y = r; pushed = true; }
  if (e.x > WORLD_W - r) { e.x = WORLD_W - r; pushed = true; }
  if (e.y > WORLD_H - r) { e.y = WORLD_H - r; pushed = true; }
  return pushed;
}

// Segment vs. building/container rects — the gunfire and eyesight rule.
export function losClear(world, x1, y1, x2, y2) {
  const minx = Math.min(x1, x2) - 4, maxx = Math.max(x1, x2) + 4;
  const miny = Math.min(y1, y2) - 4, maxy = Math.max(y1, y2) + 4;
  for (const c of world.colliders) {
    if (c.x + c.w < minx || c.x > maxx || c.y + c.h < miny || c.y > maxy) continue;
    if (segRect(x1, y1, x2, y2, c)) return false;
  }
  return true;
}

function segRect(x1, y1, x2, y2, r) {
  if (x1 >= r.x && x1 <= r.x + r.w && y1 >= r.y && y1 <= r.y + r.h) return true;
  if (x2 >= r.x && x2 <= r.x + r.w && y2 >= r.y && y2 <= r.y + r.h) return true;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const slabs = [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]];
  for (const [p, q] of slabs) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; }
    else {
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
