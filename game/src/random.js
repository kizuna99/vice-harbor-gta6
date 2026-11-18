// A tiny seeded random source (mulberry32). One seed builds one city, one traffic pattern
// and one staged screenshot, so a screenshot the maker takes is the frame any player would
// reach from the same seed, and the simulation never depends on wall-clock luck.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(random, list) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

export function rangeFrom(random, low, high) {
  return low + random() * (high - low);
}
