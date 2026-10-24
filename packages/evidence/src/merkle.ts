import * as crypto from 'crypto';

export class MerkleTree {
  private leaves: string[];
  public root: string;

  constructor(items: string[]) {
    this.leaves = items.map(i => crypto.createHash('sha256').update(i).digest('hex'));
    this.root = this.buildRoot(this.leaves);
  }

  private buildRoot(nodes: string[]): string {
    if (nodes.length === 0) return '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (nodes.length === 1) return `0x${nodes[0]}`;
    const nextLevel: string[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left;
      const combined = crypto.createHash('sha256').update(left + right).digest('hex');
      nextLevel.push(combined);
    }
    return this.buildRoot(nextLevel);
  }
}
