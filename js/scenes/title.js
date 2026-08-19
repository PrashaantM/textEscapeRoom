// Scene: the main title/menu screen, the first scene a new player sees
// (and the one sceneManager.js falls back to when nothing else applies).
// Offers Continue (if a save exists), New/Start Game, and Erase Data.
// Starting a new game resets state.js and routes to the callsign scene.

import { getState, resetGame, hasSave } from '../state.js';
import { sfx } from '../audio.js';
import { el } from '../utils.js';
import { asciiPre } from './shared.js';
import { drawGhost, drawFloppy } from '../sprites.js';
import { TITLE_LOGO } from '../asciiArt.js';

// Starts a new game: confirms with the player if a save would be
// overwritten, then resets state.js and navigates to the callsign scene.
// Called by the "NEW GAME"/"START GAME" menu item.
function newGame(ctx) {
  const proceed = () => {
    resetGame();
    ctx.goTo('callsign');
  };
  if (hasSave()) {
    if (confirm('Starting a new game will erase your current progress. Continue?')) proceed();
  } else {
    proceed();
  }
}

// Resumes the game at whatever scene was last saved in state.js (falling
// back to callsign). Called by the "CONTINUE" menu item.
function continueGame(ctx) {
  const state = getState();
  ctx.goTo(state.scene && state.scene !== 'title' ? state.scene : 'callsign');
}

// Confirms with the player, then wipes their save via state.js and stays on
// the title scene. Called by the "ERASE DATA" menu item.
function eraseData(ctx) {
  if (confirm('Erase all saved progress? This cannot be undone.')) {
    resetGame();
    ctx.goTo('title');
  }
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the menu (items vary based on
  // whether a save exists), wires arrow-key navigation, and renders the
  // logo/ghost/floppy art.
  mount(container, ctx) {
    const save = hasSave();
    const items = [];
    if (save) items.push({ label: '▶ CONTINUE', action: () => continueGame(ctx) });
    items.push({ label: save ? '★ NEW GAME' : '★ START GAME', action: () => newGame(ctx) });
    if (save) items.push({ label: '☠ ERASE DATA', action: () => eraseData(ctx) });

    const menu = el('div', { class: 'title-menu', role: 'menu', 'aria-label': 'Main menu' });
    let selected = 0;
    const buttons = items.map((item, i) => {
      const btn = el('button', {
        class: 'title-menu-item',
        role: 'menuitem',
        onclick: () => { sfx.confirm(); item.action(); },
        onfocus: () => { selected = i; renderSelection(false); },
      }, item.label);
      menu.appendChild(btn);
      return btn;
    });

    // Updates which menu button shows the "selected" highlight, and
    // optionally plays a move sound. Called on focus and arrow-key nav.
    function renderSelection(playSound) {
      buttons.forEach((b, i) => b.classList.toggle('selected', i === selected));
      if (playSound) sfx.move();
    }
    renderSelection(false);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selected = (selected + 1) % items.length;
        buttons[selected].focus();
        renderSelection(true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selected = (selected - 1 + items.length) % items.length;
        buttons[selected].focus();
        renderSelection(true);
      }
    }, { signal: ctx.signal });

    const logo = asciiPre(TITLE_LOGO, 'title-logo');
    const ghost = drawGhost('#7cf9d0', 9);
    ghost.classList.add('title-ghost');
    const floppy = drawFloppy('#4cd6ff', 6);
    floppy.classList.add('title-floppy');

    container.appendChild(el('div', { class: 'title-scene' }, [
      floppy,
      logo,
      el('p', { class: 'title-tagline' }, '[ AN OLD MACHINE REMEMBERS YOU ]'),
      ghost,
      menu,
      el('p', { class: 'title-hint' }, '↑↓ SELECT · ENTER CONFIRM · TRY THE KONAMI CODE'),
      el('p', { class: 'title-footer' }, 'ECHO.EXE: a browser escape room · originally textEscapeRoom'),
    ]));

    requestAnimationFrame(() => buttons[0].focus());
  },
};
