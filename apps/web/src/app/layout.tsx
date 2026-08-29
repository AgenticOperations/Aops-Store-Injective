import '@repo/design-system/tokens.css'

export const metadata = { title: 'Aops Store' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
