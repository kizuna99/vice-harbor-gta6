// Input layer: held keys in `keys`, one-tick edges in `pressed`.
// The simulation drains `pressed` completely every tick (see game.js),
// so an edge can never survive into a later tick and fire stale —
// that is what stops an old J press from auto-starting a race.

export const keys = Object.create(null);
export const pressed = new Set();

const ACTION_KEYS = new Set([
  'KeyE', 'KeyF', 'Enter', 'Space', 'KeyJ', 'KeyH', 'KeyN',
  'KeyR', 'KeyP', 'KeyM', 'KeyQ', 'KeyC', 'Escape',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8',
]);

let touchSeen = false;
export function touchWasSeen() { return touchSeen; }

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) {
      keys[e.code] = true;
      if (ACTION_KEYS.has(e.code)) pressed.add(e.code);
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    pressed.clear();
  });

  canvas.addEventListener('pointerdown', () => {
    pressed.add('MousePunch');
  });

  window.addEventListener('touchstart', () => {
    touchSeen = true;
    document.body.classList.add('has-touch');
  }, { passive: true });

  bindTouchButtons();
}

function bindTouchButtons() {
  const map = {
    'btn-up': 'ArrowUp', 'btn-down': 'ArrowDown',
    'btn-left': 'ArrowLeft', 'btn-right': 'ArrowRight',
    'btn-act': 'KeyE', 'btn-punch': 'KeyJ', 'btn-brake': 'Space',
  };
  for (const [id, code] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const on = (e) => {
      e.preventDefault();
      touchSeen = true;
      document.body.classList.add('has-touch');
      if (!keys[code]) { keys[code] = true; pressed.add(code); }
    };
    const off = (e) => { e.preventDefault(); keys[code] = false; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
}

export function axisX() {
  return (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
}
export function axisY() {
  return (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
}
export function sprinting() {
  return !!(keys['ShiftLeft'] || keys['ShiftRight']);
}
export function consume(code) {
  if (pressed.has(code)) { pressed.delete(code); return true; }
  return false;
}
export function anyPressed(...codes) {
  for (const c of codes) if (consume(c)) return true;
  return false;
}
export function drainPressed() {
  pressed.clear();
}
