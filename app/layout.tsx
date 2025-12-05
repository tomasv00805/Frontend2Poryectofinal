import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Procesamiento de ECG',
  description: 'Pipeline completo de procesamiento de señales ECG con detección de anomalías',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

