import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AAHP Hub',
  description: 'Web dashboard for the AAHP runner ecosystem',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-tx">{children}</body>
    </html>
  );
}
