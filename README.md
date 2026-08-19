# ECHO.EXE

A nostalgic, browser-based escape room. Boot up an old machine, clear five
increasingly strange sectors, and find out what — or who — has really been
trapped inside.

**Play it:** https://prashaantm.github.io/textEscapeRoom/

## The sectors

| # | Sector | Mechanic |
|---|--------|----------|
| 0 | Boot-Up | A classic text-adventure command line — explore, read files, find hidden ones, and crack a keypad. |
| 1 | Arcade Zero | A Simon-style memory game with arcade lives and continues. |
| 2 | Breaker Ward | A "Lights Out" logic grid — every toggle flips its neighbors too. |
| 3 | Vault Breach | A Fallout-style password-cracking terminal with a Mastermind twist. |
| 4 | The Core | Assemble everything you've collected into a final access code. |

Clearing all five leads into a proper ending sequence — not just a "You Win"
screen.

## Tech

Plain HTML/CSS/JS (ES modules), no build step, no external runtime
dependencies. Fonts are self-hosted (`Press Start 2P`, `VT323`); all sound is
synthesized at runtime with the Web Audio API; all "pixel art" is drawn on
`<canvas>` at load time. Progress autosaves to `localStorage`, so refreshing
the page resumes where you left off.

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Origin

This project started as a small `pygame` desktop prototype (see git history).
It's since been rebuilt from scratch as a self-contained browser game so it
can run anywhere, including GitHub Pages.
