import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { CRAYFISH_FARM_HOME, CLAUDE_HOME, CLAUDE_SESSIONS_DIR, CLAUDE_SETTINGS } from '../../core/paths.js';
import { isDaemonRunning } from '../ipc-client.js';

function check(label: string, passed: boolean, detail?: string): void {
  const icon = passed ? chalk.green('✓') : chalk.red('✗');
  const text = passed ? chalk.green(label) : chalk.red(label);
  console.log(`  ${icon} ${text}${detail ? chalk.dim(' — ' + detail) : ''}`);
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Check environment and diagnose configuration issues')
    .action(async () => {
      console.log(chalk.bold('crayfish-farm doctor'));
      console.log('');

      // 1. Node.js >= 20
      const nodeVersion = process.versions.node;
      const nodeMajor = parseInt(nodeVersion.split('.')[0] ?? '0', 10);
      check(`Node.js >= 20 (${nodeVersion})`, nodeMajor >= 20);

      // 2. ~/.claude/ exists
      const claudeExists = existsSync(CLAUDE_HOME);
      check('~/.claude/ exists', claudeExists);

      // 3. ~/.crayfish-farm/ exists
      const homeExists = existsSync(CRAYFISH_FARM_HOME);
      check('~/.crayfish-farm/ exists', homeExists);

      // 4. Daemon running
      const daemonRunning = await isDaemonRunning();
      check('Daemon running', daemonRunning);

      // 5. Hooks installed in settings.json
      let hooksInstalled = false;
      try {
        if (existsSync(CLAUDE_SETTINGS)) {
          const { areHooksInstalled } = await import('../../services/hook-installer.js');
          hooksInstalled = areHooksInstalled();
        }
      } catch {
        hooksInstalled = false;
      }
      check('Hooks installed in ~/.claude/settings.json', hooksInstalled);

      // 6. Python + PIL available
      let pilAvailable = false;
      try {
        execSync('python3 -c "from PIL import Image"', { timeout: 5000, stdio: 'ignore' });
        pilAvailable = true;
      } catch {
        pilAvailable = false;
      }
      check('Python 3 + PIL (Pillow) available', pilAvailable);

      // 7. Claude Code sessions found
      let sessionsFound = false;
      try {
        if (existsSync(CLAUDE_SESSIONS_DIR)) {
          const files = readdirSync(CLAUDE_SESSIONS_DIR);
          sessionsFound = files.length > 0;
        }
      } catch {
        sessionsFound = false;
      }
      check('Claude Code sessions found', sessionsFound);

      console.log('');
    });
}
