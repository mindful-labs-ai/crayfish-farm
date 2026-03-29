import {
  readdirSync,
  statSync,
  unlinkSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { STATS_DIR, EVENTS_LOG } from '../core/paths.js';
import { DEFAULT_RETENTION_DAYS, MAX_LOG_SIZE_BYTES } from '../core/constants.js';

export function purgeOldData(
  retentionDays?: number,
  statsDir?: string
): { deletedFiles: number } {
  const dir = statsDir ?? STATS_DIR;
  const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedFiles = 0;

  if (!existsSync(dir)) {
    return { deletedFiles };
  }

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return { deletedFiles };
  }

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoffMs) {
        unlinkSync(filePath);
        deletedFiles++;
      }
    } catch {
      // silent failure
    }
  }

  return { deletedFiles };
}

export function purgeEventLog(maxSizeBytes?: number, eventsLog?: string): void {
  const target = eventsLog ?? EVENTS_LOG;
  const maxSize = maxSizeBytes ?? MAX_LOG_SIZE_BYTES;

  if (!existsSync(target)) {
    return;
  }

  try {
    const stat = statSync(target);
    if (stat.size <= maxSize) {
      return;
    }

    const raw = readFileSync(target, 'utf8');
    // Take last maxSizeBytes characters
    let trimmed = raw.slice(-maxSize);
    // Find first newline to avoid partial lines
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline !== -1) {
      trimmed = trimmed.slice(firstNewline + 1);
    }

    const tmp = `${target}.tmp`;
    writeFileSync(tmp, trimmed, 'utf8');
    renameSync(tmp, target);
  } catch {
    // silent failure
  }
}
