"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { user, loading, signInWithGoogle, sendEmailLink, tryCompleteEmailLinkSignIn } =
    useAuth();

  const [nextPath, setNextPath] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new URLSearchParams(window.location.search).get("next");
    setNextPath(next || "/dashboard");
  }, []);

  useEffect(() => {
    // If user opened an email sign-in link, complete it.
    tryCompleteEmailLinkSignIn().catch((e) => setError(e?.message || String(e)));
  }, [tryCompleteEmailLinkSignIn]);

  useEffect(() => {
    if (!loading && user) {
      window.location.assign(nextPath);
    }
  }, [loading, user, nextPath]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Login</h1>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="text-sm text-zinc-600">Sign in with Google</div>
        <button
          className="w-full rounded-md bg-black px-4 py-2 text-white"
          onClick={() => signInWithGoogle().catch((e) => setError(e?.message || String(e)))}
        >
          Continue with Google
        </button>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="text-sm text-zinc-600">Or sign in with an email link</div>
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="w-full rounded-md border px-4 py-2"
          onClick={async () => {
            setError(null);
            setStatus(null);
            try {
              await sendEmailLink(email);
              setStatus("Email link sent. Check your inbox.");
            } catch (e: any) {
              setError(e?.message || String(e));
            }
          }}
        >
          Send sign-in link
        </button>
      </div>

      {status ? <div className="text-sm text-green-700">{status}</div> : null}
      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      <div className="text-xs text-zinc-500">
        Redirect after login: <span className="font-mono">{nextPath}</span>
      </div>
    </div>
  );
}
