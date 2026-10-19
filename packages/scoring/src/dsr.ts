import { calculateMoments } from './statistics';

export function normalCdf(x: number): number {
  return 0.5 * (1 + Math.erf(x / Math.SQRT2));
}

export function computeDeflatedSharpeRatio(returns: number[], numTrials: number): number {
  const { mean, variance, skewness, kurtosis } = calculateMoments(returns);
  if (variance <= 0) return 0;
  const sr = mean / Math.sqrt(variance);
  const expectedMaxSr = Math.sqrt(2 * Math.log(numTrials));
  const t = returns.length;
  const denom = Math.sqrt(1 - skewness * sr + ((kurtosis - 1) / 4) * Math.pow(sr, 2));
  const zScore = ((sr - expectedMaxSr) * Math.sqrt(t - 1)) / denom;
  return Math.min(1.0, Math.max(0.0, normalCdf(zScore)));
}
