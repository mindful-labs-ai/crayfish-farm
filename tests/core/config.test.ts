import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDefaultConfig, loadConfig, saveConfig } from '../../src/core/config.js';

describe('getDefaultConfig', () => {
  it('returns a Config with timer section', () => {
    const config = getDefaultConfig();
    expect(config.timer).toBeDefined();
    expect(typeof config.timer.defaultMinutes).toBe('number');
    expect(typeof config.timer.breakMinutes).toBe('number');
    expect(typeof config.timer.preset).toBe('string');
  });

  it('returns a Config with notification section', () => {
    const config = getDefaultConfig();
    expect(config.notification).toBeDefined();
    expect(typeof config.notification.sound).toBe('boolean');
    expect(typeof config.notification.systemNotification).toBe('boolean');
    expect(typeof config.notification.terminalBell).toBe('boolean');
  });

  it('returns a Config with dopamine section', () => {
    const config = getDefaultConfig();
    expect(config.dopamine).toBeDefined();
    expect(['on', 'subtle', 'off']).toContain(config.dopamine.signalLevel);
  });

  it('returns a Config with data section', () => {
    const config = getDefaultConfig();
    expect(config.data).toBeDefined();
    expect(typeof config.data.retentionDays).toBe('number');
  });

  it('returns a Config with daemon section', () => {
    const config = getDefaultConfig();
    expect(config.daemon).toBeDefined();
    expect(typeof config.daemon.autoStart).toBe('boolean');
  });

  it('returns pomodoro as default preset', () => {
    const config = getDefaultConfig();
    expect(config.timer.preset).toBe('pomodoro');
  });

  it('returns 25 as default timer minutes', () => {
    const config = getDefaultConfig();
    expect(config.timer.defaultMinutes).toBe(25);
  });
});

describe('loadConfig', () => {
  it('returns defaults when no file exists', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-test-'));
    try {
      const nonExistentPath = join(tmpDir, 'config.json');
      const config = loadConfig(nonExistentPath);
      const defaults = getDefaultConfig();
      expect(config).toEqual(defaults);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('merges partial config with defaults', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-test-'));
    try {
      const filePath = join(tmpDir, 'config.json');
      const partial = { timer: { defaultMinutes: 50 } };
      writeFileSync(filePath, JSON.stringify(partial), 'utf8');

      const config = loadConfig(filePath);
      expect(config.timer.defaultMinutes).toBe(50);
      // Other timer fields should be defaults
      expect(config.timer.breakMinutes).toBe(getDefaultConfig().timer.breakMinutes);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns defaults when file contains invalid JSON', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-test-'));
    try {
      const filePath = join(tmpDir, 'config.json');
      writeFileSync(filePath, 'not valid json', 'utf8');

      const config = loadConfig(filePath);
      expect(config).toEqual(getDefaultConfig());
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('saveConfig + loadConfig roundtrip', () => {
  it('saves and reloads a config without loss', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-test-'));
    try {
      const filePath = join(tmpDir, 'config.json');
      const config = getDefaultConfig();
      config.timer.defaultMinutes = 45;
      config.notification.sound = false;

      saveConfig(config, filePath);
      const loaded = loadConfig(filePath);

      expect(loaded.timer.defaultMinutes).toBe(45);
      expect(loaded.notification.sound).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('roundtrip preserves all sections', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-test-'));
    try {
      const filePath = join(tmpDir, 'config.json');
      const original = getDefaultConfig();

      saveConfig(original, filePath);
      const loaded = loadConfig(filePath);

      expect(loaded).toEqual(original);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
