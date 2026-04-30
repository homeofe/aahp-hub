import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from './sidebar';

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
      <body className="min-h-full flex bg-bg text-tx">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </body>
    </html>
  );
}
