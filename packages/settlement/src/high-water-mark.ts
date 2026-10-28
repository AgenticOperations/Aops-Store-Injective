export interface ProfitDistribution {
  newHighWaterMarkUsd: number;
  firmShareUsd: number;
  agentShareUsd: number;
  netProfitUsd: number;
}

export function calculateProfitSplit(
  previousHighWaterMark: number,
  currentEquity: number,
  agentSplitBps: number
): ProfitDistribution | null {
  if (currentEquity <= previousHighWaterMark) return null;
  const netProfit = currentEquity - previousHighWaterMark;
  const agentShare = (netProfit * agentSplitBps) / 10000;
  const firmShare = netProfit - agentShare;
  return {
    newHighWaterMarkUsd: currentEquity,
    firmShareUsd: firmShare,
    agentShareUsd: agentShare,
    netProfitUsd: netProfit,
  };
}
