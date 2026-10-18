import { describe, it, expect } from 'vitest';
import { parseBatchAuction } from './batch-auction-parser';

describe('Batch Auction Parser', () => {
  it('extracts clearing price accurately', () => {
    const raw = [{ market_id: 'INJ/USDT', clearing_price: '25.50', volume: '1000', block_height: 100 }];
    const parsed = parseBatchAuction(raw);
    expect(parsed[0].clearingPrice).toBe('25.50');
  });
});
