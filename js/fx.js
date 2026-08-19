import { delay } from './utils.js';
import { sfx } from './audio.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Types text into an element character by character. Any keydown/pointerdown
// on `document` while typing will instantly complete the line (never trap a
// player behind a slow animation they can't skip).
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

export function shake(node) {
  if (prefersReducedMotion) return;
  node.classList.remove('fx-shake');
  // Force reflow so the animation can restart.
  void node.offsetWidth;
  node.classList.add('fx-shake');
  node.addEventListener('animationend', () => node.classList.remove('fx-shake'), { once: true });
}

export function glitchBurst(node, ms = 400) {
  if (prefersReducedMotion) return;
  node.classList.add('fx-glitching');
  setTimeout(() => node.classList.remove('fx-glitching'), ms);
}

export function flashScreen(color = '#ffffff', ms = 220) {
  const flash = document.getElementById('screen-flash');
  if (!flash) return;
  flash.style.background = color;
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), ms);
}

export function setCrtEnabled(enabled) {
  document.body.classList.toggle('crt-off', !enabled);
}

export function reducedMotion() {
  return prefersReducedMotion;
}

export function pulse(node, className = 'fx-pulse', ms = 600) {
  node.classList.add(className);
  setTimeout(() => node.classList.remove(className), ms);
}
