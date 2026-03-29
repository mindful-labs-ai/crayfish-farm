import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { TIMER_STATE_FILE, ensureHomeDir } from '../core/paths.js';
import type { TimerState } from '../core/types.js';

function readRawState(filePath?: string): TimerState | null {
  const target = filePath ?? TIMER_STATE_FILE;
  try {
    if (!existsSync(target)) return null;
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function writeStateAtomic(state: TimerState, filePath?: string): void {
  const target = filePath ?? TIMER_STATE_FILE;
  try {
    if (!filePath) {
      ensureHomeDir();
    }
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), 'utf8');
    renameSync(tmp, target);
  } catch {
    // silent failure
  }
}

export function isFlowMode(filePath?: string): boolean {
  const state = readRawState(filePath);
  return state?.flowMode ?? false;
}

export function setFlowMode(enabled: boolean, filePath?: string): void {
  const existing = readRawState(filePath);

  if (!existing) {
    const state: TimerState = {
      running: false,
      startedAt: 0,
      durationMs: 0,
      preset: 'pomodoro',
      flowMode: enabled,
      pausedAt: null,
    };
    writeStateAtomic(state, filePath);
    return;
  }

  writeStateAtomic({ ...existing, flowMode: enabled }, filePath);
}
