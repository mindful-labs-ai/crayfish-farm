import chalk from 'chalk';
import { getCrawfishArt } from './crawfish-art.js';
import { renderLevelBar } from './token-viz.js';
import { displayWidth, truncateToWidth, centerToWidth } from './text-utils.js';
import { boxTop, boxBottom, boxSide } from './ansi.js';
import type { AgentInfo } from '../core/types.js';

const STATE_INDICATOR: Record<string, string> = {
  working: chalk.green('●'),
  idle: chalk.yellow('◐'),
  sleeping: chalk.dim('○'),
};

export function describeActivity(agent: AgentInfo, maxWidth: number): string {
  switch (agent.state) {
    case 'sleeping':
      return '휴식 중...';
    case 'idle':
      return '대기 중...';
    case 'working':
      if (!agent.lastExchange) {
        return '작업 완료!';
      }
      return summarizeExchange(agent.lastExchange, maxWidth);
    default:
      return '';
  }
}

export function summarizeExchange(text: string, maxLen: number): string {
  const lines = text.split('\n');

  let meaningful = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('##')) continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('|')) continue;
    meaningful = trimmed;
    break;
  }

  if (!meaningful) return '';

  // Strip markdown formatting
  let cleaned = meaningful
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\|/g, '')
    .replace(/#+\s*/g, '');

  cleaned = cleaned.trim();

  if (displayWidth(cleaned) > maxLen) {
    return truncateToWidth(cleaned, maxLen);
  }

  return cleaned;
}

export function renderCard(
  agent: AgentInfo,
  _index: number,
  frame: number,
  innerWidth: number,
  flash: boolean,
): string[] {
  const outerWidth = innerWidth + 2;
  const lines: string[] = [];

  // Top border with project name
  const topBorder = flash
    ? chalk.yellow(boxTop(outerWidth, agent.projectName))
    : boxTop(outerWidth, agent.projectName);
  lines.push(topBorder);

  // Crawfish art (centered)
  const artLines = getCrawfishArt(agent.level, agent.state, frame);
  for (const artLine of artLines) {
    const centered = centerToWidth(artLine, innerWidth);
    lines.push(`${boxSide()}${centered}${boxSide()}`);
  }

  // Separator
  const levelBar = renderLevelBar(agent, innerWidth);
  lines.push(`${boxSide()}${levelBar.padEnd(innerWidth)}${boxSide()}`);

  // Activity line with state indicator
  const indicator = STATE_INDICATOR[agent.state] ?? ' ';
  const maxActivityWidth = innerWidth - 3; // space for indicator + space
  const activity = describeActivity(agent, maxActivityWidth);
  const activityLine = `${indicator} ${activity}`;
  const paddedActivity = activityLine.padEnd(innerWidth);
  lines.push(`${boxSide()}${paddedActivity}${boxSide()}`);

  // Bottom border
  lines.push(boxBottom(outerWidth));

  return lines;
}
