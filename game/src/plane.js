// The flight model: an arcade courier plane. Throttle sets a target speed, the
// elevator pitches, the ailerons bank, and the bank turns the nose — a
// coordinated turn, so holding a bank holds a turn. Below minimum speed the wing
// quits and the nose drops; diving past the limit shakes the airframe. All
// angles are radians, heading 0 is east, positive heading turns north.
import { PLANE } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createPlane() {
  return {
    x: 0, y: 0, z: 0,
    heading: 0, pitch: 0, bank: 0,
    speed: 0, throttle: 0,
    onGround: true,
    stalled: false,
    overspeed: false,
    airborne: false, // true once the plane has left the ground this flight
  };
}

/**
 * Advance the plane one fixed step. `input` is { pitch, roll, throttle, brake }:
 * pitch/roll in [-1, 1], throttle 1 to spool up, -1 to spool down, null to hold.
 * Returns nothing; the plane is mutated in place.
 */
export function stepPlane(plane, input, dt) {
  // Throttle spools at a fixed rate; brake cuts it fast.
  if (input.throttle === 1) plane.throttle = Math.min(1, plane.throttle + dt * 0.55);
  else if (input.throttle === -1) plane.throttle = Math.max(0, plane.throttle - dt * 0.8);
  if (input.brake) plane.throttle = Math.max(0, plane.throttle - dt * 1.6);

  // Pitch and bank chase the stick with a little smoothing, so the plane feels
  // weighted instead of snapping to the input. On the ground the wings stay
  // level: banking during the takeoff roll would veer off the strip.
  const targetPitch = clamp(input.pitch * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
  const targetBank = plane.onGround
    ? 0
    : clamp(input.roll * PLANE.maxBank, -PLANE.maxBank, PLANE.maxBank);
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 5);
  plane.bank += (targetBank - plane.bank) * Math.min(1, dt * 4);

  // A banked wing turns the nose; the turn tightens with bank and loosens with speed.
  plane.heading -= Math.sin(plane.bank) * PLANE.turnRate * (PLANE.cruiseSpeed / Math.max(28, plane.speed)) * dt * 1.6;

  // Speed chases the throttle's target; drag grows past the limit.
  const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.cruiseSpeed - PLANE.minSpeed);
  const drag = plane.speed > PLANE.maxSpeed ? 26 : 0;
  plane.speed += clamp(targetSpeed - plane.speed, -PLANE.accel * dt, PLANE.accel * dt) - drag * dt;
  plane.speed = Math.max(0, plane.speed);

  plane.stalled = plane.speed < PLANE.minSpeed && !plane.onGround;
  plane.overspeed = plane.speed > PLANE.maxSpeed;
  // A stalled wing drops the nose and the plane sinks instead of climbing.
  const pitch = plane.stalled ? plane.pitch - 0.35 : plane.pitch;
  const climb = Math.sin(pitch) * plane.speed;
  const sink = plane.stalled ? 9 : 0;
  plane.y += (climb - sink) * dt;

  const ch = Math.cos(plane.heading);
  const sh = Math.sin(plane.heading);
  const forward = Math.cos(pitch) * plane.speed;
  plane.x += ch * forward * dt;
  plane.z -= sh * forward * dt;
}
