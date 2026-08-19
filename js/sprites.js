// Tiny hand-built "pixel art" drawn on <canvas> with plain rectangles.
// No image assets. Everything here is generated at runtime so the whole
// game ships as text files.

const BG = '#0a0e12';

function grid(ctx, unit) {
  return (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(gx * unit), Math.round(gy * unit), Math.round(gw * unit), Math.round(gh * unit));
  };
}

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

export function drawKeycard(accent = '#39ff14', unit = 8, className = 'sprite sprite-keycard') {
  const { canvas, ctx } = makeCanvas(14, 9, unit, className);
  const b = grid(ctx, unit);
  b(0, 0, 14, 9, '#1c2733');
  b(0, 0, 14, 1, '#33475c');
  b(1, 2, 12, 2, BG);
  b(2, 5, 3, 3, accent);
  return canvas;
}

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
