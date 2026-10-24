import { describe, it, expect } from 'vitest';
import { MerkleTree } from './merkle';

describe('MerkleTree', () => {
  it('computes deterministic root for fill leaves', () => {
    const tree = new MerkleTree(['fill1', 'fill2', 'fill3']);
    expect(tree.root).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
