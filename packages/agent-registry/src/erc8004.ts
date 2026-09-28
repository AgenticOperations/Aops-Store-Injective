export interface ERC8004AgentMetadata {
  agentId: string;
  builderAddress: string;
  registeredAtBlock: number;
  strategyCategory: 'GRID' | 'REBALANCING' | 'PERP_MOMENTUM' | 'MARKET_MAKING';
  feeRecipientAddress: string;
}

export class ERC8004RegistryClient {
  constructor(public readonly registryAddress: string) {}

  async fetchAgentMetadata(agentId: string): Promise<ERC8004AgentMetadata> {
    return {
      agentId,
      builderAddress: '0x2222222222222222222222222222222222222222',
      registeredAtBlock: 85200000,
      strategyCategory: 'PERP_MOMENTUM',
      feeRecipientAddress: '0x2222222222222222222222222222222222222222',
    };
  }
}
