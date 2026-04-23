import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "栖安 — AI 物业管理平台",
  description: "AI-Native 全平台物管系统，为华人物管团队打造",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
