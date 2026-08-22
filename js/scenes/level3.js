// Scene: Sector 2, "BREAKER WARD". A flooding aquarium ward: the room
// fills with water on a strict 60-second clock, and the only way to stop
// it is to walk the straight path to the far door, which unlocks the real
// puzzle — a 25-panel Lights Out grid on the right (toggling a breaker
// also flips its orthogonal neighbors, mirrored live by 25 matching wall
// lights in the room). Running out of time before it's fully powered
// floods the ward and resets the puzzle for another attempt; solving it
// in time drains the water in one burst, blows the door open, and leads
// into a second, dry room full of plants with an exit at the top. Solving
// it awards the third memory shard via completeLevel(2, digit) and routes
// to level4.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst } from '../fx.js';
import { el, delay, randInt, sample } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import {
  drawDoor, drawConduit, drawAquariumTank, drawPlantProp, drawCrateStack,
  drawElectricalBox, drawVentProp,
} from '../sprites.js';
import { createRoom } from './roomKit.js';

const SIZE = 5;
const FLOOD_SECONDS = 60;

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

// Builds a scrambled, guaranteed-unsolved starting grid by toggling random
// cells from a fully-lit grid, and returns the exact set of cells (deduped
// by parity — toggling the same cell twice cancels out) that solves it
// again, since toggle() is its own inverse and every move commutes under
// GF(2) addition: replaying that same set, in any order, always returns
// the grid to fully powered. Used both to build the puzzle and to power
// the HINT button below with a provably-correct answer rather than a
// separate solver.
function generate() {
  let grid;
  let solutionCells;
  do {
    grid = emptyGrid(true);
    const parity = new Map();
    const moves = randInt(8, 12);
    for (let i = 0; i < moves; i++) {
      const r = randInt(0, SIZE - 1);
      const c = randInt(0, SIZE - 1);
      toggle(grid, r, c);
      const key = `${r},${c}`;
      parity.set(key, !parity.get(key));
    }
    solutionCells = [...parity].filter(([, odd]) => odd).map(([key]) => key.split(',').map(Number));
  } while (isSolved(grid));
  return { grid, solutionCells };
}

const CONDUIT_LINES = [
  'A ceiling pipe, dripping despite the flood clock not moving fast enough to explain it.',
  'Warm to the touch. Whatever runs through it, it hasn’t stopped yet.',
  'Rattles when the water rises. You leave it alone.',
];

// Every tank, pipe, and crate is a walkable, clickable hotspot with a
// flavor line, split to match the room's wall/floor backdrop
// (roomKit.js's ROOM_HORIZON/ROOM_CORNER): ceiling pipes and the odd wall
// fixture sit above y=50, on either the left wall (x<16) or back wall
// (x>16); the five aquarium tanks, being freestanding, sit below y=66.
function wardProps() {
  return [
    // ---- wall/ceiling-mounted ----
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `conduit${i}`, x: 12 + i * 10, y: 6, node: () => drawConduit('#ffb000', 6),
      label: 'Ceiling pipe', desc: sample(CONDUIT_LINES, 1)[0],
    })),
    { id: 'ebox', x: 8, y: 30, node: () => drawElectricalBox(7), label: 'Electrical box', desc: 'Breakers, all dark. This whole ward lost power at once.' },
    { id: 'vent', x: 90, y: 34, node: () => drawVentProp(6), label: 'Vent grate', desc: 'Water beads on the grille and drips through, slow and steady.' },
    // ---- floor: 5 tanks ----
    // Positions and sizes reworked from their originals (all 5 packed into
    // roughly x:10-88 at unit 9-10) after roomKit.js's declutter() kept
    // flagging this set as unresolved no matter how many passes it got —
    // not a slow-converging case (auditOverlaps() showed the exact same
    // overlap% at 60, 120, and 300 passes) but a genuine fixed point: at
    // that size and spacing the 5 tanks' combined on-screen width added up
    // to ~41% more than the room itself, before counting the door at
    // x:92 they also had to clear — no rearrangement of 5 boxes that wide
    // fits in a box that much narrower with zero overlap, so no amount of
    // pass-tuning was ever going to resolve it (declutter can rearrange a
    // tight fit, it can't manufacture room that isn't there). Spread across
    // the full width and sized down a step, with tanks 3-5 kept clear of
    // the door's x:92, this set now clears roomKit.js's own audit at 0
    // hits — verified via the same Playwright script used on every other
    // room, not just eyeballed.
    { id: 'tank1', x: 6, y: 78, node: () => drawAquariumTank('#2f9e5b', 7), label: 'Aquarium tank', desc: 'Algae-green water. Something small darts away from the glass.' },
    { id: 'tank2', x: 24, y: 94, node: () => drawAquariumTank('#4cd6ff', 7), label: 'Aquarium tank', desc: 'Cracked at the base. This one’s already leaking into the flood.' },
    { id: 'tank3', x: 68, y: 76, node: () => drawAquariumTank('#2f9e5b', 7), label: 'Aquarium tank', desc: 'Empty. Whatever lived here got out before you did.' },
    { id: 'tank4', x: 44, y: 92, node: () => drawAquariumTank('#4cd6ff', 7), label: 'Aquarium tank', desc: 'A feeding label, faded past reading.' },
    { id: 'tank5', x: 86, y: 80, node: () => drawAquariumTank('#2f9e5b', 6), label: 'Aquarium tank', desc: 'Bubbles still rise from a filter that shouldn’t still be running.' },
  ];
}

const DECOY_ROOM_LINES = [
  'Just dust and leaf litter this far in.',
  'Something skitters away as you get close.',
  'Nothing here but green, growing over everything.',
];

function plantsProps() {
  return [
    { id: 'plant1', x: 10, y: 76, node: () => drawPlantProp(9), label: 'Overgrown plant', desc: sample(DECOY_ROOM_LINES, 1)[0] },
    { id: 'plant2', x: 88, y: 78, node: () => drawPlantProp(8), label: 'Overgrown plant', desc: sample(DECOY_ROOM_LINES, 1)[0] },
    { id: 'plant3', x: 32, y: 90, node: () => drawPlantProp(9), label: 'Overgrown plant', desc: sample(DECOY_ROOM_LINES, 1)[0] },
    { id: 'plant4', x: 68, y: 92, node: () => drawPlantProp(8), label: 'Overgrown plant', desc: sample(DECOY_ROOM_LINES, 1)[0] },
    { id: 'crate1', x: 22, y: 70, node: () => drawCrateStack('#5e7a4a', 7), label: 'Crate stack', desc: 'Split open, roots growing straight through the slats.' },
    {
      id: 'crate2', x: 78, y: 68, node: () => drawCrateStack('#5e7a4a', 7), label: 'Crate stack',
      desc: 'Someone tucked something in here before the flood ever started.',
      pickup: { label: 'RUSTED KEYRING', flavor: 'No keys left on it. You keep it anyway.' },
    },
  ];
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the flooding aquarium ward,
  // the (initially locked) breaker terminal, and starts the 60-second
  // flood clock.
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; stopClock(); });

    let { grid, solutionCells } = generate();
    let moves = 0;
    let doorReached = false;
    let solved = false;
    let timeLeft = FLOOD_SECONDS;
    let clockTimer = null;

    const room = createRoom({ accent: '#ffb000', ariaLabel: 'Sector 2 flooding ward' });
    const waterEl = el('div', { class: 'flood-water' });
    // A physical breaker-panel casing bolted to the back wall, mirroring
    // the puzzle grid live — styled as its own object (riveted frame,
    // round status LEDs, a label plate) rather than a bare copy of the
    // flat-square puzzle widget on the right.
    const panelLightsEl = el('div', { class: 'panel-lights' });
    for (let i = 0; i < 25; i++) panelLightsEl.appendChild(el('div', { class: 'panel-light' }));
    const panelLightsFrame = el('div', { class: 'panel-lights-frame', style: 'left: 50%; top: 14%; transform: translateX(-50%);' }, [
      panelLightsEl,
      el('span', { class: 'panel-lights-label' }, 'PWR PANEL'),
    ]);
    room.el.append(waterEl, panelLightsFrame);

    const frame = terminalFrame({ title: 'SECTOR 2 // BREAKER WARD', accent: '#ffb000' });
    const body = frame.querySelector('.term-body');
    const timerEl = el('div', { class: 'breaker-timer' });
    const puzzlePane = el('div', {});
    body.appendChild(timerEl);
    body.appendChild(puzzlePane);
    container.appendChild(el('div', { class: 'level3-scene split-scene' }, [room.el, frame]));

    function renderTimer() {
      timerEl.textContent = `WATER RISING: ${timeLeft}s`;
      const pct = Math.min(100, ((FLOOD_SECONDS - timeLeft) / FLOOD_SECONDS) * 100);
      waterEl.style.height = `${pct}%`;
    }

    function renderPanelLights() {
      const flat = grid.flat();
      panelLightsEl.querySelectorAll('.panel-light').forEach((el2, i) => el2.classList.toggle('panel-light--on', flat[i]));
    }

    function renderLockedMessage() {
      puzzlePane.innerHTML = '';
      puzzlePane.appendChild(el('p', { class: 'breaker-locked-msg' }, 'The breaker panel is dead. Something at the far door must be feeding it power — get there before the water does.'));
    }

    let gridEl = null;
    let hud = null;
    function renderPuzzle() {
      puzzlePane.innerHTML = '';
      const intro = el('p', { class: 'level-intro' }, 'Restore power to all 25 panels — toggling one flips its neighbors too.');
      hud = el('div', { class: 'breaker-hud' });
      gridEl = el('div', { class: 'breaker-grid', role: 'grid', 'aria-label': 'Breaker panel' });
      const controls = el('div', { class: 'breaker-controls' }, [
        el('button', { class: 'cta-btn secondary', onclick: () => resetPuzzle() }, '↻ RESHUFFLE'),
        el('button', { class: 'cta-btn secondary', onclick: () => showHint() }, '💡 HINT'),
      ]);
      puzzlePane.append(intro, hud, gridEl, controls);
      renderHud();
      renderGrid();
    }

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
          gridEl.appendChild(el('button', {
            class: `cell ${on ? 'cell--on' : 'cell--off'}`,
            'aria-label': `Breaker row ${r + 1} column ${c + 1}, ${on ? 'powered' : 'unpowered'}`,
            onclick: () => press(r, c),
          }));
        }
      }
    }

    function showHint() {
      sfx.select();
      renderGrid();
      const cells = gridEl.querySelectorAll('.cell');
      solutionCells.forEach(([r, c]) => cells[r * SIZE + c]?.classList.add('cell--hint'));
      setTimeout(() => { if (alive) cells.forEach((c) => c.classList.remove('cell--hint')); }, 2500);
    }

    function press(r, c) {
      toggle(grid, r, c);
      moves++;
      sfx.move();
      renderHud();
      renderGrid();
      renderPanelLights();
      if (isSolved(grid)) onSolved();
    }

    function resetPuzzle() {
      sfx.select();
      ({ grid, solutionCells } = generate());
      moves = 0;
      renderHud();
      renderGrid();
      renderPanelLights();
    }

    // ---- flood clock: ticks from mount, regardless of phase, until the
    // puzzle is solved or the scene tears down. ----
    function startClock() {
      clockTimer = setInterval(() => {
        if (!alive || solved) return;
        timeLeft--;
        renderTimer();
        if (timeLeft <= 0) onDrowned();
      }, 1000);
    }
    function stopClock() { clearInterval(clockTimer); }

    async function onDrowned() {
      stopClock();
      sfx.error();
      shake(room.el);
      timerEl.textContent = 'THE WARD FLOODS. SYSTEMS RESET.';
      await delay(1200, ctx.signal).catch(() => {});
      if (!alive) return;
      timeLeft = FLOOD_SECONDS;
      ({ grid, solutionCells } = generate());
      moves = 0;
      renderPanelLights();
      if (doorReached) renderPuzzle(); else renderLockedMessage();
      renderTimer();
      startClock();
    }

    // Computed once (not per-render): renderRoom() is called again when
    // the door is first reached, and re-generating these would lose the
    // one pickup's .taken flag along with everything else's identity.
    const wardPropDefs = wardProps();

    // ---- the room: a straight path to the door; reaching it for the
    // first time powers the breaker panel on (unlocking the puzzle). Every
    // tank and pipe along the way is also a walkable, clickable hotspot —
    // see wardProps() — none of it gates reaching the door. ----
    function renderRoom() {
      wardPropDefs.forEach((def) => {
        room.setHotspot(def.id, { x: def.x, y: def.y, build: () => [def.node()], label: def.label, onClick: () => onPropClick(def) });
      });
      room.setHotspot('door', {
        x: 92, y: 58,
        build: () => [drawDoor(!doorReached, 8), el('span', {}, doorReached ? 'PANEL: LIVE' : 'DOOR')],
        label: doorReached ? 'Door, panel powered' : 'Door at the end of the path',
        onClick: onDoorClick,
      });
      room.declutter();
    }

    // ---- optional set dressing: walk up, print a flavor line; one
    // pickup per room is purely narrative (there's no inventory panel in
    // this sector). Shared by both rooms in this scene. ----
    async function onPropClick(def) {
      await room.walkTo(def.id);
      if (room.getActive() !== def.id) return;
      if (def.pickup && !def.pickup.taken) {
        room.showBubble([
          { label: 'LOOK', onClick: () => { room.hideBubble(); logAmbient(def.desc); } },
          { label: `TAKE ${def.pickup.label}`, onClick: () => { room.hideBubble(); takeProp(def); } },
        ]);
      } else {
        logAmbient(def.desc);
      }
    }
    async function takeProp(def) {
      def.pickup.taken = true;
      sfx.select();
      logAmbient(`You pocket the ${def.pickup.label.toLowerCase()}. ${def.pickup.flavor}`);
    }
    // Props print into whichever pane is currently showing (the locked
    // message, the puzzle, or the plant room's intro) rather than a
    // dedicated log, so a one-line ambientLine footer under that pane is
    // reused for all of it.
    function logAmbient(text) {
      let line = puzzlePane.querySelector('.ambient-line');
      if (!line) {
        line = el('p', { class: 'ambient-line' });
        puzzlePane.appendChild(line);
      }
      line.textContent = text;
    }

    async function onDoorClick() {
      await room.walkTo('door');
      if (room.getActive() !== 'door') return;
      if (!doorReached) {
        doorReached = true;
        sfx.terminalOpen();
        renderRoom();
        renderPuzzle();
      }
    }

    async function onSolved() {
      solved = true;
      stopClock();
      sfx.unlock();
      glitchBurst(frame, 400);
      timerEl.textContent = 'PANEL FULLY POWERED. DRAINING...';
      // A quick, dramatic drain-and-burst before the room beyond opens up.
      waterEl.style.transition = 'height 0.6s ease-in';
      waterEl.style.height = '0%';
      await delay(700, ctx.signal).catch(() => {});
      const digit = getState().codeDigits[2];
      completeLevel(2, digit);
      await crossToEscapeRoom();
    }

    async function crossToEscapeRoom() {
      room.el.classList.add('room-scene--transition');
      await delay(230, ctx.signal).catch(() => {});
      room.el.classList.remove('room-scene--transition');
      // Fresh, dry room: swap out decor + hotspots for the plant-filled
      // escape room, entering near the bottom with the exit up top.
      room.el.querySelector('.flood-water')?.remove();
      room.el.querySelector('.panel-lights-frame')?.remove();
      room.clearHotspots();
      plantsProps().forEach((def) => {
        room.setHotspot(def.id, { x: def.x, y: def.y, build: () => [def.node()], label: def.label, onClick: () => onPropClick(def) });
      });
      room.setHotspot('exit-door', {
        x: 50, y: 14,
        build: () => [drawDoor(false, 8), el('span', {}, 'DOOR')],
        label: 'Exit door',
        onClick: onExitClick,
      });
      room.placeAt(50, 80);
      room.declutter();
      puzzlePane.innerHTML = '';
      timerEl.textContent = '';
      puzzlePane.appendChild(el('p', { class: 'level-intro' }, 'The water drains through the grates below. Beyond the broken door: green, growing things, and a way up ahead.'));
      await delay(300, ctx.signal).catch(() => {});
    }

    async function onExitClick() {
      await room.walkTo('exit-door');
      if (room.getActive() !== 'exit-door') return;
      const digit = getState().codeDigits[2];
      showInterstitial(container.querySelector('.level3-scene'), {
        levelIndex: 2,
        storyBeat: 'ECHO: "Power restored, and the water\'s gone somewhere else\'s problem now. That hallway used to lead to the records room."',
        shardDigit: digit,
        ctaLabel: 'NEXT SECTOR ▶',
        onContinue: () => ctx.goTo('level4'),
      });
    }

    renderRoom();
    renderLockedMessage();
    renderPanelLights();
    renderTimer();
    startClock();
  },
};
