import { patchState } from '../state.js';
import { sfx } from '../audio.js';
import { el } from '../utils.js';
import { typeInto, asciiPre } from './shared.js';

const MAX_LEN = 12;

export default {
  mount(container, ctx) {
    const heading = el('pre', { class: 'ascii callsign-typing' });
    const form = el('form', { class: 'callsign-form', autocomplete: 'off' });
    const input = el('input', {
      class: 'callsign-input',
      type: 'text',
      maxlength: String(MAX_LEN),
      placeholder: 'PLAYER1',
      'aria-label': 'Enter your callsign',
      autocomplete: 'off',
      spellcheck: 'false',
    });

    const submit = () => {
      const tag = (input.value || 'PLAYER1').trim().toUpperCase().slice(0, MAX_LEN) || 'PLAYER1';
      sfx.confirm();
      patchState({ playerTag: tag });
      ctx.goTo('boot');
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });

    const skipBtn = el('button', { type: 'button', class: 'cta-btn secondary', onclick: submit }, 'SKIP');
    const okBtn = el('button', { type: 'submit', class: 'cta-btn' }, 'CONFIRM');

    form.appendChild(input);
    form.appendChild(el('div', { class: 'callsign-actions' }, [okBtn, skipBtn]));

    container.appendChild(el('div', { class: 'callsign-scene' }, [
      heading,
      el('p', { class: 'callsign-sub' }, 'A cursor blinks, waiting to know what to call you.'),
      form,
    ]));

    typeInto(heading, 'IDENTIFY YOURSELF, GUEST >', { speed: 22 });
    requestAnimationFrame(() => input.focus());
  },
};
