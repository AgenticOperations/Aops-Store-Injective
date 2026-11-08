import { describe, it, expect } from 'vitest';
import { computeWashTradeScore } from './wash-trade';

describe('Wash Trade Detector', () => {
  it('detects circular self-trades', () => {
    const fills = [
      { makerAddress: '0xAAA', takerAddress: '0xAAA', notionalUsd: 100 },
      { makerAddress: '0xAAA', takerAddress: '0xBBB', notionalUsd: 100 }
    ];
    expect(computeWashTradeScore(fills)).toBe(0.5);
  });
});
