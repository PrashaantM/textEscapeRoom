// Tiny 8-bit style sound synth built on the Web Audio API.
// No external audio files -- everything is generated at runtime.

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Unlock audio on first user gesture (autoplay policies).
['pointerdown', 'keydown'].forEach((evt) => {
  window.addEventListener(evt, () => getCtx(), { once: true, passive: true });
});

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function tone({ freq = 440, duration = 0.1, type = 'square', volume = 0.06, slideTo = null, delaySec = 0 }) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  const t0 = audioCtx.currentTime + delaySec;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  key: () => tone({ freq: 620, duration: 0.02, type: 'square', volume: 0.02 }),
  move: () => tone({ freq: 330, duration: 0.05, type: 'square', volume: 0.05 }),
  select: () => tone({ freq: 520, duration: 0.07, type: 'square', volume: 0.06 }),
  confirm: () => tone({ freq: 660, duration: 0.09, type: 'square', volume: 0.07, slideTo: 880 }),
  error: () => tone({ freq: 180, duration: 0.22, type: 'sawtooth', volume: 0.07, slideTo: 80 }),
  success: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.14, type: 'square', volume: 0.06, delaySec: i * 0.08 }));
  },
  unlock: () => {
    [392, 523, 659, 784, 987].forEach((f, i) => tone({ freq: f, duration: 0.18, type: 'triangle', volume: 0.07, delaySec: i * 0.06 }));
  },
  pad: (freq) => tone({ freq, duration: 0.16, type: 'square', volume: 0.08 }),
  glitch: () => {
    for (let i = 0; i < 5; i++) {
      tone({ freq: randRange(90, 900), duration: 0.03, type: 'sawtooth', volume: 0.05, delaySec: i * 0.03 });
    }
  },
  coin: () => tone({ freq: 988, duration: 0.06, type: 'square', volume: 0.06, slideTo: 1568 }),
};

function randRange(a, b) {
  return a + Math.random() * (b - a);
}
