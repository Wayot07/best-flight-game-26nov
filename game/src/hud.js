// The HUD: every instrument is a DOM element the renderer updates, so the
// numbers stay crisp in screenshots — speed, altitude, heading, throttle,
// fuel, hull, rings, score and a live minimap of the archipelago.
import { WORLD } from './config.js';

const $ = (id) => document.getElementById(id);

function compassDeg(heading) {
  // Heading 0 is east, so compass degrees run 90 at east, 0/360 at north.
  const deg = (90 - (heading * 180) / Math.PI) % 360;
  return ((deg + 360) % 360);
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function createHud(terrain) {
  // Pre-render the islands once onto the minimap's background canvas.
  const mapBg = document.createElement('canvas');
  mapBg.width = 180;
  mapBg.height = 180;
  const mctx = mapBg.getContext('2d');
  const half = WORLD.size / 2;
  const img = mctx.createImageData(180, 180);
  for (let py = 0; py < 180; py += 1) {
    for (let px = 0; px < 180; px += 1) {
      const x = ((px / 180) * WORLD.size) - half;
      const z = ((py / 180) * WORLD.size) - half;
      const h = terrain.heightAt(x, z);
      const i = (py * 180 + px) * 4;
      if (h <= 0.5) {
        img.data[i] = 29; img.data[i + 1] = 111; img.data[i + 2] = 143; img.data[i + 3] = 255;
      } else if (h < 3) {
        img.data[i] = 232; img.data[i + 1] = 210; img.data[i + 2] = 154; img.data[i + 3] = 255;
      } else if (h < 30) {
        img.data[i] = 93; img.data[i + 1] = 162; img.data[i + 2] = 74; img.data[i + 3] = 255;
      } else {
        img.data[i] = 141; img.data[i + 1] = 133; img.data[i + 2] = 120; img.data[i + 3] = 255;
      }
    }
  }
  mctx.putImageData(img, 0, 0);
  // The runway, drawn once on the background.
  const rx = ((WORLD.runway.x + half) / WORLD.size) * 180;
  const rz = ((WORLD.runway.z + half) / WORLD.size) * 180;
  mctx.fillStyle = '#3c4148';
  mctx.fillRect(rx - 13, rz - 2, 26, 4);

  const map = $('minimap');
  const mapCtx = map.getContext('2d');

  function drawMinimap(state) {
    mapCtx.drawImage(mapBg, 0, 0);
    const toMap = (x, z) => [((x + half) / WORLD.size) * 180, ((z + half) / WORLD.size) * 180];
    for (const ring of state.rings) {
      const [mx, mz] = toMap(ring.x, ring.z);
      mapCtx.beginPath();
      mapCtx.arc(mx, mz, ring.done ? 2 : 3.5, 0, Math.PI * 2);
      mapCtx.fillStyle = ring.done ? '#3ddc84' : ring.fuel ? '#37d67a' : '#ffc93c';
      mapCtx.fill();
    }
    const p = state.plane;
    const [px, pz] = toMap(p.x, p.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(-p.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(7, 0);
    mapCtx.lineTo(-5, -4.5);
    mapCtx.lineTo(-5, 4.5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function show(id, visible) {
    const el = $(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  /** Refresh every instrument from the state; cheap enough to run each frame. */
  function update(state, screen, best) {
    const p = state.plane;
    $('hud-speed').textContent = `${Math.round(p.speed * 1.944)}`;
    $('hud-alt').textContent = `${Math.round(Math.max(0, p.y) * 3.281)}`;
    const deg = Math.round(compassDeg(p.heading));
    $('hud-hdg').textContent = `${String(deg).padStart(3, '0')}° ${POINTS[Math.round(deg / 45) % 8]}`;
    $('hud-thr').style.width = `${Math.round(p.throttle * 100)}%`;
    $('hud-fuel').style.width = `${Math.round(state.fuel)}%`;
    $('hud-fuel').className = `bar-fill${state.fuel < 25 ? ' low' : ''}`;
    $('hud-hull').style.width = `${Math.round(state.hull)}%`;
    $('hud-hull').className = `bar-fill${state.hull < 35 ? ' low' : ''}`;
    $('hud-rings').textContent = `${state.ringIndex}/${state.rings.length}`;
    $('hud-score').textContent = `${state.score}`;
    $('hud-sortie').textContent = `SORTIE ${state.sortie}`;
    $('hud-best').textContent = `BEST ${best}`;
    $('hud-stall').style.display = p.stalled && screen === 'play' ? '' : 'none';
    $('hud-overspeed').style.display = p.overspeed && screen === 'play' ? '' : 'none';

    const ring = state.rings[state.ringIndex];
    if (ring && screen === 'play') {
      const dx = ring.x - p.x;
      const dz = ring.z - p.z;
      const dist = Math.round(Math.hypot(dx, p.y - ring.y, dz));
      const want = Math.atan2(-dz, dx);
      let dh = want - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const arrow = Math.abs(dh) < 0.35 ? '▲' : dh > 0 ? '◀' : '▶';
      $('hud-next').textContent = `${ring.fuel ? 'FUEL RING' : 'NEXT RING'} ${dist}m ${arrow}`;
      $('hud-next').style.display = '';
    } else {
      $('hud-next').style.display = 'none';
    }

    const msg = state.message && state.time < state.messageUntil ? state.message : '';
    $('hud-msg').textContent = msg;
    $('hud-msg').style.display = msg ? '' : 'none';

    drawMinimap(state);

    show('screen-title', screen === 'title');
    show('screen-pause', screen === 'paused');
    show('screen-over', screen === 'over');
    show('screen-landed', screen === 'landed');
    if (screen === 'over') {
      $('over-score').textContent = `Score ${state.score} · Rings ${state.ringsHit} · Landings ${state.landings} · Sortie ${state.sortie}`;
    }
    if (screen === 'landed') {
      $('landed-score').textContent = `Score ${state.score} · Sortie ${state.sortie} loads on the runway`;
    }
    $('hud').style.display = screen === 'title' ? 'none' : '';
  }

  return { update };
}
