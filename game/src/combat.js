// Hand-to-hand combat and its consequences: Rio's punch drops pedestrians and officers,
// a dropped pedestrian sometimes drops cash, and a witness means the wanted level climbs.
// The police answer in kind (see police.js); when Rio's health runs out he wakes at the
// Harbor Clinic poorer, and when the arrest meter fills he wakes at the station instead.

import { PLAYER, WORLD } from './config.js';
import { knockDownPedestrian } from './entities.js';

export function createCombatSystem(game, city, random) {
  const { state } = game;

  function anyoneWatching(x, y, radius) {
    for (const ped of state.pedestrians) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < radius) return true;
    }
    return state.wanted > 0;
  }

  function respawnAtClinic(reason) {
    const p = state.player;
    if (p.vehicle) {
      p.vehicle.driver = 'parked';
      p.vehicle.speed = 0;
      p.vehicle = null;
    }
    const fine = Math.floor(state.cash * 0.1);
    state.cash -= fine;
    p.x = city.places.hospital.x;
    p.y = city.places.hospital.y + 60;
    p.health = PLAYER.health;
    p.arrestMeter = 0;
    p.busted = false;
    p.wasted = false;
    state.wanted = 0;
    state.message = `${reason} — the clinic took $${fine}. You are back on the street.`;
    state.messageTimer = 4;
    state.screen = 'play';
  }

  function stepCombat(dt, actions) {
    const p = state.player;
    if (p.wasted) {
      respawnAtClinic('Wasted');
      return;
    }
    if (p.health <= 0) {
      p.wasted = true;
      state.screen = 'over';
      game.emit('wasted');
      return;
    }
    if (p.vehicle || !actions.attack) return;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.34;
    game.emit('swing');
    const reachX = p.x + Math.cos(p.angle) * 20;
    const reachY = p.y + Math.sin(p.angle) * 20;
    let hitAnyone = false;
    for (const ped of state.pedestrians) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - reachX, ped.y - reachY) < PLAYER.punchRange) {
        knockDownPedestrian(ped);
        hitAnyone = true;
        if (random() < 0.4) {
          const dropped = 8 + Math.floor(random() * 18);
          state.cash += dropped;
          state.message = `Took $${dropped} off the street`;
          state.messageTimer = 1.8;
        }
      }
    }
    for (const officer of state.officers) {
      if (officer.state === 'down') continue;
      if (Math.hypot(officer.x - reachX, officer.y - reachY) < PLAYER.punchRange) {
        officer.state = 'down';
        officer.fallTimer = 3.2;
        hitAnyone = true;
      }
    }
    if (hitAnyone) {
      game.emit('thud');
      if (anyoneWatching(p.x, p.y, 280)) game.raiseWanted(1, 'Assault witnessed — wanted level up');
      else if (random() < 0.3) game.raiseWanted(1, 'Someone called it in — wanted level up');
    }
    void WORLD;
  }

  return { stepCombat, respawnAtClinic };
}
