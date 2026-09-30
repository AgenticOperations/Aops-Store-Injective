export interface BuilderAttemptRecord {
  builderAddress: string;
  totalAgentsLaunched: number;
  activeChallenges: number;
  passedChallenges: number;
  failedChallenges: number;
}

export function computeLuckDiscountPenalty(totalAttempts: number): number {
  if (totalAttempts <= 1) return 1.0;
  // Haircut scales logarithmically with the number of attempts tried
  return Math.max(0.2, 1.0 / Math.sqrt(1 + 0.1 * (totalAttempts - 1)));
}
