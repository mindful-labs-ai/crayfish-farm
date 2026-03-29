import { Command } from 'commander';
import chalk from 'chalk';

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function renderProgressBar(remainingMs: number, totalMs: number, width = 20): string {
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '[' + chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ']';
}

export function registerTimer(program: Command): void {
  const timer = program
    .command('timer')
    .description('Focus timer management');

  timer
    .command('start [minutes]')
    .description('Start the focus timer')
    .action(async (minutesArg?: string) => {
      const { startTimer } = await import('../../services/timer-engine.js');
      let minutes: number | undefined;
      if (minutesArg !== undefined) {
        minutes = parseFloat(minutesArg);
        if (isNaN(minutes) || minutes <= 0) {
          console.error(chalk.red('Error: minutes must be a positive number'));
          process.exit(1);
        }
      }
      const state = startTimer(minutes);
      const durationMin = Math.round(state.durationMs / 60000);
      console.log(chalk.green(`Timer started: ${durationMin} minutes (${state.preset})`));
    });

  timer
    .command('stop')
    .description('Stop the focus timer')
    .action(async () => {
      const { stopTimer } = await import('../../services/timer-engine.js');
      stopTimer();
      console.log(chalk.yellow('Timer stopped.'));
    });

  timer
    .command('status')
    .description('Show timer status with progress bar')
    .action(async () => {
      const { getTimerStatus, getRemainingMs } = await import('../../services/timer-engine.js');
      const state = getTimerStatus();
      if (!state) {
        console.log(chalk.dim('No timer state found.'));
        return;
      }

      if (!state.running) {
        console.log(chalk.dim('Timer is stopped.'));
        return;
      }

      const remaining = getRemainingMs();
      const bar = renderProgressBar(remaining, state.durationMs);
      const pct = state.durationMs > 0
        ? Math.round(((state.durationMs - remaining) / state.durationMs) * 100)
        : 0;

      console.log(`${bar} ${formatDuration(remaining)} remaining (${pct}%)`);
      console.log(chalk.dim(`Preset: ${state.preset}${state.flowMode ? ' | ' + chalk.cyan('[flow mode]') : ''}`));
    });

  timer
    .command('preset <name>')
    .description('Apply a named timer preset (pomodoro, desktime, ultradian)')
    .action(async (name: string) => {
      const { applyPreset } = await import('../../services/timer-engine.js');
      try {
        const state = applyPreset(name);
        const durationMin = Math.round(state.durationMs / 60000);
        console.log(chalk.green(`Preset '${name}' applied: ${durationMin} minutes`));
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
