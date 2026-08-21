// Scene: Sector 0, "BOOT-UP". A text-adventure-style puzzle where the
// player types (or interacts with the room visual for) commands like `look`,
// `ls -a`, `cat .access_code`, `open drawer`, and `unlock door <code>` to
// find a hidden access code and a keycard, then unlock the door. Solving it
// awards the first memory shard (codeDigits[0] in state.js) via
// completeLevel(0, digit), then shows shared.js's interstitial and routes
// to level2.
//
// The room visual (left half) and terminal (right half) are a genuine
// split layout (`.split-scene`, shared with Sectors 2 and 3). Clicking the
// terminal/desk/door walks the player sprite there (a FLIP-animated
// reorder, see walkTo()) before that object's options appear — nothing is
// offered up front except the 3 clickable room objects. The terminal's own
// command parsing in run() is untouched; the room visual is purely an
// additional way to trigger the same commands.

import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, pulse } from '../fx.js';
import { el, delay } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';
import { drawDoor, drawDrawer, drawTerminal, drawKeycard, drawPlayer, drawShelf, drawClueTag, drawMagnifier, drawBackpack, drawLightbulb } from '../sprites.js';

const ROOM_DESC = "You're wedged into a server closet that smells of hot dust. A dead terminal hums awake. To your left: a steel door with a 3-digit keypad. Under the desk: a battered drawer. Taped to the monitor: a folder marked SECTOR LOGS.";

const CHIP_LABELS = { 'ls -a': 'SHOW HIDDEN FILES' };

const HELP_ROWS = [
  ['look', 'just look around the room'],
  ['ls -a', 'list files (reveals hidden ones too)'],
  ['cat <file>', 'read a file'],
  ['open drawer', 'open the desk drawer'],
  ['take keycard', 'pick something up'],
  ['inventory', 'check what you are carrying'],
  ['unlock door <code>', 'try the keypad'],
  ['hint', 'nudge yourself in the right direction'],
];

// Strips a leading './' and trims whitespace from a filename argument, so
// `cat ./readme.txt` and `cat readme.txt` behave the same. Called by run()
// when handling the `cat` command.
function normalizeFile(s) {
  return (s || '').replace(/^\.\//, '').trim();
}

// Animates `element` from `prevRect` (its bounding rect before some DOM
// change already happened) to its current position, via the FLIP technique
// (First-Last-Invert-Play): the element already sits at its new spot, so we
// just offset it back to where it was and transition that offset to zero.
// Used both for the player sprite "walking" between room objects and for
// the keycard "flying" from the drawer into the player's hands. Resolves
// once the transition ends (or after `duration` as a fallback).
function flip(element, prevRect, duration = 420) {
  const next = element.getBoundingClientRect();
  const dx = prevRect.left - next.left;
  const dy = prevRect.top - next.top;
  if (!dx && !dy) return Promise.resolve();
  element.style.transition = 'none';
  element.style.transform = `translate(${dx}px, ${dy}px)`;
  // eslint-disable-next-line no-unused-expressions
  element.offsetWidth; // force reflow so the transform above applies before we animate away from it
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      element.style.transition = `transform ${duration}ms ease`;
      element.style.transform = 'translate(0, 0)';
      const done = () => { element.style.transition = ''; element.style.transform = ''; resolve(); };
      element.addEventListener('transitionend', done, { once: true });
      setTimeout(done, duration + 80);
    });
  });
}

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Sets up the room diorama, the terminal
  // log/input, the room's own command parser (run()), and kicks off the
  // intro text.
  mount(container, ctx) {
    const flags = { lookedAround: false, sawReadme: false, sawHiddenList: false, sawAccessCode: false, openedDrawer: false, hasKeycard: false, doorUnlocked: false };
    const inventory = [];
    const history = [];
    let historyIdx = -1;

    // ---- pixel-art room scene: click the terminal, desk, or door to act on them ----
    const roomScene = el('div', { class: 'room-scene', role: 'group', 'aria-label': 'Room objects' });
    let lastKeycardShown = false;
    let justActed = false;
    let doorPadOpen = false;
    let activeTarget = null; // 'terminal' | 'desk' | 'door' | null
    let terminalPopupOpen = false;
    let walking = false;
    let walkTimer = null;

    const contextBar = el('div', { class: 'quick-commands context-bar', role: 'group', 'aria-label': 'Object options' });

    // Plays a brief floating icon (magnifier/backpack/lightbulb) near the
    // player sprite for non-physical actions (look/inventory/hint), so the
    // room visual reacts to those too, not just clicks on objects. Called
    // by run() whenever those verbs are handled.
    function playActionIcon(kind) {
      const playerEl = roomScene.querySelector('.player-sprite');
      if (!playerEl) return;
      const draw = kind === 'look' ? drawMagnifier : kind === 'inventory' ? drawBackpack : drawLightbulb;
      const icon = draw('#ffd166', 5, 'sprite action-icon');
      playerEl.appendChild(icon);
      requestAnimationFrame(() => icon.classList.add('action-icon--show'));
      setTimeout(() => icon.remove(), 900);
    }

    // Moves the player sprite to stand next to `target` ('terminal' | 'desk'
    // | 'door') via renderRoomScene()'s existing DOM-order positioning,
    // FLIP-animated into a real walk with footstep sound. Resolves once the
    // walk finishes. Called by the object click handlers before revealing
    // that object's context-bar options.
    async function walkTo(target) {
      if (walking) return;
      const playerEl = roomScene.querySelector('.player-sprite');
      const prevRect = playerEl ? playerEl.getBoundingClientRect() : null;
      activeTarget = target;
      contextBar.innerHTML = '';
      terminalPopupOpen = false;
      walking = true;
      renderRoomScene();
      const newPlayerEl = roomScene.querySelector('.player-sprite');
      if (prevRect && newPlayerEl) {
        sfx.walk();
        walkTimer = setInterval(() => sfx.walk(), 140);
        await flip(newPlayerEl, prevRect);
        clearInterval(walkTimer);
      }
      walking = false;
    }

    // Click handler for the terminal sprite: walks the player there (unless
    // already there), runs 'look' the first time (unchanged terminal
    // output), then opens the small terminal popup (readme.txt /
    // sector.log / .access_code) plus the context-bar chips for anything
    // else the terminal offers.
    async function onTerminalClick() {
      if (activeTarget === 'terminal') {
        if (walking) return;
        terminalPopupOpen = !terminalPopupOpen;
        renderRoomScene();
        return;
      }
      await walkTo('terminal');
      if (activeTarget !== 'terminal') return; // superseded by another click mid-walk
      sfx.terminalOpen();
      if (!flags.lookedAround) submitCommand('look');
      terminalPopupOpen = true;
      renderRoomScene();
      renderContextBar();
    }

    // Click handler for the desk sprite: walks the player there (unless
    // already there), then shows the drawer/keycard option relevant to
    // current progress.
    async function onDeskClick() {
      if (activeTarget !== 'desk') {
        await walkTo('desk');
        if (activeTarget !== 'desk') return; // superseded by another click mid-walk
      } else if (walking) {
        return;
      }
      renderContextBar();
    }

    // Click handler for the door sprite: walks the player there (unless
    // already there), then either attempts the unlock command (no keycard
    // yet) or toggles the on-screen numeric keypad, exactly as before.
    async function onDoorClick() {
      if (flags.doorUnlocked) return;
      if (activeTarget !== 'door') {
        await walkTo('door');
        if (activeTarget !== 'door') return; // superseded by another click mid-walk
      } else if (walking) {
        return;
      }
      if (!flags.hasKeycard) { submitCommand('unlock door'); return; }
      doorPadOpen = !doorPadOpen;
      renderRoomScene();
    }

    // Builds the tap-to-enter numeric keypad UI (digit slots, number pad,
    // backspace/try buttons) shown when the player has a keycard and opens
    // the door pad. Called by renderRoomScene() while doorPadOpen is true.
    function buildDoorPad() {
      const digits = [];
      const slotEls = [];
      const slotRow = el('div', { class: 'door-pad-slots' });
      for (let i = 0; i < 3; i++) {
        const s = el('span', { class: 'door-pad-slot' }, '_');
        slotEls.push(s);
        slotRow.appendChild(s);
      }
      // Redraws the 3 digit slots to reflect the current `digits` array.
      function renderSlots() {
        slotEls.forEach((s, i) => { s.textContent = digits[i] !== undefined ? String(digits[i]) : '_'; });
      }
      // Appends a tapped digit to the keypad entry, up to 3 digits.
      function enterDigit(n) {
        if (digits.length >= 3) return;
        digits.push(n);
        sfx.key();
        renderSlots();
      }
      // Removes the last entered digit.
      function backspace() {
        digits.pop();
        renderSlots();
      }
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
            if (!flags.doorUnlocked) { digits.length = 0; renderSlots(); }
          },
        }, 'TRY CODE'),
      ]);
      return el('div', { class: 'door-pad' }, [
        el('p', { class: 'door-pad-label' }, 'KEYPAD'),
        slotRow,
        numRow,
        actions,
      ]);
    }

    // Builds the small popup terminal screen shown over the room visual
    // once the player has walked up to the terminal: the same 3 file
    // buttons the real terminal exposes via `cat`, routed through the exact
    // same submitCommand() path so behavior is identical either way.
    function buildTerminalPopup() {
      return el('div', { class: 'terminal-popup' }, [
        el('p', { class: 'terminal-popup-title' }, 'root@echo:~$'),
        el('div', { class: 'terminal-popup-files' }, [
          el('button', { class: 'cmd-chip', onclick: () => submitCommand('cat readme.txt') }, 'readme.txt'),
          el('button', { class: 'cmd-chip', onclick: () => submitCommand('cat sector.log') }, 'sector.log'),
          el('button', { class: 'cmd-chip', onclick: () => submitCommand('cat .access_code') }, '.access_code'),
        ]),
      ]);
    }

    // Redraws the room diorama (door, desk, terminal, player, decor, and the
    // keycard once acquired) based on current `flags`, and positions the
    // player sprite next to whatever object is currently active (or, if
    // none has been clicked yet, a neutral starting spot). Called after
    // every flag-changing command and by the click handlers.
    function renderRoomScene() {
      roomScene.innerHTML = '';

      // Static set-dressing: a wall shelf and a taped-up log folder, purely
      // decorative, giving Sector 0 more room detail to match Sectors 1-3.
      const shelfDecor = el('div', { class: 'room-decor', 'aria-hidden': 'true' }, [drawShelf('#39ff14', 6)]);
      const folderDecor = el('div', { class: 'room-decor', 'aria-hidden': 'true' }, [drawClueTag('#39ff14', 5)]);
      roomScene.append(shelfDecor);

      const doorItem = el('button', {
        class: 'room-item room-item-btn' + (activeTarget === 'door' ? ' room-item--active' : ''),
        'aria-label': flags.doorUnlocked ? 'Door, already open' : 'Steel door with a keypad',
        onclick: onDoorClick,
      }, [drawDoor(!flags.doorUnlocked, 8), el('span', {}, flags.doorUnlocked ? 'DOOR: OPEN' : 'DOOR: LOCKED')]);
      const deskItem = el('button', {
        class: 'room-item room-item-btn' + (activeTarget === 'desk' ? ' room-item--active' : ''),
        'aria-label': flags.openedDrawer ? 'Desk drawer, already open' : 'Desk with a battered drawer',
        onclick: onDeskClick,
      }, [drawDrawer(flags.openedDrawer, 8), el('span', {}, flags.openedDrawer ? 'DESK: OPEN' : 'DESK: SHUT')]);
      const termItem = el('button', {
        class: 'room-item room-item-btn' + (activeTarget === 'terminal' ? ' room-item--active' : ''),
        'aria-label': 'Terminal',
        onclick: onTerminalClick,
      }, [drawTerminal(8), folderDecor, el('span', {}, 'TERMINAL')]);

      // player stands next to whatever was last clicked, or a neutral
      // "just walked in" spot (between the desk and the door) before
      // anything has been clicked yet, so the very first click still walks.
      const target = activeTarget === 'desk' ? deskItem : activeTarget === 'terminal' ? termItem : activeTarget === 'door' ? doorItem : null;
      const playerItem = el('div', { class: 'player-sprite' }, [drawPlayer('#39ff14', 6), el('span', {}, 'YOU')]);
      const items = [termItem, deskItem, doorItem];
      items.splice(target ? items.indexOf(target) : 2, 0, playerItem);
      roomScene.append(...items);

      if (flags.hasKeycard) {
        const cardItem = el('div', { class: 'room-item room-item--acquired' }, [drawKeycard('#39ff14', 8), el('span', {}, 'KEYCARD')]);
        roomScene.appendChild(cardItem);
        if (!lastKeycardShown) pulse(cardItem, 'fx-pulse', 700);
      }
      lastKeycardShown = flags.hasKeycard;
      if (flags.doorUnlocked) { pulse(doorItem, 'fx-pulse', 700); doorPadOpen = false; }
      if (justActed) { pulse(playerItem, 'fx-pulse', 700); justActed = false; }
      if (doorPadOpen && flags.hasKeycard && !flags.doorUnlocked) roomScene.appendChild(buildDoorPad());
      if (terminalPopupOpen && activeTarget === 'terminal') roomScene.appendChild(buildTerminalPopup());
    }

    const frame = terminalFrame({ title: 'SECTOR 0 // BOOT-UP :: root@echo:~$', accent: '#39ff14' });
    const log = el('div', { class: 'term-log', id: 'l1-log', role: 'log', 'aria-live': 'polite' });

    const inputRow = el('div', { class: 'term-input-row' }, [
      el('span', { class: 'term-prompt' }, '>'),
      el('input', {
        class: 'term-input',
        type: 'text',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-label': 'Terminal command input',
      }),
    ]);
    const body = frame.querySelector('.term-body');
    body.appendChild(log);
    body.appendChild(contextBar);
    body.appendChild(inputRow);
    container.appendChild(el('div', { class: 'level1-scene split-scene' }, [roomScene, frame]));

    const input = inputRow.querySelector('input');

    // Appends one typed-out line to the terminal log. Used by nearly every
    // command handler in run() to print output.
    function printRaw(text, cls = '') {
      const p = el('p', { class: `term-line ${cls}`.trim() });
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return typeInto(p, text, { speed: 6 });
    }

    // Prints several lines in sequence via printRaw(). Used for multi-line
    // command output like file contents or the boot intro.
    async function printLines(lines, cls = '') {
      for (const line of lines) await printRaw(line, cls);
    }

    // Builds a clickable chip that runs `cmd` through submitCommand() when
    // tapped, showing `label` (or a friendly label for `cmd`, or the raw
    // command) as its text. Used by the context bar, help table, hint text,
    // and file listings.
    function cmdChip(cmd, label) {
      return el('button', {
        class: 'cmd-chip',
        onclick: () => submitCommand(cmd),
      }, label || CHIP_LABELS[cmd] || cmd);
    }

    // Appends an arbitrary DOM node (not typed text) to the terminal log.
    // Used for command output that includes buttons, like help tables.
    function printNode(node) {
      log.appendChild(node);
      log.scrollTop = log.scrollHeight;
    }

    // Prints the list of available commands as a table of chip/description
    // rows. Called by run() when the player types 'help'.
    function printHelp() {
      printRaw('AVAILABLE COMMANDS:');
      const table = el('div', { class: 'help-table' },
        HELP_ROWS.map(([cmd, desc]) => el('div', { class: 'help-row' }, [
          cmdChip(cmd),
          el('span', { class: 'help-desc' }, desc),
        ]))
      );
      printNode(table);
    }

    // Rebuilds the context bar to show only the options relevant to
    // `activeTarget` (populated once a walk finishes) — nothing is shown
    // until the player has clicked an object. Called after walkTo()
    // resolves and after every flag-changing command.
    function renderContextBar() {
      contextBar.innerHTML = '';
      const chips = [];
      if (activeTarget === 'terminal') {
        if (!flags.sawHiddenList) chips.push(['ls -a', CHIP_LABELS['ls -a']]);
        chips.push(['inventory', 'INVENTORY']);
        chips.push(['hint', 'HINT']);
      } else if (activeTarget === 'desk') {
        if (!flags.openedDrawer) chips.push(['open drawer', 'OPEN DRAWER']);
        else if (!flags.hasKeycard) chips.push(['take keycard', 'TAKE KEYCARD']);
      }
      contextBar.append(...chips.map(([cmd, label]) => cmdChip(cmd, label)));
    }

    // Prints a row of `cat <file>` chips for the given filenames. Called by
    // run() for the `ls` and `ls -a` commands.
    function printFileList(files) {
      const row = el('div', { class: 'help-row file-row' },
        files.map((f) => cmdChip(`cat ${f}`, f))
      );
      printNode(row);
    }

    // Determines the next hint text and suggested command based on which
    // milestone (look, readme, hidden listing, access code, drawer,
    // keycard, unlock) the player hasn't reached yet. Called by printHint().
    function hintInfo() {
      if (!flags.lookedAround) return { text: 'HINT: try', cmd: 'look' };
      if (!flags.sawReadme) return { text: 'HINT: there is a readme file nearby. Try', cmd: 'cat readme.txt' };
      if (!flags.sawHiddenList) return { text: 'HINT: not everything shows up in a normal listing. Try', cmd: 'ls -a' };
      if (!flags.sawAccessCode) return { text: 'HINT: you spotted a hidden file. Try', cmd: 'cat .access_code' };
      if (!flags.openedDrawer) return { text: 'HINT: that drawer looks worth checking. Try', cmd: 'open drawer' };
      if (!flags.hasKeycard) return { text: 'HINT: try', cmd: 'take keycard' };
      return { text: 'HINT: you have the code and the keycard. Try', cmd: 'unlock door 739' };
    }

    // Prints the current hint line with a clickable suggested command.
    // Called by run() when the player types 'hint'.
    function printHint() {
      const { text, cmd } = hintInfo();
      printNode(el('p', { class: 'term-line term-hint' }, [`${text}: `, cmdChip(cmd)]));
    }

    // Handles a correct door code: marks the flag, prints the unlock text,
    // marks the level complete in state.js with the first shard digit, and
    // shows the sector-cleared interstitial routing to level2. Called by
    // tryUnlock() on a correct code.
    async function onDoorSolved() {
      flags.doorUnlocked = true;
      await printLines(['The keypad flashes green. Bolts retract with a heavy CLUNK.', 'The steel door slides open onto darkness, and a set of stairs down.'], 'term-success');
      sfx.unlock();
      justActed = true;
      renderRoomScene();
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

    // Validates a door-code guess: requires a keycard and a numeric code,
    // triggers onDoorSolved() on a match (739), otherwise shows an error and
    // shakes the terminal. Called by the door pad's TRY CODE button and by
    // run() for `unlock door <code>` style commands.
    async function tryUnlock(argStr) {
      const digits = (argStr || '').replace(/\D/g, '');
      if (!flags.hasKeycard) {
        await printRaw('The keypad is dead. It needs power. Maybe a keycard would help.', 'term-error');
        return;
      }
      if (!digits) {
        await printRaw('Enter a code, e.g. `unlock door 739`.', 'term-error');
        return;
      }
      if (digits === '739') {
        await onDoorSolved();
        return;
      }
      sfx.error();
      shake(frame);
      await printRaw('ACCESS DENIED. The keypad buzzes and resets.', 'term-error');
    }

    // The command parser: normalizes the typed/tapped input, splits it into
    // a verb and arguments, and dispatches to the matching room action
    // (look, ls, cat, open, take, inventory, unlock, hint, etc). Called by
    // submitCommand() for every command the player enters. Unchanged from
    // the original in every way except: playActionIcon()/sfx calls added
    // for the room-visual reactions, and renderContextBar() calls so the
    // context bar stays in sync when a command changes progress.
    async function run(raw) {
      const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!cmd) return;
      const [verb, ...restParts] = cmd.split(' ');
      const args = restParts.join(' ');

      if (['help', 'h', '?'].includes(verb)) return printHelp();
      if (['look', 'l'].includes(verb)) {
        flags.lookedAround = true;
        playActionIcon('look');
        renderContextBar();
        return printRaw(ROOM_DESC);
      }
      if (verb === 'ls' && /(-a|a)$/.test(args)) {
        flags.sawHiddenList = true;
        renderContextBar();
        return printFileList(['readme.txt', 'sector.log', '.access_code']);
      }
      if (verb === 'ls') return printFileList(['readme.txt', 'sector.log']);
      if (verb === 'cat') {
        const file = normalizeFile(args);
        if (file === 'readme.txt') {
          flags.sawReadme = true;
          return printLines(['SECTOR 0 STATUS: ONLINE.', "If you're reading this, ECHO let you in.", "Nothing here is ever truly deleted. Even what's hidden.", '(hint: try `ls -a`)']);
        }
        if (file === 'sector.log') {
          return printLines(['LOG 004: Something moves in the walls after hours.', "Maintenance says it's just the pipes.", "I don't believe maintenance anymore.", '   signed, J. Alvarez, night technician (filed no further reports)']);
        }
        if (file === '.access_code') {
          flags.sawHiddenList = true;
          flags.sawAccessCode = true;
          renderRoomScene();
          renderContextBar();
          return printLines(['OVERRIDE FRAGMENT RECOVERED...', 'KEYPAD CODE: 7-3-9']);
        }
        return printRaw(`cat: ${file || '(missing file)'}: No such file`, 'term-error');
      }
      if (verb === 'open' && args.includes('drawer')) {
        if (flags.openedDrawer) return printRaw(flags.hasKeycard ? 'The drawer is open and empty.' : 'The drawer is already open. The keycard is still there.');
        flags.openedDrawer = true;
        justActed = true;
        sfx.drawer();
        renderRoomScene();
        renderContextBar();
        return printRaw('The drawer sticks, then gives way with a groan. Inside: a keycard, still faintly warm.');
      }
      if (['take', 'get', 'grab'].includes(verb) && (args.includes('keycard') || args.includes('card'))) {
        if (flags.hasKeycard) return printRaw('You already have the keycard.');
        if (!flags.openedDrawer) return printRaw("There's nothing to take here yet.");
        const deskEl = roomScene.querySelector('.room-item-btn[aria-label*="drawer"]');
        const prevRect = deskEl ? deskEl.getBoundingClientRect() : null;
        flags.hasKeycard = true;
        inventory.push('Keycard');
        sfx.select();
        justActed = true;
        renderRoomScene();
        renderContextBar();
        const cardEl = roomScene.querySelector('.room-item--acquired canvas');
        if (prevRect && cardEl) flip(cardEl, prevRect, 500);
        return printRaw('KEYCARD acquired.', 'term-success');
      }
      if (['inventory', 'inv', 'i'].includes(verb)) {
        playActionIcon('inventory');
        return printRaw(inventory.length ? `Carrying: ${inventory.join(', ')}` : 'Your pockets are empty.');
      }
      if (verb === 'clear') { log.innerHTML = ''; return; }
      if ((verb === 'unlock' || verb === 'open') && args.includes('door')) return tryUnlock(args);
      if ((verb === 'enter' || verb === 'type') && /\d/.test(args)) return tryUnlock(args);
      if (verb === 'use' && args.includes('keycard')) {
        return printRaw(flags.hasKeycard ? 'The keypad blinks, waiting for a code.' : "You don't have a keycard to use.");
      }
      if (verb === 'hint') { playActionIcon('hint'); return printHint(); }
      return printRaw(`SECTOR 0: command not recognized. Type 'help'.`, 'term-error');
    }

    // Echoes the entered command into the log, records it in command
    // history, and runs it. Called by the terminal input's Enter handler,
    // quick-command chips, and the room-object click handlers.
    function submitCommand(val) {
      if (!val.trim()) return;
      printRaw(`> ${val}`, 'term-echo');
      history.push(val);
      historyIdx = history.length;
      run(val);
      input.focus({ preventScroll: true });
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

    container.addEventListener('click', () => input.focus({ preventScroll: true }), { signal: ctx.signal });

    renderRoomScene();
    printLines(['TERMINAL READY.', 'Click the terminal, desk, or door to act, or type a command below.']).then(() => input.focus({ preventScroll: true }));
  },
};
