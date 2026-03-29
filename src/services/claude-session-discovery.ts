import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { RawSession } from '../core/types.js';
import { CLAUDE_SESSIONS_DIR, CLAUDE_PROJECTS_DIR } from '../core/paths.js';
import { findProjectDir } from './path-encoder.js';

export function discoverSessions(sessionsDir?: string): RawSession[] {
  const dir = sessionsDir ?? CLAUDE_SESSIONS_DIR;
  const results: RawSession[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return results;
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(dir, file);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RawSession>;

      if (parsed.kind !== 'interactive') continue;
      if (typeof parsed.pid !== 'number') continue;
      if (typeof parsed.sessionId !== 'string') continue;
      if (typeof parsed.cwd !== 'string') continue;
      if (typeof parsed.startedAt !== 'number') continue;

      results.push({
        pid: parsed.pid,
        sessionId: parsed.sessionId,
        cwd: parsed.cwd,
        startedAt: parsed.startedAt,
        kind: parsed.kind,
        entrypoint: parsed.entrypoint,
      });
    } catch {
      // skip malformed files silently
    }
  }

  return results;
}

export function discoverAllSessions(projectsDir?: string): RawSession[] {
  const baseDir = projectsDir ?? CLAUDE_PROJECTS_DIR;
  const sessions = discoverSessions();
  const seenIds = new Set(sessions.map((s) => s.sessionId));

  if (!existsSync(baseDir)) {
    return sessions;
  }

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(baseDir);
  } catch {
    return sessions;
  }

  for (const dirName of projectDirs) {
    const dirPath = join(baseDir, dirName);
    try {
      const stat = statSync(dirPath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    // Decode cwd: -Users-foo-bar -> /Users/foo/bar
    const decodedCwd = dirName.replace(/^-/, '/').replace(/-/g, '/');
    const projectName = decodedCwd.split('/').filter(Boolean).pop() ?? dirName;

    let jsonlFiles: string[];
    try {
      jsonlFiles = readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const jsonlFile of jsonlFiles) {
      const sessionId = basename(jsonlFile, '.jsonl');

      // Skip meta and agent files
      if (sessionId.includes('.meta') || sessionId.includes('agent-')) continue;
      if (seenIds.has(sessionId)) continue;

      const jsonlPath = join(dirPath, jsonlFile);
      let startedAt: number;
      try {
        const stat = statSync(jsonlPath);
        startedAt = stat.birthtimeMs || stat.mtimeMs;
      } catch {
        startedAt = Date.now();
      }

      seenIds.add(sessionId);
      sessions.push({
        pid: 0,
        sessionId,
        cwd: decodedCwd,
        startedAt,
        kind: 'interactive',
        entrypoint: undefined,
      });
    }
  }

  return sessions;
}

export function findJsonlForSession(session: RawSession, projectsDir?: string): string | null {
  const baseDir = projectsDir ?? CLAUDE_PROJECTS_DIR;

  // First try findProjectDir
  const projectDir = findProjectDir(session.cwd, baseDir);
  if (projectDir) {
    const candidate = join(projectDir, `${session.sessionId}.jsonl`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback: scan ALL project directories for matching sessionId
  if (!existsSync(baseDir)) {
    return null;
  }

  let dirs: string[];
  try {
    dirs = readdirSync(baseDir);
  } catch {
    return null;
  }

  for (const dir of dirs) {
    const candidate = join(baseDir, dir, `${session.sessionId}.jsonl`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
