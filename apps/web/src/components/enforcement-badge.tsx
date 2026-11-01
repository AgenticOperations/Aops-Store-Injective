export type EnforcementLevel = 'ENFORCED_ON_CHAIN' | 'GUARDED_PRE_ORDER' | 'MONITORED_PER_BLOCK';

export function getBadgeColor(level: EnforcementLevel): string {
  switch (level) {
    case 'ENFORCED_ON_CHAIN': return 'green';
    case 'GUARDED_PRE_ORDER': return 'blue';
    case 'MONITORED_PER_BLOCK': return 'amber';
  }
}
