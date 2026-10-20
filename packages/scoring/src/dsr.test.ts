import { describe, it, expect } from 'vitest';
import { computeDeflatedSharpeRatio } from './dsr';

describe('Deflated Sharpe Ratio', () => {
  it('penalizes high Sharpe when number of trials is large', () => {
    const returns = [0.01, 0.02, -0.005, 0.015, 0.03, -0.01, 0.025, 0.01];
    const dsrOneTrial = computeDeflatedSharpeRatio(returns, 1);
    const dsrFiftyTrials = computeDeflatedSharpeRatio(returns, 50);
    expect(dsrOneTrial).toBeGreaterThan(dsrFiftyTrials);
  });
});
