"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user, role, signOut } = useAuth();

  return (
    <RequireAuth>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <div className="text-sm text-zinc-600">Signed in as</div>
          <div className="font-mono text-sm">{user?.email || user?.uid}</div>
          <div className="text-sm">
            Role (placeholder from custom claims): <span className="font-mono">{role}</span>
          </div>
          <button
            className="rounded-md border px-3 py-1 text-sm"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>

        <div className="text-sm text-zinc-600">
          This is the shared landing area. Add role-based routing later (e.g., admin →
          /admin, merchant → merchant dashboard, consumer → offers).
        </div>
      </div>
    </RequireAuth>
  );
}
