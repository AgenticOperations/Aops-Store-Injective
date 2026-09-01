import { IBM_Plex_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import '@repo/design-system/tokens.css'

/**
 * Gellix — a geometric sans, matched to BNB Chain's own display face. It carries the whole
 * personality of the page, so it is loaded for body and display both; the mono face is kept for
 * one job only (numbers, ids, engine labels) where tabular figures actually matter.
 *
 * The files live in `@repo/design-system` rather than in either app, so the two surfaces cannot
 * drift onto different typefaces.
 */
const gellix = localFont({
  src: [
    {
      path: '../../../../packages/design-system/fonts/Gellix-TRIAL-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../../packages/design-system/fonts/Gellix-TRIAL-Medium.otf',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-gellix',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata = { title: 'Aops Store' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${gellix.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
