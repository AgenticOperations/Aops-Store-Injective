import { InjectiveDiscoveryQuery } from './injective-query';

export function parseKeywordsFallback(text: string): InjectiveDiscoveryQuery {
  const lower = text.toLowerCase();
  const markets = [];
  if (lower.includes('btc')) markets.push('BTC/USDT');
  if (lower.includes('inj') || markets.length === 0) markets.push('INJ/USDT');
  return {
    targetMarkets: markets,
    maxLeverage: lower.includes('high') ? 10 : 3,
    maxDrawdownPct: 10,
    minDeflatedSharpe: 0.5,
    minFillsCount: 20,
  };
}
