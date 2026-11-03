import { SeatMandate } from './mandate';

export interface AllocatorSubMandate {
  parentMandateId: string;
  subAgentId: string;
  allocatedNotionalUsd: number;
  maxLeverage: number;
}

export function validateSubMandateFitsParent(parent: SeatMandate, sub: AllocatorSubMandate): boolean {
  return sub.allocatedNotionalUsd <= parent.envelope.maxNotionalPerOrderUsd &&
         sub.maxLeverage <= parent.envelope.maxNetLeverage;
}
