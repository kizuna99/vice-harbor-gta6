// render.js — everything the player sees, drawn with Canvas 2D only.
// Port Serena is fully procedural: roads, buildings, palms, neon, headlight
// cones and the helicopter searchlight are all vector shapes whose look
// shifts with the day–night clock.

import { CFG } from './config.js';
import { clamp, dist } from './random.js';
import { world, DISTRICTS } from './world.js';

// 0 = deep night, 1 = full day.
export function daylight(hour) {
  const t = Math.sin(((hour - 6) / 12) * Math.PI);
  return clamp(t * 1.6, 0, 1);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(game, ctx, W, H) {
  const p = game.player;
  const day = daylight(game.hour);
  const dusk = clamp(1 - Math.abs(day - 0.45) * 2.4, 0, 1); // golden band
  const shakeX = game.camera.shake ? (Math.random() * 2 - 1) * game.camera.shake : 0;
  const shakeY = game.camera.shake ? (Math.random() * 2 - 1) * game.camera.shake : 0;
  const camX = game.camera.x - W / 2 + shakeX;
  const camY = game.camera.y - H / 2 + shakeY;

  // Sky-tinted ground wash (also the letterbox colour).
  ctx.fillStyle = mix('#0d1b2e', '#20344d', day);
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camX, -camY);
  drawWorld(game, ctx, camX, camY, W, H, day, dusk);
  drawObjective(game, ctx, day);
  drawSkids(game, ctx);
  for (const car of game.vehicles) drawVehicle(game, ctx, car, day);
  for (const ped of game.peds) drawPed(game, ctx, ped);
  if (!p.inCar) drawPlayer(game, ctx);
  drawParticles(game, ctx);
  drawHelicopter(game, ctx, day);
  ctx.restore();

  // Night grading + dusk warmth over the whole frame.
  if (day < 0.98) {
    ctx.fillStyle = `rgba(8, 10, 38, ${(1 - day) * 0.34})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (dusk > 0.05) {
    ctx.fillStyle = `rgba(255, 138, 61, ${dusk * 0.10})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(220, 30, 60, ${p.hurtFlash * 0.9})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (game.screen === 'title') { drawTitle(game, ctx, W, H, day); return; }
  drawHUD(game, ctx, W, H, day);
  if (game.screen === 'pause') drawPause(game, ctx, W, H);
  if (game.screen === 'busted') drawEndScreen(game, ctx, W, H, 'BUSTED', 'The SPD got their collar. Harbor Clinic patched you up — for a fee.', '#4ea8de');
  if (game.screen === 'wasted') drawEndScreen(game, ctx, W, H, 'WASTED', 'Harbor Clinic dragged you back. The bill stings more than the fall.', '#ef476f');
}

function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function drawWorld(game, ctx, camX, camY, W, H, day, dusk) {
  // District ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = mix(shade(d.tint, -46), d.tint, day);
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Beach sand and ocean on the east edge.
  ctx.fillStyle = mix('#8a6d3b', '#e9d8a6', day);
  ctx.fillRect(world.beachX, 0, CFG.worldW - world.beachX, CFG.worldH);
  const waterGrad = ctx.createLinearGradient(3060, 0, CFG.worldW, 0);
  waterGrad.addColorStop(0, mix('#0a2e4a', '#219ebc', day));
  waterGrad.addColorStop(1, mix('#06182b', '#126782', day));
  ctx.fillStyle = waterGrad;
  ctx.fillRect(3072, 0, CFG.worldW - 3072, CFG.worldH);
  // Gentle wave lines.
  ctx.strokeStyle = `rgba(255,255,255,${0.10 + day * 0.12})`;
  ctx.lineWidth = 2;
  for (let y = 60; y < CFG.worldH; y += 90) {
    ctx.beginPath();
    ctx.moveTo(3084, y + Math.sin(game.time * 0.7 + y) * 4);
    ctx.lineTo(CFG.worldW - 8, y + Math.cos(game.time * 0.6 + y) * 4);
    ctx.stroke();
  }
  void dusk;

  // Roads: avenues, streets and Ocean Drive, with dashed centre lines.
  ctx.fillStyle = mix('#23252d', '#3a3d46', day);
  for (const ax of world.avenues) ctx.fillRect(ax - CFG.roadW / 2, 0, CFG.roadW, CFG.worldH);
  for (const sy of world.streets) ctx.fillRect(0, sy - CFG.roadW / 2, CFG.worldW, CFG.roadW);
  ctx.fillRect(world.oceanDriveX - CFG.roadW / 2, 0, CFG.roadW, CFG.worldH);
  ctx.strokeStyle = `rgba(255, 209, 102, ${0.25 + day * 0.4})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const ax of world.avenues) { ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, CFG.worldH); ctx.stroke(); }
  for (const sy of world.streets) { ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(CFG.worldW, sy); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(world.oceanDriveX, 0); ctx.lineTo(world.oceanDriveX, CFG.worldH); ctx.stroke();
  ctx.setLineDash([]);

  // Pier deck and causeway islet.
  ctx.fillStyle = mix('#6d4c41', '#a98467', day);
  ctx.fillRect(world.pier.x, world.pier.y, world.pier.w, world.pier.h);
  ctx.fillStyle = mix('#7a6a53', '#b7a98a', day);
  ctx.fillRect(world.islet.x, world.islet.y, world.islet.w, world.islet.h);

  // Viewport culling window.
  const vx0 = camX - 80, vy0 = camY - 80, vx1 = camX + W + 80, vy1 = camY + H + 80;

  // Buildings with flat roofs, shadows, and windows that light up at night.
  for (const b of world.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = mix(shade(b.color, -60), b.color, day);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Window grid.
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lit = ((i * 7 + j * 13 + b.floors) % 5) < (day > 0.5 ? 1 : 3);
        ctx.fillStyle = lit && day <= 0.5 ? 'rgba(255, 214, 110, 0.9)' : 'rgba(20, 26, 40, 0.35)';
        ctx.fillRect(b.x + 8 + i * 24, b.y + 8 + j * 24, 11, 9);
      }
    }
    if (b.neon && day < 0.6) {
      ctx.fillStyle = `rgba(255, 93, 143, ${0.55 + Math.sin(game.time * 3 + b.x) * 0.25})`;
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText(b.name.toUpperCase(), b.x + 6, b.y + 16);
    }
  }

  // Palms: trunk dot + frond star.
  for (const palm of world.palms) {
    if (palm.x < vx0 || palm.x > vx1 || palm.y < vy0 || palm.y > vy1) continue;
    ctx.strokeStyle = mix('#4a3520', '#7a5c33', day);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 4, palm.y - 6); ctx.stroke();
    ctx.strokeStyle = mix('#1d5c38', '#2e9e5b', day);
    ctx.lineWidth = 2.4;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(palm.x + 4, palm.y - 6);
      ctx.lineTo(palm.x + 4 + Math.cos(a) * 15, palm.y - 6 + Math.sin(a) * 11);
      ctx.stroke();
    }
  }
  // Props: crates, barrels, benches as simple blocks.
  for (const pr of world.props) {
    if (pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
    ctx.fillStyle = pr.kind === 'crate' ? '#9c6644' : pr.kind === 'barrel' ? '#606c7a' : '#5f6c5d';
    ctx.fillRect(pr.x - 6, pr.y - 6, 12, 12);
  }
  // Anchor labels.
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${0.35 + day * 0.3})`;
  for (const key of Object.keys(world.anchors)) {
    const a = world.anchors[key];
    ctx.fillText(a.label, a.x - 30, a.y - 12);
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawObjective(game, ctx, day) {
  const obj = game.missions.getObjective();
  if (!obj || game.screen !== 'play') return;
  const pulse = 1 + Math.sin(game.time * 5) * 0.16;
  // Light pillar so the goal reads from streets away.
  const grad = ctx.createLinearGradient(0, obj.y - 190, 0, obj.y);
  grad.addColorStop(0, 'rgba(255, 209, 102, 0)');
  grad.addColorStop(1, `rgba(255, 209, 102, ${0.30 + (1 - day) * 0.2})`);
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 9, obj.y - 190, 18, 190);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.r * 0.55 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 6, 0, Math.PI * 2); ctx.fill();
}

function drawSkids(game, ctx) {
  ctx.fillStyle = 'rgba(12,12,14,0.5)';
  for (const sk of game.skids) {
    ctx.save();
    ctx.translate(sk.x, sk.y); ctx.rotate(sk.angle);
    ctx.globalAlpha = clamp(sk.life / 6, 0, 0.55);
    ctx.fillRect(-9, -3, 18, 6);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawVehicle(game, ctx, car, day) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const { w, h } = car.model;
  // Headlight cones after dark.
  if (day < 0.55) {
    const grad = ctx.createLinearGradient(w / 2, 0, w / 2 + 120, 0);
    grad.addColorStop(0, 'rgba(255, 240, 180, 0.30)');
    grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w / 2, -7); ctx.lineTo(w / 2 + 120, -26); ctx.lineTo(w / 2 + 120, 26); ctx.lineTo(w / 2, 7);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 6); ctx.fill();
  ctx.fillStyle = car.kind === 'police' ? '#edf2f4' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#14213d';
    ctx.fillRect(-w * 0.18, -h / 2, w * 0.36, h);
    // Flashing lightbar.
    const phase = Math.sin(game.time * 14 + car.lightPhase) > 0;
    ctx.fillStyle = phase ? '#ff2e4d' : '#2e6bff';
    ctx.fillRect(-5, -h / 2 - 3, 10, 5);
    ctx.fillStyle = phase ? '#2e6bff' : '#ff2e4d';
    ctx.fillRect(-5, h / 2 - 2, 10, 5);
  }
  if (car.modelId === 'taxi') {
    ctx.fillStyle = '#14213d';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.fillText('TAXI', -11, 3);
  }
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(16, 24, 40, 0.85)';
  roundRect(ctx, -w * 0.16, -h * 0.36, w * 0.34, h * 0.72, 4); ctx.fill();
  ctx.fillStyle = 'rgba(140, 200, 240, 0.5)';
  ctx.fillRect(w * 0.10, -h * 0.30, 4, h * 0.6);
  // Wheels.
  ctx.fillStyle = '#101216';
  for (const [wx, wy] of [[-w / 2 + 7, -h / 2 - 1], [w / 2 - 7, -h / 2 - 1], [-w / 2 + 7, h / 2 - 3], [w / 2 - 7, h / 2 - 3]]) {
    ctx.fillRect(wx - 4, wy, 8, 4);
  }
  ctx.restore();
  // Mission target ring on the marked car.
  if (game.missions.missionCar === car) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(car.x, car.y, 40 + Math.sin(game.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawPed(game, ctx, ped) {
  if (ped.isPassenger) return;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d5c4';
    ctx.beginPath(); ctx.arc(10, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(2, 3, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.role === 'officer' ? '#274690' : ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2d5c4';
  ctx.beginPath(); ctx.arc(3.5, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  if (ped.role === 'officer') {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(1, -5.5, 5, 3.4);
  }
  ctx.restore();
}

function drawPlayer(game, ctx) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(2, 3, 10, 0, Math.PI * 2); ctx.fill();
  // Rio: teal shirt, unmistakable at a glance.
  ctx.fillStyle = '#06d6a0';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d5524';
  ctx.beginPath(); ctx.arc(3.5, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#073b2e';
  ctx.beginPath(); ctx.arc(5.5, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  if (p.punchAnim > 0) {
    ctx.fillStyle = '#8d5524';
    ctx.beginPath(); ctx.arc(16, -4, 4.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Arrest ring.
  if (p.arrestMeter > 0.02) {
    ctx.strokeStyle = '#4ea8de';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + p.arrestMeter * Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(game, ctx) {
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawHelicopter(game, ctx, day) {
  const heli = game.police.heli;
  if (!heli.active) return;
  // Searchlight cone first (under the body).
  const sweepA = heli.angle + Math.sin(heli.sweep * 1.7) * 0.5;
  const lx = heli.x + Math.cos(sweepA) * 60, ly = heli.y + Math.sin(sweepA) * 60;
  const grad = ctx.createRadialGradient(lx, ly, 6, lx, ly, 95);
  grad.addColorStop(0, `rgba(255, 246, 190, ${day < 0.5 ? 0.5 : 0.22})`);
  grad.addColorStop(1, 'rgba(255, 246, 190, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(lx, ly, 95, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#22252d';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 10.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-44, -3, 22, 6);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-46, -7, 4, 14);
  // Rotor blur.
  ctx.strokeStyle = 'rgba(230,230,230,0.5)';
  ctx.lineWidth = 2;
  const r = 30 + Math.sin(heli.rotor) * 2;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, r * 0.4); ctx.stroke();
  ctx.restore();
}

// --- Screen-space UI ---------------------------------------------------------

function drawHUD(game, ctx, W, H, day) {
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left wallet panel.
  ctx.fillStyle = 'rgba(8, 12, 24, 0.62)';
  roundRect(ctx, 12, 12, 208, 74, 10); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText(`$${p.cash}`, 24, 38);
  ctx.fillStyle = '#e8f1f2';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`Respect ${p.respect}`, 24, 58);
  ctx.fillText(`Harbor Clinic fee on fall: 10%`, 24, 76);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(118, 26, 88, 9);
  ctx.fillStyle = p.health > 30 ? '#06d6a0' : '#ef476f';
  ctx.fillRect(118, 26, 88 * clamp(p.health / CFG.playerHealth, 0, 1), 9);

  // Wanted stars, top-right.
  const wanted = game.police.wanted;
  ctx.font = '700 24px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd166' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 168 + i * 30, 40);
  }
  if (wanted > 0) {
    ctx.fillStyle = '#e8f1f2';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('SERENA POLICE DEPT', W - 168, 56);
  }
  // Clock + district, top-right under stars.
  ctx.fillStyle = 'rgba(8, 12, 24, 0.55)';
  roundRect(ctx, W - 168, 64, 156, 34, 8); ctx.fill();
  ctx.fillStyle = '#e8f1f2';
  ctx.font = '600 13px system-ui, sans-serif';
  const hh = Math.floor(game.hour), mm = Math.floor((game.hour - hh) * 60);
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${game.currentDistrict}`, W - 158, 86);

  // District banner on change.
  if (game.districtBannerTimer > 0 && game.screen === 'play') {
    ctx.globalAlpha = clamp(game.districtBannerTimer / 0.6, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px system-ui, sans-serif';
    const label = game.currentDistrict.toUpperCase();
    ctx.fillText(label, W / 2 - ctx.measureText(label).width / 2, 92);
    ctx.globalAlpha = 1;
  }

  // Mission panel, bottom-left.
  const job = game.missions.current;
  const obj = game.missions.getObjective();
  if (job && game.screen === 'play') {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.62)';
    roundRect(ctx, 12, H - 118, 330, 106, 10); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(job.title, 24, H - 92);
    ctx.fillStyle = '#e8f1f2';
    ctx.font = '13px system-ui, sans-serif';
    if (obj) {
      const d = Math.round(dist(p.x, p.y, obj.x, obj.y));
      wrapText(ctx, `${obj.label} — ${d}m`, 24, H - 70, 306, 16);
    }
    if (game.missions.timer !== null) {
      ctx.fillStyle = game.missions.timer < 20 ? '#ef476f' : '#ffd166';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(`Time left: ${Math.ceil(game.missions.timer)}s`, 24, H - 34);
    }
    if (p.inCar) {
      ctx.fillStyle = '#e8f1f2';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(`${p.inCar.model.name} · ${game.audio.stationName()}`, 24, H - 16);
    }
  } else if (!job && game.screen === 'play') {
    ctx.fillStyle = 'rgba(8, 12, 24, 0.62)';
    roundRect(ctx, 12, H - 62, 330, 50, 10); ctx.fill();
    ctx.fillStyle = '#e8f1f2';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('Story complete — Port Serena is yours. Free roam!', 24, H - 32);
  }

  // Speed readout while driving.
  if (p.inCar && game.screen === 'play') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px system-ui, sans-serif';
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    ctx.fillText(`${kmh}`, W - 120, H - 148);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('km/h', W - 76, H - 148);
  }

  // Centre message (job banners, radio changes, hints).
  if (game.messageTimer > 0 && game.message) {
    ctx.globalAlpha = clamp(game.messageTimer / 0.5, 0, 1);
    ctx.fillStyle = 'rgba(8, 12, 24, 0.72)';
    const tw = Math.min(620, ctx.measureText(game.message).width + 36);
    void tw;
    ctx.font = '600 15px system-ui, sans-serif';
    const w2 = ctx.measureText(game.message).width + 36;
    roundRect(ctx, W / 2 - w2 / 2, H - 168, w2, 34, 9); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.message, W / 2 - ctx.measureText(game.message).width / 2, H - 146);
    ctx.globalAlpha = 1;
  }

  drawMinimap(game, ctx, W, H);
  drawEdgeArrow(game, ctx, W, H);
  void day;
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = word; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawMinimap(game, ctx, W, H) {
  const mw = 168, mh = 126, mx = W - mw - 12, my = H - mh - 12;
  const sx = mw / CFG.worldW, sy = mh / CFG.worldH;
  ctx.fillStyle = 'rgba(8, 12, 24, 0.72)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 10); ctx.fill();
  ctx.fillStyle = '#1d3557';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.4;
  for (const ax of world.avenues) { ctx.beginPath(); ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + mh); ctx.stroke(); }
  for (const sy2 of world.streets) { ctx.beginPath(); ctx.moveTo(mx, my + sy2 * sy); ctx.lineTo(mx + mw, my + sy2 * sy); ctx.stroke(); }
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const car of game.vehicles) {
    if (car.kind === 'police') continue;
    ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 2.4, 2.4);
  }
  // Police blink red/blue.
  const phase = Math.sin(game.time * 10) > 0;
  for (const car of game.police.cars) {
    ctx.fillStyle = phase ? '#ff2e4d' : '#2e6bff';
    ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  if (game.police.heli.active) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(mx + game.police.heli.x * sx - 2, my + game.police.heli.y * sy - 2, 4, 4);
  }
  // Objective.
  const obj = game.missions.getObjective();
  if (obj) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(mx + obj.x * sx, my + obj.y * sy, 3.6 + Math.sin(game.time * 5) * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#06d6a0';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -3.6); ctx.lineTo(-4, 3.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawEdgeArrow(game, ctx, W, H) {
  if (game.screen !== 'play') return;
  const obj = game.missions.getObjective();
  if (!obj) return;
  const p = game.player;
  const sx = obj.x - game.camera.x + W / 2, sy = obj.y - game.camera.y + H / 2;
  if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return; // on screen already
  const cx = W / 2, cy = H / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (W / 2 - 56);
  const ey = cy + Math.sin(ang) * (H / 2 - 56);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-4, 0); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 12px system-ui, sans-serif';
  const label = `${Math.round(dist(p.x, p.y, obj.x, obj.y))}m`;
  ctx.fillText(label, ex - 14, ey - 18);
}

function drawTitle(game, ctx, W, H, day) {
  void day;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(10, 12, 34, 0.55)');
  grad.addColorStop(1, 'rgba(10, 12, 34, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText('VICE HARBOR', W / 2, H * 0.30);
  ctx.fillStyle = '#ff5d8f';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText('— PORT SERENA —', W / 2, H * 0.30 + 42);
  ctx.fillStyle = '#e8f1f2';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('An original top-down open-world caper. Six jobs for Auntie Bea,', W / 2, H * 0.30 + 76);
  ctx.fillText('one city that never quite sleeps, and the SPD on your tail.', W / 2, H * 0.30 + 96);

  game._buttons = [];
  const bw = 240, bh = 52, bx = W / 2 - bw / 2;
  let by = H * 0.52;
  drawButton(game, ctx, 'play', bx, by, bw, bh, '▶  PLAY NOW');
  if (game.hasSave) {
    by += 66;
    drawButton(game, ctx, 'continue', bx, by, bw, bh, '↻  CONTINUE');
  }
  ctx.fillStyle = 'rgba(232, 241, 242, 0.75)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD drive · E enter car · J punch · Space brake · N radio · P pause', W / 2, H - 34);
  ctx.textAlign = 'left';
}

function drawButton(game, ctx, id, x, y, w, h, label) {
  ctx.fillStyle = '#ffd166';
  roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#14213d';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
  game._buttons.push({ id, x, y, w, h });
}

function drawPause(game, ctx, W, H) {
  ctx.fillStyle = 'rgba(6, 8, 20, 0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H * 0.42);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press P or Esc to keep rolling.', W / 2, H * 0.42 + 36);
  ctx.fillText(`Jobs done: ${game.stats.jobsDone}/6 · Cars lifted: ${game.stats.carsStolen} · Top speed: ${Math.round(game.stats.topSpeed * 0.36)} km/h`, W / 2, H * 0.42 + 66);
  ctx.textAlign = 'left';
}

function drawEndScreen(game, ctx, W, H, title, sub, color) {
  ctx.fillStyle = 'rgba(6, 8, 20, 0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H * 0.40);
  ctx.fillStyle = '#e8f1f2';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(sub, W / 2, H * 0.40 + 40);
  ctx.fillText('Press E to wake up at Harbor Clinic…', W / 2, H * 0.40 + 70);
  ctx.textAlign = 'left';
}
