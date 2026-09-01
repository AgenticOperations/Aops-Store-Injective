// apps/web/src/components/evidence-timeline.tsx
import { Badge, EmptyState } from '@repo/design-system/components'
import type { EvidenceRow } from '../fixtures/listings'

function formatDate(iso: string) {
  // Fixed locale + UTC so server and client render the same string. A hydration-time locale
  // difference on a timestamp column is a real bug class here, not a cosmetic one.
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')}Z`
}

/**
 * Detail Layer 2 — the chronological Evidence feed (`architecture/05` §5.2).
 *
 * Two rendering rules from that section are enforced here rather than left to the caller:
 *
 * **Redaction (correction 3).** The expandable payload shows the decision/result summary and a
 * *scope summary* of permissions used — "spend cap: 500 USDC, contracts: [...]" — never the raw
 * signed session payload and no wallet address beyond the already-public agent id. The fixture
 * type has no field for the raw payload at all, so this is a shape guarantee, not a discipline.
 *
 * **Operator-observed labelling (correction 9 / 5.6).** Watcher-sourced rows are labelled
 * "observed by marketplace operator" and are visually distinct from independently-evaluated ones.
 * A reader must never be able to mistake our own observation for a third party's verification.
 */
export function EvidenceTimeline({ evidence }: { evidence: EvidenceRow[] }) {
  if (evidence.length === 0) {
    return (
      <EmptyState
        title="No evidence rows yet"
        body="This agent is LIVE and hireable, and nothing has been measured about it. That is the
          expected state for an agent on its first day — it is not a zero and not a failure."
      />
    )
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {evidence.map((row) => (
        <li
          key={row.id}
          style={{
            borderLeft: `3px solid ${row.operatorObserved ? 'var(--warn)' : 'var(--gold)'}`,
            background: 'var(--paper-2)',
            padding: '12px 14px',
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={row.level === 'L0' ? 'neutral' : 'live'}>{row.level}</Badge>
            <Badge>{row.proofType}</Badge>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
              {formatDate(row.occurredAt)}
            </span>
          </div>

          <div style={{ fontSize: 14 }}>{row.summary}</div>

          <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{row.source}</div>

          {row.operatorObserved ? (
            <Badge tone="warn">Observed by marketplace operator</Badge>
          ) : (
            <Badge tone="neutral">Not operator-observed</Badge>
          )}

          {(row.txHash || row.permissionsUsed) && (
            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--gold-bright)' }}>
                Show payload
              </summary>
              <dl style={{ margin: '8px 0 0', display: 'grid', gap: 6 }}>
                {row.txHash && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-muted)', minWidth: 110 }}>Transaction</dt>
                    <dd style={{ margin: 0, fontFamily: 'var(--mono)' }}>{row.txHash}</dd>
                  </div>
                )}
                {row.permissionsUsed && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <dt style={{ color: 'var(--ink-muted)', minWidth: 110 }}>Scope used</dt>
                    <dd style={{ margin: 0 }}>{row.permissionsUsed}</dd>
                  </div>
                )}
              </dl>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-muted)' }}>
                Scope is shown as a summary. The signed session payload is never rendered.
              </p>
            </details>
          )}
        </li>
      ))}
    </ol>
  )
}
