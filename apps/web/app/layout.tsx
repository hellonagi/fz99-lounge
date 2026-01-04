import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FZ99 Lounge",
  description: "F-Zero 99 Matchmaking Platform",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${notoSansJP.variable} antialiased bg-gray-900 min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
