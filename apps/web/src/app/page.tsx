"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Boost (v0)</h1>
      
      <div className="rounded border p-4 text-left text-xs text-muted-foreground">
        <p>Status: {loading ? "Loading..." : user ? "Logged In" : "Not Logged In"}</p>
        {user && <p>User: {user.email}</p>}
        {user && (
          <div className="mt-2">
            <Link className="text-blue-500 underline" href="/dashboard">
              Force Go to Dashboard
            </Link>
          </div>
        )}
      </div>

      <p className="text-zinc-600">
        Minimal scaffold for merchant + consumer flows.
      </p>
      
      {!loading && !user && (
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="rounded-md bg-black px-4 py-2 text-white" href="/login">
            Login
          </Link>
        </div>
      )}
    </div>
  );
}
