import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import Footer from "@/components/layout/footer";
import { ClientLayout } from "@/components/layout/client-layout";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FZ99 Lounge",
  description: "F-Zero 99 Matchmaking Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${notoSansJP.variable} antialiased bg-gray-900 min-h-screen`} suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
        <Footer />
      </body>
    </html>
  );
}
