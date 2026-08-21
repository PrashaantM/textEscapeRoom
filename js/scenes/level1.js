// Scene: Sector 0, "BOOT-UP". A point-and-click room: walk to the terminal
// computer to read files (find a hidden access code), walk to the storage
// box to open it and take the keycard inside, then walk to the door, enter
// the code on its keypad, and scan the keycard from your inventory to open
// it. Solving it awards the first memory shard (codeDigits[0] in state.js)
// via completeLevel(0, digit), then shows shared.js's interstitial and
// routes to level2.
//
// The room visual (left half) and a passive log/inventory/help terminal
// (right half) are a full-bleed split layout (`.split-scene`, shared with
// Sectors 1-3). All room interaction happens by walking to an object
// (roomKit.js's walkTo(), a real 2-frame walk cycle) and picking an option
// from the small speech bubble that pops up next to the player — the
// right-side terminal panel only ever offers INVENTORY and HELP, per
// design; everything else lives in the room. The optional text input
// beneath the terminal log is a secondary, power-user path into the same
// command parser and is the *only* thing on this screen that can ever
// focus a text field (fixing the old bug where clicking anywhere in the
// room popped a mobile keyboard).

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake } from '../fx.js';
import { el, delay } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';
import {
  drawDoor, drawTerminal, drawKeycard, drawBox, drawCabinet, drawLocker, drawSciDesk,
  drawLabFlask, drawWallLight, drawClosetDoor, drawPlantProp, drawCrateStack, drawMonitorBank,
  drawVentProp, drawShelf, drawClueTag,
} from '../sprites.js';
import { createRoom, buildInventoryOverlay } from './roomKit.js';

const ROOM_DESC = "You're wedged into a server closet that smells of hot dust. A dead terminal hums in a nook behind a closet door to your right. To your left: a steel door with a 3-digit keypad. A battered storage box sits between them. Somewhere in these files, something is hidden.";

const HELP_ROWS = [
  ['Walk to the box', 'open it and take what is inside'],
  ['Walk to the terminal', 'read files, list hidden ones, find the access code'],
  ['Walk to the door', 'enter the 3-digit code, then scan your keycard'],
  ['Inventory', 'see and use what you are carrying'],
  ['Hint', 'nudge yourself in the right direction, from the terminal bubble'],
];

// A fixed layout of background-only set dressing (cabinets, lockers,
// desks, lab clutter, lights, the closet doorway, ...) scattered across the
// room now that its visual half covers the full screen. Purely decorative;
// never clickable. Percentage coordinates within the room box.
function buildDecor() {
  return [
    { x: 8, y: 20, node: drawCabinet('#39ff14', 7, undefined, 2) },
    { x: 25, y: 14, node: drawCabinet('#39ff14', 7, undefined, 3) },
    { x: 40, y: 11, node: drawLocker('#39ff14', 7) },
    { x: 46, y: 11, node: drawLocker('#39ff14', 7, true) },
    { x: 60, y: 20, node: drawSciDesk('#39ff14', 7) },
    { x: 15, y: 34, node: drawSciDesk('#39ff14', 6) },
    { x: 62, y: 30, node: drawLabFlask('#39ff14', 7) },
    { x: 30, y: 30, node: drawLabFlask('#39ff14', 6) },
    { x: 20, y: 5, node: drawWallLight('#ffd166', 7) },
    { x: 50, y: 5, node: drawWallLight('#ffd166', 7) },
    { x: 80, y: 5, node: drawWallLight('#ffd166', 7) },
    { x: 65, y: 5, node: drawWallLight('#ffd166', 6) },
    { x: 5, y: 88, node: drawPlantProp(7) },
    { x: 95, y: 88, node: drawPlantProp(7) },
    { x: 55, y: 66, node: drawPlantProp(6) },
    { x: 15, y: 92, node: drawCrateStack('#8a6a3a', 7) },
    { x: 70, y: 90, node: drawCrateStack('#8a6a3a', 6) },
    { x: 48, y: 92, node: drawCrateStack('#8a6a3a', 6) },
    { x: 35, y: 8, node: drawMonitorBank('#39ff14', 7) },
    { x: 70, y: 12, node: drawMonitorBank('#39ff14', 6) },
    { x: 55, y: 95, node: drawVentProp(6) },
    { x: 10, y: 48, node: drawVentProp(6) },
    { x: 92, y: 62, node: drawCabinet('#39ff14', 6, undefined, 2) },
    { x: 85, y: 78, node: drawLocker('#39ff14', 6) },
    { x: 18, y: 62, node: drawShelf('#39ff14', 7) },
    { x: 45, y: 38, node: drawClueTag('#39ff14', 6) },
    { x: 78, y: 30, node: drawClosetDoor(true, 8) },
  ];
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the room, the passive terminal
  // panel, and the room's own command handling, then kicks off the intro
  // text.
  mount(container, ctx) {
    const flags = {
      lookedAround: false, sawReadme: false, sawHiddenList: false, sawAccessCode: false,
      boxOpen: false, hasKeycard: false, codeEntered: false, doorUnlocked: false,
    };
    const inventory = [];
    const history = [];
    let historyIdx = -1;
    let inventoryOverlay = null;

    const room = createRoom({ accent: '#39ff14', ariaLabel: 'Sector 0 room' });
    room.setDecor(buildDecor());

    const frame = terminalFrame({ title: 'SECTOR 0 // BOOT-UP :: root@echo:~$', accent: '#39ff14' });
    const log = el('div', { class: 'term-log', id: 'l1-log', role: 'log', 'aria-live': 'polite' });

    const metaRow = el('div', { class: 'quick-commands' }, [
      el('button', { class: 'cmd-chip', onclick: () => openInventory() }, 'INVENTORY'),
      el('button', { class: 'cmd-chip', onclick: () => printHelp() }, 'HELP'),
    ]);

    const inputRow = el('div', { class: 'term-input-row' }, [
      el('span', { class: 'term-prompt' }, '>'),
      el('input', {
        class: 'term-input',
        type: 'text',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-label': 'Terminal command input (optional — everything here is also reachable from the room)',
      }),
    ]);
    const body = frame.querySelector('.term-body');
    body.appendChild(log);
    body.appendChild(metaRow);
    body.appendChild(inputRow);
    container.appendChild(el('div', { class: 'level1-scene split-scene' }, [room.el, frame]));

    const input = inputRow.querySelector('input');

    // Appends one typed-out line to the terminal log. Used by nearly every
    // handler below to print output.
    function printRaw(text, cls = '') {
      const p = el('p', { class: `term-line ${cls}`.trim() });
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return typeInto(p, text, { speed: 6 });
    }

    async function printLines(lines, cls = '') {
      for (const line of lines) await printRaw(line, cls);
    }

    function printNode(node) {
      log.appendChild(node);
      log.scrollTop = log.scrollHeight;
    }

    function printHelp() {
      printRaw('WHAT YOU CAN DO:');
      const table = el('div', { class: 'help-table' },
        HELP_ROWS.map(([label, desc]) => el('div', { class: 'help-row' }, [
          el('span', { class: 'cmd-chip' }, label),
          el('span', { class: 'help-desc' }, desc),
        ]))
      );
      printNode(table);
    }

    // ---- inventory: a visual, clickable overlay (roomKit.js) rather than
    // a text listing. Each item's onUse ties back into this scene's own
    // state (right now, only the keycard does anything when used).
    function openInventory() {
      sfx.select();
      const items = inventory.map((item) => ({
        id: item.id,
        label: item.label,
        node: item.node(),
        onUse: item.onUse,
      }));
      inventoryOverlay = buildInventoryOverlay(items, { onClose: closeInventory });
      room.el.appendChild(inventoryOverlay);
    }
    function closeInventory() {
      inventoryOverlay?.remove();
      inventoryOverlay = null;
    }

    function useKeycard() {
      if (room.getActive() === 'door' && flags.codeEntered && !flags.doorUnlocked) {
        closeInventory();
        onDoorSolved();
      } else {
        printRaw("You scan the keycard, but there's nothing here to scan it against yet.");
      }
    }

    // ---- hint ----
    function hintInfo() {
      if (!flags.lookedAround) return 'Walk up to the terminal and look around.';
      if (!flags.sawReadme) return 'The terminal has a readme file worth reading.';
      if (!flags.sawHiddenList) return 'Not everything shows up in a normal file listing. List hidden files.';
      if (!flags.sawAccessCode) return "You've found a hidden file. Read it.";
      if (!flags.boxOpen) return 'That storage box looks worth opening.';
      if (!flags.hasKeycard) return "There's something inside the open box. Take it.";
      if (!flags.codeEntered) return 'Walk to the door and enter the access code you found.';
      return 'The door wants a keycard now. Open your inventory and scan it.';
    }
    function printHint() {
      printNode(el('p', { class: 'term-line term-hint' }, `HINT: ${hintInfo()}`));
    }

    // ---- room hotspot builders, redrawn whenever their underlying flag
    // changes so the room visual always matches current progress ----

    function renderBox() {
      room.setHotspot('box', {
        x: 32, y: 70,
        build: () => [drawBox(flags.boxOpen, 8), el('span', {}, flags.boxOpen ? 'BOX: OPEN' : 'BOX: SHUT')],
        label: flags.boxOpen ? 'Open storage box' : 'Shut storage box',
        onClick: onBoxClick,
      });
      if (flags.boxOpen && !flags.hasKeycard) {
        room.setHotspot('box-keycard', {
          x: 34, y: 66,
          build: () => [drawKeycard('#39ff14', 6), el('span', {}, 'KEYCARD')],
          label: 'Keycard inside the box',
          onClick: onKeycardClick,
        });
      } else {
        room.removeHotspot('box-keycard');
      }
    }

    function renderDoor() {
      room.setHotspot('door', {
        x: 10, y: 55,
        build: () => [drawDoor(!flags.doorUnlocked, 8), el('span', {}, flags.doorUnlocked ? 'DOOR: OPEN' : 'DOOR: LOCKED')],
        label: flags.doorUnlocked ? 'Door, already open' : 'Steel door with a keypad',
        onClick: onDoorClick,
      });
    }

    function renderTerminalObject() {
      room.setHotspot('terminal', {
        x: 78, y: 45,
        build: () => [drawTerminal(8), el('span', {}, 'TERMINAL')],
        label: 'Dusty terminal in the closet nook',
        onClick: onTerminalObjectClick,
      });
    }

    // ---- click handlers: walk to the object (unless already there), then
    // pop the bubble of options relevant to current progress ----

    async function onBoxClick() {
      await room.walkTo('box');
      if (room.getActive() !== 'box') return;
      if (!flags.boxOpen) {
        room.showBubble([{ label: 'OPEN BOX', onClick: () => { room.hideBubble(); openBox(); } }]);
      } else {
        room.showBubble([{ label: 'CLOSE BOX', onClick: () => { room.hideBubble(); closeBox(); } }]);
      }
    }

    async function onKeycardClick() {
      room.showBubble([{ label: 'TAKE KEY CARD', onClick: () => { room.hideBubble(); takeKeycard(); } }]);
    }

    async function onTerminalObjectClick() {
      await room.walkTo('terminal');
      if (room.getActive() !== 'terminal') return;
      sfx.terminalOpen();
      const opts = [{ label: 'LOOK', onClick: () => { room.hideBubble(); doLook(); } }];
      opts.push({ label: 'READ README.TXT', onClick: () => { room.hideBubble(); readFile('readme.txt'); } });
      opts.push({ label: 'READ SECTOR.LOG', onClick: () => { room.hideBubble(); readFile('sector.log'); } });
      if (!flags.sawHiddenList) {
        opts.push({ label: 'LIST HIDDEN FILES', onClick: () => { room.hideBubble(); listHidden(); } });
      } else {
        opts.push({ label: 'READ .ACCESS_CODE', onClick: () => { room.hideBubble(); readFile('.access_code'); } });
      }
      opts.push({ label: 'HINT', onClick: () => { room.hideBubble(); printHint(); } });
      room.showBubble(opts);
    }

    async function onDoorClick() {
      if (flags.doorUnlocked) return;
      await room.walkTo('door');
      if (room.getActive() !== 'door') return;
      if (!flags.codeEntered) {
        room.showBubble([{ label: 'ENTER CODE', onClick: () => { room.hideBubble(); openDoorPad(); } }]);
      } else {
        room.showBubble([{ label: 'OPEN INVENTORY', onClick: () => { room.hideBubble(); openInventory(); } }]);
      }
    }

    // ---- verb handlers ----

    function doLook() {
      flags.lookedAround = true;
      printRaw(ROOM_DESC);
    }

    async function readFile(file) {
      if (file === 'readme.txt') {
        flags.sawReadme = true;
        return printLines(['SECTOR 0 STATUS: ONLINE.', "If you're reading this, ECHO let you in.", "Nothing here is ever truly deleted. Even what's hidden.", '(hint: not everything shows up in a normal listing)']);
      }
      if (file === 'sector.log') {
        return printLines(['LOG 004: Something moves in the walls after hours.', "Maintenance says it's just the pipes.", "I don't believe maintenance anymore.", '   signed, J. Alvarez, night technician (filed no further reports)']);
      }
      if (file === '.access_code') {
        flags.sawAccessCode = true;
        return printLines(['OVERRIDE FRAGMENT RECOVERED...', 'KEYPAD CODE: 7-3-9']);
      }
    }

    async function listHidden() {
      flags.sawHiddenList = true;
      await printRaw('HIDDEN FILE FOUND: .access_code');
    }

    async function openBox() {
      flags.boxOpen = true;
      sfx.drawer();
      renderBox();
      await printRaw('The box lid creaks open. Something inside catches the light.');
    }

    function closeBox() {
      flags.boxOpen = false;
      renderBox();
    }

    async function takeKeycard() {
      if (flags.hasKeycard) return;
      flags.hasKeycard = true;
      inventory.push({
        id: 'keycard',
        label: 'Keycard',
        node: () => drawKeycard('#39ff14', 7),
        onUse: useKeycard,
      });
      sfx.select();
      renderBox();
      await printRaw('KEYCARD added to inventory.', 'term-success');
    }

    function buildDoorPad() {
      const digits = [];
      const slotEls = [];
      const slotRow = el('div', { class: 'door-pad-slots' });
      for (let i = 0; i < 3; i++) {
        const s = el('span', { class: 'door-pad-slot' }, '_');
        slotEls.push(s);
        slotRow.appendChild(s);
      }
      function renderSlots() {
        slotEls.forEach((s, i) => { s.textContent = digits[i] !== undefined ? String(digits[i]) : '_'; });
      }
      function enterDigit(n) {
        if (digits.length >= 3) return;
        digits.push(n);
        sfx.key();
        renderSlots();
      }
      function backspace() { digits.pop(); renderSlots(); }
      const numRow = el('div', { class: 'door-pad-numpad' });
      for (let n = 0; n <= 9; n++) {
        numRow.appendChild(el('button', { class: 'numpad-btn', 'aria-label': `Digit ${n}`, onclick: () => enterDigit(n) }, String(n)));
      }
      const actions = el('div', { class: 'door-pad-actions' }, [
        el('button', { class: 'cta-btn secondary', onclick: () => backspace() }, '⌫'),
        el('button', {
          class: 'cta-btn',
          onclick: async () => {
            if (digits.length !== 3) return;
            await tryUnlock(digits.join(''));
            digits.length = 0; renderSlots();
          },
        }, 'TRY CODE'),
      ]);
      return el('div', { class: 'door-pad' }, [el('p', { class: 'door-pad-label' }, 'KEYPAD'), slotRow, numRow, actions]);
    }

    function openDoorPad() {
      const overlay = el('div', { class: 'inventory-overlay' }, [
        el('div', { class: 'inventory-panel' }, [
          el('div', { class: 'inventory-header' }, [
            el('span', {}, 'KEYPAD'),
            el('button', { class: 'inventory-close', 'aria-label': 'Close keypad', onclick: () => overlay.remove() }, '✕'),
          ]),
          buildDoorPad(),
          flags.codeEntered ? el('p', { class: 'term-hint' }, 'Code accepted. Open your inventory and scan the keycard.') : null,
        ]),
      ]);
      room.el.appendChild(overlay);
      // tryUnlock() closes this overlay itself once a correct code lands.
      openDoorPad.currentOverlay = overlay;
    }

    async function tryUnlock(digits) {
      if (digits !== '739') {
        sfx.error();
        shake(frame);
        await printRaw('ACCESS DENIED. The keypad buzzes and resets.', 'term-error');
        return;
      }
      flags.codeEntered = true;
      openDoorPad.currentOverlay?.remove();
      if (!flags.hasKeycard) {
        await printLines(['The keypad flashes amber. CODE ACCEPTED.', 'A prompt blinks: SCAN KEYCARD TO PROCEED. You still need one.'], 'term-success');
      } else {
        await printLines(['The keypad flashes amber. CODE ACCEPTED.', 'A prompt blinks: SCAN KEYCARD TO PROCEED. Open your inventory and use it.'], 'term-success');
      }
    }

    async function onDoorSolved() {
      flags.doorUnlocked = true;
      renderDoor();
      sfx.unlock();
      await printLines(['The keycard scans clean. Bolts retract with a heavy CLUNK.', 'The steel door slides open onto darkness, and a set of stairs down.'], 'term-success');
      const digit = getState().codeDigits[0];
      completeLevel(0, digit);
      await delay(500);
      showInterstitial(container.querySelector('.level1-scene'), {
        levelIndex: 0,
        storyBeat: 'ECHO: "Good. That part of me remembers you now. Head down: Sector 1 is louder than this one."',
        shardDigit: digit,
        ctaLabel: 'DESCEND ▶',
        onContinue: () => ctx.goTo('level2'),
      });
    }

    // ---- optional typed-command fallback: the ONLY thing on this screen
    // that can ever focus a text input, and only when this row itself is
    // clicked (not the room, not the container) — the fix for the old bug
    // where any click anywhere popped a mobile keyboard. ----
    async function run(raw) {
      const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!cmd) return;
      const [verb, ...restParts] = cmd.split(' ');
      const args = restParts.join(' ');
      if (['help', 'h', '?'].includes(verb)) return printHelp();
      if (['inventory', 'inv', 'i'].includes(verb)) return openInventory();
      if (['look', 'l'].includes(verb)) return doLook();
      if (verb === 'ls' && /(-a|a)$/.test(args)) return listHidden();
      if (verb === 'cat') return readFile(args.replace(/^\.\//, '').trim());
      if (verb === 'open' && args.includes('box')) return flags.boxOpen ? null : openBox();
      if (['take', 'get', 'grab'].includes(verb) && args.includes('keycard')) return flags.hasKeycard ? null : takeKeycard();
      if ((verb === 'unlock' || verb === 'enter') && /\d/.test(args)) return tryUnlock(args.replace(/\D/g, ''));
      if (verb === 'hint') return printHint();
      return printRaw(`SECTOR 0: command not recognized. Type 'help'.`, 'term-error');
    }

    function submitCommand(val) {
      if (!val.trim()) return;
      printRaw(`> ${val}`, 'term-echo');
      history.push(val);
      historyIdx = history.length;
      run(val);
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        input.value = '';
        submitCommand(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx > 0) { historyIdx--; input.value = history[historyIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx < history.length - 1) { historyIdx++; input.value = history[historyIdx]; }
        else { historyIdx = history.length; input.value = ''; }
      }
    }, { signal: ctx.signal });

    // Scoped to this row only — clicking the room, the terminal log, or
    // anything else on this screen never focuses (or shows a keyboard for)
    // this input.
    inputRow.addEventListener('click', () => input.focus({ preventScroll: true }), { signal: ctx.signal });

    renderBox();
    renderDoor();
    renderTerminalObject();
    printLines(['TERMINAL READY.', 'Walk to the box, the terminal, or the door to act on them.']);
  },
};
