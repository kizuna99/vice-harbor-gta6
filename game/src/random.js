// random.js — deterministic seeded randomness.
// World generation and staged screenshot scenes must come out identical on
// every load for a given seed, so nothing in the game uses Math.random()
// for layout. (Cosmetic jitter may, layout may not.)

// Classic mulberry32: tiny, fast, good enough distribution for a city grid.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 7) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  f() { return this.next(); }
  // Float in [min, max).
  range(min, max) { return min + this.next() * (max - min); }
  // Integer in [min, max] inclusive.
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  // True with probability p.
  chance(p) { return this.next() < p; }
  // Random element of a non-empty array.
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  // Signed jitter in [-amt, +amt].
  spread(amt) { return (this.next() * 2 - 1) * amt; }
}

export function createRNG(seed) { return new RNG(seed); }

// Small numeric helpers shared across modules.
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
