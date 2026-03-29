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

export interface PromptState {
  pulse: string;
  badge: number | null;
  timer: string | null;
  timeOfDay: string;
  returnTo: string | null;
  warmth: string;
  updated: number;
}

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

export interface DayStats {
  focusMinutes: number;
  completedSessions: number;
  date: string;
}

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

export interface DaemonStatus {
  running: boolean;
  pid: number;
  uptime: number;
  sessions: number;
}

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

export type SignalType = 'prompt' | 'bell' | 'notification' | 'tmux' | 'title';

export interface Signal {
  type: SignalType;
  data: Record<string, unknown>;
  force?: boolean;
}

export interface RawSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint?: string;
}

export interface ParsedSession {
  totalTokens: number;
  lastExchange: string;
  lastAssistantTimestamp: number;
  lineCount: number;
}

export type FileEventType = 'session-discovered' | 'session-removed' | 'activity-detected';

export interface FileEvent {
  type: FileEventType;
  sessionId?: string;
  path: string;
  timestamp: number;
}

export interface BaselineData {
  startedAt: number;
  lastRecalcAt: number;
  days: DaySignals[];
}

export interface DopamineState {
  timeOfDay: string;
  warmth: string;
  quietMode: boolean;
  adaptiveParams: AdaptiveParams;
}
