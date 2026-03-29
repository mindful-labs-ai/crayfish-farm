import { describe, it, expect } from 'vitest';
import {
  LEVEL_THRESHOLDS,
  FIBONACCI,
  TIMER_PRESETS,
  CONSERVATIVE_DEFAULTS,
} from '../../src/core/constants.js';

describe('LEVEL_THRESHOLDS', () => {
  it('has 5 entries', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(5);
  });

  it('is in ascending order', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
    }
  });

  it('starts at 0', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
  });
});

describe('FIBONACCI', () => {
  it('equals [3,5,8,13,21,34,55,89]', () => {
    expect(FIBONACCI).toEqual([3, 5, 8, 13, 21, 34, 55, 89]);
  });

  it('has 8 entries', () => {
    expect(FIBONACCI).toHaveLength(8);
  });
});

describe('TIMER_PRESETS', () => {
  it('has a pomodoro preset', () => {
    expect(TIMER_PRESETS).toHaveProperty('pomodoro');
    expect(TIMER_PRESETS.pomodoro).toMatchObject({ focus: 25, break: 5 });
  });

  it('has a desktime preset', () => {
    expect(TIMER_PRESETS).toHaveProperty('desktime');
    expect(TIMER_PRESETS.desktime).toMatchObject({ focus: 52, break: 17 });
  });

  it('has an ultradian preset', () => {
    expect(TIMER_PRESETS).toHaveProperty('ultradian');
    expect(TIMER_PRESETS.ultradian).toMatchObject({ focus: 90, break: 20 });
  });

  it('each preset has focus and break keys', () => {
    for (const preset of Object.values(TIMER_PRESETS)) {
      expect(preset).toHaveProperty('focus');
      expect(preset).toHaveProperty('break');
    }
  });
});

describe('CONSERVATIVE_DEFAULTS', () => {
  it('has signalFrequencyMultiplier', () => {
    expect(typeof CONSERVATIVE_DEFAULTS.signalFrequencyMultiplier).toBe('number');
  });

  it('has signalIntensityLevel', () => {
    expect([1, 2, 3]).toContain(CONSERVATIVE_DEFAULTS.signalIntensityLevel);
  });

  it('has quietModeThreshold', () => {
    expect(typeof CONSERVATIVE_DEFAULTS.quietModeThreshold).toBe('number');
  });

  it('has contextDetailLevel', () => {
    expect(['brief', 'normal', 'detailed']).toContain(CONSERVATIVE_DEFAULTS.contextDetailLevel);
  });

  it('has supportiveSilenceMode as boolean', () => {
    expect(typeof CONSERVATIVE_DEFAULTS.supportiveSilenceMode).toBe('boolean');
  });

  it('has hyperfocusAlert as boolean', () => {
    expect(typeof CONSERVATIVE_DEFAULTS.hyperfocusAlert).toBe('boolean');
  });
});
