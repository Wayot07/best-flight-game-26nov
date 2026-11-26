// The screenshot scenes behind ?shot=start|play|ring|land. Each one flies the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (turn toward the next ring, pitch for its height, throttle
// for cruise speed), so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { PLANE, STEP, WORLD } from './config.js';
import { EVENT_LANDED, EVENT_OVER } from './world.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Steer toward `target` ({x, y, z}) at `speed`: returns the pilot's control. */
function autopilot(state, target, speed) {
  const p = state.plane;
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const dy = target.y - p.y;
  const wantHeading = Math.atan2(-dz, dx);
  let dh = wantHeading - p.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const dist = Math.hypot(dx, dz);
  // Command the pitch outright (a fraction of max pitch): the stick maps
  // straight to an angle, so the plane holds the climb it is asked for
  // instead of settling low. Roll is a bank fraction against the heading
  // error; heading accumulates, so the turn converges on its own.
  const wantPitch = clamp(Math.atan2(dy, Math.max(40, dist)) * 1.4, -0.45, 0.45);
  const pitch = clamp(wantPitch / PLANE.maxPitch, -1, 1);
  // Heading falls as the bank grows (right bank turns right), so a target at
  // a larger heading needs a left bank: the roll sign is negative of dh.
  const roll = clamp(-dh * 1.5, -1, 1);
  const throttle = p.speed < speed - 4 ? 1 : p.speed > speed + 4 ? -1 : null;
  return { pitch, roll, throttle, brake: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: on the runway, engines idling, title up. play: mid-course, chasing
 * ring 2 with the home island behind. ring: seconds from ring 3, dead ahead.
 * land: on final approach, then touching down as the sortie completes.
 */
export function stageShot(name, world) {
  const { state } = world;
  world.reset();
  state.screen = 'play';
  if (name === 'start') {
    // Spool up on the strip: full throttle for two seconds, then hold, so the
    // prop is a blur and the courier is rolling as the title sits over it.
    for (let i = 0; i < 2 * 60; i += 1) {
      world.step(STEP, { pitch: 0, roll: 0, throttle: 1, brake: false }, false);
    }
    for (let i = 0; i < 1 * 60; i += 1) {
      world.step(STEP, { pitch: 0, roll: 0, throttle: null, brake: false }, false);
    }
    state.screen = 'title';
    return 'title';
  }
  if (name === 'play') {
    // Take off, climb, and chase the course until ring 1 is banked and ring 2
    // is dead ahead with the sea and the home island in frame.
    for (let i = 0; i < 60 * 60; i += 1) {
      const ring = world.nextRing();
      const target = ring ?? { x: 0, y: 120, z: 0 };
      const events = world.step(STEP, autopilot(state, target, 46), false);
      if (events & EVENT_OVER) break;
      if (state.ringIndex >= 1) break;
    }
    return 'play';
  }
  if (name === 'ring') {
    // Fly the course until the plane is close in on ring 3: the gold torus
    // fills the frame, the beam rising out of it.
    for (let i = 0; i < 90 * 60; i += 1) {
      const ring = world.nextRing();
      if (!ring) break;
      const dx = ring.x - state.plane.x;
      const dy = ring.y - state.plane.y;
      const dz = ring.z - state.plane.z;
      if (state.ringIndex >= 2 && dx * dx + dy * dy + dz * dz < 120 * 120) break;
      const events = world.step(STEP, autopilot(state, ring, 48), false);
      if (events & EVENT_OVER) break;
    }
    return 'play';
  }
  // land: the course is done, so put the courier on final and fly it down.
  state.rings.forEach((ring) => { ring.done = true; });
  state.ringIndex = state.rings.length;
  const p = state.plane;
  const approach = world.terrain.approachPoint();
  p.x = approach.x;
  p.y = approach.y;
  p.z = approach.z;
  p.heading = 0;
  p.pitch = -0.08;
  p.bank = 0;
  p.speed = 44;
  p.throttle = 0.45;
  p.onGround = false;
  state.fuel = 62;
  const runway = WORLD.runway;
  // The final approach is a line, not a point: the segment from the gate
  // (-900, 110) down to the threshold (40, 16) on the runway centreline.
  // Far from it, fly to its start; close to it, steer at the nearest point
  // on it plus a lookahead toward the threshold. A fixed gate point makes
  // the plane circle it and dive while still turning; a lookahead that
  // always moves ahead keeps the plane on the line and descending straight.
  const finalA = { x: -900, y: runway.height + 96, z: runway.z };
  // The line ends down the strip, below touchdown height: the plane follows
  // it along the runway and the landing reads as it sinks through the strip,
  // instead of flying past a point at the threshold and turning back.
  const finalB = { x: runway.x + 100, y: runway.height - 1, z: runway.z };
  // The join latches: once the plane has reached the line's start, it
  // follows the line for good. A bare distance test flip-flops at the
  // boundary — the line pulls east while the start pulls west — and the
  // plane circles there until the fuel dies.
  let joined = false;
  function landingTarget() {
    // Far from the line's start, fly to the start (it sits over open sea
    // west of the island, so the turn onto the line is safe). Once there,
    // follow the line down: the nearest point on it plus a lookahead toward
    // the threshold. Joining the line from the side mid-way would dive for
    // it while still turning, so the line is only followed from its start.
    const dxA = finalA.x - p.x;
    const dyA = finalA.y - p.y;
    const dzA = finalA.z - p.z;
    if (!joined && Math.hypot(dxA, dyA, dzA) <= 200) joined = true;
    if (!joined) return { ...finalA };
    const abx = finalB.x - finalA.x;
    const aby = finalB.y - finalA.y;
    const abz = finalB.z - finalA.z;
    const apx = p.x - finalA.x;
    const apy = p.y - finalA.y;
    const apz = p.z - finalA.z;
    const len2 = abx * abx + aby * aby + abz * abz;
    const t = clamp((apx * abx + apy * aby + apz * abz) / len2, 0, 1);
    const tt = Math.min(1, t + 0.15);
    return { x: finalA.x + abx * tt, y: finalA.y + aby * tt, z: finalA.z + abz * tt };
  }
  for (let i = 0; i < 60 * 60; i += 1) {
    const events = world.step(STEP, autopilot(state, landingTarget(), 40), false);
    if (events & EVENT_LANDED) break;
    if (events & EVENT_OVER) break;
  }
  return 'landed';
}
