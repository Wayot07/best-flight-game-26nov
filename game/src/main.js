// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, landed (a sortie is delivered) and game over.
//
// ?seed=N fixes the archipelago and the ring course. ?shot=start|play|ring|land
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, SHOT_SEED, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorldWithSeed } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorldWithSeed(seed);
const renderer = createRenderer(canvas, world.terrain, createRandom(seed + 77));
const hud = createHud(world.terrain);
const audio = createAudio();
const { state } = world;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const screen = stageShot(name, world);
  let painted = 0;
  function paint() {
    // Snap the chase camera on the first paint: only two frames are drawn
    // for a screenshot, so an eased camera would still be travelling.
    renderer.draw(state, screen, painted === 0);
    hud.update(state, screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    world.reset();
    accumulator = 0;
    screen = 'play';
    announce('Flying. Arrow keys steer, W and S work the throttle.');
  }

  function endGame() {
    screen = 'over';
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === 'play' || screen === 'over' || screen === 'landed')) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === 'title') startGame();
    else if (actions & ACTION_CONFIRM && screen === 'over') startGame();
    else if (actions & ACTION_CONFIRM && screen === 'landed') {
      world.placeOnRunway();
      state.screen = 'play';
      screen = 'play';
      state.fuel = 100;
      world.say(`Sortie ${state.sortie} — ${state.rings.length} rings, then home.`, 4);
      announce('Flying the next sortie.');
    } else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      state.screen = 'paused';
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play';
      state.screen = 'play';
      announce('Flying.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'title' || screen === 'play') {
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        if (screen === 'title') world.step(STEP, null, true);
        else {
          const events = world.step(STEP, input.control(), false);
          if (state.screen === 'over') endGame();
          else if (state.screen === 'landed') screen = 'landed';
          if (events & 1) audio.chime();
          else if (events & 8) audio.thud();
          else if (events & 4) audio.crash();
        }
        accumulator -= STEP;
      }
      audio.update(state.plane.throttle, state.plane.speed, state.plane.onGround);
    } else {
      accumulator = 0;
      audio.update(0, 0, true);
    }
    state.screen = screen;
    renderer.draw(state, screen);
    hud.update(state, screen, best);
  }

  announce('SKYLANE — Island Courier. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
