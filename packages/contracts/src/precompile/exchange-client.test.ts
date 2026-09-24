import { describe, it, expect } from 'vitest';
import { ExchangePrecompileClient } from './exchange-client';
import { isAllowedOrderMsgType, ALLOWED_MSG_TYPES } from './types';

describe('ExchangePrecompileClient', () => {
  const client = new ExchangePrecompileClient();

  it('formats grant approvals with valid order msg types', () => {
    const call = client.formatApproveCall({
      grantee: '0x1111111111111111111111111111111111111111',
      msgTypes: [ALLOWED_MSG_TYPES[0]],
      spendLimit: 1000000000n,
      durationSeconds: 86400,
    });
    expect(call.to).toBe('0x0000000000000000000000000000000000000065');
    expect(isAllowedOrderMsgType(ALLOWED_MSG_TYPES[0])).toBe(true);
  });
});
