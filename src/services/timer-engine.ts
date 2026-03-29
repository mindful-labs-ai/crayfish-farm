import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { TimerState } from '../core/types.js';
import { TIMER_PRESETS } from '../core/constants.js';
import { TIMER_STATE_FILE, ensureHomeDir } from '../core/paths.js';
import { loadConfig } from '../core/config.js';

function writeStateAtomic(state: TimerState, filePath?: string): void {
  const target = filePath ?? TIMER_STATE_FILE;
  if (!filePath) {
    ensureHomeDir();
  }
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(state), 'utf8');
  renameSync(tmp, target);
}

function readState(filePath?: string): TimerState | null {
  const target = filePath ?? TIMER_STATE_FILE;
  try {
    if (!existsSync(target)) return null;
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

export function startTimer(minutes?: number, filePath?: string): TimerState {
  const config = loadConfig();
  const durationMinutes = minutes ?? config.timer.defaultMinutes;
  const state: TimerState = {
    running: true,
    startedAt: Date.now(),
    durationMs: durationMinutes * 60 * 1000,
    preset: config.timer.preset,
    flowMode: false,
    pausedAt: null,
  };
  writeStateAtomic(state, filePath);
  return state;
}

export function stopTimer(filePath?: string): TimerState {
  const existing = readState(filePath);
  const state: TimerState = existing
    ? { ...existing, running: false, pausedAt: null }
    : {
        running: false,
        startedAt: 0,
        durationMs: 0,
        preset: 'pomodoro',
        flowMode: false,
        pausedAt: null,
      };
  writeStateAtomic(state, filePath);
  return state;
}

export function getTimerStatus(filePath?: string): TimerState | null {
  return readState(filePath);
}

export function applyPreset(name: string, filePath?: string): TimerState {
  const preset = TIMER_PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown timer preset: ${name}`);
  }
  return startTimer(preset.focus, filePath);
}

export function getRemainingMs(filePath?: string): number {
  const state = readState(filePath);
  if (!state) return 0;
  return state.durationMs - (Date.now() - state.startedAt);
}

export function isTimerComplete(filePath?: string): boolean {
  const state = readState(filePath);
  if (!state) return false;
  return state.running && getRemainingMs(filePath) <= 0;
}
