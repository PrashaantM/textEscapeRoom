import { getState } from './state.js';
import { setMuted } from './audio.js';
import { setCrtEnabled } from './fx.js';
import { initKonamiWatcher } from './konami.js';
import { goTo, openMenu, closeMenu, isMenuOpen } from './sceneManager.js';
import { qs } from './utils.js';

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
