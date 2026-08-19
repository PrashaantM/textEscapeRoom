import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { glitchBurst, pulse } from '../fx.js';
import { el, randInt } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import { drawDoor, drawPlayer } from '../sprites.js';

const SIZE = 5;
const AMBIENT_LINES = [
  '...the hallway lights flicker somewhere else in the building...',
  '...you hear a breaker click, far away, on its own...',
  '...the dark at the end of the hall seems a little closer...',
  '...ECHO: "Almost there. Keep the current moving."...',
];

function emptyGrid(value) {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => value));
}

function toggle(grid, r, c) {
  const hits = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  for (const [y, x] of hits) {
    if (y >= 0 && y < SIZE && x >= 0 && x < SIZE) grid[y][x] = !grid[y][x];
  }
}

function isSolved(grid) {
  return grid.every((row) => row.every((cell) => cell === true));
}

function generate() {
  let grid;
  do {
    grid = emptyGrid(true);
    const moves = randInt(8, 12);
    for (let i = 0; i < moves; i++) toggle(grid, randInt(0, SIZE - 1), randInt(0, SIZE - 1));
  } while (isSolved(grid));
  return grid;
}

export default {
  mount(container, ctx) {
    let grid = generate();
    let moves = 0;

    const roomScene = el('div', { class: 'room-scene', 'aria-hidden': 'true' });
    const doorItem = el('div', { class: 'room-item' });
    const playerItem = el('div', { class: 'player-sprite' }, [drawPlayer('#ffb000', 6), el('span', {}, 'YOU')]);
    roomScene.append(playerItem, doorItem);

    function renderRoomScene(justSolved = false) {
      const solved = isSolved(grid);
      doorItem.innerHTML = '';
      doorItem.append(drawDoor(!solved, 8), el('span', {}, solved ? 'WARD DOOR: OPEN' : 'WARD DOOR: SEALED'));
      if (justSolved) { pulse(doorItem, 'fx-pulse', 700); pulse(playerItem, 'fx-pulse', 700); }
    }

    const frame = terminalFrame({ title: 'SECTOR 2 // BREAKER WARD', accent: '#ffb000' });
    const body = frame.querySelector('.term-body');

    const intro = el('p', { class: 'level-intro' }, 'The hallway breakers are scrambled. Toggling one flips its neighbors too. Restore power to every panel to open the ward door.');
    const hud = el('div', { class: 'breaker-hud' });
    const gridEl = el('div', { class: 'breaker-grid', role: 'grid', 'aria-label': 'Breaker panel' });
    const ambient = el('p', { class: 'ambient-line' });
    const resetBtn = el('button', { class: 'cta-btn secondary', onclick: () => reset() }, '↻ RESET PANEL');

    body.appendChild(intro);
    body.appendChild(hud);
    body.appendChild(gridEl);
    body.appendChild(el('div', { class: 'breaker-controls' }, [resetBtn]));
    body.appendChild(ambient);
    container.appendChild(el('div', { class: 'level3-scene' }, [roomScene, frame]));

    function renderHud() {
      hud.innerHTML = '';
      hud.appendChild(el('span', {}, `MOVES: ${moves}`));
      hud.appendChild(el('span', {}, `POWERED: ${grid.flat().filter(Boolean).length} / ${SIZE * SIZE}`));
    }

    function renderGrid() {
      gridEl.innerHTML = '';
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const on = grid[r][c];
          const btn = el('button', {
            class: `cell ${on ? 'cell--on' : 'cell--off'}`,
            'aria-label': `Breaker row ${r + 1} column ${c + 1}, ${on ? 'powered' : 'unpowered'}`,
            onclick: () => press(r, c),
          });
          gridEl.appendChild(btn);
        }
      }
    }

    function press(r, c) {
      toggle(grid, r, c);
      moves++;
      sfx.move();
      renderHud();
      renderGrid();
      const solved = isSolved(grid);
      renderRoomScene(solved);
      if (solved) win();
    }

    function reset() {
      sfx.select();
      grid = generate();
      moves = 0;
      renderHud();
      renderGrid();
      renderRoomScene();
    }

    function win() {
      sfx.unlock();
      glitchBurst(frame, 350);
      pulse(gridEl, 'fx-pulse', 700);
      const digit = getState().codeDigits[2];
      completeLevel(2, digit);
      setTimeout(() => {
        showInterstitial(container.querySelector('.level3-scene'), {
          levelIndex: 2,
          storyBeat: 'ECHO: "Power restored. I can feel that hallway again. It used to lead to the records room."',
          shardDigit: digit,
          ctaLabel: 'NEXT SECTOR ▶',
          onContinue: () => ctx.goTo('level4'),
        });
      }, 500);
    }

    renderHud();
    renderGrid();
    renderRoomScene();

    let ambientIdx = 0;
    ambient.textContent = '';
    const ambientTimer = setInterval(() => {
      ambient.textContent = AMBIENT_LINES[ambientIdx % AMBIENT_LINES.length];
      ambientIdx++;
    }, 17000);
    ctx.signal.addEventListener('abort', () => clearInterval(ambientTimer));
  },
};
