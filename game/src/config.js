// SKYLANE — Island Courier: every tuning number and colour in one place.
// Distances are metres, speeds metres per second, angles radians. The sim runs
// in fixed 1/60 s steps, so nothing below depends on the display's frame rate.
export const STEP = 1 / 60;

// The archipelago the courier flies over: a 2400 m square of sea with five islands.
export const WORLD = {
  size: 2400,
  seaLevel: 0,
  // Main island (home base) sits at the origin; the runway runs east-west on it.
  runway: { x: 0, z: 0, length: 260, width: 22, heading: 0, height: 14 },
  // Islands: centre, radius, peak height. The heightfield blends them together.
  islands: [
    { x: 0, z: 0, r: 420, h: 46 },
    { x: 620, z: -480, r: 300, h: 78 },
    { x: -640, z: -420, r: 260, h: 64 },
    { x: 700, z: 520, r: 280, h: 58 },
    { x: -560, z: 560, r: 320, h: 88 },
  ],
};

// The courier plane: a single-prop island hopper, built from primitives.
export const PLANE = {
  cruiseSpeed: 46, // m/s at full throttle, level flight
  minSpeed: 24, // below this the wing stops flying and the nose drops
  maxSpeed: 78, // diving limit; past it the airframe shakes and drag bites
  accel: 14, // m/s^2 toward the throttle's target speed
  pitchRate: 0.9, // rad/s at full elevator
  rollRate: 1.9, // rad/s at full aileron
  maxPitch: 0.55,
  maxBank: 1.15,
  turnRate: 0.55, // heading rad/s at full bank and cruise speed
  fuelDrain: 1.1, // fuel units per second at full throttle
  fuelMax: 100,
  hullMax: 100,
};

export const RING = {
  count: 6, // rings per sortie, then land on the runway to finish it
  radius: 17, // flying within this of a ring's centre collects it
  points: 100,
  fuelBonus: 12, // fuel back per ring, so a clean line keeps the tank alive
};

export const SCORE = {
  ring: 100,
  landing: 500,
  sortieBonus: 250,
  fuelBonusPerUnit: 2, // leftover fuel converts to points when a sortie ends
};

export const PALETTE = {
  sky: '#7ec3e8',
  skyTop: '#3f8fd2',
  sea: '#1d6f8f',
  seaDeep: '#14506e',
  sand: '#e8d29a',
  grass: '#5da24a',
  grassDry: '#8aa84f',
  rock: '#8d8578',
  snow: '#f4f6f2',
  runway: '#3c4148',
  runwayMark: '#f2f0e4',
  planeCream: '#f4ead2',
  planeTeal: '#1f7a6d',
  planeOrange: '#e8722a',
  ringGold: '#ffc93c',
  ringNext: '#ffb400',
  ringDone: '#3ddc84',
  fuelGreen: '#37d67a',
  hudInk: '#f4f7f5',
  hudDim: '#b9c8c2',
  hudWarn: '#ffb400',
  hudDanger: '#ff5a4e',
  panel: 'rgba(10, 26, 34, 0.62)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skylane.best';

/** Fixed seeds: 1 is the screenshot seed, the live game rolls its own. */
export const SHOT_SEED = 1;
