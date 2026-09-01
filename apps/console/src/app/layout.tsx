import { IBM_Plex_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import '@repo/design-system/tokens.css'

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

export const metadata = { title: 'Builder Console' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${gellix.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
