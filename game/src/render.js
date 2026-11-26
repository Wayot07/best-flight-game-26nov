// The 3D view: a three.js chase camera behind the courier, over a seeded
// low-poly archipelago — sea, islands, runway, ring course, clouds and sun.
// Everything visible is built from the state; nothing is fetched, so the game
// runs with no network at all.
import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';
import { createRandom } from './random.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function colorForHeight(h) {
  if (h < 2.5) return new THREE.Color(PALETTE.sand);
  if (h < 26) return new THREE.Color(PALETTE.grass);
  if (h < 48) return new THREE.Color(PALETTE.grassDry);
  if (h < 72) return new THREE.Color(PALETTE.rock);
  return new THREE.Color(PALETTE.snow);
}

/** Build the courier plane from primitives: cream fuselage, teal wings, orange stripe. */
function buildPlaneMesh() {
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.planeCream, roughness: 0.55, metalness: 0.08 });
  const teal = new THREE.MeshStandardMaterial({ color: PALETTE.planeTeal, roughness: 0.5, metalness: 0.1 });
  const orange = new THREE.MeshStandardMaterial({ color: PALETTE.planeOrange, roughness: 0.5, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd8ef', roughness: 0.15, metalness: 0.35 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 12), cream);
  fuselage.rotation.z = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 12), teal);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 4.0;
  group.add(nose);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.5, 12), orange);
  stripe.rotation.z = Math.PI / 2;
  stripe.position.x = 1.4;
  group.add(stripe);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), glass);
  canopy.scale.set(1.7, 0.75, 0.95);
  canopy.position.set(1.5, 0.62, 0);
  group.add(canopy);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 11.5), teal);
  wing.position.set(0.4, -0.15, 0);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.5), orange);
  wingTipL.position.set(0.4, -0.15, 5.7);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.z = -5.7;
  group.add(wingTipR);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 4.2), teal);
  tailplane.position.set(-3.1, 0.25, 0);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 0.14), orange);
  fin.position.set(-3.1, 0.9, 0);
  group.add(fin);
  // Propeller: a hub and two blades, spun by the renderer from the sim clock.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), dark);
  hub.rotation.z = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.08, 3.4, 0.34);
  const bladeA = new THREE.Mesh(bladeGeo, dark);
  prop.add(bladeA);
  const bladeB = new THREE.Mesh(bladeGeo, dark);
  bladeB.rotation.x = Math.PI / 2;
  prop.add(bladeB);
  prop.position.x = 4.9;
  group.add(prop);
  // Landing gear: two wheels and a tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const z of [1.1, -1.1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), dark);
    strut.position.set(0.9, -0.85, z);
    group.add(strut);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(0.9, -1.3, z);
    group.add(wheel);
  }
  // Navigation lights: red port, green starboard.
  const lightGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const portLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#ff2e2e' }));
  portLight.position.set(0.4, -0.1, 5.85);
  group.add(portLight);
  const starboardLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: '#2eff5e' }));
  starboardLight.position.set(0.4, -0.1, -5.85);
  group.add(starboardLight);
  group.userData.prop = prop;
  return group;
}

export function createRenderer(canvas, terrain, random) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color('#a8d2e8'), 700, 2600);

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(600, 900, 300);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3f6b4a, 1.15));

  // Sea: one big plane at y = 0, slightly glossy.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, shininess: 90, specular: 0x99ccdd }),
  );
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);

  // Islands: a displaced grid, vertex-coloured sand / grass / rock / snow.
  const segments = 128;
  const landGeo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, segments, segments);
  landGeo.rotateX(-Math.PI / 2);
  const pos = landGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, Math.max(h, -1.5));
    const c = colorForHeight(h);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  landGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  landGeo.computeVertexNormals();
  const land = new THREE.Mesh(
    landGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  scene.add(land);

  // Runway: dark strip, white centre dashes, threshold bars, plus a windsock.
  const runwayGroup = new THREE.Group();
  const r = WORLD.runway;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.length, r.width),
    new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(r.x, r.height + 0.15, r.z);
  runwayGroup.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  for (let dx = -r.length / 2 + 18; dx < r.length / 2 - 10; dx += 24) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(r.x + dx, r.height + 0.25, r.z);
    runwayGroup.add(dash);
  }
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.5, r.width - 6), dashMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(r.x + end * (r.length / 2 - 8), r.height + 0.25, r.z);
    runwayGroup.add(bar);
  }
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8), new THREE.MeshStandardMaterial({ color: '#d8d8d8' }));
  sockPole.position.set(r.x + 60, r.height + 3.5, r.z + r.width / 2 + 8);
  runwayGroup.add(sockPole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 8), new THREE.MeshStandardMaterial({ color: PALETTE.planeOrange }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(r.x + 61.4, r.height + 6.6, r.z + r.width / 2 + 8);
  runwayGroup.add(sock);
  scene.add(runwayGroup);

  // Palm trees on the grassy flats near the runway.
  const palmSpots = [];
  let guard = 0;
  while (palmSpots.length < 26 && guard < 600) {
    guard += 1;
    const x = (random() - 0.5) * 900;
    const z = (random() - 0.5) * 900;
    const h = terrain.heightAt(x, z);
    if (h > 4 && h < 24 && Math.abs(x) > 150) palmSpots.push([x, z, h]);
  }
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.9 });
  for (const [x, z, h] of palmSpots) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = (random() - 0.5) * 0.16;
    palm.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 5), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.5, 7.2, Math.sin(a) * 1.5);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      palm.add(leaf);
    }
    palm.position.set(x, h, z);
    scene.add(palm);
  }

  // Rings: gold torus for the next one, green for fuel rings, faded for done.
  const ringMeshes = [];
  const ringGeo = new THREE.TorusGeometry(17, 1.3, 10, 40);
  const beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 320, 8, 1, true);
  for (let i = 0; i < 6; i += 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.ringGold, emissive: PALETTE.ringGold, emissiveIntensity: 0.85, roughness: 0.35,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: PALETTE.ringGold, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 160;
    mesh.add(beam);
    mesh.userData.beam = beam;
    scene.add(mesh);
    ringMeshes.push(mesh);
  }

  // Clouds: flat white puffs that drift with the sim clock.
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.88 });
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let j = 0; j < puffs; j += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(14 + random() * 16, 10, 8), cloudMat);
      s.position.set((random() - 0.5) * 60, (random() - 0.5) * 6, (random() - 0.5) * 30);
      s.scale.y = 0.42;
      cloud.add(s);
    }
    cloud.position.set((random() - 0.5) * 2200, 260 + random() * 110, (random() - 0.5) * 2200);
    cloud.userData.drift = 1.5 + random() * 2;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // The sun disc, far away, so the sky has a direction.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(46, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', fog: false }),
  );
  sunDisc.position.set(1500, 820, -900);
  scene.add(sunDisc);

  const planeMesh = buildPlaneMesh();
  scene.add(planeMesh);

  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 6000);
  const camPos = new THREE.Vector3(0, 30, -30);
  const camLook = new THREE.Vector3();

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Paint one frame from the state; `screen` only changes the camera slightly.
   * `snap` puts the camera straight on the chase position instead of easing
   * toward it: screenshot scenes paint only a couple of frames, so an eased
   * camera would still be on its way from the spawn point and the plane
   * would be out of frame. */
  function draw(state, screen, snap = false) {
    const p = state.plane;
    // Plane mesh: forward is +X, so heading rotates around Y and bank rolls around X.
    planeMesh.position.set(p.x, p.y, p.z);
    planeMesh.rotation.order = 'YXZ';
    planeMesh.rotation.y = -p.heading;
    planeMesh.rotation.z = p.pitch;
    planeMesh.rotation.x = p.bank;
    // The propeller spins with the throttle and the sim clock.
    planeMesh.userData.prop.rotation.x = state.time * (6 + p.throttle * 34);
    // A stalled wing rocks the airframe; overspeed shakes it.
    if (p.stalled) planeMesh.rotation.x += Math.sin(state.time * 22) * 0.06;
    if (p.overspeed) planeMesh.position.y += Math.sin(state.time * 40) * 0.12;

    // Rings follow the state: position, colour, and the next one's beam.
    state.rings.forEach((ring, i) => {
      const mesh = ringMeshes[i];
      if (!mesh) return;
      mesh.position.set(ring.x, ring.y, ring.z);
      mesh.rotation.y = state.time * 0.25 + i;
      const isNext = i === state.ringIndex;
      const mat = mesh.material;
      if (ring.done) {
        mat.color.set(PALETTE.ringDone);
        mat.emissive.set(PALETTE.ringDone);
        mat.emissiveIntensity = 0.25;
      } else if (ring.fuel) {
        mat.color.set(PALETTE.fuelGreen);
        mat.emissive.set(PALETTE.fuelGreen);
        mat.emissiveIntensity = isNext ? 0.95 : 0.5;
      } else {
        mat.color.set(PALETTE.ringGold);
        mat.emissive.set(PALETTE.ringGold);
        mat.emissiveIntensity = isNext ? 0.95 : 0.45;
      }
      mesh.userData.beam.visible = isNext;
      mesh.userData.beam.material.opacity = 0.1 + 0.06 * Math.sin(state.time * 3);
      const s = isNext ? 1 + 0.06 * Math.sin(state.time * 3) : 1;
      mesh.scale.set(s, s, s);
    });

    // Clouds drift east, slowly, on the sim clock.
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.drift * 0.016;
      if (cloud.position.x > 1200) cloud.position.x = -1200;
    }

    // Chase camera: behind and above the tail, looking ahead of the nose.
    const ch = Math.cos(p.heading);
    const sh = Math.sin(p.heading);
    const back = screen === 'title' ? 26 : 17;
    const up = screen === 'title' ? 8 : 5.5;
    const wantX = p.x - ch * back;
    const wantZ = p.z + sh * back;
    const wantY = p.y + up;
    if (snap) {
      camPos.set(wantX, wantY, wantZ);
    } else {
      const k = 1 - Math.pow(0.001, 1 / 60);
      camPos.x += (wantX - camPos.x) * k;
      camPos.y += (wantY - camPos.y) * k;
      camPos.z += (wantZ - camPos.z) * k;
    }
    camera.position.copy(camPos);
    camLook.set(p.x + ch * 26, p.y + Math.sin(p.pitch) * 18 - 1, p.z - sh * 26);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  }

  return { draw, resize };
}
