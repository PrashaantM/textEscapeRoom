// Visual effects layer: typewriter text rendering, shake/glitch/pulse
// animation helpers (toggling CSS classes defined in css/style.css), the
// full-screen flash, and the CRT toggle. Scene files call these to react to
// player actions (wrong answer, level cleared, etc.); sceneManager.js also
// uses glitchBurst via ctx.glitchBurst.

import { delay } from './utils.js';
import { sfx } from './audio.js';

// Cached once at load: whether the OS/browser requests reduced motion.
// Read by every animation helper in this file to skip or shorten effects.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Types text into an element character by character. Any keydown/pointerdown
// on `document` while typing will instantly complete the line (never trap a
// player behind a slow animation they can't skip). Wrapped by
// scenes/shared.js's typeInto() and used throughout boot.js, callsign.js,
// level1.js, and ending.js for dialogue and terminal output.
export async function typeWriter(target, text, { speed = 16, signal, sound = true } = {}) {
  target.textContent = '';
  if (prefersReducedMotion) {
    target.textContent = text;
    return;
  }
  let skip = false;
  const skipHandler = () => { skip = true; };
  document.addEventListener('keydown', skipHandler);
  document.addEventListener('pointerdown', skipHandler);
  try {
    for (let i = 0; i < text.length; i++) {
      if (skip || (signal && signal.aborted)) {
        target.textContent = text;
        return;
      }
      target.textContent += text[i];
      if (sound && i % 3 === 0 && text[i] !== ' ') sfx.key();
      await delay(speed, signal).catch(() => {});
    }
  } finally {
    document.removeEventListener('keydown', skipHandler);
    document.removeEventListener('pointerdown', skipHandler);
  }
}

// Triggers a brief screen-shake CSS animation on a node. Called by level
// scenes on a wrong answer (e.g. bad door code, failed vault guess).
export function shake(node) {
  if (prefersReducedMotion) return;
  node.classList.remove('fx-shake');
  // Force reflow so the animation can restart.
  void node.offsetWidth;
  node.classList.add('fx-shake');
  node.addEventListener('animationend', () => node.classList.remove('fx-shake'), { once: true });
}

// Adds a timed CRT-glitch CSS animation to a node, then removes it. Called
// by level scenes and shared.js's showInterstitial on solving a puzzle, and
// exposed to every scene via ctx.glitchBurst.
export function glitchBurst(node, ms = 400) {
  if (prefersReducedMotion) return;
  node.classList.add('fx-glitching');
  setTimeout(() => node.classList.remove('fx-glitching'), ms);
}

// Briefly flashes the fixed #screen-flash overlay to the given color. Used
// by ending.js for its dramatic beats.
export function flashScreen(color = '#ffffff', ms = 220) {
  const flash = document.getElementById('screen-flash');
  if (!flash) return;
  flash.style.background = color;
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), ms);
}

// Toggles the body-level `crt-off` class that hides the scanline/vignette
// overlay. Called by main.js on boot (saved setting) and by the pause
// menu's CRT FX toggle.
export function setCrtEnabled(enabled) {
  document.body.classList.toggle('crt-off', !enabled);
}

// Exposes the cached reduced-motion preference to other modules. Read by
// sceneManager.js's goTo() to decide whether to skip the scene fade
// transition.
export function reducedMotion() {
  return prefersReducedMotion;
}

// Adds a short glow/pulse CSS animation to a node, then removes it. Used by
// level scenes to highlight newly acquired items or solved puzzles.
export function pulse(node, className = 'fx-pulse', ms = 600) {
  node.classList.add(className);
  setTimeout(() => node.classList.remove(className), ms);
}
