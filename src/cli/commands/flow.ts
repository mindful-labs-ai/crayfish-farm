import { Command } from 'commander';
import chalk from 'chalk';

export function registerFlow(program: Command): void {
  program
    .command('flow')
    .description('Enable or disable flow mode')
    .argument('<state>', 'on or off')
    .action(async (state: string) => {
      if (state !== 'on' && state !== 'off') {
        console.error(chalk.red('Error: state must be "on" or "off"'));
        process.exit(1);
      }

      const { setFlowMode } = await import('../../services/flow-protection.js');
      const enabled = state === 'on';
      setFlowMode(enabled);

      if (enabled) {
        console.log(chalk.green('Flow mode: ON'));
      } else {
        console.log(chalk.yellow('Flow mode: OFF'));
      }
    });
}
