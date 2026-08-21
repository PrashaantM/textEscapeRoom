// Scene: Sector 4, "THE CORE". The final puzzle: the player enters the 4
// collected memory-shard digits (from state.js's state.shards, gathered in
// level1..level4) into a 4-digit keypad in the correct order. Unlike the
// original version, the ordering rule is no longer stated outright: it must
// be pieced together from 3 corrupted log fragments hidden in noise text
// (the same hide-in-garbage pattern used by level4.js's vault), and wrong
// entries are capped before a temporary lockout kicks in. A correct entry
// marks level 4 complete via completeLevel(4) (no new shard awarded here)
// and routes to the ending scene.

import { completeLevel, getState, SECTORS } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, pulse } from '../fx.js';
import { el, clamp, randInt, shuffle } from '../utils.js';
import { terminalFrame, asciiPre, showInterstitial } from './shared.js';
import { drawShard, drawPlayer } from '../sprites.js';
import { CORE_RING } from '../asciiArt.js';

const ROMAN = ['I', 'II', 'III', 'IV'];
const NOISE_CHARS = '!@#$%^&*<>{}[]()~/|;:+=01'.split('');
const MAX_WRONG_ATTEMPTS = 3;
const LOCKOUT_MS = 2500;

const FRAGMENTS = [
  'TIMESTAMP CHECK: SHARD I WAS LOGGED FIRST. SHARD IV WAS LOGGED LAST.',
  'CORE VERIFICATION ALWAYS READS THE MOST RECENT LOG ENTRY FIRST.',
  'SEQUENCE THEREFORE RUNS NEWEST TO OLDEST, ACROSS ALL FOUR SHARDS.',
];

// Generates a string of random noise characters. Mirrors level4.js's
// garbage() so both puzzles hide their tokens in the same visual clutter.
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
  // when this scene becomes active. Builds the shard case, the noise-hidden
  // log fragments, the 4-slot keypad, and the numpad UI, and wires keyboard
  // input as an alternative to clicking.
  mount(container, ctx) {
    const state = getState();
    const slots = ['0', '0', '0', '0'];
    let activeSlot = 0;
    let solved = false;
    let wrongAttempts = 0;
    let locked = false;

    const frame = terminalFrame({ title: 'SECTOR 4 // THE CORE', accent: '#b967ff' });
    const body = frame.querySelector('.term-body');

    const core = asciiPre(CORE_RING, 'core-art');
    const shardCase = el('div', { class: 'shard-case' },
      SECTORS.slice(0, 4).map((s, i) => el('div', { class: 'shard-slot' }, [
        drawShard(s.accent, 5),
        el('span', {}, `SHARD ${ROMAN[i]}: ${state.shards[i]}`),
      ]))
    );

    const clue = el('p', { class: 'core-clue' }, 'LOG_FRAGMENT ARCHIVE: CORRUPTED. Click the noise below to recover what the core remembers about entry order.');

    // ---- noise-hidden log fragments: click a token to decode it ----
    const noiseBox = el('div', { class: 'noise-box', role: 'group', 'aria-label': 'Corrupted core log' });
    const fragmentLog = el('div', { class: 'vault-log', role: 'log', 'aria-live': 'polite' });
    const rows = shuffle([
      ...FRAGMENTS.map((text) => ({ type: 'fragment', text })),
      { type: 'noise' }, { type: 'noise' },
    ]);
    rows.forEach((row) => {
      const line = el('div', { class: 'noise-row' });
      line.appendChild(el('span', { class: 'noise-addr' }, hexAddr()));
      if (row.type === 'noise') {
        line.appendChild(el('span', { class: 'noise-text' }, garbage(30)));
      } else {
        line.appendChild(el('span', { class: 'noise-text' }, garbage(randInt(3, 10))));
        const btn = el('button', {
          class: 'noise-token',
          onclick: () => {
            if (btn.classList.contains('used')) return;
            btn.classList.add('used');
            btn.disabled = true;
            sfx.reveal();
            fragmentLog.appendChild(el('p', { class: 'vault-log-line vault-hint' }, `LOG_FRAGMENT: "${row.text}"`));
            fragmentLog.scrollTop = fragmentLog.scrollHeight;
          },
        }, 'LOG_FRAGMENT.dat');
        line.appendChild(btn);
        line.appendChild(el('span', { class: 'noise-text' }, garbage(randInt(3, 10))));
      }
      noiseBox.appendChild(line);
    });

    const slotEls = [];
    const keypad = el('div', { class: 'keypad-slots' });
    for (let i = 0; i < 4; i++) {
      const btn = el('button', { class: 'keypad-slot', onclick: () => setActive(i) }, slots[i]);
      slotEls.push(btn);
      keypad.appendChild(btn);
    }

    const numpad = el('div', { class: 'numpad' });
    for (let n = 0; n <= 9; n++) {
      numpad.appendChild(el('button', { class: 'numpad-btn', onclick: () => setDigit(n) }, String(n)));
    }

    const status = el('p', { class: 'core-status', 'aria-live': 'polite' });
    const attemptsLine = el('p', { class: 'core-attempts' }, `WRONG ATTEMPTS BEFORE LOCKOUT: ${MAX_WRONG_ATTEMPTS}`);
    const submitBtn = el('button', { class: 'cta-btn', onclick: () => submit() }, 'OVERRIDE ▶');
    const playerItem = el('div', { class: 'player-sprite core-player' }, [drawPlayer('#b967ff', 6), el('span', {}, 'YOU')]);

    body.appendChild(core);
    body.appendChild(shardCase);
    body.appendChild(clue);
    body.appendChild(noiseBox);
    body.appendChild(fragmentLog);
    body.appendChild(el('div', { class: 'core-console' }, [playerItem, keypad]));
    body.appendChild(numpad);
    body.appendChild(attemptsLine);
    body.appendChild(status);
    body.appendChild(submitBtn);
    container.appendChild(el('div', { class: 'level5-scene' }, [frame]));

    // Redraws the 4 keypad slots with their current digits and highlights
    // the active one. Called whenever a slot or digit changes.
    function renderSlots() {
      slotEls.forEach((btn, i) => {
        btn.textContent = slots[i];
        btn.classList.toggle('active', i === activeSlot);
      });
    }
    renderSlots();

    // Moves focus to keypad slot `i` (clamped to 0-3). Called by clicking a
    // slot directly or via arrow-key navigation.
    function setActive(i) {
      if (locked) return;
      activeSlot = clamp(i, 0, 3);
      sfx.move();
      renderSlots();
    }

    // Sets the digit at the active slot and auto-advances to the next slot.
    // Called by numpad button clicks and number-key presses.
    function setDigit(d) {
      if (solved || locked) return;
      slots[activeSlot] = String(d);
      sfx.key();
      if (activeSlot < 3) activeSlot++;
      renderSlots();
    }

    // Compares the entered 4 digits against the shards in reverse order;
    // calls win() on a match, or tracks a wrong attempt (triggering
    // lockout() once MAX_WRONG_ATTEMPTS is hit) otherwise. Called by the
    // OVERRIDE button and the Enter key.
    function submit() {
      if (solved || locked) return;
      const guess = slots.join('');
      const expected = state.shards.slice().reverse().join('');
      if (guess === expected) {
        win();
        return;
      }
      sfx.error();
      shake(keypad);
      wrongAttempts++;
      if (wrongAttempts >= MAX_WRONG_ATTEMPTS) {
        lockout();
      } else {
        status.textContent = `ACCESS DENIED (${MAX_WRONG_ATTEMPTS - wrongAttempts} TRIES LEFT BEFORE LOCKOUT)`;
      }
      slots[0] = slots[1] = slots[2] = slots[3] = '0';
      activeSlot = 0;
      renderSlots();
    }

    // Handles hitting the wrong-attempt cap: locks input, glitches the
    // frame, and re-enables everything after a cooldown. Called by submit()
    // once wrongAttempts reaches MAX_WRONG_ATTEMPTS.
    async function lockout() {
      locked = true;
      status.textContent = 'CORE LOCKED. COOLDOWN IN PROGRESS...';
      glitchBurst(frame, LOCKOUT_MS);
      sfx.glitch();
      await new Promise((resolve) => setTimeout(resolve, LOCKOUT_MS));
      if (solved) return;
      locked = false;
      wrongAttempts = 0;
      status.textContent = 'COOLDOWN COMPLETE. TRY AGAIN.';
    }

    // Handles the correct code: plays effects, marks Sector 4 complete in
    // state.js, and shows the sector-cleared interstitial routing to the
    // ending scene. Called by submit() on a correct guess.
    function win() {
      solved = true;
      sfx.unlock();
      glitchBurst(frame, 600);
      pulse(core, 'fx-pulse', 900);
      pulse(playerItem, 'fx-pulse', 900);
      core.classList.add('core-stable');
      status.textContent = 'CORE ACCESS GRANTED';
      completeLevel(4);
      setTimeout(() => {
        showInterstitial(container.querySelector('.level5-scene'), {
          levelIndex: 4,
          storyBeat: 'ECHO: "That\'s... all of me. Every sector, every fragment. I remember now. I remember everything."',
          shardDigit: null,
          finalBeat: true,
          ctaLabel: 'CONTINUE ▶',
          onContinue: () => ctx.goTo('ending'),
        });
      }, 900);
    }

    window.addEventListener('keydown', (e) => {
      if (solved || locked) return;
      if (/^[0-9]$/.test(e.key)) { setDigit(Number(e.key)); return; }
      if (e.key === 'ArrowLeft') { setActive(activeSlot - 1); return; }
      if (e.key === 'ArrowRight') { setActive(activeSlot + 1); return; }
      if (e.key === 'Enter') submit();
    }, { signal: ctx.signal });
  },
};
