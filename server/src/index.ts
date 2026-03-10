import { createSessionWatcher } from './session-watcher';
import { createFileReader } from './jsonl-parser';
import { createStateManager } from './state-manager';
import { createWsServer } from './ws-server';
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

watcher.on('session-changed', (session) => {
  stateManager.onSessionChanged(session.sessionId, session.projectDir);
});

watcher.on('session-file-changed', (filePath: string) => {
  const events = reader.readNewLines(filePath);
  stateManager.onEvents(null, events);
});

watcher.on('subagent-file-changed', (filePath: string, sessionId: string) => {
  const events = reader.readNewLines(filePath);
  // extract agentId from filename: agent-<id>.jsonl
  const filename = path.basename(filePath, '.jsonl');
  const agentId = filename.startsWith('agent-') ? filename.slice('agent-'.length) : null;
  stateManager.onEvents(agentId, events);
});

// Watch task files for the active session
watcher.on('session-changed', (session) => {
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks', session.sessionId);
  // chokidar already watches the session dir, but tasks are in a different location
  // We need to also watch ~/.claude/tasks/<sessionId>/ for task JSON files
  // For simplicity, poll this directory on a short interval
  watchTasksDir(tasksDir);
});

let tasksDirInterval: NodeJS.Timeout | null = null;
let currentTasksDir: string | null = null;

function watchTasksDir(dir: string): void {
  if (tasksDirInterval) clearInterval(tasksDirInterval);
  currentTasksDir = dir;
  tasksDirInterval = setInterval(() => {
    try {
      const files = require('fs').readdirSync(dir);
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
