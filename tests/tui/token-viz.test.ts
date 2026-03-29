import { describe, it, expect, vi } from 'vitest';
import type { AgentInfo } from '../../src/core/types.js';

// Mock chalk to return plain strings so output is predictable
vi.mock('chalk', () => {
  const identity = (s: string) => s;
  const c = new Proxy(identity, {
    get: () => new Proxy(identity, { get: () => identity }),
  });
  return { default: c };
});

import {
  formatTokenCount,
  renderLevelBar,
  renderTokenHistogram,
} from '../../src/tui/token-viz.js';

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1,
    sessionId: 'sess-1',
    cwd: '/project',
    projectName: 'test-project',
    startedAt: Date.now(),
    state: 'working',
    tokenUsage: 1000,
    rawTokenUsage: 1000,
    level: 1,
    lastExchange: '',
    lastActivityAt: Date.now(),
    jsonlPath: null,
    ...overrides,
  };
}

describe('token-viz', () => {
  describe('formatTokenCount', () => {
    it('formats 1_500_000 as "1.5M"', () => {
      expect(formatTokenCount(1_500_000)).toBe('1.5M');
    });

    it('formats 44_900 as "44.9K"', () => {
      expect(formatTokenCount(44_900)).toBe('44.9K');
    });

    it('formats 500 as "500" (no suffix)', () => {
      expect(formatTokenCount(500)).toBe('500');
    });

    it('formats 1_000 as "1.0K"', () => {
      expect(formatTokenCount(1_000)).toBe('1.0K');
    });

    it('formats 1_000_000 as "1.0M"', () => {
      expect(formatTokenCount(1_000_000)).toBe('1.0M');
    });

    it('formats 0 as "0"', () => {
      expect(formatTokenCount(0)).toBe('0');
    });

    it('formats 999 as "999" (below 1K threshold)', () => {
      expect(formatTokenCount(999)).toBe('999');
    });
  });

  describe('renderLevelBar', () => {
    it('returns a string', () => {
      const agent = makeAgent({ level: 1, tokenUsage: 500 });
      const result = renderLevelBar(agent, 40);
      expect(typeof result).toBe('string');
    });

    it('contains the level number', () => {
      const agent = makeAgent({ level: 2, tokenUsage: 5_000 });
      const result = renderLevelBar(agent, 40);
      expect(result).toContain('Lv2');
    });

    it('contains the level name for level 1 (Baby)', () => {
      const agent = makeAgent({ level: 1, tokenUsage: 500 });
      const result = renderLevelBar(agent, 40);
      expect(result).toContain('Baby');
    });

    it('contains the formatted token count', () => {
      const agent = makeAgent({ level: 1, tokenUsage: 500 });
      const result = renderLevelBar(agent, 40);
      expect(result).toContain('500');
    });

    it('contains bar characters (filled or empty)', () => {
      const agent = makeAgent({ level: 1, tokenUsage: 500 });
      const result = renderLevelBar(agent, 40);
      // Should contain either '█' or '░'
      expect(result.includes('█') || result.includes('░')).toBe(true);
    });

    it('handles max level (level >= LEVEL_THRESHOLDS.length) with ratio=1', () => {
      // LEVEL_THRESHOLDS has 5 entries, so level 5 is at/beyond max
      const agent = makeAgent({ level: 5, tokenUsage: 200_000 });
      const result = renderLevelBar(agent, 40);
      expect(typeof result).toBe('string');
      // At max level the bar should be fully filled (no empty blocks)
      expect(result).not.toContain('░');
    });
  });

  describe('renderTokenHistogram', () => {
    it('returns an empty array when agents list is empty', () => {
      expect(renderTokenHistogram([], 40)).toEqual([]);
    });

    it('returns an array with one entry per agent', () => {
      const agents = [
        makeAgent({ sessionId: 'a', projectName: 'proj-a', tokenUsage: 1000 }),
        makeAgent({ sessionId: 'b', projectName: 'proj-b', tokenUsage: 2000 }),
      ];
      const result = renderTokenHistogram(agents, 40);
      expect(result.length).toBe(2);
    });

    it('each entry is a string', () => {
      const agents = [makeAgent({ tokenUsage: 1000 })];
      const result = renderTokenHistogram(agents, 40);
      expect(typeof result[0]).toBe('string');
    });

    it('each entry contains the project name (truncated to 12 chars)', () => {
      const agent = makeAgent({ projectName: 'my-project' });
      const result = renderTokenHistogram([agent], 40);
      expect(result[0]).toContain('my-project');
    });

    it('each entry contains the formatted token count', () => {
      const agent = makeAgent({ tokenUsage: 1500 });
      const result = renderTokenHistogram([agent], 40);
      expect(result[0]).toContain('1.5K');
    });

    it('the agent with the highest token usage gets a fully filled bar', () => {
      const agents = [
        makeAgent({ sessionId: 'a', projectName: 'top', tokenUsage: 5000 }),
        makeAgent({ sessionId: 'b', projectName: 'low', tokenUsage: 100 }),
      ];
      const result = renderTokenHistogram(agents, 40);
      // The first agent has max tokens so its bar should not be all empty
      expect(result[0]).toContain('█');
    });
  });
});
