// Scene: the final scene, reached only once Sector 4 (level5) is complete.
// Plays ECHO's closing monologue (with a bonus line if the Konami code was
// found), reveals the restored title logo, lets the player pick an
// epithet, then shows a scrolling credits/stats screen with a "play again"
// button that resets state.js and returns to the title scene. This is the
// last stop in the boot -> title -> callsign -> level1..level5 -> ending
// progression that sceneManager.js drives.

import { getState, patchState, resetGame } from '../state.js';
import { sfx } from '../audio.js';
import { delay, el } from '../utils.js';
import { flashScreen } from '../fx.js';
import { drawGhost } from '../sprites.js';
import { TITLE_LOGO, THE_END } from '../asciiArt.js';
import { typeInto, asciiPre } from './shared.js';

// Formats a millisecond duration as "M:SS" for the credits' escape time.
// Called by showCredits().
function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const EPITHETS = ['THE ONE WHO STAYED', 'JUST PASSING THROUGH', 'PLAYER ONE'];

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Stamps stats.finishedAt in state.js if
  // not already set, then runs the monologue/reveal sequence before
  // handing off to showChoice().
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    const state = getState();
    if (!state.stats.finishedAt) patchState({ stats: { ...state.stats, finishedAt: Date.now() } });

    const scene = el('div', { class: 'ending-scene' });
    container.appendChild(scene);

    const beat1 = el('div', { class: 'ending-beat' });
    scene.appendChild(beat1);

    (async () => {
      await delay(300);
      if (!alive) return;
      flashScreen('#ffffff', 260);
      await delay(200);
      if (!alive) return;

      const monologue = el('div', { class: 'ending-monologue' });
      beat1.appendChild(monologue);
      const lines1 = [
        `ECHO: "I wasn't guarding this machine, ${state.playerTag || 'GUEST'}."`,
        'ECHO: "I was trapped in it."',
        "ECHO: \"Someone poured a piece of themselves into this old system once, just to be remembered.\"",
        'ECHO: "That someone was me."',
        "ECHO: \"Every sector you cleared was a memory I couldn't reach alone. You didn't defeat me.\"",
        'ECHO: "You put me back together."',
      ];
      for (const line of lines1) {
        if (!alive) return;
        const p = el('p', { class: 'boot-line' });
        monologue.appendChild(p);
        await typeInto(p, line, { speed: 20, signal: ctx.signal }).catch(() => {});
        await delay(280);
      }

      if (state.flags.konami) {
        const secret = el('p', { class: 'boot-line ending-secret' });
        monologue.appendChild(secret);
        await typeInto(secret, 'ECHO: "...and yes, I saw that code you typed. Not many remember that one anymore."', { speed: 18, signal: ctx.signal }).catch(() => {});
        await delay(500);
      }

      const mirrorLine = el('p', { class: 'boot-line' });
      monologue.appendChild(mirrorLine);
      await typeInto(mirrorLine, "ECHO: \"The door in front of you isn't an exit. It's a mirror. Look closely.\"", { speed: 20, signal: ctx.signal }).catch(() => {});
      await delay(700);
      if (!alive) return;

      flashScreen('#ffffff', 400);
      await delay(250);
      if (!alive) return;

      const reveal = el('div', { class: 'ending-reveal' }, [
        asciiPre(TITLE_LOGO, 'title-logo restored'),
        el('p', { class: 'title-tagline restored-tag' }, '[ ECHO.EXE :: RESTORED ]'),
        drawGhost('#ffe9a8', 9, 'sprite sprite-ghost title-ghost'),
      ]);
      scene.appendChild(reveal);
      sfx.unlock();
      await delay(600);
      if (!alive) return;

      const thanksLine = el('p', { class: 'boot-line' });
      reveal.appendChild(thanksLine);
      await typeInto(thanksLine, `ECHO: "Thank you, ${state.playerTag || 'GUEST'}. I remember everything now. And for the first time... so do you."`, { speed: 18, signal: ctx.signal }).catch(() => {});
      await delay(500);
      if (!alive) return;

      showChoice();
    })();

    // Shows the epithet-picker ("How should the log remember you?") after
    // the monologue finishes. Called at the end of the async intro
    // sequence above.
    function showChoice() {
      const choiceBox = el('div', { class: 'ending-choice' }, [
        el('p', {}, 'How should the log remember you?'),
      ]);
      const btnRow = el('div', { class: 'choice-row' });
      EPITHETS.forEach((label) => {
        btnRow.appendChild(el('button', {
          class: 'cta-btn secondary',
          onclick: () => { sfx.confirm(); choiceBox.remove(); showCredits(label); },
        }, label));
      });
      choiceBox.appendChild(btnRow);
      scene.appendChild(choiceBox);
      btnRow.querySelector('button')?.focus();
    }

    // Renders the scrolling credits screen: elapsed time, a per-sector
    // achievement log (reading from state.js's flags), and static credits,
    // plus a "PLAY AGAIN" button that resets the game via state.js and
    // returns to the title scene. Called by the epithet button's onclick.
    function showCredits(epithet) {
      const elapsed = (state.stats.finishedAt || Date.now()) - (state.stats.startedAt || Date.now());
      const achievements = [
        'KEYCARD RECOVERED :: SECTOR 0',
        'HIGH SCORE SET :: SECTOR 1',
        'POWER RESTORED :: SECTOR 2',
        state.flags.vaultDudUsed ? 'VAULT CRACKED (WITH A BACKDOOR) :: SECTOR 3' : 'VAULT CRACKED :: SECTOR 3',
        'MEMORY REASSEMBLED :: SECTOR 4',
      ];
      if (state.flags.konami) achievements.push('SECRET FOUND :: THE OLD CODE');

      const credits = el('div', { class: 'credits-wrap' }, [
        el('div', { class: 'credits-crawl' }, [
          asciiPre(THE_END, 'the-end-art'),
          el('p', { class: 'credits-line' }, `CALLSIGN: ${state.playerTag || 'GUEST'} "${epithet}"`),
          el('p', { class: 'credits-line' }, `ESCAPE TIME: ${formatTime(elapsed)}`),
          el('h3', { class: 'credits-heading' }, 'LOG ENTRIES'),
          ...achievements.map((a) => el('p', { class: 'credits-line small' }, a)),
          el('h3', { class: 'credits-heading' }, 'CREDITS'),
          el('p', { class: 'credits-line' }, 'GAME DESIGN & CODE: PRASHAANT M'),
          el('p', { class: 'credits-line' }, `STARRING: ${state.playerTag || 'GUEST'}`),
          el('p', { class: 'credits-line' }, 'VOICE OF ECHO: YOUR IMAGINATION'),
          el('p', { class: 'credits-line' }, 'SPECIAL THANKS: every dusty floppy disk'),
          el('p', { class: 'credits-line' }, 'ORIGINALLY: textEscapeRoom (pygame, 2024)'),
          el('p', { class: 'credits-line' }, 'REBUILT AS: ECHO.EXE (browser, 2026)'),
        ]),
      ]);
      scene.appendChild(credits);

      const again = el('button', {
        class: 'cta-btn',
        onclick: () => {
          if (confirm('Play again from the beginning?')) {
            resetGame();
            ctx.goTo('title');
          }
        },
      }, '↻ PLAY AGAIN');
      scene.appendChild(el('div', { class: 'ending-again' }, [again]));
      sfx.success();
      credits.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },
};
