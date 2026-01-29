"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { user, role, idToken } = useAuth();

  return (
    <RequireAuth>
      <RequireRole allow={["admin"]}>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Admin</h1>
          <div className="rounded-lg border bg-white p-4 space-y-2">
            <div className="text-sm">Welcome, {user?.email || user?.uid}</div>
            <div className="text-sm">
              Role: <span className="font-mono">{role}</span>
            </div>
            <div className="text-xs text-zinc-500">
              ID token (for API calls): {idToken ? "available" : "missing"}
            </div>
          </div>
          <p className="text-sm text-zinc-600">
            v0 placeholder. Later: manage offers, merchants, and set custom claims.
          </p>
        </div>
      </RequireRole>
    </RequireAuth>
  );
}
