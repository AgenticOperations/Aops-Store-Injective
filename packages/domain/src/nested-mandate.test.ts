import { describe, it, expect } from 'vitest';
import { validateSubMandateFitsParent } from './nested-mandate';

describe('Nested Mandates', () => {
  it('rejects sub-mandate that exceeds parent leverage', () => {
    const parent: any = { envelope: { maxNotionalPerOrderUsd: 5000, maxNetLeverage: 3 } };
    const sub: any = { allocatedNotionalUsd: 2000, maxLeverage: 5 };
    expect(validateSubMandateFitsParent(parent, sub)).toBe(false);
  });
});
