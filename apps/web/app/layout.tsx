import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fz99lounge.com"),
  title: {
    default: "FZ99 Lounge | F-Zero 99 Private Matchmaking",
    template: "%s | FZ99 Lounge",
  },
  description:
    "FZ99 Lounge is an unofficial private matchmaking platform for F-Zero 99. Experience thrilling races with players from around the world!",
  keywords: [
    "F-Zero 99",
    "FZ99",
    "matchmaking",
    "competitive",
    "lounge",
    "ranked",
    "ranking",
    "Nintendo Switch",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "FZ99 Lounge | F-Zero 99 Private Matchmaking",
    description:
      "An unofficial private matchmaking platform for F-Zero 99. Experience thrilling races with players from around the world!",
    url: "https://fz99lounge.com",
    siteName: "FZ99 Lounge",
    images: [
      {
        url: "/fz99lounge.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FZ99 Lounge | F-Zero 99 Private Matchmaking",
    description:
      "An unofficial private matchmaking platform for F-Zero 99. Experience thrilling races with players from around the world!",
    images: ["/fz99lounge.jpg"],
  },
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
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
