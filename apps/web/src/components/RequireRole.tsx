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
  // Use effectiveRole to support impersonation (viewAs)
  const { loading, user, effectiveRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!effectiveRole) return;
    if (!allow.includes(effectiveRole)) {
      // Redirect based on effective role
      if (effectiveRole === "owner") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [loading, user, effectiveRole, allow, router]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return null;
  if (!effectiveRole) return <div className="p-6">Loading role...</div>;
  if (!allow.includes(effectiveRole)) return <div className="p-6">Redirecting...</div>;
  return <>{children}</>;
}
