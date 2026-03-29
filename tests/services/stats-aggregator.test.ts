import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock paths so stats files go to temp directory
vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/paths.js')>();
  return {
    ...original,
    getStatsFilePath: vi.fn((date: string) => original.getStatsFilePath(date)),
    ensureHomeDir: vi.fn(),
  };
});

const pathsMod = await import('../../src/core/paths.js');

describe('stats-aggregator', () => {
  let tmpDir: string;
  let originalGetStatsFilePath: typeof pathsMod.getStatsFilePath;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cf-stats-'));
    // Redirect stats files to temp directory
    vi.mocked(pathsMod.getStatsFilePath).mockImplementation(
      (date: string) => join(tmpDir, `${date}.json`)
    );
    vi.mocked(pathsMod.ensureHomeDir).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tmpDir, { recursive: true });
  });

  // Re-import after mocking
  async function getModule() {
    return import('../../src/services/stats-aggregator.js');
  }

  it('getTodayStats returns fresh stats with focusMinutes=0 and completedSessions=0', async () => {
    const { getTodayStats } = await getModule();
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(0);
    expect(stats.completedSessions).toBe(0);
    expect(typeof stats.date).toBe('string');
    expect(stats.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getTodayStats returns existing stats when file exists', async () => {
    const { getTodayStats } = await getModule();
    const today = new Date().toISOString().slice(0, 10);
    const filePath = join(tmpDir, `${today}.json`);
    const existing = { focusMinutes: 30, completedSessions: 2, date: today };
    writeFileSync(filePath, JSON.stringify(existing), 'utf8');

    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(30);
    expect(stats.completedSessions).toBe(2);
  });

  it('recordFocusMinutes increments focusMinutes', async () => {
    const { recordFocusMinutes, getTodayStats } = await getModule();
    recordFocusMinutes(25);
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(25);
  });

  it('recordFocusMinutes accumulates across multiple calls', async () => {
    const { recordFocusMinutes, getTodayStats } = await getModule();
    recordFocusMinutes(25);
    recordFocusMinutes(10);
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(35);
  });

  it('recordCompletedSession increments completedSessions', async () => {
    const { recordCompletedSession, getTodayStats } = await getModule();
    recordCompletedSession();
    const stats = getTodayStats();
    expect(stats.completedSessions).toBe(1);
  });

  it('recordCompletedSession increments on each call', async () => {
    const { recordCompletedSession, getTodayStats } = await getModule();
    recordCompletedSession();
    recordCompletedSession();
    recordCompletedSession();
    const stats = getTodayStats();
    expect(stats.completedSessions).toBe(3);
  });

  it('getStatsForDate returns null when file does not exist', async () => {
    const { getStatsForDate } = await getModule();
    const result = getStatsForDate('2000-01-01');
    expect(result).toBeNull();
  });

  it('getStatsForDate returns stats when file exists', async () => {
    const { getStatsForDate } = await getModule();
    const date = '2024-06-15';
    const filePath = join(tmpDir, `${date}.json`);
    const data = { focusMinutes: 90, completedSessions: 3, date };
    writeFileSync(filePath, JSON.stringify(data), 'utf8');

    const result = getStatsForDate(date);
    expect(result).toEqual(data);
  });
});
