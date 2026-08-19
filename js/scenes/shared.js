import { el } from '../utils.js';
import { typeWriter, glitchBurst } from '../fx.js';
import { drawShard } from '../sprites.js';
import { sfx } from '../audio.js';
import { SECTORS } from '../state.js';

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

export function asciiPre(text, extraClass = '') {
  return el('pre', { class: `ascii ${extraClass}`.trim(), 'aria-hidden': 'true' }, text);
}

export async function typeInto(node, text, opts = {}) {
  return typeWriter(node, text, opts);
}

// Full-panel "sector cleared" interstitial rendered inside a level's own
// container. Not a scene change -- keeps the sector's chrome/status bar.
export function showInterstitial(container, opts) {
  const {
    levelIndex,
    storyBeat = '',
    shardDigit = null,
    ctaLabel = 'CONTINUE',
    onContinue = () => {},
  } = opts;

  const sector = SECTORS[levelIndex];
  const overlay = el('div', { class: 'interstitial', style: `--accent:${sector.accent}` });

  const panel = el('div', { class: 'interstitial-panel' }, [
    el('div', { class: 'seal' }, '✓'),
    el('h2', { class: 'interstitial-heading' }, `${sector.name} CLEARED`),
    el('p', { class: 'interstitial-beat', id: 'beat-text' }),
  ]);

  if (shardDigit !== null) {
    const shardWrap = el('div', { class: 'shard-award' });
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
  btn.focus();
  return overlay;
}

export function statBadge(label, value) {
  return el('div', { class: 'stat-badge' }, [
    el('span', { class: 'stat-label' }, label),
    el('span', { class: 'stat-value' }, String(value)),
  ]);
}
