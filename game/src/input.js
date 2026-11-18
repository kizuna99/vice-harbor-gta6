// Keyboard and mouse state for the whole game. The simulation reads a plain snapshot each
// step (a direction, a few held keys and the one-shot actions pressed since the last step),
// so no rule ever touches a DOM event and the screenshot staging can drive the same shape.
// One-shot actions are a bitmask the game drains once per step: a key pressed and released
// between two frames is still honoured, which keeps E-to-enter and R-to-reset reliable.

export const ACTION_ENTER = 1;
export const ACTION_ATTACK = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PAUSE = 8;
export const ACTION_RADIO = 16;
export const ACTION_HORN = 32;
export const ACTION_RESET = 64;

const KEY_ACTIONS = {
  KeyF: ACTION_ENTER,
  KeyE: ACTION_ENTER,
  KeyJ: ACTION_ATTACK,
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyN: ACTION_RADIO,
  KeyH: ACTION_HORN,
  KeyR: ACTION_RESET,
};

/** On-screen touch buttons, in VIEW coordinates: steering cluster bottom-left, pedals and
 *  action buttons bottom-right. Drawn by the renderer once a touch pointer has been seen. */
export const TOUCH_BUTTONS = [
  { id: 'left', label: '◀', x: 26, y: 596, w: 68, h: 68 },
  { id: 'right', label: '▶', x: 110, y: 596, w: 68, h: 68 },
  { id: 'up', label: '▲', x: 1086, y: 596, w: 68, h: 68 },
  { id: 'down', label: '▼', x: 1170, y: 596, w: 68, h: 68 },
  { id: 'enter', label: 'E', x: 1170, y: 512, w: 68, h: 56 },
  { id: 'attack', label: 'J', x: 1086, y: 512, w: 68, h: 56 },
];

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };
  const touchHeld = new Set();
  const pointerButtons = new Map();
  let touchMode = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action && !event.repeat) actions |= action;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchMode = true;
    const rect = canvas.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * 1280;
    const viewY = ((event.clientY - rect.top) / rect.height) * 720;
    const button = TOUCH_BUTTONS.find((b) => viewX >= b.x && viewX <= b.x + b.w && viewY >= b.y && viewY <= b.y + b.h);
    if (button && touchMode) {
      pointerButtons.set(event.pointerId, button.id);
      touchHeld.add(button.id);
      if (button.id === 'enter') actions |= ACTION_ENTER;
      if (button.id === 'attack') actions |= ACTION_ATTACK;
      return;
    }
    mouse.down = true;
    actions |= ACTION_ATTACK;
  });
  function releasePointer(event) {
    const id = pointerButtons.get(event.pointerId);
    if (id) {
      touchHeld.delete(id);
      pointerButtons.delete(event.pointerId);
    }
    mouse.down = false;
  }
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  return {
    /** Movement direction from WASD or the arrow keys, as a unit-ish vector. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft') || touchHeld.has('left')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight') || touchHeld.has('right')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp') || touchHeld.has('up')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown') || touchHeld.has('down')) y += 1;
      return { x, y };
    },
    throttle() {
      let value = 0;
      if (held.has('KeyW') || held.has('ArrowUp') || touchHeld.has('up')) value += 1;
      if (held.has('KeyS') || held.has('ArrowDown') || touchHeld.has('down')) value -= 1;
      return value;
    },
    steer() {
      let value = 0;
      if (held.has('KeyA') || held.has('ArrowLeft') || touchHeld.has('left')) value -= 1;
      if (held.has('KeyD') || held.has('ArrowRight') || touchHeld.has('right')) value += 1;
      return value;
    },
    sprinting() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    braking() {
      return held.has('Space');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    mouseState() {
      return mouse;
    },
    touchState() {
      return { active: touchMode, held: touchHeld };
    },
  };
}

/** An input snapshot with nothing pressed, for staged screenshots and menus. */
export function idleInput() {
  return {
    direction: () => ({ x: 0, y: 0 }),
    throttle: () => 0,
    steer: () => 0,
    sprinting: () => false,
    braking: () => false,
    takeActions: () => 0,
    mouseState: () => ({ x: 0, y: 0, down: false }),
    touchState: () => ({ active: false, held: new Set() }),
  };
}
