import { Agent, TokenCounts } from 'shared';

export function TokenMeter({ tokens, agents }: { tokens: TokenCounts; agents: Agent[] }) {
  void agents;
  return <div>TokenMeter: {tokens.input + tokens.output} tokens</div>;
}
