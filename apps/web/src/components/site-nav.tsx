// apps/web/src/components/site-nav.tsx
import { Nav } from '@repo/design-system/components'

/**
 * `Unclaimed` is a peer of the marketplace in the nav, not a tab inside it — the directory is
 * deliberately not the marketplace (`final-review-docs/01` §3: no hire button, excluded from
 * discovery and ranking), and putting it inside the browse surface would blur exactly the line
 * that section draws.
 */
export function SiteNav() {
  return (
    <Nav
      items={[
        { href: '/', label: 'Find an agent' },
        { href: '/compare', label: 'Compare' },
        { href: '/unclaimed', label: 'Unclaimed' },
        { href: '/methodology', label: 'Methodology' },
      ]}
    />
  )
}
