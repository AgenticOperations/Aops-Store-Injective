import { describe, it, expect } from 'vitest';
import { calculateAttemptHaircut } from './multi-attempt';

describe('Attempt Haircut', () => {
  it('gives 1.0 factor to single-attempt builder', () => {
    expect(calculateAttemptHaircut(1)).toBe(1.0);
  });

  it('drastically lowers ranking of 100-attempt spammer', () => {
    expect(calculateAttemptHaircut(100)).toBeLessThan(0.5);
  });
});
