import { describe, it, expect } from 'vitest';
import { detectStyleDrift } from './style-drift';

describe('Style Drift Detector', () => {
  it('flags market maker taking extreme one-way directional bets', () => {
    const orders = Array(10).fill({ isBuy: true, notionalUsd: 100, holdingDurationSeconds: 300 });
    expect(detectStyleDrift('MARKET_MAKING', orders)).toBe(true);
  });
});
