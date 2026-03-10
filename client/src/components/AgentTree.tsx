import { Agent } from 'shared';
import { fmtK } from '../utils';

interface Props {
  agents: Agent[];
}

function formatTokens(counts: Agent['tokens']): string {
  return fmtK(counts.input + counts.output);
}

function AgentNode({
  agent,
  agents,
  depth,
}: {
  agent: Agent;
  agents: Agent[];
  depth: number;
}) {
  const children = agents.filter((a) => a.parentId === agent.id);

  const isRunning = agent.status === 'running';
  const statusSymbol = isRunning ? '●' : '✓';
  const statusColor = isRunning ? '#3fb950' : '#8b949e';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: `${depth * 16}px`,
          paddingTop: '2px',
          paddingBottom: '2px',
          lineHeight: '1.5',
        }}
      >
        <span style={{ color: statusColor, flexShrink: 0 }}>{statusSymbol}</span>
        <span style={{ color: '#e6edf3' }}>{agent.type}</span>
        {agent.currentTool && (
          <span style={{ color: '#8b949e' }}>[{agent.currentTool}]</span>
        )}
        <span style={{ color: '#8b949e' }}>{formatTokens(agent.tokens)}</span>
      </div>
      {children.map((child) => (
        <AgentNode key={child.id} agent={child} agents={agents} depth={depth + 1} />
      ))}
    </div>
  );
}

export function AgentTree({ agents }: Props) {
  const roots = agents.filter((a) => a.parentId === null);

  if (roots.length === 0) {
    return <div style={{ color: '#8b949e' }}>No agents</div>;
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
      {roots.map((root) => (
        <AgentNode key={root.id} agent={root} agents={agents} depth={0} />
      ))}
    </div>
  );
}
