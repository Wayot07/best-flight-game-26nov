// Procedural WebAudio: no sound files, everything is synthesised. The engine is
// two detuned sawtooths whose pitch follows throttle and speed, wind is filtered
// noise whose loudness follows airspeed, and rings, landings and crashes are
// short one-shot phrases. Created lazily on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOscA = ctx.createOscillator();
      engineOscA.type = 'sawtooth';
      engineOscB = ctx.createOscillator();
      engineOscB.type = 'square';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 620;
      engineOscA.connect(engineFilter);
      engineOscB.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOscA.start();
      engineOscB.start();
      // Wind: a looping noise buffer through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noise.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** Call every frame while flying: throttle 0..1, speed m/s, onGround. */
  function update(throttle, speed, onGround) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const rpm = 42 + throttle * 58 + speed * 0.35;
    engineOscA.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOscB.frequency.setTargetAtTime(rpm * 1.494, t, 0.08);
    engineGain.gain.setTargetAtTime(onGround ? 0.05 + throttle * 0.05 : 0.045 + throttle * 0.075, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.16, Math.max(0, (speed - 18) * 0.0035)), t, 0.15);
  }

  function blip(freq, start, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function chime() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    blip(660, t, 0.16, 'sine', 0.22);
    blip(880, t + 0.09, 0.2, 'sine', 0.2);
    blip(1320, t + 0.18, 0.26, 'sine', 0.14);
  }

  function thud() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    blip(110, t, 0.22, 'sine', 0.3);
    blip(72, t + 0.05, 0.3, 'triangle', 0.22);
  }

  function crash() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    blip(90, t, 0.5, 'sawtooth', 0.28);
    blip(55, t + 0.08, 0.6, 'square', 0.2);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { ensure, update, chime, thud, crash, toggleMute };
}
