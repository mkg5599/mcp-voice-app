import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Voice Shopping Agent",
  description: "A voice-enabled AI shopping assistant that searches a product catalog through the Model Context Protocol.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f12" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-10 h-14 border-b border-border bg-bg/90 backdrop-blur">
          <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
            <Link href="/" className="font-semibold tracking-tight">
              Voice Shopping Agent
            </Link>
            <div className="flex items-center gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-text">
                Shop
              </Link>
              <Link href="/about" className="hover:text-text">
                How it works
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
