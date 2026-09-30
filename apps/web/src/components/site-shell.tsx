import { Shell } from '@repo/design-system/components'
import type { ReactNode } from 'react'
import { SiteBrand } from './site-brand'
import { SiteNav } from './site-nav'
import './site-nav.css'

/** Web marketplace frame — Aops brand + instrument-style nav bar. */
export function SiteShell({
  children,
  deco,
}: {
  children: ReactNode
  deco?: boolean
}) {
  return (
    <Shell
      brand={<SiteBrand />}
      {...(deco ? { deco: true } : {})}
      headerClassName="web-header"
      nav={<SiteNav />}
    >
      {children}
    </Shell>
  )
}
