// The archipelago: a deterministic heightfield over five islands, a flattened
// runway pad on the home island, and the ring course for each sortie. Every
// height comes from the seeded noise, so the same seed builds the same islands.
import { WORLD } from './config.js';
import { createNoise } from './random.js';

/** Gaussian bump of `height` at (cx, cz) with radius `r`, evaluated at (x, z). */
function bump(x, z, cx, cz, r, height) {
  const dx = (x - cx) / r;
  const dz = (z - cz) / r;
  const d2 = dx * dx + dz * dz;
  if (d2 > 9) return 0;
  return height * Math.exp(-d2 * 1.6);
}

export function createTerrain(random) {
  const noise = createNoise(random);
  const runway = WORLD.runway;
  const halfLen = runway.length / 2;
  const halfWid = runway.width / 2 + 26;

  function rawHeight(x, z) {
    let h = 0;
    for (const island of WORLD.islands) h += bump(x, z, island.x, island.z, island.r, island.h);
    // Rolling detail, strongest on the high ground, fading to the shore.
    const detail = noise(x, z) * 7 + noise(x * 2.7 + 500, z * 2.7 - 300) * 2.5;
    return h + detail * Math.min(1, Math.max(0, h / 24));
  }

  /** Height of the land at (x, z); at or below 0 is open sea. */
  function heightAt(x, z) {
    let h = rawHeight(x, z);
    // Flatten a pad for the runway so landings read as landings, stretched
    // west into a flat approach corridor so the final comes in over level
    // ground instead of the island's slope.
    const padWest = 260;
    const padEast = 60;
    const padSide = 60;
    const westEdge = runway.x - halfLen;
    const eastEdge = runway.x + halfLen;
    if (x > westEdge - padWest && x < eastEdge + padEast && Math.abs(z - runway.z) < halfWid + padSide) {
      const fxW = x < westEdge ? Math.max(0, 1 - (westEdge - x) / padWest) : 1;
      const fxE = x > eastEdge ? Math.max(0, 1 - (x - eastEdge) / padEast) : 1;
      const fz = Math.abs(z - runway.z) <= halfWid
        ? 1
        : Math.max(0, 1 - (Math.abs(z - runway.z) - halfWid) / padSide);
      const f = Math.min(fxW, fxE, fz);
      h = h * (1 - f) + runway.height * f;
    }
    return h;
  }

  function onRunway(x, z) {
    return Math.abs(x - runway.x) < halfLen && Math.abs(z - runway.z) < runway.width / 2 - 2;
  }

  /** The ring course: a loop past each outer island, then home to the runway. */
  function ringCourse(sortie) {
    const alt = [150, 190, 170, 230, 200, 160];
    const spots = [
      { x: 300, z: -260 },
      { x: 620, z: -480 },
      { x: -40, z: -620 },
      { x: -640, z: -420 },
      { x: -560, z: 560 },
      { x: 700, z: 520 },
    ];
    // Later sorties fly the loop the other way and 30 m higher: same islands,
    // a different line, so the second sortie is not a replay of the first.
    // Sortie 1 always runs the loop in order, so the first ring is the near
    // one off the runway and the opening flight is a climb, not a long transit.
    const order = sortie % 2 === 0 ? [...spots].reverse() : spots;
    const lift = sortie % 2 === 0 ? 30 : 0;
    return order.map((spot, i) => ({
      x: spot.x,
      y: alt[i] + lift,
      z: spot.z,
      fuel: i === 2 || i === 4, // two green fuel rings per sortie
    }));
  }

  /** A straight-in final approach point for the runway, from the west. */
  function approachPoint() {
    return { x: runway.x - 620, y: runway.height + 90, z: runway.z };
  }

  return { heightAt, onRunway, ringCourse, approachPoint, runway };
}
