import { INJECTIVE_EXCHANGE_PRECOMPILE_ADDRESS, EXCHANGE_PRECOMPILE_ABI } from './exchange-abi';

export interface PrecompileGrant {
  grantee: string;
  msgTypes: string[];
  spendLimit: bigint;
  durationSeconds: number;
}

export class ExchangePrecompileClient {
  constructor(public readonly contractAddress: string = INJECTIVE_EXCHANGE_PRECOMPILE_ADDRESS) {}

  formatApproveCall(grant: PrecompileGrant) {
    return {
      to: this.contractAddress,
      data: {
        grantee: grant.grantee,
        msgTypes: grant.msgTypes,
        spendLimit: grant.spendLimit.toString(),
        duration: grant.durationSeconds,
      }
    };
  }
}
