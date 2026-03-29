import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:net before importing the module under test
const mockSocket = {
  on: vi.fn(),
  write: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('node:net', () => ({
  default: {
    createConnection: vi.fn(() => mockSocket),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { sendRequest, isDaemonRunning } from '../../src/cli/ipc-client.js';

describe('ipc-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockImplementation(() => mockSocket);
    mockSocket.write.mockImplementation(() => true);
    mockSocket.destroy.mockImplementation(() => {});
    vi.mocked(net.createConnection).mockReturnValue(mockSocket as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sendRequest', () => {
    it('rejects when socket emits an error (missing socket / ENOENT)', async () => {
      mockSocket.on.mockImplementation((event: string, cb: (arg: Error) => void) => {
        if (event === 'error') {
          setImmediate(() => cb(new Error('ENOENT: no such file or directory')));
        }
        return mockSocket;
      });

      await expect(sendRequest('ping', {}, '/nonexistent/path.sock')).rejects.toThrow('ENOENT');
    });

    it('rejects when connection closes before a response arrives', async () => {
      mockSocket.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'close') {
          setImmediate(() => cb());
        }
        return mockSocket;
      });

      await expect(sendRequest('ping', {}, '/some/path.sock')).rejects.toThrow(
        'Connection closed before response',
      );
    });

    it('resolves with result when a matching JSON-RPC response is received', async () => {
      let capturedRequestId: number | undefined;

      mockSocket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'connect') {
          setImmediate(() => {
            (cb as () => void)();
          });
        }
        return mockSocket;
      });

      mockSocket.write.mockImplementation((data: string) => {
        const req = JSON.parse(data.trim());
        capturedRequestId = req.id as number;

        // Find the data handler and call it
        const dataCall = mockSocket.on.mock.calls.find(([e]) => e === 'data');
        if (dataCall) {
          const dataCb = dataCall[1] as (buf: Buffer) => void;
          const response = JSON.stringify({ jsonrpc: '2.0', id: capturedRequestId, result: { ok: true } }) + '\n';
          setImmediate(() => dataCb(Buffer.from(response)));
        }
        return true;
      });

      const result = await sendRequest('status', {}, '/some/path.sock');
      expect(result).toEqual({ ok: true });
    });

    it('rejects with error message when response contains an error field', async () => {
      mockSocket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (event === 'connect') {
          setImmediate(() => (cb as () => void)());
        }
        return mockSocket;
      });

      mockSocket.write.mockImplementation((data: string) => {
        const req = JSON.parse(data.trim());
        const dataCall = mockSocket.on.mock.calls.find(([e]) => e === 'data');
        if (dataCall) {
          const dataCb = dataCall[1] as (buf: Buffer) => void;
          const response = JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32601, message: 'Method not found' },
          }) + '\n';
          setImmediate(() => dataCb(Buffer.from(response)));
        }
        return true;
      });

      await expect(sendRequest('unknown', {}, '/some/path.sock')).rejects.toThrow('Method not found');
    });
  });

  describe('isDaemonRunning', () => {
    it('returns false when PID file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await isDaemonRunning('/some/path.sock');
      expect(result).toBe(false);
    });

    it('returns false when PID file contains an invalid (NaN) PID', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('notanumber');

      const result = await isDaemonRunning('/some/path.sock');
      expect(result).toBe(false);
    });

    it('returns false when process.kill throws (process not running)', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('99999');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const result = await isDaemonRunning('/some/path.sock');
      expect(result).toBe(false);
      killSpy.mockRestore();
    });

    it('returns false when socket connection fails even with valid PID', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(String(process.pid));
      vi.spyOn(process, 'kill').mockImplementation(() => true);

      mockSocket.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'error') {
          setImmediate(() => cb());
        }
        return mockSocket;
      });

      const result = await isDaemonRunning('/nonexistent/path.sock');
      expect(result).toBe(false);
    });
  });
});
