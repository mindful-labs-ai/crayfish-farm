import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_STATE_FILE } from '../../core/paths.js';
import type { PromptState } from '../../core/types.js';

export function registerTmuxStatus(program: Command): void {
  program
    .command('tmux-status')
    .description('Output tmux status-right string with color codes')
    .action(() => {
      try {
        if (!existsSync(PROMPT_STATE_FILE)) {
          process.stdout.write('');
          return;
        }

        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        const state: PromptState = JSON.parse(raw);
        const parts: string[] = [];

        // Timer
        if (state.timer) {
          parts.push(`#[fg=green]${state.timer}#[default]`);
        }

        // Badge
        if (state.badge !== null && state.badge !== undefined) {
          parts.push(`#[fg=yellow]x${state.badge}#[default]`);
        }

        // Return-to
        if (state.returnTo) {
          parts.push(`#[fg=cyan]<- ${state.returnTo}#[default]`);
        }

        // Fallback: timeOfDay warmth
        if (parts.length === 0 && (state.timeOfDay || state.warmth)) {
          const tod = `${state.timeOfDay} ${state.warmth}`.trim();
          parts.push(`#[fg=white,dim]${tod}#[default]`);
        }

        process.stdout.write(parts.join(' | '));
      } catch {
        process.stdout.write('');
      }
    });
}
