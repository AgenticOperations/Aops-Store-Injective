import { describe, it, expect } from 'vitest';
import { computeDeflatedSharpeRatio } from '../src/dsr';

describe('Monte Carlo Simulation - Builder A vs Builder B', () => {
  it('ranks disciplined single-bot builder higher than lucky spammer', () => {
    const builderAReturns = [0.015, 0.012, 0.014, 0.016, 0.013, 0.015, 0.014]; // 1 disciplined bot
    const builderBReturns = [0.03, -0.01, 0.04, -0.02, 0.05, -0.03, 0.06]; // lucky outlier from 50 bots

    const scoreA = computeDeflatedSharpeRatio(builderAReturns, 1);
    const scoreB = computeDeflatedSharpeRatio(builderBReturns, 50);

    // Builder A beats Builder B on luck-adjusted metric!
    expect(scoreA).toBeGreaterThan(scoreB);
  });
});
