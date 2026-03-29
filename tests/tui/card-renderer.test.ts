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

// Mock crawfish-art to return stable lines
vi.mock('../../src/tui/crawfish-art.js', () => ({
  getCrawfishArt: vi.fn(() => ['(\\/)','(O.o)','(> <)']),
}));

// Mock ansi helpers to return plain strings
vi.mock('../../src/tui/ansi.js', () => ({
  boxTop: vi.fn((_w: number, label: string) => `+--${label}--+`),
  boxBottom: vi.fn((_w: number) => '+--------+'),
  boxSide: vi.fn(() => '|'),
}));

import { renderCard, describeActivity, summarizeExchange } from '../../src/tui/card-renderer.js';

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1234,
    sessionId: 'session-abc',
    cwd: '/home/user/project',
    projectName: 'test-project',
    startedAt: Date.now(),
    state: 'working',
    tokenUsage: 500,
    rawTokenUsage: 500,
    level: 1,
    lastExchange: 'Working on feature X',
    lastActivityAt: Date.now(),
    jsonlPath: null,
    ...overrides,
  };
}

describe('card-renderer', () => {
  describe('describeActivity', () => {
    it('returns Korean "휴식 중..." for sleeping state', () => {
      const agent = makeAgent({ state: 'sleeping' });
      const result = describeActivity(agent, 40);
      expect(result).toBe('휴식 중...');
    });

    it('returns Korean "대기 중..." for idle state', () => {
      const agent = makeAgent({ state: 'idle' });
      const result = describeActivity(agent, 40);
      expect(result).toBe('대기 중...');
    });

    it('returns Korean "작업 완료!" for working state with no lastExchange', () => {
      const agent = makeAgent({ state: 'working', lastExchange: '' });
      const result = describeActivity(agent, 40);
      expect(result).toBe('작업 완료!');
    });

    it('returns summarized exchange for working state with lastExchange', () => {
      const agent = makeAgent({ state: 'working', lastExchange: 'Fixing the bug now' });
      const result = describeActivity(agent, 40);
      expect(result).toBe('Fixing the bug now');
    });

    it('returns empty string for unknown state', () => {
      const agent = makeAgent({ state: 'unknown' as AgentInfo['state'] });
      const result = describeActivity(agent, 40);
      expect(result).toBe('');
    });
  });

  describe('summarizeExchange', () => {
    it('strips markdown bold markers', () => {
      const result = summarizeExchange('**hello world**', 80);
      expect(result).toBe('hello world');
    });

    it('strips backtick markers', () => {
      const result = summarizeExchange('Use `const` here', 80);
      expect(result).toBe('Use const here');
    });

    it('skips lines starting with ## and returns next meaningful line', () => {
      const result = summarizeExchange('## Header\nActual content', 80);
      expect(result).toBe('Actual content');
    });

    it('skips lines starting with ``` (code fences)', () => {
      const result = summarizeExchange('```typescript\nconst x = 1\n```', 80);
      // code fence lines skipped; "const x = 1" is meaningful
      expect(result).toBe('const x = 1');
    });

    it('skips table lines starting with |', () => {
      const result = summarizeExchange('| col1 | col2 |\nreal text', 80);
      expect(result).toBe('real text');
    });

    it('truncates text that exceeds maxLen', () => {
      const longText = 'a'.repeat(100);
      const result = summarizeExchange(longText, 20);
      expect(result.length).toBeLessThanOrEqual(20 + 3); // ellipsis adds 3 chars
    });

    it('returns empty string for empty input', () => {
      const result = summarizeExchange('', 80);
      expect(result).toBe('');
    });
  });

  describe('renderCard', () => {
    it('returns an array of strings', () => {
      const agent = makeAgent();
      const lines = renderCard(agent, 0, 0, 30, false);
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
    });

    it('each element in the result is a string', () => {
      const agent = makeAgent();
      const lines = renderCard(agent, 0, 0, 30, false);
      for (const line of lines) {
        expect(typeof line).toBe('string');
      }
    });

    it('first line is the top border containing the project name', () => {
      const agent = makeAgent({ projectName: 'my-project' });
      const lines = renderCard(agent, 0, 0, 30, false);
      expect(lines[0]).toContain('my-project');
    });

    it('last line is the bottom border', () => {
      const agent = makeAgent();
      const lines = renderCard(agent, 0, 0, 30, false);
      expect(lines[lines.length - 1]).toContain('+');
    });
  });
});
