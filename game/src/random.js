// random.js — a small deterministic generator (mulberry32) plus the handful
// of helpers the world builders share. Same seed, same city, every load:
// that is what makes the staged screenshots reproducible.

export function createRandom(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
    chance: (p) => next() < p,
  };
}

// A cheap value-noise for roof grime and water sparkle: stable per cell, so
// textures never shimmer between frames.
export function cellNoise(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// Angle convention for the whole game: 0 faces north (-y), PI/2 faces east.
// dirFrom does the sin/cos once so callers never re-derive it.
export const dirFrom = (angle) => ({ x: Math.sin(angle), y: -Math.cos(angle) });
export const angleTo = (x1, y1, x2, y2) => Math.atan2(x2 - x1, -(y2 - y1));

// Shortest signed turn from one heading to another, in radians.
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
