import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boost",
  description: "Merchant + consumer web (v0)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="min-h-screen bg-zinc-50 text-zinc-900">
            <header className="border-b bg-white">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <div className="font-semibold">
                  <Link href="/">Boost</Link>
                </div>
                <nav className="flex gap-4 text-sm">
                  <Link className="hover:underline" href="/login">
                    Login
                  </Link>
                  <Link className="hover:underline" href="/dashboard">
                    Dashboard
                  </Link>
                  <Link className="hover:underline" href="/redeem">
                    Redeem
                  </Link>
                  <Link className="hover:underline" href="/admin">
                    Admin
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
