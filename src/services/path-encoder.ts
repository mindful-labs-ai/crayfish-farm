import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_PROJECTS_DIR, PATH_CACHE_FILE } from '../core/paths.js';

export function encodePath(fsPath: string): string {
  return fsPath.replace(/[/.]/g, '-');
}

function loadCache(): Record<string, string> {
  try {
    const raw = readFileSync(PATH_CACHE_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    const tmp = `${PATH_CACHE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(cache), 'utf8');
    renameSync(tmp, PATH_CACHE_FILE);
  } catch {
    // silent failure
  }
}

export function findProjectDir(cwd: string, projectsDir?: string): string | null {
  const baseDir = projectsDir ?? CLAUDE_PROJECTS_DIR;
  const cache = loadCache();

  // Check cache first
  if (cache[cwd]) {
    const cached = cache[cwd];
    if (existsSync(cached)) {
      return cached;
    }
    // Cached path no longer exists, remove it
    delete cache[cwd];
  }

  // Strategy 1: exact match
  const exact = join(baseDir, encodePath(cwd));
  if (existsSync(exact)) {
    cache[cwd] = exact;
    saveCache(cache);
    return exact;
  }

  const segments = cwd.split('/').filter(Boolean);

  // Strategy 2: last 3 path segments
  if (segments.length >= 3 && existsSync(baseDir)) {
    const suffix = '/' + segments.slice(-3).join('/');
    try {
      const entries = readdirSync(baseDir);
      for (const entry of entries) {
        const decoded = entry.replace(/^-/, '/').replace(/-/g, '/');
        if (decoded.endsWith(suffix)) {
          const full = join(baseDir, entry);
          cache[cwd] = full;
          saveCache(cache);
          return full;
        }
      }
    } catch {
      // silent failure
    }
  }

  // Strategy 3: last 2 path segments
  if (segments.length >= 2 && existsSync(baseDir)) {
    const suffix = '/' + segments.slice(-2).join('/');
    try {
      const entries = readdirSync(baseDir);
      for (const entry of entries) {
        const decoded = entry.replace(/^-/, '/').replace(/-/g, '/');
        if (decoded.endsWith(suffix)) {
          const full = join(baseDir, entry);
          cache[cwd] = full;
          saveCache(cache);
          return full;
        }
      }
    } catch {
      // silent failure
    }
  }

  return null;
}
