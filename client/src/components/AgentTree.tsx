import { Agent } from 'shared';

export function AgentTree({ agents }: { agents: Agent[] }) {
  return <div>AgentTree: {agents.length} agents</div>;
}
