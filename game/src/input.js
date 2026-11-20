// input.js — keyboard and pointer state with an edge channel. `held` answers
// "is it down right now"; `pressed` answers "did it go down since the last
// tick". The game drains `pressed` at the end of EVERY tick, on every code
// path — a stale edge left over from a shop panel or a cutscene must never
// fire later (that was the phantom race-start bug: an old J edge starting a
// race the moment Rio sat in a car near the marker).

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  const virtual = new Set(); // touch-pad buttons feed the same sets

  const down = (code) => {
    if (!held.has(code)) pressed.add(code);
    held.add(code);
  };
  const up = (code) => held.delete(code);

  target.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  target.addEventListener('keyup', (e) => up(e.code));
  target.addEventListener('blur', () => { held.clear(); virtual.clear(); });

  // A click counts as a J press (punch / race start) so mouse-only players
  // get the same verbs; the edge drains exactly like a key edge.
  target.addEventListener('pointerdown', () => down('KeyJ'));
  target.addEventListener('pointerup', () => up('KeyJ'));

  return {
    isDown: (code) => held.has(code) || virtual.has(code),
    wasPressed: (code) => pressed.has(code),
    drain() { pressed.clear(); },
    setVirtual(code, on) {
      if (on) down(code); else up(code);
      if (on) virtual.add(code); else virtual.delete(code);
    },
    axis() {
      const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
      const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
      return { x, y };
    },
  };
}
