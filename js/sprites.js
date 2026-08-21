// Tiny hand-built "pixel art" drawn on <canvas> with plain rectangles.
// No image assets. Everything here is generated at runtime so the whole
// game ships as text files. Each draw* function below returns a canvas
// element ready to append to the DOM. Scene files (title.js, level1..
// level5.js, ending.js) and sceneManager.js's status bar call these to
// place the player, items, doors, and other room objects.

const BG = '#0a0e12';

// Returns a `b(gx, gy, gw, gh, color)` helper bound to a canvas context,
// letting each draw* function below paint pixel-grid rectangles by grid
// coordinates instead of raw pixels. Called once per drawing function.
function grid(ctx, unit) {
  return (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(gx * unit), Math.round(gy * unit), Math.round(gw * unit), Math.round(gh * unit));
  };
}

// Creates a sized <canvas> with a 2d context ready for pixel-art drawing
// (smoothing disabled). Called by every draw* function to set up its canvas
// before painting sprite pixels onto it.
function makeCanvas(cols, rows, unit, className) {
  const canvas = document.createElement('canvas');
  canvas.width = cols * unit;
  canvas.height = rows * unit;
  canvas.className = className || '';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

// Draws the small ghost sprite used as ECHO's avatar. Called by title.js and
// ending.js.
export function drawGhost(color = '#7cf9d0', unit = 8, className = 'sprite sprite-ghost') {
  const { canvas, ctx } = makeCanvas(16, 16, unit, className);
  const b = grid(ctx, unit);
  b(6, 2, 4, 1, color);
  b(4, 3, 8, 1, color);
  b(3, 4, 10, 1, color);
  b(2, 5, 12, 7, color);
  b(2, 12, 3, 1, color);
  b(6, 12, 3, 1, color);
  b(10, 12, 3, 1, color);
  // eyes (cut out to background colour so they read as dark sockets)
  b(5, 7, 2, 2, BG);
  b(9, 7, 2, 2, BG);
  return canvas;
}

// Draws the floppy disk sprite shown on the title screen. Called by
// title.js.
export function drawFloppy(accent = '#4cd6ff', unit = 8, className = 'sprite sprite-floppy') {
  const { canvas, ctx } = makeCanvas(16, 16, unit, className);
  const b = grid(ctx, unit);
  const body = '#8892a6';
  const metal = '#c9d3e0';
  const label = '#eef3f8';
  b(1, 1, 14, 14, body);
  b(13, 1, 2, 2, BG); // clipped corner
  b(3, 2, 9, 5, label);
  b(3, 4, 9, 1, accent);
  b(3, 9, 10, 5, metal);
  b(4, 10, 2, 2, BG);
  b(1, 13, 2, 2, BG);
  return canvas;
}

// Draws the memory-shard collectible sprite. Called by scenes/shared.js's
// showInterstitial (awarded per level) and level5.js's shard case display.
export function drawShard(color = '#b967ff', unit = 8, className = 'sprite sprite-shard') {
  const { canvas, ctx } = makeCanvas(10, 9, unit, className);
  const b = grid(ctx, unit);
  b(4, 0, 2, 1, color);
  b(3, 1, 4, 1, color);
  b(2, 2, 6, 1, color);
  b(1, 3, 8, 1, color);
  b(0, 4, 10, 1, color);
  b(1, 5, 8, 1, color);
  b(2, 6, 6, 1, color);
  b(3, 7, 4, 1, color);
  b(4, 8, 2, 1, color);
  ctx.globalAlpha = 0.55;
  b(3, 2, 2, 2, '#ffffff');
  ctx.globalAlpha = 1;
  return canvas;
}

// Draws the keycard item sprite. Called by level1.js once the drawer is
// opened and the keycard is picked up.
export function drawKeycard(accent = '#39ff14', unit = 8, className = 'sprite sprite-keycard') {
  const { canvas, ctx } = makeCanvas(14, 9, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 14, 9, '#1c2733');
  b(0, 0, 14, 1, '#33475c');
  b(1, 2, 12, 2, BG);
  b(2, 5, 3, 3, accent);
  return canvas;
}

// Draws a door sprite, colored red/locked or green/open based on `locked`.
// Called by level1.js, level3.js, and level4.js for their respective exit
// doors and vault.
export function drawDoor(locked = true, unit = 8, className = 'sprite sprite-door') {
  const { canvas, ctx } = makeCanvas(12, 14, unit, className);
  const b = grid(ctx, unit);
  const frame = '#3a4750';
  const panel = locked ? '#241a1a' : '#16241c';
  const glow = locked ? '#ff4d5e' : '#39ff14';
  b(0, 0, 12, 14, frame);
  b(1, 1, 10, 12, panel);
  b(6, 1, 1, 12, frame); // seam down the middle
  b(8, 6, 2, 3, '#0a0e12'); // keypad housing
  b(8, 7, 1, 1, glow); // status light
  return canvas;
}

// Draws the desk drawer sprite, shut or open (revealing the keycard).
// Called by level1.js.
export function drawDrawer(open = false, unit = 8, className = 'sprite sprite-drawer') {
  const { canvas, ctx } = makeCanvas(14, 10, unit, className);
  const b = grid(ctx, unit);
  const wood = '#5a4632';
  const woodDark = '#3d2f20';
  b(0, 0, 14, 4, wood);
  b(1, 4, 12, 6, woodDark);
  if (open) {
    b(1, 4, 12, 2, '#100a05');
    b(5, 2, 4, 2, '#39ff14');
  } else {
    b(5, 6, 4, 1, '#8a7355');
  }
  return canvas;
}

// Draws the room terminal sprite. Called by level1.js's room diorama.
export function drawTerminal(unit = 8, className = 'sprite sprite-terminal') {
  const { canvas, ctx } = makeCanvas(12, 10, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 12, 9, '#20303d');
  b(1, 1, 10, 6, '#0a0e12');
  b(2, 2, 6, 1, '#39ff14');
  b(2, 4, 4, 1, '#39ff14');
  b(4, 9, 4, 1, '#3a4750');
  return canvas;
}

// Draws the player character sprite, tinted with the current sector's
// accent color. Called by sceneManager.js's status bar and by every level
// scene to mark the player's position in its room diorama. `legPhase` (0 or
// 1) alternates which leg is forward, giving roomKit.js's walkTo() a real
// 2-frame walk cycle when it swaps the sprite each footstep tick, instead of
// a single static pose sliding across the room.
export function drawPlayer(accent = '#39ff14', unit = 8, className = 'sprite sprite-player', legPhase = 0) {
  const { canvas, ctx } = makeCanvas(10, 16, unit, className);
  const b = grid(ctx, unit);
  const suit = '#2b3a45';
  const suitDark = '#1c262e';
  const skin = '#e8c9a0';
  const boot = '#0a0e12';
  b(3, 0, 4, 3, skin);
  b(3, 1, 4, 1, accent); // visor band, tinted per sector
  b(2, 3, 6, 6, suit);
  b(2, 3, 6, 1, suitDark);
  b(4, 5, 2, 2, accent); // chest light
  b(1, 4, 1, 4, suit);
  b(8, 4, 1, 4, suit);
  const lead = legPhase ? 1 : 0;
  b(3 - lead * 0.5, 9, 2, 5, suitDark);
  b(5 + lead * 0.5, 9, 2, 5, suitDark);
  b(2 - lead, 14, 3, 2, boot);
  b(5 + lead, 14, 3, 2, boot);
  return canvas;
}

// Draws the vault padlock sprite. Called by level4.js's vault status badge.
export function drawPadlock(accent = '#00ff9c', unit = 8, className = 'sprite sprite-padlock') {
  const { canvas, ctx } = makeCanvas(12, 12, unit, className);
  const b = grid(ctx, unit);
  b(3, 0, 6, 1, accent);
  b(2, 1, 1, 3, accent);
  b(9, 1, 1, 3, accent);
  b(1, 5, 10, 7, '#20303d');
  b(1, 5, 10, 1, accent);
  b(5, 8, 2, 3, BG);
  return canvas;
}

// ---- action-indicator icons: shown briefly near the player sprite when
// look/inventory/hint fire, so the room visual reacts to non-physical
// actions too. Called by level1.js's playActionIcon().

export function drawMagnifier(accent = '#39ff14', unit = 8, className = 'sprite sprite-icon') {
  const { canvas, ctx } = makeCanvas(9, 9, unit, className);
  const b = grid(ctx, unit);
  b(1, 1, 5, 1, accent);
  b(0, 2, 1, 3, accent);
  b(6, 2, 1, 3, accent);
  b(1, 5, 5, 1, accent);
  b(6, 6, 1, 1, accent);
  b(7, 7, 2, 2, accent);
  return canvas;
}

export function drawBackpack(accent = '#39ff14', unit = 8, className = 'sprite sprite-icon') {
  const { canvas, ctx } = makeCanvas(9, 9, unit, className);
  const b = grid(ctx, unit);
  b(2, 0, 5, 1, accent);
  b(1, 1, 7, 7, '#20303d');
  b(1, 1, 7, 1, accent);
  b(3, 3, 3, 2, accent);
  b(1, 7, 7, 1, accent);
  return canvas;
}

export function drawLightbulb(accent = '#ffd166', unit = 8, className = 'sprite sprite-icon') {
  const { canvas, ctx } = makeCanvas(9, 9, unit, className);
  const b = grid(ctx, unit);
  b(3, 0, 3, 1, accent);
  b(2, 1, 5, 4, accent);
  b(3, 5, 3, 1, '#20303d');
  b(3, 6, 3, 1, accent);
  b(3, 7, 3, 1, accent);
  ctx.globalAlpha = 0.5;
  b(3, 2, 1, 1, '#ffffff');
  ctx.globalAlpha = 1;
  return canvas;
}

// ---- room-decor props: small reusable set-dressing sprites, each sector
// combines a few of these with its own accent color so Sectors 0-3 read as
// distinct rooms rather than the same panel recolored.

// A wall-mounted clue tag: used both as generic shelf/rack decor and (in
// level4.js) as the "unrevealed" state of a vault clue-card hotspot.
export function drawClueTag(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 8, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 10, 8, '#161f1a');
  b(0, 0, 10, 1, accent);
  b(1, 2, 6, 1, '#3a4750');
  b(1, 4, 4, 1, '#3a4750');
  b(0, 7, 10, 1, accent);
  return canvas;
}

// A small wall shelf/monitor rack. Sector 0 decor.
export function drawShelf(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(14, 6, unit, className);
  const b = grid(ctx, unit);
  b(0, 4, 14, 2, '#3d2f20');
  b(1, 0, 4, 4, '#20303d');
  b(2, 1, 2, 1, accent);
  b(7, 1, 5, 2, '#1c2733');
  b(9, 2, 1, 2, accent);
  return canvas;
}

// Arcade cabinet prop. Sector 1 decor.
export function drawArcadeCabinet(accent = '#ff2fd0', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 16, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 10, 16, '#2a1a33');
  b(1, 1, 8, 5, '#0a0e12');
  b(2, 2, 6, 3, accent);
  b(0, 6, 10, 1, accent);
  b(2, 8, 6, 3, '#3a2440');
  b(3, 9, 1, 1, accent);
  b(6, 9, 1, 1, accent);
  return canvas;
}

// Wall conduit/pipe with warning stripe. Sector 2 decor.
export function drawConduit(accent = '#ffb000', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(14, 6, unit, className);
  const b = grid(ctx, unit);
  b(0, 1, 14, 3, '#2a2210');
  b(0, 2, 14, 1, accent);
  for (let x = 0; x < 14; x += 4) b(x, 0, 2, 1, accent);
  b(6, 4, 2, 2, '#151007');
  return canvas;
}

// Security camera prop. Sector 3 decor.
export function drawVaultCam(accent = '#00ff9c', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 8, unit, className);
  const b = grid(ctx, unit);
  b(0, 2, 7, 4, '#20303d');
  b(6, 3, 3, 2, '#0a0e12');
  b(8, 3, 2, 2, accent);
  b(2, 0, 2, 2, '#3a4750');
  return canvas;
}

// ---- Sector 0 room props: cabinets/lockers/lab clutter used to fill the
// server-closet-turned-lab room now that its visual half covers the whole
// screen. Also reused as generic background dressing by later sectors.

// A storage box/crate, shut or lid-open (revealing whatever is inside via
// `contents`, drawn by the caller on top). Sector 0's keycard container.
export function drawBox(open = false, unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(12, 10, unit, className);
  const b = grid(ctx, unit);
  const card = '#8a6a3a';
  const cardDark = '#5e4626';
  if (open) {
    b(0, 4, 12, 6, cardDark);
    b(1, 5, 10, 4, '#100a05');
    b(0, 1, 2, 4, card);
    b(10, 1, 2, 4, card);
  } else {
    b(0, 3, 12, 7, card);
    b(0, 3, 12, 2, cardDark);
    b(5, 3, 2, 7, cardDark);
  }
  return canvas;
}

// Tall metal cabinet/locker bank. `doors` (2 or 3) varies its width slightly.
export function drawCabinet(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor', doors = 2) {
  const w = doors * 5;
  const { canvas, ctx } = makeCanvas(w, 18, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, w, 18, '#2a333a');
  for (let i = 0; i < doors; i++) {
    const x = i * 5;
    b(x + 0.5, 1, 4, 15.5, '#1c262e');
    b(x + 3.5, 8, 0.7, 2, accent);
  }
  return canvas;
}

// A single tall locker, optionally hanging open (cracked, empty inside).
export function drawLocker(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor', open = false) {
  const { canvas, ctx } = makeCanvas(6, 16, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 6, 16, '#2a333a');
  if (open) {
    b(0.5, 1, 5, 14, '#05070a');
    b(4, 3, 1.5, 10, '#1c262e');
  } else {
    b(0.5, 1, 5, 14, '#1c262e');
    b(4, 7, 0.6, 2, accent);
  }
  return canvas;
}

// A sci-fi desk console: sloped panel with glowing readouts.
export function drawSciDesk(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(16, 8, unit, className);
  const b = grid(ctx, unit);
  b(0, 5, 16, 3, '#20303d');
  b(1, 1, 14, 4, '#161f1a');
  b(2, 2, 4, 1, accent);
  b(2, 4, 3, 1, accent);
  b(9, 2, 5, 2, '#0a0e12');
  b(10, 2.5, 1, 1, accent);
  return canvas;
}

// Lab flask/beaker cluster. Sector 0/Sector 3-lab decor.
export function drawLabFlask(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 9, unit, className);
  const b = grid(ctx, unit);
  b(3, 0, 2, 3, '#3a4750');
  b(1, 3, 6, 5, '#1c2733');
  b(2, 4, 4, 3, accent);
  ctx.globalAlpha = 0.5;
  b(2, 4, 4, 1, '#ffffff');
  ctx.globalAlpha = 1;
  b(0, 8, 8, 1, '#0a0e12');
  return canvas;
}

// Ceiling/wall light fixture, tinted with the sector accent.
export function drawWallLight(accent = '#ffd166', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 4, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 10, 1, '#3a4750');
  b(1, 1, 8, 2, accent);
  ctx.globalAlpha = 0.4;
  b(0, 3, 10, 1, accent);
  ctx.globalAlpha = 1;
  return canvas;
}

// A small closet-room door (distinct from the main sector exit door), open
// or shut. Sector 0's terminal alcove.
export function drawClosetDoor(open = false, unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 14, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 10, 14, '#3a4750');
  if (open) {
    b(1, 1, 8, 13, '#05070a');
  } else {
    b(1, 1, 8, 13, '#1c262e');
    b(7, 7, 1, 1, '#ffd166');
  }
  return canvas;
}

// A potted plant. Generic background dressing across sectors.
export function drawPlantProp(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 10, unit, className);
  const b = grid(ctx, unit);
  const pot = '#5a4632';
  const leaf = '#2f9e5b';
  b(2, 7, 4, 3, pot);
  b(3, 3, 2, 5, leaf);
  b(0, 2, 4, 3, leaf);
  b(4, 1, 4, 3, leaf);
  b(1, 5, 3, 2, leaf);
  return canvas;
}

// A stack of crates. Generic background dressing across sectors.
export function drawCrateStack(accent = '#8a6a3a', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 9, unit, className);
  const b = grid(ctx, unit);
  const dark = '#5e4626';
  b(0, 5, 5, 4, accent);
  b(0, 5, 5, 1, dark);
  b(5, 4, 5, 5, accent);
  b(5, 4, 5, 1, dark);
  b(1, 0, 4, 4, accent);
  b(1, 0, 4, 1, dark);
  return canvas;
}

// A bank of small wall monitors, all dark save a faint scanline glow.
export function drawMonitorBank(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(14, 6, unit, className);
  const b = grid(ctx, unit);
  for (let i = 0; i < 3; i++) {
    const x = i * 4.6;
    b(x, 0, 4, 6, '#20303d');
    b(x + 0.5, 0.5, 3, 5, '#0a0e12');
    ctx.globalAlpha = 0.5;
    b(x + 0.5, 2.5, 3, 0.5, accent);
    ctx.globalAlpha = 1;
  }
  return canvas;
}

// A ceiling/floor vent grille.
export function drawVentProp(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 6, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 10, 6, '#3a4750');
  for (let x = 1; x < 10; x += 2) b(x, 0.5, 1, 5, '#1c262e');
  return canvas;
}

// ---- Sector 1 room props: damaged tech-bay/bio-bay dressing ----

// A severed wire with an exposed, sparking end. The spark itself is a
// separate CSS-animated overlay (see .spark-wire in style.css) layered on
// top by the caller, so this just draws the dangling cable.
export function drawSparkWire(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 10, unit, className);
  const b = grid(ctx, unit);
  const wire = '#2a2220';
  const copper = '#c98a4a';
  b(4, 0, 2, 6, wire);
  b(3, 6, 1, 2, wire);
  b(6, 6, 1, 2, wire);
  b(4, 8, 1, 1, copper);
  b(6, 8, 1, 1, copper);
  return canvas;
}

// A cracked glass containment pod, tinted per room (amber/rust for the
// tech bay's damaged pods, green/blue for the bio bay's tanks).
export function drawGlassPod(accent = '#4cd6ff', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 14, unit, className);
  const b = grid(ctx, unit);
  b(1, 0, 8, 13, '#20303d');
  ctx.globalAlpha = 0.35;
  b(2, 2, 6, 9, accent);
  ctx.globalAlpha = 1;
  // crack lines
  b(4, 1, 1, 4, '#0a0e12');
  b(3, 5, 1, 3, '#0a0e12');
  b(6, 3, 1, 5, '#0a0e12');
  b(0, 12, 10, 2, '#3a4750');
  return canvas;
}

// A dead, damaged terminal — decorative only, distinct from the one
// working terminal in the room (drawGoodTerminal below).
export function drawBrokenTerminal(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(12, 10, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 12, 9, '#20303d');
  b(1, 1, 10, 6, '#05070a');
  b(2, 2, 5, 1, '#3a4750');
  b(2, 4, 3, 1, '#3a4750');
  b(7, 3, 3, 3, '#1c262e');
  b(4, 9, 4, 1, '#3a4750');
  return canvas;
}

// The one terminal in the room that still works: a solid frame with a
// bright screen tinted `accent` (pink or blue depending on the room). The
// screen's static<->color flicker is a CSS animation on the caller's
// wrapper (see .flicker-terminal), not drawn here; `solved` swaps in a
// steady glow plus 2 status dots once its minigame has been cleared,
// mirroring drawArcadeCabinet's look.
export function drawGoodTerminal(accent = '#ff2fd0', unit = 8, className = 'sprite sprite-decor', solved = false) {
  const { canvas, ctx } = makeCanvas(14, 12, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 14, 11, '#20303d');
  b(1, 1, 12, 7, solved ? accent : '#05070a');
  if (!solved) {
    ctx.globalAlpha = 0.6;
    b(2, 2, 9, 1, accent);
    b(2, 4, 6, 1, accent);
    b(2, 6, 4, 1, accent);
    ctx.globalAlpha = 1;
  }
  b(5, 11, 4, 1, '#3a4750');
  if (solved) {
    b(4, 9, 1, 1, '#05070a');
    b(9, 9, 1, 1, '#05070a');
  }
  return canvas;
}

// A large aquarium tank — glass frame, tinted water, a rock pile, coral,
// driftwood, and seaweed, but deliberately no creatures. Sector 2 decor.
export function drawAquariumTank(accent = '#2f9e5b', unit = 10, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(18, 22, unit, className);
  const b = grid(ctx, unit);
  const frame = '#3a4750';
  const water = accent;
  const rock = '#4a4438';
  const rockDark = '#332e26';
  const coral = '#ff6f91';
  const wood = '#5a4632';
  b(0, 0, 18, 22, frame);
  ctx.globalAlpha = 0.3;
  b(1, 1, 16, 19, water);
  ctx.globalAlpha = 1;
  b(1, 17, 16, 3, rock);
  b(1, 17, 16, 1, rockDark);
  b(3, 14, 3, 3, rockDark);
  b(11, 15, 4, 2, rockDark);
  // driftwood
  b(6, 11, 1, 6, wood);
  b(7, 12, 3, 1, wood);
  b(6, 12, 1, 1, wood);
  // coral branches
  b(13, 12, 1, 5, coral);
  b(14, 10, 1, 3, coral);
  b(12, 10, 1, 2, coral);
  // seaweed
  ctx.globalAlpha = 0.85;
  b(3, 8, 1, 9, '#2f9e5b');
  b(4, 10, 1, 7, '#2f9e5b');
  b(15, 13, 1, 4, '#2f9e5b');
  ctx.globalAlpha = 1;
  return canvas;
}

// ---- Sector 3 room props: file storage / security / electrical / lab ----

// A torn poster pinned to a bulletin board. `hasClue` swaps in a bright
// torn corner (about to fall out) — purely a color cue for us, the click
// handler decides what actually happens.
export function drawPoster(accent = '#00ff9c', unit = 6, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 10, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 8, 10, '#e8e2d0');
  ctx.globalAlpha = 0.5;
  b(1, 1, 6, 3, accent);
  b(1, 5, 5, 1, '#2a2220');
  b(1, 7, 4, 1, '#2a2220');
  ctx.globalAlpha = 1;
  b(6, 8, 2, 2, '#0a0e12'); // torn corner
  return canvas;
}

// A tall paper pile, leaning slightly.
export function drawPaperPile(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(10, 8, unit, className);
  const b = grid(ctx, unit);
  const paper = '#c9c2a8';
  for (let i = 0; i < 5; i++) b(0.5 + (i % 2) * 0.3, 8 - i * 1.5, 8, 1.4, paper);
  return canvas;
}

// A computer cubicle: desk + monitor + divider wall.
export function drawComputerCubicle(accent = '#00ff9c', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(12, 10, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 2, 10, '#3a4750');
  b(2, 6, 10, 4, '#5a4632');
  b(3, 1, 5, 4, '#20303d');
  b(3.7, 1.7, 3.6, 2.6, accent);
  return canvas;
}

// One section of a security wall: a monitor screen (censored/static by
// default, or showing a clue letter with everything else redacted) plus a
// small desk beneath it.
export function drawMonitorSection(unit = 8, className = 'sprite sprite-decor', state = 'static') {
  const { canvas, ctx } = makeCanvas(12, 11, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 12, 8, '#20303d');
  b(1, 1, 10, 6, state === 'clue' ? '#0a0e12' : '#1c262e');
  if (state === 'static') {
    for (let i = 0; i < 12; i++) b(1 + i * 0.85, 1 + ((i * 3) % 6), 0.8, 0.8, '#3a4750');
  } else if (state === 'clue') {
    b(2, 2, 7, 1, '#3a4750');
    b(2, 4, 5, 1, '#3a4750');
  }
  b(4, 8, 4, 1, '#3a4750');
  b(3, 9, 6, 2, '#5a4632');
  return canvas;
}

// A rolling office chair.
export function drawChairProp(unit = 6, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(6, 8, unit, className);
  const b = grid(ctx, unit);
  b(1, 0, 4, 3, '#2b3a45');
  b(1, 3, 4, 1, '#1c262e');
  b(2, 4, 2, 3, '#3a4750');
  b(0, 7, 6, 1, '#1c262e');
  return canvas;
}

// The multiscreen wall in the security room: a grid of small screens
// (`cells` of them), one of which can be flagged 'clue'.
export function drawMultiscreen(unit = 6, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(20, 12, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 20, 12, '#20303d');
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      b(1 + c * 6.4, 1 + r * 5.5, 5.6, 4.6, '#0a0e12');
    }
  }
  return canvas;
}

// A control panel desk with dials/switches.
export function drawControlPanel(accent = '#00ff9c', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(16, 7, unit, className);
  const b = grid(ctx, unit);
  b(0, 3, 16, 4, '#3a4750');
  b(1, 0, 14, 3, '#1c262e');
  for (let i = 0; i < 5; i++) b(1.5 + i * 2.8, 1, 1.2, 1.2, i % 2 ? accent : '#5a4632');
  return canvas;
}

// A tall locker bank with something visibly stuffed inside (electrical
// room's "8 large locker-like structures", also reused as file-room
// closet dressing).
export function drawLockerStuffed(accent = '#39ff14', unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 16, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 8, 16, '#2a333a');
  b(0.5, 1, 7, 14, '#1c262e');
  b(2, 10, 4, 4, '#5a4632');
  b(3, 8, 2, 2, accent);
  return canvas;
}

// A wall electrical box, panel open, wires visible.
export function drawElectricalBox(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 10, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 8, 10, '#3a4750');
  b(1, 1, 6, 7, '#0a0e12');
  b(2, 2, 1, 5, '#c98a4a');
  b(4, 2, 1, 5, '#4cd6ff');
  b(6, 2, 1, 5, '#ff4d5e');
  return canvas;
}

// A single crate, optionally cracked open (top split, contents peeking).
export function drawCrateProp(cracked = false, unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(8, 8, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 8, 8, '#8a6a3a');
  b(0, 0, 8, 1, '#5e4626');
  b(0, 7, 8, 1, '#5e4626');
  if (cracked) {
    b(2, 0, 1, 3, '#0a0e12');
    b(5, 0, 1, 2, '#0a0e12');
    b(3, 1, 2, 1, '#ffd166');
  }
  return canvas;
}

// A long lab desk (row of desks with chairs implied on either side).
export function drawLabDesk(unit = 8, className = 'sprite sprite-decor') {
  const { canvas, ctx } = makeCanvas(24, 6, unit, className);
  const b = grid(ctx, unit);
  b(0, 2, 24, 4, '#5a4632');
  b(0, 2, 24, 1, '#3d2f20');
  b(2, 0, 2, 2, '#1c2733');
  b(10, 0, 2, 2, '#2f9e5b');
  b(19, 0, 2, 2, '#1c2733');
  return canvas;
}

// A wooden/metal barricade across a doorway, intact or already knocked
// down (splintered, lying flat) once the sector's second minigame clears.
export function drawBarricade(destroyed = false, unit = 8, className = 'sprite sprite-decor') {
  if (destroyed) {
    const { canvas, ctx } = makeCanvas(14, 4, unit, className);
    const b = grid(ctx, unit);
    b(0, 2, 6, 1, '#5e4626');
    b(7, 3, 5, 1, '#5e4626');
    b(2, 0, 4, 1, '#8a6a3a');
    b(9, 1, 4, 1, '#8a6a3a');
    return canvas;
  }
  const { canvas, ctx } = makeCanvas(12, 12, unit, className);
  const b = grid(ctx, unit);
  const plank = '#8a6a3a';
  b(0, 1, 12, 2, plank);
  b(0, 6, 12, 2, plank);
  b(1, 0, 2, 12, '#5e4626');
  b(9, 0, 2, 12, '#5e4626');
  // A chain slung across the planks, feeding into an unmistakable padlock
  // (shackle + body + keyhole) instead of a plain warning square, so the
  // "barricaded, and locked" reading doesn't depend on a text label.
  const chainLight = '#aab4ba';
  const chainDark = '#5b656b';
  for (let i = 0; i < 5; i++) b(1.5 + i * 2, 3.4, 1.3, 1.3, i % 2 ? chainDark : chainLight);
  b(4.3, 7.3, 0.9, 2, '#c9c9c9');
  b(6.8, 7.3, 0.9, 2, '#c9c9c9');
  b(4.3, 7.3, 3.4, 0.9, '#c9c9c9');
  b(3.8, 8.2, 4.4, 3.4, '#20303d');
  b(3.8, 8.2, 4.4, 0.8, '#151f27');
  b(5.5, 9.4, 1, 1.2, '#ff4d5e');
  return canvas;
}
