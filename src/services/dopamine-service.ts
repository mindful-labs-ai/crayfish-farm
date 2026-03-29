import { HYPERFOCUS_THRESHOLD_MS } from '../core/constants.js';
import { logInfo } from '../core/logger.js';
import {
  onActivityDetected,
  onTimerComplete,
  onSessionIdle,
  writePromptState,
} from './signal-emitter.js';
import { getAdaptiveParams } from './adaptive-engine.js';
import { notifyTimerComplete } from './notification.js';
import type { AgentInfo, DopamineEvent, DopamineState } from '../core/types.js';

// Internal state
let _timeOfDay = computeTimeOfDay();
let _warmth = 'neutral';

function computeTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'AM';
  if (hour >= 12 && hour <= 17) return 'PM';
  return 'EVE';
}

function computeWarmth(agents: AgentInfo[]): string {
  const workingCount = agents.filter((a) => a.state === 'working').length;
  if (workingCount === 0) return 'cool';
  if (workingCount === 1) return 'warm';
  return 'hot';
}

function checkHyperfocus(agents: AgentInfo[]): boolean {
  const now = Date.now();
  return agents.some(
    (a) => a.state === 'working' && now - a.lastActivityAt >= HYPERFOCUS_THRESHOLD_MS
  );
}

// ETHICAL BOUNDARIES (hardcoded):
// - NEVER include streak data
// - NEVER compare today vs yesterday automatically
// - NEVER include "X minutes wasted"
// - NEVER include inactive time ("N minutes away")
// - NEVER punish via signal absence

export function handleEvent(event: DopamineEvent): void {
  switch (event.type) {
    case 'activity-detected': {
      const signal = onActivityDetected();
      if (signal) {
        logInfo('dopamine: momentum pulse emitted', { badge: signal.data['badge'] });
      }
      break;
    }
    case 'session-stop': {
      if (event.projectName) {
        onSessionIdle(event.projectName);
      }
      break;
    }
    case 'timer-complete': {
      onTimerComplete();
      notifyTimerComplete(0);
      break;
    }
    case 'level-up': {
      writePromptState({ pulse: 'flash' });
      break;
    }
    case 'session-start':
    case 'timer-start':
      // No action
      break;
  }
}

export function tick(agents: AgentInfo[]): void {
  _timeOfDay = computeTimeOfDay();
  _warmth = computeWarmth(agents);

  const hyperfocus = checkHyperfocus(agents);

  writePromptState({
    timeOfDay: _timeOfDay,
    warmth: _warmth,
  });

  if (hyperfocus) {
    logInfo('dopamine: hyperfocus detected');
  }
}

export function getDopamineState(): DopamineState {
  const adaptiveParams = getAdaptiveParams();

  return {
    timeOfDay: _timeOfDay,
    warmth: _warmth,
    quietMode: false,
    adaptiveParams,
  };
}
