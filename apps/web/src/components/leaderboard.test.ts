import { describe, it, expect } from 'vitest';
import { sortLeaderboard } from './leaderboard';

describe('Leaderboard Luck Adjustment', () => {
  const agents = [
    { agentId: 'bot-spam', builderName: 'Builder B', rawPnlPct: 45, deflatedSharpeRatio: 0.35, attemptsCount: 50 },
    { agentId: 'bot-clean', builderName: 'Builder A', rawPnlPct: 22, deflatedSharpeRatio: 0.88, attemptsCount: 1 }
  ];

  it('ranks Builder B first on raw returns', () => {
    const raw = sortLeaderboard(agents, false);
    expect(raw[0].agentId).toBe('bot-spam');
  });

  it('drops Builder B below Builder A when luck adjustment is enabled', () => {
    const luckAdjusted = sortLeaderboard(agents, true);
    expect(luckAdjusted[0].agentId).toBe('bot-clean');
  });
});
