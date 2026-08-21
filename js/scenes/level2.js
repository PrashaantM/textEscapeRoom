// Scene: Sector 1, "ARCADE ZERO". Two damaged rooms joined by a door: a
// tech bay (sparking wires, cracked containment pods, one terminal that
// still works, flickering between static and pink) and, through its
// openable door, a bio bay of the same shape but blue-tinted. Walking up
// to and opening the pink terminal launches a Simon-style sequence-memory
// minigame; the blue terminal (in the bio bay) launches a different,
// simultaneous-reaction minigame (PETRI DASH). Clearing both lights both
// terminals up permanently and knocks down the tech bay's second,
// barricaded door, which — once the player has walked back through to the
// tech bay — is the way out. Clearing it awards the second memory shard
// via completeLevel(1, digit) and routes to level3.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst } from '../fx.js';
import { el, delay, randInt } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';
import {
  drawDoor, drawSparkWire, drawGlassPod, drawBrokenTerminal, drawGoodTerminal, drawBarricade,
  drawCabinet, drawLabFlask, drawPlantProp, drawVentProp,
} from '../sprites.js';
import { createRoom } from './roomKit.js';

const ROUNDS_TO_WIN = 5;
const PADS = [
  { dir: 'up', label: '▲', color: '#4cd6ff', freq: 523.25, key: 'ArrowUp' },
  { dir: 'right', label: '▶', color: '#ff2fd0', freq: 659.25, key: 'ArrowRight' },
  { dir: 'down', label: '▼', color: '#ffe066', freq: 392.0, key: 'ArrowDown' },
  { dir: 'left', label: '◀', color: '#9dff5c', freq: 293.66, key: 'ArrowLeft' },
];

// Fixed background dressing for the tech bay: sparking wires, cracked
// pods, dead terminals, and a couple of cabinets, scattered across the
// full-screen room. Percentage coordinates.
function techDecor() {
  return [
    { x: 10, y: 15, node: el('div', { class: 'spark-wire' }, [drawSparkWire(7)]) },
    { x: 55, y: 10, node: el('div', { class: 'spark-wire' }, [drawSparkWire(7)]) },
    { x: 30, y: 88, node: el('div', { class: 'spark-wire' }, [drawSparkWire(6)]) },
    { x: 88, y: 20, node: el('div', { class: 'spark-wire' }, [drawSparkWire(6)]) },
    { x: 20, y: 40, node: drawGlassPod('#ff8a8a', 8) },
    { x: 65, y: 42, node: drawGlassPod('#ff8a8a', 7) },
    { x: 8, y: 70, node: drawGlassPod('#ff8a8a', 7) },
    { x: 92, y: 65, node: drawBrokenTerminal(7) },
    { x: 40, y: 20, node: drawBrokenTerminal(6) },
    { x: 15, y: 92, node: drawCabinet('#ff2fd0', 6, undefined, 2) },
    { x: 85, y: 90, node: drawCabinet('#ff2fd0', 6, undefined, 3) },
    { x: 48, y: 65, node: drawVentProp(6) },
    { x: 70, y: 88, node: drawVentProp(6) },
  ];
}

// Fixed background dressing for the bio bay: cracked bio-tanks, lab
// flasks, and plants standing in for overgrowth, mirroring the tech bay's
// layout with a green/blue palette instead.
function bioDecor() {
  return [
    { x: 12, y: 18, node: drawGlassPod('#4cd6ff', 8) },
    { x: 60, y: 14, node: drawGlassPod('#2f9e5b', 7) },
    { x: 88, y: 30, node: drawGlassPod('#4cd6ff', 7) },
    { x: 25, y: 60, node: drawLabFlask('#2f9e5b', 7) },
    { x: 45, y: 75, node: drawLabFlask('#4cd6ff', 6) },
    { x: 70, y: 60, node: drawLabFlask('#2f9e5b', 6) },
    { x: 8, y: 88, node: drawPlantProp(7) },
    { x: 92, y: 88, node: drawPlantProp(7) },
    { x: 50, y: 92, node: drawPlantProp(6) },
    { x: 35, y: 30, node: drawBrokenTerminal(6) },
    { x: 90, y: 65, node: drawVentProp(6) },
  ];
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the tech-bay room and the
  // passive story-log terminal panel, and wires up both rooms' hotspots.
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; });

    const flags = { pinkSolved: false, blueSolved: false, cleared: false };
    let currentRoomName = 'tech';

    const room = createRoom({ accent: '#ff2fd0', ariaLabel: 'Sector 1 room' });

    const frame = terminalFrame({ title: 'SECTOR 1 // ARCADE ZERO', accent: '#ff2fd0' });
    const log = el('div', { class: 'term-log', role: 'log', 'aria-live': 'polite' });
    frame.querySelector('.term-body').appendChild(log);
    container.appendChild(el('div', { class: 'level2-scene split-scene' }, [room.el, frame]));

    function printRaw(text, cls = '') {
      const p = el('p', { class: `term-line ${cls}`.trim() });
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return typeInto(p, text, { speed: 8, signal: ctx.signal }).catch(() => {});
    }

    // ---- room switching: one roomKit instance is reused as both rooms,
    // rebuilt on every crossing with a quick fade-wipe transition so
    // walking through a door reads as actually going somewhere new. ----

    function renderTechRoom(entry) {
      room.clearHotspots();
      room.setDecor(techDecor());
      room.setHotspot('pink-terminal', {
        x: 50, y: 35,
        build: () => [el('div', { class: flags.pinkSolved ? '' : 'flicker-terminal' }, [drawGoodTerminal('#ff2fd0', 8, undefined, flags.pinkSolved)]), el('span', {}, flags.pinkSolved ? 'TERMINAL: ONLINE' : 'TERMINAL')],
        label: flags.pinkSolved ? 'Pink terminal, online' : 'Flickering pink terminal',
        onClick: onPinkTerminalClick,
      });
      room.setHotspot('door-open', {
        x: 85, y: 55,
        build: () => [drawDoor(false, 8), el('span', {}, 'DOOR')],
        label: 'Door to the next room',
        onClick: onDoorOpenClick,
      });
      room.setHotspot('door-barricaded', {
        x: 15, y: 55,
        build: () => flags.blueSolved
          ? [drawDoor(false, 8), drawBarricade(true, 6), el('span', {}, 'DOOR: CLEAR')]
          : [drawDoor(true, 8), drawBarricade(false, 6), el('span', {}, 'DOOR: BARRICADED')],
        label: flags.blueSolved ? 'Barricade destroyed, door clear' : 'Barricaded, malfunctioning door',
        onClick: onDoorBarricadedClick,
      });
      if (entry) room.placeAt(85, 55);
    }

    function renderBioRoom(entry) {
      room.clearHotspots();
      room.setDecor(bioDecor());
      room.setHotspot('blue-terminal', {
        x: 50, y: 35,
        build: () => [el('div', { class: flags.blueSolved ? '' : 'flicker-terminal' }, [drawGoodTerminal('#4cd6ff', 8, undefined, flags.blueSolved)]), el('span', {}, flags.blueSolved ? 'TERMINAL: ONLINE' : 'TERMINAL')],
        label: flags.blueSolved ? 'Blue terminal, online' : 'Flickering blue terminal',
        onClick: onBlueTerminalClick,
      });
      room.setHotspot('door-back', {
        x: 15, y: 55,
        build: () => [drawDoor(false, 8), el('span', {}, 'DOOR')],
        label: 'Door back to the tech bay',
        onClick: onDoorBackClick,
      });
      if (entry) room.placeAt(15, 55);
    }

    async function crossTo(roomName, renderFn) {
      room.el.classList.add('room-scene--transition');
      sfx.terminalOpen();
      await delay(230, ctx.signal).catch(() => {});
      currentRoomName = roomName;
      renderFn(true);
      await delay(270, ctx.signal).catch(() => {});
      room.el.classList.remove('room-scene--transition');
    }

    async function onDoorOpenClick() {
      await room.walkTo('door-open');
      if (room.getActive() !== 'door-open' || currentRoomName !== 'tech') return;
      await printRaw('You step through into the next bay.');
      await crossTo('bio', renderBioRoom);
    }

    async function onDoorBackClick() {
      await room.walkTo('door-back');
      if (room.getActive() !== 'door-back' || currentRoomName !== 'bio') return;
      await printRaw('Back through to the tech bay.');
      await crossTo('tech', renderTechRoom);
    }

    async function onDoorBarricadedClick() {
      await room.walkTo('door-barricaded');
      if (room.getActive() !== 'door-barricaded' || currentRoomName !== 'tech') return;
      if (!flags.blueSolved) {
        room.showBubble([{ label: 'STILL BARRICADED', onClick: () => room.hideBubble() }]);
        await printRaw("It's barricaded solid, and something behind it is sparking. Not going anywhere until the bio bay's terminal is dealt with.", 'term-error');
        return;
      }
      if (flags.cleared) return;
      flags.cleared = true;
      sfx.unlock();
      await printRaw('The splintered barricade gives way. The path out is clear.', 'term-success');
      const digit = getState().codeDigits[1];
      completeLevel(1, digit);
      await delay(400, ctx.signal).catch(() => {});
      showInterstitial(container.querySelector('.level2-scene'), {
        levelIndex: 1,
        storyBeat: 'ECHO: "Ha! Good reflexes, both hands. Those two labs were the first thing I ever loved about this place."',
        shardDigit: digit,
        ctaLabel: 'NEXT SECTOR ▶',
        onContinue: () => ctx.goTo('level3'),
      });
    }

    async function onPinkTerminalClick() {
      await room.walkTo('pink-terminal');
      if (room.getActive() !== 'pink-terminal' || currentRoomName !== 'tech') return;
      if (flags.pinkSolved) { printRaw('The terminal hums quietly online. Nothing left to do here.'); return; }
      sfx.terminalOpen();
      openArcadeMinigame({
        onWin: async () => {
          flags.pinkSolved = true;
          renderTechRoom();
          await printRaw('The pink terminal steadies and glows solid. ONLINE.', 'term-success');
        },
      });
    }

    async function onBlueTerminalClick() {
      await room.walkTo('blue-terminal');
      if (room.getActive() !== 'blue-terminal' || currentRoomName !== 'bio') return;
      if (flags.blueSolved) { printRaw('The terminal hums quietly online. Nothing left to do here.'); return; }
      sfx.terminalOpen();
      openPetriMinigame({
        onWin: async () => {
          flags.blueSolved = true;
          renderBioRoom();
          await printRaw('The blue terminal steadies and glows solid. ONLINE.', 'term-success');
        },
      });
    }

    // ---- minigame 1: ARCADE ZERO (sequence memory) — behaves exactly as
    // the sector previously did, just launched from the pink terminal and
    // reporting a win back via onWin() instead of ending the whole sector
    // itself. ----
    function openArcadeMinigame({ onWin }) {
      let round = 1;
      let lives = 3;
      let sequence = [];
      let playerProgress = 0;
      let phase = 'ready';

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

      const overlay = el('div', { class: 'inventory-overlay' }, [
        el('div', { class: 'inventory-panel' }, [
          el('div', { class: 'inventory-header' }, [
            el('span', {}, 'PINK TERMINAL'),
            el('button', { class: 'inventory-close', 'aria-label': 'Close', onclick: () => overlay.remove() }, '✕'),
          ]),
          marquee, hud, message, padGrid,
        ]),
      ]);
      room.el.appendChild(overlay);
      renderHud();
      message.textContent = 'Watch the pattern, then repeat it with the arrow keys or the pads.';

      function renderHud() {
        hud.innerHTML = '';
        hud.appendChild(el('span', {}, `ROUND ${Math.min(round, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`));
        hud.appendChild(el('span', { class: 'lives' }, '♥'.repeat(lives) + '♡'.repeat(3 - lives)));
      }

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
        if (round > ROUNDS_TO_WIN) { winGame(); return; }
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
        sequence = randomSequence(round + 2);
        playSequence(sequence);
      }

      function showContinue() {
        phase = 'continue';
        const cont = el('div', { class: 'arcade-start' }, [
          el('p', { class: 'ascii-glitch' }, 'GAME OVER'),
          el('button', {
            class: 'cta-btn',
            onclick: () => {
              sfx.confirm();
              lives = 3;
              cont.remove();
              renderHud();
              startRound();
            },
          }, 'CONTINUE?'),
        ]);
        overlay.querySelector('.inventory-panel').appendChild(cont);
      }

      function winGame() {
        phase = 'won';
        sfx.unlock();
        glitchBurst(overlay, 400);
        setTimeout(() => { overlay.remove(); onWin(); }, 700);
      }

      const keyHandler = (e) => {
        const pad = PADS.find((p) => p.key === e.key);
        if (pad) { e.preventDefault(); handlePress(pad.dir); }
      };
      window.addEventListener('keydown', keyHandler, { signal: ctx.signal });
      startRound();
    }

    // ---- minigame 2: PETRI DASH (simultaneous reaction, not sequence
    // memory) — several dishes light up together for a shrinking window;
    // the player must click every lit dish before it closes. ----
    function openPetriMinigame({ onWin }) {
      let round = 1;
      let lives = 3;
      let phase = 'ready';
      let remaining = new Set();
      let timer = null;

      const hud = el('div', { class: 'arcade-hud' });
      const message = el('div', { class: 'arcade-message', 'aria-live': 'polite' });
      const dishEls = [];
      const grid = el('div', { class: 'petri-grid' });
      for (let i = 0; i < 9; i++) {
        const dish = el('button', { class: 'petri-dish', 'aria-label': `Dish ${i + 1}`, onclick: () => handleDish(i) });
        dishEls.push(dish);
        grid.appendChild(dish);
      }

      const overlay = el('div', { class: 'inventory-overlay' }, [
        el('div', { class: 'inventory-panel' }, [
          el('div', { class: 'inventory-header' }, [
            el('span', {}, 'BLUE TERMINAL // PETRI DASH'),
            el('button', { class: 'inventory-close', 'aria-label': 'Close', onclick: () => overlay.remove() }, '✕'),
          ]),
          hud, message, grid,
        ]),
      ]);
      room.el.appendChild(overlay);
      renderHud();
      message.textContent = 'Click every dish that lights up before it closes.';

      function renderHud() {
        hud.innerHTML = '';
        hud.appendChild(el('span', {}, `ROUND ${Math.min(round, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`));
        hud.appendChild(el('span', { class: 'lives' }, '♥'.repeat(lives) + '♡'.repeat(3 - lives)));
      }

      function startRound() {
        if (!alive) return;
        dishEls.forEach((d) => d.classList.remove('petri-lit', 'petri-hit'));
        const litCount = Math.min(2 + round, 6);
        const idx = new Set();
        while (idx.size < litCount) idx.add(randInt(0, 8));
        remaining = idx;
        idx.forEach((i) => { dishEls[i].classList.add('petri-lit'); sfx.pad(300 + i * 40); });
        phase = 'active';
        message.textContent = 'GO!';
        const windowMs = Math.max(1700 - round * 140, 750);
        clearTimeout(timer);
        timer = setTimeout(() => { if (remaining.size > 0) missRound(); }, windowMs);
      }

      function handleDish(i) {
        if (phase !== 'active' || !remaining.has(i)) return;
        remaining.delete(i);
        dishEls[i].classList.remove('petri-lit');
        dishEls[i].classList.add('petri-hit');
        sfx.pop();
        if (remaining.size === 0) { clearTimeout(timer); roundClear(); }
      }

      async function roundClear() {
        phase = 'clear';
        sfx.success();
        message.textContent = 'CLEARED!';
        round++;
        renderHud();
        if (round > ROUNDS_TO_WIN) { winGame(); return; }
        await delay(750);
        if (!alive) return;
        startRound();
      }

      async function missRound() {
        phase = 'clear';
        lives--;
        renderHud();
        sfx.error();
        shake(grid);
        dishEls.forEach((d) => d.classList.remove('petri-lit'));
        if (lives <= 0) {
          message.textContent = 'CULTURE LOST.';
          await delay(700);
          if (alive) showContinue();
          return;
        }
        message.textContent = 'MISSED ONE! AGAIN...';
        await delay(800);
        if (!alive) return;
        startRound();
      }

      function showContinue() {
        phase = 'continue';
        const cont = el('div', { class: 'arcade-start' }, [
          el('p', { class: 'ascii-glitch' }, 'GAME OVER'),
          el('button', {
            class: 'cta-btn',
            onclick: () => {
              sfx.confirm();
              lives = 3;
              cont.remove();
              renderHud();
              startRound();
            },
          }, 'CONTINUE?'),
        ]);
        overlay.querySelector('.inventory-panel').appendChild(cont);
      }

      function winGame() {
        phase = 'won';
        sfx.unlock();
        glitchBurst(overlay, 400);
        setTimeout(() => { overlay.remove(); onWin(); }, 700);
      }

      startRound();
    }

    renderTechRoom();
    printRaw('SECTOR 1 // ARCADE ZERO: two labs, two dead ends. Find a way through.');
  },
};
