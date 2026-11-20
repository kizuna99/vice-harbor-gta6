// Seeded randomness plus tiny math helpers.
// Screenshot scenes and the city layout must roll identically on every
// load, so ambient randomness flows through one mulberry generator.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let stream = makeRng(20261119);

export function reseed(seed) {
  stream = makeRng(seed);
}

export function rand() {
  return stream();
}

export function range(min, max) {
  return min + stream() * (max - min);
}

export function rangeInt(min, max) {
  return Math.floor(range(min, max + 1));
}

export function pick(list) {
  return list[Math.floor(stream() * list.length) % list.length];
}

export function chance(p) {
  return stream() < p;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Deterministic 0..1 hash for decoration that must not flicker
// between frames (roof texture, window patterns, water glints).
export function hash01(n) {
  let x = Math.imul(n ^ 0x9E3779B9, 0x85EBCA6B);
  x ^= x >>> 13;
  x = Math.imul(x, 0xC2B2AE35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
