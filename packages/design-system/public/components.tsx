/**
 * SHARED — no service-package imports. Ever.
 * `@repo/design-system/components`
 */
import type { CSSProperties, ReactNode } from 'react'

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
      <span>{pipeline}</span>
      <span aria-hidden="true">·</span>
      <span>{engine}</span>
      <span aria-hidden="true">·</span>
      <span>{status}</span>
    </p>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'live' | 'alert' | 'survey' | 'warn'
  children: ReactNode
}) {
  const background = {
    neutral: 'var(--chip)',
    live: '#d5eadc',
    alert: '#f3d7cf',
    survey: '#d4e8f3',
    warn: '#f3e6c0',
  }[tone]
  return <span style={{ ...layout.badge, background }}>{children}</span>
}

export function Card({ children }: { children: ReactNode }) {
  return <article style={layout.card}>{children}</article>
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
    survey: 'var(--survey)',
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
  const style: CSSProperties = {
    ...layout.button,
    opacity: disabled ? 0.45 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  }
  if (href) {
    return (
      <a href={href} style={style} aria-disabled={disabled}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} style={style} disabled={disabled}>
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
    color: 'var(--ink)',
    textDecoration: 'none',
    fontWeight: 600,
    letterSpacing: '-0.03em',
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
    margin: '0 0 12px',
    display: 'flex',
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
  card: {
    background: 'var(--paper-2)',
    border: '1px solid var(--rule)',
    padding: 16,
    display: 'grid',
    gap: 10,
    boxShadow: 'var(--shadow)',
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
    color: 'var(--survey-ink)',
    background: 'var(--chip)',
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
  button: {
    display: 'inline-block',
    background: 'var(--survey)',
    color: '#fff',
    padding: '8px 14px',
    border: 0,
    borderRadius: 2,
    textDecoration: 'none',
    cursor: 'pointer',
  },
}
