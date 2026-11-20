// render.js — everything the eye gets: the city from above with 2.5D
// rooftops and sun-arc shadows, neon that wakes up after dark and
// reflects on the harbour, traffic, gunfire, Air One's searchlight —
// and over it the HUD: cash and kevlar, the job card, the minimap,
// shop panels, race countdowns and the title screen. Nothing here
// changes the game; it only reads it.

import { WORLD_W, WORLD_H, STATIONS, WEAPONS, GARAGE_ITEMS, WEAPON_SHOP, GARAGE, SAFEHOUSE } from './config.js';
import { AVENUES_X, STREETS_Y, ROAD_W, WATER_Y, SAND_Y, PIER, RAMPS, districtAt } from './world.js';
import { currentObjective } from './missions.js';
import { rivalPositions } from './races.js';
import { hash2 } from './random.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function nightFactor(hours) {
  // 0 in full day, 1 in deep night; dawn and dusk ramp through gold
  if (hours < 5.5 || hours > 19.5) return 1;
  if (hours < 7.5) return 1 - (hours - 5.5) / 2;
  if (hours > 17.5) return (hours - 17.5) / 2;
  return 0;
}

export function render(ctx, game, W, H) {
  const cam = game.camera;
  const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const ox = cam.x - W / 2 + shakeX, oy = cam.y - H / 2 + shakeY;
  const view = { x0: ox - 90, y0: oy - 90, x1: ox + W + 90, y1: oy + H + 90 };
  const night = nightFactor(game.timeHours);
  const t = game.elapsed;

  ctx.fillStyle = '#77806d';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-ox, -oy);

  drawGround(ctx, game, view, night, t);
  drawMarkers(ctx, game, t);
  // buildings sort by their south edge so rooftops overlap correctly
  const visBuildings = game.world.buildings.filter((b) => b.x + b.w < view.x1 && b.x > view.x0 - b.w && b.y + b.h > view.y0 - 80 && b.y < view.y1);
  visBuildings.sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of visBuildings) drawBuilding(ctx, b, game.timeHours, night);
  for (const c of game.world.containers) {
    if (c.x > view.x1 || c.x + c.w < view.x0 || c.y > view.y1 || c.y + c.h < view.y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.colour;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      if (c.w > c.h) { ctx.moveTo(c.x + (c.w / 4) * i, c.y); ctx.lineTo(c.x + (c.w / 4) * i, c.y + c.h); }
      else { ctx.moveTo(c.x, c.y + (c.h / 4) * i); ctx.lineTo(c.x + c.w, c.y + (c.h / 4) * i); }
      ctx.stroke();
    }
  }
  drawCarsAndPeople(ctx, game, view, night, t);
  drawEffects(ctx, game, view);

  // dusk-to-night wash, then the lights that fight it
  if (night > 0.02) {
    ctx.fillStyle = `rgba(9, 14, 44, ${night * 0.52})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.globalCompositeOperation = 'lighter';
    drawLights(ctx, game, view, night, t);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  drawHud(ctx, game, W, H, night);
}

function drawGround(ctx, game, view, night, t) {
  // district ground tones
  const tones = ['#8f8578', '#97a07e', '#7e937f', '#8a9a8d', '#a08e6d', '#767c84'];
  const rects = [
    [0, 0, 1180, 880], [1180, 330, 2020, 550], [2080, 0, 1120, 330],
    [2080, 880, 1120, 450], [780, 1880, 1600, 300], [2380, 1330, 820, 1070],
  ];
  rects.forEach((r, i) => { ctx.fillStyle = tones[i]; ctx.fillRect(r[0], r[1], r[2], r[3]); });
  ctx.fillStyle = '#8b9077';
  ctx.fillRect(0, 880, 2080, 1500);
  ctx.fillStyle = '#7c8468';
  ctx.fillRect(0, 0, 2080, 330);
  // sand + sea
  ctx.fillStyle = '#d9bd8a';
  ctx.fillRect(0, SAND_Y, WORLD_W, WATER_Y - SAND_Y);
  const seaGrad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  seaGrad.addColorStop(0, '#2e7ea6');
  seaGrad.addColorStop(1, '#174a6e');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, WATER_Y, WORLD_W, WORLD_H - WATER_Y);
  ctx.strokeStyle = `rgba(255,255,255,${0.14 + night * 0.1})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = WATER_Y + 14 + i * 11;
    ctx.beginPath();
    for (let x = Math.floor(view.x0 / 90) * 90; x < view.x1; x += 90) {
      const yy = y + Math.sin(t * 1.3 + x * 0.02 + i) * 2.4;
      if (x === Math.floor(view.x0 / 90) * 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // the pier
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(PIER.x0, PIER.y0, PIER.x1 - PIER.x0, PIER.y1 - PIER.y0);
  ctx.strokeStyle = 'rgba(60,40,20,0.5)';
  for (let y = PIER.y0 + 16; y < PIER.y1; y += 22) { ctx.beginPath(); ctx.moveTo(PIER.x0, y); ctx.lineTo(PIER.x1, y); ctx.stroke(); }
  // boardwalk planks
  ctx.fillStyle = '#b08c5a';
  ctx.fillRect(760, 2028, 1660, 128);
  ctx.strokeStyle = 'rgba(90,64,32,0.35)';
  for (let x = 780; x < 2420; x += 34) { ctx.beginPath(); ctx.moveTo(x, 2028); ctx.lineTo(x, 2156); ctx.stroke(); }

  // roads
  ctx.fillStyle = '#3d4149';
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WATER_Y);
  for (const sy of STREETS_Y) ctx.fillRect(0, sy - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = '#454a53';
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_W / 2, WATER_Y - 4, ROAD_W, 4);
  // lane dashes
  ctx.fillStyle = 'rgba(240,220,130,0.5)';
  for (const ax of AVENUES_X) for (let y = 14; y < WATER_Y - 20; y += 46) ctx.fillRect(ax - 2, y, 4, 24);
  for (const sy of STREETS_Y) for (let x = 14; x < WORLD_W - 20; x += 46) ctx.fillRect(x, sy - 2, 24, 4);
  // sidewalks
  ctx.fillStyle = 'rgba(210,205,190,0.35)';
  for (const ax of AVENUES_X) { ctx.fillRect(ax - ROAD_W / 2 - 7, 0, 7, WATER_Y); ctx.fillRect(ax + ROAD_W / 2, 0, 7, WATER_Y); }
  for (const sy of STREETS_Y) { ctx.fillRect(0, sy - ROAD_W / 2 - 7, WORLD_W, 7); ctx.fillRect(0, sy + ROAD_W / 2, WORLD_W, 7); }

  // university green
  ctx.fillStyle = '#6f9e5f';
  ctx.beginPath(); ctx.arc(2600, 165, 150, 0, 6.29); ctx.fill();

  // palms, crates, stalls
  for (const palm of game.world.palms) {
    if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
    ctx.strokeStyle = '#6d5136';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3, palm.y - 13); ctx.stroke();
    ctx.fillStyle = '#3f7d3a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28 + palm.x;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 11, palm.y - 15 + Math.sin(a) * 5, 12, 4.6, a, 0, 6.29);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#9a7c4f';
  for (const c of game.world.crates) ctx.fillRect(c.x, c.y, c.s, c.s);
  for (const s of game.world.stalls) {
    ctx.fillStyle = s.colour;
    ctx.fillRect(s.x, s.y, 52, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(s.x - 3, s.y - 5, 58, 8);
  }
  // stunt ramps
  for (const ramp of RAMPS) {
    ctx.save();
    ctx.translate(ramp.x, ramp.y);
    ctx.rotate(ramp.angle - Math.PI / 2);
    ctx.fillStyle = '#5a6068';
    ctx.fillRect(-24, -15, 48, 30);
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawBuilding(ctx, b, hours, night) {
  const lift = b.floors * 6.2;
  const sunX = (hours - 12) * 1.6;
  ctx.fillStyle = 'rgba(20,20,30,0.28)';
  ctx.fillRect(b.x + sunX + 5, b.y + 7, b.w, b.h);
  // walls (the 2.5D skirt) then the roof slab
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y - lift * 0.4, b.w, b.h + lift * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(b.x, b.y + b.h - 3, b.w, lift * 0.4 + 3);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y - lift * 0.4, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.strokeRect(b.x + 0.5, b.y - lift * 0.4 + 0.5, b.w - 1, b.h - 1);
  if (b.warehouse) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (let x = b.x + 12; x < b.x + b.w - 8; x += 26) ctx.fillRect(x, b.y - lift * 0.4 + 6, 12, 5);
  }
  // window grid, dealt from the building's own seed
  const cols = Math.max(2, Math.floor(b.w / 21));
  const rows = Math.max(1, Math.floor(b.h / 21));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const v = hash2(b.seed + i * 7, j * 13);
    const lit = night > 0.35 && v > 0.62;
    ctx.fillStyle = lit ? 'rgba(255,205,110,0.95)' : `rgba(40,52,66,${0.25 + v * 0.2})`;
    ctx.fillRect(b.x + 6 + i * 21, b.y - lift * 0.4 + 6 + j * 21, 9, 7);
  }
}

function drawMarkers(ctx, game, t) {
  const pulse = 0.75 + Math.sin(t * 4) * 0.25;
  const sign = (x, y, label, colour) => {
    ctx.font = 'bold 11px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(12,16,24,0.82)';
    rr(ctx, x - w / 2, y - 44, w, 20, 5); ctx.fill();
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 30);
    ctx.beginPath();
    ctx.arc(x, y, 7 * pulse + 3, 0, 6.29);
    ctx.strokeStyle = colour; ctx.lineWidth = 2.4; ctx.stroke();
  };
  sign(WEAPON_SHOP.x, WEAPON_SHOP.y, 'SERENA MUNITIONS', '#ffd23d');
  sign(GARAGE.x, GARAGE.y, 'SERENA CUSTOMS', '#7dd0ff');
  sign(SAFEHOUSE.x, SAFEHOUSE.y, 'SAFEHOUSE', '#8fe28f');

  const obj = game.state === 'playing' ? currentObjective(game) : null;
  if (obj) {
    const grad = ctx.createLinearGradient(0, obj.y - 190, 0, obj.y);
    grad.addColorStop(0, 'rgba(255,210,61,0)');
    grad.addColorStop(1, 'rgba(255,210,61,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(obj.x - 13, obj.y - 190, 26, 190);
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 20 * pulse + 8, 0, 6.29);
    ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 3; ctx.stroke();
  }
  // race furniture
  for (const def of [{ start: { x: 1400, y: 600 } }, { start: { x: 2600, y: 2100 } }]) {
    ctx.beginPath();
    ctx.arc(def.start.x, def.start.y, 17, 0, 6.29);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RACE — J', def.start.x, def.start.y - 24);
  }
  const rs = game.raceState;
  if (rs && rs.phase === 'go') {
    const cp = rs.def.checkpoints[rs.cp];
    if (cp) {
      ctx.beginPath();
      ctx.arc(cp[0], cp[1], 26 * pulse + 6, 0, 6.29);
      ctx.strokeStyle = '#ff5da2'; ctx.lineWidth = 4; ctx.stroke();
    }
  }
}

function drawFigure(ctx, x, y, angle, colour, walkCycle, opts = {}) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 4.5, 0, 0, 6.29); ctx.fill();
  const bob = Math.sin(walkCycle) * 1.6;
  ctx.save();
  ctx.translate(x, y + bob * 0.3);
  if (opts.down) { ctx.rotate(1.45); ctx.globalAlpha = 0.75; }
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#e8b98d';
  ctx.beginPath(); ctx.arc(0, -1.5, 5.4, 0, 6.29); ctx.fill();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(Math.sin(angle) * 4, -Math.cos(angle) * 4);
  ctx.lineTo(Math.sin(angle) * 12, -Math.cos(angle) * 12);
  ctx.stroke();
  if (opts.gun) {
    ctx.strokeStyle = '#22252b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.sin(angle) * 8, -Math.cos(angle) * 8);
    ctx.lineTo(Math.sin(angle) * 19, -Math.cos(angle) * 19);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCar(ctx, car, night, t) {
  const liftY = car.airZ || 0;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(car.x, car.y + 7, car.type.w * 0.55, car.type.h * 0.62, 0, 0, 6.29);
  ctx.fill();
  // The body art below is drawn nose-east (+x). One rotation lays it
  // onto the car's facing: rotating by (angle - PI/2) maps +x onto
  // (sin a, -cos a), the game's facing convention.
  ctx.save();
  ctx.translate(car.x, car.y - liftY);
  ctx.rotate(car.angle - Math.PI / 2);
  const w = car.type.w, h = car.type.h;
  ctx.fillStyle = car.wrecked ? '#2c2c30' : car.colour;
  rr(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = car.wrecked ? '#1d1d20' : 'rgba(20,26,34,0.85)';
  rr(ctx, -w * 0.16, -h * 0.36, w * 0.34, h * 0.72, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,240,0.5)';
  ctx.fillRect(w * 0.2, -h * 0.3, 3.4, h * 0.6);
  if (car.typeId === 'taxi') { ctx.fillStyle = '#222'; ctx.fillRect(-8, -4, 16, 8); ctx.fillStyle = '#ffd23d'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 2.4); }
  if (car.typeId === 'truck') { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-w / 2 + 4, -h / 2 + 3, w * 0.4, h - 6); }
  if (car.police) {
    ctx.fillStyle = '#274b8f';
    ctx.fillRect(-w * 0.3, -h / 2, w * 0.14, h);
    const flash = Math.floor(t * 5) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4066ff';
    ctx.fillRect(-5, -7, 10, 5);
    ctx.fillStyle = flash ? '#4066ff' : '#ff4040';
    ctx.fillRect(-5, 2, 10, 5);
  }
  if (car.marked) {
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 2.4;
    rr(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 8); ctx.stroke();
  }
  if (car.damage > 55 && !car.wrecked) {
    ctx.fillStyle = 'rgba(30,30,30,0.5)';
    ctx.beginPath(); ctx.arc(w * 0.32, 0, 6 + (car.damage - 55) / 8, 0, 6.29); ctx.fill();
  }
  ctx.restore();
  if (night > 0.25 && !car.wrecked) {
    ctx.fillStyle = `rgba(255,240,180,${0.1 * night})`;
    ctx.beginPath();
    const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
    ctx.moveTo(car.x + fx * 24, car.y + fy * 24);
    ctx.lineTo(car.x + fx * 110 - fy * 26, car.y + fy * 110 + fx * 26);
    ctx.lineTo(car.x + fx * 110 + fy * 26, car.y + fy * 110 - fx * 26);
    ctx.closePath(); ctx.fill();
  }
}

function drawCarsAndPeople(ctx, game, view, night, t) {
  const inView = (x, y, m = 90) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
  for (const car of game.cars) if (inView(car.x, car.y)) drawCar(ctx, car, night, t);
  for (const car of game.policeRef.cars) if (inView(car.x, car.y)) drawCar(ctx, car, night, t);
  for (const rv of rivalPositions(game)) {
    drawCar(ctx, { x: rv.x, y: rv.y, angle: rv.angle, type: { w: 48, h: 24 }, colour: rv.colour, typeId: 'gt', damage: 0, wrecked: false, airZ: 0, police: false }, night, t);
  }
  for (const ped of game.peds) if (inView(ped.x, ped.y, 40)) drawFigure(ctx, ped.x, ped.y, ped.angle, ped.colour, ped.walkCycle);
  for (const o of game.policeRef.officers) drawFigure(ctx, o.x, o.y, o.angle, '#274b8f', o.walkCycle, { gun: true });
  for (const e of game.enemies) drawFigure(ctx, e.x, e.y, e.angle, e.colour, e.walkCycle, { gun: e.state !== 'down', down: e.state === 'down' });
  for (const m of game.crew) if (m.state !== 'ride') drawFigure(ctx, m.x, m.y, m.angle, m.colour, m.walkCycle, { gun: true });
  const p = game.player;
  if (!p.car) {
    drawFigure(ctx, p.x, p.y, p.angle, '#1fa8a0', p.walkCycle, { gun: p.weapon !== 'fists' });
    if (p.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(p.angle) * 22, p.y - Math.cos(p.angle) * 22, 6, 0, 6.29);
      ctx.fill();
    }
  }
  // Air One
  const heli = game.policeRef.heli;
  if (heli) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(heli.x + 26, heli.y + 30, 30, 10, 0, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle + Math.PI / 2);
    ctx.fillStyle = '#22262e';
    rr(ctx, -26, -10, 52, 20, 9); ctx.fill();
    ctx.fillRect(18, -3, 30, 6);
    ctx.fillStyle = '#9fd8ef';
    rr(ctx, -20, -6, 16, 12, 4); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(240,240,240,0.8)';
    ctx.lineWidth = 3;
    const rr2 = 34 + Math.sin(t * 40) * 5;
    ctx.beginPath(); ctx.moveTo(heli.x - rr2, heli.y - 4); ctx.lineTo(heli.x + rr2, heli.y - 4); ctx.stroke();
  }
}

function drawEffects(ctx, game, view) {
  for (const pr of game.projectiles) {
    ctx.strokeStyle = pr.friendly ? 'rgba(255,226,130,0.95)' : 'rgba(255,120,90,0.95)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pr.x - pr.vx * 0.012, pr.y - pr.vy * 0.012);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();
  }
  for (const n of game.thrown) {
    ctx.fillStyle = '#2e4034';
    ctx.beginPath(); ctx.arc(n.x, n.y, 5.4, 0, 6.29); ctx.fill();
    ctx.fillStyle = Math.floor(game.elapsed * 9) % 2 ? '#ff5040' : '#701a12';
    ctx.beginPath(); ctx.arc(n.x, n.y - 4, 2, 0, 6.29); ctx.fill();
  }
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawLights(ctx, game, view, night, t) {
  // streetlight pools along the avenues
  ctx.fillStyle = `rgba(255,190,90,${0.05 * night})`;
  for (const ax of AVENUES_X) for (let y = 90; y < WATER_Y; y += 230) {
    if (ax < view.x0 || ax > view.x1 || y < view.y0 || y > view.y1) continue;
    ctx.beginPath(); ctx.arc(ax - ROAD_W / 2 - 8, y, 26, 0, 6.29); ctx.fill();
  }
  // neon on the water by the marina and boardwalk
  ctx.fillStyle = `rgba(255,93,162,${0.05 + 0.03 * Math.sin(t * 2)})`;
  ctx.fillRect(820, WATER_Y + 8, 1500, 5);
  ctx.fillStyle = `rgba(93,200,255,${0.05 + 0.03 * Math.cos(t * 1.7)})`;
  ctx.fillRect(2380, WATER_Y + 20, 720, 5);
  // the searchlight
  const heli = game.policeRef.heli;
  if (heli) {
    const p = game.player;
    const grad = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 120);
    grad.addColorStop(0, 'rgba(255,250,210,0.34)');
    grad.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(heli.x, heli.y);
    ctx.lineTo(p.x - 90, p.y + 40);
    ctx.lineTo(p.x + 90, p.y + 40);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 110, 0, 6.29); ctx.fill();
  }
}

// ---------------------------------------------------------------- HUD
function drawHud(ctx, game, W, H, night) {
  const p = game.player;
  ctx.textAlign = 'left';
  if (game.state === 'title') { drawTitle(ctx, game, W, H); return; }

  // cash + standing
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  rr(ctx, 14, 12, 208, 76, 8); ctx.fill();
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('$' + game.cash, 26, 42);
  ctx.fillStyle = '#e8ecf2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Respect ' + game.respect + ' · ' + districtAt(p.x, p.y), 26, 62);
  bar(ctx, 26, 68, 120, 7, p.health / 100, '#e2483d');
  if (p.armor > 0) bar(ctx, 152, 68, 58, 7, p.armor / 100, '#5da2e2');

  // wanted stars
  const stars = game.policeRef.stars;
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23d' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', W - 18 - (4 - i) * 24, 36);
  }
  ctx.textAlign = 'left';

  drawMinimap(ctx, game, W);

  // objective card
  const obj = currentObjective(game);
  if (obj && game.state === 'playing') {
    const d = Math.round(Math.hypot(p.x - obj.x, p.y - obj.y));
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    rr(ctx, W / 2 - 210, 12, 420, 44, 8); ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obj.job, W / 2, 30);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(obj.label + ' — ' + d + 'm', W / 2, 48);
    ctx.textAlign = 'left';
  }

  // weapon readout
  const def = WEAPONS[p.weapon];
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  rr(ctx, 14, H - 56, 208, 42, 8); ctx.fill();
  ctx.fillStyle = '#e8ecf2';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(def ? def.name : 'Fists', 26, H - 30);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23d';
  if (p.weapon !== 'fists' && p.weapon !== 'grenade') {
    const a = game.ammo[p.weapon];
    ctx.fillText(a.mag + ' / ' + a.reserve + (p.reloadT > 0 ? '  RELOADING' : ''), 130, H - 30);
  } else if (p.weapon === 'grenade') ctx.fillText('× ' + game.ammo.grenade.mag, 130, H - 30);

  // car + radio readout
  if (p.car) {
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    rr(ctx, W - 222, H - 56, 208, 42, 8); ctx.fill();
    ctx.fillStyle = '#e8ecf2';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(p.car.type.name, W - 210, H - 30);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#7dd0ff';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h · ' + STATIONS[game.station], W - 130, H - 30);
  }

  // race state
  const rs = game.raceState;
  if (rs) {
    if (rs.phase === 'count') {
      ctx.fillStyle = '#ffd23d';
      ctx.font = 'bold 92px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(rs.t)), W / 2, H / 2 - 60);
      ctx.textAlign = 'left';
    } else {
      if (rs.elapsed < 0.8) {
        ctx.fillStyle = '#8fe28f';
        ctx.font = 'bold 92px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GO!', W / 2, H / 2 - 60);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = 'rgba(10,14,20,0.55)';
      rr(ctx, W / 2 - 130, H - 56, 260, 42, 8); ctx.fill();
      ctx.fillStyle = '#ff9ec4';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rs.def.name + ' · checkpoint ' + Math.min(rs.cp + 1, 8) + '/8 · ' + rs.elapsed.toFixed(1) + 's', W / 2, H - 30);
      ctx.textAlign = 'left';
    }
  }

  // arrest meter
  if (game.arrestFill > 0.02 && game.state === 'playing') {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    rr(ctx, W / 2 - 110, H / 2 + 90, 220, 26, 6); ctx.fill();
    ctx.fillStyle = '#e2483d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARREST', W / 2, H / 2 + 82);
    bar(ctx, W / 2 - 100, H / 2 + 98, 200, 9, game.arrestFill, '#e2483d');
    ctx.textAlign = 'left';
  }

  // toasts
  ctx.textAlign = 'center';
  game.toasts.forEach((toast, i) => {
    ctx.globalAlpha = Math.min(1, toast.t);
    ctx.fillStyle = 'rgba(10,14,20,0.68)';
    const w = ctx.measureText(toast.text).width + 30;
    ctx.font = 'bold 14px system-ui, sans-serif';
    rr(ctx, W / 2 - w / 2, H - 108 - i * 30, w, 24, 6); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(toast.text, W / 2, H - 91 - i * 30);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  if (game.shop) drawShop(ctx, game, W, H);
  if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(5,8,14,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('ESC to keep driving', W / 2, H / 2 + 34);
    ctx.textAlign = 'left';
  }
  if (game.state === 'busted' || game.state === 'wasted') {
    ctx.fillStyle = 'rgba(5,8,14,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = game.state === 'busted' ? '#5da2e2' : '#e2483d';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.state === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2);
    ctx.textAlign = 'left';
  }
}

function bar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawMinimap(ctx, game, W) {
  const mw = 184, mh = 138, x0 = W - mw - 14, y0 = 48;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  rr(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.fillStyle = '#2e7ea6';
  ctx.fillRect(x0, y0 + WATER_Y * sy, mw, (WORLD_H - WATER_Y) * sy);
  ctx.fillStyle = '#4a5058';
  for (const ax of AVENUES_X) ctx.fillRect(x0 + ax * sx - 1, y0, 2, mh);
  for (const sy2 of STREETS_Y) ctx.fillRect(x0, y0 + sy2 * sy - 1, mw, 2);
  const dot = (x, y, colour, r = 3) => { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, 6.29); ctx.fill(); };
  for (const c of game.policeRef.cars) dot(c.x, c.y, '#ff5040', 2.4);
  for (const m of game.crew) dot(m.x, m.y, '#8fe28f', 2.6);
  const obj = currentObjective(game);
  if (obj) dot(obj.x, obj.y, '#ffd23d', 3.6);
  const p = game.player;
  dot(p.x, p.y, '#ffffff', 3.6);
  ctx.fillStyle = 'rgba(232,236,242,0.85)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(districtAt(p.x, p.y), x0 + 4, y0 + mh - 5);
}

function drawShop(ctx, game, W, H) {
  const weapons = game.shop === 'weapons';
  ctx.fillStyle = 'rgba(5,8,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  const pw = 430, ph = weapons ? 356 : 252;
  const x = W / 2 - pw / 2, y = H / 2 - ph / 2;
  ctx.fillStyle = 'rgba(14,20,30,0.96)';
  rr(ctx, x, y, pw, ph, 12); ctx.fill();
  ctx.strokeStyle = weapons ? '#ffd23d' : '#7dd0ff';
  ctx.lineWidth = 2;
  rr(ctx, x, y, pw, ph, 12); ctx.stroke();
  ctx.fillStyle = weapons ? '#ffd23d' : '#7dd0ff';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText(weapons ? 'SERENA MUNITIONS' : 'SERENA CUSTOMS', x + 22, y + 36);
  ctx.fillStyle = '#e8ecf2';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Cash $' + game.cash + ' — press a number, ESC to leave', x + 22, y + 58);
  const rows = weapons
    ? [
        ['1', 'Harbor Pistol', '$180', game.weaponsOwned.pistol ? 'owned' : 'slot 1'],
        ['2', 'Calle SMG', '$420', game.weaponsOwned.smg ? 'owned' : 'slot 2 · full auto'],
        ['3', 'Pier Shotgun', '$650', game.weaponsOwned.shotgun ? 'owned' : 'slot 3 · 6 pellets'],
        ['4', 'Grenades ×3', '$90', 'slot 4 · 0.75s fuse'],
        ['5', 'Ammo refill', '$60', 'all reserves topped'],
        ['6', 'Medkit', '$50', 'health to full'],
        ['7', 'Window tint', '—', 'sold out, forever'],
        ['8', 'Kevlar vest', '$150', 'armor 100 · soaks 65%'],
      ]
    : GARAGE_ITEMS.map((it, i) => [String(i + 1), it.name, '$' + it.price, it.key === 'repair' ? it.blurb : (game.mods[it.key] ? 'fitted' : it.blurb)]);
  rows.forEach((row, i) => {
    const ry = y + 88 + i * 30;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    rr(ctx, x + 16, ry - 17, pw - 32, 26, 5); ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(row[0], x + 26, ry);
    ctx.fillStyle = '#e8ecf2';
    ctx.fillText(row[1], x + 52, ry);
    ctx.fillStyle = '#8fe28f';
    ctx.fillText(row[2], x + 236, ry);
    ctx.fillStyle = 'rgba(232,236,242,0.6)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(row[3], x + 300, ry);
  });
}

function drawTitle(ctx, game, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(8,10,26,0.25)');
  grad.addColorStop(0.62, 'rgba(8,10,26,0.05)');
  grad.addColorStop(1, 'rgba(8,10,26,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText('VICE HARBOR', W / 2, H * 0.34);
  ctx.fillStyle = '#ff5da2';
  ctx.font = 'bold 27px system-ui, sans-serif';
  ctx.fillText('— PORT SERENA —', W / 2, H * 0.34 + 42);
  ctx.fillStyle = 'rgba(240,244,250,0.92)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Eight jobs for Auntie Bea. One city that wants you stopped.', W / 2, H * 0.34 + 72);
  const bw = 230, bh = 46;
  const bx = W / 2 - bw / 2;
  const by1 = H * 0.58, by2 = by1 + 60;
  game.titleButtons = [{ id: 'play', x: bx, y: by1, w: bw, h: bh }];
  ctx.fillStyle = '#e2483d';
  rr(ctx, bx, by1, bw, bh, 9); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('PLAY NOW', W / 2, by1 + 30);
  if (game.hasSave) {
    game.titleButtons.push({ id: 'continue', x: bx, y: by2, w: bw, h: bh });
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    rr(ctx, bx, by2, bw, bh, 9); ctx.fill();
    ctx.strokeStyle = '#7dd0ff';
    ctx.stroke();
    ctx.fillStyle = '#7dd0ff';
    ctx.fillText('CONTINUE', W / 2, by2 + 30);
  }
  ctx.fillStyle = 'rgba(240,244,250,0.75)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText('WASD drive · E interact · J shoot / race · Q reload · 1–5 weapons · C crew · N radio · ESC pause', W / 2, H - 26);
  ctx.textAlign = 'left';
}
