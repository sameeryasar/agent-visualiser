import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import chokidar, { FSWatcher } from 'chokidar';

export interface SessionInfo {
  sessionId: string;    // basename without .jsonl extension
  projectDir: string;   // e.g. '-Users-foo-Projects-my-project'
  filePath: string;     // absolute path to the main session JSONL
}

export interface SessionWatcher extends EventEmitter {
  start(): void;
  stop(): void;
}

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/**
 * Parse a file path and determine if it is a main session JSONL file.
 * A main session file is at exactly depth 2 from PROJECTS_DIR:
 *   <PROJECTS_DIR>/<projectDir>/<sessionId>.jsonl
 *
 * Returns SessionInfo if it matches, null otherwise.
 */
export function parseMainSessionPath(filePath: string): SessionInfo | null {
  if (!filePath.endsWith('.jsonl')) return null;

  const relative = path.relative(PROJECTS_DIR, filePath);
  // relative must be exactly: <projectDir>/<sessionId>.jsonl  (no extra slashes)
  const parts = relative.split(path.sep);
  if (parts.length !== 2) return null;

  const [projectDir, filename] = parts;
  // Ensure neither segment contains traversal artifacts
  if (projectDir === '' || projectDir === '..' || filename === '') return null;

  const sessionId = filename.slice(0, -'.jsonl'.length);
  return { sessionId, projectDir, filePath };
}

/**
 * Parse a file path and determine if it is a subagent JSONL file.
 * Pattern: <PROJECTS_DIR>/<projectDir>/<sessionId>/subagents/<anything>.jsonl
 *
 * Returns { sessionId } if it matches, null otherwise.
 */
export function parseSubagentPath(filePath: string): { sessionId: string } | null {
  if (!filePath.endsWith('.jsonl')) return null;

  const relative = path.relative(PROJECTS_DIR, filePath);
  const parts = relative.split(path.sep);
  // Must be: <projectDir> / <sessionId> / subagents / <file>.jsonl  → 4 parts
  if (parts.length !== 4) return null;
  if (parts[2] !== 'subagents') return null;

  const sessionId = parts[1];
  return { sessionId };
}

function isRecentlyModified(filePath: string): boolean {
  try {
    return Date.now() - fs.statSync(filePath).mtimeMs < 2 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function createSessionWatcher(): SessionWatcher {
  const emitter = new EventEmitter();

  let watcher: FSWatcher | null = null;
  let isReady = false;
  const seenSessions = new Set<string>();

  function handleFile(filePath: string): void {
    const mainInfo = parseMainSessionPath(filePath);
    if (mainInfo) {
      const { sessionId } = mainInfo;
      if (!seenSessions.has(sessionId) && (isReady || isRecentlyModified(filePath))) {
        seenSessions.add(sessionId);
        emitter.emit('session-added', mainInfo);
      }
      emitter.emit('session-file-changed', filePath, sessionId);
      return;
    }

    const subagentInfo = parseSubagentPath(filePath);
    if (subagentInfo) {
      emitter.emit('subagent-file-changed', filePath, subagentInfo.sessionId);
    }
  }

  const sw = emitter as SessionWatcher;

  sw.start = function (): void {
    if (watcher) return;

    watcher = chokidar.watch(PROJECTS_DIR, {
      persistent: true,
      ignoreInitial: false,
      depth: 4, // project/session/subagents/file.jsonl = 4 levels below root
    });

    watcher.on('add', handleFile);
    watcher.on('change', handleFile);
    watcher.on('ready', () => { isReady = true; });
    watcher.on('error', (err) => console.error('[session-watcher] chokidar error:', err));
  };

  sw.stop = function (): void {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  };

  return sw;
}
