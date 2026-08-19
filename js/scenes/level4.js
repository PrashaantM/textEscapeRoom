import { completeLevel, getState, setFlag } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst } from '../fx.js';
import { el, delay, randInt, sample, shuffle } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';

const WORD_BANK = ['ECHOES', 'ARCADE', 'MEMORY', 'BOOTUP', 'CIPHER', 'GLITCH', 'SHADOW', 'SILENT', 'ENIGMA', 'ORACLE'];
const NOISE_CHARS = '!@#$%^&*<>{}[]()~/|;:+=01'.split('');
const START_ATTEMPTS = 4;

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
  mount(container, ctx) {
    let candidates, passkey, attemptsLeft, guessLog, dudBtn, attemptBtn, wordButtons, alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    const frame = terminalFrame({ title: 'SECTOR 3 // VAULT BREACH', accent: '#00ff9c' });
    const body = frame.querySelector('.term-body');
    const intro = el('p', { class: 'level-intro' }, `Find the ${'█'.repeat(6)}-length passkey. Each guess reports how many letters are correct AND in position. Watch for bracket pairs hiding in the noise.`);
    const hud = el('div', { class: 'vault-hud' });
    const noiseBox = el('div', { class: 'vault-noise', role: 'group', 'aria-label': 'Terminal noise' });
    const log = el('div', { class: 'vault-log', role: 'log', 'aria-live': 'polite' });
    const lockMsg = el('p', { class: 'vault-lock-msg' });

    body.appendChild(intro);
    body.appendChild(hud);
    body.appendChild(noiseBox);
    body.appendChild(log);
    body.appendChild(lockMsg);
    container.appendChild(el('div', { class: 'level4-scene' }, [frame]));

    function renderHud() {
      hud.innerHTML = '';
      hud.appendChild(el('span', {}, `ATTEMPTS LEFT: ${attemptsLeft}`));
      hud.appendChild(el('span', {}, `PASSKEY LENGTH: 6`));
    }

    function logLine(text, cls = '') {
      log.appendChild(el('p', { class: `vault-log-line ${cls}`.trim() }, text));
      log.scrollTop = log.scrollHeight;
    }

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

    function matchCount(guess) {
      let n = 0;
      for (let i = 0; i < guess.length; i++) if (guess[i] === passkey[i]) n++;
      return n;
    }

    async function guessWord(word, btn) {
      if (!alive || btn.classList.contains('used') || attemptsLeft <= 0) return;
      btn.classList.add('used');
      btn.disabled = true;
      const matches = matchCount(word);
      attemptsLeft--;
      renderHud();
      sfx.select();
      if (word === passkey) {
        logLine(`> ${word} :: 6/6 CORRECT`, 'vault-hit');
        win();
        return;
      }
      logLine(`> ${word} :: ${matches}/6 CORRECT`);
      sfx.error();
      shake(noiseBox);
      if (attemptsLeft <= 0) {
        await delay(400);
        if (alive) lockout();
      }
    }

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

    function win() {
      sfx.unlock();
      glitchBurst(frame, 400);
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
