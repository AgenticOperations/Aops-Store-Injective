export function calculateMoments(returns: number[]): { mean: number; variance: number; skewness: number; kurtosis: number } {
  const n = returns.length;
  if (n < 4) return { mean: 0, variance: 0, skewness: 0, kurtosis: 3 };
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  const skewness = (returns.reduce((acc, r) => acc + Math.pow((r - mean) / std, 3), 0) * n) / ((n - 1) * (n - 2));
  const kurtosis = (returns.reduce((acc, r) => acc + Math.pow((r - mean) / std, 4), 0) * n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  return { mean, variance, skewness, kurtosis };
}
