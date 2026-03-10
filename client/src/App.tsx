import { useWebSocket } from './hooks/useWebSocket';
import { AgentTree } from './components/AgentTree';
import { TaskBoard } from './components/TaskBoard';
import { TokenMeter } from './components/TokenMeter';

export default function App() {
  const state = useWebSocket('ws://localhost:3001');

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
