import chalk from 'chalk';
import { getCrawfishHires } from './crawfish-art.js';
import { renderLevelBar, renderTokenHistogram, formatTokenCount } from './token-viz.js';
import { horizontalLine } from './ansi.js';
import { LEVEL_THRESHOLDS, LEVEL_NAMES } from '../core/constants.js';
import type { AgentInfo } from '../core/types.js';

export function renderDetailView(agent: AgentInfo, allAgents: AgentInfo[], frame: number): string {
  const cols = process.stdout.columns ?? 80;
  const width = Math.min(cols, 80);

  const parts: string[] = [];

  // Header
  parts.push(chalk.bold(`Detail: ${agent.projectName}`));
  parts.push(chalk.dim(horizontalLine(width)));

  // Hires crawfish art
  const artLines = getCrawfishHires(agent.level, agent.state, frame);
  for (const artLine of artLines) {
    parts.push(artLine);
  }

  // Level info
  const levelIdx = agent.level - 1;
  const levelName = LEVEL_NAMES[levelIdx] ?? 'Unknown';
  parts.push('');
  parts.push(chalk.bold(`Level ${agent.level} - ${levelName}`));

  // Extended level bar
  parts.push(renderLevelBar(agent, width));

  // Progress to next level
  const nextThresholdIdx = agent.level;
  const nextThreshold = LEVEL_THRESHOLDS[nextThresholdIdx];
  if (nextThreshold !== undefined) {
    const remaining = nextThreshold - agent.tokenUsage;
    if (remaining > 0) {
      parts.push(chalk.dim(`  ${formatTokenCount(remaining)} tokens to next level`));
    } else {
      parts.push(chalk.green('  Ready to level up!'));
    }
  } else {
    parts.push(chalk.yellow('  Max level reached!'));
  }

  // Token histogram of all agents
  parts.push('');
  parts.push(chalk.dim('All agents:'));
  const histLines = renderTokenHistogram(allAgents, width);
  for (const line of histLines) {
    parts.push('  ' + line);
  }

  // Last exchange (up to 10 lines)
  if (agent.lastExchange) {
    parts.push('');
    parts.push(chalk.dim('Last exchange:'));
    const exchangeLines = agent.lastExchange.split('\n').slice(0, 10);
    for (const line of exchangeLines) {
      parts.push('  ' + line);
    }
  }

  // Timestamps
  parts.push('');
  const lastActive = new Date(agent.lastActivityAt).toLocaleTimeString();
  const started = new Date(agent.startedAt).toLocaleTimeString();
  parts.push(chalk.dim(`Last active: ${lastActive}  Started: ${started}`));

  // Footer
  parts.push('');
  parts.push(chalk.dim('[b]ack [q]uit'));

  return parts.join('\n');
}
