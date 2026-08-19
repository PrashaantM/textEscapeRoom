import { getState, patchState, resetGame, SECTORS } from './state.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { setCrtEnabled, glitchBurst } from './fx.js';
import { el, qs } from './utils.js';

import titleScene from './scenes/title.js';
import callsignScene from './scenes/callsign.js';
import bootScene from './scenes/boot.js';
import level1Scene from './scenes/level1.js';
import level2Scene from './scenes/level2.js';
import level3Scene from './scenes/level3.js';
import level4Scene from './scenes/level4.js';
import level5Scene from './scenes/level5.js';
import endingScene from './scenes/ending.js';

const SCENES = {
  title: { mod: titleScene, chrome: false },
  callsign: { mod: callsignScene, chrome: false },
  boot: { mod: bootScene, chrome: false },
  level1: { mod: level1Scene, chrome: true, index: 0 },
  level2: { mod: level2Scene, chrome: true, index: 1 },
  level3: { mod: level3Scene, chrome: true, index: 2 },
  level4: { mod: level4Scene, chrome: true, index: 3 },
  level5: { mod: level5Scene, chrome: true, index: 4 },
  ending: { mod: endingScene, chrome: false },
};

let currentId = null;
let currentController = null;
let currentCleanup = null;

function canEnter(id) {
  const cfg = SCENES[id];
  if (!cfg) return false;
  if (id === 'ending') return getState().levelsCompleted[4] === true;
  if (cfg.index === undefined || cfg.index === 0) return true;
  return getState().levelsCompleted[cfg.index - 1] === true;
}

function fallbackScene() {
  const state = getState();
  const idx = state.levelsCompleted.findIndex((v) => !v);
  if (idx === -1) return 'ending';
  if (idx === 0 && !state.playerTag) return 'title';
  return `level${idx + 1}`;
}

export function goTo(id) {
  if (!SCENES[id]) {
    console.warn('[ECHO.EXE] unknown scene', id);
    id = 'title';
  }
  if (!canEnter(id)) {
    id = fallbackScene();
  }

  if (currentController) currentController.abort();
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (err) { console.error(err); }
  }

  const app = qs('#app');
  app.innerHTML = '';
  app.className = `scene scene--${id}`;

  currentId = id;
  patchState({ scene: id });

  const cfg = SCENES[id];
  renderChrome(cfg.chrome, cfg.index);

  currentController = new AbortController();
  const ctx = buildCtx(currentController.signal);

  const result = cfg.mod.mount(app, ctx);
  currentCleanup = typeof result === 'function' ? result : null;
}

export function restartCurrent() {
  goTo(currentId);
}

function buildCtx(signal) {
  return {
    get state() { return getState(); },
    signal,
    goTo,
    sfx,
    glitchBurst,
    openMenu,
    closeMenu,
  };
}

// ---- Chrome: top status bar shown during levels ----

function renderChrome(show, levelIndex) {
  let bar = qs('#statusbar');
  if (!show) {
    if (bar) bar.hidden = true;
    return;
  }
  if (!bar) return;
  bar.hidden = false;
  bar.innerHTML = '';
  const sector = SECTORS[levelIndex];
  bar.style.setProperty('--accent', sector.accent);

  const dots = el('div', { class: 'progress-dots', role: 'list', 'aria-label': 'Sector progress' },
    SECTORS.map((s, i) => el('span', {
      class: 'dot' + (getState().levelsCompleted[i] ? ' dot--done' : i === levelIndex ? ' dot--active' : ''),
      role: 'listitem',
      title: `${s.name}: ${s.title}`,
    }))
  );

  const label = el('div', { class: 'sector-label' }, [
    el('span', { class: 'sector-name' }, sector.name),
    el('span', { class: 'sector-title' }, sector.title),
  ]);

  const controls = el('div', { class: 'chrome-controls' }, [
    el('button', {
      class: 'icon-btn',
      'aria-label': isMuted() ? 'Unmute sound' : 'Mute sound',
      onclick: (e) => {
        const muted = !isMuted();
        setMuted(muted);
        patchState({ settings: { ...getState().settings, muted } });
        e.currentTarget.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
        e.currentTarget.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
      },
    }, isMuted() ? '\u{1F507}' : '\u{1F50A}'),
    el('button', { class: 'icon-btn', 'aria-label': 'Menu', onclick: () => openMenu() }, '≡'),
  ]);

  bar.appendChild(label);
  bar.appendChild(dots);
  bar.appendChild(controls);
}

// ---- Pause menu overlay ----

export function openMenu() {
  const overlay = qs('#pause-menu');
  overlay.hidden = false;
  overlay.innerHTML = '';
  sfx.select();
  const state = getState();

  const panel = el('div', { class: 'pause-panel' }, [
    el('h2', {}, 'SYSTEM MENU'),
    el('button', { class: 'menu-btn', onclick: () => closeMenu() }, '▶ RESUME'),
    el('button', {
      class: 'menu-btn',
      onclick: () => { closeMenu(); restartCurrent(); },
    }, '↻ RESTART SECTOR'),
    el('button', {
      class: 'menu-btn',
      onclick: () => {
        if (confirm('Erase all progress and return to Sector 0? This cannot be undone.')) {
          resetGame();
          closeMenu();
          goTo('title');
        }
      },
    }, '☠ RESTART GAME'),
    el('button', {
      class: 'menu-btn',
      onclick: (e) => {
        const muted = !isMuted();
        setMuted(muted);
        patchState({ settings: { ...getState().settings, muted } });
        e.currentTarget.textContent = `\u{1F50A} SOUND: ${muted ? 'OFF' : 'ON'}`;
      },
    }, `\u{1F50A} SOUND: ${state.settings.muted ? 'OFF' : 'ON'}`),
    el('button', {
      class: 'menu-btn',
      onclick: (e) => {
        const crt = document.body.classList.contains('crt-off');
        setCrtEnabled(crt);
        patchState({ settings: { ...getState().settings, crt } });
        e.currentTarget.textContent = `▒ CRT FX: ${crt ? 'ON' : 'OFF'}`;
      },
    }, `▒ CRT FX: ${state.settings.crt ? 'ON' : 'OFF'}`),
    el('button', { class: 'menu-btn', onclick: () => { closeMenu(); goTo('title'); } }, '⌂ QUIT TO TITLE'),
  ]);

  overlay.appendChild(el('div', { class: 'pause-backdrop', onclick: () => closeMenu() }));
  overlay.appendChild(panel);
}

export function closeMenu() {
  const overlay = qs('#pause-menu');
  overlay.hidden = true;
  overlay.innerHTML = '';
}

export function isMenuOpen() {
  const overlay = qs('#pause-menu');
  return overlay && !overlay.hidden;
}
