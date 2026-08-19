// The game's router. This module owns which scene is currently mounted into
// #app, drives transitions between scenes (boot -> title -> callsign ->
// boot -> level1..level5 -> ending), and renders the shared chrome (top
// status bar and pause menu) around the level scenes. Each scene module
// (js/scenes/*.js) exports a `mount(container, ctx)` function; goTo()/
// mountScene() call that function whenever a scene becomes active and hand
// it a `ctx` object (state accessor, sfx, goTo, menu controls, an
// AbortSignal for cleanup). Scene progression itself is guarded against
// state.js's levelsCompleted array, so a player can't skip ahead by URL or
// stale save data. main.js calls goTo() once on startup to kick everything
// off.

import { getState, patchState, resetGame, SECTORS } from './state.js';
import { sfx, setMuted, isMuted } from './audio.js';
import { setCrtEnabled, glitchBurst, reducedMotion } from './fx.js';
import { el, qs } from './utils.js';
import { drawPlayer } from './sprites.js';

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

// Gatekeeper for scene entry: a level scene is only reachable once the
// previous level is marked complete in state.js, and 'ending' requires
// sector 4 (level5) to be done. Called by goTo() before mounting anything.
function canEnter(id) {
  const cfg = SCENES[id];
  if (!cfg) return false;
  if (id === 'ending') return getState().levelsCompleted[4] === true;
  if (cfg.index === undefined || cfg.index === 0) return true;
  return getState().levelsCompleted[cfg.index - 1] === true;
}

// Figures out the scene a player should land on when canEnter() rejects
// their requested destination: the next unfinished level, 'ending' if
// everything is done, or 'title' if they haven't even picked a callsign yet.
function fallbackScene() {
  const state = getState();
  const idx = state.levelsCompleted.findIndex((v) => !v);
  if (idx === -1) return 'ending';
  if (idx === 0 && !state.playerTag) return 'title';
  return `level${idx + 1}`;
}

// Main navigation entry point. Called by every scene (via ctx.goTo), by
// main.js on boot, and by the pause menu. Validates the target scene,
// falls back if it isn't reachable yet, and fades the #app container out
// before swapping in the new scene (skipped for the very first load or
// when the user prefers reduced motion).
export function goTo(id) {
  if (!SCENES[id]) {
    console.warn('[ECHO.EXE] unknown scene', id);
    id = 'title';
  }
  if (!canEnter(id)) {
    id = fallbackScene();
  }

  const app = qs('#app');
  const swap = () => mountScene(id, app);

  // First load, or reduced-motion: swap immediately, no fade.
  if (!currentId || reducedMotion()) {
    swap();
    return;
  }

  app.classList.add('scene-out');
  setTimeout(swap, 160);
}

// Tears down the previous scene (aborts its AbortController and runs its
// cleanup callback, if any) and mounts the new one into the #app container.
// Called by goTo() after the fade-out delay. Persists the new scene id to
// state.js so a reload resumes on the correct scene, and renders the shared
// status-bar chrome for level scenes.
function mountScene(id, app) {
  if (currentController) currentController.abort();
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (err) { console.error(err); }
  }

  app.innerHTML = '';
  app.className = `scene scene--${id} scene-enter`;

  currentId = id;
  patchState({ scene: id });

  const cfg = SCENES[id];
  renderChrome(cfg.chrome, cfg.index);

  currentController = new AbortController();
  const ctx = buildCtx(currentController.signal);

  const result = cfg.mod.mount(app, ctx);
  currentCleanup = typeof result === 'function' ? result : null;

  requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('scene-enter')));
}

// Re-mounts whatever scene is currently active, giving it a clean slate.
// Called by the pause menu's "RESTART SECTOR" button.
export function restartCurrent() {
  goTo(currentId);
}

// Assembles the context object passed to every scene's mount(container, ctx)
// call: a live state getter, the abort signal for this scene's lifetime,
// navigation (goTo), sound effects, and menu controls.
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

// Builds (or hides) the #statusbar element: sector progress dots, the
// player marker, sector name/step label, and mute/menu buttons. Called by
// mountScene() on every scene change; `show` is false for non-level scenes
// (title, callsign, boot, ending) which run without chrome.
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

  const dots = el('div', { class: 'progress-dots', style: `--count:${SECTORS.length}`, role: 'list', 'aria-label': 'Sector progress' },
    SECTORS.map((s, i) => el('span', {
      class: 'dot' + (getState().levelsCompleted[i] ? ' dot--done' : i === levelIndex ? ' dot--active' : ''),
      role: 'listitem',
      title: `${s.name}: ${s.title}`,
    }))
  );

  const playerMarker = el('div', {
    class: 'progress-player',
    style: `--count:${SECTORS.length}; --pos:${levelIndex}`,
    'aria-hidden': 'true',
  }, [drawPlayer(sector.accent, 2)]);

  const track = el('div', { class: 'progress-wrap' }, [playerMarker, dots]);

  const label = el('div', { class: 'sector-label' }, [
    el('span', { class: 'sector-name' }, sector.name),
    el('span', { class: 'sector-step' }, `STEP ${levelIndex + 1} OF ${SECTORS.length}`),
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
  bar.appendChild(track);
  bar.appendChild(controls);
}

// ---- Pause menu overlay ----

// Builds and shows the #pause-menu overlay (resume, restart sector, restart
// game, sound/CRT toggles, quit to title). Called from the status bar's
// menu button, from main.js's Escape-key handler, and exposed to scenes via
// ctx.openMenu.
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

// Hides and clears the pause menu overlay. Called by the menu's own buttons,
// by main.js's Escape-key handler, and exposed to scenes via ctx.closeMenu.
export function closeMenu() {
  const overlay = qs('#pause-menu');
  overlay.hidden = true;
  overlay.innerHTML = '';
}

// Reports whether the pause menu overlay is currently visible. Used by
// main.js's Escape-key handler to decide whether Escape should open or
// close the menu.
export function isMenuOpen() {
  const overlay = qs('#pause-menu');
  return overlay && !overlay.hidden;
}
