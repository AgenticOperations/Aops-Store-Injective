import type { NextConfig } from 'next'

/** Transpiles workspace packages so the ring carve survives the bundler. */
const config: NextConfig = {
  transpilePackages: ['@repo/design-system', '@repo/utils', '@repo/observability'],
  experimental: { typedRoutes: true },
}

export default config
