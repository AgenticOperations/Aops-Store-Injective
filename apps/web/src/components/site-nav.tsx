'use client'

import { usePathname } from 'next/navigation'
import './site-nav.css'

const PRIMARY = [
  { href: '/', label: 'Browse', match: (path: string) => path === '/' },
  { href: '/compare', label: 'Compare', match: (path: string) => path.startsWith('/compare') },
  { href: '/unclaimed', label: 'Unclaimed', match: (path: string) => path.startsWith('/unclaimed') },
] as const

/** Buyer-facing nav — primary routes grouped; trust/docs link kept separate on the rail. */
export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="site-nav" aria-label="Marketplace">
      <div className="site-nav__primary">
        {PRIMARY.map((item) => {
          const active = item.match(pathname)
          return (
            <a
              key={item.href}
              href={item.href}
              className={active ? 'site-nav__link is-active' : 'site-nav__link'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </a>
          )
        })}
      </div>

      <div className="site-nav__rail" aria-hidden="true" />

      <span className="site-nav__network">
        <span className="site-nav__network-dot" aria-hidden="true" />
        BNB Chain
      </span>

      <a
        href="/methodology"
        className={
          pathname.startsWith('/methodology')
            ? 'site-nav__link site-nav__link--muted is-active'
            : 'site-nav__link site-nav__link--muted'
        }
        aria-current={pathname.startsWith('/methodology') ? 'page' : undefined}
      >
        Methodology
      </a>
    </nav>
  )
}
