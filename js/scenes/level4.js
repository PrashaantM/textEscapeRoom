// Scene: Sector 3, "VAULT BREACH". A 6-letter passkey puzzle: 4 of the 6
// letter+position pairs are hidden as clickable clue cards woven into the
// vault antechamber's room visual, and the remaining 2 are hidden as
// noise-buried tokens in the terminal (the same hide-in-garbage pattern the
// old word-guessing version used). The player gets 2 scored guesses at the
// 6-letter vault keypad; a wrong first guess reveals the correct letter for
// every missed position, so the second guess is always solvable from there.
// Solving it awards the fourth memory shard via completeLevel(3, digit) and
// routes to level5.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, pulse } from '../fx.js';
import { el, randInt, sample, shuffle } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import { drawPadlock, drawDoor, drawPlayer, drawClueTag, drawVaultCam } from '../sprites.js';

const WORD_BANK = ['ECHOES', 'ARCADE', 'MEMORY', 'BOOTUP', 'CIPHER', 'GLITCH', 'SHADOW', 'SILENT', 'ENIGMA', 'ORACLE'];
const NOISE_CHARS = '!@#$%^&*<>{}[]()~/|;:+=01'.split('');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROOM_HOTSPOTS = [
  { label: 'TORN POSTER', aria: 'A torn poster corner on the vault wall' },
  { label: 'FLOOR GRATE', aria: 'A loose floor grate' },
  { label: 'FLICKERING MONITOR', aria: 'A flickering wall monitor' },
  { label: 'LOOSE VENT', aria: 'A loose vent panel' },
];

// Generates a string of random noise characters. Used to pad terminal rows
// with visual clutter that hides the real clue tokens.
function garbage(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += NOISE_CHARS[randInt(0, NOISE_CHARS.length - 1)];
  return s;
}

function hexAddr() {
  const chars = '0123456789ABCDEF';
  let s = '0x';
  for (let i = 0; i < 4; i++) s += chars[randInt(0, 15)];
  return s;
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Picks the round's passkey and clue
  // split, builds the vault antechamber room + terminal keypad UI.
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    const passkey = sample(WORD_BANK, 1)[0];
    const positions = shuffle([0, 1, 2, 3, 4, 5]);
    const roomPositions = positions.slice(0, 4).sort((a, b) => a - b);
    const termPositions = positions.slice(4).sort((a, b) => a - b);

    const guess = ['', '', '', '', '', ''];
    let activeSlot = 0;
    let attemptsUsed = 0;
    let solved = false;

    // ---- vault antechamber room visual: door, camera, and 4 clue hotspots ----
    const roomScene = el('div', { class: 'room-scene', 'aria-hidden': 'true' });
    const playerItem = el('div', { class: 'player-sprite' }, [drawPlayer('#00ff9c', 6), el('span', {}, 'YOU')]);
    const doorItem = el('div', { class: 'room-item' }, [drawDoor(true, 10), el('span', {}, 'VAULT: SEALED')]);
    const camItem = el('div', { class: 'room-item room-decor' }, [drawVaultCam('#00ff9c', 6), el('span', {}, 'CAMERA')]);
    roomScene.append(playerItem, camItem, doorItem);

    const hotspotEls = roomPositions.map((pos, i) => {
      const info = ROOM_HOTSPOTS[i];
      const letter = passkey[pos];
      let revealed = false;
      const iconWrap = el('span', {}, [drawClueTag('#00ff9c', 5)]);
      const label = el('span', {}, info.label);
      const btn = el('button', {
        class: 'room-item room-item-btn clue-hotspot',
        'aria-label': info.aria,
        onclick: () => {
          if (revealed) return;
          revealed = true;
          sfx.reveal();
          iconWrap.innerHTML = '';
          iconWrap.appendChild(drawClueTag('#ffd166', 5));
          label.textContent = `POS ${pos + 1}: ${letter}`;
          btn.classList.add('clue-hotspot--revealed');
          pulse(btn, 'fx-pulse', 700);
        },
      }, [iconWrap, label]);
      return btn;
    });
    roomScene.append(...hotspotEls);

    const frame = terminalFrame({ title: 'SECTOR 3 // VAULT BREACH', accent: '#00ff9c' });
    const body = frame.querySelector('.term-body');
    const vaultBadge = el('div', { class: 'vault-badge' }, [drawPadlock('#00ff9c', 7), el('span', {}, 'VAULT: SEALED')]);
    const intro = el('p', { class: 'level-intro' }, `Find the ${'█'.repeat(6)}-letter passkey. 4 letters are hidden in the room. 2 more are buried in the noise below. You get 2 scored guesses.`);
    const hud = el('div', { class: 'vault-hud' });
    const noiseBox = el('div', { class: 'noise-box', role: 'group', 'aria-label': 'Terminal noise' });
    const log = el('div', { class: 'vault-log', role: 'log', 'aria-live': 'polite' });
    const lockMsg = el('p', { class: 'vault-lock-msg' });

    // ---- 6-slot letter entry + A-Z grid ----
    const slotEls = [];
    const slotsRow = el('div', { class: 'keypad-slots vault-letter-slots' });
    for (let i = 0; i < 6; i++) {
      const btn = el('button', { class: 'keypad-slot', onclick: () => setActive(i) }, '_');
      slotEls.push(btn);
      slotsRow.appendChild(btn);
    }
    const letterGrid = el('div', { class: 'letter-grid' });
    LETTERS.forEach((ltr) => {
      letterGrid.appendChild(el('button', { class: 'numpad-btn letter-btn', onclick: () => setLetter(ltr) }, ltr));
    });
    const submitBtn = el('button', { class: 'cta-btn', onclick: () => submitGuess() }, 'SUBMIT PASSKEY ▶');

    body.appendChild(vaultBadge);
    body.appendChild(intro);
    body.appendChild(hud);
    body.appendChild(noiseBox);
    body.appendChild(log);
    body.appendChild(slotsRow);
    body.appendChild(letterGrid);
    body.appendChild(submitBtn);
    body.appendChild(lockMsg);
    container.appendChild(el('div', { class: 'level4-scene split-scene' }, [roomScene, frame]));

    // Redraws the attempts-remaining HUD. Called on setup and after every
    // scored guess.
    function renderHud() {
      hud.innerHTML = '';
      const left = Math.max(0, 2 - attemptsUsed);
      hud.appendChild(el('span', {}, `SCORED GUESSES LEFT: ${left}`));
      hud.appendChild(el('span', {}, `PASSKEY LENGTH: 6`));
    }
    renderHud();

    // Redraws the 6 letter slots with their current entries and highlights
    // the active one. Called whenever a slot or letter changes.
    function renderSlots() {
      slotEls.forEach((btn, i) => {
        btn.textContent = guess[i] || '_';
        btn.classList.toggle('active', i === activeSlot);
      });
    }
    renderSlots();

    function setActive(i) {
      if (solved) return;
      activeSlot = Math.max(0, Math.min(5, i));
      sfx.move();
      renderSlots();
    }

    function setLetter(ltr) {
      if (solved) return;
      guess[activeSlot] = ltr;
      sfx.key();
      if (activeSlot < 5) activeSlot++;
      renderSlots();
    }

    // Builds the noise rows hiding the 2 terminal clue tokens among pure
    // garbage rows. Called once on mount.
    function buildNoise() {
      const rows = shuffle([
        ...termPositions.map((pos) => ({ type: 'clue', pos })),
        { type: 'noise' }, { type: 'noise' }, { type: 'noise' },
      ]);
      noiseBox.innerHTML = '';
      rows.forEach((row) => {
        const line = el('div', { class: 'noise-row' });
        line.appendChild(el('span', { class: 'noise-addr' }, hexAddr()));
        if (row.type === 'noise') {
          line.appendChild(el('span', { class: 'noise-text' }, garbage(30)));
        } else {
          line.appendChild(el('span', { class: 'noise-text' }, garbage(randInt(3, 12))));
          const btn = el('button', {
            class: 'noise-token',
            onclick: () => {
              if (btn.classList.contains('used')) return;
              btn.classList.add('used');
              btn.disabled = true;
              sfx.reveal();
              logLine(`CLUE FRAGMENT: POSITION ${row.pos + 1} = "${passkey[row.pos]}"`, 'vault-hint');
            },
          }, 'CLUE.frag');
          line.appendChild(btn);
          line.appendChild(el('span', { class: 'noise-text' }, garbage(randInt(3, 12))));
        }
        noiseBox.appendChild(line);
      });
    }
    buildNoise();

    // Appends a plain status/hint line to the log. Used for guess feedback
    // and clue reveals.
    function logLine(text, cls = '') {
      log.appendChild(el('p', { class: `vault-log-line ${cls}`.trim() }, text));
      log.scrollTop = log.scrollHeight;
    }

    // Scores the current guess against the passkey and prints per-position
    // hit/miss feedback. After the first wrong guess, reveals the correct
    // letter for every missed position so the second guess is guaranteed
    // solvable. Called by submitGuess().
    function renderFeedback(word, revealMisses) {
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const hit = word[i] === passkey[i];
        letters.push(el('span', { class: hit ? 'vault-letter-hit' : 'vault-letter-miss' }, word[i] || '_'));
      }
      const row = el('p', { class: 'vault-log-line' }, ['> ', ...letters]);
      log.appendChild(row);
      if (revealMisses) {
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== passkey[i]) logLine(`POSITION ${i + 1} WAS WRONG. CORRECT LETTER: ${passkey[i]}`, 'vault-hint');
        }
      }
      log.scrollTop = log.scrollHeight;
    }

    // Handles pressing SUBMIT PASSKEY: checks for a win, otherwise scores
    // the guess (revealing misses after the first wrong attempt) and clamps
    // attemptsUsed so a fumbled third try never permanently locks the
    // puzzle. Called by the submit button and not otherwise gated by
    // remaining "scored" guesses past the first two.
    function submitGuess() {
      if (solved) return;
      const word = guess.join('');
      if (word.length < 6 || word.includes('')) {
        logLine('Fill all 6 letters before submitting.', 'vault-hint');
        return;
      }
      if (word === passkey) {
        renderFeedback(word, false);
        win();
        return;
      }
      sfx.error();
      shake(frame);
      attemptsUsed++;
      renderFeedback(word, attemptsUsed === 1);
      if (attemptsUsed >= 2) {
        logLine(`FULL PASSKEY ON RECORD: ${passkey}. Re-enter it to confirm.`, 'vault-hint');
      }
      renderHud();
    }

    // Handles guessing the correct passkey: opens the vault visually, marks
    // the level complete in state.js with the fourth shard digit, and shows
    // the sector-cleared interstitial routing to level5. Called by
    // submitGuess() on a correct guess.
    function win() {
      solved = true;
      sfx.unlock();
      glitchBurst(frame, 400);
      vaultBadge.classList.add('vault-badge--open');
      vaultBadge.querySelector('span').textContent = 'VAULT: OPEN';
      doorItem.innerHTML = '';
      doorItem.append(drawDoor(false, 10), el('span', {}, 'VAULT: OPEN'));
      pulse(doorItem, 'fx-pulse', 700);
      pulse(playerItem, 'fx-pulse', 700);
      const digit = getState().codeDigits[3];
      completeLevel(3, digit);
      noiseBox.querySelectorAll('button').forEach((b) => (b.disabled = true));
      hotspotEls.forEach((b) => (b.disabled = true));
      setTimeout(() => {
        if (!alive) return;
        showInterstitial(container.querySelector('.level4-scene'), {
          levelIndex: 3,
          storyBeat: 'ECHO: "Vault open. That was the last of me scattered outside the Core. Everything else... is in there with me."',
          shardDigit: digit,
          ctaLabel: 'ENTER THE CORE ▶',
          onContinue: () => ctx.goTo('level5'),
        });
      }, 500);
    }
  },
};
