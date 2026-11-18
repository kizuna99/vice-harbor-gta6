// input.js — keyboard, mouse and touch input in one place.
// The simulation only ever asks this module two questions: "is it held?"
// and "was it just pressed this frame?" — which keeps game logic testable.

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.touchSeen = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchFlags = { action: false, brake: false };
    this.clickPunch = false;
    this._bound = false;
  }

  attach(canvas) {
    if (this._bound) return;
    this._bound = true;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); });
    canvas.addEventListener('pointerdown', () => { this.clickPunch = true; });
    window.addEventListener('touchstart', () => { this.touchSeen = true; }, { passive: true });
  }

  // Bind the on-screen buttons rendered by index.html. Buttons carry a
  // data-key (virtual key code) or data-move (direction) attribute.
  bindTouchButtons(root) {
    if (!root) return;
    const press = (el, on, off) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.touchSeen = true; on(); });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };
    root.querySelectorAll('[data-vkey]').forEach((el) => {
      const code = el.getAttribute('data-vkey');
      press(el, () => { this.down.add(code); this.pressed.add(code); }, () => this.down.delete(code));
    });
    root.querySelectorAll('[data-vmove]').forEach((el) => {
      const dir = el.getAttribute('data-vmove');
      press(el, () => {
        if (dir === 'up') this.touchMove.y = -1;
        if (dir === 'down') this.touchMove.y = 1;
        if (dir === 'left') this.touchMove.x = -1;
        if (dir === 'right') this.touchMove.x = 1;
      }, () => {
        if (dir === 'up' || dir === 'down') this.touchMove.y = 0;
        if (dir === 'left' || dir === 'right') this.touchMove.x = 0;
      });
    });
  }

  isDown(...codes) { return codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }

  // Movement axes in [-1, 1], merging keyboard and touch.
  moveX() {
    let x = this.touchMove.x;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    return Math.max(-1, Math.min(1, x));
  }
  moveY() {
    let y = this.touchMove.y;
    if (this.isDown('KeyW', 'ArrowUp')) y -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) y += 1;
    return Math.max(-1, Math.min(1, y));
  }

  // Call once at the end of each simulation frame.
  endFrame() {
    this.pressed.clear();
    this.clickPunch = false;
  }

  // Test hooks: the headless playtest drives the game through these.
  pressKey(code) { this.down.add(code); this.pressed.add(code); }
  releaseKey(code) { this.down.delete(code); }
  clearAll() { this.down.clear(); this.pressed.clear(); }
}

export const input = new Input();
