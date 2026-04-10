import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'omni-clip — Video Downloader',
  description: 'Download videos from multiple platforms with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
