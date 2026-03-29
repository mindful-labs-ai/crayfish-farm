import { Command } from 'commander';
import chalk from 'chalk';
import { rmSync } from 'node:fs';
import { CRAYFISH_FARM_HOME } from '../../core/paths.js';

export function registerReset(program: Command): void {
  program
    .command('reset')
    .description('Reset all crayfish-farm data and configuration')
    .option('--force', 'skip confirmation prompt')
    .action((options: { force?: boolean }) => {
      if (!options.force) {
        console.log(chalk.yellow('Warning: This will delete all crayfish-farm data and configuration.'));
        console.log(chalk.dim(`Directory: ${CRAYFISH_FARM_HOME}`));
        console.log(chalk.dim('Use --force to confirm.'));
        return;
      }

      try {
        rmSync(CRAYFISH_FARM_HOME, { recursive: true, force: true });
        console.log(chalk.green('crayfish-farm data reset successfully.'));
      } catch (err) {
        console.error(chalk.red(`Reset failed: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });
}
