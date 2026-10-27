import { describe, it, expect } from 'vitest';
import { evaluateLadderPromotion } from './ladder-evaluator';

describe('Capital Ladder Promotion', () => {
  it('promotes from Challenge ($100) to Level 1 ($1k) on 6% gain with 25 fills', () => {
    const evalResult = evaluateLadderPromotion(0, 6.5, 25);
    expect(evalResult.canPromote).toBe(true);
    expect(evalResult.nextTier?.allocatedCapitalUsd).toBe(1000);
  });
});
