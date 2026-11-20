// input.js — keyboard and mouse state with a strict edge rule.
// `held` is the level (is the key down right now), `pressed` is the
// edge (did it go down since the last tick). The game drains `pressed`
// completely every tick, so a tap can never linger and fire twice —
// that drain is what stops a stale J from starting a race a beat late.

export const Input = {
  held: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0 },

  attach(target, canvas) {
    target.addEventListener('keydown', (ev) => {
      if (!ev.repeat) this.pressed.add(ev.code);
      this.held.add(ev.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    });
    target.addEventListener('keyup', (ev) => { this.held.delete(ev.code); });
    target.addEventListener('blur', () => { this.held.clear(); });
    canvas.addEventListener('mousedown', (ev) => {
      this.pressed.add('MouseLeft');
      this.mouse.x = ev.clientX; this.mouse.y = ev.clientY;
    });
    canvas.addEventListener('mousemove', (ev) => { this.mouse.x = ev.clientX; this.mouse.y = ev.clientY; });
  },

  down(code) { return this.held.has(code); },
  // consume one edge; true exactly once per physical press
  tap(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  },
  saw(code) { return this.pressed.has(code); },
  drain() { this.pressed.clear(); },
};
