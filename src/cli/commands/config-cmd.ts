import { Command } from 'commander';
import chalk from 'chalk';
import type { Config } from '../../core/types.js';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

function parseValue(raw: string): boolean | number | string {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

export function registerConfigCmd(program: Command): void {
  program
    .command('config')
    .description('View or set configuration values (dot-path: timer.defaultMinutes)')
    .argument('[key]', 'config key (dot-path)')
    .argument('[value]', 'value to set')
    .action(async (key?: string, value?: string) => {
      const { loadConfig, saveConfig } = await import('../../core/config.js');
      const config = loadConfig();

      if (!key) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (value === undefined) {
        const val = getNestedValue(config as unknown as Record<string, unknown>, key);
        if (val === undefined) {
          console.error(chalk.red(`Key not found: ${key}`));
          process.exit(1);
        }
        console.log(JSON.stringify(val, null, 2));
        return;
      }

      const parsed = parseValue(value);
      const configObj = config as unknown as Record<string, unknown>;
      setNestedValue(configObj, key, parsed);
      saveConfig(configObj as unknown as Config);
      console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsed)}`));
    });
}
