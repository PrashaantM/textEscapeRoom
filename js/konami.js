// Easter egg: watches for the Konami code being typed anywhere in the game
// and, if found, sets the 'konami' flag in state.js and shows a toast.
// ending.js checks this flag to add a bonus line of dialogue and a credits
// entry. Started once by main.js on boot.

import { setFlag, getState } from './state.js';
import { sfx } from './audio.js';

const CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let buffer = [];
let toastTimer = null;

// Attaches a global keydown listener that tracks the last N keys and fires
// triggerKonami() when they match the Konami code sequence. Called once by
// main.js during boot().
export function initKonamiWatcher() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    buffer.push(key);
    if (buffer.length > CODE.length) buffer.shift();
    if (buffer.length === CODE.length && buffer.every((k, i) => k === CODE[i])) {
      buffer = [];
      triggerKonami();
    }
  });
}

// Records the konami flag in state.js (once), plays a sound, pulses the
// screen with a rainbow effect, and shows a toast the first time it's
// triggered. Called by the keydown watcher above when the code is entered.
function triggerKonami() {
  const already = getState().flags.konami;
  setFlag('konami', true);
  sfx.coin();
  document.body.classList.add('konami-pulse');
  setTimeout(() => document.body.classList.remove('konami-pulse'), 1500);
  if (!already) showToast('CHEAT CODE ACCEPTED. 30 LIVES... just kidding. But ECHO noticed that.');
}

// Displays (creating on first use) the #konami-toast element with a
// message, auto-hiding it after a few seconds. Called by triggerKonami().
function showToast(message) {
  clearTimeout(toastTimer);
  let toast = document.getElementById('konami-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'konami-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}
