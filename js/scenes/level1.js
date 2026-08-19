import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake, pulse } from '../fx.js';
import { el, delay } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';
import { drawDoor, drawDrawer, drawTerminal, drawKeycard } from '../sprites.js';

const ROOM_DESC = "You're wedged into a server closet that smells of hot dust. A dead terminal hums awake. To your left: a steel door with a 3-digit keypad. Under the desk: a battered drawer. Taped to the monitor: a folder marked SECTOR LOGS.";

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

function normalizeFile(s) {
  return (s || '').replace(/^\.\//, '').trim();
}

export default {
  mount(container, ctx) {
    const flags = { lookedAround: false, sawReadme: false, sawHiddenList: false, sawAccessCode: false, openedDrawer: false, hasKeycard: false, doorUnlocked: false };
    const inventory = [];
    const history = [];
    let historyIdx = -1;

    // ---- pixel-art room scene: a live visual readout of the puzzle state ----
    const roomScene = el('div', { class: 'room-scene', 'aria-hidden': 'true' });
    let lastKeycardShown = false;

    function renderRoomScene() {
      roomScene.innerHTML = '';
      const doorItem = el('div', { class: 'room-item' }, [drawDoor(!flags.doorUnlocked, 8), el('span', {}, flags.doorUnlocked ? 'DOOR: OPEN' : 'DOOR: LOCKED')]);
      const deskItem = el('div', { class: 'room-item' }, [drawDrawer(flags.openedDrawer, 8), el('span', {}, flags.openedDrawer ? 'DESK: OPEN' : 'DESK: SHUT')]);
      const termItem = el('div', { class: 'room-item' }, [drawTerminal(8), el('span', {}, 'TERMINAL')]);
      roomScene.append(termItem, deskItem, doorItem);
      if (flags.hasKeycard) {
        const cardItem = el('div', { class: 'room-item room-item--acquired' }, [drawKeycard('#39ff14', 8), el('span', {}, 'KEYCARD')]);
        roomScene.appendChild(cardItem);
        if (!lastKeycardShown) pulse(cardItem, 'fx-pulse', 700);
      }
      lastKeycardShown = flags.hasKeycard;
      if (flags.doorUnlocked) pulse(doorItem, 'fx-pulse', 700);
    }

    const frame = terminalFrame({ title: 'SECTOR 0 // BOOT-UP :: root@echo:~$', accent: '#39ff14' });
    const log = el('div', { class: 'term-log', id: 'l1-log', role: 'log', 'aria-live': 'polite' });

    // ---- quick-command chips: tap instead of typing ----
    const quickBar = el('div', { class: 'quick-commands', role: 'group', 'aria-label': 'Quick commands' });
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
    body.appendChild(quickBar);
    body.appendChild(inputRow);
    container.appendChild(el('div', { class: 'level1-scene' }, [roomScene, frame]));

    const input = inputRow.querySelector('input');

    function printRaw(text, cls = '') {
      const p = el('p', { class: `term-line ${cls}`.trim() });
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return typeInto(p, text, { speed: 6, sound: false });
    }

    async function printLines(lines, cls = '') {
      for (const line of lines) await printRaw(line, cls);
    }

    function cmdChip(cmd, label) {
      return el('button', {
        class: 'cmd-chip',
        onclick: () => submitCommand(cmd),
      }, label || cmd);
    }

    function printNode(node) {
      log.appendChild(node);
      log.scrollTop = log.scrollHeight;
    }

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

    function printFileList(files) {
      const row = el('div', { class: 'help-row file-row' },
        files.map((f) => cmdChip(`cat ${f}`, f))
      );
      printNode(row);
    }

    function hintInfo() {
      if (!flags.lookedAround) return { text: 'HINT: try', cmd: 'look' };
      if (!flags.sawReadme) return { text: 'HINT: there is a readme file nearby. Try', cmd: 'cat readme.txt' };
      if (!flags.sawHiddenList) return { text: 'HINT: not everything shows up in a normal listing. Try', cmd: 'ls -a' };
      if (!flags.sawAccessCode) return { text: 'HINT: you spotted a hidden file. Try', cmd: 'cat .access_code' };
      if (!flags.openedDrawer) return { text: 'HINT: that drawer looks worth checking. Try', cmd: 'open drawer' };
      if (!flags.hasKeycard) return { text: 'HINT: try', cmd: 'take keycard' };
      return { text: 'HINT: you have the code and the keycard. Try', cmd: 'unlock door 739' };
    }

    function printHint() {
      const { text, cmd } = hintInfo();
      printNode(el('p', { class: 'term-line term-hint' }, [`${text}: `, cmdChip(cmd)]));
    }

    async function onDoorSolved() {
      flags.doorUnlocked = true;
      await printLines(['The keypad flashes green. Bolts retract with a heavy CLUNK.', 'The steel door slides open onto darkness, and a set of stairs down.'], 'term-success');
      sfx.unlock();
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

    async function run(raw) {
      const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!cmd) return;
      const [verb, ...restParts] = cmd.split(' ');
      const args = restParts.join(' ');

      if (['help', 'h', '?'].includes(verb)) return printHelp();
      if (['look', 'l'].includes(verb)) { flags.lookedAround = true; return printRaw(ROOM_DESC); }
      if (verb === 'ls' && /(-a|a)$/.test(args)) {
        flags.sawHiddenList = true;
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
          return printLines(['OVERRIDE FRAGMENT RECOVERED...', 'KEYPAD CODE: 7-3-9']);
        }
        return printRaw(`cat: ${file || '(missing file)'}: No such file`, 'term-error');
      }
      if (verb === 'open' && args.includes('drawer')) {
        if (flags.openedDrawer) return printRaw(flags.hasKeycard ? 'The drawer is open and empty.' : 'The drawer is already open. The keycard is still there.');
        flags.openedDrawer = true;
        renderRoomScene();
        return printRaw('The drawer sticks, then gives way with a groan. Inside: a keycard, still faintly warm.');
      }
      if (['take', 'get', 'grab'].includes(verb) && (args.includes('keycard') || args.includes('card'))) {
        if (flags.hasKeycard) return printRaw('You already have the keycard.');
        if (!flags.openedDrawer) return printRaw("There's nothing to take here yet.");
        flags.hasKeycard = true;
        inventory.push('Keycard');
        sfx.select();
        renderRoomScene();
        return printRaw('KEYCARD acquired.', 'term-success');
      }
      if (['inventory', 'inv', 'i'].includes(verb)) {
        return printRaw(inventory.length ? `Carrying: ${inventory.join(', ')}` : 'Your pockets are empty.');
      }
      if (verb === 'clear') { log.innerHTML = ''; return; }
      if ((verb === 'unlock' || verb === 'open') && args.includes('door')) return tryUnlock(args);
      if ((verb === 'enter' || verb === 'type') && /\d/.test(args)) return tryUnlock(args);
      if (verb === 'use' && args.includes('keycard')) {
        return printRaw(flags.hasKeycard ? 'The keypad blinks, waiting for a code.' : "You don't have a keycard to use.");
      }
      if (verb === 'hint') return printHint();
      return printRaw(`SECTOR 0: command not recognized. Type 'help'.`, 'term-error');
    }

    function submitCommand(val) {
      if (!val.trim()) return;
      printRaw(`> ${val}`, 'term-echo');
      history.push(val);
      historyIdx = history.length;
      run(val);
      input.focus();
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

    quickBar.append(
      cmdChip('look', 'LOOK'),
      cmdChip('ls -a', 'LS -A'),
      cmdChip('open drawer', 'OPEN DRAWER'),
      cmdChip('take keycard', 'TAKE KEYCARD'),
      cmdChip('inventory', 'INVENTORY'),
      cmdChip('hint', 'HINT'),
    );

    container.addEventListener('click', () => input.focus(), { signal: ctx.signal });

    renderRoomScene();
    printLines(['TERMINAL READY.', 'Type a command below, or tap one of the buttons to try it.']).then(() => input.focus());
  },
};
