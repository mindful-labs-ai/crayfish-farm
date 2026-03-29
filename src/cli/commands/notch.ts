import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';

const NOTCH_PID_FILE = join(homedir(), '.crayfish-farm', 'notch.pid');

function getNotchMainPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // After tsup bundling: dist/cli/index.js -> dist/notch/main.js
  return resolve(__dirname, '../notch/main.js');
}

function getElectronPath(): string {
  const require = createRequire(import.meta.url);
  const electronPath = require('electron') as string;
  return electronPath;
}

function isNotchRunning(): boolean {
  if (!existsSync(NOTCH_PID_FILE)) return false;
  try {
    const pidStr = readFileSync(NOTCH_PID_FILE, 'utf8').trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function registerNotch(program: Command): void {
  program
    .command('notch')
    .description('Manage the Crawfish Park Electron menu bar widget')
    .argument('[action]', 'start | stop | status (default: start)')
    .action(async (action: string = 'start') => {
      switch (action) {
        case 'stop': {
          if (!existsSync(NOTCH_PID_FILE)) {
            console.log(chalk.dim('Notch is not running.'));
            return;
          }
          try {
            const pidStr = readFileSync(NOTCH_PID_FILE, 'utf8').trim();
            const pid = parseInt(pidStr, 10);
            if (isNaN(pid)) {
              console.error(chalk.red('Invalid notch PID file.'));
              process.exit(1);
            }
            process.kill(pid, 'SIGTERM');
            console.log(chalk.green(`Notch stopped (PID ${pid}).`));
          } catch (err) {
            console.error(chalk.red(`Failed to stop notch: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
          }
          break;
        }

        case 'status': {
          const running = isNotchRunning();
          if (running) {
            let pid = 'unknown';
            try {
              pid = readFileSync(NOTCH_PID_FILE, 'utf8').trim();
            } catch {
              // ignore
            }
            console.log(chalk.green(`Notch is running`) + chalk.dim(` (PID ${pid})`));
          } else {
            console.log(chalk.dim('Notch is not running.'));
          }
          break;
        }

        case 'start': {
          if (isNotchRunning()) {
            console.log(chalk.yellow('Notch is already running.'));
            return;
          }

          let electronBin: string;
          try {
            electronBin = getElectronPath();
          } catch (err) {
            console.error(chalk.red(`Could not find electron: ${err instanceof Error ? err.message : String(err)}`));
            process.exit(1);
          }

          const notchMain = getNotchMainPath();
          const proc = spawn(electronBin, [notchMain], {
            detached: true,
            stdio: 'ignore',
            env: {
              ...process.env,
              ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
            },
          });
          proc.unref();

          console.log(chalk.green('Notch started.'));
          // Allow 500ms for startup before exiting
          await new Promise((resolve) => setTimeout(resolve, 500));
          break;
        }

        default: {
          console.error(chalk.red(`Unknown action: ${action}. Use start, stop, or status.`));
          process.exit(1);
        }
      }
    });
}
