export const ALLOWED_MSG_TYPES = [
  '/injective.exchange.v1beta1.MsgCreateSpotLimitOrder',
  '/injective.exchange.v1beta1.MsgCreateDerivativeLimitOrder',
  '/injective.exchange.v1beta1.MsgCancelSpotOrder',
  '/injective.exchange.v1beta1.MsgCancelDerivativeOrder',
  '/injective.exchange.v1beta1.MsgBatchCreateDerivativeLimitOrders'
] as const;

export type InjectiveOrderMsgType = typeof ALLOWED_MSG_TYPES[number];

export function isAllowedOrderMsgType(msgType: string): msgType is InjectiveOrderMsgType {
  return (ALLOWED_MSG_TYPES as readonly string[]).includes(msgType);
}
