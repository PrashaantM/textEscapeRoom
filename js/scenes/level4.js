// Scene: Sector 3, "VAULT BREACH". A bank-vault heist: the player starts
// in a vault antechamber and must unlock the vault's 6-letter passkey.
// Opening the vault's entry UI starts a 5-minute clock and drops the
// locks on 4 side rooms (a file storage room, a security room, an
// electrical room, and a decoy laboratory), each reached from the vault
// hub. 4 of the passkey's letters are found by investigating specific
// objects in 3 of those rooms (the lab is a pure decoy); the remaining 2
// are buried, unhighlighted, in the terminal's noise — same as before.
// The player gets 10 tries at the passkey; every miss past the 10th
// doubles the clock's speed instead of blocking further guesses. Running
// out of time gets the player caught (a restart of this sector); guessing
// right opens the vault, awards the fourth memory shard via
// completeLevel(3, digit), and routes to level5.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, flashScreen } from '../fx.js';
import { el, delay, randInt, sample, shuffle } from '../utils.js';
import { terminalFrame, showInterstitial } from './shared.js';
import {
  drawPadlock, drawDoor, drawVaultCam, drawPoster, drawPaperPile, drawComputerCubicle,
  drawMonitorSection, drawChairProp, drawMultiscreen, drawControlPanel, drawLockerStuffed,
  drawElectricalBox, drawCrateProp, drawLabDesk, drawLabFlask, drawPlantProp, drawCabinet,
  drawClosetDoor, drawWallLight,
} from '../sprites.js';
import { createRoom, buildInventoryOverlay } from './roomKit.js';

const WORD_BANK = ['ECHOES', 'ARCADE', 'MEMORY', 'BOOTUP', 'CIPHER', 'GLITCH', 'SHADOW', 'SILENT', 'ENIGMA', 'ORACLE'];
const NOISE_CHARS = '!@#$%^&*<>{}[]()~/|;:+=01'.split('');
const HEIST_SECONDS = 300;
const MAX_SCORED_TRIES = 10;
const QWERTY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const RIDDLES = [
  'ECHO: "Forgotten things go where no one reads anymore. Look where the paperwork piled up and nobody ever came back for it."',
  'ECHO: "Someone was always watching this place. Whatever they saw is still sitting behind their own eyes, if the screens still work."',
  'ECHO: "Where the power splits and sparks, something got left behind in the panic — in a locker, a vent, a crate. Anywhere but plain sight."',
];

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

// Lays `count` items out in a jittered grid within the given percentage
// bounds, so a room that needs 20-30 background elements doesn't require
// hand-placing every single one. Purely cosmetic positioning.
function scatter(count, { xMin, xMax, yMin, yMax, cols }) {
  const rows = Math.ceil(count / cols);
  const xStep = (xMax - xMin) / cols;
  const yStep = (yMax - yMin) / rows;
  const out = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    out.push({
      x: xMin + col * xStep + xStep / 2 + (Math.random() - 0.5) * xStep * 0.15,
      y: yMin + row * yStep + yStep / 2 + (Math.random() - 0.5) * yStep * 0.15,
    });
  }
  return out;
}

const DECOY_LINES = [
  "Just dust and old ink. Whoever worked here left in a hurry.",
  "Nothing but cobwebs and a stapler with no staples.",
  "It creaks. It's just a creak.",
  "You find a coffee mug, cold for a very long time.",
  "There's nothing here worth a memory shard.",
  "A drawer full of pens that don't write anymore.",
];

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Picks the round's passkey and clue
  // split, builds the vault hub, and waits for the player to start the
  // heist at the vault itself.
  mount(container, ctx) {
    let alive = true;
    ctx.signal.addEventListener('abort', () => { alive = false; stopClock(); });

    const passkey = sample(WORD_BANK, 1)[0];
    const positions = shuffle([0, 1, 2, 3, 4, 5]);
    const room1Pos = positions[0];
    const room2Pos = positions[1];
    const room3Pos = [positions[2], positions[3]];
    const termPositions = [positions[4], positions[5]];

    const guess = ['', '', '', '', '', ''];
    let activeSlot = 0;
    let attemptsUsed = 0;
    let solved = false;
    let heistStarted = false;
    let timeLeft = HEIST_SECONDS;
    let doubled = false;
    let clockTimer = null;
    const inventory = [];
    let inventoryOverlay = null;
    let currentRoomName = 'vault';

    const room = createRoom({ accent: '#00ff9c', ariaLabel: 'Sector 3 vault' });

    const frame = terminalFrame({ title: 'SECTOR 3 // VAULT BREACH', accent: '#00ff9c' });
    const body = frame.querySelector('.term-body');
    const vaultBadge = el('div', { class: 'vault-badge' }, [drawPadlock('#00ff9c', 7), el('span', {}, 'VAULT: SEALED')]);
    const idlePane = el('div', {}, [
      el('p', { class: 'level-intro' }, 'A sealed vault, 4 locked doors, and a terminal that has seen better decades. Walk up to the vault to begin.'),
    ]);
    const heistPane = el('div', { hidden: true });
    // Visible in both the idle and heist views (unlike heistPane's own
    // `log`), since the hub's own fixtures are clickable from the start,
    // before the heist even begins.
    const hubAmbientEl = el('p', { class: 'ambient-line' });
    body.append(vaultBadge, hubAmbientEl, idlePane, heistPane);
    container.appendChild(el('div', { class: 'level4-scene split-scene' }, [room.el, frame]));

    // ---- heist UI: timer, tries, riddles, noise-buried clues, and the
    // 6-slot passkey entry with a laptop QWERTY keyboard (never a real
    // text input, so no on-screen keyboard can ever pop up here). ----
    const timerEl = el('div', { class: 'vault-timer' });
    const triesEl = el('div', { class: 'vault-tries' });
    const noiseBox = el('div', { class: 'noise-box', role: 'group', 'aria-label': 'Terminal noise' });
    const log = el('div', { class: 'vault-log', role: 'log', 'aria-live': 'polite' });
    const slotEls = [];
    const slotsRow = el('div', { class: 'keypad-slots vault-letter-slots' });
    for (let i = 0; i < 6; i++) {
      const btn = el('button', { class: 'keypad-slot', onclick: () => setActive(i) }, '_');
      slotEls.push(btn);
      slotsRow.appendChild(btn);
    }
    const keyboardEl = el('div', { class: 'qwerty-keyboard' },
      QWERTY_ROWS.map((row) => el('div', { class: 'qwerty-row' },
        row.map((ltr) => el('button', { class: 'qwerty-key', onclick: () => setLetter(ltr) }, ltr))))
    );
    const submitBtn = el('button', { class: 'cta-btn', onclick: () => submitGuess() }, 'SUBMIT PASSKEY ▶');
    const inventoryBtn = el('button', { class: 'cta-btn secondary', onclick: () => openInventory() }, 'INVENTORY');

    heistPane.append(
      el('div', { class: 'vault-riddles' }, RIDDLES.map((r) => el('p', { class: 'vault-riddle' }, r))),
      timerEl, triesEl, noiseBox, log, slotsRow, keyboardEl,
      el('div', { class: 'breaker-controls' }, [submitBtn, inventoryBtn]),
    );

    function renderSlots() {
      slotEls.forEach((btn, i) => {
        btn.textContent = guess[i] || '_';
        btn.classList.toggle('active', i === activeSlot);
      });
    }
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
            class: 'noise-token noise-token--blend',
            onclick: () => {
              if (btn.classList.contains('used')) return;
              btn.classList.add('used');
              btn.disabled = true;
              sfx.reveal();
              logLine(`CLUE FRAGMENT: POSITION ${row.pos + 1} = "${passkey[row.pos]}"`, 'vault-hint');
            },
          }, 'clue.frag');
          line.appendChild(btn);
          line.appendChild(el('span', { class: 'noise-text' }, garbage(randInt(3, 12))));
        }
        noiseBox.appendChild(line);
      });
    }

    function logLine(text, cls = '') {
      log.appendChild(el('p', { class: `vault-log-line ${cls}`.trim() }, text));
      log.scrollTop = log.scrollHeight;
    }

    function renderTimer() {
      const m = Math.floor(Math.max(0, timeLeft) / 60);
      const s = Math.max(0, timeLeft) % 60;
      timerEl.textContent = `SECURITY ETA: ${m}:${String(s).padStart(2, '0')}${doubled ? ' (ACCELERATED)' : ''}`;
    }
    function renderTries() {
      triesEl.textContent = attemptsUsed < MAX_SCORED_TRIES
        ? `TRIES: ${attemptsUsed} / ${MAX_SCORED_TRIES}`
        : `TRIES: ${attemptsUsed} (past ${MAX_SCORED_TRIES} — security is closing in faster now)`;
    }

    function renderFeedback(word) {
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const hit = word[i] === passkey[i];
        letters.push(el('span', { class: hit ? 'vault-letter-hit' : 'vault-letter-miss' }, word[i] || '_'));
      }
      log.appendChild(el('p', { class: 'vault-log-line' }, ['> ', ...letters]));
      log.scrollTop = log.scrollHeight;
    }

    function submitGuess() {
      if (solved || !heistStarted) return;
      const word = guess.join('');
      if (guess.includes('')) {
        logLine('Fill all 6 letters before submitting.', 'vault-hint');
        return;
      }
      if (word === passkey) {
        renderFeedback(word);
        win();
        return;
      }
      sfx.error();
      shake(frame);
      attemptsUsed++;
      renderFeedback(word);
      if (attemptsUsed === MAX_SCORED_TRIES + 1) {
        doubled = true;
        logLine('SECURITY HAS YOUR SCENT NOW. The clock just doubled.', 'vault-hint');
      }
      renderTries();
    }

    // ---- inventory: clue letters found in the rooms, shown visually. ----
    function openInventory() {
      sfx.select();
      const items = inventory.map((it) => ({ id: it.id, label: it.label, node: it.node(), onUse: () => {} }));
      inventoryOverlay = buildInventoryOverlay(items, { onClose: () => { inventoryOverlay?.remove(); inventoryOverlay = null; } });
      room.el.appendChild(inventoryOverlay);
    }
    function collectClue(id, label, pos) {
      inventory.push({ id, label, node: () => drawPaperPile(6) });
      sfx.reveal();
      logLine(`CLUE FOUND (${label}): POSITION ${pos + 1} = "${passkey[pos]}"`, 'vault-hint');
    }

    // ---- vault hub room: the vault itself + 4 locked doors, all sitting
    // on the horizon like every other door in the game, plus a handful of
    // clickable fixtures. `fromId` (passed by a side room's back door) is
    // which door to re-place the player at, so returning to the hub lands
    // you back at the exact door you used instead of some fixed spot. ----
    function renderHub(entry, fromId) {
      room.clearHotspots();
      HUB_PROPS.forEach((def) => {
        room.setHotspot(def.id, { x: def.x, y: def.y, build: () => [def.node()], label: def.label, onClick: () => onHubPropClick(def) });
      });
      room.setHotspot('vault', {
        x: 50, y: 58,
        build: () => [drawDoor(!solved, 10), el('span', {}, solved ? 'VAULT: OPEN' : 'VAULT: SEALED')],
        label: solved ? 'Vault, open' : 'The vault door',
        onClick: onVaultClick,
      });
      doorMeta.forEach(({ id, x, y, label }) => {
        hubDoorBtns[id] = room.setHotspot(id, {
          x, y,
          build: () => heistStarted
            ? [drawDoor(false, 8), el('span', {}, 'DOOR')]
            : [drawDoor(true, 8), drawPadlock('#00ff9c', 4), el('span', {}, 'LOCKED')],
          label: heistStarted ? label : `${label}, locked`,
          onClick: () => onSideDoorClick(id),
        });
      });
      if (entry && fromId) {
        const meta = doorMeta.find((d) => d.id === fromId);
        if (meta) room.placeAt(meta.x, meta.y);
      }
    }
    const doorMeta = [
      { id: 'room1', x: 15, y: 58, label: 'File storage room door' },
      { id: 'room2', x: 34, y: 58, label: 'Security room door' },
      { id: 'room3', x: 66, y: 58, label: 'Electrical room door' },
      { id: 'room4', x: 85, y: 58, label: 'Laboratory door' },
    ];
    const doorMetaIds = doorMeta.map((d) => d.id);
    const hubDoorBtns = {};

    // A handful of unique, clickable hub fixtures (there are only 5, and
    // they're the first thing a player sees, so each gets its own line
    // instead of a pooled one). Wall-mounted ones sit above y=50; the two
    // freestanding cabinets sit on the floor below y=66.
    const HUB_PROPS = [
      { id: 'hub-cam', x: 50, y: 14, node: () => drawVaultCam('#00ff9c', 7), label: 'Security camera', desc: 'A security camera, lens cracked. It hasn’t seen anything in years.' },
      { id: 'hub-light-1', x: 10, y: 8, node: () => drawWallLight('#ffd166', 6), label: 'Wall light', desc: 'A wall light, humming faint and steady.' },
      { id: 'hub-light-2', x: 90, y: 8, node: () => drawWallLight('#ffd166', 6), label: 'Wall light', desc: 'Flickers on a delay, like it’s thinking about it.' },
      { id: 'hub-cabinet-1', x: 8, y: 78, node: () => drawCabinet('#00ff9c', 8, undefined, 2), label: 'Cabinet', desc: 'Locked. Whatever paperwork lives in here isn’t leaving with you.' },
      // y nudged from its original 78 — close enough to the wall that this
      // cabinet rendered mostly behind the lab door mounted above it
      // (x:85) once the room's real depth brought them visually close.
      { id: 'hub-cabinet-2', x: 92, y: 90, node: () => drawCabinet('#00ff9c', 8, undefined, 2), label: 'Cabinet', desc: 'Empty drawers, every one. Somebody cleared this out already.' },
      { id: 'hub-plant-1', x: 20, y: 90, node: () => drawPlantProp(8), label: 'Plastic plant', desc: 'Plastic, unconvincingly. Nobody watered anything down here.' },
      { id: 'hub-plant-2', x: 80, y: 90, node: () => drawPlantProp(8), label: 'Plastic plant', desc: 'A thin layer of dust standing in for soil.' },
    ];
    async function onHubPropClick(def) {
      await room.walkTo(def.id);
      if (room.getActive() !== def.id) return;
      hubAmbientEl.textContent = def.desc;
    }

    async function onVaultClick() {
      await room.walkTo('vault');
      if (room.getActive() !== 'vault' || currentRoomName !== 'vault') return;
      if (solved) return;
      if (!heistStarted) {
        room.showBubble([{ label: 'UNLOCK VAULT', onClick: () => { room.hideBubble(); startHeist(); } }]);
      } else {
        room.showBubble([{ label: 'ENTER PASSKEY', onClick: () => { room.hideBubble(); triesEl.scrollIntoView?.(); } }]);
      }
    }

    async function startHeist() {
      sfx.unlock();
      idlePane.hidden = true;
      heistPane.hidden = false;
      buildNoise();
      renderTimer();
      renderTries();
      startClock();
      logLine('The vault entry panel hums to life. 5 minutes on the clock, and every door in this wing just clicked open.', 'vault-hint');
      // Play the locks-falling animation on the still-locked doors (each
      // hotspot's 2nd child is its padlock canvas) before flipping
      // heistStarted, which is what actually swaps their build() to the
      // unlocked look on the next renderHub().
      doorMetaIds.forEach((id) => {
        const btn = hubDoorBtns[id];
        const lock = btn?.children[1];
        if (lock) { lock.classList.add('room-lock--falling'); setTimeout(() => lock.remove(), 650); }
      });
      await delay(650, ctx.signal).catch(() => {});
      if (!alive) return;
      heistStarted = true;
      renderHub();
    }

    function startClock() {
      clockTimer = setInterval(() => {
        if (!alive || solved) return;
        timeLeft -= doubled ? 2 : 1;
        renderTimer();
        if (timeLeft <= 0) onCaught();
      }, 1000);
    }
    function stopClock() { clearInterval(clockTimer); }

    async function onCaught() {
      stopClock();
      sfx.error();
      flashScreen('#ff0000', 300);
      glitchBurst(frame, 500);
      const overlay = el('div', { class: 'security-caught' }, [
        el('p', {}, 'SECURITY HAS YOU.'),
        el('p', { class: 'level-intro' }, 'Footsteps. A flashlight. Then hands on your shoulders.'),
      ]);
      container.querySelector('.level4-scene').appendChild(overlay);
      await delay(2200);
      if (!alive) return;
      ctx.goTo('level4');
    }

    async function onSideDoorClick(id) {
      if (!heistStarted) {
        await room.walkTo(id);
        room.showBubble([{ label: 'LOCKED', onClick: () => room.hideBubble() }]);
        return;
      }
      await room.walkTo(id);
      if (room.getActive() !== id || currentRoomName !== 'vault') return;
      await crossTo(id, ROOM_RENDERERS[id]);
    }

    async function crossTo(name, renderFn, arg) {
      room.el.classList.add('room-scene--transition');
      sfx.terminalOpen();
      await delay(230, ctx.signal).catch(() => {});
      currentRoomName = name;
      renderFn(true, arg);
      await delay(270, ctx.signal).catch(() => {});
      room.el.classList.remove('room-scene--transition');
    }

    // Builds a generic "click to investigate" hotspot. Deliberately no
    // visible label under the icon (just aria-label, for accessibility) —
    // these come in dense clusters of near-identical objects (posters,
    // paper piles, lockers...) and a repeated text label under every one
    // would make each hotspot's footprint wider than the gap between them,
    // so adjacent ones would overlap and silently steal each other's clicks.
    function investigateHotspot(id, { x, y, node, label, onInvestigate }) {
      room.setHotspot(id, {
        x, y, build: () => [node()], label,
        onClick: async () => {
          await room.walkTo(id);
          if (room.getActive() !== id) return;
          onInvestigate();
        },
      });
    }

    // Every side room's exit is the literal same door the player walked
    // in through — a fixed spot just inside the entrance (50, 92) — not a
    // second, unrelated door parked in a corner. `roomId` is which hub
    // door to re-place the player at on the way back (see renderHub's
    // `fromId` param), so the round trip lands you exactly where you left.
    function addBackDoor(roomId) {
      room.setHotspot('back', {
        x: 50, y: 92,
        build: () => [drawDoor(false, 7), el('span', {}, 'BACK')],
        label: 'Back through the door you came in',
        onClick: async () => {
          await room.walkTo('back');
          if (room.getActive() === 'back') await crossTo('vault', renderHub, roomId);
        },
      });
    }

    // ---- Room 1: file storage — 30 cabinets + 7 paper piles + 3 cubicles
    // + 9 posters (one hides the clue) + a closet door; 20 clickable
    // things total (7 + 3 + 9 + 1). ----
    function renderRoom1(entry) {
      room.clearHotspots();
      if (entry) room.placeAt(50, 92);
      const cabinets = scatter(30, { xMin: 4, xMax: 96, yMin: 4, yMax: 16, cols: 10 });
      room.setDecor(cabinets.map((p) => ({ ...p, node: drawCabinet('#00ff9c', 6, undefined, randInt(2, 3)) })));

      const paperSpots = scatter(7, { xMin: 8, xMax: 92, yMin: 20, yMax: 32, cols: 7 });
      paperSpots.forEach((p, i) => investigateHotspot(`paper${i}`, {
        ...p, node: () => drawPaperPile(7), label: 'Paper pile',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));

      const cubicleSpots = scatter(3, { xMin: 15, xMax: 85, yMin: 72, yMax: 72, cols: 3 });
      cubicleSpots.forEach((p, i) => investigateHotspot(`cubicle${i}`, {
        ...p, node: () => drawComputerCubicle('#00ff9c', 7), label: 'Computer cubicle',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));

      const posterSpots = scatter(9, { xMin: 8, xMax: 92, yMin: 38, yMax: 50, cols: 5 });
      const clueIdx = randInt(0, 8);
      posterSpots.forEach((p, i) => {
        let found = false;
        // Every poster looks identical (plain accent) until clicked — the
        // clue one only reveals itself (a brighter, torn-open look) after
        // the player actually reads it, not before, so there's nothing to
        // visually spot from across the room.
        room.setHotspot(`poster${i}`, {
          ...p, build: () => [drawPoster(found ? '#ffd166' : '#00ff9c', 6)],
          label: 'Torn poster on the bulletin board',
          onClick: async () => {
            await room.walkTo(`poster${i}`);
            if (room.getActive() !== `poster${i}`) return;
            if (i !== clueIdx) { logLine(sample(DECOY_LINES, 1)[0]); return; }
            if (found) return;
            found = true;
            room.setHotspot(`poster${i}`, {
              ...p, build: () => [drawPoster('#ffd166', 6)],
              label: 'Torn poster on the bulletin board (fragment taken)',
              onClick: () => {},
            });
            collectClue('clue-poster', 'Poster fragment', room1Pos);
          },
        });
      });

      investigateHotspot('closet', {
        x: 50, y: 54, node: () => drawClosetDoor(false, 8), label: 'Closet door',
        onInvestigate: () => logLine('Inside: mop, bucket, a calendar three years out of date.'),
      });

      addBackDoor('room1');
    }

    // ---- Room 2: security — a big multiscreen, 4 monitor sections, a
    // control panel, chairs. ----
    function renderRoom2(entry) {
      room.clearHotspots();
      if (entry) room.placeAt(50, 92);
      room.setDecor([{ x: 50, y: 15, node: drawMultiscreen(10) }]);
      const chairSpots = scatter(11, { xMin: 5, xMax: 95, yMin: 64, yMax: 90, cols: 6 });
      chairSpots.forEach((p, i) => investigateHotspot(`chair${i}`, {
        ...p, node: () => drawChairProp(6), label: 'Chair',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));

      const sectionSpots = scatter(4, { xMin: 12, xMax: 88, yMin: 38, yMax: 38, cols: 4 });
      const clueIdx = randInt(0, 3);
      sectionSpots.forEach((p, i) => {
        let found = false;
        room.setHotspot(`section${i}`, {
          ...p, build: () => [drawMonitorSection(7, undefined, i === clueIdx ? 'clue' : 'static')],
          label: 'Security monitor section',
          onClick: async () => {
            await room.walkTo(`section${i}`);
            if (room.getActive() !== `section${i}`) return;
            if (i !== clueIdx) { logLine('Static. Everything else on this feed is censored out.'); return; }
            if (found) return;
            found = true;
            collectClue('clue-monitor', 'Monitor fragment', room2Pos);
          },
        });
      });

      investigateHotspot('multiscreen', {
        x: 50, y: 15, node: () => el('span', {}), label: 'Multiscreen wall',
        onInvestigate: () => logLine('Six feeds, all dead air. Whatever they were watching, it stopped watching back.'),
      });
      investigateHotspot('panel', {
        x: 50, y: 55, node: () => drawControlPanel('#00ff9c', 7), label: 'Control panel',
        onInvestigate: () => logLine('Dials, all zeroed out. Someone shut this down in a hurry.'),
      });

      addBackDoor('room2');
    }

    // ---- Room 3: electrical — 8 lockers, an electrical box, 2 vents (one
    // loose, holding a clue), a pyramid of 6 crates (top 3 cracked, one
    // holding a clue). ----
    function renderRoom3(entry) {
      room.clearHotspots();
      if (entry) room.placeAt(50, 92);
      const lockerSpots = scatter(8, { xMin: 8, xMax: 92, yMin: 12, yMax: 32, cols: 4 });
      lockerSpots.forEach((p, i) => investigateHotspot(`locker${i}`, {
        ...p, node: () => drawLockerStuffed('#00ff9c', 7), label: 'Locker',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));

      investigateHotspot('ebox', {
        x: 15, y: 55, node: () => drawElectricalBox(8), label: 'Electrical box',
        onInvestigate: () => logLine('Breakers, all flipped the wrong way. Not your problem right now.'),
      });
      investigateHotspot('vent-closed', {
        x: 35, y: 60, node: () => drawClosetDoor(false, 7), label: 'Closed vent',
        onInvestigate: () => logLine("Sealed shut. Whatever's in there is staying in there."),
      });
      let looseFound = false;
      investigateHotspot('vent-loose', {
        x: 55, y: 60, node: () => drawClosetDoor(true, 7), label: 'Loose vent panel',
        onInvestigate: () => {
          if (looseFound) return;
          looseFound = true;
          collectClue('clue-vent', 'Vent fragment', room3Pos[0]);
        },
      });

      const crateClueIdx = randInt(0, 2);
      for (let i = 0; i < 3; i++) {
        let found = false;
        investigateHotspot(`crate-bottom${i}`, {
          x: 62 + i * 14, y: 92, node: () => drawCrateProp(false, 8), label: 'Crate',
          onInvestigate: () => logLine('Solid. Just crate.'),
        });
        room.setHotspot(`crate-top${i}`, {
          x: 62 + i * 14, y: 76, build: () => [drawCrateProp(true, 8)], label: 'Cracked crate',
          onClick: async () => {
            await room.walkTo(`crate-top${i}`);
            if (room.getActive() !== `crate-top${i}`) return;
            if (i !== crateClueIdx) { logLine('Splinters and packing straw. Nothing else.'); return; }
            if (found) return;
            found = true;
            collectClue('clue-crate', 'Crate fragment', room3Pos[1]);
          },
        });
      }

      addBackDoor('room3');
    }

    // ---- Room 4: laboratory — a decoy. Nothing here has a clue. ----
    function renderRoom4(entry) {
      room.clearHotspots();
      if (entry) room.placeAt(50, 92);
      const deskSpots = [
        { id: 'desk0', x: 15, y: 68, unit: 6 },
        { id: 'desk1', x: 35, y: 72, unit: 6 },
        { id: 'desk2', x: 65, y: 68, unit: 6 },
        { id: 'desk3', x: 85, y: 72, unit: 5 },
      ];
      deskSpots.forEach((d) => investigateHotspot(d.id, {
        x: d.x, y: d.y, node: () => drawLabDesk(d.unit), label: 'Lab desk',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));
      investigateHotspot('flask0', {
        x: 25, y: 90, node: () => drawLabFlask('#2f9e5b', 7), label: 'Lab flask',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      });
      investigateHotspot('flask1', {
        x: 75, y: 90, node: () => drawLabFlask('#4cd6ff', 6), label: 'Lab flask',
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      });
      const decoys = [
        { id: 'lockerA', label: 'Cracked-open locker' },
        { id: 'lockerB', label: 'Cracked-open locker' },
        { id: 'papersA', label: 'Scattered paperwork' },
        { id: 'papersB', label: 'Scattered paperwork' },
        { id: 'rig1', label: 'Experiment contraption' },
        { id: 'rig2', label: 'Experiment contraption' },
      ];
      const spots = scatter(decoys.length, { xMin: 15, xMax: 85, yMin: 78, yMax: 94, cols: 3 });
      decoys.forEach((d, i) => investigateHotspot(d.id, {
        ...spots[i], node: () => drawPaperPile(7), label: d.label,
        onInvestigate: () => logLine(sample(DECOY_LINES, 1)[0]),
      }));

      addBackDoor('room4');
    }

    const ROOM_RENDERERS = { room1: renderRoom1, room2: renderRoom2, room3: renderRoom3, room4: renderRoom4 };

    function win() {
      solved = true;
      stopClock();
      sfx.unlock();
      glitchBurst(frame, 400);
      vaultBadge.classList.add('vault-badge--open');
      vaultBadge.querySelector('span').textContent = 'VAULT: OPEN';
      renderHub();
      const digit = getState().codeDigits[3];
      completeLevel(3, digit);
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

    renderHub();
  },
};
