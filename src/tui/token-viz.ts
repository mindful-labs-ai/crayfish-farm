import chalk from 'chalk';
import { LEVEL_THRESHOLDS, LEVEL_NAMES, LEVEL_COLORS } from '../core/constants.js';
import type { AgentInfo } from '../core/types.js';

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(tokens));
}

export function renderLevelBar(agent: AgentInfo, width: number): string {
  const level = agent.level;
  const tokens = agent.tokenUsage;

  const levelIdx = level - 1;
  const levelName = LEVEL_NAMES[levelIdx] ?? 'Unknown';
  const colorName = LEVEL_COLORS[levelIdx] ?? 'gray';

  const currentThreshold = LEVEL_THRESHOLDS[levelIdx] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] ?? 200_000;

  let ratio: number;
  if (level >= LEVEL_THRESHOLDS.length) {
    ratio = 1;
  } else {
    const range = nextThreshold - currentThreshold;
    ratio = range > 0 ? (tokens - currentThreshold) / range : 1;
  }
  ratio = Math.max(0, Math.min(1, ratio));

  const prefix = `Lv${level} ${levelName} `;
  const suffix = ` ${formatTokenCount(tokens)}`;
  const barWidth = Math.max(1, width - prefix.length - suffix.length);
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

  const filledStr = '█'.repeat(filled);
  const emptyStr = '░'.repeat(empty);

  const colorFn = (s: string): string => {
    switch (colorName) {
      case 'gray': return chalk.gray(s);
      case 'cyan': return chalk.cyan(s);
      case 'green': return chalk.green(s);
      case 'yellow': return chalk.yellow(s);
      case 'red': return chalk.red(s);
      default: return s;
    }
  };

  return prefix + colorFn(filledStr + emptyStr) + suffix;
}

export function renderTokenDelta(delta: number): string {
  if (delta > 100) {
    return chalk.green(`+${formatTokenCount(delta)}↑`);
  }
  if (delta < -100) {
    return chalk.red(`-${formatTokenCount(Math.abs(delta))}↓`);
  }
  return '';
}

export function renderTokenHistogram(agents: AgentInfo[], width: number): string[] {
  if (agents.length === 0) return [];

  const maxTokens = Math.max(...agents.map((a) => a.tokenUsage), 1);

  return agents.map((agent) => {
    const label = agent.projectName.slice(0, 12).padEnd(12);
    const countStr = formatTokenCount(agent.tokenUsage);
    const barWidth = Math.max(1, width - label.length - countStr.length - 4);
    const filled = Math.round((agent.tokenUsage / maxTokens) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${label}  ${bar}  ${countStr}`;
  });
}
