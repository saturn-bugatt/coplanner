import type { Metadata } from 'next'
import { GeistSans, GeistMono } from 'geist/font'
import { Playfair_Display } from 'next/font/google'
import './globals.css'

// Using Playfair Display as a serif alternative to Beton
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-beton',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'CoPlanner | Saturn Hackathon Leaderboard',
  description: 'Live hackathon leaderboard with AI-powered scoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${playfair.variable}`}>{children}</body>
    </html>
  )
}
