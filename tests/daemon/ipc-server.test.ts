import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';

// Mock logger to suppress output during tests
vi.mock('../../src/core/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import {
  startIpcServer,
  stopIpcServer,
  handleConnection,
} from '../../src/daemon/ipc-server.js';

function tempSocketPath(): string {
  return join(tmpdir(), `test-ipc-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

describe('ipc-server', () => {
  const socketPaths: string[] = [];

  afterEach(() => {
    for (const p of socketPaths) {
      if (existsSync(p)) {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    }
    socketPaths.length = 0;
  });

  describe('startIpcServer / stopIpcServer lifecycle', () => {
    it('starts a server that resolves to a net.Server', async () => {
      const socketPath = tempSocketPath();
      socketPaths.push(socketPath);

      const server = await startIpcServer({}, socketPath);
      expect(server).toBeDefined();
      expect(typeof server.close).toBe('function');

      await stopIpcServer(server, socketPath);
    });

    it('server is listening after startIpcServer resolves', async () => {
      const socketPath = tempSocketPath();
      socketPaths.push(socketPath);

      const server = await startIpcServer({}, socketPath);
      expect(server.listening).toBe(true);

      await stopIpcServer(server, socketPath);
    });

    it('server is no longer listening after stopIpcServer resolves', async () => {
      const socketPath = tempSocketPath();
      socketPaths.push(socketPath);

      const server = await startIpcServer({}, socketPath);
      await stopIpcServer(server, socketPath);

      expect(server.listening).toBe(false);
    });

    it('cleans up the socket file after stopIpcServer', async () => {
      const socketPath = tempSocketPath();
      socketPaths.push(socketPath);

      const server = await startIpcServer({}, socketPath);
      await stopIpcServer(server, socketPath);

      expect(existsSync(socketPath)).toBe(false);
    });

    it('removes a stale socket file before starting', async () => {
      const socketPath = tempSocketPath();
      socketPaths.push(socketPath);

      // Create stale socket via a first server then tear it down without cleanup
      const first = await startIpcServer({}, socketPath);
      // Force-close without unlinking so a stale file remains
      await new Promise<void>((resolve) => first.close(() => resolve()));

      // Second start should succeed even with the stale file present
      const server = await startIpcServer({}, socketPath);
      expect(server.listening).toBe(true);

      await stopIpcServer(server, socketPath);
    });
  });

  describe('handleConnection', () => {
    it('sends a method-not-found error for an unknown method', () => {
      const writes: string[] = [];
      const mockSocket = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'data') {
            setImmediate(() => {
              cb(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'unknown' }) + '\n'));
            });
          }
          return mockSocket;
        }),
        write: vi.fn((data: string) => { writes.push(data); }),
        destroyed: false,
      };

      handleConnection(mockSocket as never, {});

      return new Promise<void>((resolve) => {
        setImmediate(() => {
          expect(writes.length).toBeGreaterThan(0);
          const parsed = JSON.parse(writes[0]!.trim());
          expect(parsed.error).toBeDefined();
          expect(parsed.error.code).toBe(-32601);
          resolve();
        });
      });
    });

    it('calls the registered handler and sends back the result', () => {
      const writes: string[] = [];
      const mockSocket = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'data') {
            setImmediate(() => {
              cb(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n'));
            });
          }
          return mockSocket;
        }),
        write: vi.fn((data: string) => { writes.push(data); }),
        destroyed: false,
      };

      const pingHandler = vi.fn().mockResolvedValue({ pong: true });
      handleConnection(mockSocket as never, { ping: pingHandler });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(pingHandler).toHaveBeenCalledOnce();
          expect(writes.length).toBeGreaterThan(0);
          const parsed = JSON.parse(writes[0]!.trim());
          expect(parsed.result).toEqual({ pong: true });
          resolve();
        }, 50);
      });
    });

    it('sends a parse error for malformed JSON', () => {
      const writes: string[] = [];
      const mockSocket = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('not-valid-json\n')));
          }
          return mockSocket;
        }),
        write: vi.fn((data: string) => { writes.push(data); }),
        destroyed: false,
      };

      handleConnection(mockSocket as never, {});

      return new Promise<void>((resolve) => {
        setImmediate(() => {
          expect(writes.length).toBeGreaterThan(0);
          const parsed = JSON.parse(writes[0]!.trim());
          expect(parsed.error.code).toBe(-32700);
          resolve();
        });
      });
    });
  });
});
