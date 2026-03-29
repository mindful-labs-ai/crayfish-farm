import chalk from 'chalk';
import { renderCard } from './card-renderer.js';
import { horizontalLine } from './ansi.js';
import type { AgentInfo, TimerState, DayStats, PromptState } from '../core/types.js';

export function getCardDimensions(): { inner: number; outer: number; columns: number } {
  const cols = process.stdout.columns ?? 80;

  if (cols >= 90) {
    const inner = Math.min(60, Math.max(28, Math.floor((cols - 6) / 2) - 2));
    return { inner, outer: inner + 2, columns: 2 };
  } else {
    const inner = Math.min(60, Math.max(28, cols - 6));
    return { inner, outer: inner + 2, columns: 1 };
  }
}

function formatTimer(timer: TimerState | null): string {
  if (!timer || !timer.running) return '';

  const remainingMs = timer.durationMs - (Date.now() - timer.startedAt);
  if (remainingMs <= 0) return chalk.dim('00:00');

  const totalSec = Math.ceil(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  if (timer.flowMode) {
    return chalk.cyan(`${timeStr} [flow]`);
  }
  return chalk.green(timeStr);
}

function formatDopamineState(prompt: PromptState | null): string {
  if (!prompt) return '';
  return chalk.dim(`${prompt.timeOfDay} ${prompt.warmth}`);
}

export function renderGridView(
  agents: AgentInfo[],
  timer: TimerState | null,
  stats: DayStats | null,
  promptState: PromptState | null,
  frame: number,
  tokenDeltas: Map<string, number>,
  flashSet: Set<string>,
): string {
  const cols = process.stdout.columns ?? 80;
  const { inner, columns } = getCardDimensions();

  const parts: string[] = [];

  // Header
  const timerStr = formatTimer(timer);
  const dopamineStr = formatDopamineState(promptState);
  const headerRight = [dopamineStr, timerStr].filter(Boolean).join('  ');
  const headerTitle = chalk.bold('🦞 crayfish-farm Agent Dashboard');
  const headerLine = headerRight
    ? `${headerTitle}  ${headerRight}`
    : headerTitle;
  parts.push(headerLine);

  // Horizontal line
  parts.push(chalk.dim(horizontalLine(Math.min(cols, 80))));

  // Limit to 4 most recently active agents
  const MAX_TUI_AGENTS = 4;
  const displayed = [...agents]
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, MAX_TUI_AGENTS);

  // Cards
  if (displayed.length === 0) {
    parts.push(chalk.dim('  No active Claude sessions found.'));
    parts.push('');
  } else if (columns === 1) {
    for (let i = 0; i < displayed.length; i++) {
      const agent = displayed[i]!;
      const flash = flashSet.has(agent.sessionId);
      const cardLines = renderCard(agent, i, frame, inner, flash);
      for (const line of cardLines) {
        parts.push('  ' + line);
      }
      parts.push('');
    }
  } else {
    // 2-column layout: pair agents
    for (let i = 0; i < displayed.length; i += 2) {
      const leftAgent = displayed[i]!;
      const rightAgent = displayed[i + 1];

      const leftFlash = flashSet.has(leftAgent.sessionId);
      const leftLines = renderCard(leftAgent, i, frame, inner, leftFlash);

      if (!rightAgent) {
        for (const line of leftLines) {
          parts.push('  ' + line);
        }
      } else {
        const rightFlash = flashSet.has(rightAgent.sessionId);
        const rightLines = renderCard(rightAgent, i + 1, frame, inner, rightFlash);
        const maxLen = Math.max(leftLines.length, rightLines.length);
        for (let j = 0; j < maxLen; j++) {
          const left = leftLines[j] ?? ' '.repeat(inner + 2);
          const right = rightLines[j] ?? '';
          parts.push('  ' + left + '  ' + right);
        }
      }
      parts.push('');
    }
  }

  // Footer separator
  parts.push(chalk.dim(horizontalLine(Math.min(cols, 80))));

  // Stats line
  const focusMin = stats?.focusMinutes ?? 0;
  const sessions = stats?.completedSessions ?? 0;
  const statsStr = chalk.dim(`Today: ${focusMin}min focus | ${sessions} sessions`);
  const hints = chalk.dim('[q]uit [r]efresh [t]imer [1-9]detail');
  parts.push(`${statsStr}  ${hints}`);

  return parts.join('\n');
}
