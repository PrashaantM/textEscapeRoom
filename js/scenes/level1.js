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
import { el, delay, randInt, sample } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';
import {
  drawDoor, drawTerminal, drawKeycard, drawBox, drawCabinet, drawLocker, drawSciDesk,
  drawLabFlask, drawWallLight, drawClosetDoor, drawPlantProp, drawCrateStack, drawMonitorBank,
  drawVentProp, drawShelf, drawClueTag, drawFloppy, drawPaperPile, drawLightbulb, drawMagnifier,
  drawBackpack, drawGhost,
} from '../sprites.js';
import { createRoom, buildInventoryOverlay } from './roomKit.js';

const ROOM_DESC = "You're wedged into a server closet that smells of hot dust. A dead terminal hums in a nook behind a closet door to your right. To your left: a steel door with a 3-digit keypad. A battered storage box sits between them. Somewhere in these files, something is hidden.";

const HELP_ROWS = [
  ['Walk to the box', 'open it and take what is inside'],
  ['Walk to the terminal', 'read files, list hidden ones, find the access code'],
  ['Walk to the door', 'enter the 3-digit code, then scan your keycard'],
  ['Click anything else', 'or open floor - walk over and take a look, some things are worth picking up'],
  ['Inventory', 'see and use what you are carrying'],
  ['Hint', 'nudge yourself in the right direction, from the terminal bubble'],
];

// Set dressing that used to be purely decorative (cabinets, lockers, desks,
// lab clutter, lights, ...) is now a table of walkable, clickable hotspots:
// every one of them gets a short LOOK description, and one (the evidence
// tag) is also a pickup, even though nothing here is required to clear the
// sector. Percentage coordinates within the room box, split to match the
// room's own wall/floor backdrop (see roomKit.js's ROOM_HORIZON/ROOM_CORNER
// and .room-scene--free in style.css): wall-mounted fixtures (lights,
// monitor banks, the pinned tag) sit above y=58, on either the left wall
// (x<16) or the back wall (x>16); every freestanding piece of furniture
// (cabinets, lockers, desks, crates, plants) sits below y=66, on the floor,
// where it visually belongs instead of floating in the wall band. Only the
// closet doorway around the terminal stays pure decor (buildDecorOnly()
// below) — it's just the terminal nook's framing, not its own object.
function buildProps() {
  return [
    // ---- wall-mounted (left wall x<16, back wall x>16, y<58) ----
    { id: 'prop-light-1', x: 8, y: 8, node: () => drawWallLight('#ffd166', 6), label: 'Wall light', desc: 'A wall light. Steady, at least - small mercies.' },
    { id: 'prop-light-2', x: 30, y: 6, node: () => drawWallLight('#ffd166', 7), label: 'Wall light', desc: 'This one buzzes when you get close. Probably fine.' },
    { id: 'prop-light-3', x: 78, y: 6, node: () => drawWallLight('#ffd166', 7), label: 'Wall light', desc: 'Flickers if you stare at it too long. You look away.' },
    { id: 'prop-light-4', x: 55, y: 6, node: () => drawWallLight('#ffd166', 6), label: 'Wall light', desc: 'A wall light. Steady, at least - small mercies.' },
    { id: 'prop-monitor-1', x: 36, y: 12, node: () => drawMonitorBank('#39ff14', 7), label: 'Monitor bank', desc: 'A bank of dead monitors. One still shows a login screen, frozen mid-blink.' },
    { id: 'prop-monitor-2', x: 68, y: 16, node: () => drawMonitorBank('#39ff14', 6), label: 'Monitor bank', desc: 'More dead screens. Your reflection is the only thing on them.' },
    { id: 'prop-vent-2', x: 60, y: 50, node: () => drawVentProp(6), label: 'Vent grate', desc: 'Warm air leaks out. Somewhere, something is still running.' },
    {
      id: 'prop-tag', x: 44, y: 30, node: () => drawClueTag('#39ff14', 6), label: 'Evidence tag',
      desc: "A tag reading 'EVIDENCE - DO NOT REMOVE.' Someone removed it anyway.",
      pickup: {
        label: 'EVIDENCE TAG',
        node: () => drawClueTag('#39ff14', 7),
        lore: 'The tag reads: SECTOR 0, INCIDENT 004. Whatever happened here got filed and buried instead.',
      },
    },
    // ---- freestanding furniture and floor clutter (y>66) ----
    { id: 'prop-cabinet-1', x: 10, y: 74, node: () => drawCabinet('#39ff14', 7, undefined, 2), label: 'Supply cabinet', desc: 'A supply cabinet. Empty hangers rattle when you nudge it.' },
    { id: 'prop-cabinet-2', x: 27, y: 70, node: () => drawCabinet('#39ff14', 7, undefined, 3), label: 'Bolted cabinet', desc: "Bolted shut. Someone stenciled 'DO NOT' on it; the rest flaked off." },
    { id: 'prop-locker-1', x: 43, y: 72, node: () => drawLocker('#39ff14', 7), label: 'Dented locker', desc: 'A gym locker, dented like it lost a fight.' },
    { id: 'prop-locker-2', x: 50, y: 72, node: () => drawLocker('#39ff14', 7, true), label: 'Open locker', desc: 'Hanging inside: a jacket two sizes too small. Not yours.' },
    { id: 'prop-desk-1', x: 66, y: 76, node: () => drawSciDesk('#39ff14', 7), label: 'Lab desk', desc: 'A lab desk, dust rings where equipment used to sit.' },
    { id: 'prop-flask-1', x: 70, y: 70, node: () => drawLabFlask('#39ff14', 6), label: 'Cracked flask', desc: 'A cracked flask on the desk, long since dried out.' },
    { id: 'prop-desk-2', x: 20, y: 84, node: () => drawSciDesk('#39ff14', 6), label: 'Carved desk', desc: "Someone carved 'J.A. WAS HERE' into the wood." },
    { id: 'prop-flask-2', x: 24, y: 78, node: () => drawLabFlask('#39ff14', 6), label: 'Empty flask', desc: 'Whatever was brewing in this one evaporated years ago.' },
    { id: 'prop-cabinet-3', x: 91, y: 68, node: () => drawCabinet('#39ff14', 6, undefined, 2), label: 'Open cabinet', desc: "This one's unlocked, and empty. Somebody beat you to it." },
    { id: 'prop-locker-3', x: 84, y: 86, node: () => drawLocker('#39ff14', 6), label: 'Named locker', desc: "Locked. A faded nameplate reads 'J. ALVAREZ.'" },
    { id: 'prop-shelf', x: 14, y: 90, node: () => drawShelf('#39ff14', 7), label: 'Shelf of binders', desc: 'A shelf of ring binders, spines unlabeled. None of them budge.' },
    { id: 'prop-plant-1', x: 4, y: 92, node: () => drawPlantProp(7), label: 'Plastic plant', desc: 'A plastic plant, dust standing in for dew.' },
    { id: 'prop-plant-2', x: 96, y: 92, node: () => drawPlantProp(7), label: 'Plastic plant', desc: 'Somehow greener than everything else in this room.' },
    { id: 'prop-plant-3', x: 58, y: 90, node: () => drawPlantProp(6), label: 'Plastic plant', desc: 'Fake leaves, real dust. A lot of it.' },
    { id: 'prop-crate-1', x: 16, y: 96, node: () => drawCrateStack('#8a6a3a', 7), label: 'Crate stack', desc: "Stenciled 'FRAGILE' in a language you don't recognize." },
    { id: 'prop-crate-2', x: 74, y: 94, node: () => drawCrateStack('#8a6a3a', 6), label: 'Crate stack', desc: 'Nailed shut. Prying it open feels like a bad idea.' },
    { id: 'prop-crate-3', x: 50, y: 97, node: () => drawCrateStack('#8a6a3a', 6), label: 'Crate stack', desc: 'Empty, by the sound of it when you knock.' },
    { id: 'prop-vent-1', x: 36, y: 96, node: () => drawVentProp(6), label: 'Floor vent', desc: 'A vent grate. Something ticks behind it, then stops.' },
  ];
}

// The one non-interactive prop left: the closet doorway framing the
// terminal nook itself, not a separate object worth clicking on.
function buildDecorOnly() {
  return [{ x: 78, y: 30, node: drawClosetDoor(true, 8) }];
}

// Small filler items scattered inside the storage box alongside the
// keycard and the photograph — pure flavor, never collected for a reason,
// just something to find. openBoxPopup() samples 3-4 of these per box open.
const BOX_FILLER_POOL = [
  { label: 'OLD FLOPPY DISK', node: () => drawFloppy('#7f9c93', 6), flavor: 'Corrupted. Whatever was on it is gone now.' },
  { label: 'WATER-STAINED PAPERS', node: () => drawPaperPile(6), flavor: 'The ink has run. You can just make out a shift schedule.' },
  { label: 'BURNT-OUT BULB', node: () => drawLightbulb('#7f9c93', 6), flavor: 'Dead. Somebody swapped it and never threw it out.' },
  { label: 'CRACKED MAGNIFIER', node: () => drawMagnifier('#7f9c93', 6), flavor: 'Half the lens is missing. Still better than nothing.' },
  { label: 'EMPTY CANVAS BAG', node: () => drawBackpack('#7f9c93', 6), flavor: 'Somebody packed to leave in a hurry, then never did.' },
];

// The box's one other keeper besides the keycard: pure lore, never used
// for anything, added to inventory anyway.
const BOX_LORE_ITEM = {
  label: 'FADED PHOTOGRAPH',
  node: () => drawGhost('#c9b38a', 6),
  invNode: () => drawGhost('#c9b38a', 7),
  lore: 'A young technician grins at the camera in a lab coat two sizes too big. On the back, barely legible: "First day. Don\'t tell them I was scared." - J. Alvarez',
};

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Builds the room, the passive terminal
  // panel, and the room's own command handling, then kicks off the intro
  // text.
  mount(container, ctx) {
    const flags = {
      lookedAround: false, sawReadme: false, sawHiddenList: false, sawAccessCode: false,
      boxOpen: false, hasKeycard: false, hasPhoto: false, codeEntered: false, doorUnlocked: false,
    };
    const inventory = [];
    const history = [];
    let historyIdx = -1;
    let inventoryOverlay = null;

    const room = createRoom({ accent: '#39ff14', ariaLabel: 'Sector 0 room' });
    room.setDecor(buildDecorOnly());
    buildProps().forEach((def) => {
      room.setHotspot(def.id, {
        x: def.x, y: def.y,
        build: () => [def.node()],
        label: def.label,
        onClick: () => onPropClick(def),
      });
    });

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
    }

    function renderDoor() {
      room.setHotspot('door', {
        x: 10, y: 58,
        build: () => [drawDoor(!flags.doorUnlocked, 8), el('span', {}, flags.doorUnlocked ? 'DOOR: OPEN' : 'DOOR: LOCKED')],
        label: flags.doorUnlocked ? 'Door, already open' : 'Steel door with a keypad',
        onClick: onDoorClick,
      });
    }

    function renderTerminalObject() {
      room.setHotspot('terminal', {
        x: 78, y: 57,
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
      showBoxBubble();
    }

    // Rebuildable, called after the box's own open/close state changes (not
    // just from the initial walk-up click) so the bubble always offers the
    // option matching what just happened, instead of requiring a second
    // click on the box to catch up.
    function showBoxBubble() {
      if (room.getActive() !== 'box') return;
      if (!flags.boxOpen) {
        room.showBubble([{ label: 'OPEN BOX', onClick: () => { room.hideBubble(); openBox(); } }]);
      } else {
        room.showBubble([
          { label: 'LOOK INSIDE', onClick: () => { room.hideBubble(); openBoxPopup(); } },
          { label: 'CLOSE BOX', onClick: () => { room.hideBubble(); closeBox(); } },
        ]);
      }
    }

    // Rebuildable set of terminal options, redrawn in place (no re-walk
    // needed) whenever what's available changes — specifically, listing
    // hidden files adds READ .ACCESS_CODE beside LIST HIDDEN FILES instead
    // of replacing it.
    function buildTerminalOpts() {
      const opts = [
        { label: 'LOOK', onClick: () => { room.hideBubble(); doLook(); } },
        { label: 'READ README.TXT', onClick: () => { room.hideBubble(); readFile('readme.txt'); } },
        { label: 'READ SECTOR.LOG', onClick: () => { room.hideBubble(); readFile('sector.log'); } },
        { label: 'LIST HIDDEN FILES', onClick: async () => { await listHidden(); refreshTerminalBubble(); } },
      ];
      if (flags.sawHiddenList) {
        opts.push({ label: 'READ .ACCESS_CODE', onClick: () => { room.hideBubble(); readFile('.access_code'); } });
      }
      opts.push({ label: 'HINT', onClick: () => { room.hideBubble(); printHint(); } });
      return opts;
    }
    function refreshTerminalBubble() {
      if (room.getActive() === 'terminal') room.showBubble(buildTerminalOpts());
    }

    async function onTerminalObjectClick() {
      await room.walkTo('terminal');
      if (room.getActive() !== 'terminal') return;
      sfx.terminalOpen();
      room.showBubble(buildTerminalOpts());
    }

    // ---- background props: walk up, print a short LOOK description, and
    // for the one prop that's also a pickup, offer TAKE alongside LOOK.
    // None of this matters to solving the sector — it's here so the room
    // doesn't feel like a puzzle box with set dressing taped on. ----
    async function onPropClick(def) {
      await room.walkTo(def.id);
      if (room.getActive() !== def.id) return;
      if (def.pickup && !def.pickup.taken) {
        room.showBubble([
          { label: 'LOOK', onClick: () => { room.hideBubble(); printRaw(def.desc); } },
          { label: `TAKE ${def.pickup.label}`, onClick: () => { room.hideBubble(); takeProp(def); } },
        ]);
      } else {
        printRaw(def.desc);
      }
    }

    async function takeProp(def) {
      def.pickup.taken = true;
      inventory.push({
        id: def.id,
        label: def.pickup.label,
        node: def.pickup.node,
        onUse: () => printRaw(def.pickup.lore, 'term-hint'),
      });
      sfx.select();
      await printRaw(`${def.pickup.label} added to inventory.`, 'term-success');
      await printRaw(def.pickup.lore, 'term-hint');
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
      openBoxPopup();
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
      await printRaw('KEYCARD added to inventory.', 'term-success');
    }

    async function takePhoto() {
      if (flags.hasPhoto) return;
      flags.hasPhoto = true;
      inventory.push({
        id: 'photo',
        label: BOX_LORE_ITEM.label,
        node: BOX_LORE_ITEM.invNode,
        onUse: () => printRaw(BOX_LORE_ITEM.lore, 'term-hint'),
      });
      sfx.select();
      await printRaw(`${BOX_LORE_ITEM.label} added to inventory.`, 'term-success');
      await printRaw(BOX_LORE_ITEM.lore, 'term-hint');
    }

    // A pop-up over the room showing what's actually inside the box: the
    // keycard (functional), the photograph (pure lore, also collected),
    // and 3-4 random filler items that are just there to poke at — clicking
    // them prints a one-line flavor description in the terminal log, which
    // stays visible on the right the whole time this popup is open.
    function openBoxPopup() {
      const filler = sample(BOX_FILLER_POOL, Math.min(randInt(3, 4), BOX_FILLER_POOL.length));
      const items = [];
      if (!flags.hasKeycard) items.push({ kind: 'keycard' });
      if (!flags.hasPhoto) items.push({ kind: 'photo' });
      filler.forEach((f) => items.push({ kind: 'filler', ...f }));

      const grid = el('div', { class: 'inventory-grid' });
      function renderGrid() {
        grid.innerHTML = '';
        if (items.length === 0) {
          grid.appendChild(el('p', { class: 'inventory-empty' }, 'Just an empty box now.'));
          return;
        }
        items.forEach((item, i) => {
          let node; let label; let onclick;
          if (item.kind === 'keycard') {
            node = drawKeycard('#39ff14', 6);
            label = 'KEYCARD';
            onclick = async () => { await takeKeycard(); items.splice(i, 1); renderGrid(); };
          } else if (item.kind === 'photo') {
            node = BOX_LORE_ITEM.node();
            label = BOX_LORE_ITEM.label;
            onclick = async () => { await takePhoto(); items.splice(i, 1); renderGrid(); };
          } else {
            node = item.node();
            label = item.label;
            onclick = () => printRaw(item.flavor, 'term-hint');
          }
          grid.appendChild(el('button', { class: 'inventory-item', onclick }, [node, el('span', {}, label)]));
        });
      }
      renderGrid();

      const overlay = el('div', { class: 'inventory-overlay' }, [
        el('div', { class: 'inventory-panel' }, [
          el('div', { class: 'inventory-header' }, [
            el('span', {}, 'INSIDE THE BOX'),
            el('button', { class: 'inventory-close', 'aria-label': 'Close box', onclick: closePopup }, '✕'),
          ]),
          el('p', { class: 'term-hint' }, 'Dust and old junk. Something useful might be in here.'),
          grid,
        ]),
      ]);
      function closePopup() {
        overlay.remove();
        showBoxBubble();
      }
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
      room.el.appendChild(overlay);
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
