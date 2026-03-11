import { useWebSocket } from './hooks/useWebSocket';
import { AgentTree } from './components/AgentTree';
import { TaskBoard } from './components/TaskBoard';
import { TokenMeter } from './components/TokenMeter';
import type { State, SessionState } from 'shared';

const FIXTURE_STATE: State = {
  sessions: {
    'fixture-session-1': {
      session: { id: 'fixture-session-1', project: '/test/project-alpha', startTime: new Date().toISOString() },
      agents: [
        { id: 'main', type: 'main', status: 'running', parentId: null,
          currentTool: 'Bash', currentToolInput: 'List files in src/', description: null,
          tokens: { input: 5200, output: 800, cacheRead: 1000, cacheCreated: 200 } },
        { id: 'agent-1', type: 'Explore', status: 'running', parentId: 'main',
          currentTool: 'Glob', currentToolInput: 'src/**/*.tsx', description: 'Explore codebases',
          tokens: { input: 1200, output: 300, cacheRead: 0, cacheCreated: 0 } },
        { id: 'agent-2', type: 'Plan', status: 'completed', parentId: 'main',
          currentTool: null, currentToolInput: null, description: 'Design implementation plan',
          tokens: { input: 3000, output: 600, cacheRead: 500, cacheCreated: 100 } },
        { id: 'agent-1-1', type: 'agent', status: 'running', parentId: 'agent-1',
          currentTool: 'Read', currentToolInput: 'client/src/App.tsx', description: null,
          tokens: { input: 400, output: 50, cacheRead: 0, cacheCreated: 0 } },
      ],
      tasks: [],
      tokens: { input: 9800, output: 1750, cacheRead: 1500, cacheCreated: 300 },
    },
    'fixture-session-2': {
      session: { id: 'fixture-session-2', project: '/test/project-beta', startTime: new Date().toISOString() },
      agents: [
        { id: 'main', type: 'main', status: 'running', parentId: null,
          currentTool: 'Write', currentToolInput: 'server/src/index.ts', description: null,
          tokens: { input: 2100, output: 400, cacheRead: 600, cacheCreated: 80 } },
        { id: 'agent-3', type: 'general-purpose', status: 'running', parentId: 'main',
          currentTool: 'Grep', currentToolInput: 'createStateManager', description: 'Explore state manager',
          tokens: { input: 800, output: 120, cacheRead: 0, cacheCreated: 0 } },
      ],
      tasks: [
        { id: 'task-1', subject: 'Add multi-session support', status: 'in_progress', activeForm: null },
      ],
      tokens: { input: 2900, output: 520, cacheRead: 600, cacheCreated: 80 },
    },
  },
};

function SessionPanel({ sessionState }: { sessionState: SessionState }) {
  const { session, agents, tasks, tokens } = sessionState;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderBottom: '1px solid #30363d', flexShrink: 0 }}>
      {/* Session header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #30363d', backgroundColor: '#161b22', fontSize: '12px', color: '#8b949e' }}>
        Session: {session.id} — {session.project}
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Agent tree */}
        <div style={{ flex: '0 0 280px', borderRight: '1px solid #30363d', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Agents</h3>
          <AgentTree agents={agents} />
        </div>

        {/* Center: Tasks */}
        <div style={{ flex: 1, borderRight: '1px solid #30363d', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Tasks</h3>
          <TaskBoard tasks={tasks} />
        </div>

        {/* Right: Tokens */}
        <div style={{ flex: '0 0 320px', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Tokens</h3>
          <TokenMeter tokens={tokens} agents={agents} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const isFixture = new URLSearchParams(window.location.search).has('fixture');
  const wsState = useWebSocket(isFixture ? null : 'ws://localhost:3001');
  const state = isFixture ? FIXTURE_STATE : wsState;

  const sessionEntries = Object.entries(state.sessions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'monospace', backgroundColor: '#0d1117', color: '#e6edf3' }}>
      {sessionEntries.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#8b949e', fontSize: '14px' }}>
          No active sessions
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {sessionEntries.map(([id, sessionState]) => (
            <SessionPanel key={id} sessionState={sessionState} />
          ))}
        </div>
      )}
    </div>
  );
}
