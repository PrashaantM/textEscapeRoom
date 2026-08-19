// Scene: a short prompt asking the player to type a callsign (their display
// name), which is saved to state.js and used throughout dialogue in
// boot.js and ending.js. Reached from title.js's "New Game" flow; always
// advances to the boot scene next.

import { patchState } from '../state.js';
import { sfx } from '../audio.js';
import { el } from '../utils.js';
import { typeInto, asciiPre } from './shared.js';

const MAX_LEN = 12;

export default {
  // Scene lifecycle entry point, called by sceneManager.js's mountScene()
  // when this scene becomes active. Renders the input form and types the
  // prompt heading; submit() saves the trimmed/uppercased tag and moves on
  // to the boot scene.
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

    // Normalizes the typed callsign (or defaults to PLAYER1), saves it to
    // state.js, and advances to the boot scene. Triggered by form submit or
    // the SKIP button.
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
