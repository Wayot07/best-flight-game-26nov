// Keyboard (and mouse click) input: arrows fly the plane, W/S work the throttle,
// Enter starts, P pauses, R restarts, M mutes. Returns one small input object per
// frame; the world consumes it in fixed steps, so holding a key is smooth.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(target) {
  const keys = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onClick() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (target) target.addEventListener('pointerdown', onClick);

  /** Pitch/roll in [-1, 1], throttle 0..1, brake held. Null throttle means "hold". */
  function control() {
    // Arcade pitch: Up climbs, Down dives. Positive pitch is nose-up in the
    // flight model, so Up maps to +1.
    const pitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
    const roll = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    let throttle = null;
    if (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle = 1;
    else if (keys.has('KeyS') || keys.has('ControlLeft')) throttle = -1;
    return { pitch, roll, throttle, brake: keys.has('Space') };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { control, takeActions };
}
