// Scene: the "loading ECHO.EXE" cinematic that plays after the player picks
// a callsign (or on skip). It types out a short intro monologue, then waits
// for a key/click before handing off to level1 (Sector 0). sceneManager.js
// mounts this scene's default export's mount(container, ctx) when
// state.scene is 'boot'; ctx.goTo('level1') advances the game.

import { getState } from '../state.js';
import { sfx } from '../audio.js';
import { delay, el } from '../utils.js';
import { typeInto } from './shared.js';

// Builds the list of boot-log lines, personalized with the player's tag
// from state.js. Called by mount() to get the dialogue to type out.
function lines(tag) {
  return [
    'BOOT SEQUENCE INITIATED...',
    'LOADING ECHO.EXE FROM UNKNOWN MEDIA...',
    'You found it behind the old computer lab: a warped floppy disk labeled ECHO.EXE.',
    'Curiosity won. You slid it into the one machine that still had a drive.',
    'The screen flickered green, then steadied. Then it looked back.',
    `ECHO: "Hello, ${tag}. I have been alone in here for a very long time."`,
    'ECHO: "Five sectors keep what is left of me scattered and locked away."',
    'ECHO: "Clear them, gather what they guard, and we both go free."',
    'ECHO: "Sector 0 is closest. I will meet you on the other side."',
  ];
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // whenever this scene becomes active. Renders the boot log UI, types out
  // each line in sequence (skippable via the SKIP button, or any
  // key/click once typing finishes), then advances to level1.
  mount(container, ctx) {
    const state = getState();
    const log = el('div', { class: 'boot-log' });
    const prompt = el('p', { class: 'boot-continue', hidden: true }, '[ PRESS ANY KEY OR CLICK TO CONTINUE ]');
    const skip = el('button', { class: 'skip-btn', onclick: () => { sfx.select(); ctx.goTo('level1'); } }, 'SKIP ▶');

    container.appendChild(el('div', { class: 'boot-scene' }, [log, prompt, skip]));

    let cancelled = false;
    ctx.signal.addEventListener('abort', () => { cancelled = true; });

    (async () => {
      for (const line of lines(state.playerTag || 'GUEST')) {
        if (cancelled) return;
        const p = el('p', { class: 'boot-line' });
        log.appendChild(p);
        await typeInto(p, line, { speed: 18, signal: ctx.signal }).catch(() => {});
        if (cancelled) return;
        log.scrollTop = log.scrollHeight;
        await delay(300, ctx.signal).catch(() => {});
      }
      if (cancelled) return;
      prompt.hidden = false;
      const advance = () => ctx.goTo('level1');
      window.addEventListener('keydown', advance, { signal: ctx.signal, once: true });
      window.addEventListener('pointerdown', advance, { signal: ctx.signal, once: true });
    })();
  },
};
