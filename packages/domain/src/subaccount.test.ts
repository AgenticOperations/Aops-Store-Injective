import { describe, it, expect } from 'vitest';
import { deriveSubaccountId, parseSubaccountId } from './subaccount';

describe('Subaccount Derivation', () => {
  const testAddress = '0x1234567890123456789012345678901234567890';

  it('correctly derives 32-byte subaccount ID for seat index 1', () => {
    const subId = deriveSubaccountId(testAddress, 1);
    expect(subId).toBe('0x1234567890123456789012345678901234567890000000000000000000000001');
    const parsed = parseSubaccountId(subId);
    expect(parsed.ownerAddress.toLowerCase()).toBe(testAddress.toLowerCase());
    expect(parsed.subaccountIndex).toBe(1);
  });

  it('rejects subaccount index 0 to avoid default balance pooling', () => {
    expect(() => deriveSubaccountId(testAddress, 0)).toThrow('Prop seat subaccounts must use index >= 1');
  });
});
