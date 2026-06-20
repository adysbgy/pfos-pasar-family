import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PFOS — Pasar Family Operating System',
  description: 'Sistem operasional Pasar Family',
  // PWA manifest (tambahkan /public/manifest.json nanti)
  // manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,       // Cegah zoom di HP (kasir, dapur)
  userScalable: false,
  themeColor: '#111827', // gray-900
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
