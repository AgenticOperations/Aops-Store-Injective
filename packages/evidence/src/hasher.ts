import { ExecutionFill } from '@repo/domain';

export function hashExecutionFill(fill: ExecutionFill): string {
  return `${fill.subaccountId}:${fill.marketId}:${fill.orderHash}:${fill.price}:${fill.quantity}:${fill.blockHeight}`;
}
