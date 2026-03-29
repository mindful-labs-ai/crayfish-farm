import { Command } from 'commander';

export function registerDash(program: Command): void {
  program
    .command('dash')
    .description('Open the interactive TUI dashboard')
    .action(async () => {
      const { startDashboard } = await import('../../tui/dashboard.js');
      await startDashboard();
    });
}
