"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BoostLogo } from "@/components/boost-logo";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <BoostLogo />
        {!loading && !user && (
          <Link
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            href="/login"
          >
            Merchant Login
          </Link>
        )}
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Only pay when customers{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              actually show up
            </span>
          </h1>

          <p className="text-lg text-zinc-400">
            Boost is performance-based local marketing. Create discount offers,
            distribute QR codes via social ads, and pay only when a customer
            redeems at your register. No impressions, no clicks — just results.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link
              className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              href="/login"
            >
              Get Started — Free
            </Link>
            <a
              className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              href="#how-it-works"
            >
              See How It Works
            </a>
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-white">
            How Boost Works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create an Offer",
                desc: 'Set your discount (e.g. "$2 off any coffee"), daily cap, and value per redemption.',
              },
              {
                step: "2",
                title: "Share QR Codes",
                desc: "Distribute via TikTok, Instagram, or Google Ads. Each offer gets a unique QR code.",
              },
              {
                step: "3",
                title: "Pay Per Redemption",
                desc: "Staff scans the QR at the register. You only pay when a real customer redeems.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            Traditional Ads vs Boost
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4">
              <h3 className="mb-3 font-semibold text-red-400">Traditional Ads</h3>
              <ul className="space-y-2 text-zinc-400">
                <li>Pay for impressions</li>
                <li>No tracking at register</li>
                <li>Hope customers come</li>
                <li>Upfront costs</li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-4">
              <h3 className="mb-3 font-semibold text-emerald-400">Boost</h3>
              <ul className="space-y-2 text-zinc-400">
                <li>Pay for redemptions</li>
                <li>Verified at register</li>
                <li>Know they came</li>
                <li>Pay-per-result</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-6 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold text-white">Ready to boost your foot traffic?</h2>
        <p className="mb-6 text-zinc-400">Set up in 5 minutes. No credit card required.</p>
        <Link
          className="rounded-lg bg-emerald-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          href="/login"
        >
          Start Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
          <BoostLogo />
          <div className="flex gap-6 text-xs text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-300">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-zinc-300">Privacy Policy</Link>
          </div>
          <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} Boost</p>
        </div>
      </footer>
    </div>
  );
}
