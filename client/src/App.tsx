import { useWebSocket } from './hooks/useWebSocket';
import { AgentTree } from './components/AgentTree';
import { TaskBoard } from './components/TaskBoard';
import { TokenMeter } from './components/TokenMeter';
import type { State } from 'shared';

const FIXTURE_STATE: State = {
  session: { id: 'fixture-session', project: '/test/project', startTime: new Date().toISOString() },
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
};

export default function App() {
  const isFixture = new URLSearchParams(window.location.search).has('fixture');
  const wsState = useWebSocket(isFixture ? null : 'ws://localhost:3001');
  const state = isFixture ? FIXTURE_STATE : wsState;

  const sessionLabel = state.session
    ? `Session: ${state.session.id} — ${state.session.project}`
    : 'No active session';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'monospace', backgroundColor: '#0d1117', color: '#e6edf3' }}>
      {/* Session header */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #30363d', backgroundColor: '#161b22', fontSize: '12px', color: '#8b949e' }}>
        {sessionLabel}
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Agent tree */}
        <div style={{ flex: '0 0 280px', borderRight: '1px solid #30363d', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Agents</h3>
          <AgentTree agents={state.agents} />
        </div>

        {/* Center: Tasks */}
        <div style={{ flex: 1, borderRight: '1px solid #30363d', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Tasks</h3>
          <TaskBoard tasks={state.tasks} />
        </div>

        {/* Right: Tokens */}
        <div style={{ flex: '0 0 320px', overflow: 'auto', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#58a6ff' }}>Tokens</h3>
          <TokenMeter tokens={state.tokens} agents={state.agents} />
        </div>
      </div>
    </div>
  );
}
