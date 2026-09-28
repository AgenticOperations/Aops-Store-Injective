import { describe, it, expect } from 'vitest';
import { computeLuckDiscountPenalty } from './attempt-tracker';

describe('Luck Discount Penalty', () => {
  it('assigns 1.0 penalty factor to first-attempt builders', () => {
    expect(computeLuckDiscountPenalty(1)).toBe(1.0);
  });

  it('imposes significant penalty on 100-attempt spam builders', () => {
    const penalty = computeLuckDiscountPenalty(100);
    expect(penalty).toBeLessThan(0.4);
  });
});
