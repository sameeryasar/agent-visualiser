import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

export interface SessionInfo {
  sessionId: string;    // basename without .jsonl extension
  projectDir: string;   // e.g. '-Users-foo-Projects-my-project'
  filePath: string;     // absolute path to the main session JSONL
}

export interface SessionWatcher extends EventEmitter {
  start(): void;
  stop(): void;
  getActiveSession(): SessionInfo | null;
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

export function createSessionWatcher(): SessionWatcher {
  const emitter = new EventEmitter() as SessionWatcher;

  let watcher: FSWatcher | null = null;
  // Map from filePath → last-modified time (ms)
  const fileMtimes = new Map<string, number>();
  let activeSession: SessionInfo | null = null;

  function getMtime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  function updateActiveSession(candidate: SessionInfo): void {
    const candidateMtime = getMtime(candidate.filePath);
    fileMtimes.set(candidate.filePath, candidateMtime);

    const currentMtime = activeSession ? (fileMtimes.get(activeSession.filePath) ?? 0) : -1;

    if (candidateMtime >= currentMtime) {
      const previousId = activeSession?.sessionId;
      activeSession = candidate;
      if (previousId !== candidate.sessionId) {
        emitter.emit('session-changed', candidate);
      }
    }
  }

  function handleFile(filePath: string): void {
    const mainInfo = parseMainSessionPath(filePath);
    if (mainInfo) {
      updateActiveSession(mainInfo);
      // Only emit session-file-changed when this IS the active session
      if (activeSession?.filePath === filePath) {
        emitter.emit('session-file-changed', filePath);
      }
      return;
    }

    const subagentInfo = parseSubagentPath(filePath);
    if (subagentInfo) {
      emitter.emit('subagent-file-changed', filePath, subagentInfo.sessionId);
    }
  }

  emitter.start = function (): void {
    if (watcher) return;

    watcher = chokidar.watch(PROJECTS_DIR, {
      persistent: true,
      ignoreInitial: false,
      depth: 3, // enough for subagent paths: project/session/subagents/file.jsonl
    });

    watcher.on('add', handleFile);
    watcher.on('change', handleFile);
  };

  emitter.stop = function (): void {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  };

  emitter.getActiveSession = function (): SessionInfo | null {
    return activeSession;
  };

  return emitter;
}
