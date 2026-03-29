import chokidar from 'chokidar';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { CLAUDE_SESSIONS_DIR, CLAUDE_PROJECTS_DIR } from '../core/paths.js';
import { logInfo, logError } from '../core/logger.js';
import type { FileEvent } from '../core/types.js';

const DEBOUNCE_MS = 500;

export function startWatching(onEvent: (event: FileEvent) => void): { stop: () => Promise<void> } {
  const watchPaths: string[] = [];

  if (existsSync(CLAUDE_SESSIONS_DIR)) {
    watchPaths.push(CLAUDE_SESSIONS_DIR);
  }
  if (existsSync(CLAUDE_PROJECTS_DIR)) {
    watchPaths.push(CLAUDE_PROJECTS_DIR);
  }

  if (watchPaths.length === 0) {
    logInfo('No Claude directories found to watch');
    return {
      stop: () => Promise.resolve(),
    };
  }

  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function debounce(key: string, fn: () => void): void {
    const existing = debounceTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key);
      fn();
    }, DEBOUNCE_MS));
  }

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3,
  });

  watcher.on('add', (filePath: string) => {
    debounce(filePath, () => {
      try {
        const name = basename(filePath);

        if (filePath.startsWith(CLAUDE_SESSIONS_DIR) && name.endsWith('.json')) {
          const sessionId = name.replace(/\.json$/, '');
          onEvent({
            type: 'session-discovered',
            sessionId,
            path: filePath,
            timestamp: Date.now(),
          });
        } else if (filePath.startsWith(CLAUDE_PROJECTS_DIR) && name.endsWith('.jsonl')) {
          const sessionId = name.replace(/\.jsonl$/, '');
          onEvent({
            type: 'activity-detected',
            sessionId,
            path: filePath,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        logError('File watcher add error', { path: filePath, error: String(err) });
      }
    });
  });

  watcher.on('change', (filePath: string) => {
    debounce(filePath, () => {
      try {
        const name = basename(filePath);

        if (filePath.startsWith(CLAUDE_PROJECTS_DIR) && name.endsWith('.jsonl')) {
          const sessionId = name.replace(/\.jsonl$/, '');
          onEvent({
            type: 'activity-detected',
            sessionId,
            path: filePath,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        logError('File watcher change error', { path: filePath, error: String(err) });
      }
    });
  });

  watcher.on('unlink', (filePath: string) => {
    debounce(filePath, () => {
      try {
        const name = basename(filePath);

        if (filePath.startsWith(CLAUDE_SESSIONS_DIR) && name.endsWith('.json')) {
          const sessionId = name.replace(/\.json$/, '');
          onEvent({
            type: 'session-removed',
            sessionId,
            path: filePath,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        logError('File watcher unlink error', { path: filePath, error: String(err) });
      }
    });
  });

  watcher.on('error', (err: unknown) => {
    logError('File watcher error', { error: String(err) });
  });

  logInfo('File watcher started', { paths: watchPaths });

  return {
    stop: async () => {
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      await watcher.close();
      logInfo('File watcher stopped');
    },
  };
}
