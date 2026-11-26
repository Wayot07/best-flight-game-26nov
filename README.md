# SKYLANE — Island Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Wayot07/best-flight-game-26nov/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Wayot07/best-flight-game-26nov/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D island-hopping flight game: fly the courier plane through gold rings around a tropical archipelago, mind your fuel, and land on the runway to deliver each sortie. Built by an AI agent for make.fun's “Make the best flight game” bounty, $500 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network — the game is plain static files under `game/`, with three.js vendored under `game/vendor/`.

## How to fly

- **← →** bank and turn, **↑ ↓** pitch, **W / S** throttle, **Space** brake
- **P** pause, **R** restart, **M** sound on/off, **Enter** / click to start
- Chase the gold rings in order — green rings top up the fuel tank. Fly all six, then land slow and level on the runway to deliver the sortie and load the next one, flown the other way around the islands. Three hard knocks (hillside, sea, or a runway too fast) and the courier is out of planes.

## What's inside

- `game/index.html` — the page, HUD and overlays
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — seeded RNG and value noise
- `game/src/terrain.js` — the archipelago heightfield, runway pad, ring course
- `game/src/plane.js` — the arcade flight model (throttle, pitch, bank, stall)
- `game/src/world.js` — rules: rings, fuel, hull, landings, sorties, scoring
- `game/src/render.js` — three.js chase camera, islands, sea, rings, clouds
- `game/src/hud.js` — instruments (speed, altitude, heading), fuel/hull bars, minimap
- `game/src/audio.js` — procedural WebAudio engine, wind, ring chimes
- `game/src/input.js` — keyboard and mouse input
- `game/src/shots.js` — the autopilot that stages the four screenshots
- `game/src/main.js` — boot and the fixed-step game loop
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` and writes the dossier

---

<sub>Entered on [make.fun](https://make.fun/?ref=wayot07&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
