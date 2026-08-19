import { completeLevel, getState, SECTORS } from '../state.js';
import { sfx } from '../audio.js';
import { shake, glitchBurst, pulse } from '../fx.js';
import { el, clamp } from '../utils.js';
import { terminalFrame, asciiPre, showInterstitial } from './shared.js';
import { drawShard } from '../sprites.js';
import { CORE_RING } from '../asciiArt.js';

const ROMAN = ['I', 'II', 'III', 'IV'];

export default {
  mount(container, ctx) {
    const state = getState();
    const slots = ['0', '0', '0', '0'];
    let activeSlot = 0;
    let solved = false;

    const frame = terminalFrame({ title: 'SECTOR 4 // THE CORE', accent: '#b967ff' });
    const body = frame.querySelector('.term-body');

    const core = asciiPre(CORE_RING, 'core-art');
    const shardCase = el('div', { class: 'shard-case' },
      SECTORS.slice(0, 4).map((s, i) => el('div', { class: 'shard-slot' }, [
        drawShard(s.accent, 5),
        el('span', {}, `SHARD ${ROMAN[i]}: ${state.shards[i]}`),
      ]))
    );

    const clue = el('p', { class: 'core-clue' }, 'LOG_FRAGMENT: "The core reads memory in reverse. Last shard first."');

    const slotEls = [];
    const keypad = el('div', { class: 'keypad-slots' });
    for (let i = 0; i < 4; i++) {
      const btn = el('button', { class: 'keypad-slot', onclick: () => setActive(i) }, slots[i]);
      slotEls.push(btn);
      keypad.appendChild(btn);
    }

    const numpad = el('div', { class: 'numpad' });
    for (let n = 0; n <= 9; n++) {
      numpad.appendChild(el('button', { class: 'numpad-btn', onclick: () => setDigit(n) }, String(n)));
    }

    const status = el('p', { class: 'core-status', 'aria-live': 'polite' });
    const submitBtn = el('button', { class: 'cta-btn', onclick: () => submit() }, 'OVERRIDE ▶');

    body.appendChild(core);
    body.appendChild(shardCase);
    body.appendChild(clue);
    body.appendChild(keypad);
    body.appendChild(numpad);
    body.appendChild(status);
    body.appendChild(submitBtn);
    container.appendChild(el('div', { class: 'level5-scene' }, [frame]));

    function renderSlots() {
      slotEls.forEach((btn, i) => {
        btn.textContent = slots[i];
        btn.classList.toggle('active', i === activeSlot);
      });
    }
    renderSlots();

    function setActive(i) {
      activeSlot = clamp(i, 0, 3);
      sfx.move();
      renderSlots();
    }

    function setDigit(d) {
      if (solved) return;
      slots[activeSlot] = String(d);
      sfx.key();
      if (activeSlot < 3) activeSlot++;
      renderSlots();
    }

    function submit() {
      if (solved) return;
      const guess = slots.join('');
      const expected = state.shards.slice().reverse().join('');
      if (guess === expected) {
        win();
      } else {
        sfx.error();
        shake(keypad);
        status.textContent = 'ACCESS DENIED';
        slots[0] = slots[1] = slots[2] = slots[3] = '0';
        activeSlot = 0;
        renderSlots();
      }
    }

    function win() {
      solved = true;
      sfx.unlock();
      glitchBurst(frame, 600);
      pulse(core, 'fx-pulse', 900);
      core.classList.add('core-stable');
      status.textContent = 'CORE ACCESS GRANTED';
      completeLevel(4);
      setTimeout(() => {
        showInterstitial(container.querySelector('.level5-scene'), {
          levelIndex: 4,
          storyBeat: 'ECHO: "That\'s... all of me. Every sector, every fragment. I remember now. I remember everything."',
          shardDigit: null,
          ctaLabel: 'CONTINUE ▶',
          onContinue: () => ctx.goTo('ending'),
        });
      }, 900);
    }

    window.addEventListener('keydown', (e) => {
      if (solved) return;
      if (/^[0-9]$/.test(e.key)) { setDigit(Number(e.key)); return; }
      if (e.key === 'ArrowLeft') { setActive(activeSlot - 1); return; }
      if (e.key === 'ArrowRight') { setActive(activeSlot + 1); return; }
      if (e.key === 'Enter') submit();
    }, { signal: ctx.signal });
  },
};
