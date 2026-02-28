"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BoostLogo } from "@/components/boost-logo";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface OfferDetails {
  token_id: string;
  short_code: string;
  offer_name: string;
  discount_text: string;
  terms?: string;
  merchant_name: string;
  active_hours?: string;
  cap_remaining: number;
  qr_data: string;
}

export default function ClaimPage() {
  const params = useParams();
  const tokenId = params.token as string;
  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenId) return;

    fetch(`${API_BASE}/public/offers/${tokenId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({ detail: "Something went wrong" }));
          throw new Error(data.detail || `Error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setOffer(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [tokenId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
        <div className="animate-pulse text-zinc-400">Loading offer...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 text-center">
        <div className="mb-4 text-4xl">😔</div>
        <h1 className="mb-2 text-xl font-semibold text-white">Offer Unavailable</h1>
        <p className="text-zinc-400">{error}</p>
      </div>
    );
  }

  if (!offer) return null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
      {/* Header */}
      <div className="mb-6 mt-4">
        <BoostLogo />
      </div>

      {/* Offer Card */}
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur">
        {/* Merchant & Offer */}
        <div className="mb-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            {offer.merchant_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">{offer.offer_name}</h1>
        </div>

        {/* Discount highlight */}
        <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-center">
          <p className="text-3xl font-extrabold text-white">{offer.discount_text}</p>
        </div>

        {/* QR Code for staff to scan */}
        <div className="mb-4 flex flex-col items-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Show this to the cashier
          </p>
          <div className="rounded-xl bg-white p-4">
            <img
              src={`${API_BASE}/tokens/${offer.token_id}/qr`}
              alt="QR Code"
              className="h-48 w-48"
            />
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-[0.3em] text-zinc-300">
            {offer.short_code}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-2 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
          {offer.terms && (
            <div className="flex items-start gap-2">
              <span className="text-zinc-600">Terms:</span>
              <span>{offer.terms}</span>
            </div>
          )}
          {offer.active_hours && (
            <div className="flex items-start gap-2">
              <span className="text-zinc-600">Hours:</span>
              <span>{offer.active_hours}</span>
            </div>
          )}
          {offer.cap_remaining <= 5 && offer.cap_remaining > 0 && (
            <div className="mt-2 rounded-lg bg-amber-900/30 p-2 text-center text-amber-400">
              Only {offer.cap_remaining} left today — hurry!
            </div>
          )}
          {offer.cap_remaining === 0 && (
            <div className="mt-2 rounded-lg bg-red-900/30 p-2 text-center text-red-400">
              Today&apos;s limit reached. Come back tomorrow!
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-zinc-600">
        Powered by Boost — pay-per-result local marketing
      </p>
    </div>
  );
}
