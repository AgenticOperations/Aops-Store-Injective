export function calculateAttemptHaircut(totalAttempts: number): number {
  if (totalAttempts <= 1) return 1.0;
  // Scaled haircut factor: 1 / sqrt(1 + log(N))
  return 1.0 / Math.sqrt(1 + Math.log(totalAttempts));
}

export function adjustScoreForBuilderAttempts(rawScore: number, totalAttempts: number): number {
  return rawScore * calculateAttemptHaircut(totalAttempts);
}
