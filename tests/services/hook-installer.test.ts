import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We need to test hook-installer using real FS with temp directories.
// hook-installer reads CLAUDE_SETTINGS from paths.ts via a module-level import.
// We patch the paths by providing a settingsPath argument indirectly via mocking
// the paths module constants that hook-installer uses.

vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/paths.js')>();
  return {
    ...original,
    // Will be overridden per test via vi.stubGlobal approach below
    CLAUDE_SETTINGS: original.CLAUDE_SETTINGS,
    CLAUDE_HOME: original.CLAUDE_HOME,
    HOOKS_DIR: original.HOOKS_DIR,
    ensureHomeDir: vi.fn(),
  };
});

// Because hook-installer hard-codes path imports at the top level, we test
// the functions by inspecting behavior with real temp directories where possible,
// and relying on the exported functions accepting no path arg (using mocked paths).

const pathsMod = await import('../../src/core/paths.js');
const { installHooks, uninstallHooks, areHooksInstalled } = await import(
  '../../src/services/hook-installer.js'
);

describe('areHooksInstalled', () => {
  it('returns false when CLAUDE_SETTINGS does not exist', () => {
    // Point CLAUDE_SETTINGS at a nonexistent path
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    try {
      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(
        join(tmpDir, 'nonexistent-settings.json')
      );
      expect(areHooksInstalled()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns false when settings has no hooks section', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    try {
      const settingsPath = join(tmpDir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({ someOtherKey: true }), 'utf8');
      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);
      expect(areHooksInstalled()).toBe(false);
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns true when settings has crayfish-farm hooks', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    try {
      const settingsPath = join(tmpDir, 'settings.json');
      const settings = {
        hooks: {
          SessionStart: [
            {
              matcher: '',
              hooks: [
                {
                  type: 'command',
                  command: '$HOME/.crayfish-farm/hooks/session-start.sh',
                },
              ],
            },
          ],
        },
      };
      writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);
      expect(areHooksInstalled()).toBe(true);
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('installHooks', () => {
  it('creates hook entries in settings file', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    const hooksDir = join(tmpDir, 'hooks');
    try {
      const settingsPath = join(tmpDir, 'settings.json');

      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);
      vi.spyOn(pathsMod, 'CLAUDE_HOME', 'get').mockReturnValue(tmpDir);
      vi.spyOn(pathsMod, 'HOOKS_DIR', 'get').mockReturnValue(hooksDir);
      (pathsMod.ensureHomeDir as ReturnType<typeof vi.fn>).mockImplementation(() => {
        const { mkdirSync } = require('node:fs');
        mkdirSync(hooksDir, { recursive: true });
      });

      const result = installHooks();
      expect(result.success).toBe(true);

      const written = JSON.parse(readFileSync(settingsPath, 'utf8'));
      expect(written.hooks).toBeDefined();
      expect(written.hooks.SessionStart).toBeDefined();
      expect(written.hooks.SessionStop).toBeDefined();
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('does not duplicate hooks on second call', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    const hooksDir = join(tmpDir, 'hooks');
    try {
      const settingsPath = join(tmpDir, 'settings.json');

      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);
      vi.spyOn(pathsMod, 'CLAUDE_HOME', 'get').mockReturnValue(tmpDir);
      vi.spyOn(pathsMod, 'HOOKS_DIR', 'get').mockReturnValue(hooksDir);
      (pathsMod.ensureHomeDir as ReturnType<typeof vi.fn>).mockImplementation(() => {
        const { mkdirSync } = require('node:fs');
        mkdirSync(hooksDir, { recursive: true });
      });

      installHooks();
      installHooks();

      const written = JSON.parse(readFileSync(settingsPath, 'utf8'));
      const startCount = written.hooks.SessionStart.length;
      const stopCount = written.hooks.SessionStop.length;
      expect(startCount).toBe(1);
      expect(stopCount).toBe(1);
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('uninstallHooks', () => {
  it('removes crayfish-farm entries from settings', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    const hooksDir = join(tmpDir, 'hooks');
    try {
      const settingsPath = join(tmpDir, 'settings.json');
      const initial = {
        hooks: {
          SessionStart: [
            {
              matcher: '',
              hooks: [
                { type: 'command', command: '$HOME/.crayfish-farm/hooks/session-start.sh' },
              ],
            },
          ],
          SessionStop: [
            {
              matcher: '',
              hooks: [
                { type: 'command', command: '$HOME/.crayfish-farm/hooks/session-stop.sh' },
              ],
            },
          ],
        },
      };
      writeFileSync(settingsPath, JSON.stringify(initial), 'utf8');

      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);
      vi.spyOn(pathsMod, 'HOOKS_DIR', 'get').mockReturnValue(hooksDir);

      const result = uninstallHooks();
      expect(result.success).toBe(true);

      const written = JSON.parse(readFileSync(settingsPath, 'utf8'));
      expect(written.hooks.SessionStart).toBeUndefined();
      expect(written.hooks.SessionStop).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('succeeds when no hooks section present', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cf-hooks-'));
    try {
      const settingsPath = join(tmpDir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({}), 'utf8');

      vi.spyOn(pathsMod, 'CLAUDE_SETTINGS', 'get').mockReturnValue(settingsPath);

      const result = uninstallHooks();
      expect(result.success).toBe(true);
    } finally {
      vi.restoreAllMocks();
      rmSync(tmpDir, { recursive: true });
    }
  });
});
