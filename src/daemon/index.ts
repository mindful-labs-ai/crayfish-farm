import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { ensureHomeDir, PID_FILE, PROMPT_STATE_FILE } from '../core/paths.js';
import { TICK_INTERVAL_MS } from '../core/constants.js';
import { logInfo, logError } from '../core/logger.js';
import { discoverAgents } from '../services/agent-tracker.js';
import { tick as dopamineTick, handleEvent, getDopamineState } from '../services/dopamine-service.js';
import { startTimer, stopTimer, getTimerStatus, applyPreset } from '../services/timer-engine.js';
import { getTodayStats } from '../services/stats-aggregator.js';
import { isFlowMode, setFlowMode } from '../services/flow-protection.js';
import { loadConfig, saveConfig } from '../core/config.js';
import { startIpcServer, stopIpcServer } from './ipc-server.js';
import { startWatching } from './file-watcher.js';
import type { MethodHandlers, MethodHandler } from './ipc-server.js';
import type { DopamineEvent } from '../core/types.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  ensureHomeDir();

  // Write PID file
  writeFileSync(PID_FILE, String(process.pid), 'utf8');
  logInfo('Daemon started', { pid: process.pid });

  // Define 16 IPC method handlers
  const handlers: MethodHandlers = {
    'agent.list': async (_params) => {
      return discoverAgents();
    },

    'agent.detail': async (params) => {
      const sessionId = params?.sessionId as string | undefined;
      const agents = discoverAgents();
      return agents.find((a) => a.sessionId === sessionId) ?? null;
    },

    'timer.start': async (params) => {
      const minutes = params?.minutes as number | undefined;
      return startTimer(minutes);
    },

    'timer.stop': async (_params) => {
      return stopTimer();
    },

    'timer.status': async (_params) => {
      return getTimerStatus();
    },

    'timer.preset': async (params) => {
      const name = params?.name as string;
      return applyPreset(name);
    },

    'stats.today': async (_params) => {
      return getTodayStats();
    },

    'flow.set': async (params) => {
      const enabled = params?.enabled as boolean;
      setFlowMode(enabled);
      return { flowMode: enabled };
    },

    'config.get': async (_params) => {
      return loadConfig();
    },

    'config.set': async (params) => {
      const config = loadConfig();
      const merged = deepMerge(config as unknown as Record<string, unknown>, params ?? {});
      saveConfig(merged as unknown as ReturnType<typeof loadConfig>);
      return merged;
    },

    'daemon.status': async (_params) => {
      const agents = discoverAgents();
      return {
        running: true,
        pid: process.pid,
        uptime: Date.now() - startedAt,
        sessions: agents.length,
      };
    },

    'prompt.state': async (_params) => {
      if (existsSync(PROMPT_STATE_FILE)) {
        try {
          return JSON.parse(readFileSync(PROMPT_STATE_FILE, 'utf8')) as unknown;
        } catch {
          return null;
        }
      }
      return null;
    },

    'tmux.state': async (_params) => {
      if (existsSync(PROMPT_STATE_FILE)) {
        try {
          return JSON.parse(readFileSync(PROMPT_STATE_FILE, 'utf8')) as unknown;
        } catch {
          return null;
        }
      }
      return null;
    },

    'dopamine.state': async (_params) => {
      return getDopamineState();
    },

    'hook.event': async (params) => {
      const event = params as unknown as DopamineEvent;
      handleEvent(event);
      return { ok: true };
    },
  } satisfies MethodHandlers;

  // Start IPC server
  const server = await startIpcServer(handlers);
  logInfo('IPC server listening');

  // Start file watcher
  const watcher = startWatching((fileEvent) => {
    if (fileEvent.type === 'activity-detected') {
      const dopamineEvent: DopamineEvent = {
        type: 'activity-detected',
        sessionId: fileEvent.sessionId,
        timestamp: fileEvent.timestamp,
      };
      handleEvent(dopamineEvent);
    } else if (fileEvent.type === 'session-removed') {
      try {
        const agents = discoverAgents();
        const agent = agents.find((a) => a.sessionId === fileEvent.sessionId);
        const projectName = agent?.projectName;
        const dopamineEvent: DopamineEvent = {
          type: 'session-stop',
          sessionId: fileEvent.sessionId,
          projectName,
          timestamp: fileEvent.timestamp,
        };
        handleEvent(dopamineEvent);
      } catch (err) {
        logError('Error handling session-removed', { error: String(err) });
      }
    }
  });
  logInfo('File watcher started');

  // Start tick loop
  const tickInterval = setInterval(() => {
    try {
      const agents = discoverAgents();
      dopamineTick(agents);
    } catch (err) {
      logError('Tick error', { error: String(err) });
    }
  }, TICK_INTERVAL_MS);

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    logInfo('Daemon shutting down');

    clearInterval(tickInterval);

    await watcher.stop();
    await stopIpcServer(server);

    if (existsSync(PID_FILE)) {
      try {
        unlinkSync(PID_FILE);
      } catch {
        // ignore
      }
    }

    logInfo('Daemon stopped');
    process.exit(0);
  }

  process.on('SIGTERM', () => {
    void shutdown();
  });

  process.on('SIGINT', () => {
    void shutdown();
  });
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

void main().catch((err) => {
  logError('Daemon startup failed', { error: String(err) });
  process.exit(1);
});
