// The game itself: one state object, a fixed-step update, and the rules that
// turn flying into decisions — rings to chase, fuel that runs out, a hull that
// only survives so many mistakes, and a runway that pays for a clean landing.
import { PLANE, RING, SCORE, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createPlane, stepPlane } from './plane.js';

export const EVENT_RING = 1;
export const EVENT_FUEL = 2;
export const EVENT_CRASH = 4;
export const EVENT_LANDED = 8;
export const EVENT_SORTIE = 16;
export const EVENT_OVER = 32;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createWorld(random) {
  const terrain = createTerrain(random);
  const state = {
    time: 0,
    screen: 'title',
    plane: createPlane(),
    rings: [],
    ringIndex: 0,
    sortie: 1,
    score: 0,
    fuel: PLANE.fuelMax,
    hull: PLANE.hullMax,
    ringsHit: 0,
    landings: 0,
    crashes: 0,
    message: '',
    messageUntil: 0,
    delivered: false,
    best: 0,
  };

  function placeOnRunway() {
    const p = state.plane;
    const r = WORLD.runway;
    p.x = r.x - r.length / 2 + 30;
    p.y = r.height + 1.2;
    p.z = r.z;
    p.heading = 0;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 0;
    p.throttle = 0;
    p.onGround = true;
  }

  function startSortie(sortie) {
    state.sortie = sortie;
    state.rings = terrain.ringCourse(sortie).map((spot) => ({ ...spot, done: false }));
    state.ringIndex = 0;
    state.delivered = false;
  }

  function reset() {
    state.time = 0;
    state.screen = 'title';
    state.plane = createPlane();
    state.score = 0;
    state.fuel = PLANE.fuelMax;
    state.hull = PLANE.hullMax;
    state.ringsHit = 0;
    state.landings = 0;
    state.crashes = 0;
    state.message = '';
    state.messageUntil = 0;
    placeOnRunway();
    startSortie(1);
    say('SKYLANE — Island Courier. Press Enter to fly.');
  }

  function say(text, seconds = 4) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }

  function nextRing() {
    return state.rings[state.ringIndex] ?? null;
  }

  function crashPlane(why) {
    state.crashes += 1;
    state.hull -= 34;
    const p = state.plane;
    if (state.hull <= 0) {
      state.hull = 0;
      state.screen = 'over';
      say(`Wrecked — ${why}. The courier is out of planes.`, 600);
      return EVENT_CRASH | EVENT_OVER;
    }
    say(`${why} — hull ${Math.round(state.hull)}%. Back to the last ring.`, 4);
    // Recover at the last collected ring (or the runway), wings level, slow.
    // Once the course is clear, recover on final approach instead: the trip
    // home crosses the island's high ground, and re-flying it low is what
    // just wrecked the plane.
    if (state.ringIndex >= state.rings.length) {
      const approach = terrain.approachPoint();
      p.x = approach.x;
      p.y = approach.y;
      p.z = approach.z;
      p.heading = 0;
      p.pitch = 0;
      p.bank = 0;
      p.speed = 40;
      p.throttle = 0.45;
      p.onGround = false;
      return EVENT_CRASH;
    }
    const ring = state.rings[Math.max(0, state.ringIndex - 1)];
    if (state.ringIndex === 0) placeOnRunway();
    else {
      p.x = ring.x - 120;
      p.y = ring.y + 30;
      p.z = ring.z;
      p.heading = Math.atan2(-(ring.z - p.z), ring.x - p.x);
      p.pitch = 0;
      p.bank = 0;
      p.speed = 40;
      p.throttle = 0.6;
      p.onGround = false;
    }
    return EVENT_CRASH;
  }

  /** One fixed step. `input` is the pilot's control; `attract` runs the title demo. */
  function step(dt, input, attract) {
    state.time += dt;
    if (state.screen === 'title' && attract) {
      // Title demo: the courier taxis, lifts off and circles the home island.
      const p = state.plane;
      if (p.onGround && p.speed < 30) {
        stepPlane(p, { pitch: 0, roll: 0, throttle: 1, brake: false }, dt);
        if (p.speed > 26) p.onGround = false;
      } else {
        const target = { x: 0, z: -420 };
        const want = Math.atan2(-(target.z - p.z), target.x - p.x);
        let dh = want - p.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        stepPlane(p, { pitch: p.y < 130 ? 0.25 : 0, roll: clamp(-dh * 2, -1, 1), throttle: 0.6, brake: false }, dt);
        if (p.y > 150) p.y = 150;
      }
      return 0;
    }
    if (state.screen !== 'play') return 0;

    const p = state.plane;
    stepPlane(p, input, dt);

    // Fuel: the throttle drinks it; empty tanks mean a glide and a forced landing.
    state.fuel = Math.max(0, state.fuel - PLANE.fuelDrain * p.throttle * dt);
    if (state.fuel <= 0 && p.throttle > 0.1) {
      p.throttle = 0.1;
      if (state.messageUntil < state.time) say('Fuel empty — gliding. Find the runway!', 3);
    }

    const ground = terrain.heightAt(p.x, p.z);
    const overSea = ground <= 0.5;
    let events = 0;
    // Remember that this flight left the ground: a fast, nose-high arrival
    // back on the strip is a crash, but the takeoff roll itself is not.
    if (p.y > ground + 5) p.airborne = true;
    if (p.onGround && p.speed < 5) p.airborne = false;

    // Rings: fly close to the next ring's centre and it is yours.
    const ring = nextRing();
    if (ring) {
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      const dz = p.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < RING.radius * RING.radius) {
        ring.done = true;
        state.ringIndex += 1;
        state.ringsHit += 1;
        state.score += RING.points;
        state.fuel = Math.min(PLANE.fuelMax, state.fuel + RING.fuelBonus);
        events |= EVENT_RING;
        if (ring.fuel) {
          state.fuel = Math.min(PLANE.fuelMax, state.fuel + 25);
          events |= EVENT_FUEL;
          say(`Fuel ring! Tank topped up. ${state.rings.length - state.ringIndex} rings to go.`, 3);
        } else if (state.ringIndex < state.rings.length) {
          say(`Ring ${state.ringIndex} of ${state.rings.length} — next ring ahead, follow the beam.`, 2.5);
        } else {
          say('Course clear! Bring her home — land on the runway.', 5);
        }
      }
    }

    // Landing: slow, level and on the strip, after the last ring.
    if (p.y <= WORLD.runway.height + 1.6 && terrain.onRunway(p.x, p.z)) {
      const gentle = Math.abs(p.pitch) < 0.3 && p.speed < 52;
      if (state.ringIndex >= state.rings.length && gentle) {
        p.y = WORLD.runway.height + 1.2;
        p.onGround = true;
        p.speed = Math.max(0, p.speed - 26 * dt);
        p.throttle = 0;
        if (!state.delivered) {
          state.delivered = true;
          state.landings += 1;
          const fuelBonus = Math.round(state.fuel) * SCORE.fuelBonusPerUnit;
          state.score += SCORE.landing + fuelBonus + SCORE.sortieBonus;
          events |= EVENT_LANDED | EVENT_SORTIE;
          say(`Delivered! Sortie ${state.sortie} complete — +${SCORE.landing + fuelBonus + SCORE.sortieBonus} pts. Next sortie loads…`, 5);
          startSortie(state.sortie + 1);
          state.fuel = PLANE.fuelMax;
          state.screen = 'landed';
          return events;
        }
      } else if (p.speed > 34 && !gentle && p.airborne) {
        return crashPlane('Too fast for the runway');
      } else {
        // Rolling on the strip: stay on it, slow down only when the throttle
        // is back, and lift off once fast with the nose up. The height pin
        // applies only while rolling — pinning it after liftoff would glue
        // the plane to the runway forever.
        const lifting = p.speed > 30 && p.pitch > 0.06;
        p.onGround = !lifting;
        if (p.onGround) {
          p.y = WORLD.runway.height + 1.2;
          if (p.throttle < 0.25) p.speed = Math.max(0, p.speed - 20 * dt);
        }
      }
    } else if (p.y <= ground + 1.2 && ground > 0.5) {
      return crashPlane('Clipped the hillside');
    } else if (p.y <= 1.2 && overSea) {
      return crashPlane('Ditched in the sea');
    } else if (p.y <= ground + 1.2 && p.onGround && !terrain.onRunway(p.x, p.z)) {
      return crashPlane('Ran off the strip');
    }
    if (p.y > ground + 2) p.onGround = false;

    // Leaving the chart ends the flight the same way a crash does.
    const half = WORLD.size / 2 + 200;
    if (Math.abs(p.x) > half || Math.abs(p.z) > half) {
      return crashPlane('Flew off the chart');
    }
    // Ceiling: the air thins at 420 m and the plane will not climb past it.
    if (p.y > 420) p.y = 420;

    return events;
  }

  reset();
  return { state, terrain, reset, step, nextRing, say, placeOnRunway, startSortie };
}

export function createWorldWithSeed(seed) {
  return createWorld(createRandom(seed));
}
