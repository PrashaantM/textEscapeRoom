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

// The room is a real 3D corner (see .room-scene--free/.room-face in
// style.css): a side wall and a back wall, each an actual
// `transform-style:preserve-3d` plane under a shared `perspective`, meeting
// at a corner above a tilted floor plane — not a flat image faking one.
// These percentages describe where the wall band ends and the floor begins
// (ROOM_HORIZON), and where wall-mounted items split between the two walls
// (ROOM_CORNER), in the same flat 0-100 coordinate space every sector's
// object table already uses. classify() below is what actually turns an
// (x, y) pair from that table into "which plane, and where on it" — the
// object tables themselves never needed to change when the room went 3D.
export const ROOM_HORIZON = 62; // y% — the wall/floor seam. Wall: y < this. Floor: y >= this.
export const ROOM_CORNER = 16; // x% — the side-wall/back-wall seam, wall band only.

// Mirrors of the CSS 3D constants in .room-scene--free/.room-wall-back/
// .room-floor (style.css) — perspective distance, the perspective-origin's
// y%, and the wall/floor connection depth (both in cqmin, so their ratio
// is resolution- and aspect-independent). Kept here only to derive
// FLOOR_HINGE_PCT below; if those CSS values change, update these to match.
const CSS_PERSPECTIVE = 78;
const CSS_ORIGIN_Y_PCT = 30;
const CSS_WALL_DEPTH = 28;

// Where the wall base *actually* renders on screen (as a % of room height),
// derived from the CSS perspective math above, rather than reusing
// ROOM_HORIZON (62%) directly. ROOM_HORIZON is a *data* threshold — where
// the flat, unprojected 0-100 coordinate space splits wall from floor —
// not a screen position; projecting a point at that data-height through
// the real 3D transform lands it here instead, closer to mid-screen. Using
// 62% as if it were the visual seam (as projectFloor() briefly did) walked
// the player and every floor prop noticeably below the wall's actual base,
// reading as "can't reach the wall" and as a dead strip of empty floor.
const FLOOR_HINGE_PCT = CSS_ORIGIN_Y_PCT
  + (ROOM_HORIZON - CSS_ORIGIN_Y_PCT) * (CSS_PERSPECTIVE / (CSS_PERSPECTIVE + CSS_WALL_DEPTH));

// Sorts a flat (x, y) percentage into a plane ('wall-side' | 'wall-back' |
// 'floor') plus that plane's own *local* left/top percentages. Wall-side
// items (x < ROOM_CORNER) get their x rescaled from [0, ROOM_CORNER) to
// [0, 100) so they spread across that wall's full physical depth instead of
// clustering in a sliver; wall-back items keep x as-is (a plain subset of
// the wall's full width, leaving breathing room near the corner where
// perspective foreshortening is steepest). Every wall item's y rescales
// from [0, ROOM_HORIZON) to [0, 100) — 0 at the ceiling line, 100 at the
// floor line — which is what keeps interactive fixtures (terminals, doors,
// monitor banks) sitting at roughly head height rather than crouched at
// the very bottom or lost near the ceiling. Floor items rescale y from
// [ROOM_HORIZON, 100] to [0, 100] as depth (0 = far, right at the wall
// base; 100 = nearest the camera), x passing through unchanged.
function classify(x, y) {
  if (y < ROOM_HORIZON) {
    const ly = (y / ROOM_HORIZON) * 100;
    if (x < ROOM_CORNER) return { plane: 'wall-side', lx: (x / ROOM_CORNER) * 100, ly };
    return { plane: 'wall-back', lx: x, ly };
  }
  const ly = ((Math.min(y, 100) - ROOM_HORIZON) / (100 - ROOM_HORIZON)) * 100;
  return { plane: 'floor', lx: x, ly };
}

// Converts an arbitrary (x, y) click/walk target into a point the player
// can actually stand on: always the floor plane, at that x, and at y
// clamped up to ROOM_HORIZON — so a target inside the wall band (a
// wall-mounted hotspot, or an open-floor click that landed on the wall's
// on-screen area) resolves to the floor point right at that wall's base
// instead of walking the player into the wall itself.
function floorTarget(x, y) {
  return { x, y: Math.max(y, ROOM_HORIZON) };
}

// Projects a floor-local (lx, ly) — lx 0-100 across the room, ly 0-100 in
// depth (0 = far, right at the wall base; 100 = nearest the camera) — onto
// the room's own flat screen percentages, plus a --depth-scale factor.
// Sprites standing on the floor (the player, floor decor/hotspots, the
// speech bubble) are plain 2D elements positioned by this, layered over
// the real 3D wall/floor planes, rather than living inside the floor
// plane's own rotateX(90deg) transform: a canvas nested two rotate()s deep
// under a shared `perspective` doesn't reliably paint (confirmed — an
// ordinary div in the same spot renders fine, a <canvas> there doesn't, in
// every engine this was tried in), so this hand-tuned perspective
// approximation gets the same "nearer = bigger, lower, more spread out"
// read without ever putting a canvas inside a 3D transform.
function projectFloor(lx, ly) {
  // spread/scale are deliberately gentler than a literal perspective
  // projection would be: several sectors place floor props as little as a
  // few percent apart (fine under the old flat, unscaled layout), and a
  // sharper convergence toward the vanishing point packed those neighbors
  // close enough on screen to shadow each other's clicks. This keeps a
  // real "nearer/bigger, farther/smaller" read without recreating that.
  const t = Math.max(0, Math.min(1, ly / 100));
  const scale = 0.62 + 0.65 * t;
  const spread = 0.5 + 0.5 * t;
  const yPct = FLOOR_HINGE_PCT + (t ** 1.6) * (100 - FLOOR_HINGE_PCT);
  const xPct = 50 + (lx - 50) * spread;
  return { xPct, yPct, scale };
}

// Inverts projectFloor() — given a click position in screen percentages
// (relative to the room box), returns the world (x, y) — the same flat
// coordinate space every hotspot/decor table already uses — whose floor
// projection lands back on that exact screen point. Without this, the
// open-floor click handler below fed a raw screen-space percentage into
// walkToXY() as if it were already a world coordinate, so projectFloor()
// (a nonlinear perspective transform) projected it a *second* time,
// landing the player somewhere other than where the click actually was —
// worse the further off-center the click, since both the depth curve and
// the depth-based x-spread below are nonlinear.
function screenToWorld(xPctScreen, yPctScreen) {
  // projectFloor() raises the depth fraction to the 1.6 power on the way
  // out (rawT here IS that t**1.6), so recovering the depth fraction
  // itself — not just rawT — needs the matching root; skipping this is
  // the difference between "close" and "exact" everywhere except the two
  // depth extremes (t=0 or t=1), where the power doesn't move the value.
  const rawT = Math.max(0, Math.min(1, (yPctScreen - FLOOR_HINGE_PCT) / (100 - FLOOR_HINGE_PCT)));
  const t = rawT ** (1 / 1.6);
  const spread = 0.5 + 0.5 * t;
  const worldX = 50 + (xPctScreen - 50) / spread;
  const worldY = ROOM_HORIZON + t * (100 - ROOM_HORIZON);
  return { x: worldX, y: worldY };
}

// Creates a walkable room: a `position:relative` box (room-scene--free) that
// fills its half of the split-scene layout. Returns an API for scattering
// decor, placing/removing clickable hotspots, walking the player between
// them, popping a bubble of options next to the player, and showing a
// visual inventory overlay. `accent` tints the player sprite and bubble
// border to match the sector's color. Clicking anywhere in the room that
// isn't a hotspot or an open popup just walks the player there.
export function createRoom({ accent = '#39ff14', ariaLabel = 'Room' } = {}) {
  const roomEl = el('div', { class: 'room-scene room-scene--free', style: `--accent:${accent}`, role: 'group', 'aria-label': ariaLabel });

  // The two wall faces are real 3D planes (see style.css) with their own
  // item layer each; setDecor()/setHotspot() route wall-mounted items into
  // whichever one classify() picks, and those genuinely live inside the
  // rotated plane. The floor face is background-only (see projectFloor()
  // above for why) — everything standing on it renders instead in
  // floorSprites, a flat 2D layer. Each face gets `perspective` straight
  // from .room-scene--free (no shared preserve-3d wrapper needed, since
  // nothing here relies on the faces z-sorting against each other — see
  // the .room-layer comment in style.css) so their DOM order can instead
  // be chosen purely for paint/click priority: floorFace (background)
  // first, then floorSprites (furniture, the player) on top of it, then
  // the wall faces last, on top of everything — a floor prop standing
  // close enough to the wall base to visually lap onto it (normal, e.g. a
  // cabinet flush against the wall) must never be able to steal a click
  // meant for a wall-mounted hotspot sitting right behind it.
  const wallSideLayer = el('div', { class: 'room-layer' });
  const wallBackLayer = el('div', { class: 'room-layer' });
  const wallSideFace = el('div', { class: 'room-face room-wall-side' }, [wallSideLayer]);
  const wallBackFace = el('div', { class: 'room-face room-wall-back' }, [wallBackLayer]);
  const floorFace = el('div', { class: 'room-face room-floor' });
  const floorSprites = el('div', { class: 'room-floor-sprites' });
  roomEl.append(floorFace, floorSprites, wallSideFace, wallBackFace);

  const layers = { 'wall-side': wallSideLayer, 'wall-back': wallBackLayer };

  // Player and bubble are floor-plane citizens (positioned from local
  // floor-depth coordinates via projectFloor()), appended once into the
  // flat floorSprites overlay. Initial spot matches playerXY below (50, 8).
  const initialSpot = projectFloor(50, 8);
  const playerWrap = el('div', {
    class: 'room-player',
    style: `left:${initialSpot.xPct}%; top:${initialSpot.yPct}%; --depth-scale:${initialSpot.scale}`,
  });
  const bubbleEl = el('div', { class: 'room-bubble', hidden: true });
  floorSprites.append(playerWrap, bubbleEl);

  // Open-floor click-to-walk, shared by every sector that uses createRoom()
  // instead of each scene file wiring its own copy. Excludes clicks on a
  // hotspot button and on any open popup (box contents, keypads, the
  // inventory overlay) — those are children of roomEl too, so a background
  // click on one would otherwise bubble up here and walk the player at the
  // same moment it closes the popup.
  roomEl.addEventListener('click', (e) => {
    if (e.target.closest('button, .inventory-overlay')) return;
    const rect = roomEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const xPctScreen = ((e.clientX - rect.left) / rect.width) * 100;
    const yPctScreen = ((e.clientY - rect.top) / rect.height) * 100;
    const { x, y } = screenToWorld(xPctScreen, yPctScreen);
    walkToPoint(Math.max(4, Math.min(96, x)), y);
  });

  const hotspots = new Map(); // id -> { x, y, plane, btn }
  let legPhase = 0;
  let walking = false;
  let activeId = null;
  let playerXY = { x: 50, y: 8 }; // floor-local (lx, ly) — matches playerWrap's initial style above

  function drawPlayerFrame() {
    playerWrap.innerHTML = '';
    playerWrap.appendChild(drawPlayer(accent, 6, 'sprite sprite-player', legPhase));
  }
  drawPlayerFrame();

  // Positions `node` at world (x, y): wall items get plain left/top inside
  // their rotated plane's own layer; floor items get projectFloor()'s
  // screen-space left/top plus a --depth-scale custom property, inside the
  // flat floorSprites overlay (see the .room-layer/.room-floor-sprites
  // comments in style.css for why floor items can't just nest in the
  // floor's own 3D transform like wall items do).
  function place(node, modifierBase, x, y) {
    const { plane, lx, ly } = classify(x, y);
    if (plane === 'floor') {
      const { xPct, yPct, scale } = projectFloor(lx, ly);
      node.style.left = `${xPct}%`;
      node.style.top = `${yPct}%`;
      node.style.setProperty('--depth-scale', scale);
      floorSprites.appendChild(node);
    } else {
      node.classList.add(`${modifierBase}--wall`);
      node.style.left = `${lx}%`;
      node.style.top = `${ly}%`;
      layers[plane].appendChild(node);
    }
    return plane;
  }

  // Replaces all background set-dressing. `items` is a list of
  // { x, y, node } as world percentage coordinates (see classify() above).
  // Purely decorative — never clickable, never re-rendered per-interaction,
  // so callers can just set this once at mount.
  function setDecor(items) {
    [...roomEl.querySelectorAll('.room-decor-item')].forEach((n) => n.remove());
    items.forEach(({ x, y, node }) => {
      const wrap = el('div', { class: 'room-decor-item', 'aria-hidden': 'true' }, [node]);
      place(wrap, 'room-decor-item', x, y);
    });
  }

  // Adds (or replaces) a clickable hotspot at world percentage position
  // (x, y). `build()` returns the child nodes to show (sprite + label);
  // `onClick(id)` fires on click/tap. `active` styling is applied whenever
  // this hotspot is the current walk target. Called by each sector's room
  // setup and again whenever a hotspot's own visual needs to change (pass
  // the same id to replace it in place).
  function setHotspot(id, { x, y, build, onClick, label }) {
    const prev = hotspots.get(id);
    if (prev) prev.btn.remove();
    const btn = el('button', {
      class: 'room-hotspot' + (activeId === id ? ' room-hotspot--active' : ''),
      'aria-label': label || id,
      onclick: () => onClick && onClick(id),
    }, build());
    const plane = place(btn, 'room-hotspot', x, y);
    hotspots.set(id, { x, y, plane, btn });
    return btn;
  }

  // Instantly places the player at world (x, y) — clamped onto the floor,
  // same as any walk target (see floorTarget() above) — with no walk
  // animation and no footstep sound, for teleports that aren't a walk at
  // all, like stepping through a door into a whole new room. Called by
  // scenes with more than one room right after rebuilding the new room's
  // hotspots.
  function placeAt(x, y) {
    const t = floorTarget(x, y);
    const { lx, ly } = classify(t.x, t.y);
    playerXY = { x: lx, y: ly };
    const { xPct, yPct, scale } = projectFloor(lx, ly);
    playerWrap.classList.add('room-player--jump');
    playerWrap.style.left = `${xPct}%`;
    playerWrap.style.top = `${yPct}%`;
    playerWrap.style.setProperty('--depth-scale', scale);
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

  // Removes every hotspot at once, and every decor item with it. Called by
  // scenes with more than one room (e.g. level2.js's tech/bio bays) before
  // rebuilding the next room's hotspots — otherwise a hotspot whose id
  // isn't reused by the new room (most of them, room to room) would be
  // left behind: invisible, but still sitting at its old position and
  // still clickable, silently stealing clicks from whatever new hotspot
  // happens to land on top of it. Decor gets the same treatment for the
  // same reason, just visual instead of click-stealing: setDecor() is
  // only ever called by the *some* rooms in a multi-room scene (e.g.
  // level4.js's rooms 1 and 2, not 3 or 4), so without this a room with no
  // decor of its own would silently keep showing whichever earlier room's
  // decor happened to be on screen last — confirmed via Playwright, this
  // was exactly why Sector 3's electrical room (room3) kept auditing as
  // "overlapping a Locker": it was actually still rendering room1's
  // cabinets, 10 of them, that were never cleared on the way out.
  function clearHotspots() {
    hotspots.forEach(({ btn }) => btn.remove());
    hotspots.clear();
    activeId = null;
    [...roomEl.querySelectorAll('.room-decor-item')].forEach((n) => n.remove());
  }

  // Shared walk animation: interpolates the player to world (x, y) —
  // resolved onto the floor plane exactly like any walk target (see
  // floorTarget() above), so a wall-mounted hotspot's own (x, y) walks the
  // player up to the floor point at that wall's base rather than into the
  // wall — with the real 2-frame leg-cycle animation (a footstep tick
  // alternates legPhase and redraws the sprite, in sync with sfx.walk()),
  // resolving once the CSS transition ends. A no-op (resolves immediately)
  // if already walking or already there. Used by both walkTo() (a named
  // hotspot) and walkToPoint() (an arbitrary click on open floor).
  function walkToXY(x, y) {
    return new Promise((resolve) => {
      if (walking) { resolve(); return; }
      const t = floorTarget(x, y);
      const { lx, ly } = classify(t.x, t.y);
      const dx = lx - playerXY.x;
      const dy = ly - playerXY.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { resolve(); return; }

      walking = true;
      playerWrap.classList.add('room-player--walking');
      if (dx < 0) playerWrap.classList.add('room-player--flip'); else playerWrap.classList.remove('room-player--flip');
      const footstep = setInterval(() => {
        legPhase = legPhase ? 0 : 1;
        drawPlayerFrame();
        sfx.walk();
      }, FOOTSTEP_MS);

      playerXY = { x: lx, y: ly };
      const { xPct, yPct, scale } = projectFloor(lx, ly);
      playerWrap.style.left = `${xPct}%`;
      playerWrap.style.top = `${yPct}%`;
      playerWrap.style.setProperty('--depth-scale', scale);

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
    const { xPct, yPct } = projectFloor(playerXY.x, playerXY.y);
    bubbleEl.style.left = `${xPct}%`;
    bubbleEl.style.top = `${yPct}%`;
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

  // Nudges apart any decor/hotspot whose actually-rendered boxes overlap,
  // pooling all three layers (wall-side, wall-back, floor) into one pass
  // rather than checking each in isolation — the recurring "x/y nudged
  // from its original N" fixes across every sector file were *cross-layer*
  // collisions (a floor prop reaching up into a wall fixture's screen
  // area, e.g. Sector 0's cabinet vs. the terminal above it), which two
  // same-layer-only passes would never even compare against each other.
  // Reads real getBoundingClientRect() boxes instead of assumed sprite
  // sizes (sprites.js's canvas sizes aren't known here), so this keeps
  // working if sprite sizes change later instead of rotting like
  // hand-picked coordinates do. Call once after a room's hotspots/decor
  // for a given screen are all in place.
  function declutter() {
    requestAnimationFrame(() => {
      // Each item's `left:%` is resolved against its OWN layer's local
      // (pre-3D-transform) box width, not the screen-projected width
      // getBoundingClientRect() would report for a rotated wall face —
      // those two differ a lot for the side wall specifically (rotateY
      // foreshortens it hard), so nudging via the wrong one would send an
      // item flying by a wildly wrong amount. offsetWidth is unaffected by
      // CSS transforms, so it's the right basis for every layer, floor
      // included (where it's also just the room's own on-screen width,
      // since the floor layer isn't transformed at all).
      const layers = [wallSideLayer, wallBackLayer, floorSprites];
      const items = [];
      layers.forEach((layer) => {
        const localWidth = layer.offsetWidth;
        if (!localWidth) return;
        [...layer.children].forEach((node) => {
          if (node.classList.contains('room-decor-item') || node.classList.contains('room-hotspot')) {
            items.push({ node, localWidth });
          }
        });
      });
      if (items.length < 2) return;

      const PAD = 6; // px of screen-space breathing room to leave between boxes
      // TOLERANCE_FRAC matches auditOverlaps()'s own default exactly, on
      // purpose: "converged" here needs to mean the same thing as "passes
      // the audit" there, or this loop could exit early on a metric that
      // doesn't actually correspond to what gets checked afterward.
      const TOLERANCE_FRAC = 0.1;
      // Hard cap only — the real exit is the convergence check below.
      // Measured, not guessed: Sector 0's most stubborn 3-way squeeze (a
      // locker sandwiched between two neighbors, force-pushed by both) was
      // still above TOLERANCE_FRAC at 60 passes, converged cleanly by 120,
      // and held there through 300 — genuine slow convergence, not a stuck
      // cycle (contrast the tank/door case in level3.js, which stayed at
      // literally the same overlap% from 60 through 600 passes and needed
      // an actual placement fix instead, precisely because it wasn't this
      // kind of case).
      const MAX_PASSES = 120;
      // Fraction of each pass's computed correction to actually apply. Any
      // item squeezed between two neighbors on opposite sides (three floor
      // props in a row is common set dressing) gets pushed toward each one
      // by a full, independently-computed "close this gap" amount every
      // pass — measured (not assumed): pushing the full amount put such a
      // trio into a stable back-and-forth cycle that never settled, even
      // given 30 passes, since each pass's fix for one side re-opened the
      // other. Damping every push to a fraction of that amount stops the
      // overshoot that drives the cycle, so the (still slightly
      // conflicting) net pushes each neighbor received keep accumulating
      // in the same direction pass over pass instead of cancelling out.
      const RELAXATION = 0.5;
      const nudge = (item, pushPx) => {
        const current = parseFloat(item.node.style.left) || 0;
        const deltaPct = (pushPx / item.localWidth) * 100;
        item.node.style.left = `${Math.max(2, Math.min(98, current + deltaPct))}%`;
      };
      let lastUnresolved = [];
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const rects = items.map((it) => it.node.getBoundingClientRect());
        // worstFrac is measured against the *actual* overlap (no PAD) —
        // the same geometry auditOverlaps() checks — while the push below
        // still triggers PAD early, so a room can keep tightening its
        // margin even after every pair is already under TOLERANCE_FRAC.
        // Tracking this per pass (instead of trusting a fixed pass count
        // to have been "enough") is what catches a room that's still
        // genuinely overlapping when the loop runs out, rather than
        // silently shipping it — see the unresolved-pairs warning below.
        let worstFrac = 0;
        const unresolved = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = rects[i]; const b = rects[j];
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapX > 0 && overlapY > 0) {
              const smallerArea = Math.min(a.width * a.height, b.width * b.height);
              const frac = smallerArea > 0 ? (overlapX * overlapY) / smallerArea : 0;
              if (frac > worstFrac) worstFrac = frac;
              if (frac > TOLERANCE_FRAC) {
                unresolved.push({
                  a: items[i].node.getAttribute('aria-label') || items[i].node.className,
                  b: items[j].node.getAttribute('aria-label') || items[j].node.className,
                  pct: Math.round(frac * 100),
                });
              }
            }
            if (overlapX + PAD <= 0 || overlapY + PAD <= 0) continue;
            const push = ((overlapX + PAD) / 2) * RELAXATION;
            const dir = (a.left + a.width / 2) <= (b.left + b.width / 2) ? -1 : 1;
            nudge(items[i], dir * push);
            nudge(items[j], -dir * push);
          }
        }
        lastUnresolved = unresolved;
        if (worstFrac <= TOLERANCE_FRAC) break; // every pair is at or under the audit's own bar
      }
      if (lastUnresolved.length > 0) {
        // Deliberately not silent: a room that hits MAX_PASSES still
        // overlapping is either a harder convergence case than this loop
        // budget covers, or genuine overcrowding (too many props hand-
        // placed too close for the available space, e.g. rows stacked
        // closer together in Y than X-only nudging can ever compensate
        // for) — either way that's a real, visible signal, not something
        // to ship quietly.
        console.warn(`[roomKit declutter] ${lastUnresolved.length} pair(s) still overlap past ${Math.round(TOLERANCE_FRAC * 100)}% after ${MAX_PASSES} passes: ${JSON.stringify(lastUnresolved)}`);
      }
    });
  }

  return {
    el: roomEl, setDecor, setHotspot, removeHotspot, clearHotspots, walkTo, walkToPoint, placeAt, showBubble, hideBubble, getActive, isWalking, declutter,
  };
}

// Measures every decor/hotspot's real rendered rect and returns any pair
// whose boxes actually intersect by more than toleranceFrac of the
// smaller box's area. This is a stricter, different check than an
// elementFromPoint center-hit test — a pair can pass that test (neither
// center covered) while still failing this one (meaningful visual
// overlap). Both checks matter; only this one catches partial overlap.
export function auditOverlaps(roomEl, { toleranceFrac = 0.1 } = {}) {
  const items = [...roomEl.querySelectorAll('.room-decor-item, .room-hotspot')];
  const rects = items.map((n) => ({ node: n, label: n.getAttribute('aria-label') || '?', rect: n.getBoundingClientRect() }));
  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].rect; const b = rects[j].rect;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox <= 0 || oy <= 0) continue;
      const overlapArea = ox * oy;
      const smallerArea = Math.min(a.width * a.height, b.width * b.height);
      const frac = overlapArea / smallerArea;
      if (frac > toleranceFrac) hits.push({ a: rects[i].label, b: rects[j].label, frac: Math.round(frac * 100) });
    }
  }
  return hits;
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
