import { Command } from 'commander';
import chalk from 'chalk';
import type { AgentInfo } from '../../core/types.js';

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return (tokens / 1_000_000).toFixed(1) + 'M';
  }
  if (tokens >= 1_000) {
    return (tokens / 1_000).toFixed(1) + 'K';
  }
  return String(Math.round(tokens));
}

function padEnd(str: string, length: number): string {
  if (str.length >= length) return str.slice(0, length);
  return str + ' '.repeat(length - str.length);
}

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show all discovered Claude agents and their current state')
    .action(async () => {
      let discoverAgents: () => AgentInfo[];
      try {
        const mod = await import('../../services/agent-tracker.js');
        discoverAgents = mod.discoverAgents;
      } catch {
        console.error(chalk.red('Error: agent-tracker service not available'));
        process.exit(1);
      }

      const agents = discoverAgents();

      if (agents.length === 0) {
        console.log(chalk.dim('No Claude agents found.'));
        return;
      }

      for (const agent of agents) {
        let indicator: string;
        if (agent.state === 'working') {
          indicator = chalk.green('●');
        } else if (agent.state === 'idle') {
          indicator = chalk.yellow('◐');
        } else {
          indicator = chalk.dim('○');
        }

        const projectName = padEnd(agent.projectName, 20);
        const levelLabel = padEnd(`L${agent.level}`, 8);
        const tokens = formatTokenCount(agent.tokenUsage);
        const exchange = agent.lastExchange.length > 40
          ? agent.lastExchange.slice(0, 37) + '...'
          : agent.lastExchange;

        console.log(`${indicator} ${projectName} ${levelLabel} ${tokens.padStart(7)} ${exchange}`);
      }

      const working = agents.filter((a) => a.state === 'working').length;
      const idle = agents.filter((a) => a.state === 'idle').length;
      const sleeping = agents.filter((a) => a.state === 'sleeping').length;

      console.log('');
      console.log(
        chalk.dim(
          `${chalk.green(String(working))} active, ${chalk.yellow(String(idle))} idle, ${String(sleeping)} sleeping`,
        ),
      );
    });
}
