import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOYA Shortform | 내 가게 홍보영상 작업실",
  description: "가게 사진으로 만드는 개인용 홍보 숏폼 작업 도구",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
