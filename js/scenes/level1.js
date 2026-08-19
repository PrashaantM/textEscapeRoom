import { completeLevel, getState } from '../state.js';
import { sfx } from '../audio.js';
import { shake } from '../fx.js';
import { el, delay } from '../utils.js';
import { terminalFrame, typeInto, showInterstitial } from './shared.js';

const ROOM_DESC = "You're wedged into a server closet that smells of hot dust. A dead terminal hums awake. To your left: a steel door with a 3-digit keypad. Under the desk: a battered drawer. Taped to the monitor: a folder marked SECTOR LOGS.";
const HELP_LINES = [
  'AVAILABLE COMMANDS:',
  '  look                just look around the room',
  '  ls / ls -a          list files (add -a to reveal hidden ones)',
  '  cat <file>          read a file',
  '  open drawer         open the desk drawer',
  '  take keycard        pick something up',
  '  inventory           check what you are carrying',
  '  unlock door <code>  try the keypad',
  '  hint                nudge yourself in the right direction',
  '  clear               wipe the screen',
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
    frame.querySelector('.term-body').appendChild(log);
    frame.querySelector('.term-body').appendChild(inputRow);
    container.appendChild(el('div', { class: 'level1-scene' }, [frame]));

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

    function hintLine() {
      if (!flags.lookedAround) return "HINT: try `look`.";
      if (!flags.sawReadme) return 'HINT: there is a readme file nearby. Try `cat readme.txt`.';
      if (!flags.sawHiddenList) return 'HINT: not everything shows up in a normal listing. Try `ls -a`.';
      if (!flags.sawAccessCode) return 'HINT: you spotted a hidden file. Try `cat .access_code`.';
      if (!flags.openedDrawer) return 'HINT: that drawer looks worth checking. Try `open drawer`.';
      if (!flags.hasKeycard) return 'HINT: try `take keycard`.';
      return 'HINT: you have the code and the keycard. Try `unlock door 739`.';
    }

    async function onDoorSolved() {
      flags.doorUnlocked = true;
      await printLines(['The keypad flashes green. Bolts retract with a heavy CLUNK.', 'The steel door slides open onto darkness, and a set of stairs down.'], 'term-success');
      sfx.unlock();
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

      if (['help', 'h', '?'].includes(verb)) return printLines(HELP_LINES);
      if (['look', 'l'].includes(verb)) { flags.lookedAround = true; return printRaw(ROOM_DESC); }
      if (verb === 'ls' && /(-a|a)$/.test(args)) {
        flags.sawHiddenList = true;
        return printRaw('readme.txt   sector.log   .access_code');
      }
      if (verb === 'ls') return printRaw('readme.txt   sector.log');
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
        return printRaw('The drawer sticks, then gives way with a groan. Inside: a keycard, still faintly warm.');
      }
      if (['take', 'get', 'grab'].includes(verb) && (args.includes('keycard') || args.includes('card'))) {
        if (flags.hasKeycard) return printRaw('You already have the keycard.');
        if (!flags.openedDrawer) return printRaw("There's nothing to take here yet.");
        flags.hasKeycard = true;
        inventory.push('Keycard');
        sfx.select();
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
      if (verb === 'hint') return printRaw(hintLine(), 'term-hint');
      return printRaw(`SECTOR 0: command not recognized. Type 'help'.`, 'term-error');
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        if (!val.trim()) return;
        printRaw(`> ${val}`, 'term-echo');
        history.push(val);
        historyIdx = history.length;
        input.value = '';
        run(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx > 0) { historyIdx--; input.value = history[historyIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx < history.length - 1) { historyIdx++; input.value = history[historyIdx]; }
        else { historyIdx = history.length; input.value = ''; }
      }
    }, { signal: ctx.signal });

    container.addEventListener('click', () => input.focus(), { signal: ctx.signal });
    printLines(['TERMINAL READY.', "Type `help` if you're lost, `look` if you're curious."]).then(() => input.focus());
  },
};
