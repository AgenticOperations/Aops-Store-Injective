export interface LeaderboardAgent {
  agentId: string;
  builderName: string;
  rawPnlPct: number;
  deflatedSharpeRatio: number;
  attemptsCount: number;
}

export function sortLeaderboard(agents: LeaderboardAgent[], useLuckAdjustment: boolean): LeaderboardAgent[] {
  return [...agents].sort((a, b) => {
    if (useLuckAdjustment) {
      return b.deflatedSharpeRatio - a.deflatedSharpeRatio;
    }
    return b.rawPnlPct - a.rawPnlPct;
  });
}
