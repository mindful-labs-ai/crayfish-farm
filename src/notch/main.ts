import { app, BrowserWindow, Tray, screen, ipcMain, nativeImage, Menu } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { discoverAgents } from '../services/agent-tracker.js';
import type { AgentInfo } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const PANEL_W = 480;
const PANEL_H = 520;
const BG = '#14161e';
const NOTCH_PID = join(process.env.HOME ?? '/tmp', '.crayfish-farm', 'notch.pid');

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// PID management
function writePid(): void {
  try {
    writeFileSync(NOTCH_PID, String(process.pid), 'utf8');
  } catch {
    // ignore
  }
}

function removePid(): void {
  try {
    if (existsSync(NOTCH_PID)) {
      unlinkSync(NOTCH_PID);
    }
  } catch {
    // ignore
  }
}

// Asset paths
function assetsDir(): string {
  return join(__dirname, '..', '..', 'assets', 'crayfish');
}

function rendererHtml(): string {
  const distPath = join(__dirname, 'renderer', 'index.html');
  if (existsSync(distPath)) return distPath;
  // fallback to source path
  return join(__dirname, '..', '..', 'src', 'notch', 'renderer', 'index.html');
}

// Sprite loading
const LEVEL_NAMES = ['', 'baby', 'juvenile', 'adult', 'warrior', 'king'];
const STATES = ['idle', 'working', 'complete', 'sleeping'];

function loadSprites(): Record<string, string> {
  const sprites: Record<string, string> = {};
  const dir = assetsDir();
  for (let level = 1; level <= 5; level++) {
    const levelName = LEVEL_NAMES[level];
    for (const state of STATES) {
      const key = `${levelName}_${state}`;
      const filePath = join(dir, `${levelName}_${state}.png`);
      if (existsSync(filePath)) {
        try {
          const data = readFileSync(filePath);
          sprites[key] = `data:image/png;base64,${data.toString('base64')}`;
        } catch {
          // skip missing sprites
        }
      }
    }
  }
  return sprites;
}

// Fit image into a square by preserving aspect ratio (pad with transparent pixels)
const TRAY_SIZE = 22;

function fitToSquare(img: Electron.NativeImage): Electron.NativeImage {
  const size = img.getSize();
  if (size.width === 0 || size.height === 0) return img;

  const max = Math.max(size.width, size.height);
  // Scale down to TRAY_SIZE, preserving aspect ratio
  const scale = TRAY_SIZE / max;
  const newW = Math.round(size.width * scale);
  const newH = Math.round(size.height * scale);
  const resized = img.resize({ width: newW, height: newH });

  // Create a transparent TRAY_SIZE x TRAY_SIZE canvas
  const canvas = Buffer.alloc(TRAY_SIZE * TRAY_SIZE * 4, 0); // RGBA all zeros = transparent
  const srcBuf = resized.toBitmap();
  const srcSize = resized.getSize();

  // Center the resized image on the canvas
  const offX = Math.floor((TRAY_SIZE - srcSize.width) / 2);
  const offY = Math.floor((TRAY_SIZE - srcSize.height) / 2);

  for (let y = 0; y < srcSize.height; y++) {
    for (let x = 0; x < srcSize.width; x++) {
      const srcIdx = (y * srcSize.width + x) * 4;
      const dstIdx = ((y + offY) * TRAY_SIZE + (x + offX)) * 4;
      if (dstIdx >= 0 && dstIdx + 3 < canvas.length) {
        canvas[dstIdx] = srcBuf[srcIdx]!;
        canvas[dstIdx + 1] = srcBuf[srcIdx + 1]!;
        canvas[dstIdx + 2] = srcBuf[srcIdx + 2]!;
        canvas[dstIdx + 3] = srcBuf[srcIdx + 3]!;
      }
    }
  }

  return nativeImage.createFromBitmap(canvas, { width: TRAY_SIZE, height: TRAY_SIZE });
}

// Default tray icon (fallback)
function defaultTrayIcon(): Electron.NativeImage {
  const dir = assetsDir();
  const fallback = join(dir, 'baby_idle.png');
  if (existsSync(fallback)) {
    try {
      return fitToSquare(nativeImage.createFromPath(fallback));
    } catch {
      // fall through
    }
  }
  return nativeImage.createEmpty();
}

// Tray icon — preload all frames for animation
const TRAY_STATES = ['idle', 'working', 'sleeping'] as const;
let trayIconCache: Map<string, Electron.NativeImage> = new Map();

function preloadTrayIcons(): void {
  const dir = assetsDir();
  for (let level = 1; level <= 5; level++) {
    const name = LEVEL_NAMES[level] || 'baby';
    for (const state of TRAY_STATES) {
      const key = `${name}_${state}`;
      const filePath = join(dir, `${key}.png`);
      if (existsSync(filePath)) {
        try {
          trayIconCache.set(key, fitToSquare(nativeImage.createFromPath(filePath)));
        } catch { /* skip */ }
      }
    }
  }
}

function getTrayIcon(levelName: string, state: string): Electron.NativeImage {
  return trayIconCache.get(`${levelName}_${state}`) ?? defaultTrayIcon();
}

// Animated tray icon state
let trayAnimFrame = 0;
let trayAnimInterval: ReturnType<typeof setInterval> | null = null;
let lastTrayAgents: AgentInfo[] = [];

// Animation: cycle between idle/working frames for the top agent
function startTrayAnimation(): void {
  if (trayAnimInterval) return;
  trayAnimInterval = setInterval(() => {
    if (!tray || lastTrayAgents.length === 0) return;
    trayAnimFrame++;

    const top = lastTrayAgents.reduce((best, a) => (a.level > best.level ? a : best), lastTrayAgents[0]);
    const levelName = LEVEL_NAMES[top.level] || 'baby';
    const hasWorking = lastTrayAgents.some(a => a.state === 'working');

    if (hasWorking) {
      // Bounce between working and idle frames
      const state = trayAnimFrame % 2 === 0 ? 'working' : 'idle';
      tray.setImage(getTrayIcon(levelName, state));
    } else {
      // Gentle: alternate idle/sleeping
      const state = trayAnimFrame % 4 === 0 ? 'sleeping' : 'idle';
      tray.setImage(getTrayIcon(levelName, state));
    }
  }, 600);
}

function stopTrayAnimation(): void {
  if (trayAnimInterval) {
    clearInterval(trayAnimInterval);
    trayAnimInterval = null;
  }
}

// App state
let tray: Tray | null = null;
let panel: BrowserWindow | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let spritesSent = false;
let loadedSprites: Record<string, string> = {};
let lastShowAt = 0;

// Panel positioning and toggle
function togglePanel(): void {
  if (!panel || !tray) return;

  if (panel.isVisible()) {
    panel.hide();
    return;
  }

  const trayBounds = tray.getBounds();
  const workArea = screen.getPrimaryDisplay().workArea;

  const x = Math.round(
    Math.min(
      Math.max(trayBounds.x + trayBounds.width / 2 - PANEL_W / 2, workArea.x),
      workArea.x + workArea.width - PANEL_W
    )
  );
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  panel.setPosition(x, y);
  panel.show();
  panel.focus();
  lastShowAt = Date.now();
}

// Filter agents for the widget: most recently active 10
const MAX_AGENTS = 8;

function filterAgentsForWidget(agents: AgentInfo[]): AgentInfo[] {
  return [...agents]
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, MAX_AGENTS);
}

// Data sending
function sendData(): void {
  if (!panel) return;

  let agents: AgentInfo[];
  try {
    agents = filterAgentsForWidget(discoverAgents());
  } catch {
    agents = [];
  }

  // Feed animation with latest agents
  lastTrayAgents = agents;
  if (tray) {
    const active = agents.filter((a) => a.state === 'working').length;
    tray.setToolTip(`Crayfish Farm — ${agents.length} sessions, ${active} active`);
  }

  if (!spritesSent) {
    panel.webContents.send('update', { agents, sprites: loadedSprites });
    spritesSent = true;
  } else {
    panel.webContents.send('update', { agents });
  }
}

// Shutdown
function shutdown(): void {
  stopTrayAnimation();
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  removePid();
  if (panel) {
    panel.destroy();
    panel = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
  app.quit();
}

// App lifecycle
app.dock?.hide();

app.on('ready', () => {
  writePid();

  // Load sprites
  loadedSprites = loadSprites();
  preloadTrayIcons();

  // Create tray with a visible default icon
  tray = new Tray(defaultTrayIcon());
  tray.setToolTip('Crayfish Farm');

  // Start tray animation
  startTrayAnimation();

  // Tray left-click
  tray.on('click', () => {
    togglePanel();
  });

  // Tray right-click context menu
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Open', click: togglePanel },
      { type: 'separator' },
      { label: 'Quit', click: shutdown },
    ]);
    tray!.popUpContextMenu(menu);
  });

  // Create BrowserWindow
  panel = new BrowserWindow({
    width: PANEL_W,
    height: PANEL_H,
    show: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: BG,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Visible on all workspaces
  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Load renderer HTML
  panel.loadFile(rendererHtml());

  // Blur handler with 500ms debounce
  panel.on('blur', () => {
    if (Date.now() - lastShowAt > 500) {
      panel?.hide();
    }
  });

  // Start polling after page loads
  panel.webContents.on('did-finish-load', () => {
    sendData();
    pollInterval = setInterval(sendData, 2000);
  });
});

// IPC handlers
ipcMain.on('quit', () => shutdown());
ipcMain.on('hide', () => panel?.hide());

// Second instance: toggle panel
app.on('second-instance', () => {
  togglePanel();
});

// Clean up on exit
app.on('before-quit', () => {
  removePid();
});
