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
  prefix,
  isLast,
}: {
  agent: Agent;
  agents: Agent[];
  depth: number;
  prefix: string;
  isLast: boolean;
}) {
  const children = agents.filter((a) => a.parentId === agent.id);

  const isRunning = agent.status === 'running';
  const statusSymbol = isRunning ? '●' : '✓';
  const statusColor = isRunning ? '#3fb950' : '#8b949e';

  const connector = depth === 0 ? '' : isLast ? '└─ ' : '├─ ';
  const childPrefix = depth === 0 ? '' : prefix + (isLast ? '   ' : '│  ');

  const toolLabel = agent.currentTool
    ? agent.currentToolInput
      ? `[${agent.currentTool}: ${agent.currentToolInput}]`
      : `[${agent.currentTool}]`
    : null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '2px',
          paddingBottom: '2px',
          lineHeight: '1.5',
        }}
      >
        {depth > 0 && (
          <span style={{ color: '#484f58', whiteSpace: 'pre' }}>{prefix}{connector}</span>
        )}
        <span style={{ color: statusColor, flexShrink: 0 }}>{statusSymbol}</span>
        <span style={{ color: '#e6edf3' }}>{agent.type}</span>
        {toolLabel && (
          <span style={{ color: '#8b949e' }}>{toolLabel}</span>
        )}
        <span style={{ color: '#8b949e' }}>{formatTokens(agent.tokens)}</span>
      </div>
      {agent.description && (
        <div
          style={{
            paddingTop: '0',
            paddingBottom: '2px',
            lineHeight: '1.5',
            color: '#8b949e',
            paddingLeft: depth === 0 ? '20px' : undefined,
          }}
        >
          {depth > 0 && (
            <span style={{ whiteSpace: 'pre', color: '#484f58' }}>{childPrefix}</span>
          )}
          <span style={{ fontStyle: 'italic' }}>{agent.description}</span>
        </div>
      )}
      {children.map((child, i) => (
        <AgentNode
          key={child.id}
          agent={child}
          agents={agents}
          depth={depth + 1}
          prefix={childPrefix}
          isLast={i === children.length - 1}
        />
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
        <AgentNode key={root.id} agent={root} agents={agents} depth={0} prefix="" isLast={true} />
      ))}
    </div>
  );
}
