import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { DayStats } from '../core/types.js';
import { getStatsFilePath, ensureHomeDir } from '../core/paths.js';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStats(filePath: string): DayStats | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as DayStats;
  } catch {
    return null;
  }
}

function writeStats(stats: DayStats, filePath: string): void {
  try {
    ensureHomeDir();
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(stats), 'utf8');
    renameSync(tmp, filePath);
  } catch {
    // silent failure
  }
}

export function getTodayStats(): DayStats {
  const date = getTodayDateString();
  const filePath = getStatsFilePath(date);
  const existing = readStats(filePath);

  if (existing) {
    return existing;
  }

  return { focusMinutes: 0, completedSessions: 0, date };
}

export function recordFocusMinutes(minutes: number): void {
  const date = getTodayDateString();
  const filePath = getStatsFilePath(date);
  const stats = getTodayStats();
  stats.focusMinutes += minutes;
  writeStats(stats, filePath);
}

export function recordCompletedSession(): void {
  const date = getTodayDateString();
  const filePath = getStatsFilePath(date);
  const stats = getTodayStats();
  stats.completedSessions++;
  writeStats(stats, filePath);
}

export function getStatsForDate(date: string): DayStats | null {
  const filePath = getStatsFilePath(date);
  return readStats(filePath);
}
