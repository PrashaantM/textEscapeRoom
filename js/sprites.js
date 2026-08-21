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
// scene to mark the player's position in its room diorama.
export function drawPlayer(accent = '#39ff14', unit = 8, className = 'sprite sprite-player') {
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
  b(3, 9, 2, 5, suitDark);
  b(5, 9, 2, 5, suitDark);
  b(2, 14, 3, 2, boot);
  b(5, 14, 3, 2, boot);
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
