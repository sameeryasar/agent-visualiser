import { useState, useEffect, useRef } from 'react';
import { State } from 'shared';

const EMPTY_STATE: State = {
  session: null,
  agents: [],
  tasks: [],
  tokens: { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 },
};

export function useWebSocket(url: string): State {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data as string) as State;
          setState(parsed);
        } catch (err) {
          console.error('[useWebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (!unmountedRef.current) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error('[useWebSocket] WebSocket error:', err);
        // onclose will fire after onerror and handle reconnect
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url]);

  return state;
}
