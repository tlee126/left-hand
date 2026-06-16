import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/be-vietnam-pro/900.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEFT HAND - Onthidithoi",
  description:
    "LEFT HAND - Onthidithoi là hệ sinh thái học tập dành cho sinh viên UFM, giúp tìm đúng tài liệu, tutor và lớp ôn trước mỗi kỳ thi."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-body text-ink antialiased">{children}</body>
    </html>
  );
}
