import readline from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import {
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  HIDE_CURSOR,
  SHOW_CURSOR,
  CLEAR_SCREEN,
  MOVE_HOME,
} from './ansi.js';
import { renderGridView } from './grid-view.js';
import { renderDetailView } from './detail-view.js';
import { discoverAgents } from '../services/agent-tracker.js';
import { getTimerStatus, startTimer, stopTimer } from '../services/timer-engine.js';
import { getTodayStats } from '../services/stats-aggregator.js';
import { PROMPT_STATE_FILE } from '../core/paths.js';
import { DASHBOARD_REFRESH_MS, ZZZ_FRAMES } from '../core/constants.js';
import type { AgentInfo, TimerState, DayStats, PromptState } from '../core/types.js';

const FLASH_FRAMES = 3;

export async function startDashboard(): Promise<void> {
  let renderFrame = 0;
  let detailIndex: number | null = null;

  const prevTokens = new Map<string, number>();
  const prevLevels = new Map<string, number>();
  const flashSet = new Set<string>();
  const flashTimers = new Map<string, number>();

  // Enter alt screen and hide cursor
  process.stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR);

  function cleanup(): void {
    process.stdout.write(EXIT_ALT_SCREEN + SHOW_CURSOR);
  }

  // Readline raw mode for keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  function readPromptState(): PromptState | null {
    if (!existsSync(PROMPT_STATE_FILE)) return null;
    try {
      return JSON.parse(readFileSync(PROMPT_STATE_FILE, 'utf8')) as PromptState;
    } catch {
      return null;
    }
  }

  function applyRuntimeEffects(output: string, agents: AgentInfo[], frame: number): string {
    let result = output;
    const zzzFrame = ZZZ_FRAMES[frame % ZZZ_FRAMES.length] ?? '  z';

    for (const agent of agents) {
      if (agent.state === 'sleeping') {
        const replacement = `${agent.projectName}${zzzFrame}`;
        // Only replace first occurrence to avoid duplication
        result = result.replace(agent.projectName, replacement);
      }
    }

    return result;
  }

  function render(): void {
    try {
      const agents = discoverAgents();
      const timer = getTimerStatus();
      const stats = getTodayStats();
      const promptState = readPromptState();

      // Track token deltas
      const tokenDeltas = new Map<string, number>();
      for (const agent of agents) {
        const prev = prevTokens.get(agent.sessionId);
        if (prev !== undefined) {
          tokenDeltas.set(agent.sessionId, agent.tokenUsage - prev);
        }
        prevTokens.set(agent.sessionId, agent.tokenUsage);
      }

      // Track level-ups, manage flash set
      for (const agent of agents) {
        const prevLevel = prevLevels.get(agent.sessionId);
        if (prevLevel !== undefined && agent.level > prevLevel) {
          flashSet.add(agent.sessionId);
          flashTimers.set(agent.sessionId, FLASH_FRAMES);
        }
        prevLevels.set(agent.sessionId, agent.level);
      }

      // Decrement flash timers
      for (const [sessionId, remaining] of flashTimers) {
        if (remaining <= 1) {
          flashTimers.delete(sessionId);
          flashSet.delete(sessionId);
        } else {
          flashTimers.set(sessionId, remaining - 1);
        }
      }

      let output: string;

      if (detailIndex !== null) {
        const agent = agents[detailIndex];
        if (agent) {
          output = renderDetailView(agent, agents, renderFrame);
        } else {
          detailIndex = null;
          output = renderGridView(agents, timer, stats, promptState, renderFrame, tokenDeltas, flashSet);
        }
      } else {
        output = renderGridView(agents, timer, stats, promptState, renderFrame, tokenDeltas, flashSet);
      }

      // Apply runtime effects (zZZ animation for sleeping agents)
      output = applyRuntimeEffects(output, agents, renderFrame);

      // Render in-place: position each line explicitly, erase trailing chars
      const rows = process.stdout.rows ?? 24;
      const outputLines = output.split('\n');
      let buf = MOVE_HOME;
      const limit = Math.min(outputLines.length, rows);
      for (let i = 0; i < limit; i++) {
        buf += `\x1b[${i + 1};1H${outputLines[i]}\x1b[K`;
      }
      // Clear remaining rows
      for (let i = limit; i < rows; i++) {
        buf += `\x1b[${i + 1};1H\x1b[K`;
      }
      process.stdout.write(buf);
      renderFrame++;
    } catch {
      // silently ignore render errors
    }
  }

  // Keyboard handling
  process.stdin.on('keypress', (str: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
    if (key.ctrl && key.name === 'c') {
      quit();
      return;
    }

    switch (str) {
      case 'q':
        quit();
        break;
      case 'r':
        render();
        break;
      case 't': {
        const timer = getTimerStatus();
        if (timer?.running) {
          stopTimer();
        } else {
          startTimer(25);
        }
        render();
        break;
      }
      case 'b':
        detailIndex = null;
        render();
        break;
      default:
        break;
    }

    // Escape key
    if (key.name === 'escape') {
      detailIndex = null;
      render();
      return;
    }

    // 1-9: switch to detail view
    if (str >= '1' && str <= '9') {
      const idx = parseInt(str, 10) - 1;
      detailIndex = idx;
      render();
    }
  });

  function quit(): void {
    clearInterval(refreshInterval);
    cleanup();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }

  // Initial render
  render();

  // Refresh interval
  const refreshInterval = setInterval(() => {
    render();
  }, DASHBOARD_REFRESH_MS);

  // Handle process exit signals
  process.on('SIGTERM', quit);
  process.on('SIGINT', quit);

  // Keep process alive
  return new Promise<void>(() => {
    // Never resolves - dashboard runs until quit
  });
}
