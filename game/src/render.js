// render.js — Port Serena on canvas: a top-down city with 2.5D manners.
// Buildings throw sun-arc shadows and show their roofs, neon signs bleed
// into the harbour water after dark, headlights and the Air One searchlight
// cut cones through the night, and the HUD keeps cash, heat, hull and crew
// in the corners where a driver can read them at speed.

import { WORLD, GUN_SHOP, GARAGE, SAFEHOUSE, HEAT_LEVELS } from './config.js';
import { cellNoise, clamp, dirFrom } from './random.js';
import { STATIONS } from './audio.js';

export function daylight(hour) {
  if (hour >= 6.5 && hour <= 17.5) return 1;
  if (hour > 17.5 && hour < 20) return 1 - (hour - 17.5) / 2.5 * 0.78;
  if (hour >= 20 || hour <= 5) return 0.22;
  return 0.22 + (hour - 5) / 1.5 * 0.78; // dawn
}

function sunOffset(hour) {
  const t = clamp((hour - 6) / 12, 0, 1);
  const ang = Math.PI * (1 - t); // east at dawn, west at dusk
  const len = 10 + Math.sin(t * Math.PI) * 16;
  return { x: Math.cos(ang) * len, y: Math.sin(ang) * len * 0.4 + 4 };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function draw(game) {
    const W = canvas.width, H = canvas.height;
    const cam = game.camera;
    const day = daylight(game.hour);
    const night = 1 - day;
    const sh = sunOffset(game.hour);
    const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const ox = Math.round(W / 2 - cam.x + shakeX);
    const oy = Math.round(H / 2 - cam.y + shakeY);
    const view = { x: cam.x - W / 2 - 90, y: cam.y - H / 2 - 90, w: W + 180, h: H + 180 };
    const inView = (x, y, pad = 60) => x > view.x - pad && x < view.x + view.w && y > view.y - pad && y < view.y + view.h;

    // --- ground ------------------------------------------------------------
    ctx.fillStyle = '#79a86b';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(ox, oy);

    // Water and sand first: the whole shore band.
    ctx.fillStyle = '#3f7fbf';
    ctx.fillRect(view.x, WORLD.waterY, view.w, WORLD.height - WORLD.waterY + 200);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = Math.floor(view.x / 46) * 46; x < view.x + view.w; x += 46) {
      for (let y = WORLD.waterY + 8; y < WORLD.height; y += 34) {
        const n = cellNoise(x / 46, y / 34 + Math.floor(game.time * 0.7), 3);
        if (n > 0.62) ctx.fillRect(x + n * 20, y, 22, 3);
      }
    }
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(view.x, WORLD.beachY, view.w, WORLD.waterY - WORLD.beachY);
    // After dark the Boardwalk signs smear colour across the harbour: long
    // soft streaks under the shore lights, drifting with the swell.
    if (night > 0.3 && view.y + view.h > WORLD.waterY) {
      const hues = ['255,93,162', '55,224,200', '255,210,62'];
      for (let i = 0; i < 26; i++) {
        const sx = Math.floor((view.x + i * 131) / 131) * 131 + (i % 5) * 17;
        const wob = Math.sin(game.time * 1.3 + i * 1.7) * 7;
        ctx.fillStyle = `rgba(${hues[i % 3]},${0.10 * night})`;
        ctx.fillRect(sx + wob, WORLD.waterY + 6 + (i % 4) * 22, 52, 5);
      }
    }
    // Pier Nine: planks over the water.
    const pier = WORLD.pier;
    ctx.fillStyle = '#9a7b4f';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(60,40,18,0.5)';
    for (let y = pier.y + 12; y < pier.y + pier.h; y += 16) { ctx.beginPath(); ctx.moveTo(pier.x, y); ctx.lineTo(pier.x + pier.w, y); ctx.stroke(); }

    drawRoads(game, view, night);

    // Docks apron concrete.
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(2700, 1418, 470, 230);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(1150, 330, 210, 210);

    // Buildings: shadow, wall skirt (the 2.5D lift), roof, details.
    for (const b of game.world.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 220)) continue;
      const lift = 5 + b.floors * 2.2;
      ctx.fillStyle = 'rgba(20,26,20,0.30)';
      ctx.fillRect(b.x + sh.x, b.y + sh.y + lift * 0.4, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x - lift * 0.35, b.y + lift * 0.55, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Seeded roof texture: vents, skylights, grime cells.
      const cells = 3;
      for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
          const n = cellNoise((b.x | 0) + i * 7, (b.y | 0) + j * 11, b.seed);
          if (n > 0.72) {
            ctx.fillStyle = 'rgba(0,0,0,0.13)';
            ctx.fillRect(b.x + (i + 0.2) * (b.w / cells), b.y + (j + 0.2) * (b.h / cells), b.w / cells * 0.5, b.h / cells * 0.5);
          }
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x + b.w * 0.12, b.y + b.h * 0.14, b.w * 0.2, b.h * 0.16);
      // Windows glow after dark.
      if (night > 0.35) {
        ctx.fillStyle = `rgba(255,214,110,${0.5 * night})`;
        const cols = Math.max(2, Math.floor(b.w / 26));
        const rows = Math.max(2, Math.floor(b.h / 30));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          if (cellNoise(b.seed + i * 3, j * 5, 9) > 0.45) {
            ctx.fillRect(b.x + 6 + i * ((b.w - 12) / cols), b.y + 6 + j * ((b.h - 12) / rows), 5, 7);
          }
        }
      }
      // Neon signage on the commercial strips.
      if ((b.district === 'Palm Row' || b.district === 'Downtown' || b.district === 'Serena Marina') && b.seed % 3 === 0) {
        const hues = ['#ff5da2', '#37e0c8', '#ffd23e', '#7fb2d9'];
        ctx.fillStyle = hues[b.seed % 4];
        ctx.globalAlpha = 0.55 + night * 0.45;
        ctx.fillRect(b.x + b.w * 0.2, b.y - 5, b.w * 0.6, 5);
        ctx.globalAlpha = 1;
        if (night > 0.3) { // the sign's reflection shivers on wet asphalt
          ctx.fillStyle = hues[b.seed % 4];
          ctx.globalAlpha = 0.14 * night;
          ctx.fillRect(b.x + b.w * 0.2, b.y + b.h + 4, b.w * 0.6, 16);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Palms.
    for (const palm of game.world.palms) {
      if (!inView(palm.x, palm.y, 40)) continue;
      ctx.strokeStyle = '#7a5c38';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + sh.x * 0.3, palm.y - 12 * palm.s); ctx.stroke();
      ctx.strokeStyle = '#3e8e4f';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + palm.x;
        ctx.beginPath();
        ctx.moveTo(palm.x + sh.x * 0.3, palm.y - 12 * palm.s);
        ctx.lineTo(palm.x + sh.x * 0.3 + Math.sin(a) * 13 * palm.s, palm.y - 12 * palm.s + Math.cos(a) * 6);
        ctx.stroke();
      }
    }

    // Ramps.
    for (const r of game.world.ramps) {
      ctx.fillStyle = '#5d6d7e';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#ffd23e';
      for (let i = 0; i < 3; i++) ctx.fillRect(r.x + 6 + i * 16, r.y + r.h / 2 - 3, 9, 6);
    }

    drawPlaces(game, night);
    drawMissionBeacon(game);
    drawRaceLayer(game);

    for (const ped of game.peds) if (inView(ped.x, ped.y, 30)) drawPed(ped, sh);
    for (const c of game.cars) if (inView(c.x, c.y, 70)) drawCar(c, game, sh, night);
    for (const c of game.policeRef.cars) if (inView(c.x, c.y, 70)) drawCar(c, game, sh, night);
    for (const e of game.enemies) if (inView(e.x, e.y, 40)) drawGunman(e, sh);
    for (const m of game.crew) if (!m.riding && inView(m.x, m.y, 40)) drawCrew(m, sh);
    drawPlayer(game, sh, night);

    // Projectiles as tracers, grenades as dark eggs with a blinking fuse.
    ctx.lineWidth = 2;
    for (const pr of game.arsenal.projectiles) {
      ctx.strokeStyle = pr.hostile ? 'rgba(255,90,80,0.9)' : 'rgba(255,215,106,0.95)';
      ctx.beginPath();
      ctx.moveTo(pr.x - pr.vx * 0.016, pr.y - pr.vy * 0.016);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
    }
    for (const s of game.arsenal.shells) {
      ctx.fillStyle = '#2f3b2f';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
      if (Math.floor(game.time * 9) % 2 === 0) { ctx.fillStyle = '#ff5040'; ctx.fillRect(s.x - 1, s.y - 7, 2, 3); }
    }
    for (const pt of game.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    drawHeli(game, night);
    ctx.restore();

    // Night wash + lamp pools are cheaper as a screen-space pass.
    if (night > 0.05) {
      ctx.fillStyle = `rgba(10,14,44,${0.34 * night})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawHud(game, W, H, night);
    if (game.state === 'title') drawTitle(game, W, H);
    if (game.state === 'paused') drawCenterCard(game, W, H, 'PAUSED', 'Esc to keep driving');
    if (game.state === 'busted') drawCenterCard(game, W, H, 'BUSTED', 'The desk sergeant takes the fine');
    if (game.state === 'wasted') drawCenterCard(game, W, H, 'WASTED', 'The clinic patches Rio up');
    if (game.shop) drawShop(game, W, H);
    if (game.raceState && game.raceState.phase === 'count') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 92px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.max(1, Math.ceil(game.raceState.t))), W / 2, H / 2 - 40);
    }
    if (game.bannerT > 0 && game.state === 'playing') {
      ctx.fillStyle = 'rgba(8,10,16,0.72)';
      const tw = ctx.measureText(game.bannerText).width + 36;
      ctx.fillRect(W / 2 - tw / 2, 18, tw, 34);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(game.bannerText, W / 2, 41);
    }
  }

  function drawRoads(game, view, night) {
    const { AVENUES, STREETS } = gameRoads;
    ctx.fillStyle = '#565b60';
    for (const ax of AVENUES) ctx.fillRect(ax - 46, view.y - 60, 92, view.h + 120);
    for (const sy of STREETS) ctx.fillRect(view.x - 60, sy - 46, view.w + 120, 92);
    ctx.fillStyle = '#484d52';
    for (const ax of AVENUES) ctx.fillRect(ax - 34, view.y - 60, 68, view.h + 120);
    for (const sy of STREETS) ctx.fillRect(view.x - 60, sy - 34, view.w + 120, 68);
    // Boardwalk planks instead of asphalt along the shore street.
    ctx.fillStyle = '#a9834f';
    ctx.fillRect(view.x - 60, 2200 - 34, view.w + 120, 68);
    // Lane dashes.
    ctx.fillStyle = `rgba(255,235,160,${0.5 + night * 0.2})`;
    for (const ax of AVENUES) for (let y = Math.floor(view.y / 44) * 44; y < view.y + view.h; y += 44) ctx.fillRect(ax - 2, y, 4, 22);
    for (const sy of STREETS) for (let x = Math.floor(view.x / 44) * 44; x < view.x + view.w; x += 44) ctx.fillRect(x, sy - 2, 22, 4);
  }

  const gameRoads = { AVENUES: null, STREETS: null };

  function drawPlaces(game, night) {
    const mark = (x, y, color, label) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10131a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 4.5);
    };
    mark(GUN_SHOP.x, GUN_SHOP.y, '#ffd23e', 'W');
    mark(GARAGE.x, GARAGE.y, '#7fb2d9', 'G');
    mark(SAFEHOUSE.x, SAFEHOUSE.y, '#4ecdc4', 'H');
    if (night > 0.3) {
      for (const lamp of game.world.lamps) {
        if (Math.abs(lamp.x - game.camera.x) > 640 || Math.abs(lamp.y - game.camera.y) > 520) continue;
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 44);
        g.addColorStop(0, `rgba(255,220,130,${0.20 * night})`);
        g.addColorStop(1, 'rgba(255,220,130,0)');
        ctx.fillStyle = g;
        ctx.fillRect(lamp.x - 44, lamp.y - 44, 88, 88);
      }
    }
  }

  function drawMissionBeacon(game) {
    const step = game.missions.step();
    if (!step || game.state !== 'playing') return;
    const pulse = 0.6 + Math.sin(game.time * 4) * 0.25;
    ctx.fillStyle = `rgba(255,210,62,${0.20 * pulse})`;
    ctx.fillRect(step.x - 9, step.y - 320, 18, 320);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(step.x, step.y, 12 + Math.sin(game.time * 4) * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', step.x, step.y + 4);
  }

  function drawRaceLayer(game) {
    for (const def of gameRaces) {
      ctx.strokeStyle = 'rgba(78,205,196,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(def.start.x, def.start.y, 30, 0, Math.PI * 2); ctx.stroke();
    }
    const s = game.raceState;
    if (!s) return;
    const cp = s.def.checkpoints[s.cpIndex];
    if (cp) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cp[0], cp[1], 34 + Math.sin(game.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
    }
    for (const r of s.rivals) drawCarShape(r.x, r.y, r.angle, r.color, 0, false, game);
  }
  const gameRaces = [];

  function drawPed(ped, sh) {
    if (ped.down) {
      ctx.fillStyle = ped.color;
      ctx.fillRect(ped.x - 10, ped.y - 4, 20, 8);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(ped.x + sh.x * 0.4, ped.y + 6, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 2, 4.4, 0, Math.PI * 2); ctx.fill();
  }

  function drawGunman(e, sh) {
    if (e.state === 'down') {
      ctx.fillStyle = '#503a3a';
      ctx.fillRect(e.x - 11, e.y - 4, 22, 9);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x + sh.x * 0.4, e.y + 6, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8e2f35';
    ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(e.x, e.y - 2, 5, 0, Math.PI * 2); ctx.fill();
    const d = dirFrom(e.angle);
    ctx.strokeStyle = '#22252b';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + d.x * 17, e.y + d.y * 17); ctx.stroke();
    // Health tick over the head while the fight is live.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
    ctx.fillStyle = '#ff6b5e';
    ctx.fillRect(e.x - 12, e.y - 20, 24 * clamp(e.hp / e.maxHp, 0, 1), 4);
  }

  function drawCrew(m, sh) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(m.x + sh.x * 0.4, m.y + 6, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.state === 'down' ? '#666' : m.color;
    ctx.beginPath(); ctx.arc(m.x, m.y, 9.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(m.x, m.y - 2, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 8.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, m.x, m.y - 14);
  }

  function drawCarShape(x, y, angle, color, airZ, police, game) {
    ctx.save();
    ctx.translate(x, y - airZ);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-13 + airZ * 0.12, -22 + airZ * 0.12, 26, 46);
    ctx.fillStyle = color;
    ctx.fillRect(-12, -23, 24, 46);
    ctx.fillStyle = 'rgba(16,20,28,0.85)';
    ctx.fillRect(-9, -12, 18, 11);   // windshield
    ctx.fillRect(-9, 4, 18, 9);      // rear glass
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-9, -1, 18, 4);     // roof band
    if (police) {
      ctx.fillStyle = '#20304a';
      ctx.fillRect(-12, -4, 24, 9);
      const flash = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff4040' : '#4066ff';
      ctx.fillRect(-7, -3, 6, 5);
      ctx.fillStyle = flash ? '#4066ff' : '#ff4040';
      ctx.fillRect(1, -3, 6, 5);
    }
    ctx.restore();
  }

  function drawCar(c, game, sh, night) {
    drawCarShape(c.x, c.y, c.angle, c.wrecked ? '#3c3f45' : c.color, c.airZ || 0, !!c.police, game);
    if (c.wrecked) {
      ctx.fillStyle = 'rgba(30,30,30,0.5)';
      ctx.beginPath(); ctx.arc(c.x, c.y - 6, 9 + Math.sin(game.time * 3 + c.x) * 2, 0, Math.PI * 2); ctx.fill();
    }
    if (c.marked) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', c.x, c.y - 32);
    }
    if (night > 0.4 && !c.wrecked && (c.driver || c.speed > 4)) {
      const d = dirFrom(c.angle);
      ctx.fillStyle = `rgba(255,240,180,${0.13 * night})`;
      ctx.beginPath();
      ctx.moveTo(c.x + d.x * 22, c.y + d.y * 22);
      ctx.lineTo(c.x + d.x * 92 - d.y * 20, c.y + d.y * 92 + d.x * 20);
      ctx.lineTo(c.x + d.x * 92 + d.y * 20, c.y + d.y * 92 - d.x * 20);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawPlayer(game, sh, night) {
    const p = game.player;
    if (p.car) return; // the car is the portrait while driving
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(p.x + sh.x * 0.4, p.y + 7, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(p.x, p.y - 2, 5.6, 0, Math.PI * 2); ctx.fill();
    if (p.armor > 0) {
      ctx.strokeStyle = 'rgba(127,178,217,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 13.5, 0, Math.PI * 2); ctx.stroke();
    }
    const d = dirFrom(p.angle);
    ctx.strokeStyle = '#22252b';
    ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + d.x * 18, p.y + d.y * 18); ctx.stroke();
  }

  function drawHeli(game, night) {
    const h = game.policeRef.heli;
    if (!h) return;
    // Searchlight first, under the airframe.
    const grd = ctx.createRadialGradient(h.x, h.y + 130, 8, h.x, h.y + 130, 120);
    grd.addColorStop(0, `rgba(255,246,190,${0.30 + night * 0.2})`);
    grd.addColorStop(1, 'rgba(255,246,190,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 130, 95, 62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(Math.sin(h.angle) * 0.2);
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(-9, -26, 18, 52);
    ctx.fillRect(-3, 20, 6, 20);
    ctx.strokeStyle = '#2b3038';
    ctx.lineWidth = 3;
    const sweep = Math.sin(game.time * 31) * 20;
    ctx.beginPath(); ctx.moveTo(-24 - sweep, 0); ctx.lineTo(24 + sweep, 0); ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-2, -4, 4, 4);
    ctx.restore();
  }

  function drawHud(game, W, H, night) {
    const p = game.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(12, 12, 218, 96);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(`$${game.cash}`, 24, 38);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Respect ${game.respect}`, 24, 58);
    ctx.fillText(p.car ? p.car.name : (game.weaponsOwned[p.weapon] ? '' : '') + weaponLabel(game), 24, 76);
    // Hull and health bars.
    bar(24, 86, 120, 7, p.health / 100, '#e2543e');
    bar(24, 96, 120, 5, p.armor / 100, '#7fb2d9');
    if (p.car) bar(150, 86, 66, 7, 1 - p.car.damage / 100, '#84a98c');

    // Wanted stars, top centre.
    const stars = game.policeRef.stars;
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.22)';
      ctx.fillText('★', W / 2 - 52 + i * 26, 36);
    }
    if (game.arrestFill > 0.02) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('ARREST', W / 2, 56);
      bar(W / 2 - 50, 62, 100, 6, game.arrestFill, '#ff5040');
    }

    // Mission line, bottom left.
    const step = game.missions.step();
    const job = game.missions.job();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(12, H - 64, 330, 52);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = 'bold 13px system-ui, sans-serif';
    if (game.missions.done) ctx.fillText('Port Serena — free roam', 24, H - 40);
    else if (job && step) {
      ctx.fillText(`${job.title}: ${step.label}`, 24, H - 40);
      const d = Math.round(Math.hypot(p.x - step.x, p.y - step.y));
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`${d}m`, 24, H - 22);
      if (step.time) {
        ctx.fillStyle = game.missions.timer < 15 ? '#ff5040' : '#e8ecf2';
        ctx.fillText(`${Math.max(0, Math.ceil(game.missions.timer))}s`, 70, H - 22);
      }
    }
    if (p.car) {
      ctx.fillStyle = '#4ecdc4';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`♪ ${STATIONS[game.station].name}  (N)`, 150, H - 22);
    }
    const race = game.raceState;
    if (race) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`${race.def.name} — checkpoint ${Math.min(race.cpIndex + 1, 8)}/8`, 24, H - 78);
    }

    drawMinimap(game, W, H);
    void night;
  }

  function weaponLabel(game) {
    const w = game.player.weapon;
    const a = game.arsenal.ammo[w];
    const names = { fists: 'Fists', pistol: 'Harbor Pistol', smg: 'Calle SMG', shotgun: 'Dockside Shotgun', grenade: 'Grenade' };
    return a ? `${names[w]}  ${a.mag}/${a.reserve}` : names[w];
  }

  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  }

  function drawMinimap(game, W, H) {
    const mw = 188, mh = 141, mx = W - mw - 12, my = 12;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(8,14,20,0.78)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3f7fbf';
    ctx.fillRect(mx, my + WORLD.waterY * sy, mw, (WORLD.height - WORLD.waterY) * sy);
    ctx.strokeStyle = 'rgba(230,236,242,0.5)';
    ctx.lineWidth = 1;
    for (const ax of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) { ctx.beginPath(); ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + mh); ctx.stroke(); }
    for (const sy2 of [200, 600, 1000, 1400, 1800, 2200]) { ctx.beginPath(); ctx.moveTo(mx, my + sy2 * sy); ctx.lineTo(mx + mw, my + sy2 * sy); ctx.stroke(); }
    const dot = (x, y, color, r = 2.4) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill(); };
    dot(GUN_SHOP.x, GUN_SHOP.y, '#ffd23e', 3);
    dot(GARAGE.x, GARAGE.y, '#7fb2d9', 3);
    for (const e of game.enemies) if (e.state !== 'down') dot(e.x, e.y, '#ff5040', 2.6);
    for (const c of game.policeRef.cars) dot(c.x, c.y, '#6ea8ff', 2.2);
    const step = game.missions.step();
    if (step && game.state === 'playing') {
      dot(step.x, step.y, '#ffd23e', 3.6);
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('G', mx + step.x * sx, my + step.y * sy - 5);
    }
    dot(game.player.x, game.player.y, '#ffffff', 3.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(mx, my, mw, mh);
    ctx.fillStyle = 'rgba(232,236,242,0.85)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const dist = districtName(game.player.x, game.player.y);
    ctx.fillText(dist, mx + 6, my + mh - 6);
  }

  function districtName(x, y) {
    const list = [
      ['Old Town', 0, 0, 1050, 850], ['University Quarter', 1050, 0, 1100, 850], ['Serena Marina', 2150, 0, 1050, 850],
      ['Palm Row', 0, 850, 1700, 420], ['Downtown', 1700, 850, 1500, 420],
      ['The Boardwalk', 0, 2050, 3200, 350], ['Port Docks', 2150, 1270, 1050, 780], ['Midtown', 0, 1270, 2150, 780],
    ];
    for (const [n, x0, y0, w, h] of list) if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) return n;
    return 'Port Serena';
  }

  function drawTitle(game, W, H) {
    ctx.fillStyle = 'rgba(6,8,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('VICE HARBOR', W / 2, H / 2 - 70);
    ctx.fillStyle = '#4ecdc4';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('— PORT SERENA —', W / 2, H / 2 - 34);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Eight jobs, one harbour, every cop in the city.', W / 2, H / 2 + 4);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('PLAY NOW  —  press Enter        CONTINUE  —  press C', W / 2, H / 2 + 52);
    ctx.fillStyle = 'rgba(232,236,242,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD drive · E enter · J punch/fire · Q reload · N radio · C crew', W / 2, H / 2 + 82);
  }

  function drawCenterCard(game, W, H, title, sub) {
    ctx.fillStyle = 'rgba(6,8,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }

  function drawShop(game, W, H) {
    const isGuns = game.shop === 'weapons';
    const shop = isGuns ? GUN_SHOP : GARAGE;
    const pw = 430, ph = 120 + shop.items.length * 27;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    ctx.fillStyle = 'rgba(8,10,18,0.92)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = isGuns ? '#ffd23e' : '#7fb2d9';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.textAlign = 'left';
    ctx.fillStyle = isGuns ? '#ffd23e' : '#7fb2d9';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(shop.name, px + 22, py + 36);
    ctx.fillStyle = '#e8ecf2';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Cash $${game.cash} — press the number, Esc to leave`, px + 22, py + 58);
    shop.items.forEach((item, i) => {
      const y = py + 88 + i * 27;
      const afford = game.cash >= item.price;
      ctx.fillStyle = afford ? '#e8ecf2' : 'rgba(232,236,242,0.4)';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`${i + 1}.  ${item.label}`, px + 22, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${item.price}`, px + pw - 22, y);
      ctx.textAlign = 'left';
    });
  }

  // Filled in after creation so the helpers above can stay declarative.
  gameRoads.AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  gameRoads.STREETS = [200, 600, 1000, 1400, 1800, 2200];
  gameRaces.push(...[
    { start: { x: 1400, y: 600 } },
    { start: { x: 400, y: 2200 } },
  ]);

  return { draw };
}
