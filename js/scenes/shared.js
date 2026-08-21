// Reusable UI building blocks shared across the scene files: the terminal
// window frame used by every level, ASCII-art wrapper, the typewriter text
// helper, the "sector cleared" interstitial overlay shown after each level
// win, and a small stat badge. Every scene under js/scenes/ (except title.js
// and callsign.js, which have their own simpler layouts) imports from here
// instead of duplicating this markup.

import { el } from '../utils.js';
import { typeWriter, glitchBurst, pulse } from '../fx.js';
import { drawShard, drawGhost } from '../sprites.js';
import { sfx } from '../audio.js';
import { SECTORS } from '../state.js';

// Builds the retro terminal-window chrome (title bar with three dots, a
// title, and a body container for `children`). Used by all five level
// scenes as their main container.
export function terminalFrame({ title, accent }, children = []) {
  const frame = el('div', { class: 'term-frame', style: accent ? `--accent:${accent}` : '' }, [
    el('div', { class: 'term-titlebar' }, [
      el('span', { class: 'term-dot' }),
      el('span', { class: 'term-dot' }),
      el('span', { class: 'term-dot' }),
      el('span', { class: 'term-title-text' }, title || ''),
    ]),
    el('div', { class: 'term-body' }, children),
  ]);
  return frame;
}

// Wraps static ASCII art (from asciiArt.js) in a <pre> with the shared
// `.ascii` styling. Used by title.js, level5.js, and ending.js.
export function asciiPre(text, extraClass = '') {
  return el('pre', { class: `ascii ${extraClass}`.trim(), 'aria-hidden': 'true' }, text);
}

// Thin pass-through to fx.js's typeWriter, kept here so scene files only
// need to import from shared.js for their text-typing needs.
export async function typeInto(node, text, opts = {}) {
  return typeWriter(node, text, opts);
}

// Full-panel "sector cleared" interstitial rendered inside a level's own
// container. Not a scene change: the sector's chrome/status bar stays put.
// Called by every level file (level1..level5) right after completeLevel()
// on state.js, to show the story beat, award a shard, and offer a CTA that
// navigates to the next scene via ctx.goTo.
export function showInterstitial(container, opts) {
  const {
    levelIndex,
    storyBeat = '',
    shardDigit = null,
    ctaLabel = 'CONTINUE',
    onContinue = () => {},
    finalBeat = false,
  } = opts;

  const sector = SECTORS[levelIndex];
  const overlay = el('div', { class: 'interstitial', style: `--accent:${sector.accent}` });

  const panel = el('div', { class: 'interstitial-panel' }, [
    el('div', { class: 'seal' }, '✓'),
    el('h2', { class: 'interstitial-heading' }, `${sector.name} CLEARED`),
    el('p', { class: 'interstitial-beat', id: 'beat-text' }),
  ]);

  let shardWrap = null;
  // "Memory discovered" beat: a flickering silhouette + typed line landing
  // just before the shard reveal (or, on the final sector where no new
  // shard is awarded, standing on its own) — ties every sector clear back
  // to the ending's "every sector cleared was a memory" payoff.
  const showMemoryBeat = shardDigit !== null || finalBeat;
  if (showMemoryBeat) {
    const memoryBeat = el('div', { class: 'memory-beat' }, [
      drawGhost(sector.accent, 6, 'sprite sprite-ghost memory-beat-ghost'),
      el('p', { class: 'memory-beat-label', id: 'memory-text' }),
    ]);
    panel.appendChild(memoryBeat);
  }

  if (shardDigit !== null) {
    shardWrap = el('div', { class: 'shard-award' });
    const canvas = drawShard(sector.accent, 10);
    shardWrap.appendChild(canvas);
    shardWrap.appendChild(el('div', { class: 'shard-award-label' }, [
      el('span', {}, `MEMORY SHARD ${['I', 'II', 'III', 'IV'][levelIndex]} ACQUIRED`),
      el('span', { class: 'shard-digit' }, `FRAGMENT: ${shardDigit}`),
    ]));
    panel.appendChild(shardWrap);
  }

  const btn = el('button', { class: 'cta-btn', onclick: () => { sfx.select(); onContinue(); } }, ctaLabel);
  panel.appendChild(btn);
  overlay.appendChild(panel);
  container.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('show'));
  sfx.success();
  glitchBurst(overlay, 300);
  typeWriter(panel.querySelector('#beat-text'), storyBeat, { speed: 14 });

  if (showMemoryBeat) {
    sfx.reveal();
    const memoryText = shardDigit !== null ? 'MEMORY FRAGMENT RECOVERED...' : 'ALL MEMORY FRAGMENTS ALIGNED...';
    typeWriter(panel.querySelector('#memory-text'), memoryText, { speed: 20 }).then(() => {
      pulse(panel.querySelector('.memory-beat-ghost'), 'fx-pulse', 700);
    });
  }
  btn.focus();
  return overlay;
}

// Renders a small label/value pair. Available for scenes wanting a
// consistent stat display alongside the interstitial or credits.
export function statBadge(label, value) {
  return el('div', { class: 'stat-badge' }, [
    el('span', { class: 'stat-label' }, label),
    el('span', { class: 'stat-value' }, String(value)),
  ]);
}
