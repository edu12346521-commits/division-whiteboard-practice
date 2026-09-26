import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "除法小白板｜四年級除法練習",
  description: "用白板練習三位數除兩位數，逐步驗算豎式並查看四年級排行榜。",
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
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
