import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst } from '../fx.js';
import { el, delay, randInt } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';

const ROUNDS_TO_WIN = 5;
const PADS = [
  { dir: 'up', label: '▲', color: '#4cd6ff', freq: 523.25, key: 'ArrowUp' },
  { dir: 'right', label: '▶', color: '#ff2fd0', freq: 659.25, key: 'ArrowRight' },
  { dir: 'down', label: '▼', color: '#ffe066', freq: 392.0, key: 'ArrowDown' },
  { dir: 'left', label: '◀', color: '#9dff5c', freq: 293.66, key: 'ArrowLeft' },
];

export default {
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    let round = 1;
    let lives = 3;
    let sequence = [];
    let playerProgress = 0;
    let phase = 'ready'; // ready | showing | input | continue | won

    const frame = terminalFrame({ title: 'SECTOR 1 // ARCADE ZERO', accent: '#ff2fd0' });
    const body = frame.querySelector('.term-body');

    const marquee = el('div', { class: 'arcade-marquee' }, 'ARCADE ZERO');
    const hud = el('div', { class: 'arcade-hud' });
    const message = el('div', { class: 'arcade-message', 'aria-live': 'polite' });
    const padEls = {};
    const padGrid = el('div', { class: 'pad-grid' });
    PADS.forEach((p) => {
      const btn = el('button', {
        class: `pad pad-${p.dir}`,
        style: `--pad-color:${p.color}`,
        'aria-label': `${p.dir} pad`,
        onclick: () => handlePress(p.dir),
      }, p.label);
      padEls[p.dir] = btn;
      padGrid.appendChild(btn);
    });

    const startOverlay = el('div', { class: 'arcade-start' }, [
      el('p', {}, 'INSERT COIN'),
      el('button', { class: 'cta-btn', onclick: () => beginGame() }, 'PRESS START'),
      el('p', { class: 'arcade-instructions' }, 'Watch the pattern, then repeat it with the arrow keys or by clicking the pads.'),
    ]);

    body.appendChild(marquee);
    body.appendChild(hud);
    body.appendChild(message);
    body.appendChild(padGrid);
    container.appendChild(el('div', { class: 'level2-scene' }, [frame, startOverlay]));

    function renderHud() {
      hud.innerHTML = '';
      hud.appendChild(el('span', {}, `ROUND ${Math.min(round, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`));
      hud.appendChild(el('span', { class: 'lives' }, '♥'.repeat(lives) + '♡'.repeat(3 - lives)));
    }
    renderHud();

    function flashPad(dir, ms = 380) {
      const btn = padEls[dir];
      const pad = PADS.find((p) => p.dir === dir);
      btn.classList.add('lit');
      sfx.pad(pad.freq);
      setTimeout(() => { if (alive) btn.classList.remove('lit'); }, ms);
    }

    function randomSequence(len) {
      const seq = [];
      for (let i = 0; i < len; i++) seq.push(PADS[randInt(0, 3)].dir);
      return seq;
    }

    async function playSequence(seq) {
      phase = 'showing';
      message.textContent = 'WATCH CLOSELY...';
      await delay(500);
      for (const dir of seq) {
        if (!alive) return;
        flashPad(dir);
        await delay(560);
      }
      if (!alive) return;
      phase = 'input';
      playerProgress = 0;
      message.textContent = 'YOUR TURN';
    }

    function startRound() {
      if (!alive) return;
      sequence = randomSequence(round + 2);
      renderHud();
      playSequence(sequence);
    }

    function handlePress(dir) {
      if (phase !== 'input' || !alive) return;
      flashPad(dir, 220);
      if (sequence[playerProgress] === dir) {
        playerProgress++;
        if (playerProgress === sequence.length) roundClear();
      } else {
        missRound();
      }
    }

    async function roundClear() {
      phase = 'clear';
      sfx.success();
      message.textContent = 'ROUND CLEAR!';
      round++;
      renderHud();
      if (round > ROUNDS_TO_WIN) {
        winGame();
        return;
      }
      await delay(1100);
      if (!alive) return;
      startRound();
    }

    async function missRound() {
      phase = 'clear';
      lives--;
      renderHud();
      sfx.error();
      shake(padGrid);
      if (lives <= 0) {
        message.textContent = 'PATTERN BROKEN.';
        await delay(700);
        if (alive) showContinue();
        return;
      }
      message.textContent = 'MISS! WATCH AGAIN...';
      await delay(900);
      if (!alive) return;
      playSequence(randomSequence(round + 2));
    }

    function showContinue() {
      phase = 'continue';
      const overlay = el('div', { class: 'arcade-start' }, [
        el('p', { class: 'ascii-glitch' }, 'GAME OVER'),
        el('button', {
          class: 'cta-btn',
          onclick: () => {
            lives = 3;
            overlay.remove();
            renderHud();
            startRound();
          },
        }, 'CONTINUE?'),
        el('p', { class: 'arcade-instructions' }, "Same round, fresh pattern. Every arcade legend needed a few extra coins."),
      ]);
      container.querySelector('.level2-scene').appendChild(overlay);
    }

    function winGame() {
      phase = 'won';
      sfx.unlock();
      glitchBurst(frame, 400);
      const digit = getState().codeDigits[1];
      completeLevel(1, digit);
      message.textContent = 'HIGH SCORE!';
      setTimeout(() => {
        if (!alive) return;
        showInterstitial(container.querySelector('.level2-scene'), {
          levelIndex: 1,
          storyBeat: 'ECHO: "Ha! You have good reflexes. That arcade cabinet was the first thing I ever loved about this place."',
          shardDigit: digit,
          ctaLabel: 'NEXT SECTOR ▶',
          onContinue: () => ctx.goTo('level3'),
        });
      }, 700);
    }

    function beginGame() {
      sfx.confirm();
      startOverlay.remove();
      startRound();
    }

    window.addEventListener('keydown', (e) => {
      const pad = PADS.find((p) => p.key === e.key);
      if (pad) { e.preventDefault(); handlePress(pad.dir); }
      if (e.key === 'Enter' && phase === 'ready') beginGame();
    }, { signal: ctx.signal });
  },
};
