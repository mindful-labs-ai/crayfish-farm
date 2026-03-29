import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  startTimer,
  stopTimer,
  getTimerStatus,
  applyPreset,
  getRemainingMs,
  isTimerComplete,
} from '../../src/services/timer-engine.js';

describe('timer-engine', () => {
  let tmpDir: string;
  let timerFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cf-timer-'));
    timerFile = join(tmpDir, 'timer-state.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  describe('startTimer', () => {
    it('creates a running timer state', () => {
      const state = startTimer(25, timerFile);
      expect(state.running).toBe(true);
    });

    it('sets durationMs based on minutes', () => {
      const state = startTimer(25, timerFile);
      expect(state.durationMs).toBe(25 * 60 * 1000);
    });

    it('sets startedAt to approximately now', () => {
      const before = Date.now();
      const state = startTimer(25, timerFile);
      const after = Date.now();
      expect(state.startedAt).toBeGreaterThanOrEqual(before);
      expect(state.startedAt).toBeLessThanOrEqual(after);
    });

    it('sets flowMode to false', () => {
      const state = startTimer(25, timerFile);
      expect(state.flowMode).toBe(false);
    });

    it('sets pausedAt to null', () => {
      const state = startTimer(25, timerFile);
      expect(state.pausedAt).toBeNull();
    });

    it('persists state to file', () => {
      startTimer(30, timerFile);
      const read = getTimerStatus(timerFile);
      expect(read).not.toBeNull();
      expect(read!.running).toBe(true);
      expect(read!.durationMs).toBe(30 * 60 * 1000);
    });
  });

  describe('stopTimer', () => {
    it('stops a running timer', () => {
      startTimer(25, timerFile);
      const state = stopTimer(timerFile);
      expect(state.running).toBe(false);
    });

    it('preserves durationMs from existing state', () => {
      startTimer(45, timerFile);
      const state = stopTimer(timerFile);
      expect(state.durationMs).toBe(45 * 60 * 1000);
    });

    it('returns stopped state even when no file exists', () => {
      const nonExistent = join(tmpDir, 'no-file.json');
      const state = stopTimer(nonExistent);
      expect(state.running).toBe(false);
      expect(state.durationMs).toBe(0);
    });

    it('sets pausedAt to null', () => {
      startTimer(25, timerFile);
      const state = stopTimer(timerFile);
      expect(state.pausedAt).toBeNull();
    });
  });

  describe('getRemainingMs', () => {
    it('returns 0 when no timer file exists', () => {
      const nonExistent = join(tmpDir, 'no-file.json');
      expect(getRemainingMs(nonExistent)).toBe(0);
    });

    it('returns approximately durationMs right after start', () => {
      startTimer(25, timerFile);
      const remaining = getRemainingMs(timerFile);
      const expected = 25 * 60 * 1000;
      // Allow 100ms tolerance for test execution time
      expect(remaining).toBeLessThanOrEqual(expected);
      expect(remaining).toBeGreaterThan(expected - 100);
    });

    it('returns less over time', async () => {
      startTimer(25, timerFile);
      const r1 = getRemainingMs(timerFile);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const r2 = getRemainingMs(timerFile);
      expect(r2).toBeLessThan(r1);
    });
  });

  describe('isTimerComplete', () => {
    it('returns false when no timer file exists', () => {
      const nonExistent = join(tmpDir, 'no-file.json');
      expect(isTimerComplete(nonExistent)).toBe(false);
    });

    it('returns false for a freshly started timer', () => {
      startTimer(25, timerFile);
      expect(isTimerComplete(timerFile)).toBe(false);
    });

    it('returns true for a timer with 0 duration (instant complete)', () => {
      // A timer with 0 duration started in the past is complete
      const { writeFileSync } = require('node:fs');
      const state = {
        running: true,
        startedAt: Date.now() - 1000,
        durationMs: 0,
        preset: 'pomodoro',
        flowMode: false,
        pausedAt: null,
      };
      writeFileSync(timerFile, JSON.stringify(state), 'utf8');
      expect(isTimerComplete(timerFile)).toBe(true);
    });

    it('returns false for a stopped timer even if time has elapsed', () => {
      const { writeFileSync } = require('node:fs');
      const state = {
        running: false,
        startedAt: Date.now() - 1000,
        durationMs: 0,
        preset: 'pomodoro',
        flowMode: false,
        pausedAt: null,
      };
      writeFileSync(timerFile, JSON.stringify(state), 'utf8');
      expect(isTimerComplete(timerFile)).toBe(false);
    });
  });

  describe('applyPreset', () => {
    it('starts a timer with pomodoro preset (25 minutes)', () => {
      const state = applyPreset('pomodoro', timerFile);
      expect(state.running).toBe(true);
      expect(state.durationMs).toBe(25 * 60 * 1000);
    });

    it('starts a timer with desktime preset (52 minutes)', () => {
      const state = applyPreset('desktime', timerFile);
      expect(state.running).toBe(true);
      expect(state.durationMs).toBe(52 * 60 * 1000);
    });

    it('starts a timer with ultradian preset (90 minutes)', () => {
      const state = applyPreset('ultradian', timerFile);
      expect(state.running).toBe(true);
      expect(state.durationMs).toBe(90 * 60 * 1000);
    });

    it('throws an error for unknown preset', () => {
      expect(() => applyPreset('unknown-preset', timerFile)).toThrow(
        'Unknown timer preset: unknown-preset'
      );
    });

    it('throws for empty string preset', () => {
      expect(() => applyPreset('', timerFile)).toThrow();
    });
  });
});
