import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const HOME = homedir();

// crayfish-farm home directory
export const CRAYFISH_FARM_HOME = join(HOME, '.crayfish-farm');

// Config & state files
export const CONFIG_FILE = join(CRAYFISH_FARM_HOME, 'config.json');
export const TIMER_STATE_FILE = join(CRAYFISH_FARM_HOME, 'timer-state.json');
export const PROMPT_STATE_FILE = join(CRAYFISH_FARM_HOME, 'prompt-state.json');
export const EVENTS_LOG = join(CRAYFISH_FARM_HOME, 'events.jsonl');
export const PATH_CACHE_FILE = join(CRAYFISH_FARM_HOME, 'path-encoding-cache.json');

// Daemon files
export const PID_FILE = join(CRAYFISH_FARM_HOME, 'crayfish-farm.pid');
export const SOCKET_PATH = join(CRAYFISH_FARM_HOME, 'crayfish-farm.sock');

// Adaptive engine
export const BASELINE_FILE = join(CRAYFISH_FARM_HOME, 'baseline.json');

// Directories
export const LOG_DIR = join(CRAYFISH_FARM_HOME, 'logs');
export const STATS_DIR = join(CRAYFISH_FARM_HOME, 'stats');
export const HOOKS_DIR = join(CRAYFISH_FARM_HOME, 'hooks');

// Log file
export const LOG_FILE = join(LOG_DIR, 'crayfish-farm.log');

// Claude Code paths
export const CLAUDE_HOME = join(HOME, '.claude');
export const CLAUDE_SESSIONS_DIR = join(CLAUDE_HOME, 'sessions');
export const CLAUDE_PROJECTS_DIR = join(CLAUDE_HOME, 'projects');
export const CLAUDE_SETTINGS = join(CLAUDE_HOME, 'settings.json');

export function ensureHomeDir(): void {
  mkdirSync(CRAYFISH_FARM_HOME, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(STATS_DIR, { recursive: true });
  mkdirSync(HOOKS_DIR, { recursive: true });
}

export function getStatsFilePath(date: string): string {
  return join(STATS_DIR, `${date}.json`);
}
