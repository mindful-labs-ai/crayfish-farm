import { Command } from 'commander';
import chalk from 'chalk';
import type { AgentInfo } from '../../core/types.js';

export function registerWhere(program: Command): void {
  program
    .command('where')
    .description('Show working agents and their last exchange context')
    .option('--brief', 'only show project names')
    .action(async (options: { brief?: boolean }) => {
      let discoverAgents: () => AgentInfo[];
      try {
        const mod = await import('../../services/agent-tracker.js');
        discoverAgents = mod.discoverAgents;
      } catch {
        console.error(chalk.red('Error: agent-tracker service not available'));
        process.exit(1);
      }

      const agents = discoverAgents();
      const active = agents.filter((a) => a.state === 'working' || a.state === 'idle');

      if (active.length === 0) {
        console.log(chalk.dim('No active agents found.'));
        return;
      }

      console.log(chalk.cyan('어디까지 했더라?') + chalk.dim(' (Where were we?)'));
      console.log('');

      for (const agent of active) {
        const indicator =
          agent.state === 'working' ? chalk.green('●') : chalk.yellow('◐');

        if (options.brief) {
          console.log(`${indicator} ${agent.projectName}`);
          continue;
        }

        console.log(`${indicator} ${chalk.bold(agent.projectName)}`);
        console.log(`  ${chalk.dim(agent.cwd)}`);

        if (agent.lastExchange) {
          const truncated =
            agent.lastExchange.length > 200
              ? agent.lastExchange.slice(0, 197) + '...'
              : agent.lastExchange;
          console.log(`  ${truncated}`);
        } else {
          console.log(`  ${chalk.dim('No recent exchange')}`);
        }
        console.log('');
      }
    });
}
