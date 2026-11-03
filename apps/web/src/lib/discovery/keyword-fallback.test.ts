import { describe, it, expect } from 'vitest';
import { parseKeywordsFallback } from './keyword-fallback';

describe('Keyword Fallback Parser', () => {
  it('parses fallback without external API network dependencies', () => {
    const res = parseKeywordsFallback('grid bot for btc');
    expect(res.targetMarkets).toContain('BTC/USDT');
  });
});
