# 🦞 crayfish-farm

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-41%2B-47848F?logo=electron&logoColor=white)](https://www.electronjs.org)
[![Tests](https://img.shields.io/badge/Tests-232%20passing-brightgreen)](./tests)

**Focus tool for developers running multiple Claude Code sessions.**

_Your agents are crawfish. Watch them grow._

[Quick Start](#quick-start) • [Commands](#cli-commands) • [Widget](#-mac-menu-bar-widget) • [Architecture](#architecture) • [Development](#development)

---

<h2 align="center">모든 Claude Code 세션이 가재가 됩니다.</h2>

<p align="center">
  <em>Monitor sessions as virtual crawfish that level up from Baby → King based on token usage.<br>
  Focus with timers. Get nudged with dopamine. Never get shamed.</em>
</p>

---

## Why crayfish-farm?

- **Zero config** — Discovers Claude Code sessions automatically via filesystem watching
- **Gamified focus** — Token usage drives crawfish levels (Baby → Juvenile → Adult → Warrior → King)
- **Beautiful TUI** — Animated ASCII crawfish sprites in a terminal dashboard
- **Mac menu bar widget** — Electron-powered "Crayfish Farm" with animated farm scene
- **Ethical dopamine** — Fibonacci momentum badges, adaptive engine — never shames, never tracks streaks
- **Timer presets** — Pomodoro (25/5), DeskTime (52/17), Ultradian (90/20)
- **Shell integration** — zsh RPROMPT, bash PS1, tmux status bar

---

## Quick Start

**Step 1: Install**

```bash
git clone https://github.com/mindful-labs-ai/crayfish-farm.git
cd crayfish-farm
npm install
```

**Step 2: Generate sprites & build**

```bash
# Sprite generation (requires Python 3 + Pillow + numpy)
pip3 install Pillow numpy
npm run generate:sprites

# Build (4 bundles via tsup)
npm run build

# Link globally
npm link
```

**Step 3: Start using**

```bash
crayfish-farm init           # Initialize ~/.crayfish-farm/
crayfish-farm doctor         # Check environment
crayfish-farm status         # See all Claude sessions
crayfish-farm dash           # Open TUI dashboard
crayfish-farm notch start    # Launch Mac menu bar widget
```

That's it. Sessions are discovered automatically.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `status` | Show all discovered agents with state, level, and token count |
| `where` | Show working agents and their last exchange context |
| `dash` | Open interactive TUI dashboard with animated crawfish sprites |
| `go <name>` | Output `cd` command for a session directory (eval in shell) |
| `today` | Show today's focus time and completed sessions |
| `timer start [min]` | Start focus timer (default: 25 min) |
| `timer stop` | Stop running timer |
| `timer status` | Show timer progress bar |
| `timer preset <name>` | Apply preset: `pomodoro` \| `desktime` \| `ultradian` |
| `flow on\|off` | Toggle flow mode (distraction-free) |
| `notch start\|stop\|status` | Manage Mac menu bar widget |
| `daemon start\|stop\|status` | Manage background daemon |
| `config [key] [value]` | View/set config (dot-path: `timer.defaultMinutes`) |
| `init [--full]` | Initialize config; `--full` prints shell integration snippets |
| `doctor` | Run 7 environment checks |
| `install-hooks` | Add hooks to `~/.claude/settings.json` |
| `uninstall-hooks` | Remove hooks |
| `prompt-status` | Output status string for PS1/RPROMPT |
| `tmux-status` | Output tmux status-right with color codes |
| `reset [--force]` | Wipe all data and configuration |

---

## 🖥 TUI Dashboard

```bash
crayfish-farm dash
```

| Key | Action |
|-----|--------|
| `q` | Quit |
| `r` | Refresh |
| `t` | Toggle timer (start 25min / stop) |
| `1`–`9` | Detail view for agent N |
| `b` / `Esc` | Back to grid |

Features:
- Animated crawfish ASCII art per session (halfblock rendering from PNG sprites)
- 2-column card layout with level bars and activity summaries
- Token delta tracking and level-up flash effects
- Korean UI text (`어디까지 했더라?`, `휴식 중...`, `대기 중...`)

---

## 🦞 Mac Menu Bar Widget

```bash
crayfish-farm notch start
```

An Electron-powered tray widget themed as a farm:

- **Sky** with clouds drifting and sun
- **Red barn** with silo, **wooden fences**, **pond** with shimmer
- **Crawfish** positioned on green pasture — animated per state:
  - 🔨 Working → bounce animation
  - 🌾 Idle → gentle sway
  - 💤 Sleeping → breathe + zZZ
- **Click** any crawfish → info card with sprite, state, level, session summary
- **`d` key** → all crawfish dance for 3 seconds
- **Animated tray icon** — cycles frames based on top agent's state
- **Stats bar**: 🦞 crayfish count · 🌾 active · 🪣 total feed

---

## Crawfish Levels

Token usage drives level progression. Tokens decay over time when sessions are idle or sleeping.

| Level | Name | Threshold | Color |
|-------|------|-----------|-------|
| 1 | Baby | 0 | Gray |
| 2 | Juvenile | 1,000 | Cyan |
| 3 | Adult | 10,000 | Green |
| 4 | Warrior | 50,000 | Yellow |
| 5 | King | 200,000 | Red |

**Token decay:** Idle = 2%/hr, Sleeping = 5%/hr. Working = no decay.

---

## Dopamine System

### Ethical Boundaries (hardcoded)

| ✅ Does | ❌ Never |
|---------|----------|
| Motivate through visible progress | Show streak counts |
| Adapt to your workflow | Compare today vs yesterday |
| Celebrate milestones | Track "minutes wasted" |
| Respect quiet mode | Punish via signal absence |

### Signals

- **Momentum Pulse** — Badge emitted at Fibonacci exchange counts: 3, 5, 8, 13, 21, 34, 55, 89
- **Return Bridge** — Prompt reminder of which project you were working on
- **Timer Complete** — Bell + system notification
- **Adaptive Engine** — Adjusts signal frequency based on your behavior over a 7-day baseline

---

## Architecture

```
src/
├── core/                # Types, constants, paths, config, logger
├── services/            # 14 service modules
│   ├── agent-tracker    # Session discovery & level computation
│   ├── timer-engine     # Focus timer with presets
│   ├── dopamine-service # Event handling & tick loop
│   ├── adaptive-engine  # Behavioral adaptation (7-day baseline)
│   ├── signal-emitter   # Fibonacci badges & quiet mode
│   └── ...              # hooks, notifications, stats, flow, shell
├── cli/                 # Commander.js entry + 16 command files
├── daemon/              # IPC server (Unix socket) + file watcher + tick
├── tui/                 # ANSI dashboard, CJK text utils, token viz
│   └── crawfish-art.ts  # Auto-generated sprite data (DO NOT EDIT)
├── notch/               # Electron menu bar widget
│   ├── main.ts          # Tray + BrowserWindow + agent polling
│   ├── preload.ts       # contextBridge (CJS for sandbox)
│   └── renderer/        # Self-contained HTML/CSS/JS farm scene
├── hooks/               # Shell scripts for Claude Code integration
scripts/
└── generate-sprites.py  # PNG → halfblock + ASCII density TypeScript
```

**Build pipeline** (4 tsup bundles):

| Bundle | Format | Entry | Notes |
|--------|--------|-------|-------|
| CLI | ESM | `src/cli/index.ts` | `clean: true` |
| Daemon | ESM | `src/daemon/index.ts` | |
| Notch main | ESM | `src/notch/main.ts` | `electron` external |
| Notch preload | CJS | `src/notch/preload.ts` | Electron sandbox requires CJS |

---

## Development

### Scripts

```bash
npm run dev              # Run CLI via tsx
npm run dev:daemon       # Run daemon via tsx
npm test                 # 232 tests across 17 files (vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run typecheck        # tsc --noEmit (strict)
npm run build            # tsup (4 bundles) + copy renderer
npm run generate:sprites # Python sprite pipeline
```

### Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| TypeScript | 5.7+ | Strict mode, ES2022, NodeNext |
| Python 3 | 3.x | Sprite generation |
| Pillow | latest | PNG processing |
| numpy | latest | Pixel manipulation |
| Electron | 41.1+ | Menu bar widget |

### Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript 5.7+ (strict, ESM) |
| Build | tsup 8.3+ |
| CLI | commander 13.0+ |
| Terminal | chalk 5.3+ |
| File watch | chokidar 4.0+ |
| Desktop | Electron 41.1+ |
| Notifications | node-notifier 10.0+ |
| Testing | vitest 2.1+ / @vitest/coverage-v8 |

---

## Configuration

Stored in `~/.crayfish-farm/config.json`. View/set with `crayfish-farm config`.

```bash
crayfish-farm config                          # Print all
crayfish-farm config timer.defaultMinutes     # Get value
crayfish-farm config timer.defaultMinutes 30  # Set value
```

| Key | Default | Description |
|-----|---------|-------------|
| `timer.defaultMinutes` | 25 | Default timer duration |
| `timer.preset` | pomodoro | Active preset |
| `notification.sound` | true | Enable sound |
| `notification.systemNotification` | true | OS notification |
| `dopamine.signalLevel` | on | `on` \| `subtle` \| `off` |
| `data.retentionDays` | 30 | Stats retention |
| `daemon.autoStart` | false | Auto-start daemon |

---

## License

MIT
