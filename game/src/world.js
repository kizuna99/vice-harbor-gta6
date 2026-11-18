// world.js — Port Serena city generation.
// The city is a road grid wrapped around a beach on the east edge. All of it
// is procedural: no images, no data files, just seeded rectangles and lines.

import { CFG } from './config.js';
import { RNG, clamp } from './random.js';

// Vertical avenues (x centres) and horizontal streets (y centres).
export const AVENUES = [300, 900, 1500, 2100, 2680];
export const STREETS = [300, 900, 1500, 2050];
// Ocean Drive runs along the sand at the far east.
export const OCEAN_DRIVE_X = 2920;
export const BEACH_X = 2980; // sand starts here, water past world edge

export const DISTRICTS = [
  { name: 'Old Town',          x: 0,    y: 0,    w: 1200, h: 1200, tint: '#c9b458' },
  { name: 'Palm Row',          x: 1200, y: 0,    w: 1200, h: 1200, tint: '#57cc99' },
  { name: 'University Quarter', x: 2400, y: 0,   w: 800,  h: 1200, tint: '#80ed99' },
  { name: 'Serena Marina',     x: 0,    y: 1200, w: 1200, h: 1200, tint: '#48cae4' },
  { name: 'Boardwalk',         x: 1200, y: 1200, w: 1200, h: 1200, tint: '#ffb703' },
  { name: 'Port Docks',        x: 2400, y: 1200, w: 800,  h: 1200, tint: '#9d8189' },
];

const BUILDING_NAMES = [
  'Café Brisa', 'Hotel Palma', 'Serena Records', 'Taller Ocho', 'Banco Serena',
  'Librería Azul', 'Gym Faro', 'Clínica Harbor', 'Mercado Sol', 'Teatro Brisa',
  'Oficinas Muelle', 'Bar El Ancla', 'Peluquería Luz', 'Tacos Serena', 'Galería Mar',
  'Hotel Brisa', 'Radio Serena HQ', 'Taller del Puerto', 'Café Muelle', 'Disco Perla',
];
const PALETTE = ['#e9c46a', '#f4a261', '#e76f51', '#a8dadc', '#f1fa8c', '#ffb4a2', '#b5838d', '#90e0ef', '#e5e5e5', '#ffc8dd'];

function buildWorld(seed = 7) {
  const rng = new RNG(seed);
  const buildings = [];
  const colliders = [];
  const palms = [];
  const props = [];

  // Fill each city block (the rectangles between roads) with buildings,
  // leaving a pavement margin so the player can always walk around them.
  const xs = [0, ...AVENUES, CFG.worldW];
  const ys = [0, ...STREETS, CFG.worldH];
  let nameIdx = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + (i === 0 ? 24 : CFG.roadW / 2 + 26);
      const bx1 = xs[i + 1] - (i === xs.length - 2 ? 24 : CFG.roadW / 2 + 26);
      const by0 = ys[j] + (j === 0 ? 24 : CFG.roadW / 2 + 26);
      const by1 = ys[j + 1] - (j === ys.length - 2 ? 24 : CFG.roadW / 2 + 26);
      if (bx1 - bx0 < 150 || by1 - by0 < 150) continue;
      if (bx0 > BEACH_X - 260) continue; // keep the beach clear
      const cols = rng.int(1, 2), rows = rng.int(1, 2);
      const cw = (bx1 - bx0) / cols, ch = (by1 - by0) / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rng.chance(0.14)) continue; // plaza / parking gap
          const pad = 16;
          const b = {
            x: bx0 + cx * cw + pad, y: by0 + cy * ch + pad,
            w: cw - pad * 2, h: ch - pad * 2,
            color: rng.pick(PALETTE),
            floors: rng.int(2, 7),
            name: BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length],
            neon: rng.chance(0.3),
          };
          buildings.push(b);
          colliders.push({ x: b.x, y: b.y, w: b.w, h: b.h });
        }
      }
    }
  }

  // Named anchor buildings the jobs talk about.
  const anchors = {
    clinic:   { x: 380,  y: 1620, label: 'Harbor Clinic' },
    beaShop:  { x: 960,  y: 380,  label: "Auntie Bea's" },
    marina:   { x: 700,  y: 2150, label: 'Serena Marina' },
    pierNine: { x: 2990, y: 1420, label: 'Pier Nine' },
    docks:    { x: 2620, y: 1900, label: 'Port Docks Gate' },
  };

  // Palms line Palm Row and the Boardwalk; lamps and crates are pure props.
  for (let x = 1250; x < 2350; x += 90) palms.push({ x: x + rng.spread(10), y: 250 + rng.spread(14) });
  for (let y = 1250; y < 2350; y += 90) palms.push({ x: 2880 + rng.spread(10), y: y + rng.spread(14) });
  for (let i = 0; i < 46; i++) props.push({ x: rng.range(80, 2900), y: rng.range(80, 2320), kind: rng.pick(['crate', 'barrel', 'bench']) });

  // Pier: a walkable deck jutting into the water on the east edge.
  const pier = { x: 2980, y: 1360, w: 220, h: 120 };
  // Causeway islet: a small drivable island linked off Ocean Drive.
  const islet = { x: 2740, y: 1080, w: 180, h: 140 };

  function districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    }
    return DISTRICTS[0];
  }

  function isOnRoad(x, y) {
    const half = CFG.roadW / 2;
    if (Math.abs(x - OCEAN_DRIVE_X) <= half) return true;
    for (const ax of AVENUES) if (Math.abs(x - ax) <= half) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= half) return true;
    return false;
  }

  // Circle vs. building colliders — returns a push-out correction.
  function collideCircle(px, py, r) {
    let x = px, y = py;
    for (const c of colliders) {
      const nx = clamp(x, c.x, c.x + c.w), ny = clamp(y, c.y, c.y + c.h);
      const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 < 0.01) { y = c.y - r; continue; }
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      }
    }
    x = clamp(x, r, CFG.worldW - r);
    y = clamp(y, r, CFG.worldH - r);
    return { x, y };
  }

  // Intersection list for traffic routing.
  const intersections = [];
  for (const ax of AVENUES) for (const sy of STREETS) intersections.push({ x: ax, y: sy });
  for (const sy of STREETS) intersections.push({ x: OCEAN_DRIVE_X, y: sy });

  return {
    seed, buildings, colliders, palms, props, anchors, pier, islet,
    intersections, districtAt, isOnRoad, collideCircle,
    avenues: AVENUES, streets: STREETS, oceanDriveX: OCEAN_DRIVE_X, beachX: BEACH_X,
  };
}

export const world = buildWorld(7);
export { buildWorld };
