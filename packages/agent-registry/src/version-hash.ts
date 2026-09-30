import * as crypto from 'crypto';

export function computeStrategyVersionHash(codePayload: string, parameters: Record<string, unknown>): string {
  const serialized = JSON.stringify({ codePayload, parameters }, Object.keys(parameters).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
