// Scene: Sector 3, "VAULT BREACH". A Mastermind-style guessing puzzle: 6
// candidate words are hidden in noisy terminal output, one is the secret
// passkey, and the player has a limited number of attempts to find it by
// guessing words and reading how many letters land in the correct position.
// Two bracket-pair tokens hidden in the noise grant a one-time "remove a
// dud" or "restore an attempt" bonus (tracked via state.js's vaultDudUsed /
// vaultAttemptRestored flags). Solving it awards the fourth memory shard
// via completeLevel(3, digit) and routes to level5.

import { completeLevel, getState, setFlag } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, pulse } from '../fx.js';
import { el, delay, randInt, sample, shuffle } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import { drawPadlock, drawDoor, drawPlayer } from '../sprites.js';

const WORD_BANK = ['ECHOES', 'ARCADE', 'MEMORY', 'BOOTUP', 'CIPHER', 'GLITCH', 'SHADOW', 'SILENT', 'ENIGMA', 'ORACLE'];
const NOISE_CHARS = '!@#$%^&*<>{}[]()~/|;:+=01'.split('');
const START_ATTEMPTS = 4;

// Generates a string of random noise characters of the given length. Used
// to pad terminal rows with visual clutter that hides the real tokens.
function garbage(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += NOISE_CHARS[randInt(0, NOISE_CHARS.length - 1)];
  return s;
}

// Generates a random 4-digit hex address string (e.g. "0x1A2B") used as
// flavor text at the start of each noise row.
function hexAddr() {
  const chars = '0123456789ABCDEF';
  let s = '0x';
  for (let i = 0; i < 4; i++) s += chars[randInt(0, 15)];
  return s;
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Sets up the vault UI shell, then calls
  // setup() to generate the first puzzle round.
  mount(container, ctx) {
    let candidates, passkey, attemptsLeft, guessLog, dudBtn, attemptBtn, wordButtons, alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    const roomScene = el('div', { class: 'room-scene', 'aria-hidden': 'true' }, [
      el('div', { class: 'player-sprite' }, [drawPlayer('#00ff9c', 6), el('span', {}, 'YOU')]),
      el('div', { class: 'room-item' }, [drawDoor(true, 10), el('span', {}, 'VAULT: SEALED')]),
    ]);

    const frame = terminalFrame({ title: 'SECTOR 3 // VAULT BREACH', accent: '#00ff9c' });
    const body = frame.querySelector('.term-body');
    const vaultBadge = el('div', { class: 'vault-badge' }, [drawPadlock('#00ff9c', 7), el('span', {}, 'VAULT: SEALED')]);
    const intro = el('p', { class: 'level-intro' }, `Find the ${'█'.repeat(6)}-length passkey. Each guess reports how many letters are correct AND in position. Watch for bracket pairs hiding in the noise.`);
    const hud = el('div', { class: 'vault-hud' });
    const noiseBox = el('div', { class: 'vault-noise', role: 'group', 'aria-label': 'Terminal noise' });
    const log = el('div', { class: 'vault-log', role: 'log', 'aria-live': 'polite' });
    const lockMsg = el('p', { class: 'vault-lock-msg' });

    body.appendChild(vaultBadge);
    body.appendChild(intro);
    body.appendChild(hud);
    body.appendChild(noiseBox);
    body.appendChild(log);
    body.appendChild(lockMsg);
    container.appendChild(el('div', { class: 'level4-scene' }, [roomScene, frame]));

    // Redraws the attempts-remaining HUD. Called after every guess and
    // bracket use, and at the start of each round via setup().
    function renderHud() {
      hud.innerHTML = '';
      hud.appendChild(el('span', {}, `ATTEMPTS LEFT: ${attemptsLeft}`));
      hud.appendChild(el('span', {}, `PASSKEY LENGTH: 6`));
    }

    // Appends a plain status/hint line to the log (as opposed to a scored
    // guess row). Used for bracket effects and lockout messages.
    function logLine(text, cls = '') {
      log.appendChild(el('p', { class: `vault-log-line ${cls}`.trim() }, text));
      log.scrollTop = log.scrollHeight;
    }

    // Picks a fresh set of 6 candidate words and a secret passkey among
    // them, resets attempts/log, and rebuilds the noisy terminal rows
    // (words, the two bracket bonus tokens, and pure noise, all shuffled).
    // Called on mount and again by lockout() after attempts run out.
    function setup() {
      candidates = sample(WORD_BANK, 6);
      passkey = candidates[randInt(0, 5)];
      attemptsLeft = START_ATTEMPTS;
      guessLog = [];
      wordButtons = new Map();
      lockMsg.textContent = '';
      log.innerHTML = '';
      renderHud();

      const bracketStyles = shuffle(['( )', '[ ]', '{ }', '< >']);
      const rows = [
        ...candidates.map((w) => ({ type: 'word', word: w })),
        { type: 'bracket', effect: 'dud', label: bracketStyles[0] },
        { type: 'bracket', effect: 'attempt', label: bracketStyles[1] },
        { type: 'noise' }, { type: 'noise' }, { type: 'noise' },
      ];
      shuffle(rows);

      noiseBox.innerHTML = '';
      rows.forEach((row) => {
        const line = el('div', { class: 'vault-row' });
        line.appendChild(el('span', { class: 'vault-addr' }, hexAddr()));
        if (row.type === 'noise') {
          line.appendChild(el('span', { class: 'vault-noise-text' }, garbage(30)));
        } else if (row.type === 'word') {
          line.appendChild(el('span', { class: 'vault-noise-text' }, garbage(randInt(3, 12))));
          const btn = el('button', { class: 'vault-token', onclick: () => guessWord(row.word, btn) }, row.word);
          wordButtons.set(row.word, btn);
          line.appendChild(btn);
          line.appendChild(el('span', { class: 'vault-noise-text' }, garbage(randInt(3, 12))));
        } else if (row.type === 'bracket') {
          line.appendChild(el('span', { class: 'vault-noise-text' }, garbage(randInt(3, 14))));
          const btn = el('button', {
            class: 'vault-token vault-bracket',
            'aria-label': row.effect === 'dud' ? 'Suspicious bracket pair' : 'Suspicious bracket pair',
            onclick: () => useBracket(row.effect, btn),
          }, row.label);
          if (row.effect === 'dud') dudBtn = btn; else attemptBtn = btn;
          line.appendChild(btn);
          line.appendChild(el('span', { class: 'vault-noise-text' }, garbage(randInt(3, 14))));
        }
        noiseBox.appendChild(line);
      });
    }

    // Counts how many letters of `guess` are correct and in the right
    // position compared to the secret passkey. Called by renderGuessRow()
    // to score each guess.
    function matchCount(guess) {
      let n = 0;
      for (let i = 0; i < guess.length; i++) if (guess[i] === passkey[i]) n++;
      return n;
    }

    // Prints a guessed word's letters (highlighting correct-position hits)
    // and its match score to the log. Called by guessWord() after every
    // guess.
    function renderGuessRow(word, isWin) {
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const hit = word[i] === passkey[i];
        letters.push(el('span', { class: hit ? 'vault-letter-hit' : 'vault-letter-miss' }, word[i]));
      }
      const row = el('p', { class: `vault-log-line ${isWin ? 'vault-hit' : ''}`.trim() }, [
        '> ',
        ...letters,
        ` :: ${matchCount(word)}/6 CORRECT`,
      ]);
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }

    // Handles the player clicking a candidate word token: spends an
    // attempt, scores the guess, calls win() on a match, or triggers
    // lockout() once attempts are exhausted. Called by each word token's
    // onclick.
    async function guessWord(word, btn) {
      if (!alive || btn.classList.contains('used') || attemptsLeft <= 0) return;
      btn.classList.add('used');
      btn.disabled = true;
      attemptsLeft--;
      renderHud();
      sfx.select();
      if (word === passkey) {
        renderGuessRow(word, true);
        win();
        return;
      }
      renderGuessRow(word, false);
      sfx.error();
      shake(noiseBox);
      if (attemptsLeft <= 0) {
        await delay(400);
        if (alive) lockout();
      }
    }

    // Handles clicking one of the two hidden bracket-pair bonus tokens:
    // 'dud' removes a non-answer candidate word from play (sets
    // vaultDudUsed), 'attempt' grants +1 attempt (sets vaultAttemptRestored).
    // Called by each bracket token's onclick.
    function useBracket(effect, btn) {
      if (!alive || btn.classList.contains('used')) return;
      btn.classList.add('used');
      btn.disabled = true;
      sfx.confirm();
      if (effect === 'dud') {
        setFlag('vaultDudUsed', true);
        const remaining = candidates.filter((w) => w !== passkey && !wordButtons.get(w).classList.contains('used') && !wordButtons.get(w).classList.contains('removed'));
        if (remaining.length) {
          const dudWord = remaining[randInt(0, remaining.length - 1)];
          const dudBtnEl = wordButtons.get(dudWord);
          dudBtnEl.classList.add('removed');
          dudBtnEl.disabled = true;
          logLine(`DUD REMOVED: ${dudWord}`, 'vault-hint');
        } else {
          logLine('No duds remain to clear.', 'vault-hint');
        }
      } else {
        setFlag('vaultAttemptRestored', true);
        attemptsLeft++;
        renderHud();
        logLine('ATTEMPT RESTORED +1', 'vault-hint');
      }
    }

    // Handles running out of attempts: shows a lockout message, disables
    // the current round's buttons, then calls setup() to reroll a fresh
    // passkey and candidates. Called by guessWord() when attemptsLeft hits 0.
    async function lockout() {
      lockMsg.textContent = 'TERMINAL LOCKED. REROUTING...';
      glitchBurst(frame, 500);
      sfx.glitch();
      noiseBox.querySelectorAll('button').forEach((b) => (b.disabled = true));
      await delay(1600);
      if (!alive) return;
      setup();
      logLine('Connection rerouted. Fresh passkey loaded.', 'vault-hint');
    }

    // Handles guessing the correct passkey: opens the vault visually, marks
    // the level complete in state.js with the fourth shard digit, and shows
    // the sector-cleared interstitial routing to level5. Called by
    // guessWord() on a correct guess.
    function win() {
      sfx.unlock();
      glitchBurst(frame, 400);
      vaultBadge.classList.add('vault-badge--open');
      vaultBadge.querySelector('span').textContent = 'VAULT: OPEN';
      const doorItem = roomScene.querySelector('.room-item');
      doorItem.innerHTML = '';
      doorItem.append(drawDoor(false, 10), el('span', {}, 'VAULT: OPEN'));
      pulse(doorItem, 'fx-pulse', 700);
      pulse(roomScene.querySelector('.player-sprite'), 'fx-pulse', 700);
      const digit = getState().codeDigits[3];
      completeLevel(3, digit);
      noiseBox.querySelectorAll('button').forEach((b) => (b.disabled = true));
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

    setup();
  },
};
