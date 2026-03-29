import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { Config } from './types.js';
import { CONFIG_FILE, ensureHomeDir } from './paths.js';

export function getDefaultConfig(): Config {
  return {
    timer: { defaultMinutes: 25, breakMinutes: 5, preset: 'pomodoro' },
    notification: { sound: true, systemNotification: true, terminalBell: true },
    dopamine: { signalLevel: 'on' },
    data: { retentionDays: 30 },
    daemon: { autoStart: false },
  };
}

export function loadConfig(configPath?: string): Config {
  const target = configPath ?? CONFIG_FILE;
  const defaults = getDefaultConfig();

  if (!existsSync(target)) {
    return defaults;
  }

  try {
    const raw = readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      timer: { ...defaults.timer, ...parsed.timer },
      notification: { ...defaults.notification, ...parsed.notification },
      dopamine: { ...defaults.dopamine, ...parsed.dopamine },
      data: { ...defaults.data, ...parsed.data },
      daemon: { ...defaults.daemon, ...parsed.daemon },
    };
  } catch {
    return defaults;
  }
}

export function saveConfig(config: Config, configPath?: string): void {
  const target = configPath ?? CONFIG_FILE;

  if (!configPath) {
    ensureHomeDir();
  }

  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
  renameSync(tmp, target);
}
