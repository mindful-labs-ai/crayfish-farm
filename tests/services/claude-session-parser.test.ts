import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseJsonlFile } from '../../src/services/claude-session-parser.js';

const FIXTURE_DIR = join(
  new URL('../../tests/fixtures/projects/-test-project', import.meta.url).pathname
);
const FIXTURE_FILE = join(FIXTURE_DIR, 'test-session.jsonl');

describe('parseJsonlFile with fixture file', () => {
  it('returns positive totalTokens', () => {
    const result = parseJsonlFile(FIXTURE_FILE);
    // The fixture has 3 assistant messages:
    // msg1: 100+50=150, msg2: 200+100=300, msg3: 150+75=225 => total=675
    expect(result.totalTokens).toBe(675);
  });

  it('returns the lastExchange text from the last assistant message', () => {
    const result = parseJsonlFile(FIXTURE_FILE);
    expect(result.lastExchange).toBe('Final answer with multiple parts.');
  });

  it('returns a positive lineCount', () => {
    const result = parseJsonlFile(FIXTURE_FILE);
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.lineCount).toBe(3);
  });

  it('returns a positive lastAssistantTimestamp', () => {
    const result = parseJsonlFile(FIXTURE_FILE);
    expect(result.lastAssistantTimestamp).toBeGreaterThan(0);
  });

  it('picks the timestamp from the last assistant message', () => {
    const result = parseJsonlFile(FIXTURE_FILE);
    // Last message timestamp is 2024-01-01T00:02:00Z
    const expected = Date.parse('2024-01-01T00:02:00Z');
    expect(result.lastAssistantTimestamp).toBe(expected);
  });
});

describe('parseJsonlFile with nonexistent file', () => {
  it('returns zero totalTokens', () => {
    const result = parseJsonlFile('/nonexistent/path/session.jsonl');
    expect(result.totalTokens).toBe(0);
  });

  it('returns empty lastExchange', () => {
    const result = parseJsonlFile('/nonexistent/path/session.jsonl');
    expect(result.lastExchange).toBe('');
  });

  it('returns zero lineCount', () => {
    const result = parseJsonlFile('/nonexistent/path/session.jsonl');
    expect(result.lineCount).toBe(0);
  });

  it('returns zero lastAssistantTimestamp', () => {
    const result = parseJsonlFile('/nonexistent/path/session.jsonl');
    expect(result.lastAssistantTimestamp).toBe(0);
  });
});
