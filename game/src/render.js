// Canvas renderer for Port Serena.
// Draws the whole city top-down with a day-night grade, then the HUD:
// wanted stars, cash, health, minimap, objective arrow and banners.

import { WORLD } from './config.js';
import { world } from './world.js';
import { daylight, isNight } from './game.js';
import { police } from './police.js';
import { currentStep, currentJob, missions, objectiveDistance } from './missions.js';

const VIEW_W = 960;
const VIEW_H = 600;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, game) {
  const cam = game.camera;
  const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const ox = cam.x - VIEW_W / 2 + shakeX;
  const oy = cam.y - VIEW_H / 2 + shakeY;
  const light = daylight(game.hour);
  const night = isNight(game.hour);

  ctx.save();
  ctx.translate(-ox, -oy);
  drawGround(ctx, game, light, ox, oy);
  drawWorldProps(ctx, game, light, night, ox, oy);
  drawSkids(ctx, game);
  drawObjectivePillar(ctx, game);
  for (const car of game.cars) drawVehicle(ctx, car, game, night, false);
  for (const car of police.cars) drawVehicle(ctx, car, game, night, true);
  for (const o of police.officers) drawOfficer(ctx, o);
  for (const ped of game.peds) drawPed(ctx, ped, game);
  if (!game.player.car) drawPlayer(ctx, game);
  drawParticles(ctx, game);
  if (police.heli) drawHelicopter(ctx, police.heli, game);
  ctx.restore();

  // Night grade + headlight glow pass.
  if (light < 0.85) {
    ctx.fillStyle = `rgba(8, 12, 38, ${(0.85 - light) * 0.52})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawLights(ctx, game, ox, oy);
  }

  drawVignette(ctx);
  if (game.state === 'title') drawTitle(ctx, game);
  else {
    drawHud(ctx, game);
    if (game.state === 'paused') drawPause(ctx);
    if (game.state === 'busted') drawEndCard(ctx, 'BUSTED', '#4f8ff7', `Fine paid: $${game.lastFine}. The SPD lets Rio walk — this time.`);
    if (game.state === 'wasted') drawEndCard(ctx, 'WASTED', '#e5484d', `Harbor Clinic bill: $${game.lastClinicFee}. Rio wakes up patched and poorer.`);
  }
}

// --- world ----------------------------------------------------------------

function drawGround(ctx, game, light, ox, oy) {
  // Base grass / city fill.
  const g = ctx.createLinearGradient(ox, oy, ox, oy + VIEW_H);
  g.addColorStop(0, '#4a6741');
  g.addColorStop(1, '#3c5a3a');
  ctx.fillStyle = g;
  ctx.fillRect(ox - 20, oy - 20, VIEW_W + 40, VIEW_H + 40);

  // District tints.
  for (const d of gameDistricts()) {
    ctx.fillStyle = d.tint;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.globalAlpha = 1;
  }

  // Beach + ocean + islet.
  const b = world.beach, oc = world.ocean;
  ctx.fillStyle = '#e8d194';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const og = ctx.createLinearGradient(0, oc.y, 0, oc.y + oc.h);
  og.addColorStop(0, '#2e7fb8');
  og.addColorStop(1, '#175d8f');
  ctx.fillStyle = og;
  ctx.fillRect(oc.x, oc.y, oc.w, oc.h);
  // Animated surf line.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 40) {
    const y = oc.y + 6 + Math.sin(x * 0.02 + game.time * 1.4) * 4;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Islet + causeway.
  ctx.fillStyle = '#e8d194';
  ctx.fillRect(world.islet.x, world.islet.y, world.islet.w, world.islet.h);
  ctx.fillStyle = '#6b6f75';
  ctx.fillRect(world.islet.x + 130, world.islet.y - 210, 26, 210);

  // Roads: asphalt with edge lines and dashes.
  ctx.fillStyle = '#3d4148';
  for (const rx of world.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, 1700);
  for (const ry of world.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
  ctx.strokeStyle = 'rgba(240,240,220,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 20]);
  for (const rx of world.roadsX) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, 1700); ctx.stroke();
  }
  for (const ry of world.roadsY) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); ctx.stroke();
  }
  ctx.setLineDash([]);
  void light;
}

function gameDistricts() {
  // Local copy of district rects to avoid a config import cycle in render.
  return [
    { x: 0, y: 0, w: 1100, h: 900, tint: '#3a2f28' },
    { x: 1100, y: 0, w: 1000, h: 900, tint: '#2e3b2a' },
    { x: 2100, y: 0, w: 1100, h: 900, tint: '#2b3040' },
    { x: 0, y: 900, w: 1100, h: 750, tint: '#24343e' },
    { x: 1100, y: 900, w: 1000, h: 750, tint: '#3d3424' },
    { x: 2100, y: 900, w: 1100, h: 750, tint: '#33302a' },
  ];
}

function drawWorldProps(ctx, game, light, night, ox, oy) {
  // Buildings with simple shaded roofs and night windows.
  for (const b of world.buildings) {
    if (b.x + b.w < ox - 60 || b.x > ox + VIEW_W + 60 || b.y + b.h < oy - 60 || b.y > oy + VIEW_H + 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = `hsl(${b.hue}, 26%, ${30 + (b.floors * 3)}%)`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    // Window grid.
    const cols = Math.floor(b.w / 22), rows = Math.floor(b.h / 22);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = night && ((i * 7 + j * 13 + b.hue) % 5 === 0);
        ctx.fillStyle = lit ? 'rgba(255, 214, 120, 0.95)' : 'rgba(16,20,28,0.5)';
        ctx.fillRect(b.x + 8 + i * 22, b.y + 8 + j * 22, 10, 12);
      }
    }
    if (b.name && b.w > 90) {
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (night) {
        // Neon signage after dark: named businesses glow in a hue
        // rolled from the building itself, drawn twice for intensity.
        const neon = `hsl(${(b.hue + 140) % 360}, 95%, 68%)`;
        ctx.save();
        ctx.shadowColor = neon;
        ctx.shadowBlur = 13;
        ctx.fillStyle = neon;
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 6);
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 6);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 6);
      }
    }
  }
  // Palms.
  for (const p of world.palms) {
    if (p.x < ox - 40 || p.x > ox + VIEW_W + 40 || p.y < oy - 40 || p.y > oy + VIEW_H + 40) continue;
    ctx.strokeStyle = '#6d4c2f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + p.lean * 14, p.y - 10 * p.s, p.x + p.lean * 22, p.y - 17 * p.s);
    ctx.stroke();
    ctx.strokeStyle = '#3f9e4d';
    ctx.lineWidth = 2.4;
    const tx = p.x + p.lean * 22, ty = p.y - 17 * p.s;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + p.lean;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * 10, ty + Math.sin(a) * 6 - 3, tx + Math.cos(a) * 17, ty + Math.sin(a) * 11 + 3);
      ctx.stroke();
    }
  }
  // Dock crates.
  for (const c of world.props) {
    ctx.fillStyle = `hsl(${c.hue}, 38%, 38%)`;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  }
  // Pier Nine deck.
  const pier = world.pier;
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(60,40,20,0.6)';
  for (let y = pier.y + 18; y < pier.y + pier.h; y += 22) {
    ctx.beginPath(); ctx.moveTo(pier.x, y); ctx.lineTo(pier.x + pier.w, y); ctx.stroke();
  }
  void light; void game;
}

function drawSkids(ctx, game) {
  ctx.fillStyle = 'rgba(12,12,14,0.5)';
  for (const s of game.skidmarks) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(0.5, s.life * 0.2);
    ctx.fillRect(-7, -3, 4, 14);
    ctx.fillRect(3, -3, 4, 14);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawObjectivePillar(ctx, game) {
  const step = currentStep();
  if (!step || game.state === 'title') return;
  const pulse = 0.65 + Math.sin(game.time * 4) * 0.25;
  const grad = ctx.createLinearGradient(0, step.y - 260, 0, step.y);
  grad.addColorStop(0, 'rgba(255, 209, 102, 0)');
  grad.addColorStop(1, `rgba(255, 209, 102, ${0.5 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(step.x - 13, step.y - 260, 26, 260);
  ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(step.x, step.y, step.r * 0.62 + Math.sin(game.time * 4) * 3, 0, Math.PI * 2);
  ctx.stroke();
}

// --- actors ---------------------------------------------------------------

export function drawVehicleShape(ctx, car, game, isPolice) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -m.w / 2 + 3, -m.h / 2 + 5, m.w, m.h, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.w / 2, -m.h / 2, m.w, m.h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Cabin + glass.
  ctx.fillStyle = 'rgba(18, 24, 34, 0.88)';
  roundRect(ctx, -m.w / 2 + 5, -m.h * 0.16, m.w - 10, m.h * 0.34, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140, 190, 230, 0.5)';
  roundRect(ctx, -m.w / 2 + 6, -m.h * 0.30, m.w - 12, m.h * 0.12, 3);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#101216';
  const ww = 5, wh = 11;
  ctx.fillRect(-m.w / 2 - 2, -m.h / 2 + 7, ww, wh);
  ctx.fillRect(m.w / 2 - 3, -m.h / 2 + 7, ww, wh);
  ctx.fillRect(-m.w / 2 - 2, m.h / 2 - 18, ww, wh);
  ctx.fillRect(m.w / 2 - 3, m.h / 2 - 18, ww, wh);
  // Lights.
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(-m.w / 2 + 4, -m.h / 2 + 1, 7, 3);
  ctx.fillRect(m.w / 2 - 11, -m.h / 2 + 1, 7, 3);
  ctx.fillStyle = car.brakeLight ? '#ff2d2d' : '#a31621';
  ctx.fillRect(-m.w / 2 + 4, m.h / 2 - 4, 7, 3);
  ctx.fillRect(m.w / 2 - 11, m.h / 2 - 4, 7, 3);
  if (car.model.id === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -m.h * 0.02, 16, 9);
    ctx.fillStyle = '#f7c948';
    ctx.font = '700 7px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 5);
  }
  if (isPolice) {
    ctx.fillStyle = '#12233d';
    ctx.fillRect(-m.w / 2, -6, m.w, 15);
    ctx.fillStyle = '#fff';
    ctx.font = '700 8px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', 0, 5);
    // Flashing lightbar.
    const phase = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#3b82f6';
    ctx.fillRect(-m.w / 2 + 3, -m.h * 0.24, m.w / 2 - 4, 6);
    ctx.fillStyle = phase ? '#3b82f6' : '#ff3b30';
    ctx.fillRect(1, -m.h * 0.24, m.w / 2 - 4, 6);
  }
  if (car.isMissionCar) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.4;
    roundRect(ctx, -m.w / 2 - 3, -m.h / 2 - 3, m.w + 6, m.h + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVehicle(ctx, car, game, night, isPolice) {
  drawVehicleShape(ctx, car, game, isPolice);
  void night;
}

function drawPerson(ctx, x, y, angle, shirt, skin, walkCycle, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bob = walkCycle ? Math.sin(walkCycle) * 1.6 : 0;
  // Legs.
  ctx.strokeStyle = '#23262b';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.lineTo(-3.4, 9 + bob);
  ctx.moveTo(0, 3);
  ctx.lineTo(3.4, 9 - bob);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -2.5, 4.6, 0, Math.PI * 2);
  ctx.fill();
  if (o.badge) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-1.6, -1, 3.2, 3.2);
  }
  if (o.punch) {
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(5, -2);
    ctx.lineTo(11, -9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped, game) {
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -13, -5, 26, 10, 5);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(15, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const cycle = ped.speed > 4 ? game.time * 11 + ped.id : 0;
  drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, cycle, {});
}

function drawOfficer(ctx, o) {
  drawPerson(ctx, o.x, o.y, o.angle, '#1d3a5f', '#e0ac69', performance.now() / 90, { badge: true });
}

function drawPlayer(ctx, game) {
  const p = game.player;
  drawPerson(ctx, p.x, p.y, p.angle, '#e63946', '#f1c27d', p.walkCycle, { punch: p.punchAnim > 0.3 });
  // Name tag.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('RIO', p.x, p.y - 17);
}

function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawHelicopter(ctx, heli, game) {
  // Searchlight cone first (under the body).
  const grad = ctx.createRadialGradient(heli.spotX, heli.spotY, 8, heli.spotX, heli.spotY, 95);
  grad.addColorStop(0, 'rgba(255, 244, 190, 0.5)');
  grad.addColorStop(1, 'rgba(255, 244, 190, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(heli.spotX, heli.spotY, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,190,0.25)';
  ctx.beginPath();
  ctx.moveTo(heli.x, heli.y);
  ctx.lineTo(heli.spotX - 40, heli.spotY);
  ctx.lineTo(heli.spotX + 40, heli.spotY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,244,190,0.10)';
  ctx.fill();

  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(4, 6, 17, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22262e';
  ctx.beginPath(); ctx.ellipse(0, 0, 14, 27, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-3, 22, 6, 24); // tail boom
  ctx.fillStyle = 'rgba(150,200,235,0.75)';
  ctx.beginPath(); ctx.ellipse(0, -13, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Rotor blur, spinning with time.
  ctx.strokeStyle = 'rgba(220,225,230,0.5)';
  ctx.lineWidth = 2.4;
  const ra = game.time * 31;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * -34, Math.sin(ra) * -8);
  ctx.lineTo(Math.cos(ra) * 34, Math.sin(ra) * 8);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 8px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('SPD AIR', 0, 4);
  ctx.restore();
}

function drawLights(ctx, game, ox, oy) {
  // Headlight cones for moving cars + street lamp pools, additive-ish.
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.globalCompositeOperation = 'lighter';
  const p = game.player;
  const cars = p.car ? [...game.cars, ...police.cars] : [...game.cars, ...police.cars];
  for (const car of cars) {
    if (car.parked && car !== p.car) continue;
    const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
    const hx = car.x + fx * 30, hy = car.y + fy * 30;
    const grad = ctx.createRadialGradient(hx, hy, 4, hx, hy, 74);
    grad.addColorStop(0, 'rgba(255, 240, 180, 0.20)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(hx, hy, 74, 0, Math.PI * 2); ctx.fill();
  }
  for (const l of world.lamps) {
    if (l.x < ox - 60 || l.x > ox + VIEW_W + 60 || l.y < oy - 60 || l.y > oy + VIEW_H + 60) continue;
    const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 44);
    grad.addColorStop(0, 'rgba(255, 205, 110, 0.20)');
    grad.addColorStop(1, 'rgba(255, 205, 110, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(l.x, l.y, 44, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.86);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// --- HUD ------------------------------------------------------------------

function drawHud(ctx, game) {
  const p = game.player;
  // Top-left: wanted stars + cash block.
  ctx.fillStyle = 'rgba(10, 13, 20, 0.62)';
  roundRect(ctx, 12, 12, 208, 74, 10);
  ctx.fill();
  ctx.font = '22px system-ui';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < police.stars ? '#ffd60a' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', 20 + i * 27, 40);
  }
  ctx.fillStyle = '#7bf1a8';
  ctx.font = '700 19px system-ui';
  ctx.fillText(`$${game.cash}`, 20, 68);
  ctx.fillStyle = '#ffd166';
  ctx.font = '600 13px system-ui';
  ctx.fillText(`Respect ${game.respect}`, 118, 68);
  // Arrest meter under the stars when filling.
  if (police.arrest > 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(20, 46, 120, 5);
    ctx.fillStyle = '#4f8ff7';
    ctx.fillRect(20, 46, 120 * police.arrest, 5);
  }

  // Top-right: clock + district + health/speed.
  ctx.fillStyle = 'rgba(10, 13, 20, 0.62)';
  roundRect(ctx, VIEW_W - 196, 12, 184, 74, 10);
  ctx.fill();
  const hh = Math.floor(game.hour);
  const mm = Math.floor((game.hour - hh) * 60);
  ctx.fillStyle = '#fff';
  ctx.font = '700 17px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${game.dayCount}`, VIEW_W - 24, 38);
  ctx.fillStyle = '#a8dadc';
  ctx.font = '600 13px system-ui';
  ctx.fillText(game.districtName, VIEW_W - 24, 58);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(VIEW_W - 172, 66, 148, 8);
  ctx.fillStyle = p.health > 30 ? '#57cc5e' : '#e5484d';
  ctx.fillRect(VIEW_W - 172, 66, 148 * Math.max(0, p.health) / 100, 8);

  // Bottom-left: speed + vehicle name while driving.
  if (p.car) {
    ctx.fillStyle = 'rgba(10, 13, 20, 0.62)';
    roundRect(ctx, 12, VIEW_H - 64, 196, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, 22, VIEW_H - 32);
    ctx.fillStyle = '#a8dadc';
    ctx.font = '600 12px system-ui';
    ctx.fillText(p.car.model.name + (missions.passengerAboard ? ' · Lulu aboard' : ''), 118, VIEW_H - 32);
  }

  // Job panel (bottom centre-left).
  const job = currentJob();
  const step = currentStep();
  if (job && step && game.state === 'playing') {
    ctx.fillStyle = 'rgba(10, 13, 20, 0.66)';
    roundRect(ctx, 224, VIEW_H - 84, 400, 72, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`JOB ${missions.jobIndex + 1}/6 · ${job.title}`, 236, VIEW_H - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui';
    ctx.fillText(step.label, 236, VIEW_H - 40);
    ctx.fillStyle = '#a8dadc';
    ctx.font = '600 12px system-ui';
    let extra = `Objective ${objectiveDistance(game)} m`;
    if (missions.timerMax > 0) extra += ` · ⏱ ${Math.ceil(missions.timer)}s`;
    if (step.mode === 'car') extra += ' · 🚗';
    if (step.mode === 'foot') extra += ' · on foot';
    ctx.fillText(extra, 236, VIEW_H - 22);
  } else if (missions.done) {
    ctx.fillStyle = 'rgba(10, 13, 20, 0.66)';
    roundRect(ctx, 224, VIEW_H - 64, 360, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#7bf1a8';
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Free roam — all of Bea\'s jobs are done.', 236, VIEW_H - 32);
  }

  // Banner / message line.
  if (game.bannerT > 0 && game.bannerText) {
    ctx.font = '700 16px system-ui';
    const w = Math.min(760, ctx.measureText(game.bannerText).width + 36);
    ctx.fillStyle = 'rgba(10, 13, 20, 0.78)';
    roundRect(ctx, (VIEW_W - w) / 2, 96, w, 36, 9);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(game.bannerText, VIEW_W / 2, 120);
  }

  // District banner.
  if (game.districtBannerT > 0) {
    ctx.globalAlpha = Math.min(1, game.districtBannerT);
    ctx.fillStyle = '#fff';
    ctx.font = '800 30px system-ui';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(game.districtName.toUpperCase(), VIEW_W / 2, 168);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, game);
  drawEdgeArrow(ctx, game);
}

function drawMinimap(ctx, game) {
  const mw = 168, mh = 126;
  const x0 = VIEW_W - mw - 12, y0 = VIEW_H - mh - 12;
  ctx.fillStyle = 'rgba(10, 16, 14, 0.78)';
  roundRect(ctx, x0, y0, mw, mh, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  const sx = mw / WORLD.width, sy = mh / WORLD.height;
  // Ocean strip.
  ctx.fillStyle = '#175d8f';
  ctx.fillRect(x0, y0 + 1840 * sy, mw, (WORLD.height - 1840) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 1;
  for (const rx of world.roadsX) { ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke(); }
  for (const ry of world.roadsY) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke(); }
  // Traffic dots.
  ctx.fillStyle = '#cfd8dc';
  for (const car of game.cars) ctx.fillRect(x0 + car.x * sx - 1, y0 + car.y * sy - 1, 2.4, 2.4);
  // Police dots.
  ctx.fillStyle = '#4f8ff7';
  for (const car of police.cars) ctx.fillRect(x0 + car.x * sx - 1.6, y0 + car.y * sy - 1.6, 3.4, 3.4);
  if (police.heli) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x0 + police.heli.x * sx - 1.6, y0 + police.heli.y * sy - 1.6, 3.4, 3.4);
  }
  // Objective.
  const step = currentStep();
  if (step) {
    const pulse = 2.4 + Math.sin(game.time * 5) * 0.9;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x0 + step.x * sx, y0 + step.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player.
  const p = game.player;
  ctx.fillStyle = '#ff4757';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawEdgeArrow(ctx, game) {
  const step = currentStep();
  if (!step || game.state !== 'playing') return;
  const p = game.player;
  const dx = step.x - p.x, dy = step.y - p.y;
  const d = Math.hypot(dx, dy);
  // Only show when the objective is off-screen.
  if (Math.abs(dx) < VIEW_W / 2 - 30 && Math.abs(dy) < VIEW_H / 2 - 30) return;
  const a = Math.atan2(dy, dx);
  const cx = VIEW_W / 2 + Math.cos(a) * (VIEW_W / 2 - 56);
  const cy = VIEW_H / 2 + Math.sin(a) * (VIEW_H / 2 - 56);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(d)} m`, cx, cy + 26);
}

// --- screens --------------------------------------------------------------

function drawTitle(ctx, game) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(20, 10, 40, 0.42)');
  grad.addColorStop(1, 'rgba(6, 8, 16, 0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5e78';
  ctx.font = '900 64px system-ui';
  ctx.shadowColor = 'rgba(255, 94, 120, 0.55)';
  ctx.shadowBlur = 22;
  ctx.fillText('VICE HARBOR', VIEW_W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 25px system-ui';
  ctx.fillText('— PORT SERENA —', VIEW_W / 2, 208);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '15px system-ui';
  ctx.fillText('An original top-down open-world caper. Six jobs for Auntie Bea,', VIEW_W / 2, 248);
  ctx.fillText('one borrowed Solano, and the whole Serena Police Department in the way.', VIEW_W / 2, 270);

  game.uiButtons = [];
  const bx = VIEW_W / 2 - 110, bw = 220, bh = 52;
  // PLAY NOW
  ctx.fillStyle = '#e63946';
  roundRect(ctx, bx, 308, bw, bh, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 20px system-ui';
  ctx.fillText('PLAY NOW', VIEW_W / 2, 341);
  game.uiButtons.push({ id: 'play', x: bx, y: 308, w: bw, h: bh });
  // CONTINUE (only with a save)
  if (game.hasSave()) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, bx, 372, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText('CONTINUE', VIEW_W / 2, 405);
    game.uiButtons.push({ id: 'continue', x: bx, y: 372, w: bw, h: bh });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12.5px system-ui';
  ctx.fillText('WASD / arrows drive · E enter car · Space brake · J punch · R reset · P pause', VIEW_W / 2, 470);
  ctx.fillText('Procedural canvas art · synthesized audio · no downloads, no assets', VIEW_W / 2, 492);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = '800 36px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 12);
  ctx.font = '15px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Press P or Esc to keep rolling.', VIEW_W / 2, VIEW_H / 2 + 22);
}

function drawEndCard(ctx, word, color, sub) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = color;
  ctx.font = '900 62px system-ui';
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillText(word, VIEW_W / 2, VIEW_H / 2 - 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px system-ui';
  ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 28);
}
