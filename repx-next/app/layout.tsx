import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xử lý REPX 1.0',
  description: 'Xử lý file REPX DevExpress — trích xuất logo/ảnh trên trình duyệt',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
