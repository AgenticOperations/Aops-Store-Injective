import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageQuery } from './gemini-parser';

describe('PEAGASIS Natural Language Parser', () => {
  it('extracts conservative BTC mandate', async () => {
    const q = await parseNaturalLanguageQuery('I want a conservative BTC bot that will not blow up');
    expect(q.targetMarkets).toContain('BTC/USDT');
    expect(q.maxLeverage).toBe(2);
  });
});
