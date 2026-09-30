export interface SubaccountConfig {
  ownerAddress: string;
  subaccountIndex: number;
}

export function isValidSubaccountId(subaccountId: string): boolean {
  try {
    const parsed = parseSubaccountId(subaccountId);
    return parsed.subaccountIndex >= 1;
  } catch {
    return false;
  }
}

export function deriveSubaccountId(ownerAddress: string, subaccountIndex: number): string {
  if (subaccountIndex < 1) {
    throw new Error('Prop seat subaccounts must use index >= 1 to ensure balance isolation');
  }
  const cleanAddress = ownerAddress.toLowerCase().replace(/^0x/, '');
  if (cleanAddress.length !== 40) {
    throw new Error(`Invalid ethereum address length: ${ownerAddress}`);
  }
  const hexIndex = subaccountIndex.toString(16).padStart(24, '0');
  return `0x${cleanAddress}${hexIndex}`;
}

export function parseSubaccountId(subaccountId: string): SubaccountConfig {
  const clean = subaccountId.toLowerCase().replace(/^0x/, '');
  if (clean.length !== 64) {
    throw new Error(`Invalid subaccountId length: ${subaccountId}`);
  }
  const ownerAddress = `0x${clean.slice(0, 40)}`;
  const subaccountIndex = parseInt(clean.slice(40), 16);
  return { ownerAddress, subaccountIndex };
}
