import { describe, it, expect } from 'vitest';
import { computeLevel, determineState, applyTokenDecay } from '../../src/services/agent-tracker.js';
import { WORKING_THRESHOLD_MS, IDLE_THRESHOLD_MS } from '../../src/core/constants.js';

describe('computeLevel', () => {
  it('returns 1 for 0 tokens', () => {
    expect(computeLevel(0)).toBe(1);
  });

  it('returns 1 for 500 tokens (below first threshold)', () => {
    expect(computeLevel(500)).toBe(1);
  });

  it('returns 2 for 1000 tokens (at second threshold)', () => {
    expect(computeLevel(1000)).toBe(2);
  });

  it('returns 3 for 10000 tokens (at third threshold)', () => {
    expect(computeLevel(10_000)).toBe(3);
  });

  it('returns 4 for 50000 tokens (at fourth threshold)', () => {
    expect(computeLevel(50_000)).toBe(4);
  });

  it('returns 5 for 200000 tokens (at fifth threshold)', () => {
    expect(computeLevel(200_000)).toBe(5);
  });

  it('returns 5 for tokens beyond the max threshold', () => {
    expect(computeLevel(999_999)).toBe(5);
  });
});

describe('determineState', () => {
  it('returns working when elapsed is less than WORKING_THRESHOLD_MS', () => {
    const now = Date.now();
    const lastActivity = now - (WORKING_THRESHOLD_MS - 1000);
    expect(determineState(lastActivity, now)).toBe('working');
  });

  it('returns working when elapsed is 0', () => {
    const now = Date.now();
    expect(determineState(now, now)).toBe('working');
  });

  it('returns idle when elapsed is between WORKING and IDLE thresholds', () => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    expect(determineState(fiveMinutesAgo, now)).toBe('idle');
  });

  it('returns sleeping when elapsed is >= IDLE_THRESHOLD_MS (20 minutes)', () => {
    const now = Date.now();
    const twentyMinutesAgo = now - 20 * 60 * 1000;
    expect(determineState(twentyMinutesAgo, now)).toBe('sleeping');
  });

  it('uses Date.now() when now is not provided', () => {
    const recentActivity = Date.now() - 1000;
    expect(determineState(recentActivity)).toBe('working');
  });
});

describe('applyTokenDecay', () => {
  it('returns tokens unchanged for working state', () => {
    const tokens = 10_000;
    const result = applyTokenDecay(tokens, 'working', 60 * 60 * 1000);
    expect(result).toBe(tokens);
  });

  it('applies some decay for idle state over 1 hour', () => {
    const tokens = 10_000;
    const oneHourMs = 60 * 60 * 1000;
    const result = applyTokenDecay(tokens, 'idle', oneHourMs);
    expect(result).toBeLessThan(tokens);
    expect(result).toBeGreaterThan(0);
  });

  it('applies more decay for sleeping state than idle state', () => {
    const tokens = 10_000;
    const oneHourMs = 60 * 60 * 1000;
    const idleResult = applyTokenDecay(tokens, 'idle', oneHourMs);
    const sleepingResult = applyTokenDecay(tokens, 'sleeping', oneHourMs);
    expect(sleepingResult).toBeLessThan(idleResult);
  });

  it('never returns negative tokens', () => {
    const result = applyTokenDecay(100, 'sleeping', 1000 * 60 * 60 * 24 * 365);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for 0 tokens regardless of state', () => {
    expect(applyTokenDecay(0, 'idle', 60 * 60 * 1000)).toBe(0);
    expect(applyTokenDecay(0, 'sleeping', 60 * 60 * 1000)).toBe(0);
  });
});
