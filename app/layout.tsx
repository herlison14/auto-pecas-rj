import type { Metadata } from 'next';
import { Bebas_Neue, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lead Radar — Prospecção B2B Multi-Setor',
  description:
    'Busque, qualifique e contate empresas por setor e bairro. Análise de atividade com IA, envio de email em massa e exportação CSV.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${bebas.variable} ${dmSans.variable} ${jetBrains.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
