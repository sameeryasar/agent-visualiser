import { createSessionWatcher } from './session-watcher';
import { createFileReader } from './jsonl-parser';
import { createStateManager } from './state-manager';
import { createWsServer } from './ws-server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const WS_PORT = 3001;

const watcher = createSessionWatcher();
const reader = createFileReader();
const stateManager = createStateManager();
const wsServer = createWsServer();

wsServer.start(WS_PORT);

stateManager.on('change', (state) => {
  wsServer.broadcast(state);
});

const taskIntervals = new Map<string, NodeJS.Timeout>();

watcher.on('session-added', (session) => {
  stateManager.onSessionAdded(session.sessionId, session.projectDir);
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', session.sessionId);
  watchTasksDir(session.sessionId, tasksDir);
});

watcher.on('session-file-changed', (filePath: string, sessionId: string) => {
  const events = reader.readNewLines(filePath);
  stateManager.onEvents(sessionId, null, events);
});

watcher.on('subagent-file-changed', (filePath: string, sessionId: string) => {
  const events = reader.readNewLines(filePath);
  // extract agentId from filename: agent-<id>.jsonl
  const filename = path.basename(filePath, '.jsonl');
  const agentId = filename.startsWith('agent-') ? filename.slice('agent-'.length) : null;
  stateManager.onEvents(sessionId, agentId, events);
});

function watchTasksDir(sessionId: string, dir: string): void {
  if (taskIntervals.has(sessionId)) return;
  const interval = setInterval(() => {
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          stateManager.onTaskFile(sessionId, path.join(dir, f));
        }
      }
    } catch {
      // dir may not exist yet
    }
  }, 1000);
  taskIntervals.set(sessionId, interval);
}

watcher.start();
console.log(`Server started. WebSocket on ws://localhost:${WS_PORT}`);
