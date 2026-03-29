import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  CLAUDE_SETTINGS,
  CLAUDE_HOME,
  HOOKS_DIR,
  ensureHomeDir,
} from '../core/paths.js';
import { BACKUP_ROTATION_COUNT } from '../core/constants.js';

const SESSION_START_HOOK_CMD = '$HOME/.crayfish-farm/hooks/session-start.sh';
const SESSION_STOP_HOOK_CMD = '$HOME/.crayfish-farm/hooks/session-stop.sh';
const CRAYFISH_FARM_MARKER = 'crayfish-farm';

interface ClaudeSettings {
  hooks?: {
    SessionStart?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    SessionStop?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readSettings(): ClaudeSettings {
  try {
    if (!existsSync(CLAUDE_SETTINGS)) return {};
    const raw = readFileSync(CLAUDE_SETTINGS, 'utf8');
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

function rotateBackups(): void {
  try {
    for (let i = BACKUP_ROTATION_COUNT; i >= 1; i--) {
      const src = i === 1 ? CLAUDE_SETTINGS : `${CLAUDE_SETTINGS}.bak.${i - 1}`;
      const dst = `${CLAUDE_SETTINGS}.bak.${i}`;
      if (existsSync(src)) {
        const content = readFileSync(src);
        writeFileSync(dst, content);
      }
    }
  } catch {
    // silent failure
  }
}

function writeHookScripts(): void {
  ensureHomeDir();

  const sessionStartScript = `#!/usr/bin/env bash
# crayfish-farm session-start hook
SOCKET="$HOME/.crayfish-farm/crayfish-farm.sock"
EVENT='{"jsonrpc":"2.0","id":1,"method":"event","params":{"type":"session-start","timestamp":'$(date +%s000)'}}'

if [ -S "$SOCKET" ]; then
  echo "$EVENT" | nc -U "$SOCKET" 2>/dev/null || true
else
  echo "$EVENT" >> "$HOME/.crayfish-farm/events.jsonl" 2>/dev/null || true
fi
`;

  const sessionStopScript = `#!/usr/bin/env bash
# crayfish-farm session-stop hook
SOCKET="$HOME/.crayfish-farm/crayfish-farm.sock"
EVENT='{"jsonrpc":"2.0","id":1,"method":"event","params":{"type":"session-stop","timestamp":'$(date +%s000)'}}'

if [ -S "$SOCKET" ]; then
  echo "$EVENT" | nc -U "$SOCKET" 2>/dev/null || true
else
  echo "$EVENT" >> "$HOME/.crayfish-farm/events.jsonl" 2>/dev/null || true
fi
`;

  const notificationScript = `#!/usr/bin/env bash
# crayfish-farm notification hook
SOCKET="$HOME/.crayfish-farm/crayfish-farm.sock"
EVENT='{"jsonrpc":"2.0","id":1,"method":"event","params":{"type":"activity-detected","timestamp":'$(date +%s000)'}}'

if [ -S "$SOCKET" ]; then
  echo "$EVENT" | nc -U "$SOCKET" 2>/dev/null || true
fi
`;

  try {
    writeFileSync(join(HOOKS_DIR, 'session-start.sh'), sessionStartScript, { mode: 0o755 });
    writeFileSync(join(HOOKS_DIR, 'session-stop.sh'), sessionStopScript, { mode: 0o755 });
    writeFileSync(join(HOOKS_DIR, 'notification.sh'), notificationScript, { mode: 0o755 });
  } catch {
    // silent failure
  }
}

export function installHooks(): { success: boolean; backedUp: boolean } {
  try {
    writeHookScripts();

    // Ensure ~/.claude/ directory exists
    if (!existsSync(CLAUDE_HOME)) {
      mkdirSync(CLAUDE_HOME, { recursive: true });
    }

    rotateBackups();
    let backedUp = existsSync(`${CLAUDE_SETTINGS}.bak.1`);

    const settings = readSettings();
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Add SessionStart hook if not present
    if (!settings.hooks.SessionStart) {
      settings.hooks.SessionStart = [];
    }
    const hasStart = settings.hooks.SessionStart.some((entry) =>
      entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
    );
    if (!hasStart) {
      settings.hooks.SessionStart.push({
        matcher: '',
        hooks: [{ type: 'command', command: SESSION_START_HOOK_CMD }],
      });
    }

    // Add SessionStop hook if not present
    if (!settings.hooks.SessionStop) {
      settings.hooks.SessionStop = [];
    }
    const hasStop = settings.hooks.SessionStop.some((entry) =>
      entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
    );
    if (!hasStop) {
      settings.hooks.SessionStop.push({
        matcher: '',
        hooks: [{ type: 'command', command: SESSION_STOP_HOOK_CMD }],
      });
    }

    const tmp = `${CLAUDE_SETTINGS}.tmp`;
    writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    renameSync(tmp, CLAUDE_SETTINGS);

    return { success: true, backedUp };
  } catch {
    return { success: false, backedUp: false };
  }
}

export function uninstallHooks(): { success: boolean } {
  try {
    rotateBackups();

    const settings = readSettings();
    if (!settings.hooks) {
      return { success: true };
    }

    if (settings.hooks.SessionStart) {
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
        (entry) => !entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
      );
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
    }

    if (settings.hooks.SessionStop) {
      settings.hooks.SessionStop = settings.hooks.SessionStop.filter(
        (entry) => !entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
      );
      if (settings.hooks.SessionStop.length === 0) {
        delete settings.hooks.SessionStop;
      }
    }

    const tmp = `${CLAUDE_SETTINGS}.tmp`;
    writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    renameSync(tmp, CLAUDE_SETTINGS);

    return { success: true };
  } catch {
    return { success: false };
  }
}

export function areHooksInstalled(): boolean {
  const settings = readSettings();
  if (!settings.hooks) return false;

  const inStart = settings.hooks.SessionStart?.some((entry) =>
    entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
  ) ?? false;

  const inStop = settings.hooks.SessionStop?.some((entry) =>
    entry.hooks.some((h) => h.command.includes(CRAYFISH_FARM_MARKER))
  ) ?? false;

  return inStart || inStop;
}
