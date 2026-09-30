/**
 * SHARED — no service-package imports. Ever.
 * `@repo/design-system/components`
 *
 * ── How to build a page with these ────────────────────────────────────────────────────────────
 *
 * A page picks primitives and supplies content. It does not invent spacing, column counts or
 * heading margins — those live in `tokens.css` and are the reason routes line up with each other.
 *
 *   <Shell>                        page frame: sticky header, wash, one measure, one gutter
 *     <PageHead … />               detail routes: eyebrow + title + badges + lede
 *     <Hero … />                   landing route only: centred display + one dominant control
 *     <Section title sub>          the repeating unit — every block of content is one of these
 *       <Grid cols={2|3|4}>        fixed columns that collapse; never auto-fill
 *         <Card>                   zoned: Band (state) / Body (claim) / Foot (labels, actions)
 *       <Panel>                    a bordered block for prose or key-value content
 *       <StatGrid>                 a row of Stats that agrees with every other row of Stats
 *
 * The rule that keeps it honest: if a page needs a layout the primitives cannot express, that is a
 * missing primitive, not a licence to write another one-off `style={{ gridTemplateColumns: … }}`.
 */
import type { CSSProperties, ReactNode } from 'react'

/** The BNB Chain mark (Simple Icons, official geometric path) — never hotlinked. */
function BnbMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="var(--gold)"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M5.631 3.676 12.001 0l6.367 3.676-2.34 1.358L12 2.716 7.972 5.034l-2.34-1.358Zm12.737 4.636-2.34-1.358L12 9.272 7.972 6.954l-2.34 1.358v2.716l4.026 2.318v4.636L12 19.341l2.341-1.359v-4.636l4.027-2.318V8.312Zm0 7.352v-2.716l-2.34 1.358v2.716l2.34-1.358Zm1.663.96-4.027 2.318v2.717l6.368-3.677V10.63l-2.34 1.358v4.636Zm-2.34-10.63 2.34 1.358v2.716l2.341-1.358V5.994l-2.34-1.358-2.342 1.358ZM9.657 19.926v2.716L12 24l2.341-1.358v-2.716l-2.34 1.358-2.343-1.358Zm-4.027-4.262 2.341 1.358v-2.716l-2.34-1.358v2.716Zm4.027-9.67L12 7.352l2.341-1.358-2.34-1.358-2.343 1.358Zm-5.69 1.358L6.31 5.994 3.968 4.636l-2.34 1.358V8.71l2.34 1.358V7.352Zm0 4.636-2.34-1.358v7.352l6.368 3.677v-2.717l-4.028-2.318v-4.636Z" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   PAGE FRAME
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * `deco` opts a route into the BNB-mark geometry flanking the fold. It is **off by default and on
 * only for the landing hero**, because the artwork works by filling the space either side of a
 * centred column. Inner routes are left-aligned and run the full measure, so the same artwork
 * lands directly behind headings and body copy — which is a legibility cost paid for atmosphere,
 * and the wrong trade on pages whose entire job is presenting numbers a buyer has to trust.
 */
export function Shell({
  product,
  brand,
  nav,
  deco,
  headerClassName,
  children,
}: {
  product?: string
  brand?: ReactNode
  nav: ReactNode
  deco?: boolean
  headerClassName?: string
  children: ReactNode
}) {
  return (
    <div className="ds-page">
      {/* The left and right artworks are genuinely different — not one asset mirrored — so each
          edge gets its own file, and each has a narrower crop that swaps in below 1200px. The art
          ships pre-dimmed (dark grey on transparency), so it renders near full opacity; dimming it
          further is what made an earlier pass invisible. Decorative, so aria-hidden throughout. */}
      {deco && (
        <>
          <picture>
            <source srcSet="/bnb-back-left3.png" media="(max-width: 1200px)" />
            <img src="/bnb-back-left2.png" alt="" aria-hidden="true" className="ds-deco is-left" />
          </picture>
          <picture>
            <source srcSet="/bnb-back-right3.png" media="(max-width: 1200px)" />
            <img
              src="/bnb-back-right2.png"
              alt=""
              aria-hidden="true"
              className="ds-deco is-right"
            />
          </picture>
        </>
      )}
      <header className={headerClassName ? `ds-header ${headerClassName}` : 'ds-header'}>
        <div className="ds-header__inner">
          <a href="/" className="ds-brand">
            {brand ?? (
              <>
                <BnbMark />
                {product}
              </>
            )}
          </a>
          {nav}
        </div>
      </header>
      <div className="ds-main">{children}</div>
    </div>
  )
}

export function Nav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="ds-nav">
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  )
}

/**
 * The pipeline instrument strip — this product's one signature motif, and the only decoration in
 * the system that is allowed to be decoration. It states which of the five pipelines a screen
 * belongs to and how finished that engine is, so a reader always knows whether what they are
 * looking at is measured, scaffolded or deliberately dead.
 */
export function EngineRail({
  pipeline,
  engine,
  status,
}: {
  pipeline: string
  engine: string
  status: string
}) {
  return (
    <p style={layout.rail}>
      <span className="ds-rail-dot" aria-hidden="true" />
      <span>{pipeline}</span>
      <span aria-hidden="true">·</span>
      <span>{engine}</span>
      <span aria-hidden="true">·</span>
      <span>{status}</span>
    </p>
  )
}

/**
 * The landing route's opening. One display line, one supporting sentence, one dominant control —
 * the control is a slot rather than a prop because the landing page's search box owns its own
 * client state and this component must stay a server-renderable shell.
 */
export function Hero({
  title,
  lede,
  children,
}: {
  title: ReactNode
  lede?: string
  children?: ReactNode
}) {
  return (
    <section className="ds-hero">
      <h1>{title}</h1>
      {lede && <p className="ds-hero__lede">{lede}</p>}
      {children && <div className="ds-hero__slot">{children}</div>}
    </section>
  )
}

/**
 * Detail-route header. `lede` is one sentence saying what the reader is looking at — required by
 * convention, not by type, because a detail page that cannot say what it shows in one sentence
 * usually has a content problem rather than a layout one.
 */
export function PageHead({
  pipeline,
  engine,
  status,
  title,
  meta,
  lede,
}: {
  pipeline: string
  engine: string
  status: string
  title: ReactNode
  meta?: ReactNode
  lede?: ReactNode
}) {
  return (
    <div className="ds-pagehead">
      <EngineRail pipeline={pipeline} engine={engine} status={status} />
      <h1>{title}</h1>
      {meta && <div className="ds-pagehead__meta">{meta}</div>}
      {lede && <p className="ds-pagehead__lede">{lede}</p>}
    </div>
  )
}

/**
 * The repeating unit of every page. `sub` is the one-line explanation under the title — the
 * reference layout uses this pairing on every block, and it does more for scannability than any
 * amount of card styling, because it lets a reader skip a whole section on one line.
 */
export function Section({
  title,
  sub,
  action,
  children,
}: {
  title?: string
  sub?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ds-section">
      {(title || action) && (
        <div className="ds-section__head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p className="ds-section__sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Grid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  return <div className={`ds-grid cols-${cols}`}>{children}</div>
}

export function Panel({ quiet, children }: { quiet?: boolean; children: ReactNode }) {
  return <div className={quiet ? 'ds-panel is-quiet' : 'ds-panel'}>{children}</div>
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="ds-prose">{children}</div>
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="ds-note">{children}</p>
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="ds-chiprow">{children}</div>
}

export function Actions({ centered, children }: { centered?: boolean; children: ReactNode }) {
  return <div className={centered ? 'ds-actions is-centered' : 'ds-actions'}>{children}</div>
}

/**
 * A centred row of headline figures split by hairlines — the reference's closing move on the
 * fold. Deliberately separate from `Stat`: these are counts of the marketplace itself, not
 * measurements of an agent, so they carry no observation window and must not look like they do.
 */
export function StatBar({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="ds-statbar">
      {items.map((item) => (
        <div key={item.label}>
          <div className="ds-statbar__value">{item.value}</div>
          <div className="ds-statbar__label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export function StatGrid({ boxed, children }: { boxed?: boolean; children: ReactNode }) {
  return <div className={boxed ? 'ds-stats is-boxed' : 'ds-stats'}>{children}</div>
}

export function DefList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="ds-deflist">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Scroller({ children }: { children: ReactNode }) {
  return <div className="ds-scroll">{children}</div>
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   CARD — a zoned surface
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Pass `href` to make the whole card a control (a category tile, a filter). Otherwise compose
 * `CardBand` / `CardBody` / `CardFoot` inside it. `plain` collapses the anatomy back to a single
 * padded box for the cases that genuinely have one zone.
 */
export function Card({
  children,
  href,
  active,
  plain,
}: {
  children: ReactNode
  href?: string
  active?: boolean
  plain?: boolean
}) {
  const className = ['ds-card', plain || href ? 'is-plain' : '', active ? 'is-active' : '']
    .filter(Boolean)
    .join(' ')

  if (href) {
    return (
      <a href={href} className={className} aria-current={active ? 'true' : undefined}>
        {children}
      </a>
    )
  }
  return <article className={className}>{children}</article>
}

/** The card's state zone: what this thing *is* right now, before any claim about how good it is. */
export function CardBand({ children }: { children: ReactNode }) {
  return <div className="ds-card__band">{children}</div>
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="ds-card__body">{children}</div>
}

/** Separated by a dashed rule: labels and actions, never measurements. */
export function CardFoot({ children }: { children: ReactNode }) {
  return <div className="ds-card__foot">{children}</div>
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   CONTENT PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

const BADGE_TONE = {
  neutral: {
    bg: 'var(--chip)',
    text: 'var(--ink-muted)',
    border: 'var(--rule)',
  },
  live: {
    bg: 'color-mix(in srgb, var(--live) 16%, transparent)',
    text: 'var(--live)',
    border: 'color-mix(in srgb, var(--live) 45%, transparent)',
  },
  alert: {
    bg: 'color-mix(in srgb, var(--alert) 16%, transparent)',
    text: 'var(--alert)',
    border: 'color-mix(in srgb, var(--alert) 45%, transparent)',
  },
  survey: {
    bg: 'color-mix(in srgb, var(--gold) 16%, transparent)',
    text: 'var(--gold-bright)',
    border: 'color-mix(in srgb, var(--gold) 45%, transparent)',
  },
  warn: {
    bg: 'color-mix(in srgb, var(--warn) 18%, transparent)',
    text: 'var(--warn)',
    border: 'color-mix(in srgb, var(--warn) 45%, transparent)',
  },
} as const

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'live' | 'alert' | 'survey' | 'warn'
  children: ReactNode
}) {
  const t = BADGE_TONE[tone]
  return (
    <span
      style={{ ...layout.badge, background: t.bg, color: t.text, border: `1px solid ${t.border}` }}
    >
      {children}
    </span>
  )
}

/**
 * `window` is required, not optional. The plan's own rule: every Stat renders value + window
 * chip, never a bare number (03 §7.3 — a metric without its observation window is not honest).
 * Enforced by the type, not by a comment callers can skip.
 */
export function Stat({
  label,
  value,
  window,
  caution,
}: {
  label: string
  value: string
  window: string
  caution?: boolean
}) {
  return (
    <div style={layout.stat}>
      <div style={layout.statLabel}>{label}</div>
      <div style={{ ...layout.statValue, color: caution ? 'var(--alert)' : 'var(--ink)' }}>
        {value}
      </div>
      <div style={layout.window}>window {window}</div>
    </div>
  )
}

/**
 * Score and confidence, rendered together and never apart (`architecture/05` §5.2 — a high score
 * at low confidence must never render indistinguishably from a high-confidence one). The two
 * populated states are visually distinct by construction: below the threshold the value is muted
 * and the confidence bar is drawn in the caution colour, so "weak" is legible at a glance rather
 * than only on reading the number. The third state — no evidence at all — is not this component's
 * job: callers render `EmptyState` instead, so there is no code path that turns absent into 0.
 */
export function ScoreMeter({
  value,
  confidence,
  sampleSize,
  window,
}: {
  value: number
  /** 0–1. */
  confidence: number
  sampleSize: number
  window: string
}) {
  const weak = confidence < 0.5
  const pct = Math.round(confidence * 100)
  return (
    <div style={layout.stat}>
      <div style={layout.statLabel}>Score · confidence</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            ...layout.statValue,
            color: weak ? 'var(--ink-muted)' : 'var(--ink)',
          }}
        >
          {value}
        </span>
        <span style={{ ...layout.statLabel, textTransform: 'none' }}>
          {weak ? 'low confidence' : 'confidence'} {pct}%
        </span>
      </div>
      <div
        className="ds-meter"
        role="img"
        aria-label={`Confidence ${pct} percent from ${sampleSize} observations`}
      >
        <span
          style={{
            width: `${pct}%`,
            background: weak ? 'var(--warn)' : 'var(--live)',
          }}
        />
      </div>
      <div style={layout.window}>
        n={sampleSize} · window {window}
      </div>
    </div>
  )
}

/**
 * A question the design has not answered yet, rendered where the answer would go. Hard stop 6 of
 * the scaffold plan: a screen blocked on a product decision shows the open question rather than
 * quietly picking a default, because a hidden default is indistinguishable from a decision.
 */
export function OpenQuestion({ id, children }: { id: string; children: ReactNode }) {
  return (
    <aside style={{ ...layout.banner, borderLeftColor: 'var(--warn)' }}>
      <span style={{ ...layout.badge, background: 'var(--chip)', color: 'var(--warn)' }}>
        OPEN QUESTION · {id}
      </span>
      <div style={{ marginTop: 6 }}>{children}</div>
    </aside>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div style={layout.empty}>
      <div style={layout.emptyStamp}>NO TRACK RECORD YET</div>
      <strong>{title}</strong>
      <p style={layout.muted}>{body}</p>
    </div>
  )
}

export function Banner({
  tone = 'survey',
  children,
}: {
  tone?: 'survey' | 'alert' | 'warn'
  children: ReactNode
}) {
  const border = {
    survey: 'var(--gold)',
    alert: 'var(--alert)',
    warn: 'var(--warn)',
  }[tone]
  return <aside style={{ ...layout.banner, borderLeftColor: border }}>{children}</aside>
}

/**
 * `title` is required whenever `disabled` is set. Every disabled control in this scaffold is
 * disabled for a *reason the buyer is owed* — "Ring 3 not connected", "E11 not wired" — and a
 * dead control with no explanation reads as a bug rather than as a deliberate boundary.
 */
export function Button({
  href,
  disabled,
  variant = 'primary',
  title,
  type = 'button',
  children,
}: {
  href?: string
  disabled?: boolean
  variant?: 'primary' | 'ghost'
  title?: string
  type?: 'button' | 'submit'
  children: ReactNode
}) {
  const className = variant === 'ghost' ? 'ds-button is-ghost' : 'ds-button'
  if (href) {
    return (
      <a href={href} className={className} aria-disabled={disabled} title={title}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={className} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

const layout: Record<string, CSSProperties> = {
  rail: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    color: 'var(--ink-muted)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-block',
    justifySelf: 'start',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 11px',
    borderRadius: 'var(--r-pill)',
    whiteSpace: 'nowrap',
  },
  stat: { display: 'grid', gap: 2, minWidth: 0 },
  statLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',
  },
  statValue: {
    fontFamily: 'var(--display)',
    fontSize: 26,
    fontWeight: 500,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.03em',
  },
  window: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.02em',
    color: 'color-mix(in srgb, var(--gold-bright) 78%, var(--ink-muted))',
    width: 'fit-content',
  },
  empty: {
    border: '1px dashed var(--rule)',
    borderRadius: 'var(--r-panel)',
    padding: 'var(--s6)',
    display: 'grid',
    gap: 8,
    background: 'var(--paper-2)',
    textAlign: 'center',
    justifyItems: 'center',
  },
  emptyStamp: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.14em',
    color: 'var(--warn)',
  },
  muted: { margin: 0, color: 'var(--ink-muted)', maxWidth: '52ch' },
  banner: {
    borderLeft: '3px solid',
    borderRadius: '0 var(--r-panel) var(--r-panel) 0',
    background: 'var(--paper-2)',
    padding: 'var(--s4) var(--s5)',
    fontSize: 15,
    color: 'var(--ink-soft)',
  },
}
