import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { PID_FILE } from '../../core/paths.js';
import { isDaemonRunning } from '../ipc-client.js';

function getDaemonPath(): string {
  // Resolve from this file's location: src/cli/commands/ -> src/daemon/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // When built: dist/cli/commands/daemon-cmd.js -> dist/daemon/index.js
  // When in dev (tsx): src/cli/commands/daemon-cmd.ts -> src/daemon/index.ts
  return resolve(__dirname, '../../daemon/index.js');
}

export function registerDaemonCmd(program: Command): void {
  program
    .command('daemon')
    .description('Manage the crayfish-farm background daemon')
    .argument('<action>', 'start | stop | status')
    .action(async (action: string) => {
      switch (action) {
        case 'start': {
          const running = await isDaemonRunning();
          if (running) {
            console.log(chalk.yellow('Daemon is already running.'));
            return;
          }

          const daemonPath = getDaemonPath();
          const proc = spawn(process.execPath, [daemonPath], {
            detached: true,
            stdio: 'ignore',
          });
          proc.unref();

          console.log(chalk.green('Daemon started.'));
          break;
        }

        case 'stop': {
          if (!existsSync(PID_FILE)) {
            console.log(chalk.dim('Daemon is not running.'));
            return;
          }
          try {
            const pidStr = readFileSync(PID_FILE, 'utf8').trim();
            const pid = parseInt(pidStr, 10);
            if (isNaN(pid)) {
              console.error(chalk.red('Invalid PID file.'));
              process.exit(1);
            }
            process.kill(pid, 'SIGTERM');
            console.log(chalk.green(`Daemon stopped (PID ${pid}).`));
          } catch (err) {
            console.error(chalk.red(`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
          }
          break;
        }

        case 'status': {
          const running = await isDaemonRunning();
          if (running) {
            let pid = 'unknown';
            try {
              pid = readFileSync(PID_FILE, 'utf8').trim();
            } catch {
              // ignore
            }
            console.log(chalk.green(`Daemon is running`) + chalk.dim(` (PID ${pid})`));
          } else {
            console.log(chalk.dim('Daemon is not running.'));
          }
          break;
        }

        default: {
          console.error(chalk.red(`Unknown action: ${action}. Use start, stop, or status.`));
          process.exit(1);
        }
      }
    });
}
