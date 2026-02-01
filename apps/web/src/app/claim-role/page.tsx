"use client";

import { useAuth } from "@/lib/auth";
import { claimRole } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClaimRolePage() {
  const { loading, user, idToken, refreshToken, role } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "claiming" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [claimedRole, setClaimedRole] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    // If not logged in, redirect to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // If user already has a role, redirect to appropriate dashboard
    if (role) {
      if (role === "owner") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
      return;
    }

    // Try to claim pending role
    async function attemptClaim() {
      if (!idToken) return;

      setStatus("claiming");
      try {
        const result = await claimRole(idToken);

        if (result.success) {
          setStatus("success");
          setMessage(result.message);
          setClaimedRole(result.role || null);

          // Refresh token to get new claims
          await refreshToken();

          // Redirect after a short delay
          setTimeout(() => {
            if (result.role === "owner") {
              router.replace("/admin");
            } else {
              router.replace("/dashboard");
            }
          }, 2000);
        } else {
          setStatus("error");
          setMessage(result.message);
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Failed to claim role");
      }
    }

    attemptClaim();
  }, [loading, user, role, idToken, refreshToken, router]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "claiming") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-600 mb-4">{message}</p>
          {claimedRole && (
            <p className="text-sm text-gray-500">
              Role: <span className="font-medium capitalize">{claimedRole.replace("_", " ")}</span>
            </p>
          )}
          <p className="text-sm text-gray-400 mt-4">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Issue</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-y-3">
          <button
            onClick={() => router.push("/login")}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </button>
          <p className="text-sm text-gray-500">
            Contact support if you believe this is an error.
          </p>
        </div>
      </div>
    </div>
  );
}
