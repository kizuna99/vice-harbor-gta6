// config.js — every shared table for Port Serena lives here: the map
// frame, the heat ladder, the six car models, the gun rack, both shops,
// both street races and the crew roster. Other modules import these
// constants instead of hard-coding numbers of their own.

export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Heat is a 0..260 score; the star count is whichever rung it reaches.
// 170 is exactly four stars — the Searchlight Run locks heat there.
export const HEAT_RUNGS = [0, 30, 70, 120, 170, 260];
export function starsForHeat(heat) {
  let s = 0;
  for (let i = 0; i < HEAT_RUNGS.length; i++) if (heat >= HEAT_RUNGS[i]) s = i;
  return s;
}

export const SAVE_KEY = 'vice-harbor-save-v3';
export const SAFEHOUSE = { x: 200, y: 340, name: 'Old Town safehouse' };
export const BEA_SPOT = { x: 1250, y: 430, name: "Auntie Bea's corner" };

// angle convention across the whole game: a facing of `a` points along
// (sin a, -cos a) — 0 is north, PI/2 is east, PI is south.
export const EAST = Math.PI / 2;
export const SOUTH = Math.PI;
export const WEST = -Math.PI / 2;
export const NORTH = 0;

export const CAR_TYPES = [
  { id: 'coupe',   name: 'Calle Coupe',    top: 268, accel: 218, w: 46, h: 24, colours: ['#e2483d', '#f2a03d', '#3d7de2'] },
  { id: 'gt',      name: 'Solano GT',      top: 336, accel: 268, w: 48, h: 24, colours: ['#ffd23d', '#e23d8f', '#22262e'] },
  { id: 'sedan',   name: 'Palma Sedan',    top: 238, accel: 188, w: 48, h: 25, colours: ['#cfd6dd', '#5d7a99', '#7a4a3a'] },
  { id: 'taxi',    name: 'Harbor Taxi',    top: 246, accel: 196, w: 48, h: 25, colours: ['#f7b731', '#f7b731', '#f7b731'] },
  { id: 'truck',   name: 'Dockmaster Truck', top: 208, accel: 158, w: 58, h: 30, colours: ['#4a7a5d', '#746a58', '#5d6d8a'] },
  { id: 'cruiser', name: 'Serena Cruiser', top: 292, accel: 238, w: 48, h: 25, colours: ['#eef1f4'] },
];

// slot: the number key that draws it. mag: rounds carried in the gun.
// rate: ms between shots. pellets: projectiles per trigger pull.
export const WEAPONS = {
  fists:   { slot: 5, name: 'Fists',        price: 0,   dmg: 9,  rate: 300,  mag: Infinity, reserve: Infinity, auto: false, pellets: 1, spread: 0,    speed: 0,   range: 40 },
  pistol:  { slot: 1, name: 'Harbor Pistol', price: 180, dmg: 34, rate: 240,  mag: 12,       reserve: 96,       auto: false, pellets: 1, spread: 0.02, speed: 920, range: 520 },
  smg:     { slot: 2, name: 'Calle SMG',     price: 420, dmg: 16, rate: 105,  mag: 30,       reserve: 180,      auto: true,  pellets: 1, spread: 0.06, speed: 940, range: 480 },
  shotgun: { slot: 3, name: 'Pier Shotgun',  price: 650, dmg: 13, rate: 720,  mag: 6,        reserve: 48,       auto: false, pellets: 6, spread: 0.17, speed: 860, range: 330 },
  grenade: { slot: 4, name: 'Grenades',      price: 90,  dmg: 95, rate: 620,  mag: 3,        reserve: 0,        auto: false, pellets: 1, spread: 0,    speed: 430, range: 300 },
};
export const WEAPON_BY_SLOT = {};
for (const [key, w] of Object.entries(WEAPONS)) WEAPON_BY_SLOT[w.slot] = key;

export const ARMOR_PRICE = 150;
export const ARMOR_ABSORB = 0.65; // kevlar soaks 65% of incoming damage

export const WEAPON_SHOP = { x: 600, y: 1000, name: 'Serena Munitions' };
export const GARAGE = { x: 2200, y: 1400, name: 'Serena Customs' };
export const GARAGE_ITEMS = [
  { key: 'engine',  name: 'Engine tune',    price: 300, blurb: '+12% top speed and pull' },
  { key: 'plating', name: 'Harbor plating', price: 350, blurb: 'half collision and ram damage' },
  { key: 'repair',  name: 'Full repair',    price: 120, blurb: 'bodywork back to mint' },
];

export const RACES = [
  {
    id: 'palm', name: 'Palm Row Sprint', payout: 400,
    start: { x: 1400, y: 600 },
    checkpoints: [[2200, 600], [3000, 600], [3000, 1000], [2200, 1000], [2200, 1400], [1400, 1400], [1400, 1000], [1400, 600]],
  },
  {
    id: 'harbor', name: 'Harbor Lights Run', payout: 650,
    start: { x: 2600, y: 2100 },
    checkpoints: [[1800, 2100], [1000, 2100], [600, 1800], [600, 1000], [1000, 600], [1800, 1000], [2600, 1400], [2600, 2100]],
  },
];

export const CREW_DEFS = [
  { name: 'Vex',  respect: 30, weapon: 'pistol', colour: '#e2543e', blurb: 'dock kid, quick hands, quicker temper' },
  { name: 'Mara', respect: 70, weapon: 'smg',    colour: '#3e8fe2', blurb: 'ex-harbor patrol, never misses twice' },
];

export const STATIONS = ['Serena Sun FM', 'Harbor Wave Radio', 'Night Pier 88'];

export const DISTRICTS = [
  { name: 'Old Town',            x0: 0,    y0: 0,    x1: 1180, y1: 880,  ground: '#8f8578' },
  { name: 'Palm Row',            x0: 1180, y0: 330,  x1: 3200, y1: 880,  ground: '#97a07e' },
  { name: 'University Quarter',  x0: 2080, y0: 0,    x1: 3200, y1: 330,  ground: '#7e937f' },
  { name: 'Serena Marina',       x0: 2080, y0: 880,  x1: 3200, y1: 1330, ground: '#8a9a8d' },
  { name: 'The Boardwalk',       x0: 780,  y0: 1880, x1: 2380, y1: 2400, ground: '#b09a72' },
  { name: 'Port Docks',          x0: 2380, y0: 1330, x1: 3200, y1: 2400, ground: '#767c84' },
];
