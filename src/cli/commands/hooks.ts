import { Command } from 'commander';
import chalk from 'chalk';

export function registerHooks(program: Command): void {
  program
    .command('install-hooks')
    .description('Install crayfish-farm Claude Code hooks into ~/.claude/settings.json')
    .action(async () => {
      const { installHooks } = await import('../../services/hook-installer.js');
      const result = installHooks();

      if (result.backedUp) {
        console.log(chalk.dim('Backed up existing settings.json'));
      }

      if (result.success) {
        console.log(chalk.green('Hooks installed successfully.'));
      } else {
        console.error(chalk.red('Failed to install hooks.'));
        process.exit(1);
      }
    });

  program
    .command('uninstall-hooks')
    .description('Remove crayfish-farm hooks from ~/.claude/settings.json')
    .action(async () => {
      const { uninstallHooks } = await import('../../services/hook-installer.js');
      const result = uninstallHooks();

      if (result.success) {
        console.log(chalk.green('Hooks removed successfully.'));
      } else {
        console.error(chalk.red('Failed to remove hooks.'));
        process.exit(1);
      }
    });
}
