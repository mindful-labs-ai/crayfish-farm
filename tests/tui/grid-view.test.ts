import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentInfo, TimerState, DayStats, PromptState } from '../../src/core/types.js';

// Mock chalk to return plain strings
vi.mock('chalk', () => {
  const identity = (s: string) => s;
  const bold = (s: string) => s;
  const c: Record<string, unknown> = {
    bold,
    dim: identity,
    cyan: identity,
    green: identity,
    yellow: identity,
    red: identity,
    gray: identity,
  };
  return { default: c };
});

// Mock card-renderer so renderCard doesn't require art/ansi deps
vi.mock('../../src/tui/card-renderer.js', () => ({
  renderCard: vi.fn((_agent: AgentInfo, _i: number, _frame: number, inner: number) =>
    [`+${'─'.repeat(inner)}+`, `| ${'content'.padEnd(inner - 2)} |`, `+${'─'.repeat(inner)}+`]
  ),
}));

// Mock ansi helpers
vi.mock('../../src/tui/ansi.js', () => ({
  horizontalLine: vi.fn((w: number) => '─'.repeat(w)),
}));

import { getCardDimensions, renderGridView } from '../../src/tui/grid-view.js';

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1,
    sessionId: 'sess-1',
    cwd: '/project',
    projectName: 'proj',
    startedAt: Date.now(),
    state: 'working',
    tokenUsage: 1000,
    rawTokenUsage: 1000,
    level: 1,
    lastExchange: 'working',
    lastActivityAt: Date.now(),
    jsonlPath: null,
    ...overrides,
  };
}

describe('grid-view', () => {
  let originalColumns: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalColumns = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
  });

  afterEach(() => {
    if (originalColumns !== undefined) {
      Object.defineProperty(process.stdout, 'columns', originalColumns);
    } else {
      // If it didn't exist originally, delete our mock
      try {
        delete (process.stdout as Record<string, unknown>)['columns'];
      } catch { /* ignore */ }
    }
  });

  describe('getCardDimensions', () => {
    it('returns valid inner/outer/columns for wide terminal (>=90 cols)', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });

      const dims = getCardDimensions();

      expect(dims.inner).toBeGreaterThanOrEqual(28);
      expect(dims.outer).toBe(dims.inner + 2);
      expect(dims.columns).toBe(2);
    });

    it('returns single-column layout for narrow terminal (<90 cols)', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

      const dims = getCardDimensions();

      expect(dims.columns).toBe(1);
      expect(dims.inner).toBeGreaterThanOrEqual(28);
      expect(dims.outer).toBe(dims.inner + 2);
    });

    it('uses 80 as fallback when process.stdout.columns is undefined', () => {
      Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });

      const dims = getCardDimensions();

      // 80 < 90, so single column
      expect(dims.columns).toBe(1);
    });

    it('inner width does not exceed 60', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 300, configurable: true });

      const dims = getCardDimensions();

      expect(dims.inner).toBeLessThanOrEqual(60);
    });
  });

  describe('renderGridView', () => {
    it('returns a string', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

      const result = renderGridView([], null, null, null, 0, new Map(), new Set());
      expect(typeof result).toBe('string');
    });

    it('includes "No active Claude sessions" when agents array is empty', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

      const result = renderGridView([], null, null, null, 0, new Map(), new Set());
      expect(result).toContain('No active Claude sessions');
    });

    it('renders agent cards when agents are provided', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

      const agent = makeAgent({ projectName: 'my-project' });
      const result = renderGridView([agent], null, null, null, 0, new Map(), new Set());
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('includes stats line with focus minutes and sessions', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

      const stats: DayStats = { focusMinutes: 42, completedSessions: 3, date: '2024-01-01' };
      const result = renderGridView([], null, stats, null, 0, new Map(), new Set());
      expect(result).toContain('42min focus');
      expect(result).toContain('3 sessions');
    });

    it('renders 2-column layout for wide terminal', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 120, configurable: true });

      const agents = [
        makeAgent({ sessionId: 'a', projectName: 'proj-a' }),
        makeAgent({ sessionId: 'b', projectName: 'proj-b' }),
      ];
      const result = renderGridView(agents, null, null, null, 0, new Map(), new Set());
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
