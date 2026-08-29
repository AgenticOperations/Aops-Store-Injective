/**
 * SHARED — no service-package imports. Ever.
 * `@repo/design-system/components`
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

export function Shell({
  product,
  nav,
  children,
}: {
  product: string
  nav: ReactNode
  children: ReactNode
}) {
  return (
    <div style={layout.page}>
      <header style={layout.header}>
        <div style={layout.headerInner}>
          <a href="/" style={layout.brand}>
            <BnbMark />
            {product}
          </a>
          {nav}
        </div>
      </header>
      <div style={layout.main}>{children}</div>
    </div>
  )
}

export function Nav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav style={layout.nav}>
      {items.map((item) => (
        <a key={item.href} href={item.href} style={layout.navLink}>
          {item.label}
        </a>
      ))}
    </nav>
  )
}

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
 * Static block by default. Pass `href` to make it a clickable filter control (e.g. a category
 * tab) — `active` marks the one currently selected, since a filter control must show its own
 * state the same way a nav link would.
 */
export function Card({
  children,
  href,
  active,
}: {
  children: ReactNode
  href?: string
  active?: boolean
}) {
  if (href) {
    return (
      <a
        href={href}
        className={active ? 'ds-card is-active' : 'ds-card'}
        aria-current={active ? 'true' : undefined}
      >
        {children}
      </a>
    )
  }
  return <article className="ds-card">{children}</article>
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

export function Button({
  href,
  disabled,
  type = 'button',
  children,
}: {
  href?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  children: ReactNode
}) {
  if (href) {
    return (
      <a href={href} className="ds-button" aria-disabled={disabled}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className="ds-button" disabled={disabled}>
      {children}
    </button>
  )
}

const layout: Record<string, CSSProperties> = {
  page: { minHeight: '100vh' },
  header: {
    borderBottom: '1px solid var(--rule)',
    background: 'var(--paper-2)',
  },
  headerInner: {
    maxWidth: 'var(--max)',
    margin: '0 auto',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--ink)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: '-0.01em',
  },
  nav: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  navLink: { color: 'var(--ink-muted)', textDecoration: 'none', fontSize: 14 },
  main: { maxWidth: 'var(--max)', margin: '0 auto', padding: '28px 20px 64px' },
  rail: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    color: 'var(--ink-muted)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    margin: '0 0 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-block',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 2,
  },
  stat: { display: 'grid', gap: 2 },
  statLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',
  },
  statValue: { fontSize: 20, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' },
  window: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--gold-bright)',
    background: 'color-mix(in srgb, var(--gold) 14%, transparent)',
    border: '1px solid color-mix(in srgb, var(--gold) 32%, transparent)',
    padding: '1px 6px',
    width: 'fit-content',
  },
  empty: {
    border: '1px dashed var(--rule)',
    padding: 20,
    display: 'grid',
    gap: 8,
    background: 'var(--paper)',
  },
  emptyStamp: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.14em',
    color: 'var(--warn)',
  },
  muted: { margin: 0, color: 'var(--ink-muted)' },
  banner: {
    borderLeft: '3px solid',
    background: 'var(--paper-2)',
    padding: '10px 14px',
    fontSize: 14,
  },
}
