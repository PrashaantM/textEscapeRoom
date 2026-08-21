// Shared toolkit for the "walkable room" visual half used by Sectors 0-3
// (level1..level4). Each of those scenes has its own room layout, hotspots,
// and puzzle logic, but they all need the same plumbing: a full-bleed room
// canvas scattered with background decor, a player sprite that actually
// walks (not just slides) between named spots, a small speech bubble for
// contextual options anchored next to the player, and a visual, clickable
// inventory panel. Building that once here means each sector file only has
// to describe ITS room (where things are, what they do), not reinvent walk
// animation or bubble positioning.

import { el } from '../utils.js';
import { sfx } from '../audio.js';
import { drawPlayer } from '../sprites.js';

const FOOTSTEP_MS = 150;

// Creates a walkable room: a `position:relative` box (room-scene--free) that
// fills its half of the split-scene layout. Returns an API for scattering
// decor, placing/removing clickable hotspots, walking the player between
// them, popping a bubble of options next to the player, and showing a
// visual inventory overlay. `accent` tints the player sprite and bubble
// border to match the sector's color.
export function createRoom({ accent = '#39ff14', ariaLabel = 'Room' } = {}) {
  const roomEl = el('div', { class: 'room-scene room-scene--free', style: `--accent:${accent}`, role: 'group', 'aria-label': ariaLabel });
  const decorLayer = el('div', { class: 'room-decor-layer', 'aria-hidden': 'true' });
  const hotspotLayer = el('div', { class: 'room-hotspot-layer' });
  const playerWrap = el('div', { class: 'room-player', style: 'left:50%; top:60%' });
  const bubbleEl = el('div', { class: 'room-bubble', hidden: true });
  roomEl.append(decorLayer, hotspotLayer, playerWrap, bubbleEl);

  const hotspots = new Map(); // id -> { x, y, btn }
  let legPhase = 0;
  let walking = false;
  let activeId = null;
  let playerXY = { x: 50, y: 60 };

  function drawPlayerFrame() {
    playerWrap.innerHTML = '';
    playerWrap.appendChild(drawPlayer(accent, 6, 'sprite sprite-player', legPhase));
  }
  drawPlayerFrame();

  // Replaces all background set-dressing. `items` is a list of
  // { x, y, node } as percentage coordinates within the room. Purely
  // decorative — never clickable, never re-rendered per-interaction, so
  // callers can just set this once at mount.
  function setDecor(items) {
    decorLayer.innerHTML = '';
    items.forEach(({ x, y, node }) => {
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
      decorLayer.appendChild(node);
    });
  }

  // Adds (or replaces) a clickable hotspot at percentage position (x, y).
  // `build()` returns the child nodes to show (sprite + label);
  // `onClick(id)` fires on click/tap. `active` styling is applied whenever
  // this hotspot is the current walk target. Called by each sector's room
  // setup and again whenever a hotspot's own visual needs to change (pass
  // the same id to replace it in place).
  function setHotspot(id, { x, y, build, onClick, label }) {
    const prev = hotspots.get(id);
    const btn = el('button', {
      class: 'room-hotspot' + (activeId === id ? ' room-hotspot--active' : ''),
      style: `left:${x}%; top:${y}%`,
      'aria-label': label || id,
      onclick: () => onClick && onClick(id),
    }, build());
    if (prev) prev.btn.replaceWith(btn);
    else hotspotLayer.appendChild(btn);
    hotspots.set(id, { x, y, btn });
    return btn;
  }

  // Instantly places the player at (x, y) with no walk animation and no
  // footstep sound — for teleports that aren't a walk at all, like
  // stepping through a door into a whole new room. Called by scenes with
  // more than one room right after rebuilding the new room's hotspots.
  function placeAt(x, y) {
    playerXY = { x, y };
    playerWrap.classList.add('room-player--jump');
    playerWrap.style.left = `${x}%`;
    playerWrap.style.top = `${y}%`;
    // Force layout so the position above applies before the class comes
    // back off, otherwise the browser can coalesce both style changes into
    // one frame and animate the jump anyway.
    void playerWrap.offsetWidth;
    requestAnimationFrame(() => playerWrap.classList.remove('room-player--jump'));
  }

  function removeHotspot(id) {
    const prev = hotspots.get(id);
    if (prev) { prev.btn.remove(); hotspots.delete(id); }
  }

  // Removes every hotspot at once. Called by scenes with more than one
  // room (e.g. level2.js's tech/bio bays) before rebuilding the next
  // room's hotspots — otherwise a hotspot whose id isn't reused by the new
  // room (most of them, room to room) would be left behind: invisible,
  // but still sitting at its old position and still clickable, silently
  // stealing clicks from whatever new hotspot happens to land on top of it.
  function clearHotspots() {
    hotspots.forEach(({ btn }) => btn.remove());
    hotspots.clear();
    activeId = null;
  }

  // Shared walk animation: interpolates the player to (x, y) with the
  // real 2-frame leg-cycle animation (a footstep tick alternates legPhase
  // and redraws the sprite, in sync with sfx.walk()), resolving once the
  // CSS transition ends. A no-op (resolves immediately) if already
  // walking or already there. Used by both walkTo() (a named hotspot) and
  // walkToPoint() (an arbitrary click on open floor).
  function walkToXY(x, y) {
    return new Promise((resolve) => {
      if (walking) { resolve(); return; }
      const dx = x - playerXY.x;
      const dy = y - playerXY.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { resolve(); return; }

      walking = true;
      playerWrap.classList.add('room-player--walking');
      if (dx < 0) playerWrap.classList.add('room-player--flip'); else playerWrap.classList.remove('room-player--flip');
      const footstep = setInterval(() => {
        legPhase = legPhase ? 0 : 1;
        drawPlayerFrame();
        sfx.walk();
      }, FOOTSTEP_MS);

      playerXY = { x, y };
      playerWrap.style.left = `${playerXY.x}%`;
      playerWrap.style.top = `${playerXY.y}%`;

      const done = () => {
        clearInterval(footstep);
        walking = false;
        legPhase = 0;
        drawPlayerFrame();
        playerWrap.classList.remove('room-player--walking');
        playerWrap.removeEventListener('transitionend', done);
        resolve();
      };
      playerWrap.addEventListener('transitionend', done, { once: true });
      // Fallback in case the transition doesn't fire (e.g. reduced-motion
      // strips the CSS transition entirely).
      setTimeout(done, 900);
    });
  }

  // Walks the player sprite to hotspot `id`'s position and marks it the
  // active hotspot (highlight ring, getActive()). Called by every sector's
  // click handlers before acting on an object.
  function walkTo(id) {
    const spot = hotspots.get(id);
    if (!spot) return Promise.resolve();
    hideBubble();
    const prevActive = activeId;
    activeId = id;
    if (prevActive) hotspots.get(prevActive)?.btn.classList.remove('room-hotspot--active');
    spot.btn.classList.add('room-hotspot--active');
    return walkToXY(spot.x, spot.y);
  }

  // Walks the player to an arbitrary point (percentage coordinates) with
  // no hotspot involved — clicking open floor. Clears whatever hotspot
  // was previously active, since the player is no longer standing at it.
  function walkToPoint(x, y) {
    hideBubble();
    if (activeId) { hotspots.get(activeId)?.btn.classList.remove('room-hotspot--active'); activeId = null; }
    return walkToXY(x, y);
  }

  // Shows a small speech-bubble of option buttons anchored just above the
  // player's current spot. `items` is [{ label, onClick }]. Used for all
  // "remaining options" a sector wants to offer next to the player instead
  // of listing them in the terminal. Called after walkTo() resolves.
  function showBubble(items) {
    bubbleEl.innerHTML = '';
    bubbleEl.hidden = false;
    bubbleEl.style.left = `${playerXY.x}%`;
    bubbleEl.style.top = `${playerXY.y}%`;
    items.forEach(({ label, onClick }) => {
      bubbleEl.appendChild(el('button', { class: 'room-bubble-btn', onclick: onClick }, label));
    });
  }

  function hideBubble() {
    bubbleEl.hidden = true;
    bubbleEl.innerHTML = '';
  }

  function getActive() { return activeId; }
  function isWalking() { return walking; }

  return {
    el: roomEl, setDecor, setHotspot, removeHotspot, clearHotspots, walkTo, walkToPoint, placeAt, showBubble, hideBubble, getActive, isWalking,
  };
}

// Renders a visual inventory overlay: each item shown as its own sprite +
// label, clickable to "use" it. `items` is [{ id, label, node, onUse }].
// Returns the overlay element (append it into the room or wherever the
// caller wants it layered); pass an onClose to wire the close button.
export function buildInventoryOverlay(items, { onClose } = {}) {
  const overlay = el('div', { class: 'inventory-overlay' }, [
    el('div', { class: 'inventory-panel' }, [
      el('div', { class: 'inventory-header' }, [
        el('span', {}, 'INVENTORY'),
        el('button', { class: 'inventory-close', 'aria-label': 'Close inventory', onclick: () => onClose && onClose() }, '✕'),
      ]),
      items.length
        ? el('div', { class: 'inventory-grid' }, items.map((item) => el('button', {
          class: 'inventory-item',
          onclick: () => item.onUse && item.onUse(),
        }, [item.node, el('span', {}, item.label)])))
        : el('p', { class: 'inventory-empty' }, 'Your pockets are empty.'),
    ]),
  ]);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) onClose && onClose(); });
  return overlay;
}
