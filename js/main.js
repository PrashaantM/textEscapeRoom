// Entry point for the whole game, loaded as a module script by index.html.
// It applies saved settings (mute, CRT effect), wires up global keyboard
// shortcuts and the Konami code watcher, then hands off control to
// sceneManager.js by calling goTo() with whatever scene was last saved
// (defaulting to 'title'). From here on, sceneManager.js drives everything.

import { getState } from './state.js';
import { setMuted } from './audio.js';
import { setCrtEnabled } from './fx.js';
import { initKonamiWatcher } from './konami.js';
import { goTo, openMenu, closeMenu, isMenuOpen } from './sceneManager.js';
import { qs } from './utils.js';

// One-time app startup: seeds stats.startedAt on a fresh save, applies
// persisted audio/CRT settings, starts the Konami watcher, wires the
// Escape key to the pause menu and a global error logger, then navigates to
// the saved (or default) scene. Called immediately below, once the DOM is
// ready.
function boot() {
  const state = getState();
  if (!state.stats.startedAt) state.stats.startedAt = Date.now();

  setMuted(!!state.settings.muted);
  setCrtEnabled(state.settings.crt !== false);

  initKonamiWatcher();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const bar = qs('#statusbar');
      if (bar && !bar.hidden) {
        isMenuOpen() ? closeMenu() : openMenu();
      }
    }
  });

  window.addEventListener('error', (e) => {
    console.error('[ECHO.EXE] runtime error', e.error || e.message);
  });

  goTo(state.scene || 'title');
}

// Run boot() once the DOM is parsed, whether this script executed before or
// after that point.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
