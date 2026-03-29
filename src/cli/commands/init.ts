import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { ensureHomeDir } from '../../core/paths.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize crayfish-farm configuration')
    .option('--full', 'print shell integration snippets')
    .action(async (options: { full?: boolean }) => {
      ensureHomeDir();

      const { CONFIG_FILE } = await import('../../core/paths.js');
      if (!existsSync(CONFIG_FILE)) {
        const { getDefaultConfig, saveConfig } = await import('../../core/config.js');
        const defaultConfig = getDefaultConfig();
        saveConfig(defaultConfig);
        console.log(chalk.green('Created default configuration.'));
      } else {
        console.log(chalk.dim('Configuration already exists.'));
      }

      console.log(chalk.green('crayfish-farm initialized successfully.'));

      if (options.full) {
        const { generateZshIntegration, generateBashIntegration } =
          await import('../../services/shell-integrator.js');

        console.log('');
        console.log(chalk.bold('Zsh integration (add to ~/.zshrc):'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(generateZshIntegration());

        console.log('');
        console.log(chalk.bold('Bash integration (add to ~/.bashrc):'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(generateBashIntegration());
      }
    });
}
