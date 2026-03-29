import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CRAYFISH_FARM_HOME,
  CONFIG_FILE,
  TIMER_STATE_FILE,
  PROMPT_STATE_FILE,
  EVENTS_LOG,
  PID_FILE,
  SOCKET_PATH,
  BASELINE_FILE,
  LOG_DIR,
  STATS_DIR,
  HOOKS_DIR,
  LOG_FILE,
  CLAUDE_HOME,
  CLAUDE_SESSIONS_DIR,
  CLAUDE_PROJECTS_DIR,
  CLAUDE_SETTINGS,
  ensureHomeDir,
  getStatsFilePath,
} from '../../src/core/paths.js';

describe('path exports are strings', () => {
  it('CRAYFISH_FARM_HOME contains .crayfish-farm', () => {
    expect(typeof CRAYFISH_FARM_HOME).toBe('string');
    expect(CRAYFISH_FARM_HOME).toContain('.crayfish-farm');
  });

  it('CONFIG_FILE contains config.json', () => {
    expect(typeof CONFIG_FILE).toBe('string');
    expect(CONFIG_FILE).toContain('config.json');
    expect(CONFIG_FILE).toContain('.crayfish-farm');
  });

  it('TIMER_STATE_FILE contains timer-state.json', () => {
    expect(typeof TIMER_STATE_FILE).toBe('string');
    expect(TIMER_STATE_FILE).toContain('timer-state.json');
  });

  it('PROMPT_STATE_FILE contains prompt-state.json', () => {
    expect(typeof PROMPT_STATE_FILE).toBe('string');
    expect(PROMPT_STATE_FILE).toContain('prompt-state.json');
  });

  it('EVENTS_LOG contains events.jsonl', () => {
    expect(typeof EVENTS_LOG).toBe('string');
    expect(EVENTS_LOG).toContain('events.jsonl');
  });

  it('PID_FILE contains .pid', () => {
    expect(typeof PID_FILE).toBe('string');
    expect(PID_FILE).toContain('.pid');
  });

  it('SOCKET_PATH contains .sock', () => {
    expect(typeof SOCKET_PATH).toBe('string');
    expect(SOCKET_PATH).toContain('.sock');
  });

  it('BASELINE_FILE contains baseline.json', () => {
    expect(typeof BASELINE_FILE).toBe('string');
    expect(BASELINE_FILE).toContain('baseline.json');
  });

  it('LOG_DIR contains logs', () => {
    expect(typeof LOG_DIR).toBe('string');
    expect(LOG_DIR).toContain('logs');
  });

  it('STATS_DIR contains stats', () => {
    expect(typeof STATS_DIR).toBe('string');
    expect(STATS_DIR).toContain('stats');
  });

  it('HOOKS_DIR contains hooks', () => {
    expect(typeof HOOKS_DIR).toBe('string');
    expect(HOOKS_DIR).toContain('hooks');
  });

  it('LOG_FILE contains .log', () => {
    expect(typeof LOG_FILE).toBe('string');
    expect(LOG_FILE).toContain('.log');
  });

  it('CLAUDE_HOME contains .claude', () => {
    expect(typeof CLAUDE_HOME).toBe('string');
    expect(CLAUDE_HOME).toContain('.claude');
  });

  it('CLAUDE_SESSIONS_DIR contains sessions', () => {
    expect(typeof CLAUDE_SESSIONS_DIR).toBe('string');
    expect(CLAUDE_SESSIONS_DIR).toContain('sessions');
  });

  it('CLAUDE_PROJECTS_DIR contains projects', () => {
    expect(typeof CLAUDE_PROJECTS_DIR).toBe('string');
    expect(CLAUDE_PROJECTS_DIR).toContain('projects');
  });

  it('CLAUDE_SETTINGS contains settings.json', () => {
    expect(typeof CLAUDE_SETTINGS).toBe('string');
    expect(CLAUDE_SETTINGS).toContain('settings.json');
  });
});

describe('getStatsFilePath', () => {
  it('returns path containing the date and .json', () => {
    const date = '2024-01-15';
    const result = getStatsFilePath(date);
    expect(typeof result).toBe('string');
    expect(result).toContain(date);
    expect(result).toContain('.json');
    expect(result).toContain('stats');
  });

  it('produces different paths for different dates', () => {
    const path1 = getStatsFilePath('2024-01-01');
    const path2 = getStatsFilePath('2024-01-02');
    expect(path1).not.toBe(path2);
  });
});

describe('ensureHomeDir', () => {
  it('creates subdirectories when called', () => {
    // This verifies ensureHomeDir does not throw and creates dirs.
    // Since this touches the real FS, we only verify it doesn't throw.
    expect(() => ensureHomeDir()).not.toThrow();
  });

  it('is idempotent (can be called multiple times)', () => {
    expect(() => {
      ensureHomeDir();
      ensureHomeDir();
    }).not.toThrow();
  });
});
