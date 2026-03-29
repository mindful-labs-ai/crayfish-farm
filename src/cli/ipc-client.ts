import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { SOCKET_PATH, PID_FILE } from '../core/paths.js';
import { IPC_TIMEOUT_MS } from '../core/constants.js';
import type { IpcRequest, IpcResponse } from '../core/types.js';

let requestIdCounter = 1;

export function sendRequest(
  method: string,
  params?: Record<string, unknown>,
  socketPath: string = SOCKET_PATH,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let buffer = '';
    let settled = false;

    const id = requestIdCounter++;
    const request: IpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error(`IPC timeout after ${IPC_TIMEOUT_MS}ms`));
      }
    }, IPC_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write(JSON.stringify(request) + '\n');
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response: IpcResponse = JSON.parse(line);
          if (response.id === id) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.destroy();
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
            }
          }
        } catch {
          // ignore parse errors on partial lines
        }
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    socket.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Connection closed before response'));
      }
    });
  });
}

export async function isDaemonRunning(socketPath: string = SOCKET_PATH): Promise<boolean> {
  // Check 1: PID file exists
  if (!existsSync(PID_FILE)) {
    return false;
  }

  // Check 2: PID is alive
  try {
    const pidStr = readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) return false;
    process.kill(pid, 0);
  } catch {
    return false;
  }

  // Check 3: Socket is connectable
  return new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    }, 1000);

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
}
