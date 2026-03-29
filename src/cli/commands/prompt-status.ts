import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_STATE_FILE } from '../../core/paths.js';
import type { PromptState } from '../../core/types.js';

export function registerPromptStatus(program: Command): void {
  program
    .command('prompt-status')
    .description('Output prompt status string for PS1/RPROMPT integration')
    .action(() => {
      try {
        if (!existsSync(PROMPT_STATE_FILE)) {
          process.stdout.write('');
          return;
        }

        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        const state: PromptState = JSON.parse(raw);
        const parts: string[] = [];

        // 1. Timer (priority)
        if (state.timer) {
          parts.push(state.timer);
        }

        // 2. Badge (momentum number)
        if (state.badge !== null && state.badge !== undefined) {
          parts.push(`x${state.badge}`);
        }

        // 3. Return-to indicator
        if (state.returnTo) {
          parts.push(`<- ${state.returnTo}`);
        }

        // 4. Fallback: timeOfDay warmth
        if (parts.length === 0 && (state.timeOfDay || state.warmth)) {
          parts.push(`${state.timeOfDay} ${state.warmth}`.trim());
        }

        process.stdout.write(parts.join(' | '));
      } catch {
        process.stdout.write('');
      }
    });
}
