"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";

export default function RedeemPage() {
  const { role } = useAuth();

  return (
    <RequireAuth>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Redeem</h1>
        <p className="text-sm text-zinc-600">
          v0 placeholder for consumer redemption flow.
        </p>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm">
            Current role: <span className="font-mono">{role}</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            In later versions, you might restrict this to consumers or merchants.
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
