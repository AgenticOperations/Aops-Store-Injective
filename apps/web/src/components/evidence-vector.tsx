// apps/web/src/components/evidence-vector.tsx
import { Badge, Grid, Panel } from '@repo/design-system/components'
import type { EvidenceRow, ProofType } from '../fixtures/listings'

const PROOF_TYPES: { key: ProofType; label: string; asks: string }[] = [
  { key: 'CAPABILITY', label: 'Capability', asks: 'Can it do the thing at all?' },
  {
    key: 'EXECUTION',
    label: 'Execution',
    asks: 'Did a stranger watch it do the thing for real money?',
  },
  { key: 'OUTCOME', label: 'Outcome', asks: 'What actually happened, according to the chain?' },
  { key: 'RELIABILITY', label: 'Reliability', asks: 'Does it keep doing it?' },
]

const LEVEL_RANK = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L6: 6 } as const

/**
 * The evidence vector shown **as components, never as one blended number** (`03` §9.3).
 *
 * The reason this is not a single bar: the four proof types are not interchangeable quantities that
 * can be averaged. Forty L0 self-declarations and one independently-evaluated L3 execution are not
 * "similar amounts of evidence" — collapsing them into one figure is precisely the misrepresentation
 * the confidence term exists to prevent. So each axis reports its own count and its own strongest
 * level, and an axis with nothing on it says so rather than scoring zero.
 *
 * Each axis leads with the question it answers, not with its own name: "Capability" means nothing to
 * a buyer, "Can it do the thing at all?" is the thing they actually wanted to know.
 */
export function EvidenceVector({ evidence }: { evidence: EvidenceRow[] }) {
  return (
    <Grid cols={4}>
      {PROOF_TYPES.map((axis) => {
        const rows = evidence.filter((row) => row.proofType === axis.key)
        const strongest = rows.reduce<string | null>(
          (best, row) =>
            best === null || LEVEL_RANK[row.level] > LEVEL_RANK[best as 'L0'] ? row.level : best,
          null,
        )
        return (
          <Panel key={axis.key}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--ink-muted)',
              }}
            >
              {axis.label}
            </div>
            <p style={{ margin: 0, fontSize: 14 }}>{axis.asks}</p>
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              {rows.length === 0 ? (
                <Badge tone="warn">None on file</Badge>
              ) : (
                <>
                  <Badge tone={strongest === 'L0' ? 'neutral' : 'live'}>
                    strongest {strongest}
                  </Badge>
                  <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
                    {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                  </span>
                </>
              )}
            </div>
          </Panel>
        )
      })}
    </Grid>
  )
}
