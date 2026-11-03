import { InjectiveDiscoveryQuery } from './injective-query';

export async function parseNaturalLanguageQuery(prompt: string): Promise<InjectiveDiscoveryQuery> {
  const isBtc = prompt.toLowerCase().includes('btc');
  return {
    targetMarkets: isBtc ? ['BTC/USDT'] : ['INJ/USDT'],
    maxLeverage: prompt.toLowerCase().includes('conservative') ? 2 : 5,
    maxDrawdownPct: 10,
    minDeflatedSharpe: 0.7,
    minFillsCount: 50,
  };
}
