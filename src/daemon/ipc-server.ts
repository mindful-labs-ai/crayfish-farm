import net from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { SOCKET_PATH } from '../core/paths.js';
import { logError, logInfo } from '../core/logger.js';
import type { IpcRequest, IpcResponse } from '../core/types.js';

export type MethodHandler = (params?: Record<string, unknown>) => Promise<unknown>;
export type MethodHandlers = Record<string, MethodHandler>;

const connectedSockets = new Set<net.Socket>();

function buildResponse(id: number, result?: unknown, error?: { code: number; message: string; data?: unknown }): IpcResponse {
  if (error !== undefined) {
    return { jsonrpc: '2.0', id, error };
  }
  return { jsonrpc: '2.0', id, result };
}

export function handleConnection(socket: net.Socket, handlers: MethodHandlers): void {
  connectedSockets.add(socket);

  socket.on('close', () => {
    connectedSockets.delete(socket);
  });

  let buffer = '';

  socket.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (!line) continue;

      let req: IpcRequest;
      try {
        req = JSON.parse(line) as IpcRequest;
      } catch {
        const errResp = buildResponse(0, undefined, { code: -32700, message: 'Parse error' });
        socket.write(JSON.stringify(errResp) + '\n');
        continue;
      }

      const handler = handlers[req.method];
      if (!handler) {
        const errResp = buildResponse(req.id, undefined, { code: -32601, message: `Method not found: ${req.method}` });
        socket.write(JSON.stringify(errResp) + '\n');
        continue;
      }

      handler(req.params)
        .then((result) => {
          const resp = buildResponse(req.id, result);
          socket.write(JSON.stringify(resp) + '\n');
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          const errResp = buildResponse(req.id, undefined, { code: -32603, message: `Internal error: ${message}` });
          socket.write(JSON.stringify(errResp) + '\n');
          logError('IPC handler error', { method: req.method, error: message });
        });
    }
  });

  socket.on('error', (err) => {
    logError('Socket error', { error: err.message });
    connectedSockets.delete(socket);
  });
}

export function startIpcServer(handlers: MethodHandlers, socketPath?: string): Promise<net.Server> {
  const path = socketPath ?? SOCKET_PATH;

  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore stale cleanup errors
    }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      handleConnection(socket, handlers);
    });

    server.on('error', (err) => {
      logError('IPC server error', { error: err.message });
      reject(err);
    });

    server.listen(path, () => {
      logInfo('IPC server started', { path });
      resolve(server);
    });
  });
}

export function stopIpcServer(server: net.Server, socketPath?: string): Promise<void> {
  const path = socketPath ?? SOCKET_PATH;

  for (const socket of connectedSockets) {
    socket.destroy();
  }
  connectedSockets.clear();

  return new Promise((resolve) => {
    server.close(() => {
      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch {
          // ignore
        }
      }
      logInfo('IPC server stopped');
      resolve();
    });
  });
}

export function broadcastToSubscribers(server: net.Server, data: unknown): void {
  const payload = JSON.stringify(data) + '\n';
  for (const socket of connectedSockets) {
    if (!socket.destroyed) {
      socket.write(payload);
    }
  }
}
