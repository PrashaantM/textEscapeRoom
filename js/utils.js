// Small shared helpers used across the whole game: a tiny DOM-builder (el),
// query shortcuts, math/randomness utilities, an abortable delay, and an
// HTML escaper. Every scene file and most of the other js/ modules import
// from here instead of touching document.createElement or Math.random
// directly, so keep additions here generic and dependency-free.

// Creates a DOM element with the given tag, attaches attrs (class, dataset,
// on* event listeners, or plain attributes), and appends children (strings
// become text nodes). The core building block every scene file uses to
// construct its UI without a templating library.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// Thin wrappers around querySelector/querySelectorAll, used throughout the
// scene files and sceneManager.js to grab DOM nodes by selector.
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Restricts n to the [min, max] range. Used by level5.js to keep the active
// keypad slot index in bounds.
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Returns a random integer in [min, max] inclusive. Used by level2.js
// (arcade sequence generation), level3.js (breaker toggles) and level4.js
// (garbage text / hex addresses).
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Returns a shuffled copy of arr (Fisher-Yates), leaving the original
// untouched. Used by sample() below and directly by level4.js to randomize
// row order and bracket styles.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks n distinct random elements from arr, via shuffle(). Used by
// state.js (distinctRandomDigits) and level4.js (word bank candidates).
export function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

// Promise-based setTimeout that rejects early if the given AbortSignal
// fires. Used pervasively by scene files and fx.js's typeWriter to pace
// animations while still letting a scene change cancel them cleanly.
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
  });
}

// Generates `count` distinct digit strings from the [min, max] range. Called
// by state.js's freshState() to assign the 4 shard digits for a new game.
export function distinctRandomDigits(count, min = 1, max = 9) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  return sample(pool, count).map(String);
}

// Escapes &, <, >, " so untrusted text can be safely inserted as HTML.
// Available for any scene that needs to render user-provided text as markup.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
