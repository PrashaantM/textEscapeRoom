// Single source of truth for the game's save data. Every scene file reads
// progress through getState() and writes it back through patchState() /
// setFlag() / completeLevel(), so this module is the shared state layer that
// ties boot -> title -> callsign -> level1..level5 -> ending together.
// sceneManager.js decides which scene can be entered by checking
// levelsCompleted here, and it persists the active scene id on every
// transition so a reload resumes where the player left off.

import { distinctRandomDigits } from './utils.js';

const SAVE_KEY = 'echoexe.save.v1';
export const SECTOR_COUNT = 5;

// Static metadata for each of the 5 levels (display name, title, accent
// color). Used by sceneManager.js for the status bar chrome and by the
// scene files (e.g. shared.js's showInterstitial, level5.js, ending.js) to
// theme their UI per sector.
export const SECTORS = [
  { id: 'level1', name: 'SECTOR 0', title: 'BOOT-UP', accent: '#39ff14' },
  { id: 'level2', name: 'SECTOR 1', title: 'ARCADE ZERO', accent: '#ff2fd0' },
  { id: 'level3', name: 'SECTOR 2', title: 'BREAKER WARD', accent: '#ffb000' },
  { id: 'level4', name: 'SECTOR 3', title: 'VAULT BREACH', accent: '#00ff9c' },
  { id: 'level5', name: 'SECTOR 4', title: 'THE CORE', accent: '#b967ff' },
];

// Builds the default save shape for a brand new game. Called by load() when
// there is no valid save, and by resetGame() when the player starts over.
function freshState() {
  return {
    v: 1,
    scene: 'title',
    playerTag: '',
    codeDigits: distinctRandomDigits(4), // assigned to shards as they're earned
    shards: [null, null, null, null],
    levelsCompleted: [false, false, false, false, false],
    flags: {
      konami: false,
      vaultDudUsed: false,
      vaultAttemptRestored: false,
      secretEndingSeen: false,
    },
    settings: {
      muted: false,
      crt: true,
    },
    stats: {
      startedAt: null,
      finishedAt: null,
      arcadeContinuesUsed: 0,
      vaultLockouts: 0,
    },
  };
}

// Module-level in-memory copy of the save; hydrated once at import time.
let state = load();

// Reads the persisted save from localStorage on module init, falling back to
// freshState() if nothing is saved or the saved shape is from an older
// version. Called once to seed the `state` variable above.
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return freshState();
    return { ...freshState(), ...parsed, settings: { ...freshState().settings, ...parsed.settings } };
  } catch (err) {
    console.warn('[ECHO.EXE] save data unreadable, starting fresh', err);
    return freshState();
  }
}

// Read accessor used everywhere (sceneManager.js, every scene file) to get
// the current in-memory save without importing localStorage logic directly.
export function getState() {
  return state;
}

// Writes the current in-memory state to localStorage. Called by every
// mutator below (patchState, setFlag, completeLevel, resetGame) so state is
// persisted immediately after each change.
export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[ECHO.EXE] could not persist save', err);
  }
}

// Tells title.js whether to offer a CONTINUE option, based on whether a save
// exists and the player has progressed past the title scene.
export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null && state.scene !== 'title';
  } catch {
    return false;
  }
}

// Wipes progress back to a fresh game and stamps a new start time. Called by
// title.js (new game / erase data) and by the pause menu and ending screen
// ("restart game" / "play again").
export function resetGame() {
  state = freshState();
  state.stats.startedAt = Date.now();
  save();
  return state;
}

// Shallow-merges a partial state object into the current save and persists
// it. Used by sceneManager.js to record the active scene on every
// transition, and by scene files to update things like settings or playerTag.
export function patchState(patch) {
  state = { ...state, ...patch };
  save();
  return state;
}

// Sets one boolean flag (e.g. 'konami', 'vaultDudUsed') on state.flags and
// saves. Called by konami.js and by level4.js when the player uses a
// vault shortcut, so the ending screen can reference these later.
export function setFlag(flag, value = true) {
  state.flags[flag] = value;
  save();
}

// Marks a sector as cleared and records the memory-shard digit it awarded.
// Called by each level file (level1..level5) on solving its puzzle; feeds
// SECTOR_COUNT-based progress checks and the final code assembled in
// level5.js / finalCode().
export function completeLevel(index, digit) {
  state.levelsCompleted[index] = true;
  if (digit !== undefined) state.shards[index] = digit;
  save();
}

// Returns the index of the first sector not yet completed, or SECTOR_COUNT
// if all are done. Used as a fallback target when sceneManager.js needs to
// redirect a player who tries to jump ahead of their progress.
export function firstIncompleteLevel() {
  const idx = state.levelsCompleted.findIndex((v) => !v);
  return idx === -1 ? SECTOR_COUNT : idx;
}

// Reassembles the 4 collected shard digits (in reverse order) into the code
// the Core expects. Mirrors the check level5.js performs directly against
// state.shards; kept here as a convenience export.
export function finalCode() {
  return state.shards.slice().reverse().join('');
}
