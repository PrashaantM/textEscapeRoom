// Mobile handling: a 2-second "rotate to landscape" intro overlay, plus
// whole-page scale-to-fit so a phone shows exactly the same desktop layout
// (same proportions, no reflow) shrunk down to fit its screen instead of a
// separately re-arranged mobile layout.
//
// Detection and the layout-viewport override (html.mobile-scaled, plus
// forcing <meta viewport> to a fixed width so css/style.css's normal
// @media(max-width:520px) rule never fires here) already happened
// synchronously in index.html's <head>, before first paint. This module
// only handles what needs the DOM/layout to exist: computing the actual
// scale factor and applying it, and the landscape-prompt overlay timing.
// Imported once by js/main.js near the top of its boot sequence.

const REF_WIDTH = 1280;
const PROMPT_MS = 2000;

// Recomputes the uniform scale factor from the true device width and
// applies it to #viewport-scale, compensating #viewport-scale-outer's
// height so the page's real scrollable height matches the visually scaled
// content (a CSS transform alone doesn't shrink the space an element
// reserves in the document flow). Called on init and on every
// resize/orientationchange, and whenever scene content changes height.
function applyScale(outer, inner) {
  // index.html's head script force-widens the layout viewport to REF_WIDTH
  // (so this file's fixed-width layout never hits css/style.css's normal
  // responsive breakpoints) *before* this ever runs. That means
  // window.innerWidth reports REF_WIDTH here, always — not the device's
  // real width — so `window.innerWidth / REF_WIDTH` was permanently 1: no
  // shrink ever applied, and the whole desktop-proportioned room rendered
  // at full 1280px width on top of the real (much narrower) phone screen,
  // with everything past the visible edge simply unreachable.
  // window.visualViewport.scale is the browser's own auto-zoom-to-fit
  // ratio for exactly this situation (a layout viewport wider than the
  // device), i.e. deviceWidth/REF_WIDTH already, and it updates live on
  // rotation, so it doubles as the value this function needs.
  const scale = window.visualViewport ? window.visualViewport.scale : window.innerWidth / REF_WIDTH;
  inner.style.transform = `scale(${scale})`;
  outer.style.height = `${inner.scrollHeight * scale}px`;
}

// Shows the landscape-prompt overlay for a fixed 2 seconds (an intro
// animation, not a gate on actual orientation) then fades it out and
// removes it, leaving the game to resume normally underneath. Only ever
// called on a detected mobile device — desktop never adds `.lp-show`, so
// the element (display:none by default) never appears there at all.
function runLandscapePrompt(prompt) {
  prompt.classList.add('lp-show');
  setTimeout(() => {
    prompt.classList.add('hide');
    setTimeout(() => { prompt.classList.remove('lp-show', 'hide'); }, 450);
  }, PROMPT_MS);
}

export function initMobile() {
  if (!document.documentElement.classList.contains('mobile-scaled')) return;

  const outer = document.getElementById('viewport-scale-outer');
  const inner = document.getElementById('viewport-scale');
  const prompt = document.getElementById('landscape-prompt');
  if (!outer || !inner) return;

  applyScale(outer, inner);
  window.addEventListener('resize', () => applyScale(outer, inner));
  window.addEventListener('orientationchange', () => applyScale(outer, inner));

  // Scene changes alter content height (a level5's shard case, a long
  // terminal log, the credits crawl); keep the height compensation in sync.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => applyScale(outer, inner));
    ro.observe(inner);
  }

  if (prompt) runLandscapePrompt(prompt);
}
