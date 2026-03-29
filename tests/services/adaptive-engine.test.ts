import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isBaselinePeriod,
  recalculateParams,
  getAdaptiveParams,
  recordDaySignals,
} from '../../src/services/adaptive-engine.js';
import { CONSERVATIVE_DEFAULTS, BASELINE_DAYS } from '../../src/core/constants.js';
import type { BaselineData, DaySignals } from '../../src/core/types.js';

function makeDaySignals(overrides: Partial<DaySignals> = {}): DaySignals {
  return {
    date: '2024-01-01',
    productiveAppTimeRatio: 0.7,
    sessionSwitchFrequency: 2,
    timerCompletionRate: 0.5,
    popoverFrequency: 1,
    signalIgnoreRate: 0.1,
    consecutiveSessions: 1,
    maxSessionLengthMin: 30,
    ...overrides,
  };
}

describe('isBaselinePeriod', () => {
  it('returns true when no baseline file exists', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const nonExistent = join(tmpDir, 'baseline.json');
      expect(isBaselinePeriod(nonExistent)).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns true when baseline has fewer than BASELINE_DAYS entries', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days: [makeDaySignals()],
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      expect(isBaselinePeriod(filePath)).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns false when baseline has BASELINE_DAYS or more entries', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const days = Array.from({ length: BASELINE_DAYS }, (_, i) =>
        makeDaySignals({ date: `2024-01-0${i + 1}` })
      );
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days,
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      expect(isBaselinePeriod(filePath)).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('recalculateParams', () => {
  it('returns conservative defaults when no baseline', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const nonExistent = join(tmpDir, 'baseline.json');
      const params = recalculateParams(nonExistent);
      expect(params).toEqual(CONSERVATIVE_DEFAULTS);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('sets signalFrequencyMultiplier to 0.5 for high ignore rate', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days: [makeDaySignals({ signalIgnoreRate: 0.7 })],
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      const params = recalculateParams(filePath);
      expect(params.signalFrequencyMultiplier).toBe(0.5);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('enables supportiveSilenceMode for low productive time + long session', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days: [makeDaySignals({ productiveAppTimeRatio: 0.2, maxSessionLengthMin: 90 })],
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      const params = recalculateParams(filePath);
      expect(params.supportiveSilenceMode).toBe(true);
      expect(params.signalIntensityLevel).toBe(1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('reduces signalIntensityLevel for high timer completion rate', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days: [makeDaySignals({ timerCompletionRate: 0.9 })],
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      const params = recalculateParams(filePath);
      expect(params.signalIntensityLevel).toBe(1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('enables hyperfocusAlert for many consecutive long sessions', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const filePath = join(tmpDir, 'baseline.json');
      const baseline: BaselineData = {
        startedAt: Date.now(),
        lastRecalcAt: Date.now(),
        days: [makeDaySignals({ consecutiveSessions: 3, maxSessionLengthMin: 45 })],
      };
      writeFileSync(filePath, JSON.stringify(baseline), 'utf8');
      const params = recalculateParams(filePath);
      expect(params.hyperfocusAlert).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('getAdaptiveParams', () => {
  it('returns conservative defaults during baseline period', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const nonExistent = join(tmpDir, 'baseline.json');
      const params = getAdaptiveParams(nonExistent);
      expect(params).toEqual(CONSERVATIVE_DEFAULTS);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('does not return the same object reference as CONSERVATIVE_DEFAULTS', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-adaptive-'));
    try {
      const nonExistent = join(tmpDir, 'baseline.json');
      const params = getAdaptiveParams(nonExistent);
      expect(params).not.toBe(CONSERVATIVE_DEFAULTS);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
