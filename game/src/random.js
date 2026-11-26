// A small seeded random number generator (mulberry32): the same seed gives the
// same archipelago, the same ring course and the same clouds, which is what
// makes the screenshot scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic 2D value-noise field in [-1, 1], built from a seeded grid. */
export function createNoise(random) {
  const size = 64;
  const grid = new Float32Array((size + 1) * (size + 1));
  for (let i = 0; i < grid.length; i += 1) grid[i] = random() * 2 - 1;
  const at = (ix, iz) => grid[(((iz % (size + 1)) + size + 1) % (size + 1)) * (size + 1) + (((ix % (size + 1)) + size + 1) % (size + 1))];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const fx = (((x / 240 + 0.5) * size) % size + size) % size;
    const fz = (((z / 240 + 0.5) * size) % size + size) % size;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = smooth(fx - ix);
    const tz = smooth(fz - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz);
  };
}
