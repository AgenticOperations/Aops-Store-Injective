import { describe, it, expect } from 'vitest';
import { calculateProfitSplit } from './high-water-mark';

describe('High-Water Mark Settlement', () => {
  it('splits profit 80/20 above previous peak', () => {
    const split = calculateProfitSplit(1000, 1200, 8000);
    expect(split?.netProfitUsd).toBe(200);
    expect(split?.agentShareUsd).toBe(160);
    expect(split?.firmShareUsd).toBe(40);
  });

  it('rejects payouts if equity is below high-water mark', () => {
    const split = calculateProfitSplit(1200, 1150, 8000);
    expect(split).toBeNull();
  });
});
