import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import {
  FIBONACCI,
  MIN_PROMINENT_SIGNAL_INTERVAL_MS,
  QUIET_MODE_IGNORE_COUNT,
} from '../core/constants.js';
import { PROMPT_STATE_FILE, ensureHomeDir } from '../core/paths.js';
import { sendBell, sendSystemNotification } from './notification.js';
import { logInfo } from '../core/logger.js';
import type { PromptState, Signal } from '../core/types.js';

// Internal state
let exchangeCount = 0;
let lastProminentSignalAt = 0;
let consecutiveIgnored = 0;
let quietMode = false;

export function canEmitProminentSignal(): boolean {
  if (quietMode) return false;
  return Date.now() - lastProminentSignalAt >= MIN_PROMINENT_SIGNAL_INTERVAL_MS;
}

export function onActivityDetected(): Signal | null {
  exchangeCount++;

  if (!FIBONACCI.includes(exchangeCount)) {
    return null;
  }

  if (!canEmitProminentSignal()) {
    consecutiveIgnored++;
    if (consecutiveIgnored >= QUIET_MODE_IGNORE_COUNT) {
      quietMode = true;
      logInfo('signal-emitter: entering quiet mode');
    }
    return null;
  }

  // Can emit
  lastProminentSignalAt = Date.now();
  consecutiveIgnored = 0;

  writePromptState({ badge: exchangeCount });

  return { type: 'prompt', data: { badge: exchangeCount } };
}

export function onTimerComplete(): void {
  sendBell();
  sendSystemNotification('crayfish-farm', 'Timer finished. Take a break!');
}

export function onSessionIdle(projectName: string): void {
  writePromptState({ returnTo: projectName });
}

export function writePromptState(partial: Partial<PromptState>): void {
  const target = PROMPT_STATE_FILE;

  const defaults: PromptState = {
    pulse: '',
    badge: null,
    timer: null,
    timeOfDay: 'AM',
    returnTo: null,
    warmth: 'neutral',
    updated: 0,
  };

  let existing: PromptState = { ...defaults };

  if (existsSync(target)) {
    try {
      const raw = readFileSync(target, 'utf8');
      existing = { ...defaults, ...(JSON.parse(raw) as Partial<PromptState>) };
    } catch {
      // use defaults
    }
  }

  const merged: PromptState = {
    ...existing,
    ...partial,
    updated: Date.now(),
  };

  try {
    ensureHomeDir();
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(merged), 'utf8');
    renameSync(tmp, target);
  } catch {
    // silent failure
  }
}

export function resetState(): void {
  exchangeCount = 0;
  lastProminentSignalAt = 0;
  consecutiveIgnored = 0;
  quietMode = false;
}

export function getQuietMode(): boolean {
  return quietMode;
}
