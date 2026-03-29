import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentInfo, DopamineEvent } from '../../src/core/types.js';

// Mock signal-emitter before importing dopamine-service
vi.mock('../../src/services/signal-emitter.js', () => ({
  onActivityDetected: vi.fn(() => null),
  onTimerComplete: vi.fn(),
  onSessionIdle: vi.fn(),
  writePromptState: vi.fn(),
}));

// Mock notification before importing dopamine-service
vi.mock('../../src/services/notification.js', () => ({
  notifyTimerComplete: vi.fn(),
  sendBell: vi.fn(),
  sendSystemNotification: vi.fn(),
}));

// Mock adaptive-engine to avoid FS writes
vi.mock('../../src/services/adaptive-engine.js', () => ({
  getAdaptiveParams: vi.fn(() => ({
    signalFrequencyMultiplier: 1.0,
    signalIntensityLevel: 2,
    quietModeThreshold: 3,
    contextDetailLevel: 'normal',
    supportiveSilenceMode: false,
    hyperfocusAlert: false,
  })),
}));

const { handleEvent, tick, getDopamineState } = await import(
  '../../src/services/dopamine-service.js'
);
const { onActivityDetected, onTimerComplete, onSessionIdle, writePromptState } = await import(
  '../../src/services/signal-emitter.js'
);
const { notifyTimerComplete } = await import('../../src/services/notification.js');

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1,
    sessionId: 'test-session',
    cwd: '/test/project',
    projectName: 'project',
    startedAt: Date.now(),
    state: 'working',
    tokenUsage: 1000,
    rawTokenUsage: 1000,
    level: 1,
    lastExchange: '',
    lastActivityAt: Date.now(),
    jsonlPath: null,
    ...overrides,
  };
}

describe('handleEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onActivityDetected for activity-detected event', () => {
    const event: DopamineEvent = { type: 'activity-detected', timestamp: Date.now() };
    handleEvent(event);
    expect(onActivityDetected).toHaveBeenCalledOnce();
  });

  it('calls onSessionIdle for session-stop event with projectName', () => {
    const event: DopamineEvent = {
      type: 'session-stop',
      projectName: 'my-project',
      timestamp: Date.now(),
    };
    handleEvent(event);
    expect(onSessionIdle).toHaveBeenCalledWith('my-project');
  });

  it('does not call onSessionIdle for session-stop without projectName', () => {
    const event: DopamineEvent = { type: 'session-stop', timestamp: Date.now() };
    handleEvent(event);
    expect(onSessionIdle).not.toHaveBeenCalled();
  });

  it('calls onTimerComplete and notifyTimerComplete for timer-complete event', () => {
    const event: DopamineEvent = { type: 'timer-complete', timestamp: Date.now() };
    handleEvent(event);
    expect(onTimerComplete).toHaveBeenCalledOnce();
    expect(notifyTimerComplete).toHaveBeenCalledWith(0);
  });

  it('calls writePromptState for level-up event', () => {
    const event: DopamineEvent = { type: 'level-up', timestamp: Date.now() };
    handleEvent(event);
    expect(writePromptState).toHaveBeenCalledWith({ pulse: 'flash' });
  });

  it('does nothing for session-start event', () => {
    const event: DopamineEvent = { type: 'session-start', timestamp: Date.now() };
    handleEvent(event);
    expect(onActivityDetected).not.toHaveBeenCalled();
    expect(onTimerComplete).not.toHaveBeenCalled();
  });

  it('does nothing for timer-start event', () => {
    const event: DopamineEvent = { type: 'timer-start', timestamp: Date.now() };
    handleEvent(event);
    expect(onTimerComplete).not.toHaveBeenCalled();
  });
});

describe('tick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls writePromptState with timeOfDay and warmth', () => {
    const agents = [makeAgent({ state: 'working' })];
    tick(agents);
    expect(writePromptState).toHaveBeenCalledWith(
      expect.objectContaining({
        timeOfDay: expect.any(String),
        warmth: expect.any(String),
      })
    );
  });

  it('computes warmth=cool for no working agents', () => {
    tick([makeAgent({ state: 'idle' }), makeAgent({ state: 'sleeping' })]);
    expect(writePromptState).toHaveBeenCalledWith(
      expect.objectContaining({ warmth: 'cool' })
    );
  });

  it('computes warmth=warm for exactly one working agent', () => {
    tick([makeAgent({ state: 'working' })]);
    expect(writePromptState).toHaveBeenCalledWith(
      expect.objectContaining({ warmth: 'warm' })
    );
  });

  it('computes warmth=hot for two working agents', () => {
    tick([makeAgent({ state: 'working' }), makeAgent({ state: 'working' })]);
    expect(writePromptState).toHaveBeenCalledWith(
      expect.objectContaining({ warmth: 'hot' })
    );
  });
});

describe('getDopamineState', () => {
  it('returns a valid DopamineState shape', () => {
    const state = getDopamineState();
    expect(state).toHaveProperty('timeOfDay');
    expect(state).toHaveProperty('warmth');
    expect(state).toHaveProperty('quietMode');
    expect(state).toHaveProperty('adaptiveParams');
  });

  it('has boolean quietMode', () => {
    const state = getDopamineState();
    expect(typeof state.quietMode).toBe('boolean');
  });

  it('has adaptiveParams with expected fields', () => {
    const state = getDopamineState();
    expect(state.adaptiveParams).toHaveProperty('signalFrequencyMultiplier');
    expect(state.adaptiveParams).toHaveProperty('signalIntensityLevel');
    expect(state.adaptiveParams).toHaveProperty('contextDetailLevel');
  });
});
