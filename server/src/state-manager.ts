import * as fs from 'fs';
import { EventEmitter } from 'events';
import { State, Agent, Task, TokenCounts } from 'shared';
import { ParsedEvent } from './jsonl-parser';

export interface StateManager {
  onSessionChanged(sessionId: string, projectDir: string): void;
  onEvents(agentId: string | null, events: ParsedEvent[]): void;
  onTaskFile(filePath: string): void;
  getState(): State;
  on(event: 'change', listener: (state: State) => void): this;
  off(event: 'change', listener: (state: State) => void): this;
}

function emptyTokenCounts(): TokenCounts {
  return { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 };
}

function makeMainAgent(): Agent {
  return {
    id: 'main',
    type: 'main',
    status: 'running',
    parentId: null,
    currentTool: null,
    tokens: emptyTokenCounts(),
  };
}

export function createStateManager(): StateManager {
  const emitter = new EventEmitter();

  let state: State = {
    session: null,
    agents: [],
    tasks: [],
    tokens: emptyTokenCounts(),
  };

  function emitChange(): void {
    emitter.emit('change', state);
  }

  function findAgent(agentId: string | null): Agent | undefined {
    const id = agentId ?? 'main';
    return state.agents.find((a) => a.id === id);
  }

  function replaceAgent(updated: Agent): void {
    state.agents = state.agents.map((a) => (a.id === updated.id ? updated : a));
  }

  const manager: StateManager = {
    onSessionChanged(sessionId: string, projectDir: string): void {
      state = {
        session: {
          id: sessionId,
          project: projectDir,
          startTime: new Date().toISOString(),
        },
        agents: [makeMainAgent()],
        tasks: [],
        tokens: emptyTokenCounts(),
      };
      emitChange();
    },

    onEvents(agentId: string | null, events: ParsedEvent[]): void {
      if (events.length === 0) return;

      let changed = false;

      for (const event of events) {
        switch (event.kind) {
          case 'agent_launched': {
            // Skip duplicate agent IDs
            if (state.agents.some((a) => a.id === event.agentId)) break;

            // Infer type from input.subagent_type if available
            let agentType = 'agent';
            if (
              event.input &&
              typeof event.input === 'object' &&
              !Array.isArray(event.input)
            ) {
              const input = event.input as Record<string, unknown>;
              if (typeof input.subagent_type === 'string') {
                agentType = input.subagent_type;
              }
            }

            const newAgent: Agent = {
              id: event.agentId,
              type: agentType,
              status: 'running',
              parentId: event.parentId ?? agentId,
              currentTool: null,
              tokens: emptyTokenCounts(),
            };
            state.agents = [...state.agents, newAgent];
            changed = true;
            break;
          }

          case 'token_usage': {
            const agent = findAgent(event.agentId ?? agentId);
            if (agent) {
              replaceAgent({
                ...agent,
                tokens: {
                  input: agent.tokens.input + event.input,
                  output: agent.tokens.output + event.output,
                  cacheRead: agent.tokens.cacheRead + event.cacheRead,
                  cacheCreated: agent.tokens.cacheCreated + event.cacheCreated,
                },
              });
            }
            state.tokens = {
              input: state.tokens.input + event.input,
              output: state.tokens.output + event.output,
              cacheRead: state.tokens.cacheRead + event.cacheRead,
              cacheCreated: state.tokens.cacheCreated + event.cacheCreated,
            };
            changed = true;
            break;
          }

          case 'agent_completed': {
            const agent = findAgent(event.agentId ?? agentId);
            if (agent) {
              replaceAgent({ ...agent, status: 'completed', currentTool: null });
              changed = true;
            }
            break;
          }

          case 'tool_use': {
            const agent = findAgent(event.agentId ?? agentId);
            if (agent) {
              replaceAgent({ ...agent, currentTool: event.toolName });
              changed = true;
            }
            break;
          }
        }
      }

      if (changed) {
        emitChange();
      }
    },

    onTaskFile(filePath: string): void {
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

      const existingIndex = state.tasks.findIndex((t) => t.id === task.id);
      if (existingIndex >= 0) {
        state.tasks = [
          ...state.tasks.slice(0, existingIndex),
          task,
          ...state.tasks.slice(existingIndex + 1),
        ];
      } else {
        state.tasks = [...state.tasks, task];
      }

      emitChange();
    },

    getState(): State {
      return state;
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
