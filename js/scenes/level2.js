// Scene: Sector 1, "ARCADE ZERO". A Simon-Says style memory game: the game
// flashes a growing directional sequence and the player repeats it with
// arrow keys or on-screen pads, losing a life on a miss (with a "continue"
// option) and winning after ROUNDS_TO_WIN rounds. Winning awards the second
// memory shard via completeLevel(1, digit) and routes to level3.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, pulse } from '../fx.js';
import { el, delay, randInt } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import { drawPlayer, drawArcadeCabinet } from '../sprites.js';

const ROUNDS_TO_WIN = 5;
const PADS = [
  { dir: 'up', label: '▲', color: '#4cd6ff', freq: 523.25, key: 'ArrowUp' },
  { dir: 'right', label: '▶', color: '#ff2fd0', freq: 659.25, key: 'ArrowRight' },
  { dir: 'down', label: '▼', color: '#ffe066', freq: 392.0, key: 'ArrowDown' },
  { dir: 'left', label: '◀', color: '#9dff5c', freq: 293.66, key: 'ArrowLeft' },
];

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the arcade cabinet UI (pads,
  // HUD, start overlay) and wires keyboard/click input; the actual game
  // loop starts once the player presses START.
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

    const playerItem = el('div', { class: 'player-sprite arcade-player' }, [drawPlayer('#ff2fd0', 6), el('span', {}, 'PLAYER 1')]);

    // ---- room visual: the physical arcade cabinet, standing next to the
    // terminal that shows its screen/HUD, matching Sectors 0/2/3's split
    // layout. The pad grid itself is the same interactive element, just
    // relocated here instead of embedded in the terminal body.
    const cabinetDecor = el('div', { class: 'room-decor', 'aria-hidden': 'true' }, [drawArcadeCabinet('#ff2fd0', 6)]);
    const cabinetDecor2 = el('div', { class: 'room-decor', 'aria-hidden': 'true' }, [drawArcadeCabinet('#4cd6ff', 6)]);
    const roomScene = el('div', { class: 'room-scene', 'aria-hidden': 'true' }, [
      cabinetDecor,
      el('div', { class: 'arcade-floor' }, [playerItem, padGrid]),
      cabinetDecor2,
    ]);

    body.appendChild(marquee);
    body.appendChild(hud);
    body.appendChild(message);
    container.appendChild(el('div', { class: 'level2-scene split-scene' }, [roomScene, frame, startOverlay]));

    // Redraws the round counter and lives display. Called after any change
    // to `round` or `lives`.
    function renderHud() {
      hud.innerHTML = '';
      hud.appendChild(el('span', {}, `ROUND ${Math.min(round, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`));
      hud.appendChild(el('span', { class: 'lives' }, '♥'.repeat(lives) + '♡'.repeat(3 - lives)));
    }
    renderHud();

    // Lights up a directional pad briefly and plays its tone. Used both
    // when the game demonstrates the sequence and when the player presses
    // a pad themselves.
    function flashPad(dir, ms = 380) {
      const btn = padEls[dir];
      const pad = PADS.find((p) => p.dir === dir);
      btn.classList.add('lit');
      sfx.pad(pad.freq);
      setTimeout(() => { if (alive) btn.classList.remove('lit'); }, ms);
    }

    // Generates a random sequence of `len` pad directions. Called by
    // startRound() and missRound() to build the pattern the player repeats.
    function randomSequence(len) {
      const seq = [];
      for (let i = 0; i < len; i++) seq.push(PADS[randInt(0, 3)].dir);
      return seq;
    }

    // Plays back the given sequence by flashing pads in order, then switches
    // to 'input' phase for the player to repeat it. Called by startRound()
    // and after a miss.
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

    // Generates and plays the sequence for the current round. Called at the
    // start of the game and after each round clear or life lost.
    function startRound() {
      if (!alive) return;
      sequence = randomSequence(round + 2);
      renderHud();
      playSequence(sequence);
    }

    // Handles a player pressing a pad (via click or arrow key): checks it
    // against the expected sequence position, advancing on a match or
    // failing the round via missRound(). Called by pad click handlers and
    // the global keydown listener.
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

    // Advances to the next round on a successful repeat, or calls
    // winGame() once ROUNDS_TO_WIN is exceeded. Called by handlePress()
    // when the player completes the sequence.
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

    // Handles a wrong pad press: deducts a life, shakes the grid, and
    // either shows the continue overlay (out of lives) or replays a fresh
    // sequence for the same round. Called by handlePress() on a mismatch.
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
      sequence = randomSequence(round + 2);
      playSequence(sequence);
    }

    // Shows a "GAME OVER / CONTINUE?" overlay that resets lives to 3 and
    // restarts the current round. Called by missRound() when lives hit 0.
    function showContinue() {
      phase = 'continue';
      const overlay = el('div', { class: 'arcade-start' }, [
        el('p', { class: 'ascii-glitch' }, 'GAME OVER'),
        el('button', {
          class: 'cta-btn',
          onclick: () => {
            sfx.confirm();
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

    // Handles winning the arcade game: plays effects, marks the level
    // complete in state.js with the second shard digit, and shows the
    // sector-cleared interstitial routing to level3. Called by
    // roundClear() once ROUNDS_TO_WIN is exceeded.
    function winGame() {
      phase = 'won';
      sfx.unlock();
      glitchBurst(frame, 400);
      pulse(playerItem, 'fx-pulse', 700);
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

    // Dismisses the "INSERT COIN" start overlay and starts the first round.
    // Called by the PRESS START button and by Enter while phase is 'ready'.
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
