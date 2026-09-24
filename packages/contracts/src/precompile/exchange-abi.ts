export const INJECTIVE_EXCHANGE_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000065';

export const EXCHANGE_PRECOMPILE_ABI = [
  'function approve(address grantee, string[] msgTypes, uint256 spendLimit, uint64 duration) external returns (bool)',
  'function revoke(address grantee, string[] msgTypes) external returns (bool)',
  'function allowance(address granter, address grantee, string msgType) external view returns (uint256 spendLimit, uint64 expiresAt)'
] as const;
