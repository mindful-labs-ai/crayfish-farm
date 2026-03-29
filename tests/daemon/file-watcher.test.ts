import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chokidar before importing the module under test
const mockWatcher = {
  on: vi.fn(),
  close: vi.fn(),
};

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => mockWatcher),
  },
}));

// Mock node:fs so we control which directories "exist"
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// Mock logger to suppress output
vi.mock('../../src/core/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import chokidar from 'chokidar';
import { existsSync } from 'node:fs';
import { startWatching } from '../../src/daemon/file-watcher.js';

describe('file-watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcher.on.mockReturnValue(mockWatcher);
    mockWatcher.close.mockResolvedValue(undefined);
  });

  describe('startWatching', () => {
    it('returns an object with a stop function when no watch paths exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = startWatching(vi.fn());

      expect(result).toHaveProperty('stop');
      expect(typeof result.stop).toBe('function');
    });

    it('stop function can be called and resolves when no paths exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const { stop } = startWatching(vi.fn());

      await expect(stop()).resolves.toBeUndefined();
    });

    it('calls chokidar.watch when at least one directory exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      startWatching(vi.fn());

      expect(chokidar.watch).toHaveBeenCalledOnce();
    });

    it('returns a stop function that closes the watcher', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const { stop } = startWatching(vi.fn());
      await stop();

      expect(mockWatcher.close).toHaveBeenCalledOnce();
    });

    it('stop function resolves after watcher.close()', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const { stop } = startWatching(vi.fn());

      await expect(stop()).resolves.toBeUndefined();
    });

    it('registers event handlers on the watcher', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      startWatching(vi.fn());

      const registeredEvents = mockWatcher.on.mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain('add');
      expect(registeredEvents).toContain('change');
      expect(registeredEvents).toContain('unlink');
      expect(registeredEvents).toContain('error');
    });
  });
});
