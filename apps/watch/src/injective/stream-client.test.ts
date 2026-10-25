import { describe, it, expect } from 'vitest';
import { InjectiveChainStreamClient } from './grpc-client';

describe('InjectiveChainStreamClient', () => {
  it('instantiates correctly with testnet endpoint', () => {
    const client = new InjectiveChainStreamClient({
      endpoint: 'testnet.sentry.chain.grpc.injective.network:443',
      subaccountIds: ['0x123'],
    });
    expect(client).toBeDefined();
  });
});
