import * as fs from 'fs';
import { EventEmitter } from 'events';
import { State, SessionState, Agent, Task, TokenCounts } from 'shared';
import { ParsedEvent } from './jsonl-parser';

export interface StateManager {
  onSessionAdded(sessionId: string, projectDir: string): void;
  onEvents(sessionId: string, agentId: string | null, events: ParsedEvent[]): void;
  onTaskFile(sessionId: string, filePath: string): void;
  getState(): State;
  on(event: 'change', listener: (state: State) => void): this;
  off(event: 'change', listener: (state: State) => void): this;
}

function emptyTokenCounts(): TokenCounts {
  return { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 };
}

function formatToolInput(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const i = input as Record<string, unknown>;
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':  return typeof i.file_path === 'string' ? i.file_path : null;
    case 'Glob':  return typeof i.pattern === 'string' ? i.pattern : null;
    case 'Grep':  return typeof i.pattern === 'string' ? i.pattern : null;
    case 'Bash':  return typeof i.description === 'string' ? i.description
                       : typeof i.command === 'string' ? i.command.slice(0, 60) : null;
    default: {
      const val = Object.values(i).find(v => typeof v === 'string');
      return typeof val === 'string' ? val.slice(0, 60) : null;
    }
  }
}

function makeMainAgent(): Agent {
  return {
    id: 'main',
    type: 'main',
    status: 'running',
    parentId: null,
    currentTool: null,
    currentToolInput: null,
    description: null,
    tokens: emptyTokenCounts(),
  };
}

function makeSessionState(sessionId: string, projectDir: string): SessionState {
  return {
    session: {
      id: sessionId,
      project: projectDir,
      startTime: new Date().toISOString(),
    },
    agents: [makeMainAgent()],
    tasks: [],
    tokens: emptyTokenCounts(),
  };
}

function findAgentIn(sess: SessionState, agentId: string | null): Agent | undefined {
  const id = agentId ?? 'main';
  return sess.agents.find((a) => a.id === id);
}

function replaceAgentIn(sess: SessionState, updated: Agent): SessionState {
  return { ...sess, agents: sess.agents.map((a) => (a.id === updated.id ? updated : a)) };
}

export function createStateManager(): StateManager {
  const emitter = new EventEmitter();
  const sessions = new Map<string, SessionState>();

  function getState(): State {
    return { sessions: Object.fromEntries(sessions) };
  }

  function emitChange(): void {
    emitter.emit('change', getState());
  }

  const manager: StateManager = {
    onSessionAdded(sessionId: string, projectDir: string): void {
      if (sessions.has(sessionId)) return;
      sessions.set(sessionId, makeSessionState(sessionId, projectDir));
      emitChange();
    },

    onEvents(sessionId: string, agentId: string | null, events: ParsedEvent[]): void {
      if (events.length === 0) return;

      let sess = sessions.get(sessionId);
      if (!sess) return;

      let changed = false;

      for (const event of events) {
        switch (event.kind) {
          case 'agent_launched': {
            if (sess.agents.some((a) => a.id === event.agentId)) break;

            let agentType = 'agent';
            let agentDescription: string | null = null;
            if (
              event.input &&
              typeof event.input === 'object' &&
              !Array.isArray(event.input)
            ) {
              const input = event.input as Record<string, unknown>;
              if (typeof input.subagent_type === 'string') {
                agentType = input.subagent_type;
              }
              if (typeof input.description === 'string') {
                agentDescription = input.description;
              } else if (typeof input.prompt === 'string') {
                const firstLine = input.prompt.split('\n')[0].trim();
                agentDescription = firstLine.length > 80
                  ? firstLine.slice(0, 77) + '...'
                  : firstLine || null;
              }
            }

            const newAgent: Agent = {
              id: event.agentId,
              type: agentType,
              status: 'running',
              parentId: event.parentId ?? agentId,
              currentTool: null,
              currentToolInput: null,
              description: agentDescription,
              tokens: emptyTokenCounts(),
            };
            sess = { ...sess, agents: [...sess.agents, newAgent] };
            changed = true;
            break;
          }

          case 'token_usage': {
            const agent = findAgentIn(sess, event.agentId ?? agentId);
            if (agent) {
              sess = replaceAgentIn(sess, {
                ...agent,
                tokens: {
                  input: agent.tokens.input + event.input,
                  output: agent.tokens.output + event.output,
                  cacheRead: agent.tokens.cacheRead + event.cacheRead,
                  cacheCreated: agent.tokens.cacheCreated + event.cacheCreated,
                },
              });
            }
            sess = {
              ...sess,
              tokens: {
                input: sess.tokens.input + event.input,
                output: sess.tokens.output + event.output,
                cacheRead: sess.tokens.cacheRead + event.cacheRead,
                cacheCreated: sess.tokens.cacheCreated + event.cacheCreated,
              },
            };
            changed = true;
            break;
          }

          case 'agent_completed': {
            const agent = findAgentIn(sess, event.agentId ?? agentId);
            if (agent) {
              sess = replaceAgentIn(sess, { ...agent, status: 'completed', currentTool: null, currentToolInput: null });
              changed = true;
            }
            break;
          }

          case 'tool_use': {
            const agent = findAgentIn(sess, event.agentId ?? agentId);
            if (agent) {
              sess = replaceAgentIn(sess, {
                ...agent,
                currentTool: event.toolName,
                currentToolInput: formatToolInput(event.toolName, event.toolInput),
              });
              changed = true;
            }
            break;
          }
        }
      }

      if (changed) {
        sessions.set(sessionId, sess);
        emitChange();
      }
    },

    onTaskFile(sessionId: string, filePath: string): void {
      const sess = sessions.get(sessionId);
      if (!sess) return;

      let raw: string;
      try {
        raw = fs.readFileSync(filePath, 'utf8');
      } catch {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return;
      }

      const obj = parsed as Record<string, unknown>;
      const task: Task = {
        id: typeof obj.id === 'string' ? obj.id : '',
        subject: typeof obj.subject === 'string' ? obj.subject : '',
        status: (['pending', 'in_progress', 'completed'] as const).includes(obj.status as Task['status'])
          ? (obj.status as Task['status'])
          : 'pending',
        activeForm: typeof obj.activeForm === 'string' ? obj.activeForm : null,
      };

      const existingIndex = sess.tasks.findIndex((t) => t.id === task.id);
      const newTasks = existingIndex >= 0
        ? [...sess.tasks.slice(0, existingIndex), task, ...sess.tasks.slice(existingIndex + 1)]
        : [...sess.tasks, task];

      sessions.set(sessionId, { ...sess, tasks: newTasks });
      emitChange();
    },

    getState(): State {
      return getState();
    },

    on(event: 'change', listener: (state: State) => void): StateManager {
      emitter.on(event, listener);
      return manager;
    },

    off(event: 'change', listener: (state: State) => void): StateManager {
      emitter.off(event, listener);
      return manager;
    },
  };

  return manager;
}
