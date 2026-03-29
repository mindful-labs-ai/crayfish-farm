# Crayfish Farm Build Plan

*Rule #1: DO NOT ASK ANY QUESTIONS.* For any decision not covered in SPEC.md, choose the most popular/standard approach and proceed immediately. This prompt is designed for a single autonomous run that produces a complete, working project.

## 1. Project Overview

- **Name**: crayfish-farm
- **Description**: CLI-integrated focus tool for  developers using multiple Claude Code sessions. Monitors Claude Code agent sessions via filesystem watching, provides a TUI dashboard with animated crawfish sprites representing each session, a focus timer system with dopamine-driven signals, and an Electron-based "Crawfish Park" Mac menu bar widget.
- **Purpose**: Tracks Claude Code sessions (via ~/.claude/sessions/ and ~/.claude/projects/), gamifies developer focus with level progression (token usage drives levels), provides gentle nudges via an adaptive engine that respects ethical boundaries (never shames, never tracks streaks, never punishes).
- **Tech Stack**:
  - Runtime: Node.js >= 20.0.0
  - Language: TypeScript 5.7+ (strict mode, ES2022 target, NodeNext modules)
  - Module system: ESM (`"type": "module"` in package.json)
  - Build tool: tsup 8.3+ (4 entry points)
  - Desktop widget: Electron 41.1+ (hard dependency, NOT optional)
  - File watching: chokidar 4.0+
  - CLI framework: commander 13.0+
  - Terminal colors: chalk 5.3+
  - Notifications: node-notifier 10.0+
  - Testing: vitest 2.1+ with @vitest/coverage-v8 2.1+
  - Dev tooling: tsx 4.19+ (for dev mode), tsup 8.3+
  - Sprite generation: Python 3 with Pillow (PIL) and numpy
  - Asset hosting: S3 bucket at `https://ralphthon.s3.ap-northeast-2.amazonaws.com/crayfish/`

---

## 2. Prerequisites & Build Order

### CRITICAL BUILD SEQUENCE

The build MUST follow this exact order. Step 3 generates `src/tui/crawfish-art.ts` which is imported by `src/tui/card-renderer.ts` and `src/tui/detail-view.ts`. If this file does not exist, the tsup build will fail.

1. **Initialize project**: `npm init` and install all dependencies
2. **Download 20 sprite PNGs** from S3 into `assets/crayfish/`:
   - URL pattern: `https://ralphthon.s3.ap-northeast-2.amazonaws.com/crayfish/{stage}_{state}.png`
   - Stages: `baby`, `juvenile`, `adult`, `warrior`, `king`
   - States: `idle`, `working`, `complete`, `sleeping`
   - Total: 5 stages x 4 states = 20 PNG files
   - Files: `baby_idle.png`, `baby_working.png`, `baby_complete.png`, `baby_sleeping.png`, `juvenile_idle.png`, `juvenile_working.png`, `juvenile_complete.png`, `juvenile_sleeping.png`, `adult_idle.png`, `adult_working.png`, `adult_complete.png`, `adult_sleeping.png`, `warrior_idle.png`, `warrior_working.png`, `warrior_complete.png`, `warrior_sleeping.png`, `king_idle.png`, `king_working.png`, `king_complete.png`, `king_sleeping.png`
3. **Run Python sprite generation**: `python3 scripts/generate-sprites.py`
   - Requires: `pip3 install Pillow numpy`
   - Reads: `assets/crayfish/*.png` (20 files)
   - Outputs: `src/tui/crawfish-art.ts` (auto-generated, DO NOT edit)
   - This creates the `COMPACT` and `HIRES` sprite data plus `getCrawfishArt()` and `getCrawfishHires()` functions
4. **tsup build** (4 bundles): `tsup`
   - CLI ESM bundle: `src/cli/index.ts` -> `dist/cli/`
   - Daemon ESM bundle: `src/daemon/index.ts` -> `dist/daemon/`
   - Mac menu bar main ESM bundle: `src/notch/main.ts` -> `dist/notch/` (electron external)
   - Mac menu bar preload CJS bundle: `src/notch/preload.ts` -> `dist/notch/` (electron external, MUST be CJS for Electron sandbox)
5. **Copy renderer**: `rm -rf dist/notch/renderer && cp -r src/notch/renderer dist/notch/renderer`

The combined build command is:
```bash
npm run build
# Which runs: tsup && rm -rf dist/notch/renderer && cp -r src/notch/renderer dist/notch/renderer
```

But before `npm run build`, you must have run steps 2 and 3 to ensure `src/tui/crawfish-art.ts` exists.

---

## 3. Package Configuration

### 3.1 package.json

```json
{
  "name": "crayfish-farm",
  "version": "0.1.0",
  "description": "CLI-integrated focus tool for ADHD developers using multiple Claude Code sessions",
  "type": "module",
  "bin": {
    "crayfish-farm": "dist/cli/index.js"
  },
  "files": [
    "dist",
    "src/hooks"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "tsup && rm -rf dist/notch/renderer && cp -r src/notch/renderer dist/notch/renderer",
    "build:notch": "tsup && rm -rf dist/notch/renderer && cp -r src/notch/renderer dist/notch/renderer",
    "dev": "tsx src/cli/index.ts",
    "dev:daemon": "tsx src/daemon/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "generate:sprites": "python3 scripts/generate-sprites.py"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "chokidar": "^4.0.0",
    "commander": "^13.0.0",
    "electron": "^41.1.0",
    "node-notifier": "^10.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-notifier": "^8.0.5",
    "@vitest/coverage-v8": "^2.1.0",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

Key notes:
- `electron` is a **hard dependency** (NOT devDependency, NOT optional)
- `"type": "module"` makes all .js files ESM by default
- `bin` points to `dist/cli/index.js`
- `files` includes `dist` and `src/hooks` (shell scripts shipped with package)

### 3.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests", "src/notch"]
}
```

Key notes:
- **`src/notch` is EXCLUDED** from tsconfig compilation (Electron code is built only via tsup)
- Target is ES2022 (top-level await, etc.)
- Module system is NodeNext (requires `.js` extensions in imports)

### 3.3 tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/cli',
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/daemon/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/daemon',
    sourcemap: true,
  },
  {
    entry: ['src/notch/main.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/notch',
    sourcemap: true,
    external: ['electron'],
  },
  {
    // Preload MUST be CommonJS --- Electron sandbox requires it
    entry: ['src/notch/preload.ts'],
    format: ['cjs'],
    target: 'node20',
    outDir: 'dist/notch',
    sourcemap: true,
    external: ['electron'],
  },
]);
```

Key notes:
- 4 entry points, 4 separate bundles
- CLI and Daemon are ESM
- Mac menu bar main is ESM with `electron` as external
- Mac menu bar preload is **CJS** (Electron sandbox requirement) with `electron` as external
- Only the CLI bundle has `clean: true`

### 3.4 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/tui/crawfish-art.ts'],
    },
  },
});
```

Key notes:
- Tests are in `tests/` directory (not `src/__tests__/`)
- Coverage excludes the auto-generated `crawfish-art.ts`

---

## 4. Core Layer (src/core/)

### 4.1 src/core/types.ts

This file defines ALL TypeScript interfaces and types used across the application. Every type is exported.

#### Agent Types

```typescript
export type AgentState = 'working' | 'idle' | 'sleeping';

export interface AgentInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;
  startedAt: number;
  state: AgentState;
  tokenUsage: number;
  rawTokenUsage: number;
  level: number;
  lastExchange: string;
  lastActivityAt: number;
  jsonlPath: string | null;
}
```

#### Timer Types

```typescript
export interface TimerState {
  running: boolean;
  startedAt: number;
  durationMs: number;
  preset: string;
  flowMode: boolean;
  pausedAt: number | null;
}

export interface TimerPreset {
  focus: number;
  break: number;
}
```

#### Prompt State (written by daemon, read by prompt-status)

```typescript
export interface PromptState {
  pulse: string;
  badge: number | null;
  timer: string | null;
  timeOfDay: string;
  returnTo: string | null;
  warmth: string;
  updated: number;
}
```

#### Config Types

```typescript
export interface TimerConfig {
  defaultMinutes: number;
  breakMinutes: number;
  preset: string;
}

export interface NotificationConfig {
  sound: boolean;
  systemNotification: boolean;
  terminalBell: boolean;
}

export interface DopamineConfig {
  signalLevel: 'on' | 'subtle' | 'off';
}

export interface DataConfig {
  retentionDays: number;
}

export interface DaemonConfig {
  autoStart: boolean;
}

export interface Config {
  timer: TimerConfig;
  notification: NotificationConfig;
  dopamine: DopamineConfig;
  data: DataConfig;
  daemon: DaemonConfig;
}
```

#### Stats Types

```typescript
export interface DayStats {
  focusMinutes: number;
  completedSessions: number;
  date: string;
}
```

#### Adaptive Engine Types

```typescript
export interface DaySignals {
  date: string;
  productiveAppTimeRatio: number;
  sessionSwitchFrequency: number;
  timerCompletionRate: number;
  popoverFrequency: number;
  signalIgnoreRate: number;
  consecutiveSessions: number;
  maxSessionLengthMin: number;
}

export interface AdaptiveParams {
  signalFrequencyMultiplier: number;
  signalIntensityLevel: 1 | 2 | 3;
  quietModeThreshold: number;
  contextDetailLevel: 'brief' | 'normal' | 'detailed';
  supportiveSilenceMode: boolean;
  hyperfocusAlert: boolean;
}
```

#### Daemon Status

```typescript
export interface DaemonStatus {
  running: boolean;
  pid: number;
  uptime: number;
  sessions: number;
}
```

#### IPC Protocol (JSON-RPC 2.0)

```typescript
export interface IpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface IpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
```

#### Dopamine Event Types

```typescript
export type DopamineEventType =
  | 'activity-detected'
  | 'session-start'
  | 'session-stop'
  | 'timer-complete'
  | 'timer-start'
  | 'level-up';

export interface DopamineEvent {
  type: DopamineEventType;
  sessionId?: string;
  projectName?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
```

#### Signal Types

```typescript
export type SignalType = 'prompt' | 'bell' | 'notification' | 'tmux' | 'title';

export interface Signal {
  type: SignalType;
  data: Record<string, unknown>;
  force?: boolean;
}
```

#### Raw Session (from PID.json files)

```typescript
export interface RawSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint?: string;
}
```

#### Parsed JSONL Result

```typescript
export interface ParsedSession {
  totalTokens: number;
  lastExchange: string;
  lastAssistantTimestamp: number;
  lineCount: number;
}
```

#### File Watcher Events

```typescript
export type FileEventType = 'session-discovered' | 'session-removed' | 'activity-detected';

export interface FileEvent {
  type: FileEventType;
  sessionId?: string;
  path: string;
  timestamp: number;
}
```

#### Baseline Data

```typescript
export interface BaselineData {
  startedAt: number;
  lastRecalcAt: number;
  days: DaySignals[];
}
```

#### Dopamine State (for TUI)

```typescript
export interface DopamineState {
  timeOfDay: string;
  warmth: string;
  quietMode: boolean;
  adaptiveParams: AdaptiveParams;
}
```

### 4.2 src/core/constants.ts

All constants are exported. Imports `AdaptiveParams` and `TimerPreset` from `./types.js`.

```typescript
import type { AdaptiveParams, TimerPreset } from './types.js';

// Level thresholds (token count)
export const LEVEL_THRESHOLDS = [0, 1_000, 10_000, 50_000, 200_000];
export const LEVEL_NAMES = ['Baby', 'Juvenile', 'Adult', 'Warrior', 'King'];
export const LEVEL_COLORS = ['gray', 'cyan', 'green', 'yellow', 'red'] as const;

// Fibonacci sequence for momentum pulse badges
export const FIBONACCI = [3, 5, 8, 13, 21, 34, 55, 89];

// Daemon tick interval
export const TICK_INTERVAL_MS = 10_000;

// Token decay rates (per hour)
export const DECAY_RATE_IDLE = 0.02;
export const DECAY_RATE_SLEEPING = 0.05;

// Session state thresholds
export const WORKING_THRESHOLD_MS = 2 * 60 * 1000;       // 2 minutes
export const IDLE_THRESHOLD_MS = 15 * 60 * 1000;          // 15 minutes

// Signal emission limits
export const MIN_PROMINENT_SIGNAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const QUIET_MODE_IGNORE_COUNT = 3;

// Hyperfocus detection
export const HYPERFOCUS_THRESHOLD_MS = 90 * 60 * 1000;    // 90 minutes

// Timer presets
export const TIMER_PRESETS: Record<string, TimerPreset> = {
  pomodoro:  { focus: 25, break: 5 },
  desktime:  { focus: 52, break: 17 },
  ultradian: { focus: 90, break: 20 },
};

// Conservative defaults for adaptive engine (baseline period)
export const CONSERVATIVE_DEFAULTS: AdaptiveParams = {
  signalFrequencyMultiplier: 1.0,
  signalIntensityLevel: 2,
  quietModeThreshold: 3,
  contextDetailLevel: 'normal',
  supportiveSilenceMode: false,
  hyperfocusAlert: false,
};

// Baseline collection period
export const BASELINE_DAYS = 7;

// Data retention
export const DEFAULT_RETENTION_DAYS = 30;

// Log rotation
export const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// IPC timeout
export const IPC_TIMEOUT_MS = 5_000;

// Dashboard refresh
export const DASHBOARD_REFRESH_MS = 2_000;

// Animation frames
export const ANIMATION_FRAMES = 4;

// Hook backup rotation count
export const BACKUP_ROTATION_COUNT = 3;

// Sparkle characters for complete state
export const SPARKLES = ['✨', '·', '★', '⭐', '✦', '•', '∗'];

// Sleep animation frames
export const ZZZ_FRAMES = ['  z', ' zZ', 'zZZ', ' zZ'];

// ASCII density characters for hires rendering
export const DENSITY_CHARS = ' .·:;+x%#@█';
```

### 4.3 src/core/paths.ts

Defines all filesystem paths used by the application. Imports `homedir` from `node:os`, `join` from `node:path`, `mkdirSync` and `existsSync` from `node:fs`.

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const HOME = homedir();

// crayfish-farm home directory
export const CRAYFISH_FARM_HOME = join(HOME, '.crayfish-farm');

// Config & state files
export const CONFIG_FILE = join(CRAYFISH_FARM_HOME, 'config.json');
export const TIMER_STATE_FILE = join(CRAYFISH_FARM_HOME, 'timer-state.json');
export const PROMPT_STATE_FILE = join(CRAYFISH_FARM_HOME, 'prompt-state.json');
export const EVENTS_LOG = join(CRAYFISH_FARM_HOME, 'events.jsonl');
export const PATH_CACHE_FILE = join(CRAYFISH_FARM_HOME, 'path-encoding-cache.json');

// Daemon files
export const PID_FILE = join(CRAYFISH_FARM_HOME, 'crayfish-farm.pid');
export const SOCKET_PATH = join(CRAYFISH_FARM_HOME, 'crayfish-farm.sock');

// Adaptive engine
export const BASELINE_FILE = join(CRAYFISH_FARM_HOME, 'baseline.json');

// Directories
export const LOG_DIR = join(CRAYFISH_FARM_HOME, 'logs');
export const STATS_DIR = join(CRAYFISH_FARM_HOME, 'stats');
export const HOOKS_DIR = join(CRAYFISH_FARM_HOME, 'hooks');

// Log file
export const LOG_FILE = join(LOG_DIR, 'crayfish-farm.log');

// Claude Code paths
export const CLAUDE_HOME = join(HOME, '.claude');
export const CLAUDE_SESSIONS_DIR = join(CLAUDE_HOME, 'sessions');
export const CLAUDE_PROJECTS_DIR = join(CLAUDE_HOME, 'projects');
export const CLAUDE_SETTINGS = join(CLAUDE_HOME, 'settings.json');
```

Functions:
- `ensureHomeDir(): void` -- Creates `CRAYFISH_FARM_HOME`, `LOG_DIR`, `STATS_DIR`, `HOOKS_DIR` if they don't exist using `mkdirSync({ recursive: true })`
- `getStatsFilePath(date: string): string` -- Returns `join(STATS_DIR, `${date}.json`)`

### 4.4 src/core/config.ts

Imports: `readFileSync`, `writeFileSync`, `renameSync`, `existsSync` from `node:fs`. Types from `./types.js`. Paths from `./paths.js`.

Functions:
- `getDefaultConfig(): Config` -- Returns hardcoded defaults:
  - timer: { defaultMinutes: 25, breakMinutes: 5, preset: 'pomodoro' }
  - notification: { sound: true, systemNotification: true, terminalBell: true }
  - dopamine: { signalLevel: 'on' }
  - data: { retentionDays: 30 }
  - daemon: { autoStart: false }
- `loadConfig(configPath?: string): Config` -- Reads CONFIG_FILE, deep-merges with defaults. Returns defaults on missing file or parse error.
- `saveConfig(config: Config, configPath?: string): void` -- Atomic write via tmp file + rename. Calls `ensureHomeDir()` when using default path.

### 4.5 src/core/logger.ts

Imports: `appendFileSync`, `existsSync`, `statSync`, `writeFileSync` from `node:fs`. `LOG_FILE`, `LOG_DIR` from `./paths.js`. `MAX_LOG_SIZE_BYTES` from `./constants.js`.

Internal type: `type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'`

Internal functions:
- `formatMeta(meta?: Record<string, unknown>): string` -- JSON.stringify meta object, returns empty string on error or empty meta
- `writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void` -- No-op if LOG_DIR doesn't exist. Rotates log by truncating to empty if exceeds MAX_LOG_SIZE_BYTES. Format: `[ISO_TIMESTAMP] [LEVEL] message {json_meta}\n`. Silently ignores all errors.

Exported functions:
- `logError(message: string, meta?: Record<string, unknown>): void`
- `logWarn(message: string, meta?: Record<string, unknown>): void`
- `logInfo(message: string, meta?: Record<string, unknown>): void`
- `logDebug(message: string, meta?: Record<string, unknown>): void`

---

## 5. Services Layer (src/services/)

### 5.1 src/services/path-encoder.ts

Imports: `existsSync`, `readFileSync`, `writeFileSync` from `node:fs`. `join` from `node:path`. `CLAUDE_PROJECTS_DIR`, `PATH_CACHE_FILE` from `../core/paths.js`.

**Path encoding algorithm**: Replace all `/` and `.` with `-`:
```typescript
export function encodePath(fsPath: string): string {
  return fsPath.replace(/[/.]/g, '-');
}
```

Internal functions:
- `loadCache(): Record<string, string>` -- Reads PATH_CACHE_FILE, returns {} on error
- `saveCache(cache: Record<string, string>): void` -- Writes cache as JSON, silently ignores errors

**`findProjectDir(cwd: string, projectsDir?: string): string | null`**
Three-strategy lookup:
1. Check cache first, verify cached path still exists
2. Strategy 1 (exact): `join(baseDir, encodePath(cwd))`
3. Strategy 2 (fuzzy): last 3 path segments: `'/' + segments.slice(-3).join('/')`
4. Strategy 3 (fuzzy): last 2 path segments: `'/' + segments.slice(-2).join('/')`

Each successful lookup updates the cache.

### 5.2 src/services/claude-session-discovery.ts

Imports: `readdirSync`, `readFileSync`, `existsSync`, `statSync` from `node:fs`. `join`, `basename` from `node:path`. `RawSession` from types. `CLAUDE_SESSIONS_DIR`, `CLAUDE_PROJECTS_DIR` from paths. `findProjectDir` from `./path-encoder.js`.

**`discoverSessions(sessionsDir?: string): RawSession[]`**
- Reads all `.json` files in `~/.claude/sessions/`
- Parses each as RawSession
- Filters: only `kind === 'interactive'`
- Validates: pid (number), sessionId (string), cwd (string), startedAt (number)
- Skips malformed files silently

**`discoverAllSessions(projectsDir?: string): RawSession[]`**
- First adds all active sessions from `discoverSessions()`
- Then scans all directories under `~/.claude/projects/`
- For each project directory, scans for `.jsonl` files
- Decodes cwd from directory name: `-Users-foo-bar` becomes `/Users/foo/bar` (replace leading `-` with `/`, then all `-` with `/`)
- Skips files containing `.meta` or `agent-` in session ID
- Uses `statSync().birthtimeMs || mtimeMs` for startedAt
- Derives projectName from last segment of decoded cwd
- Sets `pid: 0` for inactive sessions

**`findJsonlForSession(session: RawSession, projectsDir?: string): string | null`**
- First tries `findProjectDir(session.cwd)` then checks `${session.sessionId}.jsonl`
- Fallback: scans ALL project directories for matching sessionId

### 5.3 src/services/claude-session-parser.ts

Imports: `readFileSync`, `existsSync` from `node:fs`. `ParsedSession` from types.

Internal interfaces:
```typescript
interface ContentPart {
  type: string;
  text?: string;
}

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AssistantMessage {
  usage?: MessageUsage;
  content?: string | ContentPart[];
}

interface JsonlLine {
  type?: string;
  timestamp?: string | number;
  message?: AssistantMessage;
}
```

Internal function:
- `extractTextFromContent(content: string | ContentPart[]): string` -- If string, returns as-is. If array, filters for `type === 'text'`, joins text fields.

**`parseJsonlFile(filePath: string): ParsedSession`**
- Returns `{ totalTokens: 0, lastExchange: '', lastAssistantTimestamp: 0, lineCount: 0 }` if file doesn't exist
- Reads entire file, splits by newline, filters empty lines
- For each line parsed as JSON:
  - If `type === 'assistant'` and has `message`:
    - Sums `input_tokens + output_tokens` (excludes cache tokens)
    - Extracts text content as `lastExchange`
    - Tracks `lastAssistantTimestamp` (handles both ISO string and epoch number)
- Skips malformed lines silently

### 5.4 src/services/agent-tracker.ts

Imports: `join` from `node:path`. Types. Constants (`LEVEL_THRESHOLDS`, `DECAY_RATE_IDLE`, `DECAY_RATE_SLEEPING`, `WORKING_THRESHOLD_MS`, `IDLE_THRESHOLD_MS`). `discoverAllSessions`, `findJsonlForSession`, `parseJsonlFile`.

**`computeLevel(tokens: number): number`**
- Iterates LEVEL_THRESHOLDS `[0, 1000, 10000, 50000, 200000]` from end to start
- Returns index+1 of first threshold <= tokens
- Level 1: 0-999, Level 2: 1000-9999, Level 3: 10000-49999, Level 4: 50000-199999, Level 5: 200000+

**`determineState(lastActivityAt: number, now?: number): AgentState`**
- elapsed < 2 minutes (WORKING_THRESHOLD_MS): `'working'`
- elapsed < 15 minutes (IDLE_THRESHOLD_MS): `'idle'`
- else: `'sleeping'`

**Token Decay Formula: `applyTokenDecay(tokens, state, inactiveMs): number`**
- Working or 'complete' state: no decay, returns tokens as-is
- Idle: rate = 0.02 per hour
- Sleeping: rate = 0.05 per hour
- Formula: `tokens * Math.pow(1 - rate, hours)` where `hours = inactiveMs / (1000 * 60 * 60)`
- Clamped to minimum 0

**`discoverAgents(projectsDir?: string): AgentInfo[]`**
- Calls `discoverAllSessions()`, then for each session:
  1. Finds JSONL file via `findJsonlForSession()`
  2. Parses JSONL for tokens/exchange/timestamp
  3. Determines lastActivityAt (prefers lastAssistantTimestamp, falls back to startedAt)
  4. Determines state via `determineState()`
  5. Applies token decay
  6. Computes level from decayed tokens
  7. Derives projectName from last cwd segment
- Returns array of `AgentInfo`

### 5.5 src/services/timer-engine.ts

Imports: `readFileSync`, `writeFileSync`, `renameSync`, `existsSync` from `node:fs`. Types. Constants (`TIMER_PRESETS`). Paths (`TIMER_STATE_FILE`). Config (`loadConfig`).

Internal:
- `writeStateAtomic(state, filePath?)` -- atomic write via tmp+rename, calls ensureHomeDir()
- `readState(filePath?)` -- reads and parses TimerState, returns null on error

Exported functions:
- **`startTimer(minutes?: number, filePath?): TimerState`** -- Uses config defaultMinutes if no minutes. Creates state with `running: true`, `startedAt: Date.now()`, `durationMs: minutes*60*1000`, preset from config, `flowMode: false`, `pausedAt: null`.
- **`stopTimer(filePath?): TimerState`** -- Preserves existing state but sets `running: false`, `pausedAt: null`.
- **`getTimerStatus(filePath?): TimerState | null`** -- Reads state file.
- **`applyPreset(name, filePath?): TimerState`** -- Looks up preset in TIMER_PRESETS, throws on unknown. Starts timer with preset's focus duration.
- **`getRemainingMs(filePath?): number`** -- `durationMs - (Date.now() - startedAt)`.
- **`isTimerComplete(filePath?): boolean`** -- running AND remaining <= 0.

### 5.6 src/services/dopamine-service.ts

Imports: `readFileSync`, `existsSync` from `node:fs`. `PROMPT_STATE_FILE`. `HYPERFOCUS_THRESHOLD_MS`. Logger. Signal emitter functions. Adaptive engine. Notification. Types.

Internal state:
- `_timeOfDay: string` -- computed from current hour
- `_warmth: string` -- 'neutral' initially

Internal functions:
- `computeTimeOfDay(): string` -- hour 5-11: 'AM', 12-17: 'PM', else: 'EVE'
- `computeWarmth(agents): string` -- 0 working: 'cool', 1: 'warm', 2+: 'hot'
- `checkHyperfocus(agents): boolean` -- any working agent with `now - lastActivityAt >= 90 minutes`

**`handleEvent(event: DopamineEvent): void`**
Event handlers:
- `'activity-detected'`: Calls `onActivityDetected()` (momentum pulse). Logs badge if signal emitted.
- `'session-stop'`: Calls `onSessionIdle(projectName)` (return bridge).
- `'timer-complete'`: Calls `onTimerComplete()` + `notifyTimerComplete(0)` (completion ripple).
- `'level-up'`: Calls `writePromptState({ pulse: 'flash' })`.
- `'session-start'`, `'timer-start'`: No action.

**`tick(agents: AgentInfo[]): void`**
Called every TICK_INTERVAL_MS (10s):
1. Updates `_timeOfDay`
2. Computes `_warmth` from agents
3. Checks hyperfocus
4. Writes prompt-state.json via `writePromptState()`

**`getDopamineState(): DopamineState`**
Returns current dopamine state. Reads prompt-state.json for latest warmth.

**ETHICAL BOUNDARIES (hardcoded, documented in comments):**
- NEVER include streak data
- NEVER compare today vs yesterday automatically
- NEVER include "X minutes wasted"
- NEVER include inactive time ("N minutes away")
- NEVER punish via signal absence

### 5.7 src/services/adaptive-engine.ts

Imports: `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`. `BASELINE_DAYS`, `CONSERVATIVE_DEFAULTS`. `BASELINE_FILE`. Logger. Types.

**`loadBaseline(filePath?): BaselineData | null`** -- Reads baseline.json.
**`isBaselinePeriod(filePath?): boolean`** -- True if no baseline OR days.length < BASELINE_DAYS (7).
**`recordDaySignals(signals, filePath?): void`** -- Appends to baseline days array, updates lastRecalcAt.

**`recalculateParams(filePath?): AdaptiveParams`**
Starts from conservative defaults, then applies rules based on latest day's signals:

1. **Rule: High ignore rate** -- If `signalIgnoreRate > 0.6`, set `signalFrequencyMultiplier = 0.5`
2. **Rule: Low productive time + long duration** -- If `productiveAppTimeRatio < 0.3 AND maxSessionLengthMin > 60`, set `supportiveSilenceMode = true`, `signalIntensityLevel = 1`
3. **Rule: High timer completion rate** -- If `timerCompletionRate > 0.8`, set `signalIntensityLevel = 1`
4. **Rule: Many consecutive long sessions** -- If `consecutiveSessions >= 3 AND maxSessionLengthMin > 30`, set `hyperfocusAlert = true`
5. **Clamp**: `signalFrequencyMultiplier` clamped to `[0.5, 1.5]`

**`getAdaptiveParams(filePath?): AdaptiveParams`** -- Returns conservative defaults during baseline period, otherwise recalculates.

**`isBadDayDetected(signals?, filePath?): boolean`** -- `productiveAppTimeRatio < 0.3 AND maxSessionLengthMin > 60`

### 5.8 src/services/signal-emitter.ts

Imports: `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`. Constants (`FIBONACCI`, `MIN_PROMINENT_SIGNAL_INTERVAL_MS`, `QUIET_MODE_IGNORE_COUNT`). `PROMPT_STATE_FILE`. Notification functions. Logger. Types.

Internal state:
- `exchangeCount = 0`
- `lastProminentSignalAt = 0`
- `consecutiveIgnored = 0`
- `quietMode = false`

**`canEmitProminentSignal(): boolean`** -- Returns false if quietMode. Otherwise checks if at least 5 minutes since last prominent signal.

**`onActivityDetected(): Signal | null`** (Momentum Pulse)
1. Increments exchangeCount
2. Only emits on Fibonacci numbers: `[3, 5, 8, 13, 21, 34, 55, 89]`
3. If can't emit (rate limited): increments consecutiveIgnored. If >= 3 (QUIET_MODE_IGNORE_COUNT), enters quiet mode.
4. If can emit: writes badge to prompt-state.json, resets consecutiveIgnored.
5. Returns `Signal { type: 'prompt', data: { badge: exchangeCount } }` or null.

**`onTimerComplete(): void`** -- Sends terminal bell + system notification "Timer finished. Take a break!"

**`onSessionIdle(projectName): void`** -- Writes `{ returnTo: projectName }` to prompt-state (Return Bridge)

**`writePromptState(state: Partial<PromptState>): void`**
- Reads existing prompt-state.json (or uses defaults)
- Merges with new partial state
- Updates `updated` timestamp
- Atomic write via tmp+rename

**`resetState(): void`** -- Resets all internal state to initial values.
**`getQuietMode(): boolean`** -- Returns quiet mode flag.

### 5.9 src/services/stats-aggregator.ts

Imports: `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`. Types. Paths.

Internal:
- `getTodayDateString(): string` -- Returns `YYYY-MM-DD` format
- `readStats(filePath): DayStats | null` -- Reads and parses stats JSON
- `writeStats(stats, filePath): void` -- Atomic write

Exported:
- **`getTodayStats(): DayStats`** -- Returns today's stats, creates fresh `{ focusMinutes: 0, completedSessions: 0, date }` if none exist
- **`recordFocusMinutes(minutes): void`** -- Adds minutes to today's stats
- **`recordCompletedSession(): void`** -- Increments today's completedSessions
- **`getStatsForDate(date): DayStats | null`** -- Reads stats for a specific date

### 5.10 src/services/hook-installer.ts

Imports: `readFileSync`, `writeFileSync`, `existsSync`, `renameSync`, `mkdirSync`. `join`. Paths. `BACKUP_ROTATION_COUNT`.

Constants:
- `SESSION_START_HOOK_CMD = '$HOME/.crayfish-farm/hooks/session-start.sh'`
- `SESSION_STOP_HOOK_CMD = '$HOME/.crayfish-farm/hooks/session-stop.sh'`
- `CRAYFISH_FARM_MARKER = 'crayfish-farm'`

Internal interface:
```typescript
interface ClaudeSettings {
  hooks?: {
    SessionStart?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    SessionStop?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
```

Internal functions:
- `readSettings(): ClaudeSettings` -- Reads `~/.claude/settings.json`, returns {} on error
- `rotateBackups(): void` -- Rotates `.bak.1` -> `.bak.2` -> `.bak.3` (max BACKUP_ROTATION_COUNT=3)
- `writeHookScripts(): void` -- Writes 3 shell scripts to `~/.crayfish-farm/hooks/` with mode 0o755:
  - `session-start.sh`: sends JSON-RPC event via Unix socket, falls back to events.jsonl append
  - `session-stop.sh`: same pattern
  - `notification.sh`: only sends via socket (no fallback)

**`installHooks(): { success: boolean; backedUp: boolean }`**
1. Writes hook scripts
2. Rotates backups of settings.json
3. Adds SessionStart and SessionStop hooks to settings.json if not already present
4. Each hook entry: `{ matcher: '', hooks: [{ type: 'command', command: SESSION_*_HOOK_CMD }] }`
5. Creates `~/.claude/` directory if needed

**`uninstallHooks(): { success: boolean }`**
- Filters out hook entries containing `CRAYFISH_FARM_MARKER` from both SessionStart and SessionStop
- Deletes empty hook arrays
- Rotates backup before writing

**`areHooksInstalled(): boolean`**
- Checks if any SessionStart or SessionStop hook entry contains `CRAYFISH_FARM_MARKER`

### 5.11 src/services/notification.ts

Imports: `notifier` from `node-notifier`. `loadConfig`.

- **`sendBell(): void`** -- `process.stdout.write('\x07')`
- **`sendSystemNotification(title, message): void`** -- `notifier.notify({ title, message })`
- **`notifyTimerComplete(sessionMinutes): void`** -- Reads config, sends bell if terminalBell enabled, sends system notification if systemNotification enabled. Title: 'crayfish-farm: Focus Session Complete'.

### 5.12 src/services/flow-protection.ts

Imports: `getTimerStatus`, `stopTimer`. `TIMER_STATE_FILE`. `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`. `ensureHomeDir`. Types.

Internal:
- `readRawState(filePath?): TimerState | null` -- Reads timer state
- `writeStateAtomic(state, filePath?): void` -- Atomic write

Exported:
- **`isFlowMode(filePath?): boolean`** -- Returns `state?.flowMode ?? false`
- **`setFlowMode(enabled, filePath?): void`** -- If no existing state, creates minimal stopped state with flowMode. Otherwise updates flowMode on existing state.

### 5.13 src/services/shell-integrator.ts

Pure functions, no imports beyond types.

- **`generateZshIntegration(): string`** -- Returns multi-line string with:
  - `crayfish_farm()` wrapper function for eval-based cd
  - `crayfish_farm_rprompt()` function calling `crayfish-farm prompt-status`
  - `RPROMPT='$(crayfish_rprompt)'`
  - Optional auto-start daemon comment

- **`generateBashIntegration(): string`** -- Similar to zsh but uses `crayfish_ps1()` and PS1 integration

- **`generateTmuxIntegration(): string`** -- Returns tmux config:
  - `set -g status-right "#(crayfish-farm tmux-status) | %H:%M"`
  - `set -g status-interval 2`

### 5.14 src/services/data-purger.ts

Imports: `readdirSync`, `statSync`, `unlinkSync`, `existsSync`, `readFileSync`, `writeFileSync`, `truncateSync`. `join`. `STATS_DIR`, `EVENTS_LOG`. `DEFAULT_RETENTION_DAYS`, `MAX_LOG_SIZE_BYTES`.

**`purgeOldData(retentionDays?, statsDir?): { deletedFiles: number }`**
- Scans STATS_DIR for `.json` files
- Deletes files where `mtimeMs < cutoffMs` (cutoff = now - retentionDays * 24h)
- Default retention: 30 days

**`purgeEventLog(maxSizeBytes?, eventsLog?): void`**
- If events.jsonl exceeds maxSizeBytes (default 10MB):
  - Reads entire file, takes last maxSizeBytes characters
  - Finds first newline to avoid partial lines
  - Rewrites file with trimmed content

---

## 6. CLI Layer (src/cli/)

### 6.1 src/cli/index.ts

Entry point with shebang `#!/usr/bin/env node`.

Imports `Command` from `commander` and 16 `register` functions from command files.

Creates program:
```typescript
const program = new Command();
program
  .name('crayfish-farm')
  .description('CLI-integrated focus tool for ADHD developers')
  .version('0.1.0');
```

Registers all 16 commands (note: hooks.ts registers 2 commands: `install-hooks` and `uninstall-hooks`):
- registerStatus, registerWhere, registerDash, registerTimer, registerToday, registerFlow
- registerInit, registerDoctor, registerConfigCmd, registerDaemonCmd, registerGo
- registerHooks, registerReset, registerPromptStatus, registerTmuxStatus, registerNotch

Parses with `program.parseAsync(process.argv)`.

### 6.2 src/cli/ipc-client.ts

Imports: `net` from `node:net`. `existsSync`, `readFileSync`. Paths. Constants. Types.

Internal state: `let requestIdCounter = 1;`

**`sendRequest(method, params?, socketPath?): Promise<unknown>`**
- Creates TCP connection to Unix socket
- Sends JSON-RPC 2.0 request with incrementing ID
- Parses newline-delimited JSON responses
- Timeout: IPC_TIMEOUT_MS (5000ms)
- Rejects on timeout, error, close before response, or JSON-RPC error

**`isDaemonRunning(socketPath?): Promise<boolean>`**
Three checks:
1. PID_FILE exists
2. PID is alive (`process.kill(pid, 0)`)
3. Socket is connectable (1000ms timeout)

### 6.3 CLI Commands (src/cli/commands/)

#### 6.3.1 config-cmd.ts

Command: `config [key] [value]`
Description: 'View or set configuration values (dot-path: timer.defaultMinutes)'

Actions:
- No args: prints full config as JSON
- Key only: prints specific nested value (supports dot-path like `timer.defaultMinutes`)
- Key + value: sets value. `parseValue()` converts 'true'->boolean, 'false'->boolean, numbers, or string.

Internal helpers:
- `getNestedValue(obj, path)` -- Traverses object by dot-separated path
- `setNestedValue(obj, path, value)` -- Sets value at dot-separated path, creating intermediate objects
- `parseValue(raw)` -- Parses string to boolean/number/string

#### 6.3.2 daemon-cmd.ts

Command: `daemon <action>` (action: start|stop|status)

- **start**: Checks if already running. Resolves daemon path relative to CLI bundle (`dist/cli/index.js` -> `../daemon/index.js`). Spawns detached with `stdio: 'ignore'`, unrefs.
- **stop**: Reads PID from PID_FILE, sends SIGTERM.
- **status**: Checks via `isDaemonRunning()`, shows PID.

Uses `fileURLToPath(import.meta.url)` for __filename resolution.

#### 6.3.3 dash.ts

Command: `dash`
Description: 'Open the interactive TUI dashboard'
Action: Calls `startDashboard()` from `../../tui/dashboard.js`

#### 6.3.4 doctor.ts

Command: `doctor`
Description: 'Check environment and diagnose configuration issues'

Checks (with green checkmark or red X):
1. Node.js >= 20
2. `~/.claude/` exists
3. `~/.crayfish-farm/` exists
4. Daemon running
5. Hooks installed in settings.json
6. Python + PIL available (`python3 -c "from PIL import Image"` with 5s timeout)
7. Claude Code sessions found (any files in sessions dir)

#### 6.3.5 flow.ts

Command: `flow <state>` (state: on|off)
Action: Calls `setFlowMode(enabled)`. Shows green "ON" or yellow "OFF" message.

#### 6.3.6 go.ts

Command: `go <session-name>`
Description: "Output cd command for a session (designed to be eval'd by shell)"
Action: Discovers agents, fuzzy matches by projectName or cwd (case-insensitive includes). Outputs `cd "path"` to stdout for shell eval. Exits 1 with no output if no match.

#### 6.3.7 hooks.ts (registers 2 commands)

Command 1: `install-hooks`
Description: 'Install crayfish-farm Claude Code hooks into ~/.claude/settings.json'
Action: Calls `installHooks()`, reports backup and success/failure.

Command 2: `uninstall-hooks`
Description: 'Remove crayfish-farm hooks from ~/.claude/settings.json'
Action: Calls `uninstallHooks()`, reports success/failure.

#### 6.3.8 init.ts

Command: `init`
Options: `--full` (print shell integration snippets)
Action: Calls `ensureHomeDir()`. Creates default config if not exists. With `--full`, prints zsh and bash integration snippets.

#### 6.3.9 notch.ts

Command: `notch [action]` (default: start, options: start|stop|status)

Internal:
- `NOTCH_PID_FILE = join(homedir(), '.crayfish-farm', 'notch.pid')`
- `getNotchMainPath()`: Resolves from CLI bundle to `../notch/main.js`
- `getElectronPath()`: Uses `createRequire(import.meta.url)` to require `electron`
- `isNotchRunning()`: Checks PID file + `process.kill(pid, 0)`

Actions:
- **stop**: Sends SIGTERM to notch PID
- **status**: Shows running/not running with PID
- **start**: Checks not already running, finds electron binary, spawns `electron [notchMain]` detached with `ELECTRON_DISABLE_SECURITY_WARNINGS=true`, unrefs, exits after 500ms

#### 6.3.10 prompt-status.ts

Command: `prompt-status`
Description: 'Output prompt status string for PS1/RPROMPT integration'
Action: Reads prompt-state.json, builds string from parts:
1. Timer (priority)
2. Badge (momentum number)
3. Return-to indicator (`<- projectName`)
4. Fallback: `timeOfDay warmth`
Parts joined with ` | `. Writes to stdout (no newline). Empty string on error.

#### 6.3.11 reset.ts

Command: `reset`
Options: `--force`
Action: Without --force, shows warning. With --force, `rmSync(CRAYFISH_FARM_HOME, { recursive: true, force: true })`.

#### 6.3.12 status.ts

Command: `status`
Description: 'Show all discovered Claude agents and their current state'
Action: Discovers agents, displays table with:
- State indicator: working=green `●`, idle=yellow `◐`, sleeping=dim `○`
- Project name (padded to 20), Level + name (padded to 8), token count (formatted: K/M), truncated last exchange (40 chars)
- Summary line: X active, Y idle, Z sleeping

Token formatting: >= 1M: `1.2M`, >= 1K: `44.9K`, else: rounded integer.

#### 6.3.13 timer.ts

Subcommand group: `timer`

Sub-subcommands:
- `timer start [minutes]` -- Starts timer, validates positive number
- `timer stop` -- Stops timer
- `timer status` -- Shows progress bar with remaining time and percentage. Bar: `[` + green `█` + gray `░` + `]`. Shows preset and flow mode status.
- `timer preset <name>` -- Applies named preset

Internal helpers:
- `formatDuration(ms)`: `Xm XXs`
- `renderProgressBar(remainingMs, totalMs, width=20)`: ratio-based filled/empty bar

#### 6.3.14 tmux-status.ts

Command: `tmux-status`
Description: 'Output tmux status-right string with color codes'
Action: Similar to prompt-status but uses tmux color codes:
- Timer: `#[fg=green]TIME#[default]`
- Badge: `#[fg=yellow]xN#[default]`
- Return-to: `#[fg=cyan]<- NAME#[default]`
- Fallback: `#[fg=white,dim]TOD WARMTH#[default]`

#### 6.3.15 today.ts

Command: `today`
Description: "Show today's focus stats"
Action: Gets today stats, formats hours/minutes, shows focus time and completed sessions.

#### 6.3.16 where.ts

Command: `where`
Options: `--brief` (only show project names)
Description: 'Show working agents and their last exchange context'
Action: Filters agents to working/idle. Shows Korean prompt "어디까지 했더라? (Where were we?)". Each agent shows state indicator, project name, cwd, and truncated last exchange (200 chars).

---

## 7. Daemon Layer (src/daemon/)

### 7.1 src/daemon/index.ts

Entry point for the background daemon process.

**Startup sequence:**
1. `ensureHomeDir()`
2. Write PID file (`process.pid` to `crayfish-farm.pid`)
3. Define 16 IPC method handlers (see below)
4. Start IPC server on Unix socket
5. Start file watcher with event callback
6. Start tick interval (every TICK_INTERVAL_MS = 10s)
7. Register SIGTERM/SIGINT handlers for graceful shutdown

**IPC Method Handlers** (all async):
- `agent.list` -- Returns `discoverAgents()`
- `agent.detail` -- Returns single agent by sessionId param
- `timer.start` -- Starts timer with optional minutes param
- `timer.stop` -- Stops timer
- `timer.status` -- Returns timer status
- `timer.preset` -- Applies named preset
- `stats.today` -- Returns today's stats
- `flow.set` -- Sets flow mode (boolean enabled param)
- `config.get` -- Returns loaded config
- `config.set` -- Deep merges params into config, saves
- `daemon.status` -- Returns `{ running: true, pid, uptime, sessions }`
- `prompt.state` -- Reads prompt-state.json
- `tmux.state` -- Same as prompt.state
- `dopamine.state` -- Returns `getDopamineState()`
- `hook.event` -- Passes event to `handleEvent()`

**File watcher callback:**
- `activity-detected`: forwards as DopamineEvent `activity-detected`
- `session-removed`: discovers agents, finds project name, forwards as `session-stop`

**Tick loop:**
- Every 10s: `discoverAgents()` then `tick(agents)` from dopamine service
- Catches and logs errors

**Graceful shutdown:**
- Clears tick interval
- Stops file watcher
- Stops IPC server
- Removes PID file
- Exits 0

### 7.2 src/daemon/ipc-server.ts

Imports: `net`. `unlinkSync`, `existsSync`. `SOCKET_PATH`. Logger. Types.

Types:
```typescript
export type MethodHandler = (params?: Record<string, unknown>) => Promise<unknown>;
export type MethodHandlers = Record<string, MethodHandler>;
```

Internal: `const connectedSockets = new Set<net.Socket>();`

**`buildResponse(id, result?, error?): IpcResponse`** -- Constructs JSON-RPC 2.0 response.

**`handleConnection(socket, handlers): void`**
- Tracks socket in connectedSockets set
- Reads newline-delimited JSON messages
- Parses each as IpcRequest
- On parse error: returns error code -32700
- On unknown method: returns error code -32601
- On handler error: returns error code -32603
- On success: returns result

**`startIpcServer(handlers, socketPath?): Promise<net.Server>`**
- Cleans up stale socket file
- Creates net.Server, listens on Unix socket
- Returns Promise resolving to server

**`stopIpcServer(server, socketPath?): Promise<void>`**
- Destroys all connected sockets
- Closes server
- Removes socket file

**`broadcastToSubscribers(server, data): void`** -- Writes JSON+newline to all non-destroyed sockets.

### 7.3 src/daemon/file-watcher.ts

Imports: `chokidar`. `existsSync`. `basename`. Paths. Logger. Types.

Constant: `const DEBOUNCE_MS = 500;`

**`startWatching(onEvent): { stop: () => Promise<void> }`**

Internal debounce: Map of timers keyed by file path. Each event is debounced by 500ms.

Watch paths:
- `CLAUDE_SESSIONS_DIR` (`~/.claude/sessions/`) if exists
- `CLAUDE_PROJECTS_DIR` (`~/.claude/projects/`) if exists
- If neither exists, returns no-op stop function

Chokidar options: `{ persistent: true, ignoreInitial: true, depth: 3 }`

Event handlers:
- **add** in sessions dir (`.json`): emits `session-discovered` with sessionId from filename
- **add** in projects dir (`.jsonl`): emits `activity-detected` with sessionId from filename
- **unlink** in sessions dir (`.json`): emits `session-removed`
- **change** in projects dir (`.jsonl`): emits `activity-detected`

Stop function: clears all debounce timers, calls `watcher.close()`.

---

## 8. TUI Layer (src/tui/)

### 8.1 src/tui/ansi.ts

ANSI escape sequence constants and helpers:

```typescript
export const ENTER_ALT_SCREEN = '\x1b[?1049h';
export const EXIT_ALT_SCREEN = '\x1b[?1049l';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const MOVE_HOME = '\x1b[H';
export const CLEAR_SCREEN = '\x1b[2J';
export const RESET = '\x1b[0m';
```

Functions:
- `moveTo(row, col): string` -- `\x1b[${row};${col}H`
- `fgRgb(r, g, b): string` -- `\x1b[38;2;${r};${g};${b}m`
- `bgRgb(r, g, b): string` -- `\x1b[48;2;${r};${g};${b}m`
- `boxTop(width, title?): string` -- `┌──title──...─┐` or `┌─...─┐`
- `boxBottom(width): string` -- `└─...─┘`
- `boxMiddle(width): string` -- `├─...─┤`
- `boxSide(): string` -- `│`
- `horizontalLine(width): string` -- `─` repeated

### 8.2 src/tui/text-utils.ts

**CJK/fullwidth character width detection:**

`charWidth(code: number): number` -- Returns 2 for these Unicode ranges, 1 for everything else:
- `0x1100-0x115f` (Hangul Jamo)
- `0x2e80-0x303e` (CJK Radicals)
- `0x3040-0x33bf` (Hiragana/Katakana)
- `0x3400-0x4dbf` (CJK Ext A)
- `0x4e00-0x9fff` (CJK Unified)
- `0xac00-0xd7af` (Hangul Syllables)
- `0xf900-0xfaff` (CJK Compat)
- `0xfe30-0xfe6f` (CJK Compat Forms)
- `0xff01-0xff60` (Fullwidth Forms)
- `0xffe0-0xffe6` (Fullwidth Signs)
- `0x20000-0x2fa1f` (CJK Extensions)

Other functions:
- `stripAnsi(str): string` -- Removes `\x1b[0-9;]*m` sequences
- `displayWidth(str): string` -- Sum of charWidth for each code point (after stripping ANSI)
- `truncateToWidth(str, maxWidth, ellipsis='...'): string` -- Truncates respecting display width
- `padToWidth(str, width, char=' '): string` -- Right-pads to display width
- `centerToWidth(str, width): string` -- Centers with left/right space padding

### 8.3 src/tui/token-viz.ts

Imports: `chalk`. Constants (`LEVEL_THRESHOLDS`, `LEVEL_NAMES`, `LEVEL_COLORS`). Types.

**`formatTokenCount(tokens): string`**
- >= 1M: `1.2M`
- >= 1K: `44.9K`
- else: string of tokens

**`renderLevelBar(agent, width): string`**
Format: `Lv3 Adult ██████░░░ 44.9K`
- Computes progress ratio between current and next level thresholds
- Colors bar using level color (gray/cyan/green/yellow/red)

**`renderTokenDelta(delta): string`**
- delta > 100: green `+1.2K↑`
- delta < -100: red `-500↓`
- else: empty string

**`renderTokenHistogram(agents, width): string[]`**
- One line per agent: `project-name  ██████████  44.9K`
- Bar width proportional to `tokenUsage / maxTokens`

### 8.4 src/tui/card-renderer.ts

Imports: `chalk`. `getCrawfishArt` from `./crawfish-art.js` (auto-generated). Token viz. Text utils. Ansi. Constants. Types.

State indicators:
```typescript
const STATE_INDICATOR: Record<string, string> = {
  working: chalk.green('●'),
  idle: chalk.yellow('◐'),
  sleeping: chalk.dim('○'),
};
```

**`describeActivity(agent, maxWidth): string`**
- sleeping: '휴식 중...' (resting)
- idle: '대기 중...' (waiting)
- working with no exchange: '작업 완료!' (work complete)
- working with exchange: `summarizeExchange(exchange, maxWidth)`

**`summarizeExchange(text, maxLen): string`**
- Finds first meaningful line (skips empty, `##`, `` ``` ``, `|`)
- Strips markdown: `**`, `` ` ``, `|`, `#`
- Truncates to CJK-aware display width

**`renderCard(agent, _index, frame, innerWidth, flash): string[]`**
Returns array of lines forming a bordered card:
1. Top border with project name title (yellow border if flash)
2. Crawfish art lines (centered, from `getCrawfishArt(level, state, frame)`)
3. Level progress bar
4. Activity line with state indicator
5. Bottom border

### 8.5 src/tui/grid-view.ts

Imports: `chalk`. Card renderer. Ansi. Types.

**`getCardDimensions(): { inner, outer, columns }`**
- Terminal >= 90 cols: 2 columns, inner = `floor((cols-6)/2) - 2`, clamped [28, 60]
- Terminal < 90 cols: 1 column, inner = `cols - 6`, clamped [28, 60]

Internal:
- `formatTimer(timer): string` -- Shows `min:sec`, cyan with `[flow]` if flow mode, green otherwise
- `formatDopamineState(prompt): string` -- Dim `timeOfDay warmth`

**`renderGridView(agents, timer, stats, promptState, frame, tokenDeltas, flashSet): string`**

Layout:
1. Header: `🦞 crayfish-farm Agent Dashboard` + dopamine state + timer
2. Horizontal line (min(cols, 80))
3. Cards in 1 or 2 columns (paired side-by-side for 2-column layout)
4. Footer separator
5. Stats line: `Today: Xmin focus | Y sessions` + hints `[q]uit [r]efresh [t]imer [1-5]detail`

### 8.6 src/tui/detail-view.ts

Imports: `chalk`. `getCrawfishHires` from `./crawfish-art.js`. Token viz. Ansi. Constants. Types.

**`renderDetailView(agent, allAgents, frame): string`**

Layout:
1. Header: `Detail: projectName`
2. Horizontal line
3. Hires crawfish art (from `getCrawfishHires(level, state, frame)`)
4. Level info: `Level N - Name`
5. Extended level bar
6. Progress to next level (or "Max level reached!")
7. Token histogram of all agents
8. Last exchange (up to 10 lines)
9. Timestamps: last active, started
10. Footer: `[b]ack [q]uit`

### 8.7 src/tui/dashboard.ts

Imports: `readline`. `readFileSync`, `existsSync`. Ansi constants. Grid/detail views. Agent tracker. Timer engine. Stats aggregator. Constants. Paths. Types.

**`startDashboard(): Promise<void>`**

State tracking:
- `renderFrame`: increments each render
- `detailIndex`: null for grid, number for detail view
- `prevTokens`: Map tracking previous token counts per session
- `prevLevels`: Map tracking previous levels per session
- `flashSet`: Set of session IDs currently flashing (level-up)
- `flashTimers`: Map of remaining flash frames (FLASH_FRAMES = 3)

**Keyboard handling** (raw mode):
- `q` or Ctrl-C: quit (cleanup, exit)
- `r`: refresh
- `t`: toggle timer (start 25min or stop)
- `1`-`9`: switch to detail view for agent N
- `b` or Escape: back to grid view

**Render cycle:**
1. Discover agents
2. Get timer status, today stats, prompt state
3. Track token deltas
4. Track level-ups, manage flash set (3 frame duration)
5. Render grid or detail view based on detailIndex
6. Apply runtime effects (zZZ animation for sleeping agents)
7. Write to stdout: `CLEAR_SCREEN + MOVE_HOME + output`

**Runtime effects** (`applyRuntimeEffects`):
- For sleeping agents: adds dim `zZZ` cycling text after project name
- Uses ZZZ_FRAMES: `['  z', ' zZ', 'zZZ', ' zZ']`
- Only replaces first occurrence of project name to avoid duplication

Refresh interval: DASHBOARD_REFRESH_MS (2000ms).

### 8.8 src/tui/crawfish-art.ts (AUTO-GENERATED)

This file does NOT exist in the repository. It is generated by `python3 scripts/generate-sprites.py`.

Structure (when generated):
```typescript
// AUTO-GENERATED by scripts/generate-sprites.py --- DO NOT EDIT
// 5 levels x 4 states x 4 frames x 2 resolutions

type FrameLines = string[];
type FrameMap = Record<string, FrameLines[]>;

export const COMPACT: Record<number, FrameMap> = {
  1: {  // Baby
    idle: [ [line, line, ...], [frame2], [frame3], [frame4] ],
    working: [ ... ],
    complete: [ ... ],
    sleeping: [ ... ],
  },
  2: { ... },  // Juvenile
  3: { ... },  // Adult
  4: { ... },  // Warrior
  5: { ... },  // King
};

export const HIRES: Record<number, FrameMap> = {
  // Same structure as COMPACT but higher resolution
};

export function getCrawfishArt(level: number, state: string, frame: number): string[] {
  const lvl = COMPACT[level];
  if (!lvl) return [];
  const stateFrames = lvl[state];
  if (!stateFrames) return [];
  return stateFrames[frame % stateFrames.length] ?? [];
}

export function getCrawfishHires(level: number, state: string, frame: number): string[] {
  const lvl = HIRES[level];
  if (!lvl) return [];
  const stateFrames = lvl[state];
  if (!stateFrames) return [];
  return stateFrames[frame % stateFrames.length] ?? [];
}
```

---

## 9. Mac menu bar widget (src/notch/)

### 9.1 src/notch/main.ts

Electron main process for the "Crawfish Park" tray widget.

Imports: `app`, `BrowserWindow`, `Tray`, `screen`, `ipcMain`, `nativeImage`, `Menu` from `electron`. `join`, `dirname` from `node:path`. `fileURLToPath` from `node:url`. `readFileSync`, `existsSync`, `writeFileSync`, `unlinkSync` from `node:fs`. `discoverAgents` from agent-tracker. `AgentInfo` type.

**Constants:**
- `PANEL_W = 480, PANEL_H = 520`
- `NOTCH_PID = join(process.env.HOME ?? '/tmp', '.crayfish-farm', 'notch.pid')`

**Single instance lock:** `app.requestSingleInstanceLock()` -- quits if another instance exists.

**PID management:**
- `writePid()`: writes process.pid to notch.pid
- `removePid()`: removes notch.pid

**Asset paths:**
- `assetsDir()`: `join(__dirname, '..', '..', 'assets', 'crayfish')`
- `rendererHtml()`: tries `join(__dirname, 'renderer', 'index.html')`, falls back to source path

**Sprite loading** (`loadSprites()`):
- Iterates 5 levels x 4 states (but uses `['idle', 'working', 'complete', 'sleeping']`)
- Reads each PNG as base64, creates `data:image/png;base64,...` data URLs
- Returns `Record<string, string>` keyed as `{level}_{state}`

**Tray icon** (`makeTrayIcon(agents)`):
- Finds highest-level agent
- Uses its level name and state to select PNG
- Resizes to 18x18
- Returns empty image if no match

**Panel positioning** (`togglePanel()`):
- Calculates position below tray icon: centered horizontally, 4px below tray
- Clamped to work area bounds
- Tracks `lastShowAt` for blur debounce

**Data sending** (`sendData()`):
- Discovers agents
- First call: sends both agents and sprites (spritesSent flag)
- Subsequent calls: sends only agents
- Updates tray icon and tooltip

**App lifecycle:**
- `app.dock?.hide()` (macOS: hide dock icon)
- On ready:
  1. Write PID
  2. Load sprites
  3. Create Tray with icon
  4. Tray left-click: togglePanel()
  5. Tray right-click: popup context menu (Open / Quit)
  6. Create BrowserWindow (frameless, transparent=false, alwaysOnTop, skipTaskbar, not resizable)
  7. Background color: `#14161e`
  8. Preload: `join(__dirname, 'preload.cjs')` (CJS!)
  9. Context isolation: true, nodeIntegration: false
  10. Set visible on all workspaces
  11. Load renderer HTML
  12. Blur handler with 500ms debounce (prevents instant hide)
  13. Start polling (sendData every 2000ms) after page loads

**IPC handlers:**
- `ipcMain.on('quit', shutdown)`
- `ipcMain.on('hide', panel.hide)`
- `app.on('second-instance', togglePanel)`

**Shutdown:**
- Clears poll interval
- Removes PID
- Destroys panel and tray
- Quits app

### 9.2 src/notch/preload.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  onUpdate: (cb: (d: any) => void) => ipcRenderer.on('update', (_e, d) => cb(d)),
  quit: () => ipcRenderer.send('quit'),
  hide: () => ipcRenderer.send('hide'),
});
```

Exposes 3 methods to renderer via `window.api`:
- `onUpdate(callback)`: listens for 'update' events from main process
- `quit()`: sends 'quit' to main process
- `hide()`: sends 'hide' to main process

### 9.3 src/notch/renderer/index.html

Full HTML/CSS/JS for the Crawfish Park panel. This file is copied as-is to `dist/notch/renderer/`.

**HTML structure:**
- `#panel` (flex column, 100% size, rounded corners 14px, bg #14161e)
  - `#head` (42px header, bg #0d0f15)
    - Close button (red circle, 12px)
    - Minimize button (yellow circle, 12px)
    - Title: "🦞 Crawfish Park"
    - Subtitle `#head-sub`
  - `#scene` (flex:1, relative, overflow hidden)
    - Sky gradient background (dark blue to green)
    - Stars (6 radial-gradient pseudo-elements)
    - Moon (top-right, yellow radial gradient with glow)
    - 3 trees (CSS-only, positioned absolutely)
    - Ground (bottom 50%, green gradient)
    - Pond (bottom-right, blue radial gradient with shimmer animation)
    - 3 grass strips (CSS blades with sway animation, 26 blades each)
    - `#area` (crawfish container)
    - `#empty` (shown when no agents: lobster emoji + Korean text "Claude Code 세션을 시작하면 가재가 나타납니다")
    - `#stats` bar (bottom overlay: Sessions, Active, Tokens counts)

**CSS animations:**
- `@keyframes sway` -- -4deg to 4deg rotation (3s, idle)
- `@keyframes bounce` -- Y translate + scale + rotation (0.8s, working)
- `@keyframes breathe` -- scale 1 to 1.04, opacity 0.7 to 0.88 (4s, sleeping)
- `@keyframes zzz` -- Y translate + opacity for sleep indicator (3s)
- `@keyframes shimmer` -- opacity 0.6 to 0.75 for pond (4s)

**Crawfish element styling by state:**
- `data-s="working"`: bounce animation
- `data-s="idle"`: sway animation
- `data-s="sleeping"`: breathe animation + `::after` content `'z Z'` with zzz animation

**Crawfish glow by level:**
- Level 1: gray glow (3px)
- Level 2: cyan glow (5px)
- Level 3: green glow (7px)
- Level 4: yellow/amber glow (9px)
- Level 5: red glow (12px)

**JavaScript:**

Constants:
```javascript
const LVL=['','baby','juvenile','adult','warrior','king'];
const LNAME=['','Baby','Juvenile','Adult','Warrior','King'];
const POS=[
  {left:'14%',bottom:'22%'},{left:'54%',bottom:'26%'},{left:'34%',bottom:'16%'},
  {left:'72%',bottom:'20%'},{left:'22%',bottom:'32%'},{left:'46%',bottom:'12%'},
  {left:'8%',bottom:'38%'},{left:'80%',bottom:'30%'},
];
```

8 predefined positions for crawfish placement on the scene.

**Grass generation:** 26 `<i>` elements per grass strip with random animation delay.

**Token formatting:** `fmt(n)` -- same as CLI (M/K/raw).

**Sprite key:** `sk(a)` -- `{level_name}_{state}` where working stays 'working', idle stays 'idle', else 'sleeping'.

**Render function:**
1. If no agents: clear area, show empty state
2. Sort agents: working first, then by level descending
3. Reuse existing DOM elements by sessionId
4. Position each crawfish at POS[i % POS.length]
5. Set data-s (state), data-l (level) attributes for CSS animations
6. Update sprite image, name, level text (with color class c1-c5), token count
7. Remove stale elements
8. Update stats bar: total sessions, active count, total raw tokens

**Event listeners:**
- Close button: `window.api.quit()`
- Minimize button: `window.api.hide()`
- Escape key: `window.api.hide()`
- `window.api.onUpdate`: receives `{ agents, sprites? }`, updates and re-renders

---

## 10. Hook Scripts (src/hooks/)

These are the SHIPPED hook scripts (in `src/hooks/`). The hook-installer service also generates similar scripts at runtime into `~/.crayfish-farm/hooks/`.

### 10.1 src/hooks/session-start.sh
```bash
#!/bin/bash
SOCK="$HOME/.crayfish-farm/crayfish-farm.sock"
if [ -S "$SOCK" ]; then
  echo '{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"session-start","ts":'$(date +%s)'}}' | nc -U -w1 "$SOCK" 2>/dev/null
else
  echo '{"event":"session-start","ts":'$(date +%s)'}' >> "$HOME/.crayfish-farm/events.jsonl"
fi
```

### 10.2 src/hooks/session-stop.sh
```bash
#!/bin/bash
SOCK="$HOME/.crayfish-farm/crayfish-farm.sock"
if [ -S "$SOCK" ]; then
  echo '{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"session-stop","ts":'$(date +%s)'}}' | nc -U -w1 "$SOCK" 2>/dev/null
else
  echo '{"event":"session-stop","ts":'$(date +%s)'}' >> "$HOME/.crayfish-farm/events.jsonl"
fi
```

### 10.3 src/hooks/notification.sh
```bash
#!/bin/bash
SOCK="$HOME/.crayfish-farm/crayfish-farm.sock"
if [ -S "$SOCK" ]; then
  echo '{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"notification","ts":'$(date +%s)'}}' | nc -U -w1 "$SOCK" 2>/dev/null
fi
```

All scripts:
- Check if Unix socket exists (`-S` test)
- If socket exists: send JSON-RPC 2.0 message via `nc -U -w1` (1 second timeout)
- If no socket (session-start/stop only): append JSON event to events.jsonl as fallback

---

## 11. Sprite Generation Pipeline

### 11.1 scripts/generate-sprites.py

Python 3 script requiring `Pillow` and `numpy`.

**Paths:**
- Input: `assets/crayfish/` (20 PNG files)
- Output: `src/tui/crawfish-art.ts`

**Constants:**
- `LEVELS = [(1, "baby"), (2, "juvenile"), (3, "adult"), (4, "warrior"), (5, "king")]`
- `STATES = ["idle", "working", "complete", "sleeping"]`
- `NUM_FRAMES = 4`
- Compact widths (chars): baby/juvenile=30, adult/warrior/king=40
- Hires widths (chars): baby/juvenile=80, adult/warrior/king=100
- `DENSITY_CHARS = ' .·:;+x%#@█'` (11 levels, space to full block)

**Pipeline Steps:**

**Step 1: Load and Normalize**
- `load_images()`: Opens all 20 PNGs as RGBA
- `normalize_per_level()`: For each level, finds max width/height across all 4 states, center-pads all to that size with transparent pixels

**Step 2: Generate Animation Frames**
4 frames per sprite, phase = `(frame_idx / 4) * 2π`

Animation algorithms (all operate on numpy pixel arrays):

- **`animate_idle(pixels, w, h, phase)`**: Antenna/claw sway. For each row y, compute weight = `max(0, 1 - y/h)` (top rows move more). Shift row by `sin(phase + y*0.15) * 2 * weight` pixels.

- **`animate_working(pixels, w, h, phase)`**: Bounce + wave. Vertical bounce = `sin(phase) * 2`. For each row: amplitude = `1.5 + sin(y*0.2) * 0.5`, horizontal shift = `sin(phase + y*0.25) * amp`. Source row offset by bounce.

- **`animate_complete(pixels, w, h, phase)`**: Pulse scale +/-4%. Scale = `1 + sin(phase) * 0.04`. Inverse-maps each output pixel through scale transform centered on image center.

- **`animate_sleeping(pixels, w, h, phase)`**: Breath effect +/-3%. Vertical breath = `1 + sin(phase) * 0.03`. Maps rows through breath transform from bottom. Adds subtle horizontal drift: `sin(phase*0.5 + y*0.05) * 1`.

Row shifting helper: `shift_row(pixels, w, h, y, dx)` -- Copies row, shifts by dx, fills with transparent.

**Step 3: Render COMPACT (halfblock)**
- `resize_for_compact(pixels, level_name, target_w)`: Resizes to target_w pixels wide, proportional height (ensured even)
- `render_compact(pixels)`: Each output character = 2 vertical pixels. Uses Unicode halfblock characters:
  - Both visible: fg=top color, bg=bottom color, char=`▀` (U+2580)
  - Top only: fg=top color, char=`▀`
  - Bottom only: fg=bottom color, char=`▄` (U+2584)
  - Neither: space
  - Alpha threshold: 128

**Step 4: Render HIRES (ASCII density)**
- `resize_for_hires(pixels, target_w)`: Resizes to target_w pixels wide, height compressed by 0.5 (terminal char ratio)
- `render_hires(pixels)`: For each pixel:
  - Alpha < 128: space
  - Else: compute luminance (`0.299*R + 0.587*G + 0.114*B`), map to DENSITY_CHARS index, apply truecolor fg

**Step 5: Generate TypeScript**
- `generate_typescript(compact_data, hires_data)`: Produces the full .ts file
- Uses `json.dumps()` for safe string escaping of ANSI escape sequences
- Exports: `COMPACT`, `HIRES` (Record<number, FrameMap>), `getCrawfishArt()`, `getCrawfishHires()`

### 11.2 Asset Download

The 20 PNG sprite files must be downloaded from S3 before running the pipeline:

```bash
mkdir -p assets/crayfish
STAGES=(baby juvenile adult warrior king)
STATES=(idle working complete sleeping)
for stage in "${STAGES[@]}"; do
  for state in "${STATES[@]}"; do
    curl -o "assets/crayfish/${stage}_${state}.png" \
      "https://ralphthon.s3.ap-northeast-2.amazonaws.com/crayfish/${stage}_${state}.png"
  done
done
```

---

## 12. Implementation Phases (for ralph execution)

### Phase 1: Scaffold

Create project structure and configuration files.

**Files to create:**
1. `package.json` -- exact content from Section 3.1
2. `tsconfig.json` -- exact content from Section 3.2
3. `tsup.config.ts` -- exact content from Section 3.3
4. `vitest.config.ts` -- exact content from Section 3.4

**Directories to create:**
- `src/core/`
- `src/services/`
- `src/cli/commands/`
- `src/daemon/`
- `src/tui/`
- `src/notch/renderer/`
- `src/hooks/`
- `scripts/`
- `assets/crayfish/`
- `tests/core/`
- `tests/services/`
- `tests/cli/`
- `tests/daemon/`
- `tests/tui/`
- `tests/fixtures/sessions/`
- `tests/fixtures/projects/-test-project/`

**Run:** `npm install`

### Phase 2: Core Types, Constants, Paths, Config, Logger

Create in this order (each file depends on previous):

1. `src/core/types.ts` -- All interfaces and types (Section 4.1). No imports from project.
2. `src/core/constants.ts` -- All constants (Section 4.2). Imports `AdaptiveParams`, `TimerPreset` from types.
3. `src/core/paths.ts` -- All path definitions and functions (Section 4.3). Imports from node:os, node:path, node:fs.
4. `src/core/config.ts` -- Config load/save (Section 4.4). Imports from types, paths.
5. `src/core/logger.ts` -- Logging functions (Section 4.5). Imports from paths, constants.

### Phase 3: Services

Create in dependency order:

1. `src/services/path-encoder.ts` -- Path encoding and project dir lookup (Section 5.1). Depends on: core/paths.
2. `src/services/claude-session-discovery.ts` -- Session discovery (Section 5.2). Depends on: core/types, core/paths, path-encoder.
3. `src/services/claude-session-parser.ts` -- JSONL parsing (Section 5.3). Depends on: core/types.
4. `src/services/agent-tracker.ts` -- Agent discovery with levels and decay (Section 5.4). Depends on: core/types, core/constants, claude-session-discovery, claude-session-parser.
5. `src/services/timer-engine.ts` -- Timer state management (Section 5.5). Depends on: core/types, core/constants, core/paths, core/config.
6. `src/services/notification.ts` -- Bell and system notifications (Section 5.11). Depends on: core/config. Uses node-notifier.
7. `src/services/stats-aggregator.ts` -- Daily stats tracking (Section 5.9). Depends on: core/types, core/paths.
8. `src/services/adaptive-engine.ts` -- Adaptive parameter calculation (Section 5.7). Depends on: core/constants, core/paths, core/logger, core/types.
9. `src/services/signal-emitter.ts` -- Signal emission with Fibonacci badges (Section 5.8). Depends on: core/constants, core/paths, notification, core/logger, core/types.
10. `src/services/dopamine-service.ts` -- Dopamine event handling and tick (Section 5.6). Depends on: core/paths, core/constants, core/logger, signal-emitter, adaptive-engine, notification, core/types.
11. `src/services/flow-protection.ts` -- Flow/DND mode (Section 5.12). Depends on: timer-engine, core/paths, core/types.
12. `src/services/hook-installer.ts` -- Hook installation in Claude settings (Section 5.10). Depends on: core/paths, core/constants.
13. `src/services/shell-integrator.ts` -- Shell integration snippet generation (Section 5.13). No project imports.
14. `src/services/data-purger.ts` -- Data cleanup (Section 5.14). Depends on: core/paths, core/constants.

### Phase 4: CLI

Create in this order:

1. `src/cli/ipc-client.ts` -- IPC client (Section 6.2). Depends on: core/paths, core/constants, core/types.
2. `src/cli/commands/status.ts` -- Status command (Section 6.3.12). Depends on: services/agent-tracker, core/constants.
3. `src/cli/commands/where.ts` -- Where command (Section 6.3.16). Depends on: services/agent-tracker.
4. `src/cli/commands/dash.ts` -- Dashboard command (Section 6.3.3). Depends on: tui/dashboard.
5. `src/cli/commands/timer.ts` -- Timer commands (Section 6.3.13). Depends on: services/timer-engine, core/constants.
6. `src/cli/commands/today.ts` -- Today command (Section 6.3.15). Depends on: services/stats-aggregator.
7. `src/cli/commands/flow.ts` -- Flow command (Section 6.3.5). Depends on: services/flow-protection.
8. `src/cli/commands/init.ts` -- Init command (Section 6.3.8). Depends on: core/paths, core/config, services/shell-integrator.
9. `src/cli/commands/doctor.ts` -- Doctor command (Section 6.3.4). Depends on: core/paths, cli/ipc-client, services/hook-installer.
10. `src/cli/commands/config-cmd.ts` -- Config command (Section 6.3.1). Depends on: core/config, core/types.
11. `src/cli/commands/daemon-cmd.ts` -- Daemon command (Section 6.3.2). Depends on: core/paths, cli/ipc-client.
12. `src/cli/commands/go.ts` -- Go command (Section 6.3.6). Depends on: services/agent-tracker.
13. `src/cli/commands/hooks.ts` -- Hooks commands (Section 6.3.7). Depends on: services/hook-installer.
14. `src/cli/commands/reset.ts` -- Reset command (Section 6.3.11). Depends on: core/paths.
15. `src/cli/commands/prompt-status.ts` -- Prompt status command (Section 6.3.10). Depends on: core/paths, core/types.
16. `src/cli/commands/tmux-status.ts` -- Tmux status command (Section 6.3.14). Depends on: core/paths, core/types.
17. `src/cli/commands/notch.ts` -- Mac menu bar command (Section 6.3.9). Depends on: (electron, node:module).
18. `src/cli/index.ts` -- Entry point (Section 6.1). Imports all 16 command register functions.

### Phase 5: Daemon

1. `src/daemon/ipc-server.ts` -- IPC server (Section 7.2). Depends on: core/paths, core/logger, core/types.
2. `src/daemon/file-watcher.ts` -- File watcher (Section 7.3). Depends on: chokidar, core/paths, core/logger, core/types.
3. `src/daemon/index.ts` -- Daemon main loop (Section 7.1). Depends on: core/paths, core/constants, core/config, core/logger, daemon/ipc-server, daemon/file-watcher, services/*.

### Phase 6: TUI

1. `src/tui/ansi.ts` -- ANSI escape sequences (Section 8.1). No project imports.
2. `src/tui/text-utils.ts` -- Unicode width and text manipulation (Section 8.2). No project imports.
3. `src/tui/token-viz.ts` -- Token visualization (Section 8.3). Depends on: chalk, core/constants, core/types.
4. `src/tui/card-renderer.ts` -- Card rendering (Section 8.4). Depends on: chalk, crawfish-art, token-viz, text-utils, ansi, core/constants, core/types.
5. `src/tui/grid-view.ts` -- Grid layout (Section 8.5). Depends on: chalk, card-renderer, ansi, core/types.
6. `src/tui/detail-view.ts` -- Detail view (Section 8.6). Depends on: chalk, crawfish-art, token-viz, ansi, core/constants, core/types.
7. `src/tui/dashboard.ts` -- Dashboard controller (Section 8.7). Depends on: readline, ansi, grid-view, detail-view, services/agent-tracker, services/timer-engine, services/stats-aggregator, core/constants, core/paths, core/types.

### Phase 7: Assets + Sprite Generation

1. Download 20 PNGs from S3 into `assets/crayfish/`:
```bash
mkdir -p assets/crayfish
STAGES=(baby juvenile adult warrior king)
STATES=(idle working complete sleeping)
for stage in "${STAGES[@]}"; do
  for state in "${STATES[@]}"; do
    curl -o "assets/crayfish/${stage}_${state}.png" \
      "https://ralphthon.s3.ap-northeast-2.amazonaws.com/crayfish/${stage}_${state}.png"
  done
done
```

2. Create `scripts/generate-sprites.py` (Section 11.1) -- Full Python script.

3. Run sprite generation:
```bash
pip3 install Pillow numpy
python3 scripts/generate-sprites.py
```
This creates `src/tui/crawfish-art.ts`.

### Phase 8: Hook Scripts + Mac menu bar widget

1. `src/hooks/session-start.sh` (Section 10.1)
2. `src/hooks/session-stop.sh` (Section 10.2)
3. `src/hooks/notification.sh` (Section 10.3)
4. `chmod +x src/hooks/*.sh`
5. `src/notch/preload.ts` (Section 9.2)
6. `src/notch/main.ts` (Section 9.1)
7. `src/notch/renderer/index.html` (Section 9.3) -- Full HTML/CSS/JS, copy exactly.

### Phase 9: Build & Verify

1. **Build:**
```bash
npm run build
```
This runs tsup (4 bundles) then copies renderer HTML.

2. **Verify build output:**
```bash
ls -la dist/cli/index.js       # CLI ESM bundle
ls -la dist/daemon/index.js    # Daemon ESM bundle
ls -la dist/notch/main.js      # Mac menu bar main ESM bundle
ls -la dist/notch/preload.cjs  # Mac menu bar preload CJS bundle
ls -la dist/notch/renderer/index.html  # Renderer HTML
```

3. **Type check:**
```bash
npm run typecheck
```

4. **Run tests:**
```bash
npm test
```

5. **Smoke test CLI:**
```bash
node dist/cli/index.js --version     # Should print 0.1.0
node dist/cli/index.js status        # Should show agents or "No active sessions"
node dist/cli/index.js doctor        # Should run diagnostics
node dist/cli/index.js init          # Should create ~/.crayfish-farm/
node dist/cli/index.js timer start   # Should start 25min timer
node dist/cli/index.js timer status  # Should show progress
node dist/cli/index.js today         # Should show focus stats
```

---

## Appendix A: Import Convention

All internal imports use `.js` extensions (NodeNext module resolution):
```typescript
import { foo } from './bar.js';
import { baz } from '../core/types.js';
```

## Appendix B: Error Handling Pattern

Throughout the codebase, errors are handled with:
- `try { ... } catch { ... }` (no error variable binding)
- Silent failures for non-critical operations (logging, caching, file reads)
- Explicit error messages for user-facing operations (CLI commands)
- Atomic file writes via tmp + rename pattern

## Appendix C: Atomic Write Pattern

Used consistently for all state files:
```typescript
const tmp = `${target}.tmp`;
writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
renameSync(tmp, target);
```

## Appendix D: Test Structure

Tests are in `tests/` mirroring `src/` structure:
- `tests/core/constants.test.ts`
- `tests/core/paths.test.ts`
- `tests/core/config.test.ts`
- `tests/services/adaptive-engine.test.ts`
- `tests/services/agent-tracker.test.ts`
- `tests/services/claude-session-parser.test.ts`
- `tests/services/dopamine-service.test.ts`
- `tests/services/hook-installer.test.ts`
- `tests/services/stats-aggregator.test.ts`
- `tests/services/timer-engine.test.ts`
- `tests/cli/ipc-client.test.ts`
- `tests/daemon/file-watcher.test.ts`
- `tests/daemon/ipc-server.test.ts`
- `tests/tui/card-renderer.test.ts`
- `tests/tui/grid-view.test.ts`
- `tests/tui/text-utils.test.ts`
- `tests/tui/token-viz.test.ts`

Test fixtures:
- `tests/fixtures/sessions/valid-session.json` -- Sample active session
- `tests/fixtures/sessions/non-interactive.json` -- Non-interactive session (filtered out)
- `tests/fixtures/projects/-test-project/test-session.jsonl` -- Sample JSONL data

## Appendix E: Key Algorithms Summary

1. **Token Decay**: `tokens * (1 - rate)^hours` where idle=0.02/hr, sleeping=0.05/hr
2. **Level Computation**: Thresholds [0, 1K, 10K, 50K, 200K] -> Levels 1-5
3. **State Determination**: <2min=working, <15min=idle, else=sleeping
4. **Path Encoding**: Replace `/` and `.` with `-`
5. **Fibonacci Badges**: Emit signal at exchange counts [3, 5, 8, 13, 21, 34, 55, 89]
6. **Quiet Mode**: Enter after 3 consecutive ignored signals
7. **Adaptive Rules**: Based on latest day's signals (ignore rate, productive ratio, timer completion, consecutive sessions)
8. **CJK Width**: Unicode range-based detection for 12 CJK/fullwidth ranges
9. **Halfblock Rendering**: 2 vertical pixels per character using `▀`/`▄` with truecolor ANSI
10. **ASCII Density**: Luminance-based char selection from ` .·:;+x%#@█`

