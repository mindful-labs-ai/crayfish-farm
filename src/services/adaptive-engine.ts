import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { BASELINE_DAYS, CONSERVATIVE_DEFAULTS } from '../core/constants.js';
import { BASELINE_FILE } from '../core/paths.js';
import { logInfo } from '../core/logger.js';
import type { AdaptiveParams, BaselineData, DaySignals } from '../core/types.js';

export function loadBaseline(filePath?: string): BaselineData | null {
  const target = filePath ?? BASELINE_FILE;
  try {
    if (!existsSync(target)) return null;
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as BaselineData;
  } catch {
    return null;
  }
}

export function isBaselinePeriod(filePath?: string): boolean {
  const baseline = loadBaseline(filePath);
  if (!baseline) return true;
  return baseline.days.length < BASELINE_DAYS;
}

export function recordDaySignals(signals: DaySignals, filePath?: string): void {
  const target = filePath ?? BASELINE_FILE;
  const now = Date.now();
  let baseline = loadBaseline(filePath);

  if (!baseline) {
    baseline = {
      startedAt: now,
      lastRecalcAt: now,
      days: [],
    };
  }

  baseline.days.push(signals);
  baseline.lastRecalcAt = now;

  try {
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(baseline), 'utf8');
    renameSync(tmp, target);
  } catch {
    // silent failure
  }
}

export function recalculateParams(filePath?: string): AdaptiveParams {
  const baseline = loadBaseline(filePath);
  const params: AdaptiveParams = { ...CONSERVATIVE_DEFAULTS };

  if (!baseline || baseline.days.length === 0) {
    return params;
  }

  const latest = baseline.days[baseline.days.length - 1];

  // Rule 1: High ignore rate
  if (latest.signalIgnoreRate > 0.6) {
    params.signalFrequencyMultiplier = 0.5;
  }

  // Rule 2: Low productive time + long duration
  if (latest.productiveAppTimeRatio < 0.3 && latest.maxSessionLengthMin > 60) {
    params.supportiveSilenceMode = true;
    params.signalIntensityLevel = 1;
  }

  // Rule 3: High timer completion rate
  if (latest.timerCompletionRate > 0.8) {
    params.signalIntensityLevel = 1;
  }

  // Rule 4: Many consecutive long sessions
  if (latest.consecutiveSessions >= 3 && latest.maxSessionLengthMin > 30) {
    params.hyperfocusAlert = true;
  }

  // Clamp signalFrequencyMultiplier to [0.5, 1.5]
  params.signalFrequencyMultiplier = Math.max(
    0.5,
    Math.min(1.5, params.signalFrequencyMultiplier)
  );

  logInfo('adaptive-engine: params recalculated', { params });
  return params;
}

export function getAdaptiveParams(filePath?: string): AdaptiveParams {
  if (isBaselinePeriod(filePath)) {
    return { ...CONSERVATIVE_DEFAULTS };
  }
  return recalculateParams(filePath);
}

export function isBadDayDetected(signals?: DaySignals, filePath?: string): boolean {
  if (signals) {
    return signals.productiveAppTimeRatio < 0.3 && signals.maxSessionLengthMin > 60;
  }

  const baseline = loadBaseline(filePath);
  if (!baseline || baseline.days.length === 0) return false;

  const latest = baseline.days[baseline.days.length - 1];
  return latest.productiveAppTimeRatio < 0.3 && latest.maxSessionLengthMin > 60;
}
