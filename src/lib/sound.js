/** 用 WebAudio 现场合成的小音效，不需要任何音频文件。默认关闭。 */
let ctx = null;
let enabled = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(duration) {
  const a = ac();
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(gain, t, attack, decay, peak) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

const SOUNDS = {
  clip(a, t) {
    const n = noise(0.08);
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400 + Math.random() * 800;
    f.Q.value = 3;
    const g = a.createGain();
    env(g, t, 0.002, 0.06, 0.35);
    n.connect(f).connect(g).connect(a.destination);
    n.start(t);
  },
  whoosh(a, t) {
    const n = noise(0.45);
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
    const g = a.createGain();
    env(g, t, 0.12, 0.3, 0.18);
    n.connect(f).connect(g).connect(a.destination);
    n.start(t);
  },
  flip(a, t) {
    for (let k = 0; k < 2; k++) {
      const n = noise(0.05);
      const f = a.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 1800;
      const g = a.createGain();
      env(g, t + k * 0.07, 0.003, 0.05, 0.2);
      n.connect(f).connect(g).connect(a.destination);
      n.start(t + k * 0.07);
    }
  },
  pop(a, t) {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    const g = a.createGain();
    env(g, t, 0.005, 0.12, 0.12);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.2);
  },
};

export const sound = {
  get enabled() {
    return enabled;
  },
  toggle() {
    enabled = !enabled;
    if (enabled) ac();
    return enabled;
  },
  play(name, delay = 0) {
    if (!enabled) return;
    try {
      const a = ac();
      SOUNDS[name]?.(a, a.currentTime + delay);
    } catch {}
  },
};
