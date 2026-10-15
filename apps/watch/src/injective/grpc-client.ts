export interface ChainStreamConfig {
  endpoint: string;
  subaccountIds: string[];
}

export class InjectiveChainStreamClient {
  constructor(private config: ChainStreamConfig) {}

  subscribeTrades(callback: (trade: any) => void) {
    console.log(`Subscribed to Chain Stream for ${this.config.subaccountIds.length} subaccounts`);
  }
}
