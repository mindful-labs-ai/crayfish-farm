import { Command } from 'commander';
import type { AgentInfo } from '../../core/types.js';

export function registerGo(program: Command): void {
  program
    .command('go')
    .description("Output cd command for a session (designed to be eval'd by shell)")
    .argument('<session-name>', 'session or project name to navigate to')
    .action(async (sessionName: string) => {
      let discoverAgents: () => AgentInfo[];
      try {
        const mod = await import('../../services/agent-tracker.js');
        discoverAgents = mod.discoverAgents;
      } catch {
        process.exit(1);
      }

      const agents = discoverAgents();
      const query = sessionName.toLowerCase();

      const match = agents.find(
        (a) =>
          a.projectName.toLowerCase().includes(query) ||
          a.cwd.toLowerCase().includes(query),
      );

      if (!match) {
        process.exit(1);
      }

      process.stdout.write(`cd "${match.cwd}"\n`);
    });
}
