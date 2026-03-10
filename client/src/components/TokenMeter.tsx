import { Agent, TokenCounts } from 'shared';

function fmtK(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

const styles = {
  container: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#e6edf3',
    padding: '8px 0',
  } as React.CSSProperties,
  sectionHeader: {
    color: '#8b949e',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  } as React.CSSProperties,
  divider: {
    borderBottom: '1px solid #30363d',
    marginBottom: '6px',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2px',
  } as React.CSSProperties,
  label: {
    color: '#8b949e',
  } as React.CSSProperties,
  value: {
    color: '#e6edf3',
    fontFamily: 'monospace',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  agentRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '2px',
    alignItems: 'baseline',
  } as React.CSSProperties,
  agentLabel: {
    color: '#8b949e',
    minWidth: '80px',
  } as React.CSSProperties,
  agentTokens: {
    color: '#e6edf3',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  section: {
    marginBottom: '12px',
  } as React.CSSProperties,
};

export function TokenMeter({ tokens, agents }: { tokens: TokenCounts; agents: Agent[] }) {
  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.sectionHeader}>Total</div>
        <div style={styles.divider} />
        <div style={styles.row}>
          <span style={styles.label}>Input:</span>
          <span style={styles.value}>{tokens.input.toLocaleString()}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Output:</span>
          <span style={styles.value}>{tokens.output.toLocaleString()}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Cache Read:</span>
          <span style={styles.value}>{tokens.cacheRead.toLocaleString()}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Cache Write:</span>
          <span style={styles.value}>{tokens.cacheCreated.toLocaleString()}</span>
        </div>
      </div>

      {agents.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>Per Agent</div>
          <div style={styles.divider} />
          {agents.map((agent) => (
            <div key={agent.id} style={styles.agentRow}>
              <span style={styles.agentLabel}>{agent.type}</span>
              <span style={styles.agentTokens}>
                {fmtK(agent.tokens.input)} in&nbsp;&nbsp;{fmtK(agent.tokens.output)} out
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
