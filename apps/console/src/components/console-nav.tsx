// apps/console/src/components/console-nav.tsx
import { Nav } from '@repo/design-system/components'

export function ConsoleNav() {
  return (
    <Nav
      items={[
        { href: '/', label: 'Overview' },
        { href: '/listings', label: 'Listings' },
        { href: '/disputes', label: 'Disputes' },
      ]}
    />
  )
}
