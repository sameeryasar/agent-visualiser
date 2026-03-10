import { WebSocketServer, WebSocket } from 'ws';
import { State } from 'shared';

export interface WsServer {
  start(port: number): void;
  stop(): void;
  broadcast(state: State): void;
}

export function createWsServer(): WsServer {
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();
  let lastState: State | null = null;

  const server: WsServer = {
    start(port: number): void {
      wss = new WebSocketServer({ port });

      wss.on('connection', (ws: WebSocket) => {
        clients.add(ws);

        // Send current state immediately if available
        if (lastState !== null) {
          ws.send(JSON.stringify(lastState));
        }

        ws.on('close', () => {
          clients.delete(ws);
        });

        ws.on('error', (err) => {
          console.error('[ws-server] client error:', err.message);
          clients.delete(ws);
        });
      });
    },

    stop(): void {
      if (wss) {
        wss.close();
        wss = null;
      }
      clients.clear();
    },

    broadcast(state: State): void {
      lastState = state;
      const payload = JSON.stringify(state);
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        } else {
          clients.delete(ws);
        }
      }
    },
  };

  return server;
}
