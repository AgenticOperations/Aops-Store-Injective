import { describe, it, expect } from 'vitest';
import { getBadgeColor } from './enforcement-badge';

describe('Enforcement Badges', () => {
  it('correctly maps on-chain enforcement to green indicator', () => {
    expect(getBadgeColor('ENFORCED_ON_CHAIN')).toBe('green');
  });
});
