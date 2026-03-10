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

let previousSessionFilePath: string | null = null;

watcher.on('session-changed', (session) => {
  if (previousSessionFilePath) reader.reset(previousSessionFilePath);
  previousSessionFilePath = session.filePath;
  stateManager.onSessionChanged(session.sessionId, session.projectDir);
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', session.sessionId);
  watchTasksDir(tasksDir);
});

watcher.on('session-file-changed', (filePath: string) => {
  const events = reader.readNewLines(filePath);
  stateManager.onEvents(null, events);
});

watcher.on('subagent-file-changed', (filePath: string, _sessionId: string) => {
  const events = reader.readNewLines(filePath);
  // extract agentId from filename: agent-<id>.jsonl
  const filename = path.basename(filePath, '.jsonl');
  const agentId = filename.startsWith('agent-') ? filename.slice('agent-'.length) : null;
  stateManager.onEvents(agentId, events);
});

let tasksDirInterval: NodeJS.Timeout | null = null;

function watchTasksDir(dir: string): void {
  if (tasksDirInterval) clearInterval(tasksDirInterval);
  tasksDirInterval = setInterval(() => {
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          stateManager.onTaskFile(path.join(dir, f));
        }
      }
    } catch {
      // dir may not exist yet
    }
  }, 1000);
}

watcher.start();
console.log(`Server started. WebSocket on ws://localhost:${WS_PORT}`);
