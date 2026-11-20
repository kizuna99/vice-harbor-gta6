// Deterministic seeded random helpers.
// The city layout, the staged screenshot scenes and the procedural
// ground textures all rely on reproducible rolls, so every random
// decision in the game funnels through a mulberry-style generator
// and nothing reaches for Math.random().

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level default stream used by ambient spawning and effects.
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

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
