import { setFlag, getState } from './state.js';
import { sfx } from './audio.js';

const CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let buffer = [];
let toastTimer = null;

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

function triggerKonami() {
  const already = getState().flags.konami;
  setFlag('konami', true);
  sfx.coin();
  document.body.classList.add('konami-pulse');
  setTimeout(() => document.body.classList.remove('konami-pulse'), 1500);
  if (!already) showToast('CHEAT CODE ACCEPTED. 30 LIVES... just kidding. But ECHO noticed that.');
}

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
