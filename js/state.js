import { distinctRandomDigits } from './utils.js';

const SAVE_KEY = 'echoexe.save.v1';
export const SECTOR_COUNT = 5;

export const SECTORS = [
  { id: 'level1', name: 'SECTOR 0', title: 'BOOT-UP', accent: '#39ff14' },
  { id: 'level2', name: 'SECTOR 1', title: 'ARCADE ZERO', accent: '#ff2fd0' },
  { id: 'level3', name: 'SECTOR 2', title: 'BREAKER WARD', accent: '#ffb000' },
  { id: 'level4', name: 'SECTOR 3', title: 'VAULT BREACH', accent: '#00ff9c' },
  { id: 'level5', name: 'SECTOR 4', title: 'THE CORE', accent: '#b967ff' },
];

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

let state = load();

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

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[ECHO.EXE] could not persist save', err);
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null && state.scene !== 'title';
  } catch {
    return false;
  }
}

export function resetGame() {
  state = freshState();
  state.stats.startedAt = Date.now();
  save();
  return state;
}

export function patchState(patch) {
  state = { ...state, ...patch };
  save();
  return state;
}

export function setFlag(flag, value = true) {
  state.flags[flag] = value;
  save();
}

export function completeLevel(index, digit) {
  state.levelsCompleted[index] = true;
  if (digit !== undefined) state.shards[index] = digit;
  save();
}

export function firstIncompleteLevel() {
  const idx = state.levelsCompleted.findIndex((v) => !v);
  return idx === -1 ? SECTOR_COUNT : idx;
}

export function finalCode() {
  return state.shards.slice().reverse().join('');
}
