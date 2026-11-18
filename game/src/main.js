// Vice Harbor boot and the one loop. The world advances in fixed 1/60 s steps whatever the
// display's rate; input is gathered once a frame and handed to the simulation as plain
// actions; the mission system reads the world after each step; the audio engine hears the
// simulation's events. Screens: title (PLAY NOW / CONTINUE), play, paused, busted/wasted.
//
// ?seed=N fixes the city. ?shot=cover|chase|mission|finale (with &seed=N) stages that scene
// from shots.js instead of running the loop, paints it twice and sets window.__shotReady.

import { STEP, VIEW } from './config.js';
import { createCity } from './world.js';
import { createGame, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './game.js';
import { createMissionSystem } from './missions.js';
import { createRenderer, TITLE_BUTTONS } from './render.js';
import { createAudio } from './audio.js';
import {
  ACTION_ATTACK, ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_PAUSE,
  ACTION_RADIO, ACTION_RESET, createInput,
} from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(seed);
const game = createGame(city, seed);
const missions = createMissionSystem(game, city, Math.random);
const renderer = createRenderer(canvas, city);
const audio = createAudio();
const { state } = game;

window.__gameState = state;
window.__game = game;

function announce(message) {
  status.textContent = message;
}

function drainEvents() {
  for (const name of state.events) audio.playEvent(name, state);
  state.events.length = 0;
}

if (shot) {
  stageShot(shot, game, missions);
  let painted = 0;
  const paint = () => {
    renderer.draw(state, SCREEN_PLAY, { hasSave: false, touch: { active: false, held: new Set() } });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  state.screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function setScreen(next) {
    screen = next;
    state.screen = next;
  }

  function startNewGame() {
    audio.unlock();
    setScreen(SCREEN_PLAY);
    announce('Playing. First job: pick up the package at Serena Marina.');
  }

  function continueGame() {
    audio.unlock();
    if (game.loadGame()) announce('Saved game loaded.');
    setScreen(SCREEN_PLAY);
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== SCREEN_TITLE && screen !== SCREEN_OVER) return;
    const rect = canvas.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * VIEW.width;
    const viewY = ((event.clientY - rect.top) / rect.height) * VIEW.height;
    if (screen === SCREEN_OVER) {
      if (viewX >= 490 && viewX <= 790 && viewY >= 400 && viewY <= 456) {
        game.respawn();
        setScreen(SCREEN_PLAY);
      }
      return;
    }
    for (const button of TITLE_BUTTONS) {
      if (button.id === 'continue' && !game.hasSave()) continue;
      if (viewX >= button.x && viewX <= button.x + button.w && viewY >= button.y && viewY <= button.y + button.h) {
        if (button.id === 'play') startNewGame();
        else continueGame();
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') {
      const mutedNow = audio.toggleMute();
      state.message = mutedNow ? 'Sound off' : 'Sound on';
      state.messageTimer = 1.4;
    }
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && game.hasSave()) continueGame();
  });

  function actionsFrom(bits) {
    return {
      enter: Boolean(bits & ACTION_ENTER),
      attack: Boolean(bits & ACTION_ATTACK),
      confirm: Boolean(bits & ACTION_CONFIRM),
      pause: Boolean(bits & ACTION_PAUSE),
      radio: Boolean(bits & ACTION_RADIO),
      horn: Boolean(bits & ACTION_HORN),
      reset: Boolean(bits & ACTION_RESET),
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = actionsFrom(input.takeActions());

    if (actions.pause) {
      if (screen === SCREEN_PLAY) setScreen(SCREEN_PAUSED);
      else if (screen === SCREEN_PAUSED) setScreen(SCREEN_PLAY);
    }
    if (screen === SCREEN_TITLE && actions.confirm) startNewGame();
    else if (screen === SCREEN_OVER && actions.confirm) {
      game.respawn();
      setScreen(SCREEN_PLAY);
    }

    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        game.step(STEP, input, actions);
        missions.update(STEP);
        accumulator -= STEP;
        // One-shot actions apply to the first step of the frame only.
        actions.enter = false;
        actions.attack = false;
        actions.confirm = false;
        actions.radio = false;
        actions.horn = false;
        actions.reset = false;
        if (state.screen === SCREEN_OVER) {
          setScreen(SCREEN_OVER);
          announce(state.player.busted ? 'Busted.' : 'Wasted.');
          break;
        }
      }
    } else if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic flows, nobody is chased.
      while (accumulator >= STEP) {
        game.step(STEP, input, actionsFrom(0));
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    drainEvents();
    audio.update(state, Math.min(0.05, accumulator + STEP));
    renderer.draw(state, screen, { hasSave: game.hasSave(), touch: input.touchState() });
  }
  requestAnimationFrame(frame);
}
