"use client";

import { AppRole, useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RequireRole({
  allow,
  children,
}: {
  allow: AppRole[];
  children: React.ReactNode;
}) {
  const { loading, user, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!role) return;
    if (!allow.includes(role)) {
      // Placeholder redirect policy.
      router.replace("/dashboard");
    }
  }, [loading, user, role, allow, router]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  if (!role) return <div className="p-6">Loading role…</div>;
  if (!allow.includes(role)) return <div className="p-6">Redirecting…</div>;
  return <>{children}</>;
}
